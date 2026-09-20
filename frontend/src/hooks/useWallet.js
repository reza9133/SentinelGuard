import { useCallback, useEffect, useState } from "react";
import { CHAIN } from "../config/network.js";

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function chainIdHex() {
  return "0x" + CHAIN.id.toString(16);
}

async function currentChainIdHex(provider) {
  const id = await provider.request({ method: "eth_chainId" });
  return String(id).toLowerCase();
}

/**
 * Switches to CHAIN, adding it first if the wallet doesn't know it yet.
 * Returns true on success, false if the user rejected it or the wallet
 * doesn't support the request - callers decide what to do with that,
 * rather than this function throwing and taking down an otherwise-good
 * connection with it.
 */
async function switchToTargetChain(provider) {
  const target = chainIdHex();
  try {
    if ((await currentChainIdHex(provider)) === target) return true;
  } catch (_readError) {
    // Some wallets don't support eth_chainId directly; fall through and
    // just attempt the switch, which will no-op if already on it.
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target }],
    });
    return true;
  } catch (switchError) {
    // 4902: this wallet has never seen the chain - add it, which (per
    // EIP-3085) also switches to it on approval.
    if (switchError && switchError.code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: target,
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
      } catch (_addError) {
        return false;
      }
    }
    // 4001 (user rejected) or anything else the wallet throws - report it
    // as "didn't switch" rather than propagating and wiping the account
    // that just connected successfully a moment earlier.
    return false;
  }
}

/**
 * Wallet connection state.
 *
 * `disconnect()` calls `wallet_revokePermissions` when the wallet supports
 * it (MetaMask and other EIP-2255 wallets). That's the actual fix for
 * "connect must let me pick a different wallet/account next time": without
 * it, the wallet keeps its own eth_accounts permission granted regardless
 * of what our React state says, so a later `eth_requestAccounts` silently
 * returns the same account with no picker at all. `wallet_requestPermissions`
 * in `connect()` is kept as a second attempt for wallets that don't support
 * revocation but do re-prompt on a fresh permissions request.
 *
 * A failed network switch no longer resets `address` to null. Previously
 * any error there (including a plain rejection) fell into the same catch
 * block as the account-connection failure, which cleared `address` in
 * React state while the wallet extension's own permission stayed granted -
 * so the *next* click silently reconnected the same account with the wrong
 * chain still active, which is exactly the bug reported. Now a bad switch
 * just leaves `wrongNetwork: true` with a `switchNetwork()` retry action,
 * and the account stays connected.
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainOk, setChainOk] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const switchNetwork = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    const ok = await switchToTargetChain(provider);
    setChainOk(ok);
    if (!ok) setError("Switch your wallet to Studionet to continue.");
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No EVM wallet found. Install MetaMask, Rabby, or another injected wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // Ask for a fresh account selection where the wallet supports it.
      try {
        await provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (_permissionError) {
        // Not supported by every wallet - fine, eth_requestAccounts below
        // still works for a first-time connection.
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No account returned by wallet.");
      setAddress(accounts[0]);

      const ok = await switchToTargetChain(provider);
      setChainOk(ok);
      if (!ok) setError("Connected, but switch your wallet to Studionet to continue.");
    } catch (err) {
      setError(err?.message ?? "Failed to connect wallet.");
      setAddress(null);
      setChainOk(false);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      try {
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (_revokeError) {
        // Wallet doesn't support EIP-2255 revocation - our own state below
        // still clears, and connect() will retry wallet_requestPermissions
        // next time to at least attempt a fresh picker.
      }
    }
    setAddress(null);
    setChainOk(false);
    setError(null);
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return undefined;

    const onAccountsChanged = (accounts) => {
      setAddress(accounts?.[0] ?? null);
    };
    const onChainChanged = (newChainIdHex) => {
      setChainOk(String(newChainIdHex).toLowerCase() === chainIdHex());
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
    wrongNetwork: Boolean(address && !chainOk),
    connecting,
    chainOk,
    error,
    connect,
    disconnect,
    switchNetwork,
  };
}
