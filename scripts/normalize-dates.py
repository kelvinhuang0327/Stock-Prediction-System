"""
Date Normalization Script — 統一資料庫日期格式
Converts all ROC 7-digit and YYYYMMDD dates to ISO format (YYYY-MM-DD)

Also adds today's data from TWSE OpenAPI endpoint.
"""

import sqlite3
import os
import requests
import time
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prisma', 'dev.db')


def roc7_to_iso(roc: str) -> str:
    """Convert ROC 7-digit (e.g. 1150313) to ISO (2026-03-13)"""
    roc = roc.strip()
    if len(roc) == 7:
        year = int(roc[:3]) + 1911
        month = roc[3:5]
        day = roc[5:7]
        return f"{year}-{month}-{day}"
    return roc


def yyyymmdd_to_iso(d: str) -> str:
    """Convert YYYYMMDD (e.g. 20260210) to ISO (2026-02-10)"""
    d = d.strip()
    if len(d) == 8 and d.isdigit():
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
    return d


def normalize_table_dates(conn, table_name, date_column='date'):
    """Normalize all dates in a table to ISO format"""
    cursor = conn.cursor()

    # Count formats before
    cursor.execute(f"SELECT count(*) FROM {table_name} WHERE length({date_column}) = 7")
    roc_count = cursor.fetchone()[0]
    cursor.execute(f"SELECT count(*) FROM {table_name} WHERE length({date_column}) = 8")
    yyyymmdd_count = cursor.fetchone()[0]
    cursor.execute(f"SELECT count(*) FROM {table_name} WHERE length({date_column}) = 10")
    iso_count = cursor.fetchone()[0]

    print(f"\n[{table_name}] Before: ROC={roc_count}, YYYYMMDD={yyyymmdd_count}, ISO={iso_count}")

    if roc_count == 0 and yyyymmdd_count == 0:
        print(f"  → All dates already ISO, skipping")
        return

    # Get unique key info for the table
    cursor.execute(f"PRAGMA index_list({table_name})")
    indices = cursor.fetchall()

    # Convert ROC 7-digit dates
    if roc_count > 0:
        cursor.execute(f"SELECT id, {date_column} FROM {table_name} WHERE length({date_column}) = 7")
        roc_rows = cursor.fetchall()
        converted = 0
        for row_id, date_val in roc_rows:
            new_date = roc7_to_iso(date_val)
            if new_date != date_val:
                try:
                    cursor.execute(f"UPDATE {table_name} SET {date_column} = ? WHERE id = ?", (new_date, row_id))
                    converted += 1
                except Exception as e:
                    # Unique constraint violation - duplicate after conversion, delete the ROC version
                    cursor.execute(f"DELETE FROM {table_name} WHERE id = ?", (row_id,))
        conn.commit()
        print(f"  → Converted {converted} ROC dates (deleted {roc_count - converted} duplicates)")

    # Convert YYYYMMDD dates
    if yyyymmdd_count > 0:
        cursor.execute(f"SELECT id, {date_column} FROM {table_name} WHERE length({date_column}) = 8")
        yyyymmdd_rows = cursor.fetchall()
        converted = 0
        for row_id, date_val in yyyymmdd_rows:
            new_date = yyyymmdd_to_iso(date_val)
            if new_date != date_val:
                try:
                    cursor.execute(f"UPDATE {table_name} SET {date_column} = ? WHERE id = ?", (new_date, row_id))
                    converted += 1
                except Exception as e:
                    cursor.execute(f"DELETE FROM {table_name} WHERE id = ?", (row_id,))
        conn.commit()
        print(f"  → Converted {converted} YYYYMMDD dates (deleted {yyyymmdd_count - converted} duplicates)")

    # Verify
    cursor.execute(f"SELECT count(*) FROM {table_name} WHERE length({date_column}) != 10")
    remaining = cursor.fetchone()[0]
    cursor.execute(f"SELECT count(*) FROM {table_name}")
    total = cursor.fetchone()[0]
    print(f"  → After: {total} rows, {remaining} non-ISO remaining")


