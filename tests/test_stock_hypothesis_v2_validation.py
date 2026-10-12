"""
tests/test_stock_hypothesis_v2_validation.py
P3-08: Tests for H004–H008 signal computers and v2 registry batch pipeline.
"""
import json
import sys
import types
import pytest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

# ── Import helpers from batch script ─────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.run_stock_real_batch_validation import (
    compute_h004_signals,
    compute_h005_signals,
    compute_h006_signals,
    compute_h007_signals,
    compute_h008_signals,
    SIGNAL_COMPUTERS,
    REGISTRY_PATH,
    DEFAULT_REGISTRY_PATH,
    BH_FDR_ALPHA,
)

V2_REGISTRY_PATH = Path(__file__).parent.parent / "research" / "stock_hypothesis_registry_v2.json"


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_rows(n: int, base_close: float = 100.0, symbol: str = "T001",
               start_date: str = "2024-01-02", volume: float = 1000.0,
               is_etf: bool = False) -> list:
    sym = "0055" if is_etf else symbol
    rows = []
    d = date.fromisoformat(start_date)
    c = base_close
    for i in range(n):
        rows.append({
            "date": d.isoformat(),
            "symbol": sym,
            "open": c * 0.99,
            "high": c * 1.005,
            "low": c * 0.995,
            "close": c,
            "volume": volume + i * 5,
        })
        c = c * 1.001
        d += timedelta(days=1)
        if d.weekday() >= 5:
            d += timedelta(days=2)
    return rows


# ── V2 registry ───────────────────────────────────────────────────────────────

def test_v2_registry_exists():
    assert V2_REGISTRY_PATH.exists(), "stock_hypothesis_registry_v2.json must exist"


def test_v2_registry_has_five_hypotheses():
    data = json.loads(V2_REGISTRY_PATH.read_text())
    hyps = data.get("hypotheses", [])
    assert len(hyps) >= 5


def test_v2_registry_required_fields():
    data = json.loads(V2_REGISTRY_PATH.read_text())
    required = {"hypothesis_id", "description", "feature_set", "expected_signal",
                 "entry_rule", "exit_rule", "risk_note", "status"}
    for hyp in data["hypotheses"]:
        missing = required - set(hyp.keys())
        assert not missing, f"{hyp.get('hypothesis_id')} missing fields: {missing}"


def test_v2_registry_h004_to_h008_ids():
    data = json.loads(V2_REGISTRY_PATH.read_text())
    ids = {h["hypothesis_id"] for h in data["hypotheses"]}
    for hid in ["STOCK_H004_MOM_VOL_CONFIRM", "STOCK_H005_PULLBACK_UPTREND",
                "STOCK_H006_LOW_VOL_BREAKOUT", "STOCK_H007_RELATIVE_STRENGTH",
                "STOCK_H008_ETF_DEF_MOMENTUM"]:
        assert hid in ids, f"{hid} not found in v2 registry"


def test_v2_registry_all_registered():
    data = json.loads(V2_REGISTRY_PATH.read_text())
    for hyp in data["hypotheses"]:
        assert hyp["status"] == "registered", f"{hyp['hypothesis_id']} status != registered"


# ── Signal computers ──────────────────────────────────────────────────────────

def test_h004_no_crash_small():
    rows = _make_rows(30)
    signals = compute_h004_signals(rows, forward=5)
    assert isinstance(signals, list)


def test_h004_no_crash_sufficient():
    rows = _make_rows(60)
    signals = compute_h004_signals(rows, forward=5)
    # signals are dicts with 'signal' key
    for s in signals:
        assert isinstance(s, dict) and "signal" in s


def test_h004_in_signal_computers():
    assert "STOCK_H004_MOM_VOL_CONFIRM" in SIGNAL_COMPUTERS


def test_h005_no_crash():
    rows = _make_rows(80)
    signals = compute_h005_signals(rows, forward=5)
    assert isinstance(signals, list)


def test_h005_in_signal_computers():
    assert "STOCK_H005_PULLBACK_UPTREND" in SIGNAL_COMPUTERS


def test_h006_no_crash():
    rows = _make_rows(80)
    signals = compute_h006_signals(rows, forward=5)
    assert isinstance(signals, list)


def test_h006_in_signal_computers():
    assert "STOCK_H006_LOW_VOL_BREAKOUT" in SIGNAL_COMPUTERS


def test_h007_no_crash_with_median():
    rows = _make_rows(60)
    median = {r["date"]: 0.0 for r in rows}
    signals = compute_h007_signals(
        rows, forward=5, extra_context={"universe_median_returns": median}
    )
    assert isinstance(signals, list)


def test_h007_no_crash_no_median():
    """If universe_median_returns not provided, must not crash."""
    rows = _make_rows(60)
    signals = compute_h007_signals(rows, forward=5, extra_context=None)
    assert isinstance(signals, list)
    assert len(signals) == 0  # no median → no signals


def test_h007_in_signal_computers():
    assert "STOCK_H007_RELATIVE_STRENGTH" in SIGNAL_COMPUTERS


def test_h008_etf_only_returns_empty_for_non_etf():
    rows = _make_rows(60, symbol="2330")
    signals = compute_h008_signals(rows, forward=5)
    assert len(signals) == 0


def test_h008_etf_processes_etf_symbol():
    rows = _make_rows(60, is_etf=True)
    signals = compute_h008_signals(rows, forward=5)
    assert isinstance(signals, list)


def test_h008_in_signal_computers():
    assert "STOCK_H008_ETF_DEF_MOMENTUM" in SIGNAL_COMPUTERS


