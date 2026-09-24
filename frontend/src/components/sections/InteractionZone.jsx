import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../ui/GlassCard.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import RadarSpinner from "../icons/RadarSpinner.jsx";
import { weiToGen, isAddress, DECISION_LABEL, DECISION_TONE } from "../../lib/format.js";
import { CONTRACTS } from "../../config/network.js";

const MIN_EVIDENCE = 1;
const MAX_EVIDENCE = 2000;

export default function InteractionZone({ sentinel, wallet, selectedTarget, onSelectTarget, onChainChanged }) {
  const [targetInput, setTargetInput] = useState(selectedTarget || CONTRACTS.demoVault);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [bondWei, setBondWei] = useState(null);
  const [verifyingHook, setVerifyingHook] = useState(false);

  const [evidence, setEvidence] = useState("");
  const [resumeEvidence, setResumeEvidence] = useState("");
  const [tx, setTx] = useState({ status: "idle" });

  useEffect(() => {
    if (selectedTarget) setTargetInput(selectedTarget);
  }, [selectedTarget]);

  useEffect(() => {
    sentinel.incidentBondAmount().then(setBondWei).catch(() => {});
  }, [sentinel]);

  useEffect(() => {
    let cancelled = false;
    if (!isAddress(targetInput)) {
      setDetail(null);
      setDetailError("Enter a valid 0x… contract address.");
      setLoadingDetail(false);
      return undefined;
    }
    setLoadingDetail(true);
    setDetailError(null);
    sentinel
      .getTarget(targetInput)
      .then((row) => {
        if (cancelled) return;
        setDetail(row);
        if (!row) setDetailError("Not registered with SentinelGuard yet.");
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
  }, [sentinel, targetInput, tx.refreshedAt]);

  const bondGen = bondWei !== null ? weiToGen(bondWei) : "…";
  const connected = wallet.connected;
  const halted = detail?.status === "halted";
  const active = detail?.status === "active";
  const pausing = detail?.status === "pausing";
  const resuming = detail?.status === "resuming";

  async function handleVerifyHook() {
    if (!connected) return;
    setVerifyingHook(true);
    try {
      await sentinel.verifyTargetHook(targetInput);
      const verifiedState = await sentinel.verifyTargetState(targetInput);
      setTx({
        status: "success",
        kind: "verify_hook",
        targetState: verifiedState,
        refreshedAt: Date.now(),
      });
      onChainChanged?.();
    } catch (err) {
      setTx({ status: "error", kind: "verify_hook", message: err.message || "Verification failed." });
    } finally {
      setVerifyingHook(false);
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
      const res = await method(targetInput, evidenceText.trim(), bondWei);
      setTx({
        status: "success",
        kind,
        incident: res.incident,
        targetState: res.targetState,
        refreshedAt: Date.now(),
      });
      onChainChanged?.();
      if (kind === "report") setEvidence("");
      else setResumeEvidence("");
    } catch (err) {
      setTx({ status: "error", kind, message: err.message || "Transaction failed." });
    }
  }

  return (
    <section id="app" className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Report, review, resume
          </h2>
          <p className="mt-2 text-muted">
            Pick a registered contract, then report an incident or — once it's
            halted — request a resume review. Every report is checked against
            authenticated on-chain target observations and validated by consensus.
          </p>
        </div>

        {!connected && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-pending-300 bg-pending-50 px-5 py-3.5 text-sm text-pending-900">
            <span>Connect a wallet to submit a report or resume review.</span>
            <Button size="sm" onClick={wallet.openModal} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* -- target lookup + detail ------------------------------------ */}
          <GlassCard className="p-6">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">
              Target contract
            </label>
            <input
              value={targetInput}
              onChange={(e) => {
                setTargetInput(e.target.value.trim());
                onSelectTarget?.(e.target.value.trim());
              }}
              placeholder="0x…"
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition-colors focus:border-chain-500"
            />
            <button
              onClick={() => {
                setTargetInput(CONTRACTS.demoVault);
                onSelectTarget?.(CONTRACTS.demoVault);
              }}
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
                <p className="rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-muted">{detailError}</p>
              )}
              {!loadingDetail && detail && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Guardian status</span>
                    <Badge
                      tone={
                        halted
                          ? "halted"
                          : active
                          ? "active"
                          : "pending"
                      }
                    >
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
                        Guardian status changes only after finalized hook is verified or reconciled on failure.
                      </p>
                      {connected && (
                        <div className="mt-2">
                          <Button size="xs" onClick={handleVerifyHook} disabled={verifyingHook}>
                            {verifyingHook ? "Verifying…" : "Verify / Reconcile Hook"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Stat label="Confidence bar" value={`${detail.confidence_bar}/100`} />
                  <Stat label="Resume bar" value={`${detail.resume_bar}/100`} />
                  <Stat label="Incidents so far" value={detail.incident_count} />
                  <Stat label="Pausable" value={detail.pausable ? "Yes (Hook guarded)" : "Read-only flag"} />
                  <Stat label="Target authorization" value={detail.target_authorized ? "Authorized" : "Target-controlled reclaim"} />
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
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
            <p className="font-medium">Consensus reached.</p>
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
            </div>
          )}

          {tx.targetState && (
            <div className="mt-3 rounded-xl border border-active-300/50 bg-white/60 p-3 text-xs">
              <span className="font-semibold uppercase tracking-wide text-active-900">
                Verified target state
              </span>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-active-900/90">
                <span>Target is_paused: <strong>{tx.targetState.targetIsPaused === true ? "True" : tx.targetState.targetIsPaused === false ? "False" : "Unspecified"}</strong></span>
                <span>Guardian status: <strong>{tx.targetState.guardianStatus}</strong></span>
                <span>Consistency: <strong>{tx.targetState.isConsistent ? "Verified consistent" : "Needs reconciliation"}</strong></span>
              </div>
              {tx.targetState.reconciled && (
                <p className="mt-1 text-xs font-medium text-chain-600">
                  Hook status reconciled on-chain.
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
