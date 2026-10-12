#!/usr/bin/env python3
"""
Generate price data quality JSON report and sync gap markdown report.
Writes:
- docs/reports/price_data_quality.json
- docs/reports/sync_gap_report.md

Reads dev.db (SQLite) in repo root.
"""
import sqlite3
import json
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'dev.db')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs', 'reports')
os.makedirs(OUT_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 1) Latest quote date per active symbol
# Prefer Stock table if populated, otherwise fall back to distinct stockId from StockQuote
cur.execute("SELECT id as stockId FROM Stock")
stocks = [r['stockId'] for r in cur.fetchall()]
if not stocks:
    cur.execute("SELECT DISTINCT stockId FROM StockQuote")
    stocks = [r['stockId'] for r in cur.fetchall()]

latest_per_symbol = {}
for sid in stocks:
    cur.execute("SELECT MAX(date) as latest FROM StockQuote WHERE stockId = ?", (sid,))
    row = cur.fetchone()
    latest_per_symbol[sid] = row['latest'] if row and row['latest'] else None

# 2) Count missing trading days in last 30 days (weekdays)
end_date = datetime.utcnow().date()
start_date = end_date - timedelta(days=29)
# produce list of trading dates (Mon-Fri)
trading_dates = []
for i in range(30):
    d = start_date + timedelta(days=i)
    if d.weekday() < 5:
        trading_dates.append(d.isoformat())

missing_counts = {}
for sid in stocks:
    cur.execute("SELECT DISTINCT date FROM StockQuote WHERE stockId = ? AND date BETWEEN ? AND ?", (sid, start_date.isoformat(), end_date.isoformat()))
    present = set([r['date'] for r in cur.fetchall()])
    missing = [d for d in trading_dates if d not in present]
    missing_counts[sid] = {
        'expected_trading_days': len(trading_dates),
        'present_days': len(present),
        'missing_days_count': len(missing),
        'missing_days': missing
    }

# 3) Zero-volume and OHLC anomalies
cur.execute("SELECT stockId, date, open, high, low, close, volume FROM StockQuote WHERE volume <= 0")
zero_volume_rows = [dict(r) for r in cur.fetchall()]

cur.execute("SELECT stockId, date, open, high, low, close FROM StockQuote WHERE high < low OR open < 0 OR high < 0 OR low < 0 OR close < 0")
ohlc_anomalies = [dict(r) for r in cur.fetchall()]

report = {
    'generated_at': datetime.utcnow().isoformat() + 'Z',
    'latest_quote_per_symbol': latest_per_symbol,
    'missing_trading_days_last_30': missing_counts,
    'zero_volume_rows_count': len(zero_volume_rows),
    'zero_volume_rows_sample': zero_volume_rows[:50],
    'ohlc_anomalies_count': len(ohlc_anomalies),
    'ohlc_anomalies_sample': ohlc_anomalies[:50]
}

out_json = os.path.join(OUT_DIR, 'price_data_quality.json')
with open(out_json, 'w') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

# 4) Sync gap report (diagnose latest quote date overall)
cur.execute("SELECT COUNT(*) as cnt, MAX(date) as latest_date, MAX(createdAt) as latest_createdAt FROM StockQuote")
agg = cur.fetchone()
row_count = agg['cnt']
latest_date = agg['latest_date']
latest_createdAt = agg['latest_createdAt']

note_lines = []
note_lines.append(f"# Sync Gap Report\n")
note_lines.append(f"Generated: {datetime.utcnow().isoformat()}Z\n")
note_lines.append(f"StockQuote row count (dev.db): {row_count}\n")
note_lines.append(f"Latest StockQuote.date: {latest_date}\n")
note_lines.append(f"Latest StockQuote.createdAt: {latest_createdAt}\n")

# Simple diagnosis heuristics
if row_count == 0:
    note_lines.append("Diagnosis: No StockQuote records found in local dev.db. This blocks data-quality and sync verification steps.\n")
    note_lines.append("Blocker evidence: dev.db contains 0 StockQuote rows.\n")
    note_lines.append("Recommended immediate actions to unblock:\n")
    note_lines.append("1. If running locally, restore a recent DB snapshot or copy production-sync snapshot into dev.db (ensure secrets/personal data policy compliance).\n")
    note_lines.append("2. Run existing sync scripts (scripts/trigger_syncs.js) against a historical date range to backfill missing quotes. Example: node trigger_syncs.js --symbols <list> --from YYYY-MM-DD --to YYYY-MM-DD\n")
    note_lines.append("3. Inspect SyncLog table and system scheduler for recent errors.\n")
    note_lines.append("4. After re-population, re-run price_data_quality.json generation and confirm latest quotes are within 48h.\n")
else:
    if latest_date:
        try:
            latest_dt = datetime.fromisoformat(latest_date)
            age = (datetime.utcnow() - latest_dt).total_seconds() / 3600.0
            note_lines.append(f"Latest quote age (hours): {age:.1f}\n")
            if age > 48:
                note_lines.append("Diagnosis: Market data sync appears stale (>48h). Possible root causes:\n")
                note_lines.append("- Data fetch job failure or scheduler stopped\n")
                note_lines.append("- External provider rate-limiting or credential expiry\n")
                note_lines.append("- Local DB write errors or migration issues\n")
                note_lines.append("Evidence: Latest quote older than 48 hours.\n")
                note_lines.append("Recommended next steps:\n")
                note_lines.append("1. Inspect SyncLog and recent scheduler runs (scripts/trigger_syncs.js and SyncLog table) for errors.\n")
                note_lines.append("2. Confirm external provider connectivity and credentials.\n")
                note_lines.append("3. Re-run backfill for affected symbol-date ranges using existing sync scripts. Example: node trigger_syncs.js --symbols <list> or run bulk backfill script.\n")
                note_lines.append("4. After backfill, verify latest quote per symbol is within 48h and update this report.\n")
            else:
                note_lines.append("Diagnosis: Latest quote within 48 hours — no immediate sync gap detected.\n")
        except Exception:
            note_lines.append("Warning: Could not parse latest_date; please inspect raw values.\n")

# Write sync_gap_report.md
out_md = os.path.join(OUT_DIR, 'sync_gap_report.md')
with open(out_md, 'w') as f:
    f.writelines([l + "\n" for l in note_lines])

print(f"Wrote: {out_json}")
print(f"Wrote: {out_md}")

conn.close()
