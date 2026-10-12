"""
tests/test_stock_features.py
P3-08: Tests for gbgf/domain/stock_features.py — PIT-safe feature builder.
"""
import pytest
from datetime import date, timedelta
from gbgf.domain.stock_features import (
    return_nd,
    ma_nd,
    volatility_nd,
    volume_zscore_nd,
    drawdown_nd,
    breakout_nd_high,
    universe_relative_strength,
    compute_features_for_rows,
    compute_universe_median_returns,
)


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_rows(n: int, base_close: float = 100.0, symbol: str = "T001",
               start_date: str = "2024-01-02") -> list:
    rows = []
    d = date.fromisoformat(start_date)
    c = base_close
    for i in range(n):
        rows.append({
            "date": d.isoformat(),
            "symbol": symbol,
            "open": c * 0.99,
            "high": c * 1.01,
            "low": c * 0.98,
            "close": c,
            "volume": 1000 + i * 10,
        })
        c = c * 1.001          # gentle upward drift
        d += timedelta(days=1)
        if d.weekday() >= 5:   # skip weekends
            d += timedelta(days=2)
    return rows


# ── return_nd ─────────────────────────────────────────────────────────────────
# The primitive functions (return_nd, ma_nd, etc.) take (rows, i, n) and
# return the value AT index i. compute_features_for_rows is the bulk wrapper.

def test_return_nd_basic():
    rows = _make_rows(30)
    # insufficient history → None
    assert return_nd(rows, 3, 5) is None
    # sufficient history → float
    v = return_nd(rows, 10, 5)
    assert v is not None and isinstance(v, float)


def test_return_nd_no_future_leak():
    """return_nd(rows, i, n) must use only rows up to i."""
    rows = _make_rows(30)
    val = return_nd(rows, 10, 5)
    rows[25]["close"] = 9999.0   # future row — must not affect index 10
    assert return_nd(rows, 10, 5) == pytest.approx(val)


def test_return_nd_pit_safe():
    rows = _make_rows(20)
    val = return_nd(rows, 15, 5)
    rows[19]["close"] = 0.001    # future row
    assert return_nd(rows, 15, 5) == pytest.approx(val)


# ── ma_nd ─────────────────────────────────────────────────────────────────────

def test_ma_nd_basic():
    rows = _make_rows(30)
    assert ma_nd(rows, 5, 20) is None        # not enough history
    v = ma_nd(rows, 25, 20)
    assert isinstance(v, float) and v > 0


def test_ma_nd_no_future_data():
    rows = _make_rows(30)
    val = ma_nd(rows, 22, 20)
    rows[29]["close"] = 99999.0
    assert ma_nd(rows, 22, 20) == pytest.approx(val)


# ── volatility_nd ─────────────────────────────────────────────────────────────

def test_volatility_nd_returns_positive():
    rows = _make_rows(30)
    v = volatility_nd(rows, 25, 20)
    assert v is not None and v >= 0.0


def test_volatility_nd_pit_safe():
    rows = _make_rows(30)
    val = volatility_nd(rows, 25, 20)
    rows[29]["close"] = 0.001
    assert volatility_nd(rows, 25, 20) == pytest.approx(val)


# ── volume_zscore_nd ──────────────────────────────────────────────────────────

def test_volume_zscore_nd_basic():
    rows = _make_rows(30)
    assert volume_zscore_nd(rows, 5, 20) is None
    v = volume_zscore_nd(rows, 25, 20)
    assert isinstance(v, float)


def test_volume_zscore_nd_no_future():
    rows = _make_rows(30)
    val = volume_zscore_nd(rows, 22, 20)
    rows[29]["volume"] = 999999
    assert volume_zscore_nd(rows, 22, 20) == pytest.approx(val)


# ── drawdown_nd ───────────────────────────────────────────────────────────────

def test_drawdown_nd_non_positive():
    rows = _make_rows(30)
    v = drawdown_nd(rows, 25, 20)
    assert v is not None and v <= 0.0


def test_drawdown_nd_pit_safe():
    rows = _make_rows(30)
    val = drawdown_nd(rows, 22, 20)
    rows[29]["close"] = 9999.0
    assert drawdown_nd(rows, 22, 20) == pytest.approx(val)


# ── breakout_nd_high ──────────────────────────────────────────────────────────

def test_breakout_nd_high_boolean():
    rows = _make_rows(30)
    v = breakout_nd_high(rows, 25, 20)
    assert isinstance(v, bool)


def test_breakout_nd_high_spike():
    rows = _make_rows(30)
    rows[25]["close"] = 9999.0
    rows[25]["high"] = 9999.0
    assert breakout_nd_high(rows, 25, 20) is True


def test_breakout_nd_high_pit_safe():
    rows = _make_rows(30)
    val = breakout_nd_high(rows, 22, 20)
    rows[29]["close"] = 9999.0
    assert breakout_nd_high(rows, 22, 20) == val


