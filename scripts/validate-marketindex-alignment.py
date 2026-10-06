"""
MarketIndex / StockQuote Alignment Validation Script
Validates date alignment between MarketIndex (TAIEX) and StockQuote after normalization.

Usage:
  python3 scripts/validate-marketindex-alignment.py

Outputs:
  outputs/stock_data_expansion/p4_02p0_alignment_validation.json
  outputs/stock_data_expansion/p4_02p0_alignment_validation.md
"""

import sqlite3
import json
import os
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prisma', 'dev.db')
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs', 'stock_data_expansion')


def validate(conn):
    cur = conn.cursor()
    result = {}

    # --- StockQuote ISO date ratio ---
    cur.execute("SELECT count(*) FROM StockQuote")
    sq_total = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM StockQuote WHERE length(date)=10 AND substr(date,5,1)='-' AND substr(date,8,1)='-'")
    sq_iso = cur.fetchone()[0]
    sq_iso_ratio = round(sq_iso / sq_total * 100, 2) if sq_total > 0 else 0
    cur.execute("SELECT count(*) FROM StockQuote WHERE date < '2010-01-01'")
    sq_anomaly = cur.fetchone()[0]
    cur.execute("SELECT min(date), max(date) FROM StockQuote WHERE date >= '2010-01-01'")
    sq_min, sq_max = cur.fetchone()

    result['stockquote'] = {
        'total_rows': sq_total,
        'iso_rows': sq_iso,
        'iso_ratio_pct': sq_iso_ratio,
        'anomaly_rows_pre2010': sq_anomaly,
        'effective_min_date': sq_min,
        'effective_max_date': sq_max,
    }

    # --- MarketIndex ISO date ratio ---
    cur.execute("SELECT count(*) FROM MarketIndex")
    mi_total = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM MarketIndex WHERE length(date)=10 AND substr(date,5,1)='-' AND substr(date,8,1)='-'")
    mi_iso = cur.fetchone()[0]
    mi_iso_ratio = round(mi_iso / mi_total * 100, 2) if mi_total > 0 else 0

    result['market_index'] = {
        'total_rows': mi_total,
        'iso_rows': mi_iso,
        'iso_ratio_pct': mi_iso_ratio,
    }

    # --- TAIEX specific ---
    cur.execute("SELECT count(*), min(date), max(date) FROM MarketIndex WHERE name='TAIEX'")
    taiex_count, taiex_min, taiex_max = cur.fetchone()
    cur.execute("SELECT count(DISTINCT date) FROM MarketIndex WHERE name='TAIEX'")
    taiex_distinct = cur.fetchone()[0]

    today = datetime.now().strftime('%Y-%m-%d')
    taiex_freshness_gap_days = None
    if taiex_max:
        from datetime import date as d_
        t_max = d_.fromisoformat(taiex_max)
        today_d = d_.fromisoformat(today)
        taiex_freshness_gap_days = (today_d - t_max).days

    result['taiex'] = {
        'count': taiex_count,
        'distinct_trading_days': taiex_distinct,
        'min_date': taiex_min,
        'max_date': taiex_max,
        'today': today,
        'freshness_gap_days': taiex_freshness_gap_days,
        'sufficient_for_500d_window': taiex_count >= 500,
        'sufficient_for_200d_window': taiex_count >= 200,
    }

    # --- Date overlap analysis ---
    cur.execute("SELECT DISTINCT date FROM MarketIndex WHERE name='TAIEX' AND date >= '2010-01-01'")
    taiex_dates = set(r[0] for r in cur.fetchall())

    cur.execute("SELECT DISTINCT date FROM StockQuote WHERE date >= '2010-01-01'")
    sq_dates = set(r[0] for r in cur.fetchall())

    overlap = taiex_dates & sq_dates
    taiex_not_in_sq = sorted(taiex_dates - sq_dates)
    sq_not_in_taiex = sorted(sq_dates - taiex_dates)

    result['date_overlap'] = {
        'taiex_distinct_dates_ge2010': len(taiex_dates),
        'stockquote_distinct_dates_ge2010': len(sq_dates),
        'overlapping_dates': len(overlap),
        'taiex_dates_not_in_stockquote': len(taiex_not_in_sq),
        'taiex_dates_not_in_stockquote_sample': taiex_not_in_sq[:10],
        'stockquote_dates_not_in_taiex': len(sq_not_in_taiex),
        'stockquote_dates_not_in_taiex_sample': sq_not_in_taiex[:10],
    }

    # --- Symbols with >=500 StockQuote rows ---
    cur.execute("SELECT count(*) FROM (SELECT stockId, count(*) as c FROM StockQuote GROUP BY stockId HAVING c >= 500)")
    symbols_ge500 = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM (SELECT stockId, count(*) as c FROM StockQuote GROUP BY stockId HAVING c >= 200)")
    symbols_ge200 = cur.fetchone()[0]
    cur.execute("SELECT count(DISTINCT stockId) FROM StockQuote")
    symbols_total = cur.fetchone()[0]

    result['stockquote_coverage'] = {
        'distinct_symbols': symbols_total,
        'symbols_ge500_rows': symbols_ge500,
        'symbols_ge200_rows': symbols_ge200,
    }

    # --- Sector indices ---
    cur.execute("SELECT count(DISTINCT name) FROM MarketIndex WHERE name LIKE '%類指數%' OR name LIKE '%類報酬指數%'")
    sector_count = cur.fetchone()[0]
    cur.execute("SELECT DISTINCT name FROM MarketIndex WHERE (name LIKE '%類指數%' OR name LIKE '%類報酬指數%') AND name NOT LIKE '%報酬指數%' LIMIT 20")
    sector_names = [r[0] for r in cur.fetchall()]

    result['sector_indices'] = {
        'sector_index_names_count': sector_count,
        'sample_sector_names': sector_names,
    }

    # --- Readiness verdicts ---
    sq_ready = sq_iso_ratio == 100.0
    mi_ready = mi_iso_ratio == 100.0
    taiex_fresh = taiex_freshness_gap_days is not None and taiex_freshness_gap_days <= 7
    join_ready = sq_ready and mi_ready
    p4_02_ready = join_ready and symbols_ge200 >= 100
    p4_03_ready = join_ready and taiex_count >= 500 and taiex_fresh

    result['readiness'] = {
        'stockquote_iso_clean': sq_ready,
        'marketindex_iso_clean': mi_ready,
        'taiex_fresh': taiex_fresh,
        'join_safe': join_ready,
        'p4_02_can_proceed': p4_02_ready,
        'p4_03_can_proceed': p4_03_ready,
        'p4_04_can_proceed': False,
        'p4_04_blocker': 'InstitutionalChip only 236 trading days (need >=500); T-05 walk-forward needs redesign',
        'remaining_p0_blockers': [] if (sq_ready and mi_ready and taiex_fresh) else [
            b for b, cond in [
                ('StockQuote date normalization incomplete', not sq_ready),
                ('MarketIndex date normalization incomplete', not mi_ready),
                ('TAIEX not fresh (gap > 7 days)', not taiex_fresh),
            ] if cond
        ],
    }

    result['generated_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
    return result


def write_json(result, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Written: " + path)


def write_md(result, path):
    r = result
    rd = r['readiness']
    taiex = r['taiex']
    overlap = r['date_overlap']
    sq = r['stockquote']
    mi = r['market_index']
    cov = r['stockquote_coverage']

    lines = [
        "# P4-02P0 — MarketIndex / StockQuote Alignment Validation",
        "",
        "**Generated**: " + r['generated_at'],
        "**DB**: prisma/dev.db (direct SQLite query)",
        "",
        "---",
        "",
        "## Readiness Verdicts",
        "",
        "| Check | Result |",
        "|---|---|",
        "| StockQuote 100% ISO | " + ("✅ YES" if rd['stockquote_iso_clean'] else "❌ NO") + " |",
        "| MarketIndex 100% ISO | " + ("✅ YES" if rd['marketindex_iso_clean'] else "❌ NO") + " |",
        "| TAIEX fresh (gap <=7d) | " + ("✅ YES" if rd['taiex_fresh'] else "❌ NO — gap=" + str(taiex.get('freshness_gap_days')) + "d") + " |",
        "| StockQuote/MarketIndex JOIN safe | " + ("✅ YES" if rd['join_safe'] else "❌ NO") + " |",
        "| **P4-02 can proceed** | " + ("✅ YES" if rd['p4_02_can_proceed'] else "❌ NO") + " |",
        "| **P4-03 can proceed** | " + ("✅ YES" if rd['p4_03_can_proceed'] else "❌ NO") + " |",
        "| **P4-04 can proceed** | ❌ NO — " + rd['p4_04_blocker'] + " |",
        "",
    ]

    if rd['remaining_p0_blockers']:
        lines += ["## Remaining P0 Blockers", ""]
        for b in rd['remaining_p0_blockers']:
            lines.append("- ❌ " + b)
        lines.append("")
    else:
        lines += ["## P0 Blockers Status", "", "✅ All P0 blockers resolved (date normalization complete, TAIEX refreshed)", ""]

    lines += [
        "---",
        "",
        "## StockQuote Date State",
        "",
        "| Metric | Value |",
        "|---|---|",
        "| Total rows | " + str(sq['total_rows']) + " |",
        "| ISO rows | " + str(sq['iso_rows']) + " |",
        "| ISO ratio | " + str(sq['iso_ratio_pct']) + "% |",
        "| Anomaly rows (pre-2010) | " + str(sq['anomaly_rows_pre2010']) + " (pre-existing epoch artifact) |",
        "| Effective min date | " + str(sq['effective_min_date']) + " |",
        "| Effective max date | " + str(sq['effective_max_date']) + " |",
        "",
        "---",
        "",
        "## TAIEX State",
        "",
        "| Metric | Value |",
        "|---|---|",
        "| Total TAIEX rows | " + str(taiex['count']) + " |",
        "| Distinct trading days | " + str(taiex['distinct_trading_days']) + " |",
        "| Min date | " + str(taiex['min_date']) + " |",
        "| Max date | " + str(taiex['max_date']) + " |",
        "| Today | " + str(taiex['today']) + " |",
        "| Freshness gap | " + str(taiex['freshness_gap_days']) + " days |",
        "| Sufficient for 500d window | " + ("✅ YES" if taiex['sufficient_for_500d_window'] else "❌ NO") + " |",
        "",
        "---",
        "",
        "## Date Overlap (TAIEX vs StockQuote)",
        "",
        "| Metric | Value |",
        "|---|---|",
        "| TAIEX distinct dates (≥2010) | " + str(overlap['taiex_distinct_dates_ge2010']) + " |",
        "| StockQuote distinct dates (≥2010) | " + str(overlap['stockquote_distinct_dates_ge2010']) + " |",
        "| Overlapping dates | " + str(overlap['overlapping_dates']) + " |",
        "| TAIEX dates not in StockQuote | " + str(overlap['taiex_dates_not_in_stockquote']) + " |",
        "| StockQuote dates not in TAIEX | " + str(overlap['stockquote_dates_not_in_taiex']) + " |",
        "",
        "StockQuote dates not in TAIEX (most recent, sample): " + str(overlap['stockquote_dates_not_in_taiex_sample'][-5:] if overlap['stockquote_dates_not_in_taiex_sample'] else []),
        "",
        "---",
        "",
        "## StockQuote Symbol Coverage",
        "",
        "| Metric | Value |",
        "|---|---|",
        "| Distinct symbols | " + str(cov['distinct_symbols']) + " |",
        "| Symbols ≥500 trading days | " + str(cov['symbols_ge500_rows']) + " |",
        "| Symbols ≥200 trading days | " + str(cov['symbols_ge200_rows']) + " |",
        "",
        "---",
        "",
        "## Sector Indices Available",
        "",
        "MarketIndex contains **" + str(r['sector_indices']['sector_index_names_count']) + "** distinct sector index names.",
        "Sample: " + ', '.join(r['sector_indices']['sample_sector_names'][:10]),
    ]

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print("Written: " + path)


def main():
    print("=" * 60)
    print("Alignment Validation — MarketIndex vs StockQuote")
    print("DB: " + DB_PATH)
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    result = validate(conn)
    conn.close()

    json_path = os.path.join(OUT_DIR, 'p4_02p0_alignment_validation.json')
    md_path = os.path.join(OUT_DIR, 'p4_02p0_alignment_validation.md')

    write_json(result, json_path)
    write_md(result, md_path)

    rd = result['readiness']
    print("\n=== Readiness Summary ===")
    print("StockQuote ISO clean:    " + str(rd['stockquote_iso_clean']))
    print("MarketIndex ISO clean:   " + str(rd['marketindex_iso_clean']))
    print("TAIEX fresh:             " + str(rd['taiex_fresh']))
    print("JOIN safe:               " + str(rd['join_safe']))
    print("P4-02 can proceed:       " + str(rd['p4_02_can_proceed']))
    print("P4-03 can proceed:       " + str(rd['p4_03_can_proceed']))
    print("P4-04 can proceed:       " + str(rd['p4_04_can_proceed']))
    print("Remaining P0 blockers:   " + str(rd['remaining_p0_blockers']))
    print("\nDone.")


if __name__ == '__main__':
    main()
