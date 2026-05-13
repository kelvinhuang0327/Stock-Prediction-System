"""
P4-02 — PIT-Safe Feature Foundation Builder
Builds a cross-table feature matrix for the Stock Prediction System.

Safety guarantees:
  - Read-only from prisma/dev.db (never writes)
  - All features computed using only data <= asof_date (PIT-safe)
  - Chip features use T+1 lag (date <= asof_date - 1 day)
  - Revenue/financial features use conservative announcement lag
  - Max output: 50 symbols x 120 trading days

Usage:
  python3 scripts/build-p4-feature-foundation.py --dry-run
  python3 scripts/build-p4-feature-foundation.py --output outputs/stock_data_expansion/p4_02_feature_matrix_sample.json
"""

import sqlite3
import json
import os
import sys
import argparse
from datetime import datetime, date, timedelta
from collections import defaultdict

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'prisma', 'dev.db')
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'outputs', 'stock_data_expansion')

MAX_SYMBOLS = 50
MAX_TRADING_DAYS = 120


# TWSE industry code → sector group mapping (heuristic)
INDUSTRY_SECTOR_MAP = {
    '01': ('水泥工業', 'Materials'), '02': ('食品工業', 'Consumer Staples'),
    '03': ('塑膠工業', 'Materials'), '04': ('紡織纖維', 'Consumer Discretionary'),
    '05': ('電機機械', 'Industrials'), '06': ('電器電纜', 'Industrials'),
    '07': ('化學工業', 'Materials'), '08': ('玻璃陶瓷', 'Materials'),
    '09': ('造紙工業', 'Materials'), '10': ('鋼鐵工業', 'Materials'),
    '11': ('橡膠工業', 'Materials'), '12': ('汽車工業', 'Consumer Discretionary'),
    '13': ('電子工業', 'Information Technology'), '14': ('建材營造', 'Real Estate'),
    '15': ('航運業', 'Industrials'), '16': ('觀光餐旅', 'Consumer Discretionary'),
    '17': ('金融保險', 'Financials'), '18': ('貿易百貨', 'Consumer Discretionary'),
    '19': ('綜合', 'Industrials'), '20': ('其他', 'Other'),
    '21': ('化學生技醫療', 'Health Care'), '22': ('電子零組件', 'Information Technology'),
    '23': ('電腦及週邊設備', 'Information Technology'), '24': ('光電', 'Information Technology'),
    '25': ('通信網路', 'Communication Services'), '26': ('電子通路', 'Information Technology'),
    '27': ('資訊服務', 'Information Technology'), '28': ('其他電子', 'Information Technology'),
    '29': ('文化創意', 'Communication Services'), '30': ('農業科技', 'Consumer Staples'),
    '31': ('電子商務', 'Communication Services'), '32': ('油電燃氣', 'Energy'),
    '33': ('居家生活', 'Consumer Discretionary'), '34': ('數位雲端', 'Information Technology'),
    '38': ('管理股票', 'Other'), '91': ('ETF', 'ETF'),
}

# Sector index patterns in MarketIndex table
INDUSTRY_TO_INDEX = {
    '01': '水泥類指數', '02': '食品類指數', '03': '塑膠類指數',
    '04': '紡織纖維類指數', '05': '電機機械類指數', '06': '電器電纜類指數',
    '07': '化學類指數', '08': '玻璃陶瓷類指數', '09': '造紙類指數',
    '10': '鋼鐵類指數', '11': '橡膠類指數', '12': '汽車類指數',
    '13': '電子類指數', '14': '建材營造類指數', '15': '航運類指數',
    '16': '觀光餐旅類指數', '17': '金融保險類指數', '21': '生技醫療類指數',
    '22': '電子零組件類指數', '23': '電腦及週邊設備類指數',
    '24': '光電類指數', '25': '通信網路類指數', '26': '電子通路類指數',
    '27': '資訊服務類指數', '28': '其他電子類指數',
    '32': '油電燃氣類指數', '33': '居家生活類指數', '34': '數位雲端類指數',
}


def load_taiex(conn, trading_dates):
    """Load TAIEX data for all relevant dates. Returns dict: date -> value."""
    cur = conn.cursor()
    placeholders = ','.join(['?'] * len(trading_dates))
    cur.execute(
        f"SELECT date, value FROM MarketIndex WHERE name='TAIEX' AND date IN ({placeholders}) ORDER BY date",
        trading_dates
    )
    return {r[0]: r[1] for r in cur.fetchall()}


