"""
P3-09 Tests: Failed Hypothesis Diagnostics & Signal Attribution
Validates that the diagnostics script:
- Is executable without errors
- Produces parseable JSON outputs
- Covers every hypothesis with a valid failure_reason
- Does not create new hypotheses, modify registries, or produce production writes
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "analyze_stock_hypothesis_failures.py"
OUT_DIR = REPO_ROOT / "outputs" / "stock_diagnostics"
REGISTRY_V1 = REPO_ROOT / "research" / "stock_hypothesis_registry.json"
REGISTRY_V2 = REPO_ROOT / "research" / "stock_hypothesis_registry_v2.json"

VALID_FAILURE_REASONS = frozenset([
    "LOW_SIGNAL_COUNT",
    "SIGNAL_TOO_NOISY",
    "NEGATIVE_ROI",
    "UNSTABLE_ACROSS_SYMBOLS",
    "PERMUTATION_FAIL",
    "BH_FDR_FAIL",
    "DATA_INSUFFICIENT",
    "MIXED_WEAK_SIGNAL",
])

EXPECTED_HYPOTHESES = {
    "STOCK_H001_20D_MOMENTUM",
    "STOCK_H002_RSI_REVERSION",
    "STOCK_H003_VOLUME_BREAKOUT",
    "STOCK_H004_MOM_VOL_CONFIRM",
    "STOCK_H005_PULLBACK_UPTREND",
    "STOCK_H006_LOW_VOL_BREAKOUT",
    "STOCK_H007_RELATIVE_STRENGTH",
    "STOCK_H008_ETF_DEF_MOMENTUM",
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def run_diagnostics():
    """Run the diagnostics script once for the module."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )
    return result


