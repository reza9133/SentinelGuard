import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/ui/GlassCard.jsx";
import Badge from "../components/ui/Badge.jsx";
import RadarSpinner from "../components/icons/RadarSpinner.jsx";
import {
  shortAddress,
  weiToGen,
  DECISION_LABEL,
  DECISION_TONE,
  HOOK_STATUS_LABEL,
  HOOK_STATUS_TONE,
} from "../lib/format.js";

export default function ActivityPage({ sentinel }) {
  const [incidents, setIncidents] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    sentinel
      .recentIncidents(30)
      .then((rows) => !cancelled && setIncidents(rows))
      .catch((err) => !cancelled && setError(err.message));
    sentinel
      .stats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setStats(null));
    return () => {
      cancelled = true;
    };
  }, [sentinel]);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Activity
          </h1>
          <p className="mt-2 text-muted">
            Every incident and resume review reported protocol-wide, most recent first, plus the
            treasury of bonds forfeited by rejected reports.
          </p>
        </div>

        {stats && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Registered targets" value={stats.targets} />
            <StatCard label="Incidents filed" value={stats.incidents} />
            <StatCard label="Treasury balance" value={`${weiToGen(stats.treasury_balance)} GEN`} />
          </div>
        )}

        {error && (
          <p className="mt-8 rounded-xl border border-halted-300 bg-halted-50 px-4 py-3 text-sm text-halted-900">
            Couldn't load recent incidents: {error}
          </p>
        )}

        {!error && incidents === null && (
          <div className="mt-10 flex items-center gap-3 text-sm text-muted">
            <RadarSpinner size={20} />
            Loading activity…
          </div>
        )}

        {!error && incidents && incidents.length === 0 && (
          <GlassCard className="mt-10 p-10 text-center">
            <p className="text-muted">No incidents reported yet.</p>
          </GlassCard>
        )}

        {!error && incidents && incidents.length > 0 && (
          <div className="mt-8 space-y-3">
            {incidents.map((inc) => (
              <IncidentRow key={inc.id} incident={inc} />
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

function IncidentRow({ incident }) {
  return (
    <GlassCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-muted">#{incident.id}</span>
          <Badge tone="muted">{incident.kind === "halt_report" ? "Halt report" : "Resume review"}</Badge>
          <Badge tone={DECISION_TONE[incident.decision] ?? "muted"}>
            {DECISION_LABEL[incident.decision] ?? incident.decision}
          </Badge>
          <Badge tone={HOOK_STATUS_TONE[incident.hook_status] ?? "muted"}>
            {HOOK_STATUS_LABEL[incident.hook_status] ?? incident.hook_status}
          </Badge>
        </div>
        <p className="truncate text-sm text-ink">{incident.reason || "—"}</p>
        <p className="text-xs text-muted">
          Target{" "}
          <Link to={`/targets/${incident.target}`} className="font-mono text-chain-600 hover:underline">
            {shortAddress(incident.target)}
          </Link>{" "}
          · reported by <span className="font-mono">{shortAddress(incident.reporter)}</span>
        </p>
      </div>
      <div className="shrink-0 text-right text-sm">
        <p className="font-medium text-ink">{incident.confidence}/100</p>
        <p className="text-xs text-muted">confidence</p>
      </div>
    </GlassCard>
  );
}
