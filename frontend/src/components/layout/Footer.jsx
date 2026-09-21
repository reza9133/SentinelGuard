import ShieldLogo from "../icons/ShieldLogo.jsx";
import GenLayerMark from "../icons/GenLayerMark.jsx";
import { GithubIcon, TwitterIcon } from "../icons/SocialIcons.jsx";
import { LINKS, BUILDER_NAME } from "../../config/network.js";

export default function Footer() {
  return (
    <footer className="relative border-t border-black/5 bg-white">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-chain-300 to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <ShieldLogo size={28} />
              <span className="font-display text-base font-semibold">
                Sentinel<span className="text-chain-500">Guard</span>
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              An autonomous emergency-halt and self-tuning guardian contract.
              No committee. No proposal. No vote — the validator set is the
              execution.
            </p>
          </div>

          <div className="flex gap-14">
            <div>
              <h4 className="text-sm font-semibold text-ink">Project</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>
                  <a href="#how-it-works" className="hover:text-chain-600">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-chain-600">
                    About the track
                  </a>
                </li>
                <li>
                  <a href={LINKS.github} target="_blank" rel="noreferrer" className="hover:text-chain-600">
                    Source code
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink">Built on</h4>
              <ul className="mt-3 space-y-3 text-sm text-muted">
                <li>
                  <a
                    href={LINKS.genlayerDocs}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-chain-600"
                  >
                    <GenLayerMark />
                  </a>
                </li>
                <li className="text-xs text-muted/80">Autonomous Protocols track</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-black/5 pt-6 text-sm text-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SentinelGuard. Built for the GenLayer hackathon.</p>
          <div className="flex items-center gap-4">
            <span>
              Built by <span className="font-medium text-ink">{BUILDER_NAME}</span>
            </span>
            <a
              href={LINKS.twitter}
              target="_blank"
              rel="noreferrer"
              className="rounded-full p-2 text-muted transition-colors hover:bg-chain-50 hover:text-chain-600"
              aria-label="Twitter / X"
            >
              <TwitterIcon size={16} />
            </a>
            <a
              href={LINKS.github}
              target="_blank"
              rel="noreferrer"
              className="rounded-full p-2 text-muted transition-colors hover:bg-chain-50 hover:text-chain-600"
              aria-label="GitHub"
            >
              <GithubIcon size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
