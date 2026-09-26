import { useEffect, useState } from "react";

/**
 * Resolves SentinelGuard's owner address (from stats().owner, the only place
 * it's exposed) and compares it against the connected wallet - client-side
 * only, purely to gate what the UI *shows*. The contract itself still
 * enforces `sender == owner` on every owner-only write (set_incident_bond,
 * set_hook_grace, withdraw_treasury), so this hook can never be the actual
 * security boundary, only a convenience so non-owners don't see controls
 * that would just revert.
 */
export function useOwner(sentinel, walletAddress) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sentinel
      .stats()
      .then((s) => !cancelled && setOwner(s?.owner ?? null))
      .catch(() => !cancelled && setOwner(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sentinel]);

  const isOwner = Boolean(
    owner && walletAddress && owner.toLowerCase() === walletAddress.toLowerCase()
  );

  return { owner, isOwner, loading };
}
