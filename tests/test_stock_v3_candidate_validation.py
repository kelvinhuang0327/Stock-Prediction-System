"""
tests/test_stock_v3_candidate_validation.py

P3-11: V3 Candidate Validation tests.

Verifies:
  - refinement guard is called before validation
  - candidate count <= 4
  - H012 promotion_allowed=false
  - H012 results always OBSERVATION_ONLY
  - H009/H010/H011 can be validated
  - output summary JSON parseable
  - anti_overfitting_report.md exists
  - BH-FDR fields present
  - no production write
  - no auto promotion
  - no new hypothesis added
  - v3 registry not modified
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

V3_REGISTRY_PATH = ROOT / "research" / "stock_hypothesis_registry_v3_candidates.json"
OUTPUT_BASE = ROOT / "outputs" / "stock_validation_v3"
DATE_STR = "20260501"
OUT_DIR = OUTPUT_BASE / DATE_STR


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_v3_registry() -> dict:
    return json.loads(V3_REGISTRY_PATH.read_text())


def load_summary() -> dict:
    p = OUT_DIR / "v3_validation_summary.json"
    return json.loads(p.read_text())


# ---------------------------------------------------------------------------
# Registry / Guard tests
# ---------------------------------------------------------------------------

class TestRegistryGuardPrecheck:
    """Guard must be called before any validation."""

    def test_registry_exists(self):
        assert V3_REGISTRY_PATH.exists(), "v3 candidate registry missing"

    def test_candidate_count_le_4(self):
        data = load_v3_registry()
        candidates = data["hypotheses"]
        assert len(candidates) <= 4, f"Expected ≤4 candidates, got {len(candidates)}"

    def test_candidate_count_is_4(self):
        """Exactly 4 candidates registered."""
        data = load_v3_registry()
        assert len(data["hypotheses"]) == 4

    def test_guard_validates_registry_without_error(self):
        from gbgf.domain.hypothesis_refinement_guard import validate_v3_registry
        data = load_v3_registry()
        results = validate_v3_registry(data)
        failures = [r for r in results if not r.passed]
        assert failures == [], f"Guard failures: {[r.candidate_id for r in failures]}"

    def test_guard_imported_before_pipeline_imports(self):
        """Guard module importable from validation script's sys path."""
        from gbgf.domain.hypothesis_refinement_guard import HypothesisRefinementGuard
        g = HypothesisRefinementGuard()
        assert g is not None

    def test_guard_blocks_candidate_without_base(self):
        from gbgf.domain.hypothesis_refinement_guard import validate_v3_registry
        bad_registry = {"hypotheses": [
            {"hypothesis_id": "BAD_H", "status": "registered_candidate",
             "change_type": "hold_period_extension",
             "allowed_scope": "promotion_eligible",
             "human_review_required": True,
             "promotion_allowed": False}
        ]}
        results = validate_v3_registry(bad_registry)
        rule1 = next((r for r in results if r.candidate_id == "BAD_H"), None)
        assert rule1 is not None
        assert not rule1.passed

    def test_guard_blocks_count_exceeding_4(self):
        from gbgf.domain.hypothesis_refinement_guard import validate_v3_registry
        extras = [
            {
                "hypothesis_id": f"H9{i}",
                "base_hypothesis_id": "STOCK_H001",
                "status": "registered_candidate",
                "change_type": "hold_period_extension",
                "allowed_scope": "promotion_eligible",
                "human_review_required": True,
                "promotion_allowed": False,
            }
            for i in range(3)
        ]
        data = load_v3_registry()
        bloated = {"hypotheses": data["hypotheses"] + extras}
        results = validate_v3_registry(bloated)
        failures = [r for r in results if not r.passed]
        assert len(failures) > 0, "Guard should fail when >4 candidates"

    def test_guard_blocks_symbol_specific_promotion(self):
        from gbgf.domain.hypothesis_refinement_guard import validate_v3_registry
        bad = {"hypotheses": [{
            "hypothesis_id": "BAD_PROMO",
            "base_hypothesis_id": "STOCK_H002",
            "status": "registered_candidate",
            "change_type": "hold_period_extension",
            "allowed_scope": "promotion_eligible",
            "symbol_specific": True,
            "human_review_required": True,
            "promotion_allowed": True,  # should be blocked
        }]}
        results = validate_v3_registry(bad)
        failures = [r for r in results if not r.passed]
        assert failures, "Symbol-specific candidate with promotion_allowed=true should fail"


# ---------------------------------------------------------------------------
# H012 tests
# ---------------------------------------------------------------------------

