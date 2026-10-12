"""
targeted_quote_sync.py — Sync recent quote data for specific symbols
Usage: python3 scripts/targeted_quote_sync.py 1326 1560 1802 2014 2308
"""
import sqlite3
import requests
import time
import sys
from datetime import datetime

DB_PATH = "prisma/dev.db"

def clean_num(s: str) -> float:
    try:
        return float(str(s).replace(",", "").replace("+", "").strip())
    except Exception:
        return 0.0


def sync_symbol_recent(conn: sqlite3.Connection, symbol: str, months_back: int = 2) -> int:
    cur = conn.cursor()
    now = datetime.now()
    inserted = 0

    # Build list of (year, month) tuples going back N months
    months = []
    y, m = now.year, now.month
    for _ in range(months_back):
        months.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()

    for year, month in months:
        date_key = f"{year}{month:02d}01"
        url = (
            "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY"
            f"?date={date_key}&stockNo={symbol}&response=json"
        )
        try:
            resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"}, verify=False)  # noqa: S501
            if resp.status_code != 200:
                print(f"  [{symbol}] {year}-{month:02d}: HTTP {resp.status_code}")
                time.sleep(1.0)
                continue

            body = resp.json()
            if body.get("stat") == "OK" and body.get("data"):
                for row in body["data"]:
                    try:
                        parts = row[0].strip().split("/")
                        if len(parts) != 3:
                            continue
                        iso_date = f"{int(parts[0]) + 1911}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                        close_p = clean_num(row[6])
                        if close_p <= 0:
                            continue
                        cur.execute(
                            """
                            INSERT OR REPLACE INTO StockQuote
                            (stockId, date, open, high, low, close, volume,
                             tradeValue, change, transactions, createdAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            """,
                            (
                                symbol, iso_date,
                                clean_num(row[3]), clean_num(row[4]), clean_num(row[5]),
                                close_p,
                                clean_num(row[1]), clean_num(row[2]),
                                clean_num(row[7]),
                                int(clean_num(row[8])),
                            ),
                        )
                        inserted += 1
                    except Exception:
                        continue
                conn.commit()
                print(f"  [{symbol}] {year}-{month:02d}: {len(body['data'])} rows")
            else:
                print(f"  [{symbol}] {year}-{month:02d}: no data (stat={body.get('stat', '?')})")
        except Exception as e:
            print(f"  [{symbol}] {year}-{month:02d}: ERROR {e}")

        time.sleep(0.8)

    return inserted


def main():
    symbols = sys.argv[1:] if len(sys.argv) > 1 else ["1326", "1560", "1802", "2014", "2308"]
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Syncing {len(symbols)} symbols: {symbols}")
    for symbol in symbols:
        n = sync_symbol_recent(conn, symbol, months_back=2)
        cur.execute("SELECT MAX(date) FROM StockQuote WHERE stockId=?", (symbol,))
        latest = cur.fetchone()[0]
        print(f"  [{symbol}] total inserted: {n} | latest quote: {latest}")

    print("\nDone.")
    conn.close()


if __name__ == "__main__":
    main()
