import { useCallback, useEffect, useState } from "react";
import { CHAIN, NETWORK_NAME } from "../config/network.js";
import {
  discoverWallets,
  getActiveProvider,
  setActiveProvider,
  subscribeToWallets,
} from "../lib/eip6963.js";

// Remembers which wallet (by EIP-6963 rdns) to auto-reconnect to.
const SELECTED_WALLET_KEY = "sentinelguard_wallet_rdns";
// Set when the person clicks Disconnect, so we do NOT silently reconnect on
// the next page load even though the wallet still has permission.
const DISCONNECT_FLAG = "sentinelguard_wallet_disconnected";

const NETWORK_LABEL = NETWORK_NAME.charAt(0).toUpperCase() + NETWORK_NAME.slice(1);

// localStorage can throw (private mode, blocked storage) - never let that
// take the wallet flow down.
function store(action, key, value) {
  try {
    if (typeof window === "undefined") return null;
    if (action === "get") return window.localStorage.getItem(key);
    if (action === "set") window.localStorage.setItem(key, value);
    if (action === "remove") window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  return null;
}

function chainIdHex() {
  return "0x" + CHAIN.id.toString(16);
}

function isTargetChain(idHex) {
  return Boolean(idHex) && parseInt(String(idHex), 16) === CHAIN.id;
}

function describeError(err, fallback) {
  if (err?.code === 4001) return "Request cancelled in your wallet.";
  if (err?.code === -32002) {
    return "A request is already pending in your wallet — open the extension to continue.";
  }
  return err?.message || fallback;
}

async function readChainId(provider) {
  try {
    return String(await provider.request({ method: "eth_chainId" }));
  } catch {
    return null;
  }
}

/**
 * Switches to CHAIN, adding it first if the wallet doesn't know it yet.
 * Returns true on success, false if the person rejected it or the wallet
 * doesn't support the request - a failed switch never drops an otherwise
 * good connection, it just leaves `wrongNetwork: true` with a retry action.
 */
async function switchToTargetChain(provider) {
  if (isTargetChain(await readChainId(provider))) return true;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex() }],
    });
    return true;
  } catch (switchError) {
    // 4902: this wallet has never seen the chain - add it, which (EIP-3085)
    // also switches to it on approval.
    if (switchError?.code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex(),
              chainName: CHAIN.name,
              nativeCurrency: CHAIN.nativeCurrency,
              rpcUrls: CHAIN.rpcUrls?.default?.http ?? [],
              blockExplorerUrls: CHAIN.blockExplorers?.default?.url
                ? [CHAIN.blockExplorers.default.url]
                : [],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Wallet state for the whole app.
 *
 *  - EIP-6963 discovery -> `availableWallets`, so the person can pick which
 *    wallet to use instead of whichever grabbed `window.ethereum`.
 *  - The picked wallet is remembered and auto-reconnected on the next visit
 *    (unless the person disconnected on purpose).
 *  - `disconnect()` revokes this site's permission in the wallet itself, so
 *    the next connect shows a real consent prompt instead of silently
 *    re-approving the same account.
 *  - `switchAccount()` opens the wallet's own account picker.
 *  - The connect modal's open state lives here so any button in the app
 *    (header, the "connect a wallet" banner) can open the same modal.
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [selectedWalletRdns, setSelectedWalletRdns] = useState(null);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [initializing, setInitializing] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const chainOk = isTargetChain(chainId);

  // -- live wallet discovery ---------------------------------------------
  useEffect(() => subscribeToWallets(setAvailableWallets), []);

  // -- restore the previous session on load ------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The person disconnected on purpose: stay disconnected.
      if (store("get", DISCONNECT_FLAG) === "true") {
        setInitializing(false);
        return;
      }

      let rdns = store("get", SELECTED_WALLET_KEY);
      if (rdns) {
        const wallets = await discoverWallets();
        const match = wallets.find((w) => w.info.rdns === rdns);
        if (match) {
          setActiveProvider(match.provider);
        } else {
          // That wallet is no longer installed - forget it.
          rdns = null;
          store("remove", SELECTED_WALLET_KEY);
        }
      }
      if (cancelled) return;

      const active = getActiveProvider();
      if (!active) {
        setInitializing(false);
        return;
      }

      try {
        // eth_accounts (not eth_requestAccounts): no popup, only returns an
        // account if the wallet already granted this site access.
        const accounts = await active.request({ method: "eth_accounts" });
        const id = await readChainId(active);
        if (cancelled) return;
        setProvider(active);
        setSelectedWalletRdns(rdns);
        setChainId(id);
        setAddress(accounts?.[0] ?? null);
      } catch {
        // Wallet not ready / locked - stay disconnected.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // -- follow account / chain changes made inside the wallet -------------
  useEffect(() => {
    if (!provider?.on) return undefined;

    const onAccountsChanged = async (accounts) => {
      const next = accounts?.[0] ?? null;
      if (next) store("remove", DISCONNECT_FLAG);
      const id = await readChainId(provider);
      setAddress(next);
      if (id) setChainId(id);
    };
    const onChainChanged = (id) => setChainId(String(id));
    const onDisconnect = () => setAddress(null);

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    provider.on("disconnect", onDisconnect);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [provider]);

  // -- modal --------------------------------------------------------------
  const openModal = useCallback(() => {
    setError(null);
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const clearError = useCallback(() => setError(null), []);

  // -- actions ------------------------------------------------------------
  /**
   * Pass an entry from `availableWallets` to connect to that specific
   * wallet (what the picker does). With no argument it uses whichever
   * provider is already active / `window.ethereum`.
   */
  const connect = useCallback(async (walletDetail) => {
    // Guard against being wired straight to onClick (which passes an event).
    const detail = walletDetail?.info && walletDetail?.provider ? walletDetail : null;
    const target = detail ? detail.provider : getActiveProvider();

    if (!target) {
      setError("No EVM wallet found. Install MetaMask, Rabby, or another wallet extension.");
      return null;
    }

    setConnecting(true);
    setError(null);
    try {
      const accounts = await target.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No account returned by wallet.");

      // Only now commit the choice, so cancelling the popup leaves nothing
      // half-selected. Order matters: the active provider must be set
      // before `address` changes, because useSentinelClient builds its
      // signing client off that address change.
      if (detail) {
        setActiveProvider(detail.provider);
        store("set", SELECTED_WALLET_KEY, detail.info.rdns);
      }
      store("remove", DISCONNECT_FLAG);

      const switched = await switchToTargetChain(target);
      const id = await readChainId(target);

      setProvider(target);
      if (detail) setSelectedWalletRdns(detail.info.rdns);
      setChainId(id);
      setAddress(accounts[0]);

      if (switched) {
        setModalOpen(false);
      } else {
        setError(`Connected, but your wallet is not on ${NETWORK_LABEL}. Switch network to continue.`);
      }
      return accounts[0];
    } catch (err) {
      setError(describeError(err, "Failed to connect wallet."));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const active = getActiveProvider();
    if (active) {
      try {
        await active.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Not every wallet implements revocation - local disconnect below
        // still works, it just won't force a fresh prompt on that wallet.
      }
    }

    setActiveProvider(null);
    store("remove", SELECTED_WALLET_KEY);
    store("set", DISCONNECT_FLAG, "true");

    setProvider(null);
    setSelectedWalletRdns(null);
    setAddress(null);
    setChainId(null);
    setError(null);
    setModalOpen(false);
  }, []);

  const switchAccount = useCallback(async () => {
    const active = getActiveProvider();
    if (!active) return null;

    setSwitching(true);
    setError(null);
    try {
      // Shows the wallet's own account picker even when already connected.
      await active.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await active.request({ method: "eth_accounts" });
      if (!accounts?.[0]) throw new Error("No account selected.");
      setAddress(accounts[0]);
      return accounts[0];
    } catch (err) {
      setError(describeError(err, "Failed to switch account."));
      return null;
    } finally {
      setSwitching(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const active = getActiveProvider();
    if (!active) return;

    setSwitching(true);
    setError(null);
    try {
      const ok = await switchToTargetChain(active);
      const id = await readChainId(active);
      if (id) setChainId(id);
      if (!ok) setError(`Switch your wallet to ${NETWORK_LABEL} to continue.`);
    } finally {
      setSwitching(false);
    }
  }, []);

  return {
    address,
    chainId,
    chainOk,
    connected: Boolean(address && chainOk),
    wrongNetwork: Boolean(address && !chainOk),

    initializing,
    connecting,
    switching,
    error,
    clearError,

    availableWallets,
    selectedWalletRdns,
    // Either an EIP-6963 wallet announced itself, or a legacy injected one exists.
    hasWallet: availableWallets.length > 0 || Boolean(getActiveProvider()),

    modalOpen,
    openModal,
    closeModal,

    connect,
    disconnect,
    switchAccount,
    switchNetwork,
  };
}
