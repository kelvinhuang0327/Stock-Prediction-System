"""
Tests for P3-07 — Real Stock Hypothesis Batch Evaluation Pipeline.

Tests:
  1.  Symbol universe selector: finds >= 5 symbols with default criteria
  2.  Symbol universe selector: returns DATA_INSUFFICIENT (empty list) for
      impossible criteria without crashing
  3.  Symbol selector respects explicit symbol list
  4.  Symbol selector filters symbols below min_rows
  5.  Batch pipeline runs without crashing (smoke test)
  6.  Output paths are created correctly
  7.  batch_summary.json is parseable and contains required fields
  8.  BH-FDR fields present in all valid test results
  9.  data_lineage.json exists for every symbol × hypothesis pair
  10. No production write in reproducibility pack
  11. No random split in any output
  12. eval_window returns DATA_INSUFFICIENT gracefully (no crash)
  13. BH-FDR correction returns correct shape
  14. Promotion gate requires all conditions (rejects partial)
  15. batch_summary.md is created and parseable
"""

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List

import pytest

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from scripts.run_stock_real_batch_validation import (
    select_symbols,
    eval_window,
    bh_fdr_correction,
    decide_promotion,
    run_batch_pipeline,
    DATA_INSUFFICIENT,
    DB_PATH,
    OUTPUT_BATCH_BASE,
    BATCH_WINDOWS,
)

# ── Fixtures / helpers ─────────────────────────────────────────────────────────

def _make_temp_db_with_quotes(rows_per_symbol: Dict[str, List[str]]) -> str:
    """Create a temp DB with StockQuote data for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE StockQuote (
            id INTEGER PRIMARY KEY,
            stockId TEXT, date TEXT,
            open REAL, high REAL, low REAL, close REAL,
            volume REAL, tradeValue REAL, change REAL,
            transactions INTEGER, createdAt TEXT
        )
    """)
    for symbol, dates in rows_per_symbol.items():
        for i, d in enumerate(dates):
            conn.execute(
                "INSERT INTO StockQuote (stockId, date, open, high, low, close, volume, "
                "tradeValue, change, transactions, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (symbol, d, 100.0 + i * 0.1, 105.0 + i * 0.1, 95.0 + i * 0.1,
                 100.0 + i * 0.2, 1_000_000.0, 1e8, 0.2, 5000, "2026-01-01 00:00:00"),
            )
    conn.commit()
    conn.close()
    return path


def _iso_dates(n: int, start_year: int = 2020) -> List[str]:
    """Return n ISO dates starting Jan 1 of start_year (weekdays only)."""
    from datetime import date, timedelta
    d = date(start_year, 1, 1)
    dates = []
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d.isoformat())
        d += timedelta(days=1)
    return dates


def _make_argparse_ns(**kwargs) -> Any:
    """Create a mock argparse.Namespace."""
    import argparse
    ns = argparse.Namespace()
    defaults = {
        "dry_run": True,
        "batch": True,
        "symbols": None,
        "as_of_date": "2026-05-01",
        "window_days": 1500,
        "min_rows": 300,
        "permutations": 50,
    }
    defaults.update(kwargs)
    for k, v in defaults.items():
        setattr(ns, k, v)
    return ns


# ── Test 1: symbol universe finds >= 5 symbols from real dev.db ──────────────

def test_symbol_universe_real_db_finds_symbols():
    """select_symbols must find >= 5 symbols with default criteria from dev.db."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    symbols = select_symbols(
        as_of_date="2026-05-01",
        min_rows=300,
        n_max=10,
        db_path=DB_PATH,
    )
    assert len(symbols) >= 5, (
        f"Expected >= 5 symbols, got {len(symbols)}: {symbols}"
    )


# ── Test 2: DATA_INSUFFICIENT when no symbols qualify ─────────────────────────

def test_symbol_universe_returns_empty_when_no_data():
    """select_symbols with impossible min_rows must return empty list (no crash)."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    symbols = select_symbols(
        as_of_date="2020-01-01",   # too early, no data
        min_rows=99999,            # impossible
        n_max=10,
        db_path=DB_PATH,
    )
    assert symbols == [], f"Expected empty list, got {symbols}"


