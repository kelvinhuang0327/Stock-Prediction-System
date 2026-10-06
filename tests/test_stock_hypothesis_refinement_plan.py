"""
P3-10 Tests: Controlled Hypothesis Refinement Plan
Validates:
- refinement plan JSON parseable with correct decisions
- v3 candidate registry has ≤4 candidates with required fields
- anti-data-snooping guard rules enforced
- no production writes, no validation run, no auto-promotion
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
PLAN_JSON = REPO_ROOT / "outputs" / "stock_diagnostics" / "hypothesis_refinement_plan.json"
PLAN_MD = REPO_ROOT / "outputs" / "stock_diagnostics" / "hypothesis_refinement_plan.md"
V3_REGISTRY = REPO_ROOT / "research" / "stock_hypothesis_registry_v3_candidates.json"
REGISTRY_V1 = REPO_ROOT / "research" / "stock_hypothesis_registry.json"
REGISTRY_V2 = REPO_ROOT / "research" / "stock_hypothesis_registry_v2.json"

# Add repo root to path for guard import
sys.path.insert(0, str(REPO_ROOT))
from gbgf.domain.hypothesis_refinement_guard import (
    HypothesisRefinementGuard,
    RefinementViolation,
    validate_v3_registry,
    MAX_CANDIDATE_COUNT,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def plan_json():
    assert PLAN_JSON.exists(), f"Missing: {PLAN_JSON}"
    with open(PLAN_JSON) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def v3_registry():
    assert V3_REGISTRY.exists(), f"Missing: {V3_REGISTRY}"
    with open(V3_REGISTRY) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def v3_candidates(v3_registry):
    return v3_registry["hypotheses"]


@pytest.fixture(scope="module")
def guard():
    return HypothesisRefinementGuard()


# ---------------------------------------------------------------------------
# Test: refinement plan JSON
# ---------------------------------------------------------------------------
class TestRefinementPlanJson:
    def test_plan_json_exists(self):
        assert PLAN_JSON.exists()

    def test_plan_json_parseable(self, plan_json):
        assert isinstance(plan_json, dict)

    def test_plan_has_refinement_decisions(self, plan_json):
        assert "refinement_decisions" in plan_json
        assert len(plan_json["refinement_decisions"]) == 8

    def test_h001_marked_retire(self, plan_json):
        h001 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H001_20D_MOMENTUM"
        )
        assert h001["decision"] == "RETIRE"

    def test_h005_marked_refine(self, plan_json):
        h005 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H005_PULLBACK_UPTREND"
        )
        assert h005["decision"] == "REFINE"

    def test_h002_marked_observe(self, plan_json):
        h002 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H002_RSI_REVERSION"
        )
        assert h002["decision"] == "OBSERVE"

    def test_h004_marked_refine(self, plan_json):
        h004 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H004_MOM_VOL_CONFIRM"
        )
        assert h004["decision"] == "REFINE"

    def test_h006_marked_refine(self, plan_json):
        h006 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H006_LOW_VOL_BREAKOUT"
        )
        assert h006["decision"] == "REFINE"

    def test_h007_requires_universe_fix(self, plan_json):
        h007 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H007_RELATIVE_STRENGTH"
        )
        assert h007["decision"] == "REQUIRES_UNIVERSE_FIX"

    def test_h008_requires_etf_universe(self, plan_json):
        h008 = next(
            d for d in plan_json["refinement_decisions"]
            if d["hypothesis_id"] == "STOCK_H008_ETF_DEF_MOMENTUM"
        )
        assert h008["decision"] == "REQUIRES_ETF_UNIVERSE"

    def test_all_decisions_have_rationale(self, plan_json):
        for d in plan_json["refinement_decisions"]:
            assert d.get("rationale"), f"{d['hypothesis_id']} missing rationale"

    def test_all_decisions_have_snooping_risk(self, plan_json):
        for d in plan_json["refinement_decisions"]:
            assert d.get("data_snooping_risk"), f"{d['hypothesis_id']} missing data_snooping_risk"

    def test_safety_confirmations_present(self, plan_json):
        sc = plan_json.get("_meta", {}).get("safety_confirmations", {})
        assert sc.get("no_production_write") is True
        assert sc.get("no_validation_run") is True
        assert sc.get("no_auto_promotion") is True


# ---------------------------------------------------------------------------
# Test: refinement plan markdown
# ---------------------------------------------------------------------------
class TestRefinementPlanMarkdown:
    def test_plan_md_exists(self):
        assert PLAN_MD.exists()

    def test_plan_md_non_empty(self):
        content = PLAN_MD.read_text()
        assert len(content) > 200

    def test_plan_md_mentions_retire(self):
        assert "RETIRE" in PLAN_MD.read_text()

    def test_plan_md_mentions_refine(self):
        assert "REFINE" in PLAN_MD.read_text()

    def test_plan_md_mentions_no_production_write(self):
        content = PLAN_MD.read_text()
        assert "No production" in content or "no production" in content.lower()


# ---------------------------------------------------------------------------
# Test: v3 candidate registry
# ---------------------------------------------------------------------------
class TestV3CandidateRegistry:
    def test_v3_registry_exists(self):
        assert V3_REGISTRY.exists()

    def test_v3_registry_parseable(self, v3_registry):
        assert isinstance(v3_registry, dict)
        assert "hypotheses" in v3_registry

    def test_v3_candidate_count_at_most_4(self, v3_candidates):
        assert len(v3_candidates) <= MAX_CANDIDATE_COUNT, (
            f"V3 registry has {len(v3_candidates)} candidates, exceeds limit of {MAX_CANDIDATE_COUNT}"
        )

    def test_v3_candidate_count_is_exactly_4(self, v3_candidates):
        assert len(v3_candidates) == 4

    def test_all_candidates_have_hypothesis_id(self, v3_candidates):
        for c in v3_candidates:
            assert c.get("hypothesis_id"), f"Candidate missing hypothesis_id: {c}"

    def test_all_candidates_have_base_hypothesis_id(self, v3_candidates):
        for c in v3_candidates:
            assert c.get("base_hypothesis_id"), (
                f"{c.get('hypothesis_id')} missing base_hypothesis_id"
            )

    def test_h009_base_is_h005(self, v3_candidates):
        h009 = next(c for c in v3_candidates if "H009" in c["hypothesis_id"])
        assert "H005" in h009["base_hypothesis_id"]

    def test_h010_base_is_h004(self, v3_candidates):
        h010 = next(c for c in v3_candidates if "H010" in c["hypothesis_id"])
        assert "H004" in h010["base_hypothesis_id"]

    def test_h011_base_is_h006(self, v3_candidates):
        h011 = next(c for c in v3_candidates if "H011" in c["hypothesis_id"])
        assert "H006" in h011["base_hypothesis_id"]

    def test_h012_base_is_h002(self, v3_candidates):
        h012 = next(c for c in v3_candidates if "H012" in c["hypothesis_id"])
        assert "H002" in h012["base_hypothesis_id"]

    def test_h012_promotion_allowed_false(self, v3_candidates):
        h012 = next(c for c in v3_candidates if "H012" in c["hypothesis_id"])
        assert h012.get("promotion_allowed") is False, (
            "H012 must have promotion_allowed=false (symbol-specific post-hoc observation)"
        )

    def test_h012_scope_is_exploratory(self, v3_candidates):
        h012 = next(c for c in v3_candidates if "H012" in c["hypothesis_id"])
        assert h012.get("allowed_scope") == "exploratory_observation_only"

    def test_threshold_relaxation_candidates_flagged(self, v3_candidates):
        """H010 and H011 are threshold relaxations — must be flagged."""
        for c in v3_candidates:
            if c.get("change_type") == "threshold_relaxation":
                assert c.get("threshold_relaxation") is True, (
                    f"{c['hypothesis_id']} has change_type=threshold_relaxation "
                    f"but threshold_relaxation flag is not True"
                )

    def test_all_candidates_are_registered_candidate_status(self, v3_candidates):
        for c in v3_candidates:
            assert c.get("status") == "registered_candidate", (
                f"{c['hypothesis_id']} has invalid status: {c.get('status')}"
            )

    def test_all_candidates_have_change_reason(self, v3_candidates):
        for c in v3_candidates:
            assert c.get("change_reason"), f"{c['hypothesis_id']} missing change_reason"

    def test_all_candidates_require_human_review(self, v3_candidates):
        for c in v3_candidates:
            assert c.get("human_review_required") is True, (
                f"{c['hypothesis_id']} must have human_review_required=true"
            )

    def test_all_candidates_have_snooping_risk_field(self, v3_candidates):
        for c in v3_candidates:
            assert c.get("data_snooping_risk"), (
                f"{c['hypothesis_id']} missing data_snooping_risk"
            )

    def test_v3_registry_safety_confirmations(self, v3_registry):
        sc = v3_registry.get("_meta", {}).get("safety_confirmations", {})
        assert sc.get("no_production_write") is True
        assert sc.get("no_validation_run") is True
        assert sc.get("no_auto_promotion") is True


# ---------------------------------------------------------------------------
# Test: anti-data-snooping guard — valid candidates pass
# ---------------------------------------------------------------------------
class TestGuardValidCandidatesPass:
    def test_validate_v3_registry_all_pass(self, v3_registry):
        results = validate_v3_registry(v3_registry)
        failures = [r for r in results if not r.passed]
        assert not failures, (
            f"Guard failures on v3 registry: "
            + "\n".join(str(v) for r in failures for v in r.violations)
        )

    def test_guard_passes_valid_candidate(self, guard):
        candidate = {
            "hypothesis_id": "STOCK_HXXX_TEST",
            "base_hypothesis_id": "STOCK_H005_PULLBACK_UPTREND",
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        result = guard.validate_candidate(candidate)
        assert result.passed, str(result.violations)


# ---------------------------------------------------------------------------
# Test: anti-data-snooping guard — invalid candidates blocked
# ---------------------------------------------------------------------------
class TestGuardBlocksViolations:
    def test_guard_blocks_candidate_without_base(self, guard):
        candidate = {
            "hypothesis_id": "STOCK_H_NO_BASE",
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
            # no base_hypothesis_id
        }
        result = guard.validate_candidate(candidate)
        assert not result.passed
        rules = [v.rule for v in result.violations]
        assert "RULE_1_MUST_HAVE_BASE" in rules

    def test_guard_blocks_candidate_count_exceeds_4(self, guard):
        candidate_template = {
            "hypothesis_id": "STOCK_H_EXTRA",
            "base_hypothesis_id": "STOCK_H001_20D_MOMENTUM",
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        # Create 4 existing candidates to simulate limit already reached
        existing_4 = [
            {**candidate_template, "hypothesis_id": f"STOCK_H_EXTRA_{i}"}
            for i in range(4)
        ]
        new_candidate = {**candidate_template, "hypothesis_id": "STOCK_H_FIFTH"}
        result = guard.validate_candidate(new_candidate, existing_candidates=existing_4)
        assert not result.passed
        rules = [v.rule for v in result.violations]
        assert "RULE_2_MAX_CANDIDATE_COUNT" in rules

    def test_guard_blocks_candidate_list_exceeding_4(self, guard):
        candidate_template = {
            "hypothesis_id": "STOCK_H_EXTRA",
            "base_hypothesis_id": "STOCK_H001_20D_MOMENTUM",
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        five_candidates = [
            {**candidate_template, "hypothesis_id": f"STOCK_H_EXTRA_{i}"}
            for i in range(5)
        ]
        results = guard.validate_candidates(five_candidates)
        assert len(results) == 1  # returns one synthetic result
        assert not results[0].passed

    def test_guard_blocks_symbol_specific_candidate_from_promotion(self, guard):
        candidate = {
            "hypothesis_id": "STOCK_H_SYM_SPECIFIC",
            "base_hypothesis_id": "STOCK_H002_RSI_REVERSION",
            "status": "registered_candidate",
            "change_type": "symbol_specific_probe",
            "threshold_relaxation": False,
            "allowed_scope": "exploratory_observation_only",
            "promotion_allowed": True,  # WRONG — symbol-specific must be false
            "symbol_specific": True,
            "human_review_required": True,
            "data_snooping_risk": "HIGH",
        }
        result = guard.validate_candidate(candidate)
        assert not result.passed
        rules = [v.rule for v in result.violations]
        assert "RULE_4_SYMBOL_SPECIFIC_NO_PROMOTION" in rules

    def test_guard_blocks_exploratory_candidate_from_promotion(self, guard):
        candidate = {
            "hypothesis_id": "STOCK_H_EXPLORE",
            "base_hypothesis_id": "STOCK_H002_RSI_REVERSION",
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "exploratory_observation_only",
            "promotion_allowed": True,  # WRONG — exploratory must be false
            "human_review_required": True,
            "data_snooping_risk": "MEDIUM",
        }
        result = guard.validate_candidate(candidate)
        assert not result.passed
        rules = [v.rule for v in result.violations]
        assert "RULE_3_EXPLORATORY_NO_PROMOTION" in rules

    def test_guard_blocks_threshold_relaxation_without_flag(self, guard):
        candidate = {
            "hypothesis_id": "STOCK_H_RELAX_UNFLAGGED",
            "base_hypothesis_id": "STOCK_H004_MOM_VOL_CONFIRM",
            "status": "registered_candidate",
            "change_type": "threshold_relaxation",
            "threshold_relaxation": False,  # WRONG — must be True
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        result = guard.validate_candidate(candidate)
        assert not result.passed
        rules = [v.rule for v in result.violations]
        assert "RULE_5_THRESHOLD_RELAXATION_FLAG" in rules

    def test_guard_blocks_two_promotion_eligible_for_same_base(self, guard):
        base = "STOCK_H005_PULLBACK_UPTREND"
        first = {
            "hypothesis_id": "STOCK_H_FIRST",
            "base_hypothesis_id": base,
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        second = {
            "hypothesis_id": "STOCK_H_SECOND",
            "base_hypothesis_id": base,
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        # Both have promotion_allowed=False, so Rule 6 should NOT fire
        # (Rule 6 only blocks if promotion_allowed is NOT false)
        result2 = guard.validate_candidate(second, existing_candidates=[first])
        # Both promotion_allowed=False → no Rule 6 violation expected
        rule6_violations = [v for v in result2.violations if v.rule == "RULE_6_ONE_PROMOTION_PER_BASE"]
        assert not rule6_violations, "promotion_allowed=False should not trigger RULE_6"

    def test_guard_blocks_two_promotion_eligible_for_same_base_when_enabled(self, guard):
        """When both candidates have promotion_allowed not explicitly false, Rule 6 fires."""
        base = "STOCK_H005_PULLBACK_UPTREND"
        first = {
            "hypothesis_id": "STOCK_H_FIRST_PROMO",
            "base_hypothesis_id": base,
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": True,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        second = {
            "hypothesis_id": "STOCK_H_SECOND_PROMO",
            "base_hypothesis_id": base,
            "status": "registered_candidate",
            "change_type": "parameter_change",
            "threshold_relaxation": False,
            "allowed_scope": "full_validation",
            "promotion_allowed": True,
            "human_review_required": True,
            "data_snooping_risk": "LOW",
        }
        result2 = guard.validate_candidate(second, existing_candidates=[first])
        rules = [v.rule for v in result2.violations]
        assert "RULE_6_ONE_PROMOTION_PER_BASE" in rules


# ---------------------------------------------------------------------------
# Test: no production writes, no validation run, no modification
# ---------------------------------------------------------------------------
class TestNoProductionSideEffects:
    def test_v1_registry_not_modified(self):
        data = json.loads(REGISTRY_V1.read_text())
        assert len(data["hypotheses"]) == 3, "V1 registry was modified"

    def test_v2_registry_not_modified(self):
        data = json.loads(REGISTRY_V2.read_text())
        assert len(data["hypotheses"]) == 5, "V2 registry was modified"

    def test_no_h009_in_v1(self):
        data = json.loads(REGISTRY_V1.read_text())
        ids = [h["hypothesis_id"] for h in data["hypotheses"]]
        assert not any("H009" in i for i in ids)

    def test_no_h009_in_v2(self):
        data = json.loads(REGISTRY_V2.read_text())
        ids = [h["hypothesis_id"] for h in data["hypotheses"]]
        assert not any("H009" in i for i in ids)

    def test_v3_registry_is_separate_file(self):
        """V3 candidates must live in a separate candidates file."""
        assert V3_REGISTRY.name == "stock_hypothesis_registry_v3_candidates.json"
        assert V3_REGISTRY != REGISTRY_V1
        assert V3_REGISTRY != REGISTRY_V2

    def test_no_batch_validation_output_from_p310(self):
        """P3-10 must not trigger a new batch validation run."""
        batch_dir = REPO_ROOT / "outputs" / "stock_validation_real_batch"
        dates = sorted(d.name for d in batch_dir.iterdir() if d.is_dir() and d.name.isdigit())
        # Only the existing 20260501 batch should exist; no new date from P3-10
        assert "20260505" not in dates, (
            "P3-10 must not trigger a new batch validation run"
        )

    def test_plan_json_safety_confirmations(self, plan_json):
        sc = plan_json.get("_meta", {}).get("safety_confirmations", {})
        assert sc.get("no_production_write") is True
        assert sc.get("no_validation_run") is True
        assert sc.get("no_auto_promotion") is True

    def test_v3_registry_all_promotion_allowed_false(self, v3_candidates):
        """In this planning phase, promotion_allowed must be false for all candidates."""
        for c in v3_candidates:
            assert c.get("promotion_allowed") is False, (
                f"{c['hypothesis_id']} has promotion_allowed != false in planning phase"
            )