def add_today_quotes(conn):
    """Add today's data from TWSE OpenAPI"""
    print("\n📊 Adding today's quotes from TWSE OpenAPI...")

    try:
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
        resp = requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code != 200:
            print(f"  ❌ OpenAPI returned {resp.status_code}")
            return

        data = resp.json()
        if not data:
            print("  ❌ No data returned")
            return

        cursor = conn.cursor()

        # Get valid stock IDs
        cursor.execute("SELECT id FROM Stock")
        valid_ids = set(row[0] for row in cursor.fetchall())

        inserted = 0
        for record in data:
            stock_id = record.get('Code', '').strip()
            if stock_id not in valid_ids:
                continue

            try:
                roc_date = record.get('Date', '').strip()
                iso_date = roc7_to_iso(roc_date) if len(roc_date) == 7 else roc_date

                def clean(s):
                    s = str(s).replace(',', '').strip()
                    return float(s) if s else 0

                open_p = clean(record.get('OpeningPrice', 0))
                high_p = clean(record.get('HighestPrice', 0))
                low_p = clean(record.get('LowestPrice', 0))
                close_p = clean(record.get('ClosingPrice', 0))
                volume = clean(record.get('TradeVolume', 0))
                trade_val = clean(record.get('TradeValue', 0))
                change = clean(record.get('Change', 0))
                transactions = int(clean(record.get('Transaction', 0)))

                if close_p <= 0:
                    continue

                cursor.execute(
                    "INSERT OR REPLACE INTO StockQuote "
                    "(stockId, date, open, high, low, close, volume, tradeValue, change, transactions, createdAt) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                    (stock_id, iso_date, open_p, high_p, low_p, close_p, volume, trade_val, change, transactions)
                )
                inserted += 1
            except Exception:
                continue

        conn.commit()
        print(f"  ✅ Added {inserted} stock quotes for date {iso_date if inserted > 0 else 'N/A'}")
    except Exception as e:
        print(f"  ❌ Error: {e}")


def add_today_metrics(conn):
    """Add today's metrics from TWSE OpenAPI"""
    print("\n📊 Adding today's metrics from TWSE OpenAPI...")
    try:
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'
        resp = requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code != 200:
            print(f"  ❌ OpenAPI returned {resp.status_code}")
            return

        data = resp.json()
        if not data:
            return

        cursor = conn.cursor()
        cursor.execute("SELECT id FROM Stock")
        valid_ids = set(row[0] for row in cursor.fetchall())

        # Get today's date from StockQuote (most recent)
        cursor.execute("SELECT max(date) FROM StockQuote WHERE length(date) = 10")
        row = cursor.fetchone()
        today_date = row[0] if row and row[0] else datetime.now().strftime('%Y-%m-%d')

        inserted = 0
        for record in data:
            stock_id = record.get('Code', '').strip()
            if stock_id not in valid_ids:
                continue

            try:
                pe = float(record.get('PEratio', '0').replace(',', '') or '0')
                pb = float(record.get('PBratio', '0').replace(',', '') or '0')
                dy = float(record.get('DividendYield', '0').replace(',', '') or '0')

                cursor.execute(
                    "INSERT OR REPLACE INTO StockMetrics "
                    "(stockId, date, peRatio, pbRatio, dividendYield, marketCap, createdAt) "
                    "VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                    (stock_id, today_date, pe, pb, dy, 0)
                )
                inserted += 1
            except Exception:
                continue

        conn.commit()
        print(f"  ✅ Added {inserted} metrics for {today_date}")
    except Exception as e:
        print(f"  ❌ Error: {e}")


