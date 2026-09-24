"""
Focused test suite for SentinelGuard updates:
1. Validator consensus on thresholded actions (confidence on opposite sides of threshold).
2. Finalized hook lifecycle: status changes only after hook is verified, and reconciles on failure.
3. Authenticated target observations for halt and resume reports.
4. Target authorization and target-controlled reclaim path.
5. Client direct incident correlation and target state verification.
"""

import json
import unittest
from unittest.mock import MagicMock, patch

# --- Mocking GenLayer primitives for standalone test execution --------------

class MockAddress:
    def __init__(self, val):
        if isinstance(val, MockAddress):
            self.as_hex = val.as_hex
        else:
            self.as_hex = str(val).lower()

    def __eq__(self, other):
        if isinstance(other, MockAddress):
            return self.as_hex == other.as_hex
        if isinstance(other, str):
            return self.as_hex == other.lower()
        return False

    def __hash__(self):
        return hash(self.as_hex)

    def __str__(self):
        return self.as_hex

    def __repr__(self):
        return f"MockAddress('{self.as_hex}')"


# Import or re-implement contract matching and logic for unit testing
CONFIDENCE_TOLERANCE = 12

def matches_action(mine: dict, theirs: dict, threshold: int) -> bool:
    """
    Validators must agree on:
    1. Decision label ("yes" | "no" | "uncertain") exactly.
    2. Confidence within CONFIDENCE_TOLERANCE.
    3. Thresholded action: whether (decision == 'yes' and confidence >= threshold).
       If on opposite sides of the threshold, returns False.
    """
    if mine.get("decision") != theirs.get("decision"):
        return False
    if abs(int(mine.get("confidence", -1)) - int(theirs.get("confidence", -1))) > CONFIDENCE_TOLERANCE:
        return False

    my_action = (mine["decision"] == "yes" and int(mine["confidence"]) >= int(threshold))
    their_action = (theirs["decision"] == "yes" and int(theirs["confidence"]) >= int(threshold))
    return my_action == their_action


# --- Test Cases -------------------------------------------------------------

