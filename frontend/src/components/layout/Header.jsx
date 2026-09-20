import { useState } from "react";
import { motion } from "framer-motion";
import ShieldLogo from "../icons/ShieldLogo.jsx";
import Button from "../ui/Button.jsx";
import { shortAddress } from "../../lib/format.js";

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About" },
  { href: "#targets", label: "Targets" },
  { href: "#app", label: "Open app" },
];

export default function Header({ wallet }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, connected, connecting, connect, disconnect, wrongNetwork, switchNetwork } = wallet;

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2.5">
          <ShieldLogo size={32} />
          <span className="font-display text-[17px] font-semibold tracking-tight">
            Sentinel<span className="text-chain-500">Guard</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {wrongNetwork ? (
            <div className="flex items-center gap-2">
              <button
                onClick={switchNetwork}
                className="flex items-center gap-2 rounded-full border border-pending-300 bg-pending-50 px-3.5 py-2 text-sm font-medium text-pending-900 transition-colors hover:bg-pending-100"
                title="Wrong network - click to switch to Studionet"
              >
                <span className="h-2 w-2 rounded-full bg-pending-500" />
                Wrong network — switch
              </button>
              <button
                onClick={disconnect}
                className="text-xs font-medium text-muted hover:text-halted-600"
              >
                Disconnect
              </button>
            </div>
          ) : connected ? (
            <div className="group relative">
              <button
                onClick={disconnect}
                className="flex items-center gap-2 rounded-full border border-active-300 bg-active-50 px-3.5 py-2 text-sm font-medium text-active-900 transition-colors hover:bg-halted-50 hover:border-halted-300 hover:text-halted-900"
                title="Click to disconnect"
              >
                <span className="h-2 w-2 rounded-full bg-active-500 group-hover:bg-halted-500" />
                <span className="tabular-nums">{shortAddress(address)}</span>
                <span className="hidden text-xs opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
                  Disconnect
                </span>
              </button>
            </div>
          ) : (
            <Button onClick={connect} disabled={connecting} size="sm">
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}

          <button
            className="ml-1 rounded-lg p-2 text-ink md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <motion.nav
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="flex flex-col gap-1 border-t border-black/5 px-5 py-3 md:hidden"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-medium text-muted hover:bg-chain-50 hover:text-chain-600"
            >
              {item.label}
            </a>
          ))}
        </motion.nav>
      )}
    </header>
  );
}
