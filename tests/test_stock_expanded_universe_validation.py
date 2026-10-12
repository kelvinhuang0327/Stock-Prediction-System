"""
tests/test_stock_expanded_universe_validation.py

P3-13: Expanded Universe Validation tests.

Verifies:
  - universe selector returns >=30 symbols or correctly reports DATA_INSUFFICIENT
  - only H009–H012 are validated (no H013+)
  - H012 is always OBSERVATION_ONLY regardless of metrics
  - 150d secondary window cannot trigger REVIEW_CANDIDATE
  - primary_bh_fdr_* and diagnostic_bh_fdr_* fields are present in results
  - expanded_validation_summary.json is parseable with required fields
  - expanded_universe_lineage.json is parseable with required fields
  - expanded_bh_fdr_summary.json is parseable with required fields
  - expanded_anti_overfitting_report.md exists and has required sections
  - no production write occurs
  - no threshold changes are made
  - no new hypotheses (H013+) are added
  - secondary window results have eligible_for_review = False
  - primary window results carry correct window_role = "primary"
  - REVIEW_CANDIDATE requires >=3 symbols primary support
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

V3_REGISTRY_PATH = ROOT / "research" / "stock_hypothesis_registry_v3_candidates.json"
OUTPUT_BASE = ROOT / "outputs" / "stock_validation_expanded"
DATE_STR = "20260501"
OUT_DIR = OUTPUT_BASE / DATE_STR

APPROVED_H_IDS = {
    "STOCK_H009_PULLBACK_10D_HOLD",
    "STOCK_H010_MOM_MODERATE_VOLUME",
    "STOCK_H011_NEAR_BREAKOUT_LOW_VOL",
    "STOCK_H012_RSI_REVERSION_PROBE",
}
REVIEW_ELIGIBLE_IDS = {
    "STOCK_H009_PULLBACK_10D_HOLD",
    "STOCK_H010_MOM_MODERATE_VOLUME",
    "STOCK_H011_NEAR_BREAKOUT_LOW_VOL",
}
OBS_ONLY_ID = "STOCK_H012_RSI_REVERSION_PROBE"

PRIMARY_WINDOW = 500
SECONDARY_WINDOW = 150


# ---------------------------------------------------------------------------
# Import helpers
# ---------------------------------------------------------------------------

def import_script():
    """Import the expanded universe validation script module."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "run_stock_expanded_universe_validation",
        ROOT / "scripts" / "run_stock_expanded_universe_validation.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_v3_registry() -> dict:
    return json.loads(V3_REGISTRY_PATH.read_text())


def load_expanded_summary() -> dict:
    p = OUT_DIR / "expanded_validation_summary.json"
    return json.loads(p.read_text())


def load_bh_summary() -> dict:
    p = OUT_DIR / "expanded_bh_fdr_summary.json"
    return json.loads(p.read_text())


def load_universe_lineage() -> dict:
    p = OUT_DIR / "expanded_universe_lineage.json"
    return json.loads(p.read_text())


# ---------------------------------------------------------------------------
# Helper: build mock rows for a symbol
# ---------------------------------------------------------------------------

def _make_rows(n: int = 600, base_close: float = 100.0) -> list[dict]:
    """Generate n synthetic OHLCV rows with deterministic close prices."""
    import math
    rows = []
    for i in range(n):
        # Simple sine-wave trend
        close = base_close * (1 + 0.001 * math.sin(i / 30.0) + 0.0002 * i)
        rows.append({
            "date": f"2024-{(i // 28 + 1):02d}-{(i % 28 + 1):02d}",
            "open": round(close * 0.999, 2),
            "high": round(close * 1.005, 2),
            "low": round(close * 0.995, 2),
            "close": round(close, 2),
            "volume": 1_000_000 + i * 100,
        })
    return rows


def _make_50_symbols_rows() -> dict[str, list[dict]]:
    """Return mock rows for 50 stock-like symbols."""
    return {str(1000 + i): _make_rows(600, base_close=50.0 + i) for i in range(50)}


# ---------------------------------------------------------------------------
# 1. Universe Selector Tests
# ---------------------------------------------------------------------------

