import { useEffect, useRef, useState } from "react";
import { shortAddress } from "../../lib/format.js";
import { CheckIcon, CopyIcon } from "./icons.jsx";

/**
 * Address with optional copy-to-clipboard. `full` shows the whole address
 * (wrapping) instead of the shortened form.
 */
export default function AddressDisplay({ address, full = false, showCopy = false, className = "" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!address) return <span className={className}>—</span>;

  async function handleCopy(event) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked - the full address is selectable in the modal anyway.
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={address}>
      <code className={`font-mono ${full ? "break-all text-sm" : ""}`}>
        {full ? address : shortAddress(address)}
      </code>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink"
          aria-label={copied ? "Address copied" : "Copy address"}
        >
          {copied ? <CheckIcon width={14} height={14} className="text-active-500" /> : <CopyIcon width={14} height={14} />}
        </button>
      )}
    </span>
  );
}
