import { useEffect, useState } from "react";
import { createClient } from "genlayer-js";
import { CHAIN, NETWORK_NAME, CONTRACTS, IS_FEE_NETWORK } from "../config/network.js";
import { getActiveProvider } from "../lib/eip6963.js";
import { parseJson, txSucceeded, pickCorrelatedIncident, computeConsistency } from "../lib/correlate.js";

// Reads never need a wallet - one shared, account-free client for the whole
// app, created once.
const readClient = createClient({ chain: CHAIN });

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
   * Correlates the submitted incident directly against the contract's own
   * reporter -> latest-incident index instead of guessing from receipt
   * shapes or falling back to "whatever incident is most recent". A write
   * receipt from genlayer-js does not reliably expose a write method's
   * return value (that is only decoded for deploys), so the contract
   * exposes `reporter_latest_incident(reporter)` specifically for this.
   *
   * The looked-up incident is only returned if it actually matches both the
   * target and the reporter that submitted this transaction - otherwise we
   * return null rather than attribute someone else's incident to this call.
   */
  async function correlateIncident(target, reporter) {
    if (!reporter) return null;
    let incidentId;
    try {
      incidentId = await readOne("reporter_latest_incident", [reporter]);
    } catch (_) {
      return null;
    }
    if (!incidentId) return null;

    const inc = parseJson(await readOne("get_incident", [incidentId]), null);
    return pickCorrelatedIncident(inc, target, reporter);
  }

  /**
   * Reads the target's own on-chain state and SentinelGuard's guardian
   * status side by side, purely as reads - it never submits a transaction.
   * Hook verification/reconciliation is a separate, explicit, user-triggered
   * action (verifyTargetHook) so that this function can be called freely
   * (e.g. right after a report) without racing the finalized pause/resume
   * message, which only executes after the appeal window closes.
   */
  async function verifyTargetState(target) {
    let targetIsPaused = null;
    let targetObservation = null;

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

    const guardianStatus = await readOne("status", [target]);
    const targetData = parseJson(await readOne("get_target", [target]), null);
    const { isConsistent, hookPending } = computeConsistency(
      guardianStatus,
      targetIsPaused !== null ? Boolean(targetIsPaused) : null
    );

    return {
      targetAddress: target,
      targetIsPaused: targetIsPaused !== null ? Boolean(targetIsPaused) : null,
      guardianStatus,
      targetData,
      isConsistent,
      hookPending,
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
      const incident = await correlateIncident(target, walletAddress);
      const targetState = await verifyTargetState(target);
      return { ...res, incident, targetState };
    },

    requestResumeReview: async (target, evidence, bondWei) => {
      const res = await submit("request_resume_review", [target, evidence], bondWei);
      const incident = await correlateIncident(target, walletAddress);
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