def test_all_v2_in_signal_computers():
    for hid in ["STOCK_H004_MOM_VOL_CONFIRM", "STOCK_H005_PULLBACK_UPTREND",
                "STOCK_H006_LOW_VOL_BREAKOUT", "STOCK_H007_RELATIVE_STRENGTH",
                "STOCK_H008_ETF_DEF_MOMENTUM"]:
        assert hid in SIGNAL_COMPUTERS


# ── PIT safety — signal computers must not read future rows ──────────────────

def test_h004_pit_safety():
    rows = _make_rows(60)
    sig1 = compute_h004_signals(rows, forward=5)
    early_dates = {s["date"] for s in sig1 if isinstance(s, dict) and s.get("date", "") < "2024-03-01"}
    rows[55]["close"] = 9999.0
    sig2 = compute_h004_signals(rows, forward=5)
    dates2 = {s["date"] for s in sig2 if isinstance(s, dict) and s.get("date", "") < "2024-03-01"}
    assert early_dates == dates2


def test_h005_pit_safety():
    rows = _make_rows(80)
    sig1 = compute_h005_signals(rows, forward=5)
    early_dates = {s["date"] for s in sig1 if isinstance(s, dict) and s.get("date", "") < "2024-04-01"}
    rows[75]["close"] = 0.001
    sig2 = compute_h005_signals(rows, forward=5)
    dates2 = {s["date"] for s in sig2 if isinstance(s, dict) and s.get("date", "") < "2024-04-01"}
    assert early_dates == dates2


# ── SIGNAL_COMPUTERS backward compat (H001–H003 still present) ───────────────

def test_h001_still_present():
    assert "STOCK_H001_20D_MOMENTUM" in SIGNAL_COMPUTERS


def test_h002_still_present():
    assert "STOCK_H002_RSI_REVERSION" in SIGNAL_COMPUTERS


def test_h003_still_present():
    assert "STOCK_H003_VOLUME_BREAKOUT" in SIGNAL_COMPUTERS


# ── Batch run with --registry flag ────────────────────────────────────────────

def test_registry_path_default():
    """DEFAULT_REGISTRY_PATH should point to the original v1 registry."""
    p = Path(DEFAULT_REGISTRY_PATH)
    assert p.name.startswith("stock_hypothesis_registry")


def test_v2_batch_summary_parseable(tmp_path):
    """Run a minimal dry-run and verify batch_summary.json is valid JSON with BH-FDR fields."""
    import subprocess
    result = subprocess.run(
        [
            sys.executable, "scripts/run_stock_real_batch_validation.py",
            "--dry-run", "--batch",
            "--registry", str(V2_REGISTRY_PATH),
            "--symbols", "0055",
            "--as-of-date", "2026-05-01",
            "--min-rows", "300",
            "--permutations", "10",
        ],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent.parent),
    )
    assert result.returncode == 0, f"Script failed:\n{result.stderr}"

    # Find and parse batch_summary.json
    batch_dir = Path(__file__).parent.parent / "outputs" / "stock_validation_real_batch" / "20260501"
    summary_file = batch_dir / "batch_summary.json"
    assert summary_file.exists(), "batch_summary.json not created"
    summary = json.loads(summary_file.read_text())
    assert "bh_fdr_pass_count" in summary
    assert "promoted_candidates" in summary
    assert "leakage_violation_count" in summary
    assert "random_split_violation_count" in summary


def test_v2_batch_data_lineage_present(tmp_path):
    """Each result must have data_lineage.json."""
    import subprocess
    result = subprocess.run(
        [
            sys.executable, "scripts/run_stock_real_batch_validation.py",
            "--dry-run", "--batch",
            "--registry", str(V2_REGISTRY_PATH),
            "--symbols", "2330",
            "--as-of-date", "2026-05-01",
            "--min-rows", "300",
            "--permutations", "10",
        ],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent.parent),
    )
    assert result.returncode == 0, f"Script failed:\n{result.stderr}"
    out_base = (
        Path(__file__).parent.parent
        / "outputs" / "stock_validation_real_batch" / "20260501" / "2330"
    )
    if out_base.exists():
        for hyp_dir in out_base.iterdir():
            lineage_file = hyp_dir / "data_lineage.json"
            assert lineage_file.exists(), f"Missing data_lineage.json in {hyp_dir}"
            lineage = json.loads(lineage_file.read_text())
            assert "symbol" in lineage or "data_source" in lineage


def test_v2_no_production_write():
    """Batch script must never trigger production write paths."""
    import subprocess
    result = subprocess.run(
        [
            sys.executable, "scripts/run_stock_real_batch_validation.py",
            "--dry-run", "--batch",
            "--registry", str(V2_REGISTRY_PATH),
            "--symbols", "0055",
            "--as-of-date", "2026-05-01",
            "--min-rows", "300",
            "--permutations", "10",
        ],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent.parent),
    )
    combined = result.stdout + result.stderr
    assert "PRODUCTION_WRITE" not in combined
    assert "write_production" not in combined
    assert "place_order" not in combined


def test_v2_no_random_split():
    """Batch script must not use random split — only time-based."""
    batch_script = Path(__file__).parent.parent / "scripts" / "run_stock_real_batch_validation.py"
    content = batch_script.read_text()
    # 'random_split' as variable name or value should not appear
    assert "random_split=True" not in content
    # PIT guard should enforce time_based
    assert "time_based" in content


# ── BH-FDR constants ──────────────────────────────────────────────────────────

def test_bh_fdr_alpha_value():
    assert BH_FDR_ALPHA == pytest.approx(0.10)
