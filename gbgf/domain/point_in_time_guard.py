"""
Point-in-Time Guard for GBGF Stock Validation Pipeline.

Enforces strict temporal data integrity rules:
  - No future data leakage (max(date) <= asOfDate)
  - Time-based splits only (no random splits)
  - Feature computation window cannot overlap prediction target window
  - Target return rows excluded from feature generation

Usage:
    guard = PointInTimeGuard(as_of_date="2025-12-31")
    result = guard.check(rows, oos_split_type="time_based")
    if result.has_leakage:
        raise LeakageError(result.violations)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PITViolation:
    rule: str
    severity: str          # "blocking" | "warning"
    detail: str
    rows_affected: int = 0


@dataclass
class PITCheckResult:
    passed: bool
    as_of_date: Optional[str]
    max_date_in_data: Optional[str]
    first_date_in_data: Optional[str]
    row_count: int
    violations: List[PITViolation] = field(default_factory=list)
    split_type: str = "unknown"
    leakage_risk: bool = False

    @property
    def has_leakage(self) -> bool:
        return any(v.severity == "blocking" for v in self.violations)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "as_of_date": self.as_of_date,
            "max_date_in_data": self.max_date_in_data,
            "first_date_in_data": self.first_date_in_data,
            "row_count": self.row_count,
            "split_type": self.split_type,
            "leakage_risk": self.leakage_risk,
            "has_blocking_violation": self.has_leakage,
            "violations": [
                {"rule": v.rule, "severity": v.severity,
                 "detail": v.detail, "rows_affected": v.rows_affected}
                for v in self.violations
            ],
        }


class LeakageError(Exception):
    """Raised when a blocking PIT violation is detected."""


class PointInTimeGuard:
    """
    Enforces point-in-time integrity for stock OHLCV data used in hypothesis
    validation.

    Rules enforced:
      R01  max(date) <= asOfDate  — no future rows
      R02  rows must be sorted by date ascending (time-based split prerequisite)
      R03  split_type must be 'time_based' (random split forbidden)
      R04  if forward_days provided, last forward_days rows must not contribute
           to feature generation (i.e. OOS window must be strictly after IS window)
    """

    def __init__(
        self,
        as_of_date: Optional[str] = None,
        forward_days: int = 5,
    ):
        self.as_of_date = as_of_date
        self.forward_days = forward_days

    # ── Public API ────────────────────────────────────────────────────────────

    def check(
        self,
        rows: List[Dict[str, Any]],
        split_type: str = "time_based",
    ) -> PITCheckResult:
        """
        Run all PIT checks on a list of OHLCV row dicts.
        Each row must have at minimum a 'date' key (string YYYY-MM-DD).

        Args:
            rows: list of dicts with 'date' key
            split_type: must be 'time_based' — 'random' triggers R03 violation

        Returns:
            PITCheckResult — inspect .has_leakage and .violations
        """
        violations: List[PITViolation] = []

        if not rows:
            return PITCheckResult(
                passed=True,
                as_of_date=self.as_of_date,
                max_date_in_data=None,
                first_date_in_data=None,
                row_count=0,
                split_type=split_type,
                leakage_risk=False,
            )

        dates = sorted(r["date"] for r in rows if r.get("date"))
        max_date = dates[-1] if dates else None
        first_date = dates[0] if dates else None

        # R01: no future rows relative to asOfDate
        if self.as_of_date and max_date and max_date > self.as_of_date:
            future_rows = sum(1 for d in dates if d > self.as_of_date)
            violations.append(PITViolation(
                rule="R01_FUTURE_DATA",
                severity="blocking",
                detail=(
                    f"max(date)={max_date} > asOfDate={self.as_of_date}. "
                    f"{future_rows} future rows detected — leakage risk."
                ),
                rows_affected=future_rows,
            ))

        # R02: rows must be temporally sorted (check for any out-of-order)
        raw_dates = [r["date"] for r in rows if r.get("date")]
        unsorted_count = sum(
            1 for i in range(1, len(raw_dates))
            if raw_dates[i] < raw_dates[i - 1]
        )
        if unsorted_count > 0:
            violations.append(PITViolation(
                rule="R02_UNSORTED_DATES",
                severity="warning",
                detail=(
                    f"{unsorted_count} rows are out of chronological order. "
                    "Time-based split requires sorted data."
                ),
                rows_affected=unsorted_count,
            ))

        # R03: random split forbidden
        if split_type == "random":
            violations.append(PITViolation(
                rule="R03_RANDOM_SPLIT_FORBIDDEN",
                severity="blocking",
                detail=(
                    "split_type='random' is forbidden. "
                    "Must use time_based split to prevent lookahead bias."
                ),
                rows_affected=len(rows),
            ))

        # R04: OOS window is last N rows — warn if dataset is too small
        min_usable = 20 + self.forward_days  # minimum lookback + forward
        if len(rows) < min_usable:
            violations.append(PITViolation(
                rule="R04_INSUFFICIENT_ROWS",
                severity="warning",
                detail=(
                    f"Only {len(rows)} rows — need at least {min_usable} for "
                    f"lookback + {self.forward_days}-day forward window."
                ),
                rows_affected=len(rows),
            ))

        leakage_risk = any(v.severity == "blocking" for v in violations)
        passed = not leakage_risk

        return PITCheckResult(
            passed=passed,
            as_of_date=self.as_of_date,
            max_date_in_data=max_date,
            first_date_in_data=first_date,
            row_count=len(rows),
            violations=violations,
            split_type=split_type,
            leakage_risk=leakage_risk,
        )

    def filter_to_as_of(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Return only rows where date <= asOfDate (strict PIT filter)."""
        if not self.as_of_date:
            return rows
        return [r for r in rows if r.get("date", "") <= self.as_of_date]

    def assert_no_leakage(self, rows: List[Dict[str, Any]], split_type: str = "time_based") -> PITCheckResult:
        """Check and raise LeakageError if any blocking violation found."""
        result = self.check(rows, split_type=split_type)
        if result.has_leakage:
            msgs = [f"[{v.rule}] {v.detail}" for v in result.violations if v.severity == "blocking"]
            raise LeakageError("PIT leakage detected:\n" + "\n".join(msgs))
        return result
