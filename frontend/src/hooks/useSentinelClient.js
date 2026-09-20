import { useEffect, useState } from "react";
import { createClient } from "genlayer-js";
import { CHAIN, NETWORK_NAME, CONTRACTS, IS_FEE_NETWORK } from "../config/network.js";

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
 * The installed genlayer-js line for this network does not export an
 * `isSuccessful` helper (that's a v2-RC addition documented for the
 * Studio Next / v0.6 preview only) - a transaction can be ACCEPTED and
 * still have failed inside the contract, so both fields on the receipt
 * have to be checked directly.
 */
function txSucceeded(receipt) {
  const status = receipt?.statusName ?? receipt?.status;
  const decided = status === "ACCEPTED" || status === "FINALIZED";
  return decided && receipt?.txExecutionResultName === "FINISHED_WITH_RETURN";
}

/**
 * Bundles the read-only client (always usable) with a wallet-bound write
 * client (only once a wallet address is connected), plus one typed helper
 * per SentinelGuard method the UI needs.
 */
export function useSentinelClient(walletAddress) {
  const [writeClient, setWriteClient] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress || typeof window === "undefined" || !window.ethereum) {
      setWriteClient(null);
      return undefined;
    }
    (async () => {
      const client = createClient({
        chain: CHAIN,
        account: walletAddress,
        provider: window.ethereum,
      });
      await client.connect(NETWORK_NAME);
      if (!cancelled) setWriteClient(client);
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
      // Fee-charging networks (Studio Next / studio-dev, consensus v0.6)
      // need the matching genlayer-js v2 release-candidate package, which
      // adds estimateTransactionFeesForWrite. It is not present in the
      // stable line this app installs for Studionet.
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

    // -- writes (require a connected wallet) --------------------------------
    reportIncident: (target, evidence, bondWei) =>
      submit("report_incident", [target, evidence], bondWei),
    requestResumeReview: (target, evidence, bondWei) =>
      submit("request_resume_review", [target, evidence], bondWei),
  };
}
