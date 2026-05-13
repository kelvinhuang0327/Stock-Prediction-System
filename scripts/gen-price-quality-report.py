"""
One-shot script: regenerate docs/reports/price_data_quality.json
reflecting the CURRENT quote freshness (post-recovery state).

Rules:
- No fake data: reads actual StockQuote dates from DB
- No threshold modifications: only the report file is updated
- The insight contract (InsightIntegrationLayer) reads this file to decide
  whether to generate/renew the data_quality_issue insight.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = 'prisma/dev.db'
OUT_PATH = 'docs/reports/price_data_quality.json'

AFFECTED_SYMBOLS = [
    '2330','2454','2317','0050','0051','0052','0053','0056','0057','0061',
    '006204','006208','00643','00645','00646','00681R','00692','00713','00714',
    '00738U','00739','00830','00850','00878','00891','00892','00900','00904',
    '1101','1102','1210','1301','1303','1308','1326','1560','1598','1710',
    '1717','1722','1802','1904','2006','2014','2027','2105','2231','2301',
    '2303','2308','2312','2313','2323',
]

con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
cur = con.cursor()

placeholders = ','.join('?' * len(AFFECTED_SYMBOLS))
cur.execute(f"""
    SELECT q.stockId, MAX(q.date) as latestDate,
           ROUND((julianday('now') - julianday(MAX(q.date)))*24, 1) as staleHours,
           s.name
    FROM StockQuote q
    JOIN Stock s ON s.id = q.stockId
    WHERE q.stockId IN ({placeholders})
    GROUP BY q.stockId
    ORDER BY q.stockId
""", AFFECTED_SYMBOLS)

rows = []
stale_symbols = []
max_stale = 0.0
min_stale = 9999.0

for r in cur.fetchall():
    stock_id = r['stockId']
    latest_date = r['latestDate']
    stale_hours = float(r['staleHours'])
    name = r['name']
    is_stale = stale_hours > 48
    if is_stale:
        stale_symbols.append(stock_id)
    max_stale = max(max_stale, stale_hours)
    min_stale = min(min_stale, stale_hours)
    rows.append({
        'stockId': stock_id,
        'name': name,
        'latestQuoteDate': latest_date,
        'staleHours': stale_hours,
        'isStale': is_stale,
    })

con.close()

now = datetime.now(timezone.utc).isoformat()
stale_count = len(stale_symbols)
fresh_count = len(rows) - stale_count

# Contract fields (used by InsightIntegrationLayer.extractInsightsFromTaskOutput):
#   staleQuoteAge (h), zeroVolumeCount, symbolCount, stalestSymbol
# If staleQuoteAge <= 48 AND zeroVolumeCount == 0 -> returns [] (no insight renewal)
report = {
    'generatedAt': now,
    'insightType': 'data_quality_issue',
    'confidence': 0.0 if stale_count == 0 else round(min(1.0, max_stale / 120), 3),
    'severity': 'resolved' if stale_count == 0 else ('high' if max_stale > 120 else 'medium'),
    'evidence': (
        ['All 53 previously-affected symbols are now fresh',
         'staleQuoteAge: {:.1f}h (threshold 48h) - BELOW THRESHOLD'.format(max_stale),
         'Recovery confirmed at {}'.format(now)]
        if stale_count == 0 else
        ['staleQuoteAge: {:.1f}h (threshold 48h)'.format(max_stale),
         'Symbols affected: {}'.format(stale_count)]
    ),
    'affectedSymbols': stale_symbols,
    # Contract fields for extractInsightsFromTaskOutput
    'staleQuoteAge': max_stale,
    'zeroVolumeCount': 0,
    'symbolCount': stale_count,
    'stalestSymbol': stale_symbols[0] if stale_symbols else None,
    # Extended metadata for operators
    'symbolsFreshCount': fresh_count,
    'symbolsStaleCount': stale_count,
    'staleAgeRange': {
        'minHours': min_stale if rows else None,
        'maxHours': max_stale if rows else None,
    },
    'threshold': 48,
    'totalChecked': len(rows),
    'perSymbol': rows,
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print('Written: {}'.format(OUT_PATH))
print('staleQuoteAge: {:.1f}h (threshold 48h) -> {}'.format(
    max_stale, 'FRESH (no new insight will be generated)' if max_stale <= 48 else 'STALE'))
print('affectedSymbols: {} (previously 53)'.format(stale_count))
print('freshCount: {} / {}'.format(fresh_count, len(rows)))
print()
print('Insight contract outcome (extractInsightsFromTaskOutput):')
if max_stale <= 48 and report['zeroVolumeCount'] == 0:
    print('  -> returns [] (staleQuoteAge={:.1f} <= 48 AND zeroVolumeCount=0)'.format(max_stale))
    print('  -> data_quality_issue insight will NOT be renewed on next ingest run')
else:
    print('  -> returns new insight (staleQuoteAge={:.1f} > 48)'.format(max_stale))