def load_sector_returns(conn, trading_dates):
    """Load sector index returns for all relevant dates. Returns dict: (date, name) -> changePercent."""
    cur = conn.cursor()
    if not trading_dates:
        return {}
    placeholders = ','.join(['?'] * len(trading_dates))
    cur.execute(
        f"SELECT date, name, changePercent FROM MarketIndex WHERE date IN ({placeholders})",
        trading_dates
    )
    return {(r[0], r[1]): r[2] for r in cur.fetchall()}


def compute_ma(series, n):
    """Moving average over last n values (inclusive of current)."""
    if len(series) < n:
        return None
    return sum(series[-n:]) / n


def compute_std(returns, n):
    """Rolling std of last n returns."""
    if len(returns) < n:
        return None
    window = returns[-n:]
    mean = sum(window) / n
    variance = sum((x - mean) ** 2 for x in window) / n
    return variance ** 0.5


def get_trading_universe(conn, max_symbols):
    """Get top symbols by quote count (filtered to non-ETF, >=200d), capped at max_symbols."""
    cur = conn.cursor()
    cur.execute("""
        SELECT sq.stockId, count(*) as cnt, s.name, s.industry
        FROM StockQuote sq
        LEFT JOIN Stock s ON sq.stockId = s.id
        WHERE sq.date > '2010-01-01'
          AND sq.stockId NOT LIKE '00%'
        GROUP BY sq.stockId
        HAVING cnt >= 200
        ORDER BY cnt DESC
        LIMIT ?
    """, (max_symbols,))
    return cur.fetchall()


