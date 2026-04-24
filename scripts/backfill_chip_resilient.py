"""
Resilient InstitutionalChip backfill with retry, resume, and missing-date logs.
"""

import argparse
import json
import random
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import requests

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "prisma" / "dev.db"
STATE_PATH = ROOT / "logs" / "chip_backfill_state.json"
MISSING_PATH = ROOT / "logs" / "chip_missing_dates.json"


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def to_iso(d: str) -> str:
    return f"{d[:4]}-{d[4:6]}-{d[6:8]}"


def parse_num(raw) -> int:
    s = str(raw or "").replace(",", "").replace(" ", "").replace("\u3000", "")
    if s in {"", "--", "X"}:
        return 0
    return int(float(s))


def fetch_t86(date_yyyymmdd: str, timeout_sec: int) -> Tuple[str, Optional[dict]]:
    url = f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_yyyymmdd}&selectType=ALL&response=json"
    try:
        resp = requests.get(url, timeout=timeout_sec, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code in (307, 403, 429):
            return "rate_limited", None
        if resp.status_code != 200:
            return "http_error", None
        payload = resp.json()
        if payload.get("stat") != "OK" or not payload.get("data"):
            return "no_data", payload
        return "ok", payload
    except Exception:
        return "exception", None


def get_candidate_dates(conn: sqlite3.Connection, start_iso: str, end_iso: str) -> list[str]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT REPLACE(date, '-', '') d
        FROM StockQuote
        WHERE date >= ? AND date <= ?
        ORDER BY d
        """,
        (start_iso, end_iso),
    )
    return [r[0] for r in cur.fetchall()]


def get_existing_dates(conn: sqlite3.Connection) -> set[str]:
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT REPLACE(date, '-', '') FROM InstitutionalChip")
    return {r[0] for r in cur.fetchall()}


def get_valid_ids(conn: sqlite3.Connection) -> set[str]:
    cur = conn.cursor()
    cur.execute("SELECT id FROM Stock")
    return {str(r[0]) for r in cur.fetchall()}


def upsert_day(conn: sqlite3.Connection, date_yyyymmdd: str, payload: dict, valid_ids: set[str]) -> int:
    cur = conn.cursor()
    iso_date = to_iso(date_yyyymmdd)
    inserted = 0
    for row in payload.get("data") or []:
        try:
            stock_id = str(row[0]).strip()
            if stock_id not in valid_ids:
                continue
            foreign_buy = parse_num(row[2]) if len(row) > 2 else 0
            foreign_sell = parse_num(row[3]) if len(row) > 3 else 0
            trust_buy = parse_num(row[5]) if len(row) > 5 else 0
            trust_sell = parse_num(row[6]) if len(row) > 6 else 0
            dealer_buy = parse_num(row[8]) if len(row) > 8 else 0
            dealer_sell = parse_num(row[9]) if len(row) > 9 else 0

            net_foreign = round((foreign_buy - foreign_sell) / 1000)
            net_trust = round((trust_buy - trust_sell) / 1000)
            net_dealer = round((dealer_buy - dealer_sell) / 1000)
            net_total = net_foreign + net_trust + net_dealer

            cur.execute(
                """
                INSERT OR REPLACE INTO InstitutionalChip
                (stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (stock_id, iso_date, net_foreign, net_trust, net_dealer, net_total),
            )
            inserted += 1
        except Exception:
            continue
    conn.commit()
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2025-07-01")
    parser.add_argument("--end", default=datetime.utcnow().strftime("%Y-%m-%d"))
    parser.add_argument("--limit-dates", type=int, default=120)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--sleep", type=float, default=1.2)
    parser.add_argument("--timeout", type=int, default=20)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    existing = get_existing_dates(conn)
    valid_ids = get_valid_ids(conn)
    dates = get_candidate_dates(conn, args.start, args.end)
    dates = [d for d in dates if d not in existing]

    if args.resume:
        state = load_json(STATE_PATH, {"done": [], "failed": []})
        done = set(state.get("done") or [])
        dates = [d for d in dates if d not in done]
    if args.limit_dates > 0:
        dates = dates[: args.limit_dates]

    missing_log = load_json(MISSING_PATH, {"no_data": [], "blocked": [], "http_error": [], "exception": []})
    run_state = load_json(STATE_PATH, {"done": [], "failed": []})

    stats = {"insertedRows": 0, "okDates": 0, "noDataDates": 0, "blockedDates": 0, "failedDates": 0}
    for idx, d in enumerate(dates, 1):
        best_status = "exception"
        payload = None
        for retry in range(4):
            status, res = fetch_t86(d, timeout_sec=args.timeout)
            best_status = status
            if status == "ok":
                payload = res
                break
            if status in {"no_data", "http_error"}:
                break
            time.sleep((2 ** retry) + random.uniform(0.1, 0.6))

        if payload:
            inserted = upsert_day(conn, d, payload, valid_ids)
            stats["insertedRows"] += inserted
            stats["okDates"] += 1
            run_state["done"].append(d)
            print(f"[{idx}/{len(dates)}] {d}: ok, inserted={inserted}")
        elif best_status == "no_data":
            stats["noDataDates"] += 1
            missing_log["no_data"].append(d)
            run_state["failed"].append({"date": d, "reason": "no_data"})
            print(f"[{idx}/{len(dates)}] {d}: no_data")
        elif best_status == "rate_limited":
            stats["blockedDates"] += 1
            missing_log["blocked"].append(d)
            run_state["failed"].append({"date": d, "reason": "rate_limited"})
            print(f"[{idx}/{len(dates)}] {d}: rate_limited")
        else:
            stats["failedDates"] += 1
            key = "http_error" if best_status == "http_error" else "exception"
            missing_log[key].append(d)
            run_state["failed"].append({"date": d, "reason": key})
            print(f"[{idx}/{len(dates)}] {d}: {key}")

        save_json(STATE_PATH, run_state)
        save_json(MISSING_PATH, missing_log)
        time.sleep(args.sleep + random.uniform(0.05, 0.35))

    cur = conn.cursor()
    cur.execute("SELECT COUNT(DISTINCT date), COUNT(DISTINCT stockId) FROM InstitutionalChip")
    date_count, symbol_count = cur.fetchone()
    cur.execute("SELECT ROUND(AVG(c), 2) FROM (SELECT stockId, COUNT(*) c FROM InstitutionalChip GROUP BY stockId)")
    avg_days = cur.fetchone()[0]
    summary = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "runStats": stats,
        "chipCoverage": {
            "distinctDates": date_count,
            "distinctSymbols": symbol_count,
            "avgDays": avg_days,
        },
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    conn.close()


if __name__ == "__main__":
    main()