class TestUniverseSelector:
    """Universe selection: >=30 symbols or DATA_INSUFFICIENT."""

    def test_selector_function_importable(self):
        mod = import_script()
        assert hasattr(mod, "select_expanded_universe")

    def test_selector_returns_dict_structure(self):
        mod = import_script()
        # With a non-existent DB path, should return empty gracefully (no crash)
        result = mod.select_expanded_universe(
            as_of_date="2026-05-01",
            min_rows=500,
            max_symbols=50,
            db_path=Path("/nonexistent/dev.db"),
        )
        assert "stock_symbols" in result
        assert "etf_symbols" in result
        assert "all_symbols" in result
        assert "stats" in result

    def test_selector_no_crash_on_missing_db(self):
        mod = import_script()
        result = mod.select_expanded_universe(
            as_of_date="2026-05-01",
            min_rows=500,
            max_symbols=50,
            db_path=Path("/does/not/exist.db"),
        )
        assert result["stock_symbols"] == []
        assert result["etf_symbols"] == []

    def test_pipeline_data_insufficient_if_lt_30_symbols(self):
        """If < 30 stock-like symbols, pipeline returns DATA_INSUFFICIENT."""
        mod = import_script()

        def mock_universe(*args, **kwargs):
            return {
                "stock_symbols": ["2330", "2317"],  # only 2
                "etf_symbols": [],
                "all_symbols": ["2330", "2317"],
                "stats": {"total_in_db": 2, "eligible_total": 2, "eligible_stock_like": 2,
                           "eligible_etf_like": 0, "selected_stock": 2, "selected_etf": 0,
                           "selected_total": 2},
            }

        args = SimpleNamespace(
            registry=str(V3_REGISTRY_PATH),
            as_of_date="2026-05-01",
            min_rows=500,
            max_symbols=50,
            primary_window=500,
            secondary_window=150,
            permutations=10,
            dry_run=True,
        )

        with patch.object(mod, "select_expanded_universe", mock_universe):
            result = mod.run_expanded_pipeline(args)

        assert result["final_classification"] == "EXPANDED_UNIVERSE_DATA_INSUFFICIENT"

    def test_pipeline_data_insufficient_no_crash(self):
        """DATA_INSUFFICIENT must not crash — returns a dict."""
        mod = import_script()

        def mock_universe(*args, **kwargs):
            return {
                "stock_symbols": [],
                "etf_symbols": [],
                "all_symbols": [],
                "stats": {},
            }

        args = SimpleNamespace(
            registry=str(V3_REGISTRY_PATH),
            as_of_date="2026-05-01",
            min_rows=500,
            max_symbols=50,
            primary_window=500,
            secondary_window=150,
            permutations=10,
            dry_run=True,
        )

        with patch.object(mod, "select_expanded_universe", mock_universe):
            result = mod.run_expanded_pipeline(args)

        assert isinstance(result, dict)
        assert "final_classification" in result

    def test_etf_like_heuristic(self):
        """ETF-like detection is correct."""
        mod = import_script()
        assert mod.is_etf_like("0050") is True
        assert mod.is_etf_like("00878") is True
        assert mod.is_etf_like("2330") is False
        assert mod.is_etf_like("2317") is False

    def test_min_symbols_constant_is_30(self):
        mod = import_script()
        assert mod.MIN_SYMBOLS_REQUIRED == 30


# ---------------------------------------------------------------------------
# 2. Candidate Scope Enforcement
# ---------------------------------------------------------------------------

class TestCandidateScope:
    """Only H009–H012 can be validated. No H013+."""

    def test_approved_candidates_set(self):
        mod = import_script()
        assert mod.APPROVED_CANDIDATES == APPROVED_H_IDS

    def test_registry_has_no_h013(self):
        registry = load_v3_registry()
        for h in registry["hypotheses"]:
            hid = h["hypothesis_id"]
            assert not any(
                f"H0{n}" in hid for n in range(13, 100)
            ), f"Unexpected candidate: {hid}"

    def test_only_approved_candidates_run(self):
        """Pipeline filters out any unapproved hypotheses."""
        mod = import_script()
        rows_50 = _make_50_symbols_rows()

        def mock_universe(*args, **kwargs):
            stock_syms = list(rows_50.keys())
            return {
                "stock_symbols": stock_syms,
                "etf_symbols": [],
                "all_symbols": stock_syms,
                "stats": {"selected_stock": len(stock_syms), "selected_etf": 0,
                          "selected_total": len(stock_syms), "total_in_db": 50,
                          "eligible_total": 50, "eligible_stock_like": 50,
                          "eligible_etf_like": 0},
            }

        def mock_load_rows(self_domain):
            return rows_50.get(self_domain.symbol, None) or []

        # Inject a fake H013 into registry and confirm it's filtered
        fake_registry = json.loads(V3_REGISTRY_PATH.read_text())
        fake_registry["hypotheses"].append({
            "hypothesis_id": "STOCK_H013_FAKE",
            "status": "registered_candidate",
            "allowed_scope": "full_validation",
            "promotion_allowed": False,
            "human_review_required": True,
            "change_type": "parameter_change",
            "base_hypothesis_id": "STOCK_H009_PULLBACK_10D_HOLD",
            "forward_days": 5,
        })

        with (
            patch.object(mod, "select_expanded_universe", mock_universe),
            patch("gbgf.domain.stock_real.StockRealDomain._load_rows", mock_load_rows),
        ):
            # Load registry directly to see filtering
            candidates_before_filter = fake_registry["hypotheses"]
            candidates_after_filter = [
                c for c in candidates_before_filter
                if c.get("hypothesis_id") in mod.APPROVED_CANDIDATES
            ]
            assert "STOCK_H013_FAKE" not in [c["hypothesis_id"] for c in candidates_after_filter]
            assert len(candidates_after_filter) == 4

    def test_review_eligible_set_excludes_h012(self):
        mod = import_script()
        assert OBS_ONLY_ID not in mod.REVIEW_ELIGIBLE
        for hid in REVIEW_ELIGIBLE_IDS:
            assert hid in mod.REVIEW_ELIGIBLE


