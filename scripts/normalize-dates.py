"""
Date Normalization Script — 統一資料庫日期格式
Converts all ROC 7-digit and YYYYMMDD dates to ISO format (YYYY-MM-DD)

Usage:
  python3 scripts/normalize-dates.py --dry-run   # Safe preview, no DB writes
  python3 scripts/normalize-dates.py --apply     # Actually write to DB

Safety rules:
  - Default mode is --dry-run (no writes without explicit --apply)
  - Only modifies date columns; never deletes data without deduplication reason
  - UNKNOWN_FORMAT rows are listed in dry-run but NEVER auto-converted
  - Only operates on local prisma/dev.db
  - MonthlyRevenue and FinancialReport use year/month/quarter cols — not touched
"""

import sqlite3
import os
import sys
import argparse

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prisma', 'dev.db')

# Tables and their date columns to normalize
TARGET_TABLES = [
    ('StockQuote', 'date'),
    ('MarketIndex', 'date'),
    ('StockMetrics', 'date'),
    # InstitutionalChip is already all-ISO; included for audit completeness
    ('InstitutionalChip', 'date'),
]

# Tables explicitly excluded (they use non-date columns)
EXCLUDED_TABLES = {
    'MonthlyRevenue': 'uses year (INT) + month (INT) columns, no date normalization needed',
    'FinancialReport': 'uses year (INT) + quarter (STRING) columns, no date normalization needed',
}


def roc7_to_iso(roc: str) -> str:
    """Convert ROC 7-digit compact (e.g. 1150313) to ISO (2026-03-13)"""
    roc = roc.strip()
    if len(roc) == 7 and roc.isdigit():
        year = int(roc[:3]) + 1911
        month = roc[3:5]
        day = roc[5:7]
        return f"{year}-{month}-{day}"
    return roc


def yyyymmdd_to_iso(d: str) -> str:
    """Convert compact Gregorian YYYYMMDD (e.g. 20260210) to ISO (2026-02-10)"""
    d = d.strip()
    if len(d) == 8 and d.isdigit():
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
    return d


def classify_date(val: str) -> str:
    if val is None or val == '':
        return 'EMPTY_OR_NULL'
    val = val.strip()
    if len(val) == 10 and val[4] == '-' and val[7] == '-' and val.replace('-', '').isdigit():
        return 'ISO_DATE'
    if len(val) == 7 and val.isdigit():
        return 'ROC_DATE'
    if len(val) == 8 and val.isdigit():
        return 'YYYYMMDD_COMPACT'
    return 'UNKNOWN_FORMAT'


def audit_table(conn, table_name, date_col):
    """Audit date formats in a table and return summary + planned conversions."""
    cursor = conn.cursor()
    cursor.execute(f"SELECT count(*) FROM {table_name}")
    total = cursor.fetchone()[0]

    cursor.execute(f"SELECT id, {date_col} FROM {table_name} WHERE length({date_col}) != 10 OR {date_col} NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'")
    non_iso_rows = cursor.fetchall()

    counts = {'ISO_DATE': 0, 'ROC_DATE': 0, 'YYYYMMDD_COMPACT': 0, 'EMPTY_OR_NULL': 0, 'UNKNOWN_FORMAT': 0}
    planned = []  # (id, old_val, new_val, format_type)
    blockers = []  # rows that cannot be auto-converted

    for row_id, val in non_iso_rows:
        fmt = classify_date(val)
        counts[fmt] = counts.get(fmt, 0) + 1
        if fmt == 'ROC_DATE':
            planned.append((row_id, val, roc7_to_iso(val), 'ROC_DATE'))
        elif fmt == 'YYYYMMDD_COMPACT':
            planned.append((row_id, val, yyyymmdd_to_iso(val), 'YYYYMMDD_COMPACT'))
        else:
            blockers.append({'id': row_id, 'value': val, 'format': fmt})

    # Count ISO rows
    counts['ISO_DATE'] = total - sum(v for k, v in counts.items() if k != 'ISO_DATE')

    return {
        'table': table_name,
        'date_col': date_col,
        'total_rows': total,
        'counts': counts,
        'planned_conversions': len(planned),
        'blockers': blockers,
        'planned_sample': [(r[0], r[1], r[2], r[3]) for r in planned[:10]],
        '_all_planned': planned,
    }


