import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "../ui/GlassCard.jsx";
import Badge from "../ui/Badge.jsx";
import { shortAddress } from "../../lib/format.js";
import { CONTRACTS } from "../../config/network.js";

export default function Dashboard({ sentinel, onSelectTarget, selectedTarget, refreshKey }) {
  const [targets, setTargets] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    sentinel
      .listTargets(50)
      .then((rows) => !cancelled && setTargets(rows))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [sentinel, refreshKey]);

  return (
    <section id="targets" className="border-y border-black/5 bg-white py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Targets registry
            </h2>
            <p className="mt-2 text-muted">
              Every contract SentinelGuard is currently watching, read live from chain.
            </p>
          </div>
          <a
            href="#app"
            onClick={() => onSelectTarget(CONTRACTS.demoVault)}
            className="text-sm font-medium text-chain-600 hover:underline"
          >
            Try it with the demo vault →
          </a>
        </div>

        {error && (
          <p className="mt-8 rounded-xl border border-halted-300 bg-halted-50 px-4 py-3 text-sm text-halted-900">
            Couldn't load targets: {error}
          </p>
        )}

        {!error && targets === null && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-black/[0.04]" />
            ))}
          </div>
        )}

        {!error && targets && targets.length === 0 && (
          <GlassCard className="mt-8 p-10 text-center">
            <p className="text-muted">
              No targets registered yet. Register one to see it here — or open the
              interaction zone below and point a report at the demo vault:
            </p>
            <p className="mt-2 font-mono text-sm text-chain-600">{CONTRACTS.demoVault}</p>
          </GlassCard>
        )}

        {!error && targets && targets.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((t, i) => (
              <TargetCard
                key={t.address}
                target={t}
                index={i}
                selected={selectedTarget?.toLowerCase() === t.address.toLowerCase()}
                onSelect={() => onSelectTarget(t.address)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TargetCard({ target, index, selected, onSelect }) {
  const halted = target.status === "halted";
  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index, 5) * 0.04 }}
      className={`group text-left transition-transform hover:-translate-y-0.5 ${
        selected ? "" : ""
      }`}
    >
      <GlassCard
        className={`h-full p-5 transition-shadow ${
          selected ? "ring-2 ring-chain-500" : "hover:shadow-lift"
        }`}
      >
        <div className="flex items-center justify-between">
          <Badge tone={halted ? "halted" : "active"}>{halted ? "Halted" : "Active"}</Badge>
          <span className="font-mono text-xs text-muted">{shortAddress(target.address)}</span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Confidence bar</span>
            <span className="font-medium text-ink">{target.confidence_bar}/100</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chain-500 to-compute-500"
              style={{ width: `${target.confidence_bar}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>Incidents reported</span>
          <span className="font-medium text-ink">{target.incident_count}</span>
        </div>
      </GlassCard>
    </motion.button>
  );
}
