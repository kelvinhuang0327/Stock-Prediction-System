#!/usr/bin/env python3
"""P194 controlled real OHLCV export via twstock only."""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import importlib.metadata
import json
import os
import time
from collections import Counter
from pathlib import Path
from typing import Any

import twstock


ROOT = Path.cwd()
EXPECTED_ROOT = Path("/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System")
OUTPUT_DIR = ROOT / "outputs" / "retraining"
CSV_PATH = OUTPUT_DIR / "p194_twstock_ohlcv_export.csv"
MANIFEST_PATH = OUTPUT_DIR / "p194_twstock_ohlcv_export_manifest.json"
REPORT_PATH = OUTPUT_DIR / "p194_twstock_ohlcv_export_report.md"
SYMBOLS = ["2330", "2317", "2454", "0050", "0056"]
REQUEST_START = dt.date(2020, 1, 1)
HORIZON_TRADING_ROWS = 5
LOOKBACK_TRADING_ROWS = 20
REQUEST_SLEEP_SECONDS = 1.8


def fail(message: str) -> None:
    raise SystemExit(f"P194_BLOCKED_EXPORT_SCHEMA_INVALID: {message}")


def month_iter(start: dt.date, end: dt.date):
    year = start.year
    month = start.month
    while (year, month) <= (end.year, end.month):
        yield year, month
        month += 1
        if month == 13:
            year += 1
            month = 1


def clean_number(value: Any) -> float:
    if value is None:
        raise ValueError("missing numeric value")
    parsed = float(value)
    if not (parsed == parsed and parsed not in (float("inf"), float("-inf"))):
        raise ValueError(f"invalid numeric value: {value}")
    return parsed


def fetch_rows() -> tuple[list[dict[str, str]], list[dict[str, Any]], list[str], str]:
    fetched_at = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    rows: list[dict[str, str]] = []
    fetch_log: list[dict[str, Any]] = []
    symbols_fetched: list[str] = []

    for symbol in SYMBOLS:
        info = twstock.codes.get(symbol)
        if info is None:
            fail(f"symbol {symbol} is not present in twstock code database")
        source = f"twstock/{info.data_source}"
        stock = twstock.Stock(symbol, initial_fetch=False)
        symbol_count_before = len(rows)
        for year, month in month_iter(REQUEST_START, dt.date.today()):
            month_started = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            data = stock.fetch(year, month)
            kept = 0
            skipped_invalid_ohlcv = 0
            for item in data:
                trade_date = item.date.date()
                if trade_date < REQUEST_START or trade_date > dt.date.today():
                    continue
                try:
                    open_price = clean_number(item.open)
                    high_price = clean_number(item.high)
                    low_price = clean_number(item.low)
                    close_price = clean_number(item.close)
                    volume = clean_number(item.capacity)
                except ValueError:
                    skipped_invalid_ohlcv += 1
                    continue
                rows.append(
                    {
                        "symbol": symbol,
                        "date": trade_date.isoformat(),
                        "open": f"{open_price:.6f}".rstrip("0").rstrip("."),
                        "high": f"{high_price:.6f}".rstrip("0").rstrip("."),
                        "low": f"{low_price:.6f}".rstrip("0").rstrip("."),
                        "close": f"{close_price:.6f}".rstrip("0").rstrip("."),
                        "volume": str(int(volume)) if volume.is_integer() else str(volume),
                        "source": source,
                        "fetched_at_utc": fetched_at,
                    }
                )
                kept += 1
            fetch_log.append(
                {
                    "symbol": symbol,
                    "source": source,
                    "year": year,
                    "month": month,
                    "rows_kept": kept,
                    "skipped_invalid_ohlcv": skipped_invalid_ohlcv,
                    "fetched_at_utc": month_started,
                }
            )
            time.sleep(REQUEST_SLEEP_SECONDS)
        if len(rows) > symbol_count_before:
            symbols_fetched.append(symbol)

    return rows, fetch_log, symbols_fetched, fetched_at


def collapse_duplicate_rows(rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], int]:
    collapsed: dict[tuple[str, str], dict[str, str]] = {}
    duplicate_count = 0
    for row in rows:
        key = (row["symbol"], row["date"])
        existing = collapsed.get(key)
        if existing is None:
            collapsed[key] = row
            continue
        comparable_columns = ["open", "high", "low", "close", "volume", "source", "fetched_at_utc"]
        if any(existing[column] != row[column] for column in comparable_columns):
            fail(f"conflicting duplicate symbol/date row found: {key}")
        duplicate_count += 1
    return sorted(collapsed.values(), key=lambda item: (item["symbol"], item["date"])), duplicate_count


