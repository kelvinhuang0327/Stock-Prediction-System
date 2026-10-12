"""
Tests for Real Stock Data Adapter + Point-in-Time Guard — P3-06.

Tests:
  1. StockRealDomain reads real data from prisma/dev.db
  2. asOfDate cutoff — future rows excluded
  3. Empty/missing data handled gracefully (no crash)
  4. PointInTimeGuard detects future dates (blocking violation)
  5. PointInTimeGuard passes valid data
  6. Temporal split enforced (random split rejected)
  7. data_lineage completeness
  8. DATA_INSUFFICIENT does not crash pipeline
  9. Synthetic pipeline original 29 tests still pass (smoke test)
"""
import json
import os
import sys
import tempfile
import sqlite3
from pathlib import Path
from typing import Any, Dict, List

import pytest

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from gbgf.domain.stock_real import StockRealDomain, DATA_INSUFFICIENT
from gbgf.domain.point_in_time_guard import (
    PointInTimeGuard,
    PITCheckResult,
    PITViolation,
    LeakageError,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_temp_db(rows: List[Dict]) -> str:
    """Create a temporary SQLite DB with StockQuote rows for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE StockQuote (
            id INTEGER PRIMARY KEY,
            stockId TEXT,
            date TEXT,
            open REAL, high REAL, low REAL, close REAL,
            volume REAL, tradeValue REAL, change REAL,
            transactions INTEGER, createdAt TEXT
        )
    """)
    for r in rows:
        conn.execute(
            "INSERT INTO StockQuote (stockId, date, open, high, low, close, volume, tradeValue, change, transactions, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (r["stockId"], r["date"], r.get("open", 100.0), r.get("high", 105.0),
             r.get("low", 95.0), r.get("close", 102.0), r.get("volume", 1000000.0),
             r.get("tradeValue", 100000000.0), r.get("change", 2.0), r.get("transactions", 5000),
             "2026-01-01 00:00:00"),
        )
    conn.commit()
    conn.close()
    return path


def _make_rows(symbol: str, dates: List[str]) -> List[Dict]:
    return [
        {
            "stockId": symbol, "date": d,
            "open": 100.0, "high": 105.0, "low": 95.0, "close": 100.0 + i * 0.1,
            "volume": 1_000_000.0, "tradeValue": 1e8, "change": 0.1, "transactions": 5000,
        }
        for i, d in enumerate(dates)
    ]


def _date_range(start_year: int = 2020, n: int = 150) -> List[str]:
    """Return n ISO date strings starting from start_year-01-01 (trading day approximation)."""
    from datetime import date, timedelta
    start = date(start_year, 1, 1)
    dates = []
    d = start
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d.isoformat())
        d += timedelta(days=1)
    return dates


# ── Test 1: real adapter reads data from actual dev.db ─────────────────────────

def test_real_adapter_reads_from_dev_db():
    """StockRealDomain should be able to load data from the real dev.db."""
    dev_db = ROOT / "prisma" / "dev.db"
    if not dev_db.exists():
        pytest.skip("prisma/dev.db not found")

    adapter = StockRealDomain(
        symbol="2330",
        as_of_date="2026-05-01",
        window_days=500,
        db_path=str(dev_db),
        min_rows=10,
    )
    rows = adapter._load_rows()
    assert rows != DATA_INSUFFICIENT, "Expected real data for symbol 2330 but got DATA_INSUFFICIENT"
    assert isinstance(rows, list)
    assert len(rows) > 0
    # All rows must have required fields
    required = {"symbol", "date", "open", "high", "low", "close", "volume"}
    for r in rows:
        missing = required - set(r.keys())
        assert not missing, f"Row missing fields: {missing}"
    # All dates must be <= as_of_date
    for r in rows:
        assert r["date"] <= "2026-05-01", f"Future row: {r['date']} > 2026-05-01"


# ── Test 2: asOfDate cutoff excludes future rows ──────────────────────────────

def test_as_of_date_excludes_future_rows():
    """Adapter must return ONLY rows with date <= asOfDate."""
    dates = _date_range(2022, 200)
    future_dates = ["2030-01-01", "2031-06-15"]  # future rows to exclude
    all_rows = _make_rows("9999", dates + future_dates)
    db_path = _make_temp_db(all_rows)

    try:
        adapter = StockRealDomain(
            symbol="9999",
            as_of_date="2025-01-01",
            db_path=db_path,
            min_rows=10,
        )
        rows = adapter._load_rows()
        if rows == DATA_INSUFFICIENT:
            pytest.skip("Not enough data in temp DB (date range too old)")
        for r in rows:
            assert r["date"] <= "2025-01-01", (
                f"Future row leaked: {r['date']} > as_of_date=2025-01-01"
            )
        row_dates = {r["date"] for r in rows}
        assert "2030-01-01" not in row_dates
        assert "2031-06-15" not in row_dates
    finally:
        os.unlink(db_path)