def build_feature_matrix(conn, universe, max_days):
    """Build PIT-safe feature matrix for given universe and last max_days trading dates."""
    cur = conn.cursor()

    # Get all valid trading dates in range (from StockQuote)
    cur.execute("""
        SELECT DISTINCT date FROM StockQuote
        WHERE date > '2010-01-01' AND date <= ?
        ORDER BY date DESC
        LIMIT ?
    """, (date.today().isoformat(), max_days))
    trading_dates = [r[0] for r in cur.fetchall()]
    trading_dates.sort()  # ascending

    if not trading_dates:
        return [], trading_dates

    taiex_map = load_taiex(conn, trading_dates)
    sector_returns_map = load_sector_returns(conn, trading_dates)

    # Precompute TAIEX series for rolling computations
    taiex_values = []
    for d in trading_dates:
        taiex_values.append(taiex_map.get(d))

    # Precompute TAIEX returns
    taiex_returns = []
    for i in range(len(taiex_values)):
        if i == 0 or taiex_values[i] is None or taiex_values[i - 1] is None:
            taiex_returns.append(None)
        else:
            taiex_returns.append((taiex_values[i] - taiex_values[i - 1]) / taiex_values[i - 1])

    rows = []
    stock_ids = [r[0] for r in universe]
    stock_meta = {r[0]: {'name': r[2], 'industry': r[3]} for r in universe}

    # Load StockQuote for all stocks in range
    placeholders_s = ','.join(['?'] * len(stock_ids))
    cur.execute(f"""
        SELECT stockId, date, close, volume
        FROM StockQuote
        WHERE stockId IN ({placeholders_s})
          AND date IN ({','.join(['?']*len(trading_dates))})
        ORDER BY stockId, date
    """, stock_ids + trading_dates)

    sq_data = defaultdict(dict)
    for stockId, d, close, volume in cur.fetchall():
        sq_data[stockId][d] = (close, volume)

    # Market breadth by date
    cur.execute("""
        SELECT date, count(*) as total, sum(CASE WHEN change > 0 THEN 1 ELSE 0 END) as up
        FROM StockQuote
        WHERE date IN ({})
        GROUP BY date
    """.format(','.join(['?'] * len(trading_dates))), trading_dates)
    breadth_map = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    for stock_id in stock_ids:
        meta = stock_meta[stock_id]
        industry = meta['industry']
        ind_name, sector = INDUSTRY_SECTOR_MAP.get(str(industry), ('Unknown', 'Unknown')) if industry else ('Unknown', 'Unknown')
        sector_idx_name = INDUSTRY_TO_INDEX.get(str(industry)) if industry else None

        close_series = []
        volume_series = []
        return_series = []

        for i, td in enumerate(trading_dates):
            quote = sq_data[stock_id].get(td)
            close = quote[0] if quote else None
            volume = quote[1] if quote else None

            close_series.append(close)
            volume_series.append(volume)

            daily_return = None
            if len(close_series) >= 2 and close_series[-1] is not None and close_series[-2] is not None:
                daily_return = (close_series[-1] - close_series[-2]) / close_series[-2]
            return_series.append(daily_return)

            # Price features
            close_series_clean = [c for c in close_series if c is not None]
            volume_series_clean = [v for v in volume_series if v is not None]
            return_series_clean = [r for r in return_series if r is not None]

            ma20 = compute_ma(close_series_clean, 20)
            ma60 = compute_ma(close_series_clean, 60)
            vol_ma20 = compute_ma(volume_series_clean, 20)

            close_to_ma20 = round((close / ma20 - 1), 6) if close and ma20 else None
            close_to_ma60 = round((close / ma60 - 1), 6) if close and ma60 else None
            volume_ratio_20d = round(volume / vol_ma20, 4) if volume and vol_ma20 else None
            volatility_20d = round(compute_std(return_series_clean, 20), 6) if len(return_series_clean) >= 20 else None
            volatility_60d = round(compute_std(return_series_clean, 60), 6) if len(return_series_clean) >= 60 else None

            # TAIEX features
            taiex_close = taiex_map.get(td)
            taiex_return_1d = taiex_returns[i]
            taiex_values_to_i = [v for v in taiex_values[:i + 1] if v is not None]
            taiex_returns_to_i = [r for r in taiex_returns[:i + 1] if r is not None]
            taiex_ma50 = compute_ma(taiex_values_to_i, 50)
            taiex_ma200 = compute_ma(taiex_values_to_i, 200)
            taiex_return_20d = None
            if len(taiex_values_to_i) >= 21 and taiex_values_to_i[-1] and taiex_values_to_i[-21]:
                taiex_return_20d = (taiex_values_to_i[-1] - taiex_values_to_i[-21]) / taiex_values_to_i[-21]
            taiex_volatility_20d = round(compute_std(taiex_returns_to_i, 20), 6) if len(taiex_returns_to_i) >= 20 else None

            # Market breadth proxy
            breadth = breadth_map.get(td)
            market_breadth_proxy = round(breadth[1] / breadth[0], 4) if breadth and breadth[0] else None

            # Sector index return
            sector_idx_return = sector_returns_map.get((td, sector_idx_name)) if sector_idx_name else None

            # Availability flags
            flags = {}
            if quote is None:
                flags['price_data'] = 'MISSING_QUOTE_FOR_DATE'
            if len(close_series_clean) < 20:
                flags['ma20'] = 'INSUFFICIENT_HISTORY'
            if len(close_series_clean) < 60:
                flags['ma60_vol60'] = 'INSUFFICIENT_HISTORY'
            if taiex_close is None:
                flags['taiex'] = 'MISSING_TAIEX_FOR_DATE'
            if sector_idx_return is None:
                flags['sector_index_return'] = 'MISSING_OR_NO_MAPPING'
            flags['chip_features'] = 'PROTOTYPE_ONLY_236D'
            flags['revenue_features'] = 'INSUFFICIENT_HISTORY_2_MONTHS'
            flags['financial_features'] = 'LIMITED_COVERAGE_1_QUARTER'

            row = {
                'asof_date': td,
                'stock_id': stock_id,
                'stock_name': meta['name'],
                'industry': industry,
                'industry_name': ind_name,
                'sector_group': sector,
                'is_etf': stock_id.startswith('00'),
                'close': round(close, 2) if close else None,
                'volume': round(volume, 0) if volume else None,
                'daily_return': round(daily_return, 6) if daily_return else None,
                'close_to_ma20': close_to_ma20,
                'close_to_ma60': close_to_ma60,
                'volume_ratio_20d': volume_ratio_20d,
                'volatility_20d': volatility_20d,
                'volatility_60d': volatility_60d,
                'taiex_close': round(taiex_close, 2) if taiex_close else None,
                'taiex_return_1d': round(taiex_return_1d, 6) if taiex_return_1d else None,
                'taiex_return_20d': round(taiex_return_20d, 6) if taiex_return_20d else None,
                'taiex_ma50': round(taiex_ma50, 2) if taiex_ma50 else None,
                'taiex_ma200': round(taiex_ma200, 2) if taiex_ma200 else None,
                'taiex_volatility_20d': taiex_volatility_20d,
                'market_breadth_proxy': market_breadth_proxy,
                'sector_index_return': round(sector_idx_return, 4) if sector_idx_return else None,
                # Chip: null — PROTOTYPE_ONLY, 236 days insufficient
                'foreign_net_buy': None,
                'investment_trust_net_buy': None,
                'dealer_net_buy': None,
                'chip_net_buy_5d': None,
                # Revenue: null — INSUFFICIENT_HISTORY, 2 months only
                'revenue_yoy': None,
                'revenue_mom': None,
                # Financial: null — LIMITED_COVERAGE, 1 quarter only
                'eps': None,
                'feature_availability_flags': flags,
            }
            rows.append(row)

    return rows, trading_dates