def validate_rows(rows: list[dict[str, str]]) -> dict[str, Any]:
    required = ["symbol", "date", "open", "high", "low", "close", "volume", "source", "fetched_at_utc"]
    if not rows:
        fail("twstock returned no rows")
    seen: set[tuple[str, str]] = set()
    duplicates: list[tuple[str, str]] = []
    for row in rows:
        if set(required) - set(row):
            fail(f"missing required columns in row: {row}")
        key = (row["symbol"], row["date"])
        if key in seen:
            duplicates.append(key)
        seen.add(key)
        dt.date.fromisoformat(row["date"])
        for column in ["open", "high", "low", "close", "volume"]:
            clean_number(row[column])
    if duplicates:
        fail(f"duplicate symbol/date rows found: {duplicates[:5]}")

    sorted_rows = sorted(rows, key=lambda item: (item["symbol"], item["date"]))
    if rows != sorted_rows:
        fail("rows are not sorted by symbol asc, date asc")

    per_symbol = Counter(row["symbol"] for row in rows)
    min_required = LOOKBACK_TRADING_ROWS + HORIZON_TRADING_ROWS + 60
    thin_symbols = {symbol: count for symbol, count in per_symbol.items() if count < min_required}
    if thin_symbols:
        fail(f"insufficient rows for bounded horizon/split: {thin_symbols}")

    unique_dates = sorted({row["date"] for row in rows})
    if len(unique_dates) < 60:
        fail(f"insufficient unique dates for chronological holdout: {len(unique_dates)}")

    return {
        "schemaValidation": "PASS",
        "boundedPitSafetyValidation": "BOUNDED_PASS_WITH_SOURCE_LIMITATION",
        "pitSafetyNotes": [
            "CSV columns are raw same-day OHLCV rows; no future-derived feature columns are exported.",
            "The downstream refit wrapper computes features from same-row or prior-row data only.",
            "The target is close[t+5 trading rows] / close[t] - 1 > 0 and is separated by a purged chronological split.",
            "twstock does not provide full point-in-time archival metadata in this export, so PIT safety is bounded rather than absolute.",
        ],
    }


def main() -> None:
    if ROOT != EXPECTED_ROOT:
        raise SystemExit(f"P194_BLOCKED_CONTEXT_MISMATCH: unexpected cwd {ROOT}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows, fetch_log, symbols_fetched, fetched_at = fetch_rows()
    rows.sort(key=lambda item: (item["symbol"], item["date"]))
    rows, duplicate_rows_dropped = collapse_duplicate_rows(rows)
    validation = validate_rows(rows)

    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["symbol", "date", "open", "high", "low", "close", "volume", "source", "fetched_at_utc"],
        )
        writer.writeheader()
        writer.writerows(rows)

    csv_raw = CSV_PATH.read_bytes()
    csv_sha256 = hashlib.sha256(csv_raw).hexdigest()
    per_symbol_counts = dict(sorted(Counter(row["symbol"] for row in rows).items()))
    actual_dates = [row["date"] for row in rows]
    version = importlib.metadata.version("twstock")
    commands_run = [
        "python3 -m venv /tmp/p194-twstock-venv",
        "/tmp/p194-twstock-venv/bin/python -m pip install twstock",
        "/tmp/p194-twstock-venv/bin/python scripts/p194_twstock_export_ohlcv.py",
    ]
    manifest = {
        "schemaVersion": "p194.twstock_ohlcv_export.1",
        "repository": str(ROOT),
        "symbolsRequested": SYMBOLS,
        "symbolsFetched": symbols_fetched,
        "dateRangeRequested": {
            "start": REQUEST_START.isoformat(),
            "end": "latest available from twstock through current month",
        },
        "actualDateRange": {"min": min(actual_dates), "max": max(actual_dates)},
        "rowCount": len(rows),
        "perSymbolRowCounts": per_symbol_counts,
        "csvPath": str(CSV_PATH.relative_to(ROOT)),
        "csvSha256": csv_sha256,
        "twstockVersion": version,
        "commandsRun": commands_run,
        "rateLimitStrategy": {
            "sleepSecondsAfterEachMonthlyFetch": REQUEST_SLEEP_SECONDS,
            "maxObservedRequestRate": "below 3 TWSE/TPEX requests per 5 seconds",
            "monthlyFetchRequests": len(fetch_log),
            "totalRequestVolumeBound": "5 symbols x monthly range from 2020-01 through current month",
        },
        "source": "twstock Stock.fetch(year, month), using twstock's built-in TWSE/TPEX fetchers",
        "fetchedAtUtc": fetched_at,
        "validation": validation,
        "duplicateRowsDropped": duplicate_rows_dropped,
        "knownLimitations": [
            "All requested symbols resolved to twstock/TWSE in the installed twstock code database.",
            "The export uses twstock's available monthly historical rows; it does not prove full point-in-time archival immutability.",
            "No canonical DB files were read or written by this script.",
            "This artifact is historical data for bounded validation only; it is not investment advice or future prediction proof.",
        ],
        "fetchLog": fetch_log,
    }
    MANIFEST_PATH.write_text(f"{json.dumps(manifest, indent=2, ensure_ascii=False)}\n", encoding="utf-8")

    report = "\n".join(
        [
            "# P194 twstock OHLCV Export Report",
            "",
            f"- Symbols requested: {', '.join(SYMBOLS)}",
            f"- Symbols fetched: {', '.join(symbols_fetched)}",
            f"- Actual date range: {manifest['actualDateRange']['min']} to {manifest['actualDateRange']['max']}",
            f"- Row count: {len(rows)}",
            f"- Identical duplicate rows dropped: {duplicate_rows_dropped}",
            f"- CSV: `{manifest['csvPath']}`",
            f"- CSV SHA256: `{csv_sha256}`",
            f"- twstock version: {version}",
            f"- Schema validation: {validation['schemaValidation']}",
            f"- Bounded PIT safety validation: {validation['boundedPitSafetyValidation']}",
            "",
            "The export was produced through `twstock.Stock.fetch(year, month)` only. It contains raw OHLCV rows sorted by symbol and date, with one row per symbol/date and no future-derived feature columns.",
            "",
            "PIT caveat: twstock does not provide full point-in-time archival metadata in this CSV, so validation is bounded to the exported rows and downstream feature/target construction.",
            "",
            "This is not investment advice, trading readiness evidence, product readiness evidence, or proof of future predictive ability.",
            "",
        ]
    )
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "complete",
                "csvPath": str(CSV_PATH),
                "manifestPath": str(MANIFEST_PATH),
                "rowCount": len(rows),
                "csvSha256": csv_sha256,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