def add_today_index(conn):
    """Add today's market index from TWSE OpenAPI"""
    print("\n📊 Adding today's market index from TWSE OpenAPI...")
    try:
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX'
        resp = requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code != 200:
            return

        data = resp.json()
        cursor = conn.cursor()
        inserted = 0

        for record in data:
            name = record.get('指數', '').strip()
            if not name:
                continue

            try:
                roc_date = record.get('日期', '').strip()
                iso_date = roc7_to_iso(roc_date) if len(roc_date) == 7 else roc_date

                close_str = record.get('收盤指數', '0').replace(',', '')
                change_str = record.get('漲跌點數', '0').replace(',', '')

                value = float(close_str) if close_str else 0
                change = float(change_str) if change_str else 0

                if value <= 0:
                    continue

                prev = value - change
                pct = (change / prev * 100) if prev > 0 else 0

                cursor.execute(
                    "INSERT OR REPLACE INTO MarketIndex "
                    "(name, date, value, change, changePercent, createdAt) "
                    "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                    (name, iso_date, value, change, round(pct, 2))
                )
                inserted += 1
            except Exception:
                continue

        conn.commit()
        print(f"  ✅ Added {inserted} index records")
    except Exception as e:
        print(f"  ❌ Error: {e}")


def print_report(conn):
    """Print coverage report"""
    cursor = conn.cursor()
    print("\n" + "=" * 60)
    print("📊 日期正規化後 Coverage 報告")
    print("=" * 60)

    # StockQuote
    cursor.execute("SELECT count(*) FROM StockQuote")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT stockId, count(*) as d FROM StockQuote GROUP BY stockId ORDER BY d DESC")
    coverage = cursor.fetchall()
    ge250 = [s for s, d in coverage if d >= 250]
    ge100 = [s for s, d in coverage if d >= 100]
    ge60 = [s for s, d in coverage if d >= 60]

    print(f"\n[StockQuote] {total:,} 筆")
    print(f"  ≥250天: {len(ge250)} 檔 {ge250[:15]}")
    print(f"  ≥100天: {len(ge100)} 檔")
    print(f"  ≥60天:  {len(ge60)} 檔")

    cursor.execute("SELECT MIN(date), MAX(date) FROM StockQuote")
    r = cursor.fetchone()
    print(f"  日期: {r[0]} ~ {r[1]}")

    # Date format check
    for fmt, length in [('ROC', 7), ('YYYYMMDD', 8), ('ISO', 10)]:
        cursor.execute(f"SELECT count(*) FROM StockQuote WHERE length(date) = {length}")
        c = cursor.fetchone()[0]
        status = '✅' if (fmt == 'ISO') else ('⚠️' if c > 0 else '✅')
        print(f"  {fmt}: {c} {'(清除完成)' if c == 0 and fmt != 'ISO' else ''}")

    # MarketIndex
    cursor.execute("SELECT count(*) FROM MarketIndex WHERE name = 'TAIEX'")
    taiex = cursor.fetchone()[0]
    cursor.execute("SELECT MIN(date), MAX(date) FROM MarketIndex WHERE name = 'TAIEX'")
    r = cursor.fetchone()
    print(f"\n[MarketIndex] TAIEX: {taiex} 筆 ({r[0]} ~ {r[1]})" if r and r[0] else f"\n[MarketIndex] TAIEX: 0")
    print(f"  Benchmark可用: {'✅' if taiex >= 250 else '❌'}")

    # InstitutionalChip
    cursor.execute("SELECT count(*) FROM InstitutionalChip")
    chip_total = cursor.fetchone()[0]
    cursor.execute("SELECT count(DISTINCT stockId), count(DISTINCT date) FROM InstitutionalChip")
    chip_stocks, chip_dates = cursor.fetchone()
    print(f"\n[InstitutionalChip] {chip_total:,} 筆 ({chip_stocks} 股 × {chip_dates} 天)")

    print("\n" + "=" * 60)


def main():
    print("=" * 60)
    print("🔧 資料日期正規化 + 即日資料更新")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    try:
        # Phase 1: Normalize dates in all tables
        print("\n─── Phase 1: 日期格式統一 ───")
        normalize_table_dates(conn, 'StockQuote')
        normalize_table_dates(conn, 'StockMetrics')
        normalize_table_dates(conn, 'MarketIndex')
        normalize_table_dates(conn, 'InstitutionalChip')
        # MonthlyRevenue uses year+month columns, no date normalization needed

        # Phase 2: Add today's data from OpenAPI
        print("\n─── Phase 2: 即日資料更新 (OpenAPI) ───")
        add_today_quotes(conn)
        add_today_metrics(conn)
        add_today_index(conn)

        # Report
        print_report(conn)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


if __name__ == '__main__':
    main()