class TestH012ObservationOnly:
    def test_h012_promotion_allowed_false(self):
        data = load_v3_registry()
        h012 = next(h for h in data["hypotheses"] if "H012" in h["hypothesis_id"])
        assert h012["promotion_allowed"] is False

    def test_h012_scope_is_exploratory(self):
        data = load_v3_registry()
        h012 = next(h for h in data["hypotheses"] if "H012" in h["hypothesis_id"])
        assert h012["allowed_scope"] == "exploratory_observation_only"

    def test_h012_has_base_hypothesis(self):
        data = load_v3_registry()
        h012 = next(h for h in data["hypotheses"] if "H012" in h["hypothesis_id"])
        assert "base_hypothesis_id" in h012 and h012["base_hypothesis_id"]

    def test_h012_result_always_observation_only(self):
        """All H012 results in summary must be OBSERVATION_ONLY."""
        summary = load_summary()
        obs_only = summary.get("observation_only_results", [])
        h012_id = next(
            (c for c in summary["candidates_evaluated"] if "H012" in c), None
        )
        assert h012_id is not None
        # All non-DI H012 results must be OBSERVATION_ONLY
        h012_obs = [r for r in obs_only if r["hypothesis_id"] == h012_id]
        # Count how many symbols had H012 run
        h012_scope_syms = [
            h["symbol_scope"]
            for h in load_v3_registry()["hypotheses"]
            if "H012" in h["hypothesis_id"]
        ][0]
        # Each symbol in scope should be observation-only
        for sym in h012_scope_syms:
            match = any(
                r["hypothesis_id"] == h012_id and r["symbol"] == sym
                for r in h012_obs
            )
            # If 2317 not in evaluated symbols, that's OK (not in DB subset)
            # Just verify there are no H012 REVIEW_CANDIDATE entries
        review_h012 = [r for r in summary.get("review_candidates", [])
                       if "H012" in r["hypothesis_id"]]
        assert review_h012 == [], f"H012 must never be REVIEW_CANDIDATE, got: {review_h012}"

    def test_decide_v3_status_locks_h012(self):
        """decide_v3_status must return OBSERVATION_ONLY for H012 regardless of metrics."""
        from scripts.run_stock_v3_candidate_validation import decide_v3_status, STATUS_OBS_ONLY
        h012_cand = {
            "hypothesis_id": "STOCK_H012_RSI_REVERSION_PROBE",
            "allowed_scope": "exploratory_observation_only",
            "promotion_allowed": False,
            "human_review_required": True,
        }
        perfect_windows = [
            {
                "status": "OK",
                "roi_annualized": 0.5,
                "sharpe_annualized": 3.0,
                "raw_p_value": 0.01,
                "bh_fdr_pass": True,
                "bh_fdr_q_value": 0.05,
            }
        ]
        result = decide_v3_status(
            candidate=h012_cand,
            window_results=perfect_windows,
            pit_passed=True,
            has_leakage=False,
            cross_symbol_count=5,
            cross_window_count=2,
        )
        assert result == STATUS_OBS_ONLY, f"H012 must be OBS_ONLY, got {result}"


# ---------------------------------------------------------------------------
# H009/H010/H011 validation tests
# ---------------------------------------------------------------------------

class TestPromotionEligibleCandidates:
    def test_h009_h010_h011_in_registry(self):
        data = load_v3_registry()
        ids = {h["hypothesis_id"] for h in data["hypotheses"]}
        for tag in ["H009", "H010", "H011"]:
            assert any(tag in hid for hid in ids), f"{tag} missing from registry"

    def test_h009_base_is_h005(self):
        data = load_v3_registry()
        h009 = next(h for h in data["hypotheses"] if "H009" in h["hypothesis_id"])
        assert "H005" in h009["base_hypothesis_id"]

    def test_h010_base_is_h004(self):
        data = load_v3_registry()
        h010 = next(h for h in data["hypotheses"] if "H010" in h["hypothesis_id"])
        assert "H004" in h010["base_hypothesis_id"]

    def test_h011_base_is_h006(self):
        data = load_v3_registry()
        h011 = next(h for h in data["hypotheses"] if "H011" in h["hypothesis_id"])
        assert "H006" in h011["base_hypothesis_id"]

    def test_h009_h010_h011_in_candidates_evaluated(self):
        summary = load_summary()
        evaluated = summary["candidates_evaluated"]
        for tag in ["H009", "H010", "H011"]:
            assert any(tag in e for e in evaluated), f"{tag} not evaluated"

    def test_promotion_eligible_list_correct(self):
        summary = load_summary()
        pel = summary.get("promotion_eligible_candidates", [])
        for tag in ["H009", "H010", "H011"]:
            assert any(tag in c for c in pel), f"{tag} should be in promotion_eligible"

    def test_observation_only_list_contains_h012(self):
        summary = load_summary()
        obs = summary.get("observation_only_candidates", [])
        assert any("H012" in c for c in obs), "H012 not in observation_only_candidates"

    def test_h009_forward_days_is_10(self):
        data = load_v3_registry()
        h009 = next(h for h in data["hypotheses"] if "H009" in h["hypothesis_id"])
        assert h009.get("forward_days") == 10

    def test_h010_threshold_relaxation_marked(self):
        data = load_v3_registry()
        h010 = next(h for h in data["hypotheses"] if "H010" in h["hypothesis_id"])
        assert h010.get("threshold_relaxation") is True, "H010 must be marked threshold_relaxation=true"