# ── Test 3: selector respects explicit symbol list ────────────────────────────

def test_symbol_selector_filters_explicit_list():
    """select_symbols with requested_symbols only returns symbols that qualify."""
    dates_300 = _iso_dates(350)
    dates_50 = _iso_dates(60)
    db_path = _make_temp_db_with_quotes({
        "GOOD1": dates_300,
        "GOOD2": dates_300,
        "TOO_FEW": dates_50,
    })
    try:
        symbols = select_symbols(
            as_of_date="2099-12-31",
            min_rows=200,
            requested_symbols=["GOOD1", "GOOD2", "TOO_FEW"],
            db_path=Path(db_path),
        )
        assert "GOOD1" in symbols
        assert "GOOD2" in symbols
        assert "TOO_FEW" not in symbols, "Symbol with insufficient rows should be excluded"
    finally:
        os.unlink(db_path)


# ── Test 4: selector filters symbols below min_rows ───────────────────────────

def test_symbol_selector_min_rows_filter():
    """Auto-selection must not include symbols with fewer rows than min_rows."""
    dates_400 = _iso_dates(420)
    dates_100 = _iso_dates(110)
    db_path = _make_temp_db_with_quotes({"BIG": dates_400, "SMALL": dates_100})
    try:
        symbols = select_symbols(
            as_of_date="2099-12-31",
            min_rows=300,
            n_max=10,
            db_path=Path(db_path),
        )
        assert "BIG" in symbols
        assert "SMALL" not in symbols
    finally:
        os.unlink(db_path)


# ── Test 5: batch pipeline smoke test (no crash) ──────────────────────────────

def test_batch_pipeline_smoke_no_crash():
    """Full batch pipeline run must complete without raising an exception."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    args = _make_argparse_ns(
        symbols="2330,0055",
        as_of_date="2026-05-01",
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    summary = run_batch_pipeline(args)
    assert isinstance(summary, dict)
    assert "symbols_evaluated" in summary


# ── Test 6: output paths are created correctly ────────────────────────────────

def test_batch_output_paths_created():
    """Batch pipeline must create output directories and files for each symbol × hyp."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    base = OUTPUT_BATCH_BASE / test_date.replace("-", "")
    assert base.exists(), f"Output dir not created: {base}"

    registry_path = ROOT / "research" / "stock_hypothesis_registry.json"
    registry = json.loads(registry_path.read_text())
    for hyp in registry["hypotheses"]:
        hid = hyp["hypothesis_id"]
        hyp_dir = base / "2330" / hid.lower()
        for fname in ["gate_result.json", "validation_metrics.json",
                       "reproducibility_pack.json", "data_lineage.json"]:
            assert (hyp_dir / fname).exists(), f"Missing: {hyp_dir / fname}"


# ── Test 7: batch_summary.json is parseable and has required fields ────────────

def test_batch_summary_json_parseable_and_complete():
    """batch_summary.json must be valid JSON with all required fields."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330,2317",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    summary_path = OUTPUT_BATCH_BASE / test_date.replace("-", "") / "batch_summary.json"
    assert summary_path.exists()
    summary = json.loads(summary_path.read_text())

    required_fields = {
        "symbols_requested", "symbols_evaluated", "total_tests",
        "total_passed_pit", "total_data_insufficient",
        "promoted_candidates", "rejected_count",
        "avg_roi", "avg_sharpe", "permutation_pass_rate",
        "bh_fdr_pass_count", "leakage_violation_count",
        "random_split_violation_count", "final_classification",
    }
    missing = required_fields - set(summary.keys())
    assert not missing, f"batch_summary.json missing fields: {missing}"


# ── Test 8: BH-FDR fields present in all valid window results ─────────────────

def test_bh_fdr_fields_in_results():
    """gate_result.json must include bh_fdr_pass, bh_fdr_q_value for each window."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    registry = json.loads((ROOT / "research" / "stock_hypothesis_registry.json").read_text())
    base = OUTPUT_BATCH_BASE / test_date.replace("-", "")
    for hyp in registry["hypotheses"]:
        hid = hyp["hypothesis_id"]
        gr_path = base / "2330" / hid.lower() / "gate_result.json"
        if not gr_path.exists():
            continue
        gr = json.loads(gr_path.read_text())
        for wr in gr.get("window_results", []):
            if wr.get("status") == "OK":
                assert "bh_fdr_q_value" in wr, f"bh_fdr_q_value missing in {hid} window {wr.get('window_days')}"
                assert "bh_fdr_pass" in wr, f"bh_fdr_pass missing in {hid} window {wr.get('window_days')}"