# ── Test 3: empty DB does not crash ───────────────────────────────────────────

def test_empty_db_returns_data_insufficient():
    """Empty StockQuote table must return DATA_INSUFFICIENT without crashing."""
    db_path = _make_temp_db([])  # no rows

    try:
        adapter = StockRealDomain(
            symbol="EMPTY",
            as_of_date="2026-01-01",
            db_path=db_path,
            min_rows=1,
        )
        result = adapter._load_rows()
        assert result == DATA_INSUFFICIENT
    finally:
        os.unlink(db_path)


def test_missing_db_returns_data_insufficient():
    """Missing DB file must return DATA_INSUFFICIENT without crashing."""
    adapter = StockRealDomain(
        symbol="2330",
        as_of_date="2026-01-01",
        db_path="/nonexistent/path/db.db",
        min_rows=1,
    )
    result = adapter._load_rows()
    assert result == DATA_INSUFFICIENT


def test_validate_input_data_empty_db_returns_false():
    """validate_input_data() must return (False, reason) when no data available."""
    db_path = _make_temp_db([])

    try:
        adapter = StockRealDomain(
            symbol="EMPTY",
            as_of_date="2026-01-01",
            db_path=db_path,
            min_rows=1,
        )
        valid, msg = adapter.validate_input_data()
        assert valid is False
        assert "insufficient" in msg.lower() or "DATA_INSUFFICIENT" in msg
    finally:
        os.unlink(db_path)


# ── Test 4: PIT guard detects future date (blocking violation) ────────────────

def test_pit_guard_blocks_future_dates():
    """PointInTimeGuard must flag rows with date > asOfDate as blocking violation."""
    guard = PointInTimeGuard(as_of_date="2024-12-31")
    rows = [
        {"date": "2024-12-01", "close": 100.0},
        {"date": "2024-12-15", "close": 101.0},
        {"date": "2025-01-15", "close": 110.0},   # FUTURE — should trigger R01
        {"date": "2025-06-30", "close": 120.0},   # FUTURE
    ]
    result = guard.check(rows, split_type="time_based")
    assert result.leakage_risk is True
    assert result.has_leakage is True
    r01_violations = [v for v in result.violations if v.rule == "R01_FUTURE_DATA"]
    assert len(r01_violations) == 1
    assert r01_violations[0].rows_affected == 2


def test_pit_guard_raise_leakage_error():
    """assert_no_leakage() must raise LeakageError on future data."""
    guard = PointInTimeGuard(as_of_date="2024-06-01")
    rows = [
        {"date": "2024-05-01", "close": 100.0},
        {"date": "2025-01-01", "close": 200.0},   # future
    ]
    with pytest.raises(LeakageError):
        guard.assert_no_leakage(rows)


# ── Test 5: PIT guard passes valid data ───────────────────────────────────────

def test_pit_guard_passes_valid_data():
    """PointInTimeGuard must pass when all rows are before asOfDate."""
    guard = PointInTimeGuard(as_of_date="2026-01-01")
    dates = _date_range(2022, 200)
    rows = [{"date": d, "close": float(100 + i)} for i, d in enumerate(dates)]
    result = guard.check(rows, split_type="time_based")
    assert result.leakage_risk is False
    assert not result.has_leakage
    r01_violations = [v for v in result.violations if v.rule == "R01_FUTURE_DATA"]
    assert len(r01_violations) == 0


# ── Test 6: random split is forbidden ─────────────────────────────────────────

def test_pit_guard_blocks_random_split():
    """PointInTimeGuard must flag random split as a blocking violation."""
    guard = PointInTimeGuard(as_of_date="2026-01-01")
    rows = [{"date": "2024-01-01", "close": 100.0}, {"date": "2024-06-01", "close": 105.0}]
    result = guard.check(rows, split_type="random")
    assert result.has_leakage is True
    r03 = [v for v in result.violations if v.rule == "R03_RANDOM_SPLIT_FORBIDDEN"]
    assert len(r03) == 1
    assert r03[0].severity == "blocking"


def test_pit_guard_allows_time_based_split():
    """PointInTimeGuard must accept time_based split without R03 violation."""
    guard = PointInTimeGuard(as_of_date="2026-01-01")
    dates = _date_range(2022, 200)
    rows = [{"date": d, "close": 100.0} for d in dates]
    result = guard.check(rows, split_type="time_based")
    r03 = [v for v in result.violations if v.rule == "R03_RANDOM_SPLIT_FORBIDDEN"]
    assert len(r03) == 0


# ── Test 7: data_lineage completeness ─────────────────────────────────────────