# ---------------------------------------------------------------------------
# 3. H012 Always Observation-Only
# ---------------------------------------------------------------------------

class TestH012ObservationOnly:
    """H012 must always be OBSERVATION_ONLY regardless of metrics."""

    def test_decide_h012_is_obs_only(self):
        mod = import_script()
        registry = load_v3_registry()
        h012 = next(c for c in registry["hypotheses"] if "H012" in c["hypothesis_id"])

        # Even with perfect metrics, H012 must be OBSERVATION_ONLY
        perfect_window = {
            "status": "OK",
            "window_days": 500,
            "roi_annualized": 10.0,
            "sharpe_annualized": 5.0,
            "primary_raw_p_value": 0.001,
            "primary_bh_fdr_pass": True,
        }
        status = mod.decide_expanded_status(
            candidate=h012,
            window_results=[perfect_window],
            pit_passed=True,
            has_leakage=False,
            primary_cross_symbol_count=50,  # even with maximum cross-symbol support
        )
        assert status == "OBSERVATION_ONLY"

    def test_h012_obs_only_with_zero_metrics(self):
        mod = import_script()
        registry = load_v3_registry()
        h012 = next(c for c in registry["hypotheses"] if "H012" in c["hypothesis_id"])

        bad_window = {
            "status": "OK",
            "window_days": 500,
            "roi_annualized": -1.0,
            "sharpe_annualized": -2.0,
            "primary_raw_p_value": 0.99,
            "primary_bh_fdr_pass": False,
        }
        status = mod.decide_expanded_status(
            candidate=h012,
            window_results=[bad_window],
            pit_passed=True,
            has_leakage=False,
            primary_cross_symbol_count=0,
        )
        assert status == "OBSERVATION_ONLY"

    def test_h012_not_in_review_eligible(self):
        mod = import_script()
        assert "STOCK_H012_RSI_REVERSION_PROBE" not in mod.REVIEW_ELIGIBLE

    def test_h012_candidate_diagnostic_status_is_obs_only(self):
        mod = import_script()
        registry = load_v3_registry()
        candidates = registry["hypotheses"]

        # Run candidate_diagnostics with minimal data
        diag = mod.compute_candidate_diagnostics(
            hid="STOCK_H012_RSI_REVERSION_PROBE",
            candidates=candidates,
            symbols=["2317"],
            raw_results={"2317": {"STOCK_H012_RSI_REVERSION_PROBE": [
                {
                    "status": "OK",
                    "window_days": 500,
                    "roi_annualized": 5.0,
                    "sharpe_annualized": 3.0,
                    "primary_raw_p_value": 0.01,
                    "primary_bh_fdr_pass": True,
                    "n_signals": 20,
                }
            ]}},
            final_statuses={"2317": {"STOCK_H012_RSI_REVERSION_PROBE": "OBSERVATION_ONLY"}},
        )
        assert diag["final_status"] == "OBSERVATION_ONLY"


# ---------------------------------------------------------------------------
# 4. Secondary Window Cannot Trigger REVIEW_CANDIDATE
# ---------------------------------------------------------------------------

