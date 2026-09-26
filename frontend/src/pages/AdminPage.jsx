import { useEffect, useState } from "react";
import GlassCard from "../components/ui/GlassCard.jsx";
import Button from "../components/ui/Button.jsx";
import { useOwner } from "../hooks/useOwner.js";
import { genToWei, isAddress, shortAddress, weiToGen } from "../lib/format.js";

const HOOK_GRACE_MIN = 300; // 5 minutes
const HOOK_GRACE_MAX = 7 * 86400; // 7 days

export default function AdminPage({ sentinel, wallet }) {
  const { owner, isOwner, loading } = useOwner(sentinel, wallet.address);
  const [stats, setStats] = useState(null);

  const [bondInput, setBondInput] = useState("");
  const [savingBond, setSavingBond] = useState(false);

  const [graceInput, setGraceInput] = useState("");
  const [savingGrace, setSavingGrace] = useState(false);

  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const [msg, setMsg] = useState({ status: "idle" });

  useEffect(() => {
    if (!isOwner) return;
    sentinel.stats().then(setStats).catch(() => setStats(null));
  }, [sentinel, isOwner, msg.refreshedAt]);

  async function handleSetBond() {
    setMsg({ status: "pending" });
    setSavingBond(true);
    try {
      await sentinel.setIncidentBond(genToWei(bondInput || "0"));
      setMsg({ status: "success", text: "Incident bond updated.", refreshedAt: Date.now() });
      setBondInput("");
    } catch (err) {
      setMsg({ status: "error", text: err.message || "Failed to update incident bond." });
    } finally {
      setSavingBond(false);
    }
  }

  async function handleSetGrace() {
    const seconds = parseInt(graceInput, 10);
    if (!Number.isFinite(seconds) || seconds < HOOK_GRACE_MIN || seconds > HOOK_GRACE_MAX) {
      setMsg({
        status: "error",
        text: `Grace period must be between ${HOOK_GRACE_MIN} and ${HOOK_GRACE_MAX} seconds.`,
      });
      return;
    }
    setMsg({ status: "pending" });
    setSavingGrace(true);
    try {
      await sentinel.setHookGrace(seconds);
      setMsg({ status: "success", text: "Hook grace period updated.", refreshedAt: Date.now() });
      setGraceInput("");
    } catch (err) {
      setMsg({ status: "error", text: err.message || "Failed to update hook grace." });
    } finally {
      setSavingGrace(false);
    }
  }

  async function handleWithdraw() {
    if (!isAddress(withdrawTo)) {
      setMsg({ status: "error", text: "Enter a valid 0x… recipient address." });
      return;
    }
    setMsg({ status: "pending" });
    setWithdrawing(true);
    try {
      await sentinel.withdrawTreasury(withdrawTo, genToWei(withdrawAmount || "0"));
      setMsg({ status: "success", text: "Treasury withdrawal sent.", refreshedAt: Date.now() });
      setWithdrawAmount("");
    } catch (err) {
      setMsg({ status: "error", text: err.message || "Withdrawal failed." });
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return (
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-5 text-sm text-muted">Checking ownership…</div>
      </section>
    );
  }

  if (!isOwner) {
    return (
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-5">
          <GlassCard className="p-8 text-center">
            <h1 className="font-display text-2xl font-semibold text-ink">Owner-only</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              set_incident_bond, set_hook_grace and withdraw_treasury are gated on-chain to
              SentinelGuard's owner address
              {owner ? (
                <>
                  {" "}
                  (<span className="font-mono">{shortAddress(owner)}</span>)
                </>
              ) : null}
              . Connect that wallet to use this page.
            </p>
          </GlassCard>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Admin
          </h1>
          <p className="mt-2 text-muted">
            Connected as the contract owner. These three writes revert for anyone else.
          </p>
        </div>

        {stats && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Current incident bond" value={`${weiToGen(stats.incident_bond)} GEN`} />
            <StatCard label="Current hook grace" value={`${stats.hook_grace_seconds}s`} />
            <StatCard label="Treasury balance" value={`${weiToGen(stats.treasury_balance)} GEN`} />
          </div>
        )}

        {msg.status === "error" && (
          <p className="mt-6 rounded-xl border border-halted-300 bg-halted-50 px-4 py-3 text-sm text-halted-900">
            {msg.text}
          </p>
        )}
        {msg.status === "success" && (
          <p className="mt-6 rounded-xl border border-active-300 bg-active-50 px-4 py-3 text-sm text-active-900">
            {msg.text}
          </p>
        )}

        <div className="mt-8 space-y-6">
          <GlassCard className="p-6">
            <h3 className="font-display text-base font-semibold text-ink">Set incident bond</h3>
            <p className="mt-1 text-xs text-muted">
              Required GEN deposit per report_incident / request_resume_review.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={bondInput}
                onChange={(e) => setBondInput(e.target.value)}
                placeholder="e.g. 2"
                className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-chain-500"
              />
              <Button size="sm" onClick={handleSetBond} disabled={savingBond || !bondInput}>
                {savingBond ? "Saving…" : "Save (GEN)"}
              </Button>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="font-display text-base font-semibold text-ink">Set hook grace period</h3>
            <p className="mt-1 text-xs text-muted">
              Seconds a finalized pause/resume hook may stay unconfirmed before it's reconciled as
              failed. Must be between {HOOK_GRACE_MIN} and {HOOK_GRACE_MAX}.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={graceInput}
                onChange={(e) => setGraceInput(e.target.value)}
                placeholder="e.g. 3600"
                className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-chain-500"
              />
              <Button size="sm" onClick={handleSetGrace} disabled={savingGrace || !graceInput}>
                {savingGrace ? "Saving…" : "Save (seconds)"}
              </Button>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="font-display text-base font-semibold text-ink">Withdraw treasury</h3>
            <p className="mt-1 text-xs text-muted">
              Sweep forfeited bonds to a recipient address. Cannot exceed the current treasury
              balance.
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value.trim())}
                placeholder="0x… recipient"
                className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition-colors focus:border-chain-500"
              />
              <div className="flex gap-2">
                <input
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount (GEN)"
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-chain-500"
                />
                <Button size="sm" onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount}>
                  {withdrawing ? "Sending…" : "Withdraw"}
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
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
