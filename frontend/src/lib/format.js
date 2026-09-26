const WEI_PER_GEN = 10n ** 18n;

export function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

export function weiToGen(wei, digits = 3) {
  const v = toBigInt(wei);
  const whole = v / WEI_PER_GEN;
  const frac = v % WEI_PER_GEN;
  const fracStr = frac.toString().padStart(18, "0").slice(0, digits);
  return `${whole.toString()}.${fracStr}`;
}

export function genToWei(genAmountString) {
  const [whole, frac = ""] = String(genAmountString).split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * WEI_PER_GEN + BigInt(fracPadded || "0");
}

export function shortAddress(address, lead = 6, trail = 4) {
  if (!address) return "—";
  return `${address.slice(0, lead)}…${address.slice(-trail)}`;
}

export function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export const DECISION_LABEL = {
  pending: "Pending",
  action: "Action taken",
  no_action: "No action",
  uncertain: "Uncertain",
};

export const DECISION_TONE = {
  pending: "pending",
  action: "active",
  no_action: "muted",
  uncertain: "pending",
};

// hook_status, as returned on each Incident by get_incident / recent_incidents:
// "n/a" (no hook involved), "pending" (halt/resume triggered, hook not yet
// verified or reconciled), "verified" (finalized hook confirmed), "failed"
// (reconciled back after the grace period with no confirmation).
export const HOOK_STATUS_LABEL = {
  "n/a": "No hook involved",
  pending: "Awaiting finalized hook",
  verified: "Hook verified",
  failed: "Hook failed (reconciled)",
};

export const HOOK_STATUS_TONE = {
  "n/a": "muted",
  pending: "pending",
  verified: "active",
  failed: "halted",
};