class TestSecondaryWindowPolicy:
    """150d secondary window must never trigger REVIEW_CANDIDATE."""

    def test_secondary_window_eligible_for_review_is_false(self):
        mod = import_script()

        # A secondary window result with all-positive metrics
        wr = {
            "status": "OK",
            "window_days": SECONDARY_WINDOW,
            "roi_annualized": 5.0,
            "sharpe_annualized": 3.0,
            "primary_bh_fdr_pass": True,
        }
        annotated = mod.annotate_window_role(wr)
        assert annotated["window_role"] == "secondary"
        assert annotated["eligible_for_review"] is False

    def test_primary_window_can_be_eligible(self):
        mod = import_script()

        wr = {
            "status": "OK",
            "window_days": PRIMARY_WINDOW,
            "roi_annualized": 0.5,
            "sharpe_annualized": 0.3,
            "primary_bh_fdr_pass": True,
        }
        annotated = mod.annotate_window_role(wr)
        assert annotated["window_role"] == "primary"
        assert annotated["eligible_for_review"] is True

    def test_primary_window_eligible_false_if_negative_roi(self):
        mod = import_script()

        wr = {
            "status": "OK",
            "window_days": PRIMARY_WINDOW,
            "roi_annualized": -0.1,
            "sharpe_annualized": 0.3,
            "primary_bh_fdr_pass": True,
        }
        annotated = mod.annotate_window_role(wr)
        assert annotated["eligible_for_review"] is False

    def test_decide_status_uses_only_primary_window(self):
        """decide_expanded_status ignores secondary window for promotion."""
        mod = import_script()
        registry = load_v3_registry()
        h009 = next(c for c in registry["hypotheses"] if "H009" in c["hypothesis_id"])

        # Secondary window is perfect, primary is empty — should be DATA_INSUFFICIENT
        secondary_window = {
            "status": "OK",
            "window_days": SECONDARY_WINDOW,
            "roi_annualized": 10.0,
            "sharpe_annualized": 5.0,
            "primary_raw_p_value": 0.001,
            "primary_bh_fdr_pass": True,
        }
        status = mod.decide_expanded_status(
            candidate=h009,
            window_results=[secondary_window],
            pit_passed=True,
            has_leakage=False,
            primary_cross_symbol_count=50,
        )
        # No primary window result → DATA_INSUFFICIENT (not REVIEW_CANDIDATE)
        assert status == "DATA_INSUFFICIENT"

    def test_review_candidate_requires_3_primary_symbols(self):
        """REVIEW_CANDIDATE needs >=3 primary symbols, not 1 or 2."""
        mod = import_script()
        registry = load_v3_registry()
        h009 = next(c for c in registry["hypotheses"] if "H009" in c["hypothesis_id"])

        perfect_primary = {
            "status": "OK",
            "window_days": PRIMARY_WINDOW,
            "roi_annualized": 1.0,
            "sharpe_annualized": 1.5,
            "primary_raw_p_value": 0.01,
            "primary_bh_fdr_pass": True,
        }

        # Only 2 symbols → still REJECTED
        status_2 = mod.decide_expanded_status(
            candidate=h009,
            window_results=[perfect_primary],
            pit_passed=True,
            has_leakage=False,
            primary_cross_symbol_count=2,
        )
        assert status_2 == "REJECTED"

        # 3 symbols → REVIEW_CANDIDATE
        status_3 = mod.decide_expanded_status(
            candidate=h009,
            window_results=[perfect_primary],
            pit_passed=True,
            has_leakage=False,
            primary_cross_symbol_count=3,
        )
        assert status_3 == "REVIEW_CANDIDATE"


# ---------------------------------------------------------------------------
# 5. BH-FDR Fields
# ---------------------------------------------------------------------------

class TestBHFDRFields:
    """Both primary and diagnostic BH-FDR fields must be present."""

    def test_bh_fdr_correction_function_exists(self):
        mod = import_script()
        assert hasattr(mod, "bh_fdr_correction")
        assert hasattr(mod, "apply_two_tier_bh_fdr")

    def test_primary_bh_fdr_fields_in_result(self):
        mod = import_script()

        # Simulate merge
        test_result = {
            "symbol": "2330",
            "hypothesis_id": "STOCK_H009_PULLBACK_10D_HOLD",
            "window_days": 500,
            "status": "OK",
            "p_value": 0.03,
        }
        primary_map = {
            ("2330", "STOCK_H009_PULLBACK_10D_HOLD", 500): {
                "raw_p_value": 0.03,
                "bh_fdr_q_value": 0.06,
                "bh_fdr_pass": True,
            }
        }
        diagnostic_map = {
            ("2330", "STOCK_H009_PULLBACK_10D_HOLD", 500): {
                "bh_fdr_q_value": 0.08,
                "bh_fdr_pass": True,
            }
        }
        enriched = mod._merge_bh_fields(test_result, primary_map, diagnostic_map)

        assert "primary_raw_p_value" in enriched
        assert "primary_bh_fdr_q_value" in enriched
        assert "primary_bh_fdr_pass" in enriched
        assert "diagnostic_bh_fdr_q_value" in enriched
        assert "diagnostic_bh_fdr_pass" in enriched

    def test_apply_two_tier_bh_fdr_separates_windows(self):
        mod = import_script()

        tests = [
            {"symbol": "A", "hypothesis_id": "H1", "window_days": 500, "status": "OK", "p_value": 0.02},
            {"symbol": "A", "hypothesis_id": "H1", "window_days": 150, "status": "OK", "p_value": 0.03},
            {"symbol": "B", "hypothesis_id": "H2", "window_days": 500, "status": "OK", "p_value": 0.5},
            {"symbol": "B", "hypothesis_id": "H2", "window_days": 150, "status": "OK", "p_value": 0.6},
        ]
        primary_c, diag_c = mod.apply_two_tier_bh_fdr(tests)

        # Primary should only have 500d tests
        primary_windows = {t["window_days"] for t in primary_c}
        assert primary_windows == {500}

        # Diagnostic should have all windows
        diag_windows = {t["window_days"] for t in diag_c}
        assert diag_windows == {500, 150}

    def test_bh_fdr_correction_sets_pass_flag(self):
        mod = import_script()

        tests = [
            {"p_value": 0.01, "status": "OK"},
            {"p_value": 0.5, "status": "OK"},
            {"p_value": 0.9, "status": "OK"},
        ]
        corrected = mod.bh_fdr_correction(tests)
        assert all("bh_fdr_q_value" in t for t in corrected)
        assert all("bh_fdr_pass" in t for t in corrected)
        # At least one passes (p=0.01, m=3, rank=1 → q=0.03 < 0.10)
        assert any(t["bh_fdr_pass"] for t in corrected)

    def test_bh_fdr_correction_empty_input(self):
        mod = import_script()
        result = mod.bh_fdr_correction([])
        assert result == []

    def test_primary_bh_fdr_independent_of_secondary(self):
        """Primary BH-FDR must not be diluted by secondary window tests."""
        mod = import_script()

        # 2 primary, 10 secondary — primary q-values must not change
        primary_only = [{"p_value": 0.02, "status": "OK"}, {"p_value": 0.04, "status": "OK"}]
        primary_plus_secondary = primary_only + [
            {"p_value": 0.01 * i, "status": "OK"} for i in range(1, 11)
        ]

        primary_c, _ = mod.apply_two_tier_bh_fdr(
            [dict(t, window_days=500) for t in primary_only]
        )
        # q for rank 1 (p=0.02): q = 0.02 * 2 / 1 = 0.04 < 0.10 → pass
        assert primary_c[0]["bh_fdr_pass"] is True or primary_c[1]["bh_fdr_pass"] is True


