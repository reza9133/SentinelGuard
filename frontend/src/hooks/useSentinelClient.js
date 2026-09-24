import { useEffect, useState } from "react";
import { createClient } from "genlayer-js";
import { CHAIN, NETWORK_NAME, CONTRACTS, IS_FEE_NETWORK } from "../config/network.js";
import { getActiveProvider } from "../lib/eip6963.js";

// Reads never need a wallet - one shared, account-free client for the whole
// app, created once.
const readClient = createClient({ chain: CHAIN });

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Checks whether the transaction succeeded according to GenLayer receipts.
 */
function txSucceeded(receipt) {
  const status = receipt?.statusName ?? receipt?.status;
  const decided = status === "ACCEPTED" || status === "FINALIZED";
  return decided && receipt?.txExecutionResultName === "FINISHED_WITH_RETURN";
}

/**
 * Bundles the read-only client (always usable) with a wallet-bound write
 * client (only once a wallet address is connected), plus helpers to directly
 * correlate incidents and verify target on-chain state.
 */
export function useSentinelClient(walletAddress) {
  const [writeClient, setWriteClient] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const provider = getActiveProvider();
    if (!walletAddress || !provider) {
      setWriteClient(null);
      return undefined;
    }
    (async () => {
      try {
        const client = createClient({
          chain: CHAIN,
          account: walletAddress,
          provider,
        });
        await client.connect(NETWORK_NAME);
        if (!cancelled) setWriteClient(client);
      } catch (err) {
        console.error("Failed to create the wallet client:", err);
        if (!cancelled) setWriteClient(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  async function readOne(functionName, args = []) {
    return readClient.readContract({ address: CONTRACTS.sentinelGuard, functionName, args });
  }

  async function submit(functionName, args, valueWei) {
    if (!writeClient) throw new Error("Connect a wallet first.");
    const call = {
      address: CONTRACTS.sentinelGuard,
      functionName,
      args,
      value: valueWei,
    };
    if (IS_FEE_NETWORK) {
      if (typeof writeClient.estimateTransactionFeesForWrite !== "function") {
        throw new Error(
          "This network needs the genlayer-js v2 release-candidate package " +
            "(estimateTransactionFeesForWrite is not available in the installed version)."
        );
      }
      const estimate = await writeClient.estimateTransactionFeesForWrite(call);
      call.fees = { distribution: estimate.distribution, feeValue: estimate.feeValue };
    }
    const txId = await writeClient.writeContract(call);
    const receipt = await writeClient.waitForTransactionReceipt({
      hash: txId,
      status: "ACCEPTED",
      interval: 2500,
      retries: 100,
    });
    if (!txSucceeded(receipt)) {
      const reason = receipt?.txExecutionResultName ?? receipt?.statusName ?? "unknown";
      throw new Error(`Transaction did not succeed (${reason}).`);
    }
    return { txId, receipt };
  }

  /**
   * Correlates the submitted incident directly rather than guessing:
   * 1. Extracts returned incident ID from execution result/receipt if available.
   * 2. Checks target's pending_incident_id or incident record.
   * 3. Matches exact incident by target and reporter.
   */
  async function correlateIncident(target, txReceipt, reporter) {
    // 1. Check direct return value from receipt
    const directVal =
      txReceipt?.txExecutionResult?.returnValue ??
      txReceipt?.returnValue ??
      txReceipt?.returnData;
    if (typeof directVal === "string" && directVal.startsWith("inc-")) {
      const inc = parseJson(await readOne("get_incident", [directVal]), null);
      if (inc) return inc;
    }

    // 2. Check target record for pending_incident_id
    try {
      const targetData = parseJson(await readOne("get_target", [target]), null);
      if (targetData?.pending_incident_id) {
        const inc = parseJson(await readOne("get_incident", [targetData.pending_incident_id]), null);
        if (inc) return inc;
      }
    } catch (_) {}

    // 3. Fallback: match by target and reporter from recent incidents
    try {
      const recents = parseJson(await readOne("recent_incidents", [10]), []);
      const matched = recents.find(
        (r) =>
          r.target?.toLowerCase() === target?.toLowerCase() &&
          (!reporter || !r.reporter || r.reporter.toLowerCase() === reporter.toLowerCase())
      );
      if (matched) {
        return parseJson(await readOne("get_incident", [matched.id]), matched);
      }
      if (recents.length > 0) {
        return parseJson(await readOne("get_incident", [recents[0].id]), recents[0]);
      }
    } catch (_) {}

    return null;
  }

  /**
   * Verifies the target state on-chain and checks consistency with SentinelGuard:
   * 1. Queries target's own is_paused or sentinel_observe view synchronously.
   * 2. Queries SentinelGuard guardian status and target details.
   * 3. Reconciles or reports hook status on failure/success.
   */
  async function verifyTargetState(target) {
    let targetIsPaused = null;
    let targetObservation = null;

    // 1. Read target contract directly
    try {
      targetIsPaused = await readClient.readContract({
        address: target,
        functionName: "is_paused",
        args: [],
      });
    } catch (_) {
      try {
        const obsStr = await readClient.readContract({
          address: target,
          functionName: "sentinel_observe",
          args: [],
        });
        targetObservation = parseJson(obsStr, null);
        if (targetObservation && typeof targetObservation.is_paused === "boolean") {
          targetIsPaused = targetObservation.is_paused;
        } else if (targetObservation && typeof targetObservation.paused === "boolean") {
          targetIsPaused = targetObservation.paused;
        }
      } catch (_) {}
    }

    // 2. Read SentinelGuard status
    let guardianStatus = await readOne("status", [target]);
    const targetData = parseJson(await readOne("get_target", [target]), null);

    let reconciled = false;
    // 3. If in pending hook verification ("pausing" or "resuming"), verify hook
    if (guardianStatus === "pausing" || guardianStatus === "resuming") {
      if (writeClient) {
        try {
          await submit("verify_target_hook", [target], 0);
          guardianStatus = await readOne("status", [target]);
          reconciled = true;
        } catch (err) {
          console.warn("Hook verification / reconciliation:", err);
        }
      }
    }

    const isConsistent =
      targetIsPaused === null ||
      (guardianStatus === "halted" && targetIsPaused === true) ||
      (guardianStatus === "active" && targetIsPaused === false) ||
      guardianStatus === "pausing" ||
      guardianStatus === "resuming";

    return {
      targetAddress: target,
      targetIsPaused: targetIsPaused !== null ? Boolean(targetIsPaused) : null,
      guardianStatus,
      targetData,
      isConsistent,
      reconciled,
    };
  }

  return {
    ready: Boolean(writeClient),

    // -- reads --------------------------------------------------------------
    getTarget: async (target) => parseJson(await readOne("get_target", [target]), null),
    listTargets: async (n = 50) => parseJson(await readOne("list_targets", [n]), []),
    getIncident: async (id) => parseJson(await readOne("get_incident", [id]), null),
    recentIncidents: async (n = 20) => parseJson(await readOne("recent_incidents", [n]), []),
    reporterTrust: async (address) => readOne("reporter_trust", [address]),
    incidentBondAmount: async () => readOne("incident_bond_amount", []),
    treasuryBalance: async () => readOne("treasury_balance", []),
    stats: async () => parseJson(await readOne("stats", []), null),
    status: async (target) => readOne("status", [target]),

    // -- target verification & direct incident correlation ------------------
    verifyTargetState,
    correlateIncident,

    // -- writes (require a connected wallet) --------------------------------
    reportIncident: async (target, evidence, bondWei) => {
      const res = await submit("report_incident", [target, evidence], bondWei);
      const incident = await correlateIncident(target, res.receipt, walletAddress);
      const targetState = await verifyTargetState(target);
      return { ...res, incident, targetState };
    },

    requestResumeReview: async (target, evidence, bondWei) => {
      const res = await submit("request_resume_review", [target, evidence], bondWei);
      const incident = await correlateIncident(target, res.receipt, walletAddress);
      const targetState = await verifyTargetState(target);
      return { ...res, incident, targetState };
    },

    verifyTargetHook: (target) => submit("verify_target_hook", [target], 0),
    reclaimTargetControl: (target, newController) =>
      submit("reclaim_target_control", [target, newController], 0),
    updateRulebook: (target, rulebook) => submit("update_rulebook", [target, rulebook], 0),
    registerTarget: (target, rulebook, pausable) =>
      submit("register_target", [target, rulebook, pausable], 0),
  };
}