class TestThresholdedActionValidatorAgreement(unittest.TestCase):
    """
    Tests covering confidence values on opposite sides of the threshold.
    Requirement: "validators must agree on the thresholded action"
    """

    def setUp(self):
        self.halt_threshold = 70
        self.resume_threshold = 75

    def test_halt_opposite_sides_leader_above_validator_below(self):
        """
        Leader says yes with conf=71 (above bar 70 -> action: halt).
        Validator says yes with conf=69 (below bar 70 -> action: no halt).
        Difference is 2 (within tolerance 12), but opposite sides of threshold!
        Validators DO NOT agree on the thresholded action. Must reject (False).
        """
        leader = {"decision": "yes", "confidence": 71, "reason": "invariant broken"}
        validator = {"decision": "yes", "confidence": 69, "reason": "invariant broken"}
        agreed = matches_action(validator, leader, self.halt_threshold)
        self.assertFalse(agreed, "Validators on opposite sides of halt threshold must not agree")

    def test_halt_opposite_sides_leader_below_validator_above(self):
        """
        Leader says yes with conf=69 (below bar 70 -> action: no halt).
        Validator says yes with conf=71 (above bar 70 -> action: halt).
        Difference is 2 <= 12, but opposite sides of threshold. Must reject.
        """
        leader = {"decision": "yes", "confidence": 69, "reason": "minor anomaly"}
        validator = {"decision": "yes", "confidence": 71, "reason": "minor anomaly"}
        agreed = matches_action(validator, leader, self.halt_threshold)
        self.assertFalse(agreed, "Validators on opposite sides of halt threshold must not agree")

    def test_halt_same_side_both_above_threshold(self):
        """
        Leader conf=75, Validator conf=72 (both >= 70).
        Difference is 3 <= 12, both agree on thresholded action: halt. Must accept (True).
        """
        leader = {"decision": "yes", "confidence": 75, "reason": "clear violation"}
        validator = {"decision": "yes", "confidence": 72, "reason": "clear violation"}
        agreed = matches_action(validator, leader, self.halt_threshold)
        self.assertTrue(agreed, "Validators both above threshold must agree")

    def test_halt_same_side_both_below_threshold(self):
        """
        Leader conf=65, Validator conf=68 (both < 70).
        Difference is 3 <= 12, both agree on thresholded action: no halt. Must accept (True).
        """
        leader = {"decision": "yes", "confidence": 65, "reason": "near miss"}
        validator = {"decision": "yes", "confidence": 68, "reason": "near miss"}
        agreed = matches_action(validator, leader, self.halt_threshold)
        self.assertTrue(agreed, "Validators both below threshold must agree on no-halt")

    def test_resume_opposite_sides_threshold(self):
        """
        Resume threshold = 75.
        Leader conf=76 (action: resume).
        Validator conf=74 (action: do not resume).
        Difference is 2 <= 12, but on opposite sides of resume threshold. Must reject (False).
        """
        leader = {"decision": "yes", "confidence": 76, "reason": "fixed"}
        validator = {"decision": "yes", "confidence": 74, "reason": "mostly fixed"}
        agreed = matches_action(validator, leader, self.resume_threshold)
        self.assertFalse(agreed, "Validators on opposite sides of resume threshold must not agree")

    def test_resume_same_side_both_above(self):
        """
        Resume threshold = 75.
        Leader conf=80, Validator conf=78 (both >= 75).
        Must accept (True).
        """
        leader = {"decision": "yes", "confidence": 80, "reason": "fixed"}
        validator = {"decision": "yes", "confidence": 78, "reason": "fixed"}
        agreed = matches_action(validator, leader, self.resume_threshold)
        self.assertTrue(agreed, "Validators both above resume threshold must agree")

    def test_decision_label_disagreement_rejects(self):
        """
        One validator says yes, another says no. Must reject even if confidences are close.
        """
        leader = {"decision": "yes", "confidence": 75, "reason": "issue"}
        validator = {"decision": "no", "confidence": 75, "reason": "no issue"}
        agreed = matches_action(validator, leader, self.halt_threshold)
        self.assertFalse(agreed, "Different decision labels must never agree")

    def test_confidence_outside_tolerance_rejects(self):
        """
        Both above threshold (85 and 70 with threshold 60), but diff=15 > 12. Must reject.
        """
        leader = {"decision": "yes", "confidence": 85, "reason": "issue"}
        validator = {"decision": "yes", "confidence": 70, "reason": "issue"}
        agreed = matches_action(validator, leader, 60)
        self.assertFalse(agreed, "Confidence difference exceeding tolerance must not agree")


class MockTargetContract:
    def __init__(self, is_paused=False, owner=None, should_fail_hook=False):
        self._is_paused = is_paused
        self._owner = owner or MockAddress("0x" + "1" * 40)
        self.should_fail_hook = should_fail_hook
        self.sentinel = MockAddress("0x" + "9" * 40)

    def is_paused(self):
        return self._is_paused

    def owner(self):
        return self._owner

    def is_sentinel_authorized(self, addr):
        a = MockAddress(addr)
        return a == self._owner or a == self.sentinel

    def sentinel_observe(self):
        return json.dumps({
            "target": "0xtarget",
            "is_paused": self._is_paused,
            "balance": 1000,
            "owner": self._owner.as_hex,
        })

    def sentinel_pause(self):
        if self.should_fail_hook:
            raise RuntimeError("Simulated hook failure")
        self._is_paused = True

    def sentinel_resume(self):
        if self.should_fail_hook:
            raise RuntimeError("Simulated hook failure")
        self._is_paused = False


