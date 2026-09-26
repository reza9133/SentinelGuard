import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "../components/ui/GlassCard.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { isAddress, shortAddress, weiToGen } from "../lib/format.js";
import { CONTRACTS } from "../config/network.js";

export default function TargetsPage({ sentinel }) {
  const navigate = useNavigate();
  const [targets, setTargets] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    sentinel
      .listTargets(50)
      .then((rows) => !cancelled && setTargets(rows))
      .catch((err) => !cancelled && setError(err.message));
    sentinel
      .stats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setStats(null));
    return () => {
      cancelled = true;
    };
  }, [sentinel]);

  function goToTarget(address) {
    setLookupError(null);
    if (!isAddress(address)) {
      setLookupError("Enter a valid 0x… contract address.");
      return;
    }
    navigate(`/targets/${address}`);
  }

  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Targets registry
            </h1>
            <p className="mt-2 text-muted">
              Every contract SentinelGuard is currently watching, read live from chain.
            </p>
          </div>
          <button
            onClick={() => navigate(`/targets/${CONTRACTS.demoVault}`)}
            className="text-sm font-medium text-chain-600 hover:underline"
          >
            Try it with the demo vault →
          </button>
        </div>

        {stats && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Registered targets" value={stats.targets} />
            <StatCard label="Incidents filed" value={stats.incidents} />
            <StatCard label="Incident bond" value={`${weiToGen(stats.incident_bond)} GEN`} />
            <StatCard label="Treasury balance" value={`${weiToGen(stats.treasury_balance)} GEN`} />
          </div>
        )}

        <GlassCard className="mt-8 p-5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">
            Look up or register a target
          </label>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
            <input
              value={lookup}
              onChange={(e) => {
                setLookup(e.target.value.trim());
                setLookupError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && goToTarget(lookup)}
              placeholder="0x… — an already-registered target, or a new one to register"
              className="w-full flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition-colors focus:border-chain-500"
            />
            <Button size="sm" onClick={() => goToTarget(lookup)}>
              Go
            </Button>
          </div>
          {lookupError && <p className="mt-2 text-xs text-halted-600">{lookupError}</p>}
        </GlassCard>

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
              No targets registered yet. Register one above — or open the demo vault:
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
                onSelect={() => navigate(`/targets/${t.address}`)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <GlassCard className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
    </GlassCard>
  );
}

function TargetCard({ target, index, onSelect }) {
  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index, 5) * 0.04 }}
      className="group text-left transition-transform hover:-translate-y-0.5"
    >
      <GlassCard className="h-full p-5 transition-shadow hover:shadow-lift">
        <div className="flex items-center justify-between">
          <Badge
            tone={
              target.status === "halted"
                ? "halted"
                : target.status === "active"
                ? "active"
                : "pending"
            }
          >
            {target.status === "halted"
              ? "Halted"
              : target.status === "active"
              ? "Active"
              : target.status === "pausing"
              ? "Pausing"
              : "Resuming"}
          </Badge>
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
