"""
Real Stock Data Adapter for GBGF Validation Pipeline — P3-06.

Reads OHLCV data from the Stock-Prediction-System SQLite database (prisma/dev.db).
Enforces strict point-in-time safety: only returns rows where date <= asOfDate.

Features:
  - Reads from StockQuote table via sqlite3 (no external deps)
  - Filters to valid ISO-format dates (YYYY-MM-DD) only
  - Enforces asOfDate cutoff (R01)
  - Returns DATA_INSUFFICIENT if fewer than min_rows rows after filtering
  - Does NOT write to DB, does NOT call external APIs

Data source: prisma/dev.db (StockQuote table)
    - stockId: string (e.g. '2330')
    - date: string YYYY-MM-DD
    - open, high, low, close, volume: float

NOT a trading system. Read-only access. Not for production use.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .base import DomainAdapter
from .point_in_time_guard import PITCheckResult, PointInTimeGuard
from ..models import DomainType, StrategyState, BacktestResult


# Path to the project SQLite database
_DEFAULT_DB_PATH = Path(__file__).parent.parent.parent / "prisma" / "dev.db"

DATA_INSUFFICIENT = "DATA_INSUFFICIENT"
MIN_ROWS_DEFAULT = 120          # minimum trading days needed for any signal


class StockRealDomain(DomainAdapter):
    """
    Real stock data adapter: reads Taiwan stock OHLCV from StockQuote table.

    All data is filtered to date <= asOfDate before returning, ensuring
    strict point-in-time compliance.

    Args:
        symbol:       Taiwan stock ticker (e.g. '2330')
        as_of_date:   ISO date string (YYYY-MM-DD); only data before this date
                      is used. Defaults to today.
        window_days:  Maximum number of trading days to include (most recent).
                      None means all available days up to as_of_date.
        db_path:      Path to SQLite DB. Defaults to prisma/dev.db.
        min_rows:     Minimum rows needed; if fewer available, methods return
                      DATA_INSUFFICIENT without crashing.
    """

    PIT_RISKS = [
        "Data from prisma/dev.db — sync quality depends on data pipeline",
        "Survivorship bias possible: universe may not include delisted stocks",
        "Transaction cost: simplified model, slippage not included",
        "Date format: ISO YYYY-MM-DD only (non-ISO rows excluded)",
    ]

    def __init__(
        self,
        symbol: str = "2330",
        as_of_date: Optional[str] = None,
        window_days: Optional[int] = None,
        db_path: Optional[str] = None,
        min_rows: int = MIN_ROWS_DEFAULT,
    ):
        self.symbol = symbol
        self.as_of_date = as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.window_days = window_days
        self.db_path = Path(db_path) if db_path else _DEFAULT_DB_PATH
        self.min_rows = min_rows
        self._rows: Optional[List[Dict[str, Any]]] = None
        self._pit_result: Optional[PITCheckResult] = None
        self._pit_guard = PointInTimeGuard(as_of_date=self.as_of_date, forward_days=5)

    # ── DomainAdapter interface ────────────────────────────────────────────────

    def domain_type(self) -> DomainType:
        return DomainType.STOCK

    def validate_input_data(self, data: Any = None) -> Tuple[bool, str]:
        rows = self._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            return False, (
                f"StockRealDomain({self.symbol}): insufficient data. "
                f"Need >={self.min_rows} rows up to {self.as_of_date}. "
                f"Got {0 if not rows or rows == DATA_INSUFFICIENT else len(rows)} rows."
            )
        pit = self._pit_guard.check(rows)
        self._pit_result = pit
        if pit.has_leakage:
            violations = "; ".join(v.detail for v in pit.violations if v.severity == "blocking")
            return False, f"StockRealDomain({self.symbol}): PIT leakage detected: {violations}"
        symbols = {r["symbol"] for r in rows}
        n = len(rows) // max(len(symbols), 1)
        return True, (
            f"StockRealDomain({self.symbol}): {len(rows)} rows, "
            f"date range {pit.first_date_in_data} → {pit.max_date_in_data}, "
            f"asOfDate={self.as_of_date}. PIT check passed."
        )

    def get_prediction_target(self) -> str:
        return "next_5d_return_direction"

    def compute_oos_windows(self, data: Any = None) -> List[Dict]:
        rows = self._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            return [{"label": "unavailable", "status": DATA_INSUFFICIENT}]
        n = len(rows)
        oos_size = max(int(n * 0.20), 20)
        in_sample = n - oos_size
        return [
            {
                "label": f"real_{n}d_oos",
                "in_sample_size": in_sample,
                "oos_size": oos_size,
                "total_rows": n,
                "symbol": self.symbol,
                "as_of_date": self.as_of_date,
                "status": "REAL_DATA_TIME_SPLIT",
                "note": "Strict 80/20 temporal split. OOS = last 20% of rows by date.",
            }
        ]

    def compute_ev(self, state: StrategyState) -> Dict[str, Any]:
        import math
        rows = self._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            return {
                "classification": DATA_INSUFFICIENT,
                "status": DATA_INSUFFICIENT,
                "symbol": self.symbol,
                "as_of_date": self.as_of_date,
                "pit_risks": self.PIT_RISKS,
            }

        # Compute 20d momentum → next-5d return signals (real data)
        closes = [r["close"] for r in rows]
        lookback, forward = 20, 5
        tc = 10 / 10000.0

        if len(closes) < lookback + forward + 5:
            return {
                "classification": DATA_INSUFFICIENT,
                "status": "TOO_FEW_ROWS_FOR_SIGNAL",
                "n_rows": len(closes),
                "pit_risks": self.PIT_RISKS,
            }

        # OOS = last 20% of signals
        all_returns = []
        for i in range(lookback, len(closes) - forward):
            mom = (closes[i] - closes[i - lookback]) / closes[i - lookback]
            fwd = (closes[i + forward] - closes[i]) / closes[i]
            signal = 1 if mom > 0 else -1
            all_returns.append(fwd * signal - tc)

        oos_cutoff = int(len(all_returns) * 0.80)
        oos = all_returns[oos_cutoff:]

        if len(oos) < 5:
            return {
                "classification": DATA_INSUFFICIENT,
                "status": "INSUFFICIENT_OOS_SIGNALS",
                "n_oos": len(oos),
                "pit_risks": self.PIT_RISKS,
            }

        n = len(oos)
        mean_r = sum(oos) / n
        var_r = sum((r - mean_r) ** 2 for r in oos) / max(n - 1, 1)
        std_r = math.sqrt(var_r) if var_r > 0 else 1e-6
        sharpe = round((mean_r / std_r) * math.sqrt(252 / forward), 4)
        win_rate = round(sum(1 for r in oos if r > 0) / n, 4)
        cagr = round((1 + mean_r) ** (252 / forward) - 1, 4)

        if sharpe > 0.5:
            classification = "EV_POSITIVE"
        elif sharpe > 0:
            classification = "VALID_SIGNAL_NON_MONETIZABLE"
        else:
            classification = "EV_NEGATIVE_BY_DESIGN"

        return {
            "classification": classification,
            "sharpe_annualized": sharpe,
            "cagr_annualized": cagr,
            "win_rate": win_rate,
            "n_oos_signals": n,
            "transaction_cost_bps": 10,
            "symbol": self.symbol,
            "as_of_date": self.as_of_date,
            "real_data": True,
            "pit_risks": self.PIT_RISKS,
        }

    def detect_leakage(self, data_meta: Dict = None) -> Tuple[bool, str]:
        rows = self._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            return False, f"StockRealDomain({self.symbol}): no data to check leakage"

        pit = self._pit_guard.check(rows)
        self._pit_result = pit

        if pit.has_leakage:
            violations = "; ".join(v.detail for v in pit.violations if v.severity == "blocking")
            return False, f"PIT leakage: {violations}"

        warnings = [v.detail for v in pit.violations if v.severity == "warning"]
        note = (
            f"StockRealDomain({self.symbol}): PIT check passed. "
            f"max_date={pit.max_date_in_data} <= asOfDate={self.as_of_date}. "
            f"Rows: {pit.row_count}. "
            + (f"Warnings: {'; '.join(warnings)}" if warnings else "No warnings.")
        )
        return True, note

    def format_report_context(self, state: StrategyState) -> Dict[str, Any]:
        pit = self._pit_result
        return {
            "domain": "STOCK",
            "data_source": "real_sqlite",
            "symbol": self.symbol,
            "as_of_date": self.as_of_date,
            "pit_check": pit.to_dict() if pit else None,
            "pit_risks": self.PIT_RISKS,
            "warnings": [
                "Real data from prisma/dev.db — not independently audited",
                "Not a trading recommendation",
                "PIT compliance requires verified data pipeline",
            ],
        }

    # ── Data lineage export ────────────────────────────────────────────────────

    def get_data_lineage(self) -> Dict[str, Any]:
        """Return data lineage metadata for reproducibility pack."""
        rows = self._load_rows()
        if rows == DATA_INSUFFICIENT or not rows:
            return {
                "data_source": "sqlite:prisma/dev.db:StockQuote",
                "symbol": self.symbol,
                "asOfDate": self.as_of_date,
                "first_date": None,
                "last_date": None,
                "row_count": 0,
                "max_feature_date": None,
                "leakage_check_result": "DATA_INSUFFICIENT",
                "window_days": self.window_days,
            }

        pit = self._pit_result or self._pit_guard.check(rows)
        dates = sorted(r["date"] for r in rows)
        # max_feature_date: last date that can be used as feature input
        # = last date before forward_days from end
        forward = 5
        max_feature_date = dates[-(forward + 1)] if len(dates) > forward else dates[0]

        return {
            "data_source": "sqlite:prisma/dev.db:StockQuote",
            "symbol": self.symbol,
            "asOfDate": self.as_of_date,
            "first_date": pit.first_date_in_data,
            "last_date": pit.max_date_in_data,
            "row_count": len(rows),
            "max_feature_date": max_feature_date,
            "leakage_check_result": "PASS" if pit.passed else "FAIL",
            "pit_violations": [v.rule for v in pit.violations],
            "window_days": self.window_days,
        }

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _load_rows(self) -> List[Dict[str, Any]]:
        """Load and cache OHLCV rows from SQLite. Apply asOfDate PIT filter."""
        if self._rows is not None:
            return self._rows

        if not self.db_path.exists():
            self._rows = DATA_INSUFFICIENT
            return DATA_INSUFFICIENT

        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            # Only valid ISO-format dates; strict asOfDate cutoff
            cursor.execute(
                """
                SELECT date, open, high, low, close, volume
                FROM StockQuote
                WHERE stockId = ?
                  AND date LIKE '20%'
                  AND length(date) = 10
                  AND date <= ?
                ORDER BY date ASC
                """,
                (self.symbol, self.as_of_date),
            )
            raw = cursor.fetchall()
            conn.close()
        except sqlite3.Error as e:
            self._rows = DATA_INSUFFICIENT
            return DATA_INSUFFICIENT

        if not raw:
            self._rows = DATA_INSUFFICIENT
            return DATA_INSUFFICIENT

        all_rows = [
            {
                "symbol": self.symbol,
                "date": r[0],
                "open": float(r[1]),
                "high": float(r[2]),
                "low": float(r[3]),
                "close": float(r[4]),
                "volume": float(r[5]),
                "data_is_point_in_time": "true",
            }
            for r in raw
        ]

        # Apply window_days limit (most recent N rows)
        if self.window_days and len(all_rows) > self.window_days:
            all_rows = all_rows[-self.window_days:]

        if len(all_rows) < self.min_rows:
            self._rows = DATA_INSUFFICIENT
            return DATA_INSUFFICIENT

        self._rows = all_rows
        return self._rows