def apply_normalization(conn, audit_result, dry_run: bool):
    """Apply (or simulate) date normalization for one table."""
    table = audit_result['table']
    date_col = audit_result['date_col']
    planned = audit_result['_all_planned']

    if not planned:
        print(f"  [{table}] No conversions needed — all dates already ISO or no convertible rows.")
        return 0, 0

    print(f"\n  [{table}] {len(planned)} rows to convert")
    converted = 0
    deduped = 0
    cursor = conn.cursor()

    for row_id, old_val, new_val, fmt in planned:
        if dry_run:
            print(f"    DRY-RUN: id={row_id} '{old_val}' → '{new_val}' ({fmt})")
            converted += 1
        else:
            try:
                cursor.execute(f"UPDATE {table} SET {date_col} = ? WHERE id = ?", (new_val, row_id))
                converted += 1
            except Exception:
                # Unique constraint violation — duplicate after conversion; delete the non-ISO row
                cursor.execute(f"DELETE FROM {table} WHERE id = ?", (row_id,))
                deduped += 1

    if not dry_run:
        conn.commit()
        print(f"    APPLIED: {converted} converted, {deduped} duplicates removed")
    else:
        print(f"    DRY-RUN SUMMARY: {converted} would be converted")

    return converted, deduped


def print_after_state(conn):
    """Print post-normalization summary."""
    cursor = conn.cursor()
    print("\n" + "=" * 60)
    print("📊 Post-normalization state:")

    for table, date_col in TARGET_TABLES:
        cursor.execute(f"SELECT count(*) FROM {table}")
        total = cursor.fetchone()[0]
        cursor.execute(f"SELECT count(*) FROM {table} WHERE length({date_col})=7 AND {date_col} GLOB '[0-9]*'")
        roc = cursor.fetchone()[0]
        cursor.execute(f"SELECT count(*) FROM {table} WHERE length({date_col})=8 AND {date_col} GLOB '[0-9]*'")
        compact = cursor.fetchone()[0]
        cursor.execute(f"SELECT min({date_col}), max({date_col}) FROM {table}")
        mn, mx = cursor.fetchone()
        non_iso = roc + compact
        status = '✅' if non_iso == 0 else f'⚠️ {non_iso} non-ISO remain'
        print(f"  {table}: {total} rows, min={mn}, max={mx} — {status}")

    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Date Normalization — converts ROC/compact dates to ISO YYYY-MM-DD'
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument('--dry-run', action='store_true', default=True,
                            help='Preview changes only (default — no DB writes)')
    mode_group.add_argument('--apply', action='store_true', default=False,
                            help='Actually write changes to DB')
    args = parser.parse_args()

    dry_run = not args.apply

    print("=" * 60)
    print(f"🔧 Date Normalization Script")
    print(f"   Mode: {'DRY-RUN (no writes)' if dry_run else '⚠️  APPLY (writing to DB)'}")
    print(f"   DB: {DB_PATH}")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"❌ DB not found: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    # Excluded tables notice
    print("\n📋 Excluded tables (no date column normalization needed):")
    for tbl, reason in EXCLUDED_TABLES.items():
        print(f"  {tbl}: {reason}")

    # Audit phase
    print("\n─── Phase 1: Date Audit ───")
    audits = []
    for table, date_col in TARGET_TABLES:
        audit = audit_table(conn, table, date_col)
        audits.append(audit)
        print(f"\n  [{table}.{date_col}]")
        print(f"    total={audit['total_rows']}, ISO={audit['counts']['ISO_DATE']}, "
              f"ROC={audit['counts']['ROC_DATE']}, YYYYMMDD={audit['counts']['YYYYMMDD_COMPACT']}, "
              f"empty={audit['counts']['EMPTY_OR_NULL']}, unknown={audit['counts']['UNKNOWN_FORMAT']}")
        print(f"    Planned conversions: {audit['planned_conversions']}")
        if audit['blockers']:
            print(f"    ⚠️  BLOCKERS (will NOT be auto-converted): {len(audit['blockers'])}")
            for b in audit['blockers'][:5]:
                print(f"      id={b['id']} value='{b['value']}' format={b['format']}")

    # Summary before apply
    total_planned = sum(a['planned_conversions'] for a in audits)
    total_blockers = sum(len(a['blockers']) for a in audits)
    print(f"\n──────────────────────────────────────────────────────────")
    print(f"  Total rows to convert: {total_planned}")
    print(f"  Total blockers (UNKNOWN_FORMAT / EMPTY): {total_blockers}")
    if dry_run:
        print(f"\n  ℹ️  DRY-RUN mode: no changes will be made.")
        print(f"  Run with --apply to execute.")

    # Apply phase
    print("\n─── Phase 2: Normalization ───")
    total_converted = 0
    total_deduped = 0
    for audit in audits:
        c, d = apply_normalization(conn, audit, dry_run)
        total_converted += c
        total_deduped += d

    if not dry_run:
        print_after_state(conn)

    conn.close()
    print(f"\n✅ Done. Converted={total_converted}, Deduped={total_deduped}, Mode={'DRY-RUN' if dry_run else 'APPLIED'}")


if __name__ == '__main__':
    main()