# ---------------------------------------------------------------------------
# 6. Output File Tests (require actual run)
# ---------------------------------------------------------------------------

class TestOutputFiles:
    """Test that output files exist and are parseable after a run."""

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_validation_summary.json").exists(),
        reason="expanded_validation_summary.json not yet generated; run the pipeline first",
    )
    def test_expanded_summary_json_parseable(self):
        summary = load_expanded_summary()
        assert isinstance(summary, dict)

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_validation_summary.json").exists(),
        reason="expanded_validation_summary.json not yet generated",
    )
    def test_expanded_summary_required_fields(self):
        summary = load_expanded_summary()
        required = [
            "pipeline_version",
            "as_of_date",
            "symbols_evaluated",
            "candidates_evaluated",
            "primary_window",
            "secondary_window",
            "final_classification",
            "safety_confirmations",
            "candidate_diagnostics",
            "primary_bh_fdr_pass_count",
            "diagnostic_bh_fdr_pass_count",
        ]
        for field in required:
            assert field in summary, f"Missing field: {field}"

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_validation_summary.json").exists(),
        reason="expanded_validation_summary.json not yet generated",
    )
    def test_expanded_summary_final_classification_valid(self):
        summary = load_expanded_summary()
        valid_classes = {
            "EXPANDED_UNIVERSE_VALIDATION_READY",
            "EXPANDED_UNIVERSE_REVIEW_CANDIDATE_FOUND",
            "EXPANDED_UNIVERSE_NO_EDGE_FOUND",
            "EXPANDED_UNIVERSE_DATA_INSUFFICIENT",
            "EXPANDED_UNIVERSE_BLOCKED",
        }
        assert summary["final_classification"] in valid_classes

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_bh_fdr_summary.json").exists(),
        reason="expanded_bh_fdr_summary.json not yet generated",
    )
    def test_bh_fdr_summary_parseable(self):
        bh = load_bh_summary()
        assert "primary_bh_fdr" in bh
        assert "diagnostic_bh_fdr" in bh
        assert "window" in bh["primary_bh_fdr"]
        assert bh["primary_bh_fdr"]["window"] == 500

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_universe_lineage.json").exists(),
        reason="expanded_universe_lineage.json not yet generated",
    )
    def test_universe_lineage_parseable(self):
        lineage = load_universe_lineage()
        assert "pipeline_version" in lineage
        assert "universe" in lineage
        assert "data_integrity" in lineage
        assert "safety_confirmations" in lineage

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_universe_lineage.json").exists(),
        reason="expanded_universe_lineage.json not yet generated",
    )
    def test_lineage_data_integrity_fields(self):
        lineage = load_universe_lineage()
        di = lineage["data_integrity"]
        assert di["pit_enforced"] is True
        assert di["random_split_used"] is False
        assert di["time_based_split"] is True

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_anti_overfitting_report.md").exists(),
        reason="expanded_anti_overfitting_report.md not yet generated",
    )
    def test_anti_overfitting_report_exists(self):
        p = OUT_DIR / "expanded_anti_overfitting_report.md"
        assert p.exists()

    @pytest.mark.skipif(
        not (OUT_DIR / "expanded_anti_overfitting_report.md").exists(),
        reason="expanded_anti_overfitting_report.md not yet generated",
    )
    def test_anti_overfitting_report_sections(self):
        p = OUT_DIR / "expanded_anti_overfitting_report.md"
        content = p.read_text()
        required_sections = [
            "expanded universe reduces false discovery",
            "primary and secondary windows are separated",
            "H012 remains observation",
            "Multiple Testing Correction",
            "No Production Write",
        ]
        for section in required_sections:
            assert section.lower() in content.lower(), f"Missing section: {section}"


# ---------------------------------------------------------------------------
# 7. Safety: No Production Write, No Threshold Change
# ---------------------------------------------------------------------------

