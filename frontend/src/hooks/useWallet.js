import { useCallback, useEffect, useRef, useState } from "react";
import { CHAIN } from "../config/network.js";

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function chainIdHex() {
  return "0x" + CHAIN.id.toString(16);
}

async function ensureChain(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex() }],
    });
  } catch (switchError) {
    // 4902: chain not added to this wallet yet.
    if (switchError && switchError.code === 4902) {
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
    } else {
      throw switchError;
    }
  }
}

/**
 * Wallet connection state. `disconnect()` only clears local React state -
 * MetaMask itself has no programmatic disconnect - but `connect()` always
 * re-requests permissions first, which re-opens the wallet's own account
 * picker. So after a disconnect, clicking Connect again lets the person
 * choose a different account instead of silently reusing the last one.
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainOk, setChainOk] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const manuallyDisconnected = useRef(false);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No EVM wallet found. Install MetaMask, Rabby, or another injected wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    manuallyDisconnected.current = false;
    try {
      // Force the wallet's own account picker so a person can switch
      // accounts on reconnect rather than silently getting the last one.
      try {
        await provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (_permissionError) {
        // Some wallets (older Trust Wallet builds, some mobile browsers)
        // don't support wallet_requestPermissions - fall through to the
        // plain request below, which still works for a first connection.
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No account returned by wallet.");
      setAddress(accounts[0]);
      await ensureChain(provider);
      setChainOk(true);
    } catch (err) {
      setError(err?.message ?? "Failed to connect wallet.");
      setAddress(null);
      setChainOk(false);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    manuallyDisconnected.current = true;
    setAddress(null);
    setChainOk(false);
    setError(null);
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const onAccountsChanged = (accounts) => {
      if (manuallyDisconnected.current) return;
      setAddress(accounts?.[0] ?? null);
    };
    const onChainChanged = (newChainIdHex) => {
      setChainOk(newChainIdHex?.toLowerCase() === chainIdHex().toLowerCase());
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  return {
    address,
    connected: Boolean(address && chainOk),
    connecting,
    chainOk,
    error,
    connect,
    disconnect,
  };
}
