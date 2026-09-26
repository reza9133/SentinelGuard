/**
 * Tests for client-side target-state verification and direct incident
 * correlation.
 *
 * (Matching steward request: "Please also make the client verify the
 * target state and correlate the submitted incident directly, with
 * focused tests covering hook failure and confidence values on opposite
 * sides of the threshold.")
 *
 * These tests import the REAL helpers from
 * frontend/src/lib/correlate.js - the exact module useSentinelClient.js
 * calls - rather than re-implementing the logic here. A previous version
 * of this file kept its own copies of the correlation/consistency logic,
 * which had already drifted from the real client (it always reported
 * "pausing"/"resuming" as consistent, and never exercised a mismatch).
 *
 * Threshold-boundary agreement and hook-failure/reconciliation behaviour
 * are contract-level concerns and are covered by
 * tests/test_sentinel_guard.py, which executes the real
 * contracts/sentinel_guard.py against a GenLayer-style direct-mode harness.
 */

import assert from "node:assert";
import {
  txSucceeded,
  pickCorrelatedIncident,
  computeConsistency,
} from "../frontend/src/lib/correlate.js";

const TARGET = "0x1bE955c661803c9eDB992e79Ab2cb1fe967a3fC8";
const REPORTER = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";

// --- pickCorrelatedIncident --------------------------------------------

{
  const incident = { id: "inc-42", target: TARGET, reporter: REPORTER, confidence: 88 };
  const correlated = pickCorrelatedIncident(incident, TARGET, REPORTER);
  assert.strictEqual(correlated?.id, "inc-42", "exact target+reporter match must correlate");
  console.log("PASS  exact match correlates the real incident");
}

{
  // Same reporter, but a DIFFERENT incident's target than the one we asked
  // about - e.g. the reporter's latest incident is on some other target.
  // This must NOT be silently attributed to the wrong target.
  const incident = { id: "inc-99", target: OTHER, reporter: REPORTER, confidence: 40 };
  const correlated = pickCorrelatedIncident(incident, TARGET, REPORTER);
  assert.strictEqual(correlated, null, "target mismatch must not correlate");
  console.log("PASS  target mismatch returns null (no misattribution)");
}

{
  // Same target, but reported by someone else - must not be attributed to
  // the current caller. There is deliberately no "closest match" fallback.
  const incident = { id: "inc-7", target: TARGET, reporter: OTHER, confidence: 91 };
  const correlated = pickCorrelatedIncident(incident, TARGET, REPORTER);
  assert.strictEqual(correlated, null, "reporter mismatch must not correlate");
  console.log("PASS  reporter mismatch returns null (no misattribution)");
}

{
  const correlated = pickCorrelatedIncident(null, TARGET, REPORTER);
  assert.strictEqual(correlated, null, "missing incident must not correlate");
  console.log("PASS  absent incident returns null instead of guessing");
}

// --- computeConsistency -------------------------------------------------

{
  const { isConsistent, hookPending } = computeConsistency("halted", true);
  assert.strictEqual(isConsistent, true, "halted + paused=true must be consistent");
  assert.strictEqual(hookPending, false);
  console.log("PASS  halted+paused is consistent");
}

{
  // This is the case the previous mock never tested: a halted guardian
  // whose target is NOT actually paused must be flagged inconsistent, not
  // silently accepted.
  const { isConsistent, hookPending } = computeConsistency("halted", false);
  assert.strictEqual(isConsistent, false, "halted + paused=false must be INconsistent");
  assert.strictEqual(hookPending, false);
  console.log("PASS  halted+not-paused is flagged inconsistent");
}

{
  const { isConsistent } = computeConsistency("active", false);
  assert.strictEqual(isConsistent, true, "active + paused=false must be consistent");
  console.log("PASS  active+not-paused is consistent");
}

{
  const { isConsistent } = computeConsistency("active", true);
  assert.strictEqual(isConsistent, false, "active + paused=true must be INconsistent");
  console.log("PASS  active+paused is flagged inconsistent");
}

{
  // Transient states must never be reported as a definite "consistent" -
  // the finalized pause/resume message may simply not have run yet.
  for (const status of ["pausing", "resuming"]) {
    const { isConsistent, hookPending } = computeConsistency(status, false);
    assert.strictEqual(hookPending, true, `${status} must be reported as hook-pending`);
    assert.strictEqual(isConsistent, null, `${status} must not assert consistency either way`);
  }
  console.log("PASS  pausing/resuming are reported as pending, never asserted consistent");
}

{
  const { isConsistent, hookPending } = computeConsistency("active", null);
  assert.strictEqual(isConsistent, null, "unreadable target state must be unknown, not assumed true");
  assert.strictEqual(hookPending, false);
  console.log("PASS  unreadable target pause flag yields unknown consistency, not a guess");
}

// --- txSucceeded ----------------------------------------------------------

{
  assert.strictEqual(
    txSucceeded({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" }),
    true
  );
  assert.strictEqual(
    txSucceeded({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_ERROR" }),
    false,
    "accepted-but-errored execution must not count as success"
  );
  assert.strictEqual(
    txSucceeded({ statusName: "PENDING", txExecutionResultName: "FINISHED_WITH_RETURN" }),
    false,
    "undecided status must not count as success"
  );
  console.log("PASS  txSucceeded requires both a decided status and a successful execution result");
}

console.log("\nAll client verification and correlation tests passed.");