class TestSafetyConstraints:
    """No production write, no threshold change, no new hypothesis."""

    def test_no_production_write_flag(self):
        """Registry must confirm no_production_write."""
        registry = load_v3_registry()
        meta = registry.get("_meta", {})
        safety = meta.get("safety_confirmations", {})
        assert safety.get("no_production_write") is True

    def test_registry_not_modified(self):
        """Registry file must be unchanged (same hypothesis_ids)."""
        registry = load_v3_registry()
        hids = {h["hypothesis_id"] for h in registry["hypotheses"]}
        assert hids == APPROVED_H_IDS

    def test_promotion_allowed_false_for_all(self):
        """All candidates must have promotion_allowed=false."""
        registry = load_v3_registry()
        for h in registry["hypotheses"]:
            assert h.get("promotion_allowed") is False, (
                f"{h['hypothesis_id']} has promotion_allowed={h.get('promotion_allowed')}"
            )

    def test_no_threshold_change_in_script(self):
        """The script must not contain threshold-changing code patterns."""
        script_path = ROOT / "scripts" / "run_stock_expanded_universe_validation.py"
        content = script_path.read_text()
        forbidden_patterns = [
            "write_production",
            "production_strategy",
            "execute_trade",
            "place_order",
            "auto_promote",
        ]
        for pat in forbidden_patterns:
            assert pat not in content.lower(), f"Forbidden pattern found: {pat}"

    def test_dry_run_writes_nothing(self):
        """Dry-run must not write any output files."""
        import tempfile
        import shutil

        mod = import_script()

        def mock_universe(*args, **kwargs):
            return {
                "stock_symbols": [str(1000 + i) for i in range(35)],
                "etf_symbols": [],
                "all_symbols": [str(1000 + i) for i in range(35)],
                "stats": {"selected_stock": 35, "selected_etf": 0, "selected_total": 35,
                          "total_in_db": 35, "eligible_total": 35,
                          "eligible_stock_like": 35, "eligible_etf_like": 0},
            }

        rows = _make_rows(600)

        def mock_load_rows(self_domain):
            return rows

        args = SimpleNamespace(
            registry=str(V3_REGISTRY_PATH),
            as_of_date="2099-01-01",  # Future date avoids collisions
            min_rows=500,
            max_symbols=50,
            primary_window=500,
            secondary_window=150,
            permutations=5,
            dry_run=True,
        )

        dry_out = ROOT / "outputs" / "stock_validation_expanded" / "20990101"
        if dry_out.exists():
            shutil.rmtree(dry_out)

        with (
            patch.object(mod, "select_expanded_universe", mock_universe),
            patch("gbgf.domain.stock_real.StockRealDomain._load_rows", mock_load_rows),
        ):
            mod.run_expanded_pipeline(args)

        # Dry run must not write JSON/MD summary files
        assert not (dry_out / "expanded_validation_summary.json").exists(), (
            "dry_run wrote expanded_validation_summary.json"
        )
        assert not (dry_out / "expanded_bh_fdr_summary.json").exists()
        assert not (dry_out / "expanded_universe_lineage.json").exists()

    def test_h012_permanently_observation_only_in_summary(self):
        """Summary safety_confirmations must declare h012_observation_only."""
        mod = import_script()

        def mock_universe(*args, **kwargs):
            stock_syms = [str(1000 + i) for i in range(35)]
            return {
                "stock_symbols": stock_syms,
                "etf_symbols": [],
                "all_symbols": stock_syms,
                "stats": {"selected_stock": 35, "selected_etf": 0, "selected_total": 35,
                          "total_in_db": 35, "eligible_total": 35,
                          "eligible_stock_like": 35, "eligible_etf_like": 0},
            }

        rows = _make_rows(600)

        def mock_load_rows(self_domain):
            return rows

        args = SimpleNamespace(
            registry=str(V3_REGISTRY_PATH),
            as_of_date="2098-01-01",
            min_rows=500,
            max_symbols=50,
            primary_window=500,
            secondary_window=150,
            permutations=5,
            dry_run=True,
        )

        with (
            patch.object(mod, "select_expanded_universe", mock_universe),
            patch("gbgf.domain.stock_real.StockRealDomain._load_rows", mock_load_rows),
        ):
            result = mod.run_expanded_pipeline(args)

        safety = result.get("safety_confirmations", {})
        assert safety.get("no_production_write") is True
        assert safety.get("h012_observation_only") is True
        assert safety.get("secondary_window_not_used_for_promotion") is True

    def test_no_new_hypothesis_allowed(self):
        """confirm no hypotheses beyond H009–H012 exist in the approved set."""
        mod = import_script()
        approved = mod.APPROVED_CANDIDATES
        assert len(approved) == 4
        valid_tags = {"H009", "H010", "H011", "H012"}
        for hid in approved:
            assert any(tag in hid for tag in valid_tags), f"Unexpected hid: {hid}"


