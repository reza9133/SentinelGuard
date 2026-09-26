import { useEffect, useState } from "react";
import { NETWORK_NAME } from "../../config/network.js";
import { shortAddress } from "../../lib/format.js";
import Button from "../ui/Button.jsx";
import Modal from "./Modal.jsx";
import AddressDisplay from "./AddressDisplay.jsx";
import WalletPickerList from "./WalletPickerList.jsx";
import {
  AlertIcon,
  ChevronDownIcon,
  ExternalIcon,
  LogOutIcon,
  UserIcon,
  WalletIcon,
} from "./icons.jsx";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";
const NETWORK_LABEL = NETWORK_NAME.charAt(0).toUpperCase() + NETWORK_NAME.slice(1);

const NOTICE_TONES = {
  warn: "border-pending-300 bg-pending-50 text-pending-900",
  error: "border-halted-300 bg-halted-50 text-halted-900",
  info: "border-black/10 bg-black/[0.03] text-muted",
};

function Notice({ tone = "info", title, children }) {
  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${NOTICE_TONES[tone]}`}>
      {tone !== "info" && <AlertIcon className="mt-0.5 shrink-0" />}
      <div className="min-w-0 space-y-2">
        {title && <p className="font-medium">{title}</p>}
        <div className={`space-y-2 ${tone === "info" ? "text-xs leading-relaxed" : "leading-relaxed"}`}>{children}</div>
      </div>
    </div>
  );
}

function InfoCard({ label, children }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-canvas/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Header wallet control + the modal behind it.
 *  - disconnected: "Connect wallet" button -> modal with the wallet picker
 *  - connected: address chip -> modal with wallet details, network status,
 *    switch account and disconnect
 *
 * `sentinel` is optional; when given, the connected chip shows the
 * reporter's on-chain trust score.
 */
export default function AccountPanel({ wallet, sentinel }) {
  const {
    address,
    chainOk,
    initializing,
    connecting,
    switching,
    error,
    hasWallet,
    availableWallets,
    selectedWalletRdns,
    modalOpen,
    openModal,
    closeModal,
    connect,
    disconnect,
    switchAccount,
    switchNetwork,
  } = wallet;

  // Reporter trust (0-100, starts at 50) and lifetime report count.
  // Refetched whenever the modal opens so it's fresh after a report resolves.
  const [trust, setTrust] = useState(null);
  const [incidentCount, setIncidentCount] = useState(null);
  useEffect(() => {
    if (!address || !sentinel?.reporterTrust) {
      setTrust(null);
      setIncidentCount(null);
      return undefined;
    }
    let cancelled = false;
    sentinel
      .reporterTrust(address)
      .then((value) => {
        const n = Number(value);
        if (!cancelled) setTrust(Number.isFinite(n) ? n : null);
      })
      .catch(() => {
        if (!cancelled) setTrust(null);
      });
    sentinel
      .reporterIncidentCount(address)
      .then((value) => {
        const n = Number(value);
        if (!cancelled) setIncidentCount(Number.isFinite(n) ? n : null);
      })
      .catch(() => {
        if (!cancelled) setIncidentCount(null);
      });
    return () => {
      cancelled = true;
    };
    // `sentinel` is a new object every render; its read helpers don't
    // depend on render state, so address + modalOpen are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, modalOpen]);

  const walletName =
    availableWallets.find((w) => w.info.rdns === selectedWalletRdns)?.info.name ?? "your wallet";

  // -- not connected ------------------------------------------------------
  if (!address) {
    return (
      <>
        <Button onClick={openModal} disabled={initializing || connecting} size="sm">
          <WalletIcon />
          {connecting ? "Connecting…" : "Connect wallet"}
        </Button>

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title="Connect to GenLayer"
          description="Connect a wallet to report incidents and request resume reviews."
        >
          <div className="space-y-4">
            {!hasWallet ? (
              <>
                <Notice tone="warn" title="No wallet detected">
                  Install a wallet extension to continue — MetaMask is a good default if you
                  don&apos;t already have one.
                </Notice>
                <Button as="a" href={METAMASK_INSTALL_URL} target="_blank" rel="noreferrer" className="w-full">
                  <ExternalIcon />
                  Install MetaMask
                </Button>
                <Notice>
                  After installing a wallet, refresh this page and click &quot;Connect wallet&quot;
                  again.
                </Notice>
              </>
            ) : (
              <>
                <WalletPickerList
                  wallets={availableWallets}
                  onSelect={(picked) => connect(picked)}
                  onFallbackConnect={() => connect()}
                  disabled={connecting}
                />

                {connecting && (
                  <p className="text-center text-sm text-muted">Waiting for your wallet…</p>
                )}

                {error && (
                  <Notice tone="error" title="Connection error">
                    {error}
                  </Notice>
                )}

                <Notice>
                  <p>Choosing a wallet will prompt it to:</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1">
                    <li>Connect your wallet to this app</li>
                    <li>Add the GenLayer {NETWORK_LABEL} network to your wallet</li>
                    <li>Switch to the {NETWORK_LABEL} network</li>
                  </ol>
                  <p className="mt-2">
                    Disconnecting always forgets this choice, so you can pick a different wallet
                    next time.
                  </p>
                </Notice>
              </>
            )}
          </div>
        </Modal>
      </>
    );
  }

  // -- connected ----------------------------------------------------------
  return (
    <>
      <button
        onClick={openModal}
        title="Wallet details"
        className={`flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-chain-500 ${
          chainOk ? "border-black/10 bg-white" : "border-pending-300 bg-pending-50"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${chainOk ? "bg-active-500" : "animate-pulse bg-pending-500"}`}
          aria-label={chainOk ? "Connected" : "Wrong network"}
        />
        <span className="tabular-nums">{shortAddress(address)}</span>
        {trust !== null && (
          <>
            <span className="hidden h-4 w-px bg-black/10 sm:block" />
            <span className="hidden items-baseline gap-1 sm:flex">
              <span className="font-semibold text-chain-600">{trust}</span>
              <span className="text-xs font-normal text-muted">trust</span>
            </span>
          </>
        )}
        <ChevronDownIcon width={14} height={14} className="text-muted" />
      </button>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Wallet details"
        description={`Connected with ${walletName}`}
      >
        <div className="space-y-3">
          <InfoCard label="Your address">
            <AddressDisplay address={address} full showCopy />
          </InfoCard>

          <InfoCard label="Reporter trust">
            <p className="font-display text-3xl font-semibold text-chain-600">
              {trust !== null ? trust : "—"}
              <span className="ml-1 text-base font-medium text-muted">/ 100</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Starts at 50. Reports that lead to a halt raise it, false alarms lower it. Below 10
              you can&apos;t file reports.
            </p>
          </InfoCard>

          <InfoCard label="Incidents reported">
            <p className="font-display text-xl font-semibold text-ink">
              {incidentCount !== null ? incidentCount : "—"}
            </p>
          </InfoCard>

          <InfoCard label="Network status">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${chainOk ? "bg-active-500" : "animate-pulse bg-pending-500"}`}
              />
              <span className="text-sm text-ink">
                {chainOk ? `Connected to GenLayer ${NETWORK_LABEL}` : "Wrong network"}
              </span>
            </div>
          </InfoCard>

          {!chainOk && (
            <Notice tone="warn" title="Network warning">
              <p>
                You&apos;re not on GenLayer {NETWORK_LABEL}. Sending a transaction from the wrong
                network would use that network&apos;s own currency instead of GEN.
              </p>
              <Button onClick={switchNetwork} size="sm" className="w-full" disabled={switching}>
                {switching ? "Switching…" : "Switch network"}
              </Button>
            </Notice>
          )}

          {error && (
            <Notice tone="error" title="Error">
              {error}
            </Notice>
          )}

          <div className="space-y-2.5 border-t border-black/5 pt-4">
            <Button onClick={switchAccount} variant="secondary" className="w-full" disabled={switching}>
              <UserIcon />
              {switching ? "Switching…" : "Switch account"}
            </Button>
            <Button
              onClick={disconnect}
              variant="secondary"
              className="w-full !text-halted-500 hover:!border-halted-300 hover:!text-halted-900"
              disabled={switching}
            >
              <LogOutIcon />
              Disconnect wallet
            </Button>
          </div>

          <Notice>
            Use &quot;Switch account&quot; to select a different account in {walletName}. Use
            &quot;Disconnect&quot; to remove this site from your wallet.
          </Notice>
        </div>
      </Modal>
    </>
  );
}