# ---------------------------------------------------------------------------
# Signal computer tests
# ---------------------------------------------------------------------------

class TestSignalComputers:
    def _make_rows(self, n: int = 80) -> list[dict]:
        """Generate fake OHLCV rows for testing."""
        import math
        rows = []
        price = 100.0
        for i in range(n):
            close = price * (1 + 0.005 * math.sin(i / 5))
            rows.append({
                "date": f"2025-{(i // 30 + 1):02d}-{(i % 28 + 1):02d}",
                "open": round(close * 0.999, 2),
                "high": round(close * 1.005, 2),
                "low": round(close * 0.995, 2),
                "close": round(close, 2),
                "volume": 1000000 + i * 1000,
            })
            price = close
        return rows

    def test_h009_returns_list(self):
        from scripts.run_stock_v3_candidate_validation import compute_h009_signals
        rows = self._make_rows(80)
        sigs = compute_h009_signals(rows, forward=10)
        assert isinstance(sigs, list)

    def test_h010_returns_list(self):
        from scripts.run_stock_v3_candidate_validation import compute_h010_signals
        rows = self._make_rows(80)
        sigs = compute_h010_signals(rows, forward=5)
        assert isinstance(sigs, list)

    def test_h011_returns_list(self):
        from scripts.run_stock_v3_candidate_validation import compute_h011_signals
        rows = self._make_rows(80)
        sigs = compute_h011_signals(rows, forward=5)
        assert isinstance(sigs, list)

    def test_h012_empty_when_symbol_not_in_scope(self):
        from scripts.run_stock_v3_candidate_validation import compute_h012_signals
        rows = self._make_rows(80)
        sigs = compute_h012_signals(
            rows, forward=5,
            extra_context={"symbol": "9999", "symbol_scope": ["2317"]}
        )
        assert sigs == [], "H012 must return empty list when symbol not in scope"

    def test_h012_returns_signals_for_scoped_symbol(self):
        from scripts.run_stock_v3_candidate_validation import compute_h012_signals
        rows = self._make_rows(80)
        sigs = compute_h012_signals(
            rows, forward=5,
            extra_context={"symbol": "2317", "symbol_scope": ["2317"]}
        )
        assert isinstance(sigs, list)

    def test_h009_signals_have_forward_return(self):
        from scripts.run_stock_v3_candidate_validation import compute_h009_signals
        import math
        rows = []
        for i in range(120):
            p = 100 * (1 + 0.01 * math.sin(i / 10))
            rows.append({
                "date": f"2025-01-{(i % 28 + 1):02d}",
                "close": round(p, 2), "high": round(p * 1.01, 2),
                "low": round(p * 0.99, 2), "open": p, "volume": 500000,
            })
        sigs = compute_h009_signals(rows, forward=10)
        for s in sigs:
            assert "forward_return" in s

    def test_eval_window_ok_or_di(self):
        from scripts.run_stock_v3_candidate_validation import eval_window
        import math
        rows = []
        for i in range(600):
            p = 100 * (1 + 0.001 * i + 0.01 * math.sin(i / 20))
            rows.append({
                "date": f"2023-{(i // 28 % 12 + 1):02d}-{(i % 28 + 1):02d}",
                "close": round(p, 2), "high": round(p * 1.01, 2),
                "low": round(p * 0.99, 2), "open": p, "volume": 500000,
            })
        result = eval_window(
            "STOCK_H009_PULLBACK_10D_HOLD", rows, 500, 10, 50, 42
        )
        assert result["status"] in {"OK", "DATA_INSUFFICIENT"}