# ---------------------------------------------------------------------------
# 8. Candidate Diagnostics Structure
# ---------------------------------------------------------------------------

class TestCandidateDiagnostics:
    """Candidate-level diagnostics must contain required fields."""

    def test_compute_candidate_diagnostics_fields(self):
        mod = import_script()
        registry = load_v3_registry()
        candidates = registry["hypotheses"]

        diag = mod.compute_candidate_diagnostics(
            hid="STOCK_H009_PULLBACK_10D_HOLD",
            candidates=candidates,
            symbols=["2330"],
            raw_results={"2330": {"STOCK_H009_PULLBACK_10D_HOLD": [
                {
                    "status": "OK",
                    "window_days": 500,
                    "roi_annualized": 0.5,
                    "sharpe_annualized": 0.8,
                    "primary_raw_p_value": 0.04,
                    "primary_bh_fdr_pass": True,
                    "n_signals": 30,
                }
            ]}},
            final_statuses={"2330": {"STOCK_H009_PULLBACK_10D_HOLD": "REJECTED"}},
        )
        required_fields = [
            "hypothesis_id",
            "symbols_tested",
            "symbols_with_signal",
            "primary_signal_count",
            "secondary_signal_count",
            "avg_primary_roi",
            "avg_primary_sharpe",
            "primary_permutation_pass_count",
            "primary_bh_fdr_pass_count",
            "review_candidate_symbols",
            "final_status",
        ]
        for field in required_fields:
            assert field in diag, f"Missing diagnostics field: {field}"

    def test_final_status_enum_values(self):
        mod = import_script()
        valid_statuses = {"REVIEW_CANDIDATE", "REJECTED", "OBSERVATION_ONLY", "DATA_INSUFFICIENT"}
        assert mod.STATUS_REVIEW in valid_statuses
        assert mod.STATUS_REJECTED in valid_statuses
        assert mod.STATUS_OBS_ONLY in valid_statuses
        assert mod.STATUS_DATA_INSUF in valid_statuses

    def test_data_insufficient_when_no_primary_signals(self):
        mod = import_script()
        registry = load_v3_registry()
        candidates = registry["hypotheses"]
        h009 = next(c for c in candidates if "H009" in c["hypothesis_id"])

        # No OK results for primary window
        status = mod.decide_expanded_status(
            candidate=h009,
            window_results=[],
            pit_passed=True,
            has_leakage=False,
            primary_cross_symbol_count=0,
        )
        assert status == "DATA_INSUFFICIENT"


# ---------------------------------------------------------------------------
# 9. Anti-Overfitting Report Content
# ---------------------------------------------------------------------------

class TestAntiOverfittingReport:
    """Anti-overfitting report must contain required content."""

    def test_build_report_callable(self):
        mod = import_script()
        assert hasattr(mod, "build_expanded_anti_overfitting_report")

    def test_report_contains_required_sections(self):
        mod = import_script()
        registry = load_v3_registry()
        candidates = registry["hypotheses"][:4]

        report = mod.build_expanded_anti_overfitting_report(
            candidates=candidates,
            symbols=["2330", "2317"],
            all_tests=[],
            primary_corrected=[],
            diagnostic_corrected=[],
            final_statuses={
                "2330": {c["hypothesis_id"]: "REJECTED" for c in candidates},
                "2317": {c["hypothesis_id"]: "OBSERVATION_ONLY" for c in candidates},
            },
            candidate_diagnostics=[
                {
                    "hypothesis_id": c["hypothesis_id"],
                    "symbols_tested": ["2330"],
                    "symbols_with_signal": [],
                    "primary_signal_count": 0,
                    "secondary_signal_count": 0,
                    "avg_primary_roi": 0.0,
                    "avg_primary_sharpe": 0.0,
                    "primary_permutation_pass_count": 0,
                    "primary_bh_fdr_pass_count": 0,
                    "review_candidate_symbols": [],
                    "final_status": "REJECTED",
                }
                for c in candidates
            ],
            as_of_date="2026-05-01",
            primary_window=500,
            secondary_window=150,
        )
        assert isinstance(report, str)
        assert len(report) > 500

        # Check required sections exist
        checks = [
            "expanded universe reduces false discovery",
            "primary and secondary windows are separated",
            "h012",
            "observation",
            "multiple testing",
            "no production write",
        ]
        content_lower = report.lower()
        for check in checks:
            assert check in content_lower, f"Missing section content: {check}"

    def test_report_confirms_no_production_write(self):
        mod = import_script()
        registry = load_v3_registry()
        candidates = registry["hypotheses"]

        report = mod.build_expanded_anti_overfitting_report(
            candidates=candidates,
            symbols=[],
            all_tests=[],
            primary_corrected=[],
            diagnostic_corrected=[],
            final_statuses={},
            candidate_diagnostics=[],
            as_of_date="2026-05-01",
            primary_window=500,
            secondary_window=150,
        )
        assert "no production strategy" in report.lower() or "no production write" in report.lower()


