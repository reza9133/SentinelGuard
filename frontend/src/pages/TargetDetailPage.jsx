import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../components/ui/GlassCard.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import RadarSpinner from "../components/icons/RadarSpinner.jsx";
import {
  weiToGen,
  isAddress,
  formatDuration,
  DECISION_LABEL,
  DECISION_TONE,
  HOOK_STATUS_LABEL,
  HOOK_STATUS_TONE,
} from "../lib/format.js";
import { CONTRACTS } from "../config/network.js";

const MIN_EVIDENCE = 1;
const MAX_EVIDENCE = 2000;
const MIN_RULEBOOK = 20;
const MAX_RULEBOOK = 1000;

export default function TargetDetailPage({ sentinel, wallet }) {
  const { address } = useParams();
  const navigate = useNavigate();
  const [addressInput, setAddressInput] = useState(address || CONTRACTS.demoVault);

  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [bondWei, setBondWei] = useState(null);
  const [verifyingHook, setVerifyingHook] = useState(false);

  const [evidence, setEvidence] = useState("");
  const [resumeEvidence, setResumeEvidence] = useState("");
  const [tx, setTx] = useState({ status: "idle" });

  const [rulebookInput, setRulebookInput] = useState("");
  const [pausableInput, setPausableInput] = useState(true);
  const [registering, setRegistering] = useState(false);

  // -- control-panel local state (update rulebook / reclaim / set pausable) -
  const [editRulebook, setEditRulebook] = useState("");
  const [updatingRulebook, setUpdatingRulebook] = useState(false);
  const [newController, setNewController] = useState(wallet.address || "");
  const [reclaiming, setReclaiming] = useState(false);
  const [pausableToggle, setPausableToggle] = useState(true);
  const [savingPausable, setSavingPausable] = useState(false);

  useEffect(() => {
    if (address) setAddressInput(address);
  }, [address]);

  // Only ticks while a finalized hook is actually pending, to drive the
  // grace-period countdown below. This is the client's own clock, not the
  // chain's — it's an estimate, so it's always phrased as "~".
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const hookPendingNow = detail?.status === "pausing" || detail?.status === "resuming";
  useEffect(() => {
    if (!hookPendingNow) return undefined;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 5000);
    return () => clearInterval(id);
  }, [hookPendingNow]);

  useEffect(() => {
    sentinel.incidentBondAmount().then(setBondWei).catch(() => {});
  }, [sentinel]);

  useEffect(() => {
    let cancelled = false;
    if (!isAddress(address)) {
      setDetail(null);
      setDetailError("Enter a valid 0x… contract address.");
      setLoadingDetail(false);
      return undefined;
    }
    setLoadingDetail(true);
    setDetailError(null);
    sentinel
      .getTarget(address)
      .then((row) => {
        if (cancelled) return;
        setDetail(row);
        if (!row) setDetailError("Not registered with SentinelGuard yet.");
        else {
          setEditRulebook(row.rulebook);
          setPausableToggle(row.pausable);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(err.message || "Not registered with SentinelGuard yet.");
      })
      .finally(() => !cancelled && setLoadingDetail(false));
    return () => {
      cancelled = true;
    };
  }, [sentinel, address, tx.refreshedAt]);

  const bondGen = bondWei !== null ? weiToGen(bondWei) : "…";
  const connected = wallet.connected;
  const halted = detail?.status === "halted";
  const active = detail?.status === "active";
  const pausing = detail?.status === "pausing";
  const resuming = detail?.status === "resuming";

  function goToAddress() {
    if (!isAddress(addressInput)) return;
    navigate(`/targets/${addressInput}`);
  }

  async function handleVerifyHook() {
    if (!connected) return;
    setVerifyingHook(true);
    try {
      await sentinel.verifyTargetHook(address);
      const verifiedState = await sentinel.verifyTargetState(address);
      setTx({
        status: "success",
        kind: "verify_hook",
        targetState: verifiedState,
        refreshedAt: Date.now(),
      });
    } catch (err) {
      setTx({ status: "error", kind: "verify_hook", message: err.message || "Verification failed." });
    } finally {
      setVerifyingHook(false);
    }
  }

  async function handleRegister() {
    if (!connected) {
      setTx({ status: "error", kind: "register", message: "Connect a wallet first." });
      return;
    }
    const text = rulebookInput.trim();
    if (text.length < MIN_RULEBOOK || text.length > MAX_RULEBOOK) {
      setTx({
        status: "error",
        kind: "register",
        message: `Rulebook must be ${MIN_RULEBOOK}–${MAX_RULEBOOK} characters (currently ${text.length}).`,
      });
      return;
    }
    setRegistering(true);
    setTx({ status: "pending", kind: "register" });
    try {
      await sentinel.registerTarget(address, text, pausableInput);
      setTx({ status: "success", kind: "register", refreshedAt: Date.now() });
      setRulebookInput("");
    } catch (err) {
      setTx({ status: "error", kind: "register", message: err.message || "Registration failed." });
    } finally {
      setRegistering(false);
    }
  }

  async function handleUpdateRulebook() {
    if (!connected) {
      setTx({ status: "error", kind: "update_rulebook", message: "Connect a wallet first." });
      return;
    }
    const text = editRulebook.trim();
    if (text.length < MIN_RULEBOOK || text.length > MAX_RULEBOOK) {
      setTx({
        status: "error",
        kind: "update_rulebook",
        message: `Rulebook must be ${MIN_RULEBOOK}–${MAX_RULEBOOK} characters (currently ${text.length}).`,
      });
      return;
    }
    setUpdatingRulebook(true);
    setTx({ status: "pending", kind: "update_rulebook" });
    try {
      await sentinel.updateRulebook(address, text);
      setTx({ status: "success", kind: "update_rulebook", refreshedAt: Date.now() });
    } catch (err) {
      setTx({ status: "error", kind: "update_rulebook", message: err.message || "Update failed." });
    } finally {
      setUpdatingRulebook(false);
    }
  }

  async function handleReclaim() {
    if (!connected) {
      setTx({ status: "error", kind: "reclaim", message: "Connect a wallet first." });
      return;
    }
    if (!isAddress(newController)) {
      setTx({ status: "error", kind: "reclaim", message: "Enter a valid 0x… controller address." });
      return;
    }
    setReclaiming(true);
    setTx({ status: "pending", kind: "reclaim" });
    try {
      await sentinel.reclaimTargetControl(address, newController);
      setTx({ status: "success", kind: "reclaim", refreshedAt: Date.now() });
    } catch (err) {
      setTx({ status: "error", kind: "reclaim", message: err.message || "Reclaim failed." });
    } finally {
      setReclaiming(false);
    }
  }

  async function handleSetPausable() {
    if (!connected) {
      setTx({ status: "error", kind: "set_pausable", message: "Connect a wallet first." });
      return;
    }
    setSavingPausable(true);
    setTx({ status: "pending", kind: "set_pausable" });
    try {
      await sentinel.setPausable(address, pausableToggle);
      setTx({ status: "success", kind: "set_pausable", refreshedAt: Date.now() });
    } catch (err) {
      setTx({ status: "error", kind: "set_pausable", message: err.message || "Update failed." });
    } finally {
      setSavingPausable(false);
    }
  }

  async function runSubmit(kind, evidenceText, method) {
    if (!connected) {
      setTx({ status: "error", kind, message: "Connect a wallet first." });
      return;
    }
    if (evidenceText.trim().length < MIN_EVIDENCE) {
      setTx({ status: "error", kind, message: "Evidence can't be empty." });
      return;
    }
    if (bondWei === null) {
      setTx({ status: "error", kind, message: "Still loading the required bond — try again in a moment." });
      return;
    }
    setTx({ status: "pending", kind });
    try {
      const res = await method(address, evidenceText.trim(), bondWei);
      setTx({
        status: "success",
        kind,
        incident: res.incident,
        targetState: res.targetState,
        refreshedAt: Date.now(),
      });
      if (kind === "report") setEvidence("");
      else setResumeEvidence("");
    } catch (err) {
      setTx({ status: "error", kind, message: err.message || "Transaction failed." });
    }
  }

  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Target detail
          </h1>
          <p className="mt-2 text-muted">
            Register a contract, manage its rulebook, and report or resume incidents. Every
            report is checked against authenticated on-chain target observations and validated
            by consensus.
          </p>
        </div>

        {!connected && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-pending-300 bg-pending-50 px-5 py-3.5 text-sm text-pending-900">
            <span>Connect a wallet to submit a report or manage this target.</span>
            <Button size="sm" onClick={wallet.openModal} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* -- target lookup + detail ------------------------------------ */}
          <div className="space-y-6">
            <GlassCard className="p-6">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">
                Target contract
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value.trim())}
                  onKeyDown={(e) => e.key === "Enter" && goToAddress()}
                  placeholder="0x…"
                  className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition-colors focus:border-chain-500"
                />
                <Button size="sm" variant="secondary" onClick={goToAddress}>
                  Go
                </Button>
              </div>
              <button
                onClick={() => navigate(`/targets/${CONTRACTS.demoVault}`)}
                className="mt-2 text-xs font-medium text-chain-600 hover:underline"
              >
                Use the demo vault
              </button>

              <div className="mt-6 min-h-[180px]">
                {loadingDetail && (
                  <div className="flex items-center gap-3 text-sm text-muted">
                    <RadarSpinner size={20} />
                    Loading target…
                  </div>
                )}
                {!loadingDetail && detailError && (
                  <div className="space-y-4">
                    <p className="rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-muted">{detailError}</p>
                    {isAddress(address) && (
                      <div className="space-y-3 rounded-xl border border-black/10 bg-black/[0.02] p-4">
                        <p className="text-sm font-medium text-ink">Register this target</p>
                        <p className="text-xs leading-relaxed text-muted">
                          A caller the target authorizes (the target itself, its owner, or anyone
                          its is_sentinel_authorized() hook approves) can register it as pausable.
                          Anyone else can only register a read-only flag, and the target can
                          reclaim control at any time via reclaim_target_control.
                        </p>
                        <textarea
                          value={rulebookInput}
                          onChange={(e) => setRulebookInput(e.target.value)}
                          maxLength={MAX_RULEBOOK}
                          rows={3}
                          placeholder={`Plain-language invariants, e.g. "no single withdrawal exceeds 10% of TVL" (min ${MIN_RULEBOOK} characters)`}
                          className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-chain-500"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-muted">
                            <input
                              type="checkbox"
                              checked={pausableInput}
                              onChange={(e) => setPausableInput(e.target.checked)}
                            />
                            Pausable (requires target authorization)
                          </label>
                          <span className="text-xs text-muted">
                            {rulebookInput.trim().length}/{MAX_RULEBOOK}
                          </span>
                        </div>
                        {connected ? (
                          <Button size="sm" disabled={registering} onClick={handleRegister}>
                            {registering ? "Registering…" : "Register target"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted">Connect a wallet to register.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!loadingDetail && detail && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Guardian status</span>
                      <Badge tone={halted ? "halted" : active ? "active" : "pending"}>
                        {halted
                          ? "Halted"
                          : active
                          ? "Active"
                          : pausing
                          ? "Pausing (Verifying Hook)"
                          : "Resuming (Verifying Hook)"}
                      </Badge>
                    </div>

                    {(pausing || resuming) && (
                      <div className="rounded-xl border border-pending-300 bg-pending-50 p-3 text-xs text-pending-900">
                        <p className="font-medium">Finalized hook in-flight.</p>
                        <p className="mt-1 opacity-80">
                          Guardian status changes only after finalized hook is verified or
                          reconciled on failure.
                        </p>
                        {detail.pending_since > 0 &&
                          (() => {
                            const elapsed = Math.max(0, nowSec - detail.pending_since);
                            const remaining = Math.max(0, detail.hook_grace_seconds - elapsed);
                            return remaining > 0 ? (
                              <p className="mt-1 opacity-80">
                                Grace period: ~{formatDuration(remaining)} left before this can be
                                reconciled as a failed hook if it still hasn't confirmed.
                              </p>
                            ) : (
                              <p className="mt-1 font-medium opacity-90">
                                Grace period elapsed — reconciling now will mark it failed if the
                                target still hasn't confirmed.
                              </p>
                            );
                          })()}
                        {connected && (
                          <div className="mt-2">
                            <Button size="xs" onClick={handleVerifyHook} disabled={verifyingHook}>
                              {verifyingHook ? "Verifying…" : "Verify / Reconcile Hook"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {!pausing && !resuming && detail.failed_hook_incident && (
                      <div className="rounded-xl border border-halted-300 bg-halted-50 p-3 text-xs text-halted-900">
                        <p className="font-medium">
                          Previous hook reconciled as failed (incident #{detail.failed_hook_incident}).
                        </p>
                        <p className="mt-1 opacity-80">
                          If the target's confirm_pause/confirm_resume callback still arrives
                          late, SentinelGuard heals this automatically the next time it's
                          received.
                        </p>
                      </div>
                    )}

                    <Stat label="Confidence bar" value={`${detail.confidence_bar}/100`} />
                    <Stat label="Resume bar" value={`${detail.resume_bar}/100`} />
                    <Stat label="Incidents so far" value={detail.incident_count} />
                    <Stat label="Pausable" value={detail.pausable ? "Yes (Hook guarded)" : "Read-only flag"} />
                    <Stat
                      label="Target authorization"
                      value={detail.target_authorized ? "Authorized" : "Target-controlled reclaim"}
                    />
                    <Stat label="Registered by" value={detail.registered_by} />
                    {halted && detail.last_incident_reason && (
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wide text-muted">
                          Last halt reason
                        </span>
                        <p className="mt-1 text-sm text-ink">{detail.last_incident_reason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* -- control panel: only meaningful once the target exists -- */}
            {!loadingDetail && detail && (
              <GlassCard className="space-y-6 p-6">
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">Manage this target</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    These calls are only accepted from an address the target authorizes (the
                    target itself, its owner, or anyone its is_sentinel_authorized() hook
                    approves) — SentinelGuard rejects them on-chain otherwise, whatever this UI
                    shows.
                  </p>
                </div>

                <div className="space-y-2 border-t border-black/5 pt-4">
                  <p className="text-sm font-medium text-ink">Update rulebook</p>
                  <textarea
                    value={editRulebook}
                    onChange={(e) => setEditRulebook(e.target.value)}
                    maxLength={MAX_RULEBOOK}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-chain-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {editRulebook.trim().length}/{MAX_RULEBOOK}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!connected || updatingRulebook}
                      onClick={handleUpdateRulebook}
                    >
                      {updatingRulebook ? "Saving…" : "Save rulebook"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-black/5 pt-4">
                  <p className="text-sm font-medium text-ink">Pausable flag</p>
                  <p className="text-xs text-muted">Only changeable while the target is active.</p>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={pausableToggle}
                        onChange={(e) => setPausableToggle(e.target.checked)}
                        disabled={!active}
                      />
                      Pausable (hook-guarded halt/resume)
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!connected || !active || savingPausable}
                      onClick={handleSetPausable}
                    >
                      {savingPausable ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-black/5 pt-4">
                  <p className="text-sm font-medium text-ink">Reclaim target control</p>
                  <p className="text-xs text-muted">
                    Moves registration & rulebook control to a new controller address — typically
                    the target itself reclaiming from a third-party registrar.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={newController}
                      onChange={(e) => setNewController(e.target.value.trim())}
                      placeholder="0x… new controller"
                      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition-colors focus:border-chain-500"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!connected || reclaiming}
                      onClick={handleReclaim}
                    >
                      {reclaiming ? "Reclaiming…" : "Reclaim"}
                    </Button>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>

          {/* -- forms ------------------------------------------------------ */}
          <div className="space-y-6">
            <FormCard
              title="Report an incident"
              disabled={!active}
              disabledReason={
                halted
                  ? "This target is already halted."
                  : pausing || resuming
                  ? "Target is pending hook verification."
                  : "Load a registered, active target first."
              }
              bondGen={bondGen}
              bondNote="Checked against authenticated target observations. Refunded if the report triggers a halt. Forfeited to treasury otherwise."
              value={evidence}
              onChange={setEvidence}
              maxLength={MAX_EVIDENCE}
              placeholder="Describe the violation and how it maps to the target's rulebook…"
              submitLabel="Submit report"
              pending={tx.status === "pending" && tx.kind === "report"}
              onSubmit={() => runSubmit("report", evidence, sentinel.reportIncident)}
            />

            <FormCard
              title="Request resume review"
              disabled={!halted}
              disabledReason="Only available once this target is halted."
              bondGen={bondGen}
              bondNote="Checked against authenticated target observations. Refunded if the target is resumed. Forfeited to treasury otherwise."
              value={resumeEvidence}
              onChange={setResumeEvidence}
              maxLength={MAX_EVIDENCE}
              placeholder="Describe how the original problem was resolved…"
              submitLabel="Submit resume review"
              pending={tx.status === "pending" && tx.kind === "resume"}
              onSubmit={() => runSubmit("resume", resumeEvidence, sentinel.requestResumeReview)}
            />

            <TxStatus tx={tx} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="truncate font-medium text-ink" title={typeof value === "string" ? value : undefined}>
        {value}
      </span>
    </div>
  );
}

function FormCard({
  title,
  disabled,
  disabledReason,
  bondGen,
  bondNote,
  value,
  onChange,
  maxLength,
  placeholder,
  submitLabel,
  pending,
  onSubmit,
}) {
  return (
    <GlassCard className={`p-6 transition-opacity ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        <span className="rounded-full bg-chain-50 px-2.5 py-1 text-xs font-medium text-chain-600">
          Bond: {bondGen} GEN
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={4}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-4 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-chain-500 disabled:bg-black/[0.02]"
      />

      <p className="mt-2 text-xs leading-relaxed text-muted">{bondNote}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        {disabled ? (
          <span className="text-xs text-muted">{disabledReason}</span>
        ) : (
          <span className="text-xs text-muted">{value.length}/{maxLength} characters</span>
        )}
        <Button size="sm" disabled={disabled || pending} onClick={onSubmit}>
          {pending ? (
            <>
              <RadarSpinner size={16} />
              Awaiting consensus…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </GlassCard>
  );
}

const SUCCESS_LABEL = {
  register: "Target registered.",
  update_rulebook: "Rulebook updated.",
  set_pausable: "Pausable flag updated.",
  reclaim: "Control reclaimed.",
  verify_hook: "Hook checked.",
  report: "Consensus reached.",
  resume: "Consensus reached.",
};

function TxStatus({ tx }) {
  return (
    <AnimatePresence mode="wait">
      {tx.status === "error" && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-2xl border border-halted-300 bg-halted-50 px-5 py-4 text-sm text-halted-900"
        >
          {tx.message}
        </motion.div>
      )}
      {tx.status === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-2xl border border-active-300 bg-active-50 px-5 py-4 text-sm text-active-900"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium">{SUCCESS_LABEL[tx.kind] ?? "Done."}</p>
            {tx.incident?.id && (
              <span className="font-mono text-xs font-semibold text-active-900/70">
                Correlated incident: #{tx.incident.id}
              </span>
            )}
          </div>

          {tx.incident && (
            <div className="mt-2 space-y-1">
              <p>
                Decision:{" "}
                <Badge tone={DECISION_TONE[tx.incident.decision] ?? "muted"}>
                  {DECISION_LABEL[tx.incident.decision] ?? tx.incident.decision}
                </Badge>
              </p>
              <p className="text-active-900/80">Confidence: {tx.incident.confidence}/100</p>
              {tx.incident.reason && <p className="text-active-900/80">"{tx.incident.reason}"</p>}
              {tx.incident.hook_status && (
                <p className="text-active-900/80">
                  Hook status:{" "}
                  <Badge tone={HOOK_STATUS_TONE[tx.incident.hook_status] ?? "muted"}>
                    {HOOK_STATUS_LABEL[tx.incident.hook_status] ?? tx.incident.hook_status}
                  </Badge>
                </p>
              )}
            </div>
          )}

          {tx.targetState && (
            <div className="mt-3 rounded-xl border border-active-300/50 bg-white/60 p-3 text-xs">
              <span className="font-semibold uppercase tracking-wide text-active-900">
                Verified target state
              </span>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-active-900/90">
                <span>
                  Target is_paused:{" "}
                  <strong>
                    {tx.targetState.targetIsPaused === true
                      ? "True"
                      : tx.targetState.targetIsPaused === false
                      ? "False"
                      : "Unspecified"}
                  </strong>
                </span>
                <span>
                  Guardian status: <strong>{tx.targetState.guardianStatus}</strong>
                </span>
                <span>
                  Consistency:{" "}
                  <strong>
                    {tx.targetState.hookPending
                      ? "Hook pending (not yet checked)"
                      : tx.targetState.isConsistent === null
                      ? "Unknown (target state unreadable)"
                      : tx.targetState.isConsistent
                      ? "Verified consistent"
                      : "Inconsistent"}
                  </strong>
                </span>
              </div>
              {tx.targetState.hookPending && (
                <p className="mt-1 text-xs font-medium text-chain-600">
                  Finalized hook has not run yet. Use "Verify / Reconcile Hook" once it has had
                  time to finalize.
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
