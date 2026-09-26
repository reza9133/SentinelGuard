import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ShieldLogo from "../icons/ShieldLogo.jsx";
import AccountPanel from "../wallet/AccountPanel.jsx";
import { useOwner } from "../../hooks/useOwner.js";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#about", label: "About" },
  { href: "/targets", label: "Targets" },
  { href: "/activity", label: "Activity" },
];

export default function Header({ wallet, sentinel }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isOwner } = useOwner(sentinel, wallet.address);

  const items = isOwner ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <ShieldLogo size={32} />
          <span className="font-display text-[17px] font-semibold tracking-tight">
            Sentinel<span className="text-chain-500">Guard</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AccountPanel wallet={wallet} sentinel={sentinel} />

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
          {items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-medium text-muted hover:bg-chain-50 hover:text-chain-600"
            >
              {item.label}
            </Link>
          ))}
        </motion.nav>
      )}
    </header>
  );
}