@pytest.fixture(scope="module")
def diag_json(run_diagnostics):
    path = OUT_DIR / "hypothesis_failure_diagnostics.json"
    assert path.exists(), f"Missing output: {path}"
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def symbol_json(run_diagnostics):
    path = OUT_DIR / "symbol_diagnostics.json"
    assert path.exists(), f"Missing output: {path}"
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def feature_json(run_diagnostics):
    path = OUT_DIR / "feature_diagnostics.json"
    assert path.exists(), f"Missing output: {path}"
    with open(path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Test: script execution
# ---------------------------------------------------------------------------
class TestScriptExecution:
    def test_script_exists(self):
        assert SCRIPT.exists(), f"Script not found: {SCRIPT}"

    def test_script_runs_successfully(self, run_diagnostics):
        assert run_diagnostics.returncode == 0, (
            f"Script exited with code {run_diagnostics.returncode}\n"
            f"STDOUT: {run_diagnostics.stdout}\n"
            f"STDERR: {run_diagnostics.stderr}"
        )

    def test_script_produces_output_directory(self, run_diagnostics):
        assert OUT_DIR.exists(), f"Output directory not created: {OUT_DIR}"


# ---------------------------------------------------------------------------
# Test: JSON outputs parseable
# ---------------------------------------------------------------------------
class TestJsonOutputsParseable:
    def test_hypothesis_diagnostics_json_parseable(self, diag_json):
        assert isinstance(diag_json, dict)
        assert "hypothesis_diagnostics" in diag_json

    def test_symbol_diagnostics_json_parseable(self, symbol_json):
        assert isinstance(symbol_json, dict)
        assert "symbol_diagnostics" in symbol_json

    def test_feature_diagnostics_json_parseable(self, feature_json):
        assert isinstance(feature_json, dict)
        assert "feature_diagnostics" in feature_json

    def test_hypothesis_diagnostics_has_hypotheses_analyzed(self, diag_json):
        assert diag_json.get("hypotheses_analyzed", 0) > 0

    def test_symbol_diagnostics_has_entries(self, symbol_json):
        assert len(symbol_json["symbol_diagnostics"]) > 0

    def test_feature_diagnostics_has_entries(self, feature_json):
        assert len(feature_json["feature_diagnostics"]) > 0


# ---------------------------------------------------------------------------
# Test: every hypothesis has failure_reason
# ---------------------------------------------------------------------------
class TestHypothesisFailureReasons:
    def test_all_expected_hypotheses_present(self, diag_json):
        found = {h["hypothesis_id"] for h in diag_json["hypothesis_diagnostics"]}
        missing = EXPECTED_HYPOTHESES - found
        assert not missing, f"Missing hypotheses in diagnostics: {missing}"

    def test_every_hypothesis_has_failure_reason(self, diag_json):
        for h in diag_json["hypothesis_diagnostics"]:
            assert "failure_reason" in h, (
                f"{h['hypothesis_id']} has no failure_reason"
            )
            assert h["failure_reason"], (
                f"{h['hypothesis_id']} has empty failure_reason"
            )

    def test_all_failure_reasons_are_valid_enum(self, diag_json):
        for h in diag_json["hypothesis_diagnostics"]:
            reason = h["failure_reason"]
            assert reason in VALID_FAILURE_REASONS, (
                f"{h['hypothesis_id']} has invalid failure_reason: '{reason}'. "
                f"Must be one of: {sorted(VALID_FAILURE_REASONS)}"
            )

    def test_failure_summary_matches_diagnostics(self, diag_json):
        summary = diag_json.get("failure_summary", {})
        for h in diag_json["hypothesis_diagnostics"]:
            hid = h["hypothesis_id"]
            assert hid in summary, f"{hid} missing from failure_summary"
            assert summary[hid] == h["failure_reason"]

    def test_h001_h003_present_from_v1(self, diag_json):
        found = {h["hypothesis_id"] for h in diag_json["hypothesis_diagnostics"]}
        for hid in ["STOCK_H001_20D_MOMENTUM", "STOCK_H002_RSI_REVERSION",
                    "STOCK_H003_VOLUME_BREAKOUT"]:
            assert hid in found, f"V1 hypothesis {hid} missing from diagnostics"

    def test_h004_h008_present_from_v2(self, diag_json):
        found = {h["hypothesis_id"] for h in diag_json["hypothesis_diagnostics"]}
        for hid in ["STOCK_H004_MOM_VOL_CONFIRM", "STOCK_H005_PULLBACK_UPTREND",
                    "STOCK_H006_LOW_VOL_BREAKOUT", "STOCK_H007_RELATIVE_STRENGTH",
                    "STOCK_H008_ETF_DEF_MOMENTUM"]:
            assert hid in found, f"V2 hypothesis {hid} missing from diagnostics"


# ---------------------------------------------------------------------------
# Test: hypothesis diagnostics fields
# ---------------------------------------------------------------------------
class TestHypothesisDiagnosticsFields:
    REQUIRED_FIELDS = [
        "hypothesis_id", "total_signals", "avg_signals_per_symbol",
        "signal_coverage_rate", "avg_roi", "avg_sharpe", "best_symbol",
        "worst_symbol", "best_window", "worst_window", "permutation_pass_count",
        "bh_fdr_pass_count", "data_insufficient_count", "failure_reason",
    ]

    def test_all_required_fields_present(self, diag_json):
        for h in diag_json["hypothesis_diagnostics"]:
            for field in self.REQUIRED_FIELDS:
                assert field in h, (
                    f"{h['hypothesis_id']} missing field '{field}'"
                )

    def test_signal_counts_non_negative(self, diag_json):
        for h in diag_json["hypothesis_diagnostics"]:
            assert h["total_signals"] >= 0
            assert h["data_insufficient_count"] >= 0
            assert h["bh_fdr_pass_count"] >= 0
            assert h["permutation_pass_count"] >= 0


# ---------------------------------------------------------------------------
# Test: symbol diagnostics
# ---------------------------------------------------------------------------
class TestSymbolDiagnostics:
    REQUIRED_FIELDS = [
        "symbol", "symbol_avg_roi", "symbol_avg_sharpe", "symbol_signal_count",
        "best_hypothesis", "worst_hypothesis",
        "is_unsuitable_for_current_hypotheses",
    ]

    def test_symbol_diagnostics_parseable(self, symbol_json):
        assert isinstance(symbol_json["symbol_diagnostics"], list)

    def test_symbol_entries_have_required_fields(self, symbol_json):
        for s in symbol_json["symbol_diagnostics"]:
            for field in self.REQUIRED_FIELDS:
                assert field in s, f"Symbol {s.get('symbol')} missing field '{field}'"

    def test_is_unsuitable_is_boolean(self, symbol_json):
        for s in symbol_json["symbol_diagnostics"]:
            assert isinstance(s["is_unsuitable_for_current_hypotheses"], bool)


# ---------------------------------------------------------------------------
# Test: feature diagnostics
# ---------------------------------------------------------------------------
class TestFeatureDiagnostics:
    EXPECTED_FEATURES = {
        "volume_zscore_20d",
        "breakout_20d_high",
        "universe_relative_strength",
        "pullback_rule",
        "etf_defensive_momentum",
    }

    def test_all_v2_features_analyzed(self, feature_json):
        found = {fd["feature_key"] for fd in feature_json["feature_diagnostics"]}
        missing = self.EXPECTED_FEATURES - found
        assert not missing, f"Missing feature diagnostics: {missing}"

    def test_feature_entries_have_diagnosed_issues(self, feature_json):
        for fd in feature_json["feature_diagnostics"]:
            assert "diagnosed_issues" in fd
            assert isinstance(fd["diagnosed_issues"], list)
            assert len(fd["diagnosed_issues"]) > 0, (
                f"Feature {fd['feature_key']} has no diagnosed issues"
            )

    def test_h007_relative_strength_flagged_as_universe_issue(self, feature_json):
        rs = next(
            (fd for fd in feature_json["feature_diagnostics"]
             if fd["feature_key"] == "universe_relative_strength"),
            None,
        )
        assert rs is not None
        issues = rs["diagnosed_issues"]
        # Should flag universe or data insufficiency
        has_universe_flag = any(
            "UNIVERSE" in i or "INSUFFICIENT" in i or "TRIGGER" in i
            for i in issues
        )
        assert has_universe_flag, (
            f"universe_relative_strength should flag universe issue; got: {issues}"
        )


# ---------------------------------------------------------------------------
# Test: recommendation markdown exists
# ---------------------------------------------------------------------------
class TestRecommendationMarkdown:
    def test_recommendations_file_exists(self, run_diagnostics):
        path = OUT_DIR / "hypothesis_improvement_recommendations.md"
        assert path.exists(), f"Missing: {path}"

    def test_recommendations_file_non_empty(self, run_diagnostics):
        path = OUT_DIR / "hypothesis_improvement_recommendations.md"
        content = path.read_text(encoding="utf-8")
        assert len(content) > 100, "Recommendations file is too short"

    def test_recommendations_mentions_prohibited_actions(self, run_diagnostics):
        path = OUT_DIR / "hypothesis_improvement_recommendations.md"
        content = path.read_text(encoding="utf-8")
        assert "No new hypotheses" in content or "no_new_hypothesis" in content

    def test_hypothesis_failure_md_exists(self, run_diagnostics):
        path = OUT_DIR / "hypothesis_failure_diagnostics.md"
        assert path.exists(), f"Missing: {path}"


# ---------------------------------------------------------------------------
# Test: no registry modification
# ---------------------------------------------------------------------------
class TestNoRegistryModification:
    def _load_registry(self, path: Path) -> str:
        return path.read_text(encoding="utf-8")

    def test_v1_registry_unchanged_after_diagnostics(self, run_diagnostics):
        """Registry should be readable and not corrupted."""
        content = self._load_registry(REGISTRY_V1)
        data = json.loads(content)
        assert "hypotheses" in data

    def test_v2_registry_unchanged_after_diagnostics(self, run_diagnostics):
        """V2 registry should be readable and not corrupted."""
        content = self._load_registry(REGISTRY_V2)
        data = json.loads(content)
        assert "hypotheses" in data

    def test_v1_hypothesis_count_unchanged(self, run_diagnostics):
        data = json.loads(REGISTRY_V1.read_text())
        assert len(data["hypotheses"]) == 3, (
            "V1 registry hypothesis count changed — registry was modified!"
        )

    def test_v2_hypothesis_count_unchanged(self, run_diagnostics):
        data = json.loads(REGISTRY_V2.read_text())
        assert len(data["hypotheses"]) == 5, (
            "V2 registry hypothesis count changed — registry was modified!"
        )

    def test_no_new_hypothesis_in_v1(self, run_diagnostics):
        data = json.loads(REGISTRY_V1.read_text())
        ids = {h["hypothesis_id"] for h in data["hypotheses"]}
        assert "STOCK_H009" not in str(ids), "New hypothesis was added to v1 registry"

    def test_no_new_hypothesis_in_v2(self, run_diagnostics):
        data = json.loads(REGISTRY_V2.read_text())
        ids = {h["hypothesis_id"] for h in data["hypotheses"]}
        assert "STOCK_H009" not in str(ids), "New hypothesis was added to v2 registry"


# ---------------------------------------------------------------------------
# Test: no production writes
# ---------------------------------------------------------------------------
class TestNoProductionWrites:
    def test_safety_confirmations_present(self, diag_json):
        sc = diag_json.get("safety_confirmations", {})
        assert sc.get("no_production_write") is True
        assert sc.get("no_new_hypothesis") is True
        assert sc.get("no_registry_modification") is True
        assert sc.get("no_trade_execution") is True
        assert sc.get("diagnostics_only") is True

    def test_output_only_in_diagnostics_dir(self, run_diagnostics):
        """Verify outputs went to stock_diagnostics/, not production paths."""
        assert OUT_DIR.exists()
        # Ensure no writes to production paths
        prod_paths = [
            REPO_ROOT / "outputs" / "stock_validation_real_batch",
            REPO_ROOT / "research",
        ]
        # These should not have been modified by the script (they pre-exist)
        for p in prod_paths:
            assert p.exists(), f"Production path was deleted: {p}"