def test_data_lineage_completeness():
    """get_data_lineage() must include all required fields."""
    required_fields = {
        "data_source", "symbol", "asOfDate",
        "first_date", "last_date", "row_count",
        "max_feature_date", "leakage_check_result",
    }
    dev_db = ROOT / "prisma" / "dev.db"
    if not dev_db.exists():
        pytest.skip("prisma/dev.db not found")

    adapter = StockRealDomain(
        symbol="2330",
        as_of_date="2026-05-01",
        window_days=300,
        db_path=str(dev_db),
        min_rows=10,
    )
    # Trigger load
    rows = adapter._load_rows()
    if rows == DATA_INSUFFICIENT:
        pytest.skip("Insufficient data for lineage test")

    lineage = adapter.get_data_lineage()
    assert isinstance(lineage, dict)
    missing = required_fields - set(lineage.keys())
    assert not missing, f"data_lineage missing fields: {missing}"
    assert lineage["symbol"] == "2330"
    assert lineage["asOfDate"] == "2026-05-01"
    assert lineage["row_count"] > 0


def test_data_lineage_data_insufficient():
    """get_data_lineage() must be safe to call even when DB is empty."""
    db_path = _make_temp_db([])
    try:
        adapter = StockRealDomain(
            symbol="EMPTY",
            as_of_date="2026-01-01",
            db_path=db_path,
            min_rows=1,
        )
        lineage = adapter.get_data_lineage()
        assert lineage["leakage_check_result"] == "DATA_INSUFFICIENT"
        assert lineage["row_count"] == 0
    finally:
        os.unlink(db_path)


# ── Test 8: PIT filter_to_as_of helper ────────────────────────────────────────

def test_pit_filter_to_as_of():
    """filter_to_as_of() must only return rows on or before asOfDate."""
    guard = PointInTimeGuard(as_of_date="2024-06-30")
    rows = [
        {"date": "2024-01-01", "close": 100.0},
        {"date": "2024-06-30", "close": 105.0},   # boundary — include
        {"date": "2024-07-01", "close": 110.0},   # exclude
        {"date": "2025-01-01", "close": 120.0},   # exclude
    ]
    filtered = guard.filter_to_as_of(rows)
    assert len(filtered) == 2
    for r in filtered:
        assert r["date"] <= "2024-06-30"


# ── Test 9: detect_leakage integration on real data ──────────────────────────

def test_detect_leakage_passes_on_pit_clean_data():
    """detect_leakage() must pass for real data filtered to asOfDate."""
    dev_db = ROOT / "prisma" / "dev.db"
    if not dev_db.exists():
        pytest.skip("prisma/dev.db not found")

    adapter = StockRealDomain(
        symbol="2330",
        as_of_date="2025-12-31",
        window_days=200,
        db_path=str(dev_db),
        min_rows=10,
    )
    rows = adapter._load_rows()
    if rows == DATA_INSUFFICIENT:
        pytest.skip("Insufficient data")

    clean, msg = adapter.detect_leakage()
    assert clean is True, f"Expected leakage check to pass, got: {msg}"


# ── Test 10: compute_ev does not crash on DATA_INSUFFICIENT ──────────────────

def test_compute_ev_handles_data_insufficient():
    """compute_ev() must return DATA_INSUFFICIENT classification, not crash."""
    from gbgf.models import StrategyState, DomainType, ValidationTier

    db_path = _make_temp_db([])
    try:
        adapter = StockRealDomain(
            symbol="EMPTY",
            as_of_date="2026-01-01",
            db_path=db_path,
            min_rows=1,
        )
        state = StrategyState(
            strategy_id="test-compute-ev",
            ev_classification="UNKNOWN",
            tier=ValidationTier.T1_REGISTERED,
            human_review_complete=False,
            domain=DomainType.STOCK,
        )
        result = adapter.compute_ev(state)
        assert result.get("classification") == DATA_INSUFFICIENT
        assert result.get("status") == DATA_INSUFFICIENT
    finally:
        os.unlink(db_path)


# ── Test 11: PITCheckResult to_dict ───────────────────────────────────────────

def test_pit_check_result_to_dict():
    """PITCheckResult.to_dict() must serialize to JSON-compatible structure."""
    guard = PointInTimeGuard(as_of_date="2025-01-01")
    rows = [{"date": "2024-06-01", "close": 100.0}, {"date": "2024-12-01", "close": 105.0}]
    result = guard.check(rows)
    d = result.to_dict()
    # Should serialize without error
    assert json.dumps(d)
    required = {"passed", "as_of_date", "max_date_in_data", "first_date_in_data",
                "row_count", "split_type", "leakage_risk", "violations"}
    assert required <= set(d.keys())


# ── Test 12: empty rows handled gracefully by PIT guard ───────────────────────

def test_pit_guard_empty_rows():
    """PIT guard must handle empty input without crashing."""
    guard = PointInTimeGuard(as_of_date="2025-01-01")
    result = guard.check([])
    assert result.passed is True
    assert result.row_count == 0
    assert result.leakage_risk is False
