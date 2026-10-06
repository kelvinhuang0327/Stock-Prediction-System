"""
Bulk Historical Data Sync — 批量歷史資料補齊腳本

目的：讓至少 50 檔主要股票具備 >=250 天歷史日線，
      讓 MarketIndex 有 >=250 天大盤指數，
      讓 InstitutionalChip 擴充覆蓋率。

資料來源：
  - twstock Python library (StockQuote 歷史)
  - TWSE OpenAPI (MarketIndex, InstitutionalChip)
  - TWSE afterTrading API (月度歷史資料)

用法：
  python scripts/bulk-history-sync.py --phase quote     # StockQuote
  python scripts/bulk-history-sync.py --phase index      # MarketIndex  
  python scripts/bulk-history-sync.py --phase chip       # InstitutionalChip
  python scripts/bulk-history-sync.py --phase all        # 全部
  python scripts/bulk-history-sync.py --phase report     # 只輸出報告
"""

import sys
import os
import sqlite3
import json
import time
import argparse
from datetime import datetime, timedelta, date

try:
    import twstock
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "twstock"])
    import twstock

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prisma', 'dev.db')

# 主要股票池 (台灣市場最重要的 80 檔股票)
# 涵蓋: 台灣50成分股 + 熱門中小型 + 金融股 + 傳產龍頭
PRIORITY_STOCKS = [
    # 半導體 / 電子
    '2330', '2454', '2303', '3711', '2379',  # 台積電, 聯發科, 聯電, 日月光, 瑞昱
    '3034', '2308', '5274', '3037', '6415',  # 聯詠, 台達電, 信驊, 欣興, 矽力-KY
    '2382', '3661', '2357', '2395', '6669',  # 廣達, 世芯-KY, 華碩, 研華, 緯穎
    '4938', '2356', '3008', '2347', '6770',  # 和碩, 英業達, 大立光, 聯強, 力積電
    '3529', '5347', '2301', '2412',           # 力旺, 世界, 光寶科, 中華電
    # 金融
    '2881', '2882', '2884', '2886', '2887',  # 富邦金, 國泰金, 玉山金, 兆豐金, 台新金
    '2891', '2880', '2883', '2885', '2890',  # 中信金, 華南金, 開發金, 元大金, 永豐金
    # 傳產 / 航運 / 鋼鐵
    '2603', '2615', '2609', '1301', '1303',  # 長榮, 萬海, 陽明, 台塑, 南亞
    '1326', '1101', '1102', '2002', '2207',  # 台化, 台泥, 亞泥, 中鋼, 和泰車
    '1216', '2912', '5880', '9904', '2327',  # 統一, 統一超, 合庫金, 寶成, 國巨
    # 生技 / 其他
    '6505', '4904', '3045', '2345', '9910',  # 台塑化, 遠傳, 台灣大, 智邦, 豐泰
    '2317', '1504', '2474', '2377', '5876',  # 鴻海, 東元, 可成, 微星, 上海商銀
    # 原有有資料的股票
    '2451', '8374', '1503', '1519',
    # 額外補充
    '2344', '2408', '3006', '4967', '6531',
]

# 去重
PRIORITY_STOCKS = list(dict.fromkeys(PRIORITY_STOCKS))