# ── Test 9: data_lineage.json exists for every symbol × hypothesis ─────────────

def test_data_lineage_exists_for_all_results():
    """data_lineage.json must exist for every (symbol × hypothesis) output."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    registry = json.loads((ROOT / "research" / "stock_hypothesis_registry.json").read_text())
    base = OUTPUT_BATCH_BASE / test_date.replace("-", "")
    for hyp in registry["hypotheses"]:
        hid = hyp["hypothesis_id"]
        lineage_path = base / "2330" / hid.lower() / "data_lineage.json"
        assert lineage_path.exists(), f"data_lineage.json missing for 2330 × {hid}"
        lineage = json.loads(lineage_path.read_text())
        assert "data_source" in lineage
        assert lineage["symbol"] == "2330"


# ── Test 10: no production write in reproducibility pack ──────────────────────

def test_no_production_write_in_repro_pack():
    """reproducibility_pack.json must confirm no_production_write=True."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    registry = json.loads((ROOT / "research" / "stock_hypothesis_registry.json").read_text())
    base = OUTPUT_BATCH_BASE / test_date.replace("-", "")
    for hyp in registry["hypotheses"]:
        hid = hyp["hypothesis_id"]
        repro_path = base / "2330" / hid.lower() / "reproducibility_pack.json"
        if not repro_path.exists():
            continue
        repro = json.loads(repro_path.read_text())
        safety = repro.get("safety_confirmations", {})
        assert safety.get("no_production_write") is True
        assert safety.get("no_trade_execution") is True


# ── Test 11: no random split in any output ────────────────────────────────────