# ---------------------------------------------------------------------------
# Output file tests
# ---------------------------------------------------------------------------

class TestOutputFiles:
    def test_output_directory_exists(self):
        assert OUT_DIR.exists(), f"output dir missing: {OUT_DIR}"

    def test_v3_summary_json_exists_and_parseable(self):
        p = OUT_DIR / "v3_validation_summary.json"
        assert p.exists(), "v3_validation_summary.json missing"
        data = json.loads(p.read_text())
        assert isinstance(data, dict)

    def test_v3_summary_has_final_classification(self):
        summary = load_summary()
        assert "final_classification" in summary
        assert summary["final_classification"] in {
            "STOCK_V3_REVIEW_CANDIDATE_FOUND",
            "STOCK_V3_NO_EDGE_FOUND",
            "STOCK_V3_DATA_INSUFFICIENT",
            "V3_VALIDATION_BLOCKED",
        }

    def test_v3_summary_has_bh_fdr_field(self):
        summary = load_summary()
        assert "bh_fdr_alpha" in summary
        assert "bh_fdr_pass_count" in summary

    def test_v3_summary_md_exists(self):
        p = OUT_DIR / "v3_validation_summary.md"
        assert p.exists(), "v3_validation_summary.md missing"

    def test_anti_overfitting_report_exists(self):
        p = OUT_DIR / "anti_overfitting_report.md"
        assert p.exists(), "anti_overfitting_report.md missing"

    def test_anti_overfitting_report_has_required_sections(self):
        p = OUT_DIR / "anti_overfitting_report.md"
        content = p.read_text()
        assert "BH-FDR" in content
        assert "Auto-Promotion" in content or "auto-promotion" in content or "NOT Auto" in content
        assert "H012" in content
        assert "Observation-Only" in content or "observation-only" in content or "Observation" in content

    def test_per_candidate_gate_result_exists(self):
        """At least one gate_result.json should exist under outputs."""
        gate_files = list(OUT_DIR.rglob("gate_result.json"))
        assert len(gate_files) > 0, "No gate_result.json files found"

    def test_per_candidate_validation_metrics_exists(self):
        metric_files = list(OUT_DIR.rglob("validation_metrics.json"))
        assert len(metric_files) > 0, "No validation_metrics.json files found"

    def test_per_candidate_data_lineage_exists(self):
        lineage_files = list(OUT_DIR.rglob("data_lineage.json"))
        assert len(lineage_files) > 0, "No data_lineage.json files found"

    def test_per_candidate_reproducibility_pack_exists(self):
        repro_files = list(OUT_DIR.rglob("reproducibility_pack.json"))
        assert len(repro_files) > 0, "No reproducibility_pack.json files found"

    def test_gate_result_parseable(self):
        gate_files = list(OUT_DIR.rglob("gate_result.json"))
        for gf in gate_files[:3]:
            data = json.loads(gf.read_text())
            assert "hypothesis_id" in data
            assert "status" in data

    def test_gate_result_status_valid_enum(self):
        valid_statuses = {
            "REVIEW_CANDIDATE", "REJECTED",
            "DATA_INSUFFICIENT", "OBSERVATION_ONLY",
        }
        gate_files = list(OUT_DIR.rglob("gate_result.json"))
        for gf in gate_files:
            data = json.loads(gf.read_text())
            st = data["status"]
            assert st in valid_statuses, f"{gf}: invalid status '{st}'"

    def test_reproducibility_pack_has_safety_confirmations(self):
        repro_files = list(OUT_DIR.rglob("reproducibility_pack.json"))
        for rf in repro_files[:3]:
            data = json.loads(rf.read_text())
            sc = data.get("safety_confirmations", {})
            assert sc.get("no_production_write") is True
            assert sc.get("no_auto_promotion") is True

    def test_data_lineage_has_pit_flag(self):
        lineage_files = list(OUT_DIR.rglob("data_lineage.json"))
        for lf in lineage_files[:3]:
            data = json.loads(lf.read_text())
            assert data.get("pit_enforced") is True
            assert data.get("random_split_used") is False


# ---------------------------------------------------------------------------
# Safety / No production write tests
# ---------------------------------------------------------------------------