# ── universe_relative_strength ────────────────────────────────────────────────

def test_universe_relative_strength_basic():
    rows = _make_rows(30, base_close=100.0)
    median = {r["date"]: 0.001 for r in rows}
    assert universe_relative_strength(rows, 5, 20, universe_median_returns=median) is None
    v = universe_relative_strength(rows, 25, 20, universe_median_returns=median)
    assert isinstance(v, float)


def test_universe_relative_strength_no_future():
    rows = _make_rows(30)
    median = {r["date"]: 0.0 for r in rows}
    val = universe_relative_strength(rows, 22, 20, universe_median_returns=median)
    rows[29]["close"] = 9999.0
    assert universe_relative_strength(rows, 22, 20,
                                      universe_median_returns=median) == pytest.approx(val)


def test_universe_relative_strength_missing_median():
    """If median not available for a date, should return None (not crash)."""
    rows = _make_rows(30)
    v = universe_relative_strength(rows, 25, 20, universe_median_returns={})
    assert v is None


# ── compute_universe_median_returns ───────────────────────────────────────────

def test_compute_universe_median_no_future():
    """Universe median must only use dates <= as_of_date."""
    as_of = "2024-02-15"
    rows_a = _make_rows(40, symbol="A", start_date="2024-01-02")
    rows_b = _make_rows(40, symbol="B", start_date="2024-01-02", base_close=200.0)
    all_rows = {"A": rows_a, "B": rows_b}
    medians = compute_universe_median_returns(all_rows, lookback=20, as_of_date=as_of)
    for d_str in medians:
        assert d_str <= as_of


def test_compute_universe_median_requires_two_symbols():
    """Median should only appear where >= 2 symbols have valid returns."""
    rows_a = _make_rows(40, symbol="A")
    all_rows = {"A": rows_a}
    medians = compute_universe_median_returns(all_rows, lookback=20, as_of_date="2099-01-01")
    # Single symbol — no median should be produced
    assert len(medians) == 0


def test_compute_universe_median_values_are_floats():
    rows_a = _make_rows(40, symbol="A", start_date="2024-01-02")
    rows_b = _make_rows(40, symbol="B", start_date="2024-01-02", base_close=200.0)
    all_rows = {"A": rows_a, "B": rows_b}
    medians = compute_universe_median_returns(all_rows, lookback=20, as_of_date="2099-01-01")
    for v in medians.values():
        assert isinstance(v, float)


# ── compute_features_for_rows ─────────────────────────────────────────────────

def test_compute_features_for_rows_basic():
    rows = _make_rows(40)
    features = compute_features_for_rows(rows, feature_names=["return_20d", "ma20", "volatility_20d"])
    assert len(features) == len(rows)
    for i, f in enumerate(features):
        assert "return_20d" in f
        assert "ma20" in f
        assert "volatility_20d" in f


def test_compute_features_no_target_return():
    """Features at index i must not include the return that will be the forward target."""
    rows = _make_rows(40)
    features = compute_features_for_rows(rows, feature_names=["return_20d"])
    # The 20d return at each row only depends on 20 historical closes — not futures
    val_at_25 = features[25]["return_20d"]
    rows[35]["close"] = 9999.0
    new_features = compute_features_for_rows(rows, feature_names=["return_20d"])
    assert new_features[25]["return_20d"] == pytest.approx(val_at_25)


def test_compute_features_volume_zscore():
    rows = _make_rows(40)
    features = compute_features_for_rows(rows, feature_names=["volume_zscore_20d"])
    for f in features[20:]:
        assert f["volume_zscore_20d"] is not None


def test_compute_features_drawdown():
    rows = _make_rows(40)
    features = compute_features_for_rows(rows, feature_names=["drawdown_20d"])
    for f in features[20:]:
        assert f["drawdown_20d"] is not None
        assert f["drawdown_20d"] <= 0.0


def test_compute_features_all_nine():
    rows = _make_rows(80)
    feature_names = [
        "return_5d", "return_20d", "ma20", "ma60",
        "volatility_20d", "volume_zscore_20d",
        "drawdown_20d", "breakout_20d_high",
    ]
    features = compute_features_for_rows(rows, feature_names=feature_names)
    assert len(features) == len(rows)
    for f in features:
        for fn in feature_names:
            assert fn in f


def test_compute_features_universe_relative_strength():
    rows = _make_rows(40, symbol="T001")
    median = {r["date"]: 0.0 for r in rows}
    features = compute_features_for_rows(
        rows,
        feature_names=["universe_relative_strength"],
        universe_median_returns=median,
    )
    for f in features[20:]:
        assert "universe_relative_strength" in f


def test_compute_features_empty_rows():
    """Should not crash on empty input."""
    features = compute_features_for_rows([], feature_names=["return_20d"])
    assert features == []
