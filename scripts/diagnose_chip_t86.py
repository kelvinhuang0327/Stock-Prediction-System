"""
Diagnose InstitutionalChip (TWSE T86) historical availability and failure reasons.

Outputs:
- logs/chip_t86_diagnosis.json
"""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import requests

DB_PATH = Path(__file__).resolve().parents[1] / "prisma" / "dev.db"
OUT_PATH = Path(__file__).resolve().parents[1] / "logs" / "chip_t86_diagnosis.json"


def business_days(end_date: datetime, days: int) -> list[str]:
    out: list[str] = []
    cursor = end_date
    while len(out) < days:
        if cursor.weekday() < 5:
            out.append(cursor.strftime("%Y%m%d"))
        cursor -= timedelta(days=1)
    out.reverse()
    return out


def probe_t86(date_yyyymmdd: str) -> dict:
    url = f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_yyyymmdd}&selectType=ALL&response=json"
    try:
        resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return {"date": date_yyyymmdd, "status": "http_error", "httpCode": resp.status_code, "rows": 0}
        payload = resp.json()
        stat = payload.get("stat", "")
        rows = len(payload.get("data") or [])
        if stat == "OK" and rows > 0:
            return {"date": date_yyyymmdd, "status": "ok", "httpCode": 200, "rows": rows}
        return {"date": date_yyyymmdd, "status": "no_data", "httpCode": 200, "rows": rows, "stat": stat}
    except Exception as exc:  # network/runtime diagnostics only
        return {"date": date_yyyymmdd, "status": "exception", "rows": 0, "error": str(exc)}


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT MIN(date), MAX(date), COUNT(DISTINCT date) FROM InstitutionalChip")
    min_date, max_date, date_count = cur.fetchone()
    cur.execute("SELECT COUNT(DISTINCT stockId) FROM InstitutionalChip")
    symbol_count = cur.fetchone()[0]

    now = datetime.utcnow()
    recent_dates = business_days(now, 25)
    older_sentinel = ["20251031", "20250930", "20250801", "20250102", "20240102", "20230103"]
    sample_dates = sorted(set(recent_dates + older_sentinel))

    probe_results = [probe_t86(d) for d in sample_dates]
    ok_rows = [r for r in probe_results if r["status"] == "ok"]
    no_data = [r for r in probe_results if r["status"] == "no_data"]
    blocked = [r for r in probe_results if r["status"] in ("http_error", "exception")]

    diagnosis = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "dbCoverage": {
            "chipMinDate": min_date,
            "chipMaxDate": max_date,
            "chipDistinctDates": date_count,
            "chipDistinctSymbols": symbol_count,
        },
        "t86ProbeSummary": {
            "sampleDates": len(sample_dates),
            "okDates": len(ok_rows),
            "noDataDates": len(no_data),
            "blockedOrErrorDates": len(blocked),
        },
        "probeResults": probe_results,
        "conclusion": {
            "sourceAvailability": (
                "historical_available" if len(ok_rows) >= max(3, len(sample_dates) // 3) else "limited_or_blocked"
            ),
            "likelyRootCause": (
                "rate_limit_or_anti_bot_and_batch_window_selection"
                if blocked
                else "non_trading_days_or_empty_windows"
            ),
            "recommendedStrategy": [
                "preflight probe + retry with backoff+jitter",
                "prioritize recent 60-120 trading days first",
                "use resumable state + missing-date log",
                "generate date list from market dates (StockQuote/MarketIndex) instead of raw weekdays",
            ],
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(diagnosis, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(diagnosis, ensure_ascii=False, indent=2))
    conn.close()


if __name__ == "__main__":
    main()