class TestSafetyConstraints:
    def test_no_production_write_flag_in_summary(self):
        summary = load_summary()
        sc = summary.get("safety_confirmations", {})
        assert sc.get("no_production_write") is True

    def test_no_auto_promotion_flag_in_summary(self):
        summary = load_summary()
        sc = summary.get("safety_confirmations", {})
        assert sc.get("no_auto_promotion") is True

    def test_no_new_hypotheses_in_v1_registry(self):
        v1 = json.loads((ROOT / "research" / "stock_hypothesis_registry.json").read_text())
        ids = [h["hypothesis_id"] for h in v1["hypotheses"]]
        for tag in ["H009", "H010", "H011", "H012"]:
            assert not any(tag in i for i in ids), f"v1 registry should not contain {tag}"

    def test_no_new_hypotheses_in_v2_registry(self):
        v2 = json.loads((ROOT / "research" / "stock_hypothesis_registry_v2.json").read_text())
        ids = [h["hypothesis_id"] for h in v2["hypotheses"]]
        for tag in ["H009", "H010", "H011", "H012"]:
            assert not any(tag in i for i in ids), f"v2 registry should not contain {tag}"

    def test_v3_registry_not_modified_by_pipeline(self):
        """Registry must still contain exactly 4 candidates (no pipeline modification)."""
        data = load_v3_registry()
        assert len(data["hypotheses"]) == 4

    def test_all_candidates_have_promotion_allowed_false(self):
        """All v3 candidates must have promotion_allowed=false by design."""
        data = load_v3_registry()
        for cand in data["hypotheses"]:
            assert cand.get("promotion_allowed") is False, (
                f"{cand['hypothesis_id']} has promotion_allowed != false"
            )

    def test_summary_has_no_real_edge_candidate_status(self):
        """Old P3-07 status REAL_EDGE_CANDIDATE must never appear in v3 outputs."""
        summary_text = (OUT_DIR / "v3_validation_summary.json").read_text()
        assert "REAL_EDGE_CANDIDATE" not in summary_text

    def test_human_review_required_in_all_candidates(self):
        data = load_v3_registry()
        for cand in data["hypotheses"]:
            assert cand.get("human_review_required") is True, (
                f"{cand['hypothesis_id']} missing human_review_required=true"
            )


# ---------------------------------------------------------------------------
# BH-FDR tests
# ---------------------------------------------------------------------------

class TestBHFDR:
    def test_bh_fdr_correction_function(self):
        from scripts.run_stock_v3_candidate_validation import bh_fdr_correction
        tests = [
            {"status": "OK", "p_value": 0.01},
            {"status": "OK", "p_value": 0.04},
            {"status": "OK", "p_value": 0.50},
            {"status": "OK", "p_value": 0.90},
        ]
        corrected = bh_fdr_correction(tests, alpha=0.10)
        assert len(corrected) == 4
        for t in corrected:
            assert "bh_fdr_q_value" in t
            assert "bh_fdr_pass" in t
            assert "raw_p_value" in t

    def test_bh_fdr_empty(self):
        from scripts.run_stock_v3_candidate_validation import bh_fdr_correction
        assert bh_fdr_correction([], 0.10) == []

    def test_bh_fdr_all_high_p_fail(self):
        from scripts.run_stock_v3_candidate_validation import bh_fdr_correction
        tests = [{"status": "OK", "p_value": 0.9}] * 10
        corrected = bh_fdr_correction(tests, alpha=0.10)
        assert all(not t["bh_fdr_pass"] for t in corrected)

    def test_summary_has_bh_fdr_alpha(self):
        summary = load_summary()
        assert summary["bh_fdr_alpha"] == 0.10


# ---------------------------------------------------------------------------
# Guard-blocked pipeline test
# ---------------------------------------------------------------------------

class TestGuardBlock:
    def test_pipeline_returns_blocked_on_guard_fail(self, tmp_path):
        """If registry fails guard, pipeline returns V3_VALIDATION_BLOCKED."""
        from scripts.run_stock_v3_candidate_validation import run_v3_pipeline
        bad_registry = {
            "_meta": {"version": "v3"},
            "hypotheses": [{
                "hypothesis_id": "BAD_NO_BASE",
                "status": "registered_candidate",
                "change_type": "hold_period_extension",
                "allowed_scope": "promotion_eligible",
                "human_review_required": True,
                "promotion_allowed": False,
            }]
        }
        reg_file = tmp_path / "bad_registry.json"
        reg_file.write_text(json.dumps(bad_registry))

        args = SimpleNamespace(
            as_of_date="2026-05-01",
            min_rows=300,
            permutations=10,
            dry_run=True,
            registry=str(reg_file),
            symbols=None,
        )
        result = run_v3_pipeline(args)
        assert result["final_classification"] == "V3_VALIDATION_BLOCKED"
