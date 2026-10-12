#!/usr/bin/env python3
"""
StockQuote Full Backfill (batch + resume)

目標：
- 優先補齊 watchlist / candidates / 市值前 N
- 再擴展全市場股票
- 以月為單位抓 TWSE STOCK_DAY，逐檔 upsert
- 支援 resume（中斷續跑）
"""

import argparse
import json
import os
import sqlite3
import time
from datetime import datetime
from typing import Dict, List, Set, Tuple

import requests

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prisma", "dev.db")
STATE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "backfill_stock_quote_full_state.json")


def ensure_parent(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def load_state() -> Dict:
    if not os.path.exists(STATE_PATH):
        return {
            "completed": [],
            "failed": {},
            "lastRunAt": None,
            "stats": {"symbolsDone": 0, "rowsInserted": 0},
        }
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "completed": [],
            "failed": {},
            "lastRunAt": None,
            "stats": {"symbolsDone": 0, "rowsInserted": 0},
        }


def save_state(state: Dict) -> None:
    ensure_parent(STATE_PATH)
    state["lastRunAt"] = datetime.utcnow().isoformat() + "Z"
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def clean_num(v) -> float:
    s = str(v).replace(",", "").replace("+", "").replace("--", "0").replace("X", "0").strip()
    try:
        return float(s) if s else 0.0
    except Exception:
        return 0.0


def roc_to_iso(roc: str) -> str:
    parts = roc.strip().split("/")
    if len(parts) != 3:
        return roc
    year = int(parts[0]) + 1911
    return f"{year:04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"


def get_priority_symbols(conn: sqlite3.Connection, top_n: int) -> Tuple[List[str], List[str], List[str], List[str]]:
    cur = conn.cursor()
    cur.execute("SELECT id FROM Stock")
    all_symbols = [r[0] for r in cur.fetchall()]

    cur.execute("SELECT DISTINCT stockId FROM Watchlist")
    watchlist = [r[0] for r in cur.fetchall()]

    cur.execute("SELECT snapshotDate FROM DailyCandidateSnapshot ORDER BY snapshotDate DESC LIMIT 1")
    row = cur.fetchone()
    candidates: List[str] = []
    if row and row[0]:
        cur.execute(
            "SELECT DISTINCT symbol FROM DailyCandidateSnapshot WHERE snapshotDate = ? AND screenBucket IN ('Strong Candidate','Watch','Neutral')",
            (row[0],),
        )
        candidates = [r[0] for r in cur.fetchall()]

    # 市值 proxy：capital * shares（若有）
    cur.execute(
        """
        SELECT id FROM Stock
        WHERE capital IS NOT NULL AND shares IS NOT NULL
        ORDER BY (capital * shares) DESC
        LIMIT ?
        """,
        (top_n,),
    )
    top_cap = [r[0] for r in cur.fetchall()]

    # 按優先順序去重
    seen: Set[str] = set()
    ordered: List[str] = []
    for group in (watchlist, candidates, top_cap, all_symbols):
        for s in group:
            if s not in seen:
                seen.add(s)
                ordered.append(s)
    return ordered, watchlist, candidates, top_cap


def get_symbols_with_ge_days(conn: sqlite3.Connection, min_days: int) -> Set[str]:
    cur = conn.cursor()
    cur.execute(
        "SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= ?",
        (min_days,),
    )
    return set(r[0] for r in cur.fetchall())


