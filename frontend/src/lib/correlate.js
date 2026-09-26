/**
 * Pure helpers for correlating a submitted transaction with the on-chain
 * incident it created, and for judging whether SentinelGuard's guardian
 * status is consistent with the target's own observed state.
 *
 * These have zero dependency on genlayer-js or the network: they only
 * operate on plain data that has already been read from the chain. That
 * makes them directly unit-testable, and it means useSentinelClient.js and
 * the test suite exercise the *same* code rather than two copies that can
 * silently drift apart.
 */

export function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Whether a GenLayer transaction receipt represents a successful execution. */
export function txSucceeded(receipt) {
  const status = receipt?.statusName ?? receipt?.status;
  const decided = status === "ACCEPTED" || status === "FINALIZED";
  return decided && receipt?.txExecutionResultName === "FINISHED_WITH_RETURN";
}

/**
 * Decides whether an incident record (already fetched by ID) is genuinely
 * the one this reporter just created against this target. Returns null
 * instead of guessing when it does not match - callers must not fall back
 * to "the most recent incident on this target" or similar heuristics, since
 * that would attribute someone else's incident (and someone else's bond
 * outcome) to the current caller.
 */
export function pickCorrelatedIncident(incident, target, reporter) {
  if (!incident || !target || !reporter) return null;
  const targetMatches = incident.target?.toLowerCase() === target.toLowerCase();
  const reporterMatches = incident.reporter?.toLowerCase() === reporter.toLowerCase();
  return targetMatches && reporterMatches ? incident : null;
}

/**
 * Judges whether SentinelGuard's guardian status agrees with the target's
 * own observed pause flag.
 *
 * - "active"/"halted" are terminal states: they MUST match the observed
 *   flag exactly, or the pair is flagged inconsistent (never silently
 *   assumed to be fine).
 * - "pausing"/"resuming" are legitimately transient - the finalized
 *   pause/resume message has not necessarily run yet (it only executes
 *   after the appeal window closes) - so they are reported as
 *   `hookPending: true` rather than asserted consistent or inconsistent.
 * - If the target's pause flag could not be read at all, consistency is
 *   unknown (null), never assumed true.
 */
export function computeConsistency(guardianStatus, targetIsPaused) {
  const hookPending = guardianStatus === "pausing" || guardianStatus === "resuming";
  if (hookPending) {
    return { isConsistent: null, hookPending: true };
  }
  if (targetIsPaused === null || targetIsPaused === undefined) {
    return { isConsistent: null, hookPending: false };
  }
  if (guardianStatus === "halted") {
    return { isConsistent: targetIsPaused === true, hookPending: false };
  }
  if (guardianStatus === "active") {
    return { isConsistent: targetIsPaused === false, hookPending: false };
  }
  return { isConsistent: null, hookPending: false };
}