class BulkHistorySync:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.stats = {'inserted': 0, 'skipped': 0, 'errors': 0}

    def close(self):
        if self.conn:
            self.conn.close()

    # ─── Phase 1: StockQuote ───

    def sync_stock_quotes(self, stock_id: str, start_year: int, start_month: int):
        """用 TWSE afterTrading/STOCK_DAY 直接同步歷史日線"""
        cursor = self.conn.cursor()
        total_inserted = 0

        # Generate month list from start to now
        now = datetime.now()
        y, m = start_year, start_month

        while (y < now.year) or (y == now.year and m <= now.month):
            try:
                date_str = f"{y}{m:02d}01"
                url = f"https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date={date_str}&stockNo={stock_id}&response=json"
                resp = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})

                # Detect rate limiting
                if resp.status_code in (307, 403, 429):
                    print(f"\n    ⏳ Rate limited, waiting 60s...", end="", flush=True)
                    time.sleep(60)
                    # Check again
                    resp2 = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
                    if resp2.status_code in (307, 403, 429):
                        return -1  # Signal caller we're blocked
                    resp = resp2

                if resp.status_code != 200:
                    m += 1
                    if m > 12:
                        m = 1; y += 1
                    time.sleep(3)
                    continue

                data = resp.json()
                if data.get('stat') != 'OK' or not data.get('data'):
                    m += 1
                    if m > 12:
                        m = 1; y += 1
                    time.sleep(2)
                    continue

                for row in data['data']:
                    try:
                        # [日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數, 註記]
                        roc_date = row[0].strip()  # "114/01/02"
                        parts = roc_date.split('/')
                        ad_year = int(parts[0]) + 1911
                        iso_date = f"{ad_year}-{parts[1]}-{parts[2]}"

                        def clean_num(s):
                            s = s.replace(',', '').replace('--', '0').replace('+', '').replace('X', '0').strip()
                            return float(s) if s else 0

                        volume = clean_num(row[1])    # 成交股數
                        trade_val = clean_num(row[2])  # 成交金額
                        open_p = clean_num(row[3])
                        high_p = clean_num(row[4])
                        low_p = clean_num(row[5])
                        close_p = clean_num(row[6])
                        change = clean_num(row[7])
                        transactions = int(clean_num(row[8]))

                        if close_p <= 0:
                            continue

                        cursor.execute(
                            "INSERT OR REPLACE INTO StockQuote "
                            "(stockId, date, open, high, low, close, volume, tradeValue, change, transactions, createdAt) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                            (stock_id, iso_date, open_p, high_p, low_p, close_p, volume, trade_val, change, transactions)
                        )
                        total_inserted += 1
                    except Exception:
                        continue

                self.conn.commit()

            except Exception as e:
                self.stats['errors'] += 1

            m += 1
            if m > 12:
                m = 1; y += 1
            time.sleep(3)  # Conservative rate limit between months

        return total_inserted

    def run_quote_sync(self, stocks=None, years_back=2):
        """批量同步 StockQuote 歷史 — with resilient rate limiting"""
        if stocks is None:
            stocks = PRIORITY_STOCKS

        # 確認股票在 Stock 表中存在
        cursor = self.conn.cursor()
        cursor.execute("SELECT id FROM Stock")
        existing_ids = set(row[0] for row in cursor.fetchall())

        valid_stocks = [s for s in stocks if s in existing_ids]
        print(f"\n📊 StockQuote 批量同步")
        print(f"   目標股票數: {len(valid_stocks)} (篩掉 {len(stocks) - len(valid_stocks)} 筆不存在的代號)")

        # Skip stocks that already have enough data
        cursor.execute("""
            SELECT stockId, count(*) as days FROM StockQuote 
            GROUP BY stockId HAVING days >= 250
        """)
        already_done = set(row[0] for row in cursor.fetchall())
        valid_stocks = [s for s in valid_stocks if s not in already_done]
        if already_done:
            print(f"   跳過已有 ≥250 天的: {len(already_done)} 檔")

        now = datetime.now()
        start_year = now.year - years_back
        start_month = now.month

        print(f"   日期範圍: {start_year}/{start_month:02d} ~ {now.year}/{now.month:02d}")
        print(f"   剩餘 {len(valid_stocks)} 檔待同步\n")

        total_inserted = 0
        success = 0
        consecutive_blocked = 0

        for i, sid in enumerate(valid_stocks, 1):
            print(f"  [{i:3d}/{len(valid_stocks)}] {sid}...", end=" ", flush=True)

            # Check if API is blocked before trying
            if consecutive_blocked >= 3:
                print(f"\n  ⏳ TWSE 封鎖中，等待 120 秒...")
                time.sleep(120)
                consecutive_blocked = 0

            count = self.sync_stock_quotes(sid, start_year, start_month)
            if count > 0:
                print(f"✅ {count} 筆")
                total_inserted += count
                success += 1
                consecutive_blocked = 0
            elif count == -1:  # rate limited
                consecutive_blocked += 1
                print("🚫 被封鎖")
            else:
                print("⚠️ 無資料")

            # Rate limit: 5 秒間隔避免被 TWSE 封鎖
            time.sleep(5)

        self.stats['inserted'] += total_inserted
        print(f"\n  ✅ StockQuote 完成: {success}/{len(valid_stocks)} 檔成功, 共 {total_inserted:,} 筆\n")

    # ─── Phase 2: MarketIndex ───

    def sync_market_index_month(self, year: int, month: int):
        """同步一個月的大盤指數資料 — 直接使用 FMTQIK endpoint"""
        return self._sync_taiex_daily(year, month)

    def _sync_taiex_daily(self, year: int, month: int):
        """透過 TWSE FMTQIK 每日收盤行情取得加權指數
        
        MarketIndex schema: name, date, value, change, changePercent
        """
        date_str = f"{year}{month:02d}01"
        url = f"https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date={date_str}&response=json"

        try:
            resp = requests.get(url, timeout=15, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
            })
            if resp.status_code != 200:
                return 0

            data = resp.json()
            if data.get('stat') != 'OK' or not data.get('data'):
                return 0

            cursor = self.conn.cursor()
            inserted = 0

            for row in data['data']:
                try:
                    # FMTQIK: [日期(ROC), 成交股數, 成交金額, 成交筆數, 加權指數, 漲跌點數]
                    roc_date = row[0].strip()  # e.g. "114/01/02"
                    parts = roc_date.split('/')
                    ad_year = int(parts[0]) + 1911
                    iso_date = f"{ad_year}-{parts[1]}-{parts[2]}"

                    index_str = row[4].replace(',', '') if len(row) > 4 else '0'
                    change_str = row[5].replace(',', '') if len(row) > 5 else '0'

                    value = float(index_str) if index_str else 0
                    change_val = float(change_str) if change_str else 0

                    if value <= 0:
                        continue

                    # Calculate changePercent
                    prev_value = value - change_val
                    change_pct = (change_val / prev_value * 100) if prev_value > 0 else 0

                    cursor.execute(
                        "INSERT OR REPLACE INTO MarketIndex "
                        "(name, date, value, change, changePercent, createdAt) "
                        "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                        ('TAIEX', iso_date, value, change_val, round(change_pct, 2))
                    )
                    inserted += 1
                except Exception:
                    continue

            self.conn.commit()
            return inserted
        except Exception as e:
            print(f"    ❌ index {year}/{month}: {e}")
            return 0

    def run_index_sync(self, years_back=3):
        """批量同步 MarketIndex 歷史"""
        print(f"\n📊 MarketIndex 批量同步")

        now = datetime.now()
        months = []
        for y_offset in range(years_back, -1, -1):
            y = now.year - y_offset
            start_m = 1
            end_m = 12 if y < now.year else now.month
            for m in range(start_m, end_m + 1):
                months.append((y, m))

        print(f"   月份範圍: {months[0][0]}/{months[0][1]:02d} ~ {months[-1][0]}/{months[-1][1]:02d}")
        print(f"   共 {len(months)} 個月\n")

        total_inserted = 0
        for i, (y, m) in enumerate(months, 1):
            print(f"  [{i:3d}/{len(months)}] {y}/{m:02d}...", end=" ", flush=True)
            count = self.sync_market_index_month(y, m)
            if count > 0:
                print(f"✅ {count} 筆")
                total_inserted += count
            else:
                print("⚠️ 無資料")
            time.sleep(2)  # Rate limit

        print(f"\n  ✅ MarketIndex 完成: 共 {total_inserted:,} 筆\n")

    # ─── Phase 3: InstitutionalChip ───

    def sync_institutional_day(self, date_str: str):
        """同步一天的法人買賣超資料 (YYYYMMDD format)
        
        InstitutionalChip schema: stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy
        (these store NET buy amounts, not separate buy/sell)
        """
        url = f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_str}&selectType=ALL&response=json"

        try:
            resp = requests.get(url, timeout=15, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
            })
            if resp.status_code != 200:
                return 0

            data = resp.json()
            if data.get('stat') != 'OK' or not data.get('data'):
                return 0

            cursor = self.conn.cursor()
            inserted = 0
            iso_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

            # Only process stocks that exist in Stock table
            cursor.execute("SELECT id FROM Stock")
            valid_ids = set(row[0] for row in cursor.fetchall())

            for row in data['data']:
                try:
                    stock_id = row[0].strip()
                    if stock_id not in valid_ids:
                        continue

                    def parse_num(s):
                        if not s:
                            return 0
                        return int(s.replace(',', '').replace(' ', ''))

                    # T86 columns: 證券代號,證券名稱,外陸資買進股數,外陸資賣出股數,外陸資買賣超股數,
                    #   投信買進股數,投信賣出股數,投信買賣超股數,自營商買進股數,自營商賣出股數,自營商買賣超股數,...
                    foreign_buy = parse_num(row[2]) if len(row) > 2 else 0
                    foreign_sell = parse_num(row[3]) if len(row) > 3 else 0
                    trust_buy = parse_num(row[5]) if len(row) > 5 else 0
                    trust_sell = parse_num(row[6]) if len(row) > 6 else 0
                    dealer_buy = parse_num(row[8]) if len(row) > 8 else 0
                    dealer_sell = parse_num(row[9]) if len(row) > 9 else 0

                    # Convert to 張 (shares / 1000) and store NET amounts
                    net_foreign = round((foreign_buy - foreign_sell) / 1000)
                    net_trust = round((trust_buy - trust_sell) / 1000)
                    net_dealer = round((dealer_buy - dealer_sell) / 1000)
                    net_total = net_foreign + net_trust + net_dealer

                    cursor.execute(
                        "INSERT OR REPLACE INTO InstitutionalChip "
                        "(stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy, createdAt) "
                        "VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                        (stock_id, iso_date, net_foreign, net_trust, net_dealer, net_total)
                    )
                    inserted += 1
                except Exception:
                    continue

            self.conn.commit()
            return inserted
        except Exception as e:
            print(f"    ❌ chip {date_str}: {e}")
            return 0

    def run_chip_sync(self, days_back=60):
        """批量同步 InstitutionalChip 歷史"""
        print(f"\n📊 InstitutionalChip 批量同步")

        # 建立交易日清單 (排除週末)
        trade_dates = []
        d = datetime.now()
        while len(trade_dates) < days_back:
            d -= timedelta(days=1)
            if d.weekday() < 5:  # Mon-Fri
                trade_dates.append(d.strftime('%Y%m%d'))

        trade_dates.reverse()
        print(f"   日期範圍: {trade_dates[0]} ~ {trade_dates[-1]}")
        print(f"   共 {len(trade_dates)} 個交易日\n")

        total_inserted = 0
        for i, date_str in enumerate(trade_dates, 1):
            print(f"  [{i:3d}/{len(trade_dates)}] {date_str}...", end=" ", flush=True)
            count = self.sync_institutional_day(date_str)
            if count > 0:
                print(f"✅ {count} 筆")
                total_inserted += count
            else:
                print("⚠️ 無資料/非交易日")
            time.sleep(2)  # Rate limit

        print(f"\n  ✅ InstitutionalChip 完成: 共 {total_inserted:,} 筆\n")

    # ─── Report ───

    def print_report(self):
        """輸出完整 coverage 報告"""
        cursor = self.conn.cursor()
        print("\n" + "=" * 70)
        print("📊 資料 Coverage 報告")
        print("=" * 70)

        # StockQuote
        cursor.execute("SELECT count(*) FROM StockQuote")
        total_q = cursor.fetchone()[0]
        cursor.execute("""
            SELECT stockId, count(*) as days
            FROM StockQuote GROUP BY stockId ORDER BY days DESC
        """)
        stock_coverage = cursor.fetchall()

        ge250 = [s for s, d in stock_coverage if d >= 250]
        ge100 = [s for s, d in stock_coverage if d >= 100]
        ge60  = [s for s, d in stock_coverage if d >= 60]
        ge20  = [s for s, d in stock_coverage if d >= 20]

        print(f"\n[StockQuote]")
        print(f"  總筆數: {total_q:,}")
        print(f"  有資料的股票: {len(stock_coverage)}")
        print(f"  ≥250 天 (技術分析): {len(ge250)} 檔")
        print(f"  ≥100 天 (回測最低): {len(ge100)} 檔")
        print(f"  ≥60  天 (MA60):     {len(ge60)} 檔")
        print(f"  ≥20  天 (基本分析): {len(ge20)} 檔")
        if ge250:
            print(f"  ≥250 天股票: {', '.join(ge250[:20])}{'...' if len(ge250) > 20 else ''}")

        cursor.execute("SELECT MIN(date), MAX(date) FROM StockQuote")
        min_d, max_d = cursor.fetchone()
        print(f"  日期範圍: {min_d} ~ {max_d}")

        # MarketIndex
        cursor.execute("SELECT count(*) FROM MarketIndex WHERE name = 'TAIEX'")
        taiex_count = cursor.fetchone()[0]
        cursor.execute("SELECT count(*) FROM MarketIndex")
        total_idx = cursor.fetchone()[0]
        cursor.execute("SELECT MIN(date), MAX(date) FROM MarketIndex WHERE name = 'TAIEX'")
        row = cursor.fetchone()
        idx_min, idx_max = row if row else (None, None)

        print(f"\n[MarketIndex]")
        print(f"  總筆數: {total_idx:,}")
        print(f"  加權指數筆數: {taiex_count}")
        print(f"  加權指數日期: {idx_min} ~ {idx_max}")
        print(f"  可支撐 Benchmark: {'✅ 是' if taiex_count >= 250 else '❌ 否 (需 ≥250 天)'}")

        # InstitutionalChip
        cursor.execute("SELECT count(*) FROM InstitutionalChip")
        total_chip = cursor.fetchone()[0]
        cursor.execute("SELECT count(DISTINCT stockId) FROM InstitutionalChip")
        chip_stocks = cursor.fetchone()[0]
        cursor.execute("SELECT count(DISTINCT date) FROM InstitutionalChip")
        chip_dates = cursor.fetchone()[0]
        cursor.execute("SELECT MIN(date), MAX(date) FROM InstitutionalChip")
        chip_range = cursor.fetchone()

        print(f"\n[InstitutionalChip]")
        print(f"  總筆數: {total_chip:,}")
        print(f"  覆蓋股票數: {chip_stocks}")
        print(f"  覆蓋交易日: {chip_dates}")
        print(f"  日期範圍: {chip_range[0]} ~ {chip_range[1]}" if chip_range[0] else "  日期範圍: 無")
        print(f"  可支撐法人排行: {'✅ 是' if chip_stocks >= 20 and chip_dates >= 5 else '❌ 否'}")

        # Date format check
        cursor.execute("SELECT date FROM StockQuote WHERE length(date) = 7 LIMIT 1")
        has_roc = cursor.fetchone()
        cursor.execute("SELECT date FROM StockQuote WHERE length(date) = 8 LIMIT 1")
        has_yyyymmdd = cursor.fetchone()
        cursor.execute("SELECT date FROM StockQuote WHERE length(date) = 10 LIMIT 1")
        has_iso = cursor.fetchone()

        print(f"\n[日期格式]")
        if has_roc: print(f"  ⚠️ ROC 7碼格式存在 (e.g. {has_roc[0]})")
        if has_yyyymmdd: print(f"  ⚠️ YYYYMMDD 格式存在 (e.g. {has_yyyymmdd[0]})")
        if has_iso: print(f"  ✅ ISO 格式存在 (e.g. {has_iso[0]})")

        print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(description='批量歷史資料補齊')
    parser.add_argument('--phase', choices=['quote', 'index', 'chip', 'all', 'report'],
                        default='report', help='同步階段')
    parser.add_argument('--years', type=int, default=2, help='StockQuote 回溯年數 (預設 2)')
    parser.add_argument('--chip-days', type=int, default=60, help='InstitutionalChip 回溯天數 (預設 60)')
    parser.add_argument('--limit', type=int, help='限制股票數量 (測試用)')
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("🚀 批量歷史資料補齊腳本")
    print(f"   DB: {DB_PATH}")
    print("=" * 70)

    syncer = BulkHistorySync()

    try:
        if args.phase in ('quote', 'all'):
            stocks = PRIORITY_STOCKS[:args.limit] if args.limit else PRIORITY_STOCKS
            syncer.run_quote_sync(stocks=stocks, years_back=args.years)

        if args.phase in ('index', 'all'):
            syncer.run_index_sync(years_back=3)

        if args.phase in ('chip', 'all'):
            syncer.run_chip_sync(days_back=args.chip_days)

        # Always print report
        syncer.print_report()

    except KeyboardInterrupt:
        print("\n⚠️ 中斷！已同步的資料已保存。")
        syncer.print_report()
    except Exception as e:
        print(f"\n❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        syncer.close()


if __name__ == '__main__':
    main()
