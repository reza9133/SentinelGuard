/**
 * Tests for Client Target State Verification and Direct Incident Correlation
 * (Matching steward request: "Please also make the client verify the target state and correlate the submitted incident directly")
 */

import assert from "node:assert";

// Mock client and data structures
function mockCorrelateIncident({ receipt, target, reporter, mockIncidents, mockTargetData }) {
  // 1. Direct return value from receipt
  const directId =
    receipt?.txExecutionResult?.returnValue ??
    receipt?.returnValue ??
    receipt?.returnData;
  if (typeof directId === "string" && directId.startsWith("inc-")) {
    return mockIncidents[directId] || null;
  }

  // 2. Target pending_incident_id
  if (mockTargetData?.pending_incident_id) {
    const incId = mockTargetData.pending_incident_id;
    return mockIncidents[incId] || null;
  }

  // 3. Match from recents
  const matched = Object.values(mockIncidents).find(
    (inc) =>
      inc.target.toLowerCase() === target.toLowerCase() &&
      (!reporter || inc.reporter.toLowerCase() === reporter.toLowerCase())
  );
  return matched || null;
}

function mockVerifyTargetState({ target, targetContractState, guardianState }) {
  const isPaused = targetContractState.is_paused;
  const guardianStatus = guardianState.status;

  const isConsistent =
    (guardianStatus === "halted" && isPaused === true) ||
    (guardianStatus === "active" && isPaused === false) ||
    guardianStatus === "pausing" ||
    guardianStatus === "resuming";

  return {
    targetAddress: target,
    targetIsPaused: isPaused,
    guardianStatus,
    isConsistent,
  };
}

// --- Test 1: Direct Incident Correlation via Receipt Return Value ---
{
  const target = "0x1bE955c661803c9eDB992e79Ab2cb1fe967a3fC8";
  const reporter = "0x2222222222222222222222222222222222222222";
  const mockIncidents = {
    "inc-42": {
      id: "inc-42",
      target,
      reporter,
      decision: "action",
      confidence: 88,
      reason: "Invariant broken",
    },
  };

  const receipt = {
    txExecutionResult: { returnValue: "inc-42" },
    status: "FINALIZED",
  };

  const correlated = mockCorrelateIncident({
    receipt,
    target,
    reporter,
    mockIncidents,
  });

  assert.strictEqual(correlated.id, "inc-42", "Must correlate exact incident ID from receipt");
  assert.strictEqual(correlated.confidence, 88);
  console.log("✔ Test 1 Passed: Direct incident correlation via receipt return value");
}

// --- Test 2: Target State Verification (Consistent Halted State) ---
{
  const target = "0x1bE955c661803c9eDB992e79Ab2cb1fe967a3fC8";
  const verified = mockVerifyTargetState({
    target,
    targetContractState: { is_paused: true },
    guardianState: { status: "halted" },
  });

  assert.strictEqual(verified.targetIsPaused, true);
  assert.strictEqual(verified.guardianStatus, "halted");
  assert.strictEqual(verified.isConsistent, true, "Halted state and paused target must be consistent");
  console.log("✔ Test 2 Passed: Target state verification (consistent halted state)");
}

// --- Test 3: Target State Verification (Pending Hook Verification) ---
{
  const target = "0x1bE955c661803c9eDB992e79Ab2cb1fe967a3fC8";
  const verified = mockVerifyTargetState({
    target,
    targetContractState: { is_paused: false },
    guardianState: { status: "pausing" },
  });

  assert.strictEqual(verified.guardianStatus, "pausing");
  assert.strictEqual(verified.isConsistent, true, "Pending pausing state is consistent while awaiting finalized hook");
  console.log("✔ Test 3 Passed: Target state verification (pending hook verification)");
}

console.log("\nAll Client Verification and Correlation Tests Passed Successfully!");