def main():
    parser = argparse.ArgumentParser(description='P4-02 PIT-Safe Feature Foundation Builder')
    parser.add_argument('--dry-run', action='store_true', default=False,
                        help='Dry-run mode: show what would be built without writing output (default)')
    parser.add_argument('--output', type=str, default=None,
                        help='Output JSON file path')
    args = parser.parse_args()

    # If neither flag is given, default to dry-run
    if not args.dry_run and args.output is None:
        args.dry_run = True

    print('=' * 60)
    print('P4-02 PIT-Safe Feature Foundation Builder')
    print(f'DB: {DB_PATH}')
    print(f'Mode: {"DRY-RUN" if args.dry_run else "OUTPUT -> " + str(args.output)}')
    print('=' * 60)

    conn = sqlite3.connect(DB_PATH)

    universe = get_trading_universe(conn, MAX_SYMBOLS)
    print(f'\nUniverse: {len(universe)} symbols (top {MAX_SYMBOLS} by quote count, non-ETF, >=200d)')

    if args.dry_run:
        print('\nDRY-RUN: Previewing feature matrix...')
        # Build a small sample (5 symbols x 5 days) to validate logic
        mini = universe[:5]
        rows, trading_dates = build_feature_matrix(conn, mini, 5)
        conn.close()
        print(f'Sample dates: {trading_dates}')
        print(f'Sample rows computed: {len(rows)}')
        if rows:
            sample = rows[-1]
            print(f'\nSample row (last):')
            for k, v in sample.items():
                if k != 'feature_availability_flags':
                    print(f'  {k}: {v}')
            print(f"  feature_availability_flags: {sample['feature_availability_flags']}")
        print('\nDRY-RUN COMPLETE — no output written.')
        print(f'Full run would produce: up to {MAX_SYMBOLS} symbols x {MAX_TRADING_DAYS} trading days = up to {MAX_SYMBOLS * MAX_TRADING_DAYS} rows')
        return

    # Full run
    print(f'\nBuilding feature matrix: {len(universe)} symbols x last {MAX_TRADING_DAYS} trading days...')
    rows, trading_dates = build_feature_matrix(conn, universe, MAX_TRADING_DAYS)
    conn.close()

    print(f'Total rows computed: {len(rows)}')
    print(f'Date range: {trading_dates[0] if trading_dates else "N/A"} -> {trading_dates[-1] if trading_dates else "N/A"}')
    print(f'Symbols: {len(universe)}')

    # Validate: no future dates
    today_str = date.today().isoformat()
    future_rows = [r for r in rows if r['asof_date'] > today_str]
    if future_rows:
        print(f'WARNING: {len(future_rows)} rows have future dates — this should not happen')
    else:
        print('PIT check: No future dates in output. PASS')

    output = {
        'program': 'Stock Prediction System',
        'task': 'P4-02 PIT-Safe Feature Matrix Sample',
        'generated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'pit_safety': 'All features computed using only data <= asof_date',
        'constraints': {
            'max_symbols': MAX_SYMBOLS,
            'max_trading_days': MAX_TRADING_DAYS,
            'actual_symbols': len(universe),
            'actual_trading_days': len(trading_dates),
            'total_rows': len(rows),
        },
        'feature_availability_notes': {
            'chip_features': 'NULL — InstitutionalChip only 236 trading days (need 500). PROTOTYPE_ONLY.',
            'revenue_features': 'NULL — MonthlyRevenue only 2 months (need 13+). INSUFFICIENT_HISTORY.',
            'financial_features': 'NULL — FinancialReport only 2025-Q4 (need 8+ quarters). LIMITED_COVERAGE.',
            'roe_debt_ratio': 'NULL — schema missing equity/balance-sheet fields. BLOCKED.',
        },
        'date_range': {
            'first_date': trading_dates[0] if trading_dates else None,
            'last_date': trading_dates[-1] if trading_dates else None,
        },
        'rows': rows,
    }

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f'\nOutput written: {args.output}')
    print('DONE.')


if __name__ == '__main__':
    main()