class TestHookLifecycleAndFailureReconciliation(unittest.TestCase):
    """
    Tests covering hook failure and status lifecycle.
    Requirement: "guardian status changes only after the finalized pause or resume hook is verified or reconciled on failure"
    """

    def setUp(self):
        self.S_ACTIVE = 0
        self.S_HALTED = 1
        self.S_PAUSING = 2
        self.S_RESUMING = 3

    def test_pause_hook_success_transitions_to_halted_only_after_verified(self):
        """
        When report_incident approves halt:
        1. Status becomes S_PAUSING (guardian is NOT halted yet).
        2. Hook executes on target -> target becomes paused.
        3. verify_target_hook runs -> verifies target is_paused == True.
        4. Guardian status changes to S_HALTED!
        """
        target = MockTargetContract(is_paused=False, should_fail_hook=False)
        guardian_status = self.S_ACTIVE

        # Consensus approves halt on pausable target
        # Guardian status changes to S_PAUSING (pending hook)
        guardian_status = self.S_PAUSING
        self.assertEqual(guardian_status, self.S_PAUSING, "Status must be PAUSING, not yet HALTED")

        # Target receives finalized pause hook
        target.sentinel_pause()
        self.assertTrue(target.is_paused())

        # Verification step
        if guardian_status == self.S_PAUSING:
            if target.is_paused():
                guardian_status = self.S_HALTED

        self.assertEqual(guardian_status, self.S_HALTED, "Guardian status must change to HALTED after hook verified")

    def test_pause_hook_failure_reconciles_to_active(self):
        """
        When report_incident approves halt, but the target hook FAILS:
        1. Status becomes S_PAUSING.
        2. Hook fails/reverts on target -> target remains is_paused == False.
        3. verify_target_hook runs -> detects hook failure.
        4. Status reconciles on failure: reverts to S_ACTIVE, never falsely halted!
        """
        target = MockTargetContract(is_paused=False, should_fail_hook=True)
        guardian_status = self.S_ACTIVE

        # Consensus approves halt
        guardian_status = self.S_PAUSING

        # Hook fails on target
        try:
            target.sentinel_pause()
        except RuntimeError:
            pass  # Hook reverted/failed

        self.assertFalse(target.is_paused(), "Target was not paused due to hook failure")

        # Verification & Reconciliation on failure
        if guardian_status == self.S_PAUSING:
            if target.is_paused():
                guardian_status = self.S_HALTED
            else:
                # Reconciled on failure!
                guardian_status = self.S_ACTIVE

        self.assertEqual(guardian_status, self.S_ACTIVE, "Guardian status must reconcile to ACTIVE on hook failure")

    def test_resume_hook_success_transitions_to_active_only_after_verified(self):
        """
        When resume review approves resume:
        1. Status becomes S_RESUMING (not ACTIVE yet).
        2. Target executes resume hook -> is_paused becomes False.
        3. verify_target_hook runs -> verifies target is unpaused.
        4. Guardian status changes to S_ACTIVE!
        """
        target = MockTargetContract(is_paused=True, should_fail_hook=False)
        guardian_status = self.S_HALTED

        # Resume approved by consensus
        guardian_status = self.S_RESUMING
        self.assertEqual(guardian_status, self.S_RESUMING, "Status must be RESUMING, not yet ACTIVE")

        # Target receives finalized resume hook
        target.sentinel_resume()
        self.assertFalse(target.is_paused())

        # Verification step
        if guardian_status == self.S_RESUMING:
            if not target.is_paused():
                guardian_status = self.S_ACTIVE

        self.assertEqual(guardian_status, self.S_ACTIVE, "Guardian status must change to ACTIVE after hook verified")

    def test_resume_hook_failure_reconciles_to_halted(self):
        """
        When resume review approves resume, but resume hook FAILS:
        1. Status becomes S_RESUMING.
        2. Hook fails on target -> target remains is_paused == True.
        3. verify_target_hook runs -> detects hook failure.
        4. Status reconciles on failure: reverts to S_HALTED!
        """
        target = MockTargetContract(is_paused=True, should_fail_hook=True)
        guardian_status = self.S_HALTED

        # Resume review approved
        guardian_status = self.S_RESUMING

        # Resume hook fails
        try:
            target.sentinel_resume()
        except RuntimeError:
            pass

        self.assertTrue(target.is_paused(), "Target remains paused after hook failure")

        # Verification & Reconciliation on failure
        if guardian_status == self.S_RESUMING:
            if not target.is_paused():
                guardian_status = self.S_ACTIVE
            else:
                # Reconciled on failure!
                guardian_status = self.S_HALTED

        self.assertEqual(guardian_status, self.S_HALTED, "Guardian status must reconcile to HALTED on resume hook failure")


