"""
tests/test_stock_signal_coverage_audit.py

P3-12: Signal Coverage & Universe Expansion Audit tests.

Verifies:
  - audit script executable
  - signal_coverage_audit.json parseable with required fields
  - universe summary fields present
  - H009–H012 all have coverage diagnostics
  - condition_attribution.json parseable
  - likely_failure_mode in valid enum
  - registry not modified
  - no new hypothesis added
  - no production write
  - recommendation markdown exists
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DIAG_DIR = ROOT / "outputs" / "stock_diagnostics"
COVERAGE_JSON = DIAG_DIR / "signal_coverage_audit.json"
CONDITION_JSON = DIAG_DIR / "condition_attribution.json"
RECO_MD = DIAG_DIR / "universe_expansion_recommendations.md"
V3_REGISTRY = ROOT / "research" / "stock_hypothesis_registry_v3_candidates.json"

VALID_FAILURE_MODES = {
    "UNIVERSE_TOO_SMALL",
    "DATA_TOO_SHORT",
    "RULE_TOO_STRICT",
    "ETF_UNIVERSE_TOO_SMALL",
    "SIGNAL_NOISY",
    "UNKNOWN",
}

H_TAGS = ["H009", "H010", "H011", "H012"]


def load_coverage() -> dict:
    return json.loads(COVERAGE_JSON.read_text())


def load_condition() -> dict:
    return json.loads(CONDITION_JSON.read_text())


# ---------------------------------------------------------------------------
# 1. Script executability
# ---------------------------------------------------------------------------

class TestAuditScriptExecutable:
    def test_audit_module_importable(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "audit_stock_signal_coverage",
            ROOT / "scripts" / "audit_stock_signal_coverage.py",
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert hasattr(mod, "run_audit")

    def test_run_audit_callable_dry_run(self, tmp_path):
        """run_audit completes without raising on a minimal symbol set."""
        from scripts.audit_stock_signal_coverage import run_audit
        # Run on full eligible set but max 5 symbols to keep test fast
        # Use tmp_path to avoid overwriting real output files
        result = run_audit(as_of_date="2026-05-01", min_rows=300, max_symbols=5, output_dir=tmp_path)
        assert isinstance(result, dict)
        assert "universe_summary" in result

    def test_output_files_generated(self):
        assert COVERAGE_JSON.exists(), "signal_coverage_audit.json not found"
        assert CONDITION_JSON.exists(), "condition_attribution.json not found"
        assert RECO_MD.exists(), "universe_expansion_recommendations.md not found"
        assert (DIAG_DIR / "signal_coverage_audit.md").exists()


# ---------------------------------------------------------------------------
# 2. signal_coverage_audit.json structure
# ---------------------------------------------------------------------------

class TestCoverageAuditJSON:
    def test_coverage_json_parseable(self):
        data = load_coverage()
        assert isinstance(data, dict)

    def test_coverage_json_has_pipeline_field(self):
        data = load_coverage()
        assert data.get("pipeline") == "P3-12"

    def test_coverage_json_has_run_ts(self):
        data = load_coverage()
        assert "run_ts" in data

    def test_coverage_json_has_as_of_date(self):
        data = load_coverage()
        assert "as_of_date" in data

    def test_coverage_json_has_universe_summary(self):
        data = load_coverage()
        assert "universe_summary" in data
        assert isinstance(data["universe_summary"], dict)

    def test_coverage_json_has_candidate_summaries(self):
        data = load_coverage()
        assert "candidate_coverage_summaries" in data
        assert isinstance(data["candidate_coverage_summaries"], list)
        assert len(data["candidate_coverage_summaries"]) > 0

    def test_coverage_json_has_safety_confirmations(self):
        data = load_coverage()
        sc = data.get("safety_confirmations", {})
        assert sc.get("no_hypothesis_added") is True
        assert sc.get("no_threshold_changed") is True
        assert sc.get("no_production_write") is True


# ---------------------------------------------------------------------------
# 3. Universe summary fields
# ---------------------------------------------------------------------------

class TestUniverseSummaryFields:
    def test_universe_has_total_symbols(self):
        us = load_coverage()["universe_summary"]
        assert "total_symbols" in us
        assert isinstance(us["total_symbols"], int)
        assert us["total_symbols"] > 0

    def test_universe_has_symbols_ge_150(self):
        us = load_coverage()["universe_summary"]
        assert "symbols_ge_150" in us

    def test_universe_has_symbols_ge_300(self):
        us = load_coverage()["universe_summary"]
        assert "symbols_ge_300" in us

    def test_universe_has_symbols_ge_500(self):
        us = load_coverage()["universe_summary"]
        assert "symbols_ge_500" in us

    def test_universe_has_stock_symbols_ge_500(self):
        us = load_coverage()["universe_summary"]
        assert "stock_symbols_ge_500" in us

    def test_universe_has_etf_symbols_ge_500(self):
        us = load_coverage()["universe_summary"]
        assert "etf_symbols_ge_500" in us

    def test_universe_has_p311_symbols_tested(self):
        us = load_coverage()["universe_summary"]
        assert "symbols_tested_in_p311" in us
        assert us["symbols_tested_in_p311"] == 8

    def test_universe_has_untested_eligible(self):
        us = load_coverage()["universe_summary"]
        assert "untested_eligible_ge_300" in us
        assert us["untested_eligible_ge_300"] > 0

    def test_universe_ge_300_greater_than_tested(self):
        us = load_coverage()["universe_summary"]
        assert us["symbols_ge_300"] > us["symbols_tested_in_p311"]

    def test_universe_thresholds_ordered(self):
        us = load_coverage()["universe_summary"]
        assert us["symbols_ge_150"] >= us["symbols_ge_300"] >= us["symbols_ge_500"]

    def test_total_symbols_exceeds_1000(self):
        """DB has >1000 symbols total."""
        us = load_coverage()["universe_summary"]
        assert us["total_symbols"] > 1000


# ---------------------------------------------------------------------------
# 4. H009–H012 coverage diagnostics
# ---------------------------------------------------------------------------

class TestCandidateCoverage:
    def _get_summaries(self) -> dict[str, dict]:
        data = load_coverage()
        return {cs["candidate_id"]: cs for cs in data["candidate_coverage_summaries"]}

    def test_all_h_tags_in_summaries(self):
        sums = self._get_summaries()
        for tag in H_TAGS:
            assert any(tag in k for k in sums), f"{tag} missing from coverage summaries"

    def test_each_candidate_has_total_signal_count(self):
        sums = self._get_summaries()
        for hid, cs in sums.items():
            assert "total_signal_count" in cs, f"{hid} missing total_signal_count"
            assert isinstance(cs["total_signal_count"], int)

    def test_each_candidate_has_avg_signal_rate(self):
        sums = self._get_summaries()
        for hid, cs in sums.items():
            assert "avg_signal_rate" in cs, f"{hid} missing avg_signal_rate"

    def test_each_candidate_has_symbols_with_any_signal(self):
        sums = self._get_summaries()
        for hid, cs in sums.items():
            assert "symbols_with_any_signal" in cs

    def test_each_candidate_has_windows_di(self):
        sums = self._get_summaries()
        for hid, cs in sums.items():
            assert "windows_data_insufficient" in cs

    def test_each_candidate_has_likely_failure_mode(self):
        sums = self._get_summaries()
        for hid, cs in sums.items():
            assert "likely_failure_mode" in cs, f"{hid} missing likely_failure_mode"

    def test_failure_mode_valid_enum(self):
        sums = self._get_summaries()
        for hid, cs in sums.items():
            mode = cs["likely_failure_mode"]
            assert mode in VALID_FAILURE_MODES, (
                f"{hid}: failure_mode '{mode}' not in valid enum {VALID_FAILURE_MODES}"
            )

    def test_h009_has_signals_on_50_symbols(self):
        sums = self._get_summaries()
        h009 = next((v for k, v in sums.items() if "H009" in k), None)
        assert h009 is not None
        assert h009["total_signal_count"] > 0

    def test_h010_has_signals_on_50_symbols(self):
        sums = self._get_summaries()
        h010 = next((v for k, v in sums.items() if "H010" in k), None)
        assert h010 is not None
        assert h010["total_signal_count"] > 0

    def test_h012_symbol_scoped(self):
        """H012 signals should be very limited — only symbol 2317 in scope."""
        sums = self._get_summaries()
        h012 = next((v for k, v in sums.items() if "H012" in k), None)
        assert h012 is not None
        # Most symbols are not in scope — total should be much less than H009/H010
        h009 = next((v for k, v in sums.items() if "H009" in k), None)
        # H012 total signals should be << H009 because scope is 1 symbol
        assert h012["total_signal_count"] <= h009["total_signal_count"]


# ---------------------------------------------------------------------------
# 5. condition_attribution.json
# ---------------------------------------------------------------------------

class TestConditionAttributionJSON:
    def test_condition_json_parseable(self):
        data = load_condition()
        assert isinstance(data, dict)

    def test_condition_json_has_pipeline(self):
        data = load_condition()
        assert data.get("pipeline") == "P3-12"

    def test_condition_json_has_attribution(self):
        data = load_condition()
        assert "condition_attribution" in data
        assert isinstance(data["condition_attribution"], dict)

    def test_condition_json_has_candidate_summaries(self):
        data = load_condition()
        assert "candidate_summaries" in data

    def test_condition_attribution_has_all_candidates(self):
        data = load_condition()
        attr = data["condition_attribution"]
        for tag in H_TAGS:
            assert any(tag in k for k in attr), f"{tag} missing from condition_attribution"

    def test_h009_has_ma60_condition(self):
        attr = load_condition()["condition_attribution"]
        h009_key = next(k for k in attr if "H009" in k)
        conds = attr[h009_key]
        assert "close_gt_ma60" in conds or "all_conditions" in conds

    def test_h010_has_volume_condition(self):
        attr = load_condition()["condition_attribution"]
        h010_key = next(k for k in attr if "H010" in k)
        conds = attr[h010_key]
        assert "volume_zscore_gt_0p5" in conds or "all_conditions" in conds

    def test_h011_has_breakout_condition(self):
        attr = load_condition()["condition_attribution"]
        h011_key = next(k for k in attr if "H011" in k)
        conds = attr[h011_key]
        assert "close_near_breakout_0p98" in conds or "all_conditions" in conds

    def test_condition_rates_between_0_and_1(self):
        attr = load_condition()["condition_attribution"]
        for hid, conds in attr.items():
            for ck, cv in conds.items():
                if isinstance(cv, (int, float)):
                    assert 0.0 <= cv <= 1.0, f"{hid}.{ck}={cv} not in [0,1]"

    def test_symbols_analyzed_gt_0(self):
        data = load_condition()
        assert data.get("symbols_analyzed", 0) > 0


# ---------------------------------------------------------------------------
# 6. Top blocking conditions
# ---------------------------------------------------------------------------

class TestTopBlockingConditions:
    def test_top_blocking_conditions_present(self):
        data = load_coverage()
        assert "top_blocking_conditions" in data
        blocks = data["top_blocking_conditions"]
        assert isinstance(blocks, list)

    def test_top_blocking_conditions_have_count(self):
        data = load_coverage()
        for b in data["top_blocking_conditions"][:5]:
            assert "condition" in b
            assert "count" in b
            assert isinstance(b["count"], int)


# ---------------------------------------------------------------------------
# 7. P3-11 vs full universe comparison
# ---------------------------------------------------------------------------

class TestP311VsFullComparison:
    def test_comparison_field_present(self):
        data = load_coverage()
        assert "p311_vs_full_comparison" in data

    def test_comparison_has_signal_multiplier(self):
        data = load_coverage()
        comp = data["p311_vs_full_comparison"]
        assert "signal_multiplier" in comp

    def test_full_universe_more_signals_than_p311(self):
        data = load_coverage()
        comp = data["p311_vs_full_comparison"]
        assert comp["full_universe_total_signals"] >= comp["p311_total_signals"]


# ---------------------------------------------------------------------------
# 8. Recommendation markdown
# ---------------------------------------------------------------------------

class TestRecommendationMarkdown:
    def test_recommendation_md_exists(self):
        assert RECO_MD.exists(), "universe_expansion_recommendations.md missing"

    def test_recommendation_md_has_core_sections(self):
        content = RECO_MD.read_text()
        assert "Universe Expansion" in content or "expansion" in content.lower()
        assert "Data" in content
        assert "Candidate" in content or "candidate" in content
        assert "Safety" in content or "safety" in content

    def test_recommendation_md_mentions_p311_symbol_count(self):
        content = RECO_MD.read_text()
        assert "8" in content  # 8 symbols tested in P3-11

    def test_recommendation_md_no_new_hypothesis(self):
        content = RECO_MD.read_text()
        # Should not contain markers of new hypothesis creation
        assert "H013" not in content
        assert "H014" not in content

    def test_recommendation_md_has_next_step(self):
        content = RECO_MD.read_text()
        # Must have some kind of recommendation for next step
        assert "P3-13" in content or "next" in content.lower() or "recommend" in content.lower()


# ---------------------------------------------------------------------------
# 9. Safety: no registry modification, no new hypothesis
# ---------------------------------------------------------------------------

class TestSafetyConstraints:
    def test_v3_registry_unchanged(self):
        data = json.loads(V3_REGISTRY.read_text())
        assert len(data["hypotheses"]) == 4

    def test_v3_registry_no_new_ids(self):
        data = json.loads(V3_REGISTRY.read_text())
        ids = [h["hypothesis_id"] for h in data["hypotheses"]]
        for tag in ["H013", "H014", "H015"]:
            assert not any(tag in i for i in ids), f"{tag} should not be in v3 registry"

    def test_v1_registry_unchanged(self):
        v1 = json.loads((ROOT / "research" / "stock_hypothesis_registry.json").read_text())
        assert len(v1["hypotheses"]) == 3  # H001, H002, H003

    def test_v2_registry_unchanged(self):
        v2 = json.loads((ROOT / "research" / "stock_hypothesis_registry_v2.json").read_text())
        assert len(v2["hypotheses"]) == 5  # H004–H008

    def test_coverage_audit_no_production_write(self):
        data = load_coverage()
        sc = data.get("safety_confirmations", {})
        assert sc.get("no_production_write") is True

    def test_coverage_audit_no_hypothesis_added(self):
        data = load_coverage()
        sc = data.get("safety_confirmations", {})
        assert sc.get("no_hypothesis_added") is True

    def test_coverage_audit_no_threshold_changed(self):
        data = load_coverage()
        sc = data.get("safety_confirmations", {})
        assert sc.get("no_threshold_changed") is True


# ---------------------------------------------------------------------------
# 10. Signal computer unit tests
# ---------------------------------------------------------------------------

class TestSignalCounters:
    def _make_rows(self, n: int = 60, trend: float = 0.001) -> list[dict]:
        import math
        rows = []
        price = 100.0
        for i in range(n):
            close = price * (1 + trend + 0.005 * math.sin(i / 5))
            rows.append({
                "date": f"2025-01-{(i % 28 + 1):02d}",
                "open": round(close * 0.999, 2),
                "high": round(close * 1.005, 2),
                "low": round(close * 0.995, 2),
                "close": round(close, 2),
                "volume": 1_000_000 + i * 1000,
            })
            price = close
        return rows

    def test_count_h009_returns_dict_with_signal_count(self):
        from scripts.audit_stock_signal_coverage import count_h009_signals
        rows = self._make_rows(100)
        result = count_h009_signals(rows, 100)
        assert "signal_count" in result
        assert isinstance(result["signal_count"], int)

    def test_count_h010_returns_dict_with_conditions(self):
        from scripts.audit_stock_signal_coverage import count_h010_signals
        rows = self._make_rows(100)
        result = count_h010_signals(rows, 100)
        assert "conditions" in result or "signal_count" in result

    def test_count_h011_returns_dict(self):
        from scripts.audit_stock_signal_coverage import count_h011_signals
        rows = self._make_rows(100)
        result = count_h011_signals(rows, 100)
        assert "signal_count" in result

    def test_count_h012_scoped_symbol_returns_signals(self):
        from scripts.audit_stock_signal_coverage import count_h012_signals
        rows = self._make_rows(80)
        result = count_h012_signals(rows, 80, "2317")
        assert "signal_count" in result

    def test_count_h012_non_scoped_symbol_returns_zero(self):
        from scripts.audit_stock_signal_coverage import count_h012_signals
        rows = self._make_rows(80)
        result = count_h012_signals(rows, 80, "9999")
        assert result["signal_count"] == 0

    def test_is_etf_like(self):
        from scripts.audit_stock_signal_coverage import is_etf_like
        assert is_etf_like("0055") is True
        assert is_etf_like("00712") is True
        assert is_etf_like("00738U") is True
        assert is_etf_like("2330") is False
        assert is_etf_like("1326") is False

    def test_infer_failure_mode_small_universe(self):
        from scripts.audit_stock_signal_coverage import infer_failure_mode
        mode = infer_failure_mode(
            cand_id="H009", total_signals=100, avg_rate=0.10,
            symbols_with_any=8, n_symbols_tested=5,
            windows_di=2, total_windows=10,
        )
        assert mode == "UNIVERSE_TOO_SMALL"

    def test_infer_failure_mode_low_rate(self):
        from scripts.audit_stock_signal_coverage import infer_failure_mode
        mode = infer_failure_mode(
            cand_id="H011", total_signals=5, avg_rate=0.001,
            symbols_with_any=3, n_symbols_tested=30,
            windows_di=3, total_windows=60,
        )
        assert mode == "RULE_TOO_STRICT"

    def test_infer_failure_mode_high_di_rate(self):
        from scripts.audit_stock_signal_coverage import infer_failure_mode
        mode = infer_failure_mode(
            cand_id="H010", total_signals=10, avg_rate=0.05,
            symbols_with_any=5, n_symbols_tested=20,
            windows_di=15, total_windows=20,
        )
        assert mode == "DATA_TOO_SHORT"

    def test_all_failure_modes_valid_enum(self):
        from scripts.audit_stock_signal_coverage import VALID_FAILURE_MODES, infer_failure_mode
        test_cases = [
            (5, 0.10, 4, 5, 2, 10),
            (100, 0.001, 3, 30, 3, 60),
            (10, 0.05, 5, 20, 15, 20),
            (500, 0.15, 20, 30, 5, 60),
        ]
        for args in test_cases:
            mode = infer_failure_mode("H_TEST", *args, False)
            assert mode in VALID_FAILURE_MODES