def sync_symbol_monthly(conn: sqlite3.Connection, symbol: str, years_back: int, sleep_month: float) -> Tuple[int, int]:
    now = datetime.now()
    start_year = now.year - years_back
    start_month = now.month
    y, m = start_year, start_month
    inserted = 0
    blocked = 0
    cur = conn.cursor()

    while (y < now.year) or (y == now.year and m <= now.month):
        date_key = f"{y}{m:02d}01"
        url = f"https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date={date_key}&stockNo={symbol}&response=json"
        try:
            resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"}, verify=False)  # noqa: S501
            if resp.status_code in (307, 403, 429):
                blocked += 1
                time.sleep(10)
                m += 1
                if m > 12:
                    y += 1
                    m = 1
                continue
            if resp.status_code != 200:
                m += 1
                if m > 12:
                    y += 1
                    m = 1
                time.sleep(sleep_month)
                continue

            body = resp.json()
            if body.get("stat") == "OK" and body.get("data"):
                for row in body["data"]:
                    try:
                        iso_date = roc_to_iso(str(row[0]))
                        volume = clean_num(row[1])
                        trade_value = clean_num(row[2])
                        open_p = clean_num(row[3])
                        high_p = clean_num(row[4])
                        low_p = clean_num(row[5])
                        close_p = clean_num(row[6])
                        change = clean_num(row[7])
                        transactions = int(clean_num(row[8]))
                        if close_p <= 0:
                            continue
                        cur.execute(
                            """
                            INSERT OR REPLACE INTO StockQuote
                            (stockId, date, open, high, low, close, volume, tradeValue, change, transactions, createdAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            """,
                            (symbol, iso_date, open_p, high_p, low_p, close_p, volume, trade_value, change, transactions),
                        )
                        inserted += 1
                    except Exception:
                        continue
                conn.commit()
        except Exception:
            pass

        m += 1
        if m > 12:
            y += 1
            m = 1
        time.sleep(sleep_month)

    return inserted, blocked


def report(conn: sqlite3.Connection) -> Dict:
    cur = conn.cursor()
    cur.execute("SELECT COUNT(DISTINCT stockId) FROM StockQuote")
    total_symbols = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM (SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= 250)")
    ge250 = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM (SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= 100)")
    ge100 = cur.fetchone()[0]
    cur.execute("SELECT MIN(date), MAX(date) FROM StockQuote")
    min_d, max_d = cur.fetchone()
    return {
        "totalSymbols": total_symbols,
        "ge250days": ge250,
        "ge100days": ge100,
        "dateRange": [min_d, max_d],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="StockQuote full backfill (batch + resume)")
    parser.add_argument("--years", type=int, default=3, help="years back to fetch (default: 3)")
    parser.add_argument("--top-cap", type=int, default=300, help="top N market-cap proxy priority (default: 300)")
    parser.add_argument("--max-symbols", type=int, default=0, help="max symbols to run this execution (0 = all)")
    parser.add_argument("--sleep-symbol", type=float, default=1.5, help="sleep seconds between symbols")
    parser.add_argument("--sleep-month", type=float, default=0.8, help="sleep seconds between monthly requests")
    parser.add_argument("--resume", action="store_true", help="resume from state file and skip completed")
    parser.add_argument("--skip-ge250", action="store_true", help="skip symbols already >=250 days")
    parser.add_argument("--report-only", action="store_true", help="print coverage report only")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    if args.report_only:
        print(json.dumps(report(conn), ensure_ascii=False, indent=2))
        conn.close()
        return

    state = load_state()
    completed_set = set(state.get("completed", [])) if args.resume else set()
    ge250_set = get_symbols_with_ge_days(conn, 250) if args.skip_ge250 else set()

    ordered, watchlist, candidates, top_cap = get_priority_symbols(conn, args.top_cap)
    queue = [s for s in ordered if s not in completed_set and s not in ge250_set]
    if args.max_symbols > 0:
        queue = queue[: args.max_symbols]

    print(f"Priority list: watchlist={len(watchlist)}, candidates={len(candidates)}, topCap={len(top_cap)}, totalQueue={len(queue)}")

    total_inserted = 0
    total_blocked = 0
    done = 0

    for idx, symbol in enumerate(queue, 1):
        print(f"[{idx}/{len(queue)}] {symbol} ... ", end="", flush=True)
        inserted, blocked = sync_symbol_monthly(conn, symbol, args.years, args.sleep_month)
        total_inserted += inserted
        total_blocked += blocked
        done += 1
        print(f"inserted={inserted}, blocked={blocked}")

        state.setdefault("completed", []).append(symbol)
        state.setdefault("stats", {}).setdefault("symbolsDone", 0)
        state.setdefault("stats", {}).setdefault("rowsInserted", 0)
        state["stats"]["symbolsDone"] += 1
        state["stats"]["rowsInserted"] += inserted
        save_state(state)
        time.sleep(args.sleep_symbol)

    cov = report(conn)
    print(json.dumps({
        "run": {"symbolsProcessed": done, "rowsInserted": total_inserted, "blockedResponses": total_blocked},
        "coverage": cov,
        "statePath": STATE_PATH,
    }, ensure_ascii=False, indent=2))
    conn.close()


if __name__ == "__main__":
    main()