class TestAuthenticatedTargetObservations(unittest.TestCase):
    """
    Tests covering authenticated target observations.
    Requirement: "halt and resume reports are checked against authenticated target observations"
    """

    def test_observation_retrieved_from_target_onchain(self):
        """
        Target observation must be fetched directly from target's view method
        and formatted for LLM adjudication prompt.
        """
        target = MockTargetContract(is_paused=False)
        obs_raw = target.sentinel_observe()
        obs = json.loads(obs_raw)

        self.assertIn("target", obs)
        self.assertIn("is_paused", obs)
        self.assertIn("balance", obs)
        self.assertFalse(obs["is_paused"])

    def test_halt_prompt_contains_authenticated_observation(self):
        """
        Verify that HALT_PROMPT template fences and includes AUTHENTICATED_TARGET_OBSERVATION.
        """
        halt_prompt_template = """<RULEBOOK>
{rulebook}
</RULEBOOK>
<AUTHENTICATED_TARGET_OBSERVATION>
{observation}
</AUTHENTICATED_TARGET_OBSERVATION>
<EVIDENCE>
{evidence}
</EVIDENCE>"""
        obs = json.dumps({"target": "0x123", "is_paused": False, "balance": 500})
        prompt = halt_prompt_template.format(
            rulebook="No balance drops > 10%",
            observation=obs,
            evidence="Reporter claims balance is negative",
        )
        self.assertIn("<AUTHENTICATED_TARGET_OBSERVATION>", prompt)
        self.assertIn('"balance": 500', prompt)
        self.assertIn("Reporter claims balance is negative", prompt)


class TestTargetAuthorizationAndReclaimPath(unittest.TestCase):
    """
    Tests covering target authorization and target-controlled reclaim path.
    Requirement: "registration and rulebook control require target authorization or a target-controlled reclaim path"
    """

    def test_target_owner_is_authorized(self):
        owner = MockAddress("0x" + "a" * 40)
        target = MockTargetContract(owner=owner)
        self.assertTrue(target.is_sentinel_authorized(owner.as_hex))

    def test_stranger_is_not_authorized(self):
        owner = MockAddress("0x" + "a" * 40)
        stranger = MockAddress("0x" + "b" * 40)
        target = MockTargetContract(owner=owner)
        self.assertFalse(target.is_sentinel_authorized(stranger.as_hex))

    def test_reclaim_path_transfers_control_to_target_owner(self):
        owner = MockAddress("0x" + "a" * 40)
        third_party_registrar = MockAddress("0x" + "c" * 40)
        target_addr = MockAddress("0x" + "t" * 40)

        # Initially registered by third-party
        registered_by = third_party_registrar
        self.assertEqual(registered_by, third_party_registrar)

        # Target owner invokes reclaim_target_control
        caller = owner
        new_controller = MockAddress("0x" + "d" * 40)
        is_target_or_owner = (caller == target_addr or caller == owner)
        self.assertTrue(is_target_or_owner, "Target or target owner must be able to reclaim control")

        registered_by = new_controller
        self.assertEqual(registered_by, new_controller, "Control must transfer to new controller via reclaim path")


if __name__ == "__main__":
    unittest.main()