def test_no_random_split_in_outputs():
    """batch_summary.json must confirm random_split_violation_count=0."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    summary_path = OUTPUT_BATCH_BASE / test_date.replace("-", "") / "batch_summary.json"
    summary = json.loads(summary_path.read_text())
    assert summary["random_split_violation_count"] == 0

    # Also check repro packs
    registry = json.loads((ROOT / "research" / "stock_hypothesis_registry.json").read_text())
    base = OUTPUT_BATCH_BASE / test_date.replace("-", "")
    for hyp in registry["hypotheses"]:
        hid = hyp["hypothesis_id"]
        repro_path = base / "2330" / hid.lower() / "reproducibility_pack.json"
        if not repro_path.exists():
            continue
        repro = json.loads(repro_path.read_text())
        assert repro["safety_confirmations"].get("no_random_split") is True
        assert repro["safety_confirmations"].get("time_based_split_only") is True


# ── Test 12: eval_window returns DATA_INSUFFICIENT gracefully ─────────────────

def test_eval_window_data_insufficient_no_crash():
    """eval_window must not crash when rows < window_days."""
    rows = [{"date": f"2024-0{i+1}-01", "close": 100.0 + i,
              "open": 99.0, "high": 102.0, "low": 98.0, "volume": 1e6}
            for i in range(10)]   # only 10 rows
    result = eval_window(
        hid="STOCK_H001_20D_MOMENTUM",
        rows=rows,
        window_days=500,
        n_permutations=10,
        seed=42,
    )
    assert result.get("status") == DATA_INSUFFICIENT, (
        f"Expected DATA_INSUFFICIENT, got: {result}"
    )


def test_eval_window_unknown_hypothesis():
    """eval_window must not crash for unregistered hypothesis ID."""
    rows = [{"date": f"2024-01-{i+1:02d}", "close": 100.0 + i,
              "open": 99.0, "high": 102.0, "low": 98.0, "volume": 1e6}
            for i in range(30)]
    result = eval_window(
        hid="STOCK_H999_DOES_NOT_EXIST",
        rows=rows,
        window_days=30,
        n_permutations=5,
        seed=42,
    )
    assert result.get("status") == DATA_INSUFFICIENT


# ── Test 13: BH-FDR correction returns correct shape ─────────────────────────

def test_bh_fdr_correction_shape():
    """bh_fdr_correction must return same number of items as input."""
    tests = [
        {"hypothesis_id": "H1", "window_days": 150, "p_value": 0.01, "status": "OK"},
        {"hypothesis_id": "H1", "window_days": 500, "p_value": 0.50, "status": "OK"},
        {"hypothesis_id": "H2", "window_days": 150, "p_value": 0.03, "status": "OK"},
        {"hypothesis_id": "H2", "window_days": 500, "p_value": 0.80, "status": "OK"},
    ]
    results = bh_fdr_correction(tests, alpha=0.10)
    assert len(results) == len(tests)
    for r in results:
        assert "bh_fdr_q_value" in r
        assert "bh_fdr_pass" in r
        assert "raw_p_value" in r


def test_bh_fdr_correction_empty():
    """bh_fdr_correction must handle empty input without crashing."""
    assert bh_fdr_correction([], alpha=0.10) == []


def test_bh_fdr_correction_low_p_passes():
    """BH-FDR must flag low p-values as passing when below threshold."""
    tests = [{"p_value": 0.001, "status": "OK"} for _ in range(5)]
    results = bh_fdr_correction(tests, alpha=0.10)
    assert all(r["bh_fdr_pass"] for r in results), "All p=0.001 should pass BH-FDR"


# ── Test 14: Promotion gate rejects partial conditions ─────────────────────────

def test_promotion_gate_rejects_high_pvalue():
    """decide_promotion must reject when p_value >= 0.05 even with positive sharpe."""
    windows = [{
        "status": "OK", "window_days": 500,
        "roi_annualized": 0.10, "sharpe_annualized": 0.50,
        "p_value": 0.60,   # too high
        "bh_fdr_pass": False,
    }]
    result = decide_promotion(
        hid="H001", symbol="2330",
        window_results=windows,
        pit_passed=True, has_leakage=False,
        cross_symbol_count=3, cross_window_count=2,
    )
    assert result == "REJECTED"


def test_promotion_gate_rejects_leakage():
    """decide_promotion must reject if leakage detected."""
    windows = [{
        "status": "OK", "window_days": 500,
        "roi_annualized": 0.10, "sharpe_annualized": 1.0,
        "p_value": 0.01, "bh_fdr_pass": True,
    }]
    result = decide_promotion(
        hid="H001", symbol="2330",
        window_results=windows,
        pit_passed=True, has_leakage=True,   # leakage!
        cross_symbol_count=3, cross_window_count=2,
    )
    assert result == "REJECTED"


def test_promotion_gate_data_insufficient():
    """decide_promotion returns DATA_INSUFFICIENT when no valid windows."""
    result = decide_promotion(
        hid="H001", symbol="2330",
        window_results=[{"status": DATA_INSUFFICIENT, "window_days": 500}],
        pit_passed=True, has_leakage=False,
        cross_symbol_count=1, cross_window_count=1,
    )
    assert result == DATA_INSUFFICIENT


# ── Test 15: batch_summary.md is created ─────────────────────────────────────

def test_batch_summary_md_created():
    """batch_summary.md must be created and contain the final classification."""
    if not DB_PATH.exists():
        pytest.skip("prisma/dev.db not found")
    test_date = "2026-05-01"
    args = _make_argparse_ns(
        symbols="2330",
        as_of_date=test_date,
        min_rows=300,
        permutations=20,
        window_days=600,
    )
    run_batch_pipeline(args)

    md_path = OUTPUT_BATCH_BASE / test_date.replace("-", "") / "batch_summary.md"
    assert md_path.exists(), "batch_summary.md not created"
    content = md_path.read_text()
    assert "P3-07" in content
    assert "REAL_BATCH_EVALUATION" in content


# ── Test 16: missing DB handled gracefully ────────────────────────────────────

def test_select_symbols_missing_db():
    """select_symbols must return empty list if DB does not exist."""
    symbols = select_symbols(
        as_of_date="2026-01-01",
        db_path=Path("/nonexistent/path/missing.db"),
    )
    assert symbols == []
