#!/usr/bin/env python3
import sqlite3
import os
import json
from datetime import datetime, timezone, timedelta

# Locate DB
candidates = [
    'prisma/dev.db',
    'dev.db',
    'prisma/dev.sqlite',
    'database/dev.db'
]
DB = None
for p in candidates:
    if os.path.exists(p):
        DB = p
        break
if DB is None:
    print('No local sqlite DB found in expected paths.')
    exit(2)

out_dir = 'docs/reports'
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, 'price_data_quality.json')

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Overall latest quote
cur.execute('SELECT MAX(createdAt) as m FROM StockQuote')
row = cur.fetchone()
overall_latest = row['m'] if row else None

# Market dates in last 30 days (based on createdAt)
cur.execute("SELECT DISTINCT date FROM StockQuote WHERE createdAt >= datetime('now','-30 days')")
market_dates = [r['date'] for r in cur.fetchall()]
market_dates_count = len(market_dates)

# Stocks list
cur.execute('SELECT id, name FROM Stock')
stocks = cur.fetchall()

results = []
now = datetime.now(timezone.utc)
for s in stocks:
    sid = s['id']
    name = s['name']

    cur.execute('SELECT date, createdAt, close FROM StockQuote WHERE stockId = ? ORDER BY createdAt DESC LIMIT 1', (sid,))
    latest = cur.fetchone()
    latest_date = latest['date'] if latest else None
    latest_createdAt = latest['createdAt'] if latest else None
    latest_close = latest['close'] if latest else None

    # zero-volume rows
    cur.execute('SELECT COUNT(*) as c FROM StockQuote WHERE stockId = ? AND (volume IS NULL OR volume <= 0)', (sid,))
    zero_vol = cur.fetchone()['c']

    # OHLC anomalies: open>high OR low>high OR close>high OR close<low OR open<low (nonsensical ranges)
    cur.execute("""
        SELECT COUNT(*) as c FROM StockQuote
        WHERE stockId = ? AND (
            open > high OR
            low > high OR
            close > high OR
            close < low OR
            open < low
        )
    """, (sid,))
    ohlc_anom = cur.fetchone()['c']

    # dates present for this symbol in last 30 days
    cur.execute("SELECT COUNT(DISTINCT date) as c FROM StockQuote WHERE stockId = ? AND createdAt >= datetime('now','-30 days')", (sid,))
    symbol_dates_count = cur.fetchone()['c']
    missing_days = max(0, market_dates_count - symbol_dates_count)

    # stale flag: latest_createdAt older than 48 hours
    is_stale = False
    if latest_createdAt:
        try:
            # normalize common formats
            lc = latest_createdAt
            if lc.endswith('Z'):
                lc = lc.replace('Z', '+00:00')
            parsed = datetime.fromisoformat(lc)
            # make timezone-aware
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            delta = now - parsed
            is_stale = delta > timedelta(hours=48)
        except Exception:
            is_stale = False

    results.append({
        'stockId': sid,
        'name': name,
        'latest_quote_date': latest_date,
        'latest_quote_createdAt': latest_createdAt,
        'latest_close': latest_close,
        'zero_volume_rows': zero_vol,
        'ohlc_anomalies': ohlc_anom,
        'missing_trading_days_last_30': missing_days,
        'is_stale': is_stale
    })

conn.close()

report = {
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'db_path': DB,
    'overall_latest_quote_createdAt': overall_latest,
    'market_dates_count_last_30_days': market_dates_count,
    'per_symbol': results
}

with open(out_path, 'w') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print('Wrote', out_path)