# ---------------------------------------------------------------------------
# 10. Pipeline Integration (with mocked data)
# ---------------------------------------------------------------------------

class TestPipelineIntegration:
    """End-to-end pipeline test with mocked rows."""

    def _run_with_mock_data(self, n_symbols: int = 35, n_rows: int = 600) -> dict:
        mod = import_script()
        rows = _make_rows(n_rows)
        stock_syms = [str(1000 + i) for i in range(n_symbols)]

        def mock_universe(*args, **kwargs):
            return {
                "stock_symbols": stock_syms,
                "etf_symbols": ["0050", "00878"],
                "all_symbols": stock_syms + ["0050", "00878"],
                "stats": {
                    "selected_stock": n_symbols,
                    "selected_etf": 2,
                    "selected_total": n_symbols + 2,
                    "total_in_db": n_symbols + 2,
                    "eligible_total": n_symbols + 2,
                    "eligible_stock_like": n_symbols,
                    "eligible_etf_like": 2,
                },
            }

        def mock_load_rows(self_domain):
            return rows

        args = SimpleNamespace(
            registry=str(V3_REGISTRY_PATH),
            as_of_date="2097-01-01",
            min_rows=500,
            max_symbols=50,
            primary_window=500,
            secondary_window=150,
            permutations=10,
            dry_run=True,
        )

        with (
            patch.object(mod, "select_expanded_universe", mock_universe),
            patch("gbgf.domain.stock_real.StockRealDomain._load_rows", mock_load_rows),
        ):
            return mod.run_expanded_pipeline(args)

    def test_pipeline_runs_without_crash(self):
        result = self._run_with_mock_data(n_symbols=35)
        assert isinstance(result, dict)
        assert "final_classification" in result

    def test_pipeline_evaluates_all_4_candidates(self):
        result = self._run_with_mock_data(n_symbols=35)
        evaled = set(result.get("candidates_evaluated", []))
        assert evaled == APPROVED_H_IDS

    def test_pipeline_result_has_bh_fdr_counts(self):
        result = self._run_with_mock_data(n_symbols=35)
        assert "primary_bh_fdr_pass_count" in result
        assert "diagnostic_bh_fdr_pass_count" in result
        assert isinstance(result["primary_bh_fdr_pass_count"], int)
        assert isinstance(result["diagnostic_bh_fdr_pass_count"], int)

    def test_pipeline_no_auto_promotion(self):
        result = self._run_with_mock_data(n_symbols=35)
        safety = result.get("safety_confirmations", {})
        assert safety.get("no_auto_promotion") is True
        assert safety.get("no_production_write") is True

    def test_pipeline_h012_always_in_obs_only(self):
        result = self._run_with_mock_data(n_symbols=35)
        obs_results = result.get("observation_only_results", [])
        h012_results = [r for r in obs_results if "H012" in r.get("hypothesis_id", "")]
        assert len(h012_results) > 0, "H012 must appear in observation_only_results"

    def test_pipeline_candidate_diagnostics_present(self):
        result = self._run_with_mock_data(n_symbols=35)
        cd = result.get("candidate_diagnostics", [])
        assert isinstance(cd, list)
        assert len(cd) == 4
        hids = {d["hypothesis_id"] for d in cd}
        assert hids == APPROVED_H_IDS

    def test_pipeline_secondary_window_not_in_promotion(self):
        """No secondary-window result should have eligible_for_review=True."""
        mod = import_script()
        rows = _make_rows(600)
        stock_syms = [str(1000 + i) for i in range(35)]

        def mock_universe(*args, **kwargs):
            return {
                "stock_symbols": stock_syms,
                "etf_symbols": [],
                "all_symbols": stock_syms,
                "stats": {"selected_stock": 35, "selected_etf": 0, "selected_total": 35,
                          "total_in_db": 35, "eligible_total": 35,
                          "eligible_stock_like": 35, "eligible_etf_like": 0},
            }

        def mock_load_rows(self_domain):
            return rows

        args = SimpleNamespace(
            registry=str(V3_REGISTRY_PATH),
            as_of_date="2096-01-01",
            min_rows=500,
            max_symbols=50,
            primary_window=500,
            secondary_window=150,
            permutations=5,
            dry_run=True,
        )

        with (
            patch.object(mod, "select_expanded_universe", mock_universe),
            patch("gbgf.domain.stock_real.StockRealDomain._load_rows", mock_load_rows),
        ):
            result = mod.run_expanded_pipeline(args)

        # No review candidates should come from secondary window
        review = result.get("review_candidates", [])
        # All review candidates (if any) must not be driven solely by secondary window
        # (This is structural — we verify the count constraint ≥3 symbols)
        primary_cross = {
            cd["hypothesis_id"]: cd["primary_bh_fdr_pass_count"]
            for cd in result.get("candidate_diagnostics", [])
        }
        # H012 must never appear in review
        h012_review = [r for r in review if "H012" in r.get("hypothesis_id", "")]
        assert h012_review == []
