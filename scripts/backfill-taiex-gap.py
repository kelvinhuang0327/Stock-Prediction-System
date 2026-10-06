#!/usr/bin/env python3
"""
P4-03b TAIEX Gap Backfill Script
==================================
Fetches TAIEX data from TWSE FMTQIK endpoint and inserts missing rows
into MarketIndex table in prisma/dev.db.

Safety:
- Default: --dry-run (no writes)
- Only --apply writes to local dev.db
- Only modifies MarketIndex WHERE name='TAIEX'
- Never deletes data
- Never modifies StockQuote
- Uses ISO YYYY-MM-DD dates only
- No LLM-invented data; no forward-fill of future data
- No paid API
"""

import argparse
import json
import sqlite3
import ssl
import sys
import urllib.request
from datetime import date, datetime, timedelta

DB_PATH = "prisma/dev.db"
TWSE_URL = "https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?response=json"


def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def get_taiex_existing(conn):
    rows = conn.execute(
        "SELECT date, value FROM MarketIndex WHERE name='TAIEX' ORDER BY date DESC LIMIT 30"
    ).fetchall()
    return {r[0]: r[1] for r in rows}


def fetch_twse_taiex_recent():
    """Fetch recent TAIEX monthly data from TWSE FMTQIK endpoint."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; StockDataBackfill/1.0)",
        "Accept": "application/json",
    }

    # Fetch last 2 months to cover gap
    results = {}
    today = date.today()
    months_to_fetch = set()
    for delta_months in range(0, 3):
        yr = today.year
        mo = today.month - delta_months
        while mo <= 0:
            mo += 12
            yr -= 1
        months_to_fetch.add((yr, mo))

    for (yr, mo) in sorted(months_to_fetch):
        url = f"https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date={yr}{mo:02d}01&response=json"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("stat") != "OK":
                print(f"  WARN: TWSE returned stat={data.get('stat')} for {yr}/{mo:02d}")
                continue

            # Parse rows: date(ROC), open, high, low, close, volume
            for row in data.get("data", []):
                try:
                    roc_date = row[0].strip()  # e.g. "115/05/06"
                    close_str = row[4].replace(",", "").strip()
                    parts = roc_date.split("/")
                    if len(parts) != 3:
                        continue
                    iso_yr = int(parts[0]) + 1911
                    iso_mo = int(parts[1])
                    iso_day = int(parts[2])
                    iso_date = f"{iso_yr:04d}-{iso_mo:02d}-{iso_day:02d}"
                    close_val = float(close_str)
                    results[iso_date] = close_val
                except Exception:
                    continue
            print(f"  TWSE {yr}/{mo:02d}: fetched {len(data.get('data', []))} rows")
        except Exception as e:
            print(f"  ERROR fetching {yr}/{mo:02d}: {e}")
            return None, str(e)

    return results, None


def get_stockquote_max(conn):
    row = conn.execute("SELECT MAX(date) FROM StockQuote").fetchone()
    return row[0] if row else None


def run(dry_run, start_date_str, end_date_str):
    conn = get_db_conn()

    sq_max = get_stockquote_max(conn)
    existing = get_taiex_existing(conn)
    taiex_max = conn.execute(
        "SELECT MAX(date) FROM MarketIndex WHERE name='TAIEX'"
    ).fetchone()[0]
    taiex_count = conn.execute(
        "SELECT COUNT(*) FROM MarketIndex WHERE name='TAIEX'"
    ).fetchone()[0]

    print(f"DB: {DB_PATH}")
    print(f"TAIEX current max date: {taiex_max}")
    print(f"TAIEX current row count: {taiex_count}")
    print(f"StockQuote max date: {sq_max}")

    # Determine gap range
    if start_date_str:
        gap_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    else:
        gap_start = datetime.strptime(taiex_max, "%Y-%m-%d").date() + timedelta(days=1)

    if end_date_str:
        gap_end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    else:
        gap_end = datetime.strptime(sq_max, "%Y-%m-%d").date()

    today = date.today()
    if gap_end > today:
        print(f"WARN: gap_end {gap_end} is in the future. Capping to today {today}.")
        gap_end = today

    print(f"Target gap: {gap_start} to {gap_end}")

    # Fetch from TWSE
    print("\nFetching from TWSE FMTQIK...")
    fetched, error = fetch_twse_taiex_recent()

    if fetched is None:
        print(f"\nBLOCKED: TWSE API unavailable — {error}")
        conn.close()
        return {"status": "BLOCKED", "reason": error, "taiex_max_before": taiex_max}

    # Filter to gap range only
    to_insert = {}
    d = gap_start
    while d <= gap_end:
        ds = d.strftime("%Y-%m-%d")
        if ds not in existing and ds in fetched:
            to_insert[ds] = fetched[ds]
        d += timedelta(days=1)

    already_known = {}
    d = gap_start
    while d <= gap_end:
        ds = d.strftime("%Y-%m-%d")
        if ds in existing:
            already_known[ds] = existing[ds]
        d += timedelta(days=1)

    not_in_twse = []
    d = gap_start
    while d <= gap_end:
        ds = d.strftime("%Y-%m-%d")
        # Weekends: skip
        if d.weekday() >= 5:
            d += timedelta(days=1)
            continue
        if ds not in existing and ds not in fetched:
            not_in_twse.append(ds)
        d += timedelta(days=1)

    print(f"\nPlanned inserts: {len(to_insert)}")
    for ds, val in sorted(to_insert.items()):
        print(f"  INSERT TAIEX {ds} = {val}")

    print(f"\nAlready in DB (no action): {list(sorted(already_known.keys()))}")
    print(f"Weekday dates not in TWSE response (likely holiday/not yet published): {not_in_twse}")

    if not to_insert:
        print("\nNo new rows to insert.")
        conn.close()
        return {
            "status": "NO_ACTION_NEEDED",
            "taiex_max_before": taiex_max,
            "already_in_db": list(sorted(already_known.keys())),
            "not_in_twse": not_in_twse
        }

    if dry_run:
        print("\n[DRY-RUN] No writes performed. Use --apply to write.")
        conn.close()
        return {
            "status": "DRY_RUN",
            "planned_inserts": len(to_insert),
            "planned_rows": [{"date": k, "value": v} for k, v in sorted(to_insert.items())],
            "taiex_max_before": taiex_max,
            "not_in_twse_weekdays": not_in_twse
        }

    # Apply
    print("\n[APPLY] Writing to DB...")
    inserted = 0
    skipped_dup = 0

    # Need change and changePercent — compute from previous close
    # Build sorted list of all known TAIEX dates+values for change calculation
    all_taiex = conn.execute(
        "SELECT date, value FROM MarketIndex WHERE name='TAIEX' ORDER BY date ASC"
    ).fetchall()
    taiex_sorted = {r[0]: r[1] for r in all_taiex}

    for ds, val in sorted(to_insert.items()):
        # Check no duplicate
        exists = conn.execute(
            "SELECT COUNT(*) FROM MarketIndex WHERE name='TAIEX' AND date=?", (ds,)
        ).fetchone()[0]
        if exists:
            print(f"  SKIP (already exists): {ds}")
            skipped_dup += 1
            continue

        # Find previous TAIEX close for change calculation
        prev_dates = [d for d in sorted(taiex_sorted.keys()) if d < ds]
        if prev_dates:
            prev_close = taiex_sorted[prev_dates[-1]]
            change = round(val - prev_close, 2)
            change_pct = round((val - prev_close) / prev_close * 100, 2) if prev_close else 0.0
        else:
            change = 0.0
            change_pct = 0.0

        conn.execute(
            "INSERT INTO MarketIndex (name, date, value, change, changePercent) VALUES (?, ?, ?, ?, ?)",
            ("TAIEX", ds, val, change, change_pct)
        )
        taiex_sorted[ds] = val  # update for next iteration
        print(f"  INSERTED: TAIEX {ds} = {val} (change={change}, pct={change_pct}%)")
        inserted += 1

    conn.commit()

    # Verify
    new_max = conn.execute(
        "SELECT MAX(date) FROM MarketIndex WHERE name='TAIEX'"
    ).fetchone()[0]
    new_count = conn.execute(
        "SELECT COUNT(*) FROM MarketIndex WHERE name='TAIEX'"
    ).fetchone()[0]

    # Verify StockQuote unchanged
    sq_max_after = conn.execute("SELECT MAX(date) FROM StockQuote").fetchone()[0]
    sq_count_after = conn.execute("SELECT COUNT(*) FROM StockQuote").fetchone()[0]

    non_iso = conn.execute(
        "SELECT COUNT(*) FROM MarketIndex WHERE name='TAIEX' AND date NOT GLOB '????-??-??'"
    ).fetchone()[0]

    print(f"\nAfter apply:")
    print(f"  TAIEX max date: {new_max}")
    print(f"  TAIEX row count: {new_count}")
    print(f"  Rows inserted: {inserted}")
    print(f"  Duplicates skipped: {skipped_dup}")
    print(f"  Non-ISO TAIEX dates: {non_iso}")
    print(f"  StockQuote max (should be unchanged): {sq_max_after}")
    print(f"  StockQuote count (should be unchanged): {sq_count_after}")

    conn.close()
    return {
        "status": "APPLIED",
        "taiex_max_before": taiex_max,
        "taiex_max_after": new_max,
        "taiex_count_before": taiex_count,
        "taiex_count_after": new_count,
        "rows_inserted": inserted,
        "duplicates_skipped": skipped_dup,
        "non_iso_taiex_after": non_iso,
        "stockquote_max_unchanged": sq_max_after == sq_max,
        "not_in_twse_weekdays": not_in_twse
    }


def main():
    parser = argparse.ArgumentParser(description="P4-03b TAIEX Gap Backfill")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Preview only, no writes (default)")
    parser.add_argument("--apply", action="store_true", default=False,
                        help="Write to local dev.db")
    parser.add_argument("--start-date", type=str, default=None,
                        help="Gap start date YYYY-MM-DD (default: day after TAIEX max)")
    parser.add_argument("--end-date", type=str, default=None,
                        help="Gap end date YYYY-MM-DD (default: StockQuote max)")
    args = parser.parse_args()

    dry_run = not args.apply
    result = run(dry_run, args.start_date, args.end_date)
    print(f"\nResult: {result.get('status')}")


if __name__ == "__main__":
    main()
