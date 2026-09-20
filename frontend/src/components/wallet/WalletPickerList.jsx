import Button from "../ui/Button.jsx";
import { ChevronRightIcon } from "./icons.jsx";

/**
 * One button per wallet discovered via EIP-6963, so connecting is an
 * explicit choice. Falls back to a single generic "Connect wallet" button
 * when nothing has announced itself (older extensions without EIP-6963)
 * and uses `window.ethereum` directly in that case.
 */
export default function WalletPickerList({ wallets, onSelect, onFallbackConnect, disabled = false }) {
  if (wallets.length === 0) {
    return (
      <Button onClick={onFallbackConnect} disabled={disabled} className="w-full">
        Connect wallet
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {wallets.map((wallet) => (
        <button
          key={wallet.info.uuid}
          type="button"
          onClick={() => onSelect(wallet)}
          disabled={disabled}
          className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-left text-[15px] font-medium text-ink transition-colors hover:border-chain-500 hover:bg-chain-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {wallet.info.icon && (
            <img src={wallet.info.icon} alt="" className="h-7 w-7 rounded-lg" />
          )}
          <span className="flex-1">{wallet.info.name}</span>
          <ChevronRightIcon className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-chain-600" />
        </button>
      ))}
    </div>
  );
}
