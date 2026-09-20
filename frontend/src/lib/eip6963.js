// -----------------------------------------------------------------------
// EIP-6963 wallet discovery + "active provider" registry
// -----------------------------------------------------------------------
// EIP-6963 lets every installed wallet extension (MetaMask, Rabby, OKX,
// Coinbase...) announce itself instead of all of them fighting over
// `window.ethereum`. That is what makes a real wallet picker possible.
//
// The active provider lives here, at module level, so useWallet (which
// picks it) and useSentinelClient (which signs with it) always talk to the
// same wallet. When nothing has been picked yet it falls back to
// `window.ethereum`, so older single-wallet setups keep working.
// -----------------------------------------------------------------------

let activeProvider = null;

export function setActiveProvider(provider) {
  activeProvider = provider ?? null;
}

export function getActiveProvider() {
  if (activeProvider) return activeProvider;
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

/**
 * Ask every wallet to announce itself and collect the answers for a short
 * window (announcements are near-instant but not guaranteed to land on the
 * same tick).
 */
export function discoverWallets(timeoutMs = 250) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve([]);
      return;
    }
    const found = new Map();
    const onAnnounce = (event) => {
      const detail = event?.detail;
      if (detail?.info?.uuid) found.set(detail.info.uuid, detail);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve(Array.from(found.values()));
    }, timeoutMs);
  });
}

/**
 * Live version: also picks up extensions that announce themselves late.
 * Returns an unsubscribe function.
 */
export function subscribeToWallets(onUpdate) {
  if (typeof window === "undefined") return () => {};
  const found = new Map();
  const onAnnounce = (event) => {
    const detail = event?.detail;
    if (detail?.info?.uuid) {
      found.set(detail.info.uuid, detail);
      onUpdate(Array.from(found.values()));
    }
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
}
