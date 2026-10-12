"""
StockQuote Expansion Backfill — 股票池擴充腳本

目標：將 StockQuote 覆蓋從 65 檔提升到 200+ 檔

優先策略：
  Tier 1: ETF + 主要指數成分股 + 已有法人資料且交易最活躍前 80
  Tier 2: 次要活躍股 (下一批 70 檔)
  Tier 3: 其餘 (不在本次範圍)

資料來源：TWSE STOCK_DAY (afterTrading) API
資料期間：預設 2 年歷史 (可透過 --years 調整)
用法：
  python scripts/expand-stock-quotes.py              # Tier 1 (約 100 檔)
  python scripts/expand-stock-quotes.py --tier 2    # Tier 1+2 (約 170 檔)
  python scripts/expand-stock-quotes.py --resume    # 只補 missing，跳過已有 >=250 天的
  python scripts/expand-stock-quotes.py --report    # 只印 coverage report
  python scripts/expand-stock-quotes.py --limit 20  # 測試用：只跑前 20 檔
"""

import sqlite3
import requests
import time
import sys
import argparse
from datetime import datetime, timedelta
from typing import Optional

DB_PATH = 'prisma/dev.db'

# ─── Stock Pools ────────────────────────────────────────────────────────────

# Tier 1: ETFs + Taiwan 50 + 主要金融/電子/傳產 + 已有法人資料最活躍前 80
TIER_1 = [
    # Key ETFs (研究常用)
    '0050', '0051', '0052', '0053', '0056', '0057',
    '006208', '00878', '00713', '00900', '006204', '00692',

    # Top active by InstitutionalChip (missing from StockQuote)
    # 金融
    '2892',  # 第一金
    '2801',  # 彰銀
    '2834',  # 臺企銀
    '2812',  # 台中銀
    '2838',  # 聯邦銀
    '2867',  # 三商壽
    '5871',  # 中租-KY
    '6005',  # 群益證
    '2409',  # 友達

    # 電子/半導體/零組件
    '3481',  # 群創
    '2337',  # 旺宏
    '2353',  # 宏碁
    '2313',  # 華通
    '2324',  # 仁寶
    '3231',  # 緯創
    '2449',  # 京元電子
    '4958',  # 臻鼎-KY
    '3702',  # 大聯大
    '2312',  # 金寶
    '3715',  # 定穎投控
    '8150',  # 南茂
    '2371',  # 大同
    '6282',  # 康舒
    '6116',  # 彩晶
    '8112',  # 至上
    '3706',  # 神達
    '2481',  # 強茂
    '3189',  # 景碩
    '2404',  # 漢唐
    '2376',  # 技嘉
    '3036',  # 文曄
    '2393',  # 億光
    '6257',  # 矽格
    '3044',  # 健鼎
    '2368',  # 金像電
    '2439',  # 美律
    '2360',  # 致茂
    '3005',  # 神基
    '2455',  # 全新
    '6412',  # 元創精機

    # 傳產/航運/材料
    '1605',  # 華新
    '2610',  # 華航
    '2618',  # 長榮航
    '1802',  # 台玻
    '1314',  # 中石化
    '2105',  # 正新
    '1402',  # 遠東新
    '9945',  # 潤泰新
    '2504',  # 國產
    '2542',  # 興富發
    '2027',  # 大成鋼
    '1717',  # 長興
    '2606',  # 裕民
    '2915',  # 潤泰全
    '2385',  # 群光
    '6239',  # 力成
    '2520',  # 冠德

    # 生技/醫療
    '4746',  # 合富-KY
    '4163',  # 鐿鈦
    '1789',  # 神隆
    '6446',  # 藥華藥

    # 其他科技
    '3042',  # 晶技
    '2903',  # 遠百
    '3090',  # 日電貿
    '6285',  # 啟碁
    '6670',  # 復盛應用
    '6757',  # 昇佳電子
    '3592',  # 瑞鼎
    '2383',  # 台光電
    '5388',  # 中磊
    '6805',  # 富世達
    '6177',  # 達麗
    '8021',  # 尖點
    '2006',  # 東和鋼鐵
    '9907',  # 統一實
    '2206',  # 三陽工業
    '3653',  # 健策
    '1722',  # 台肥
    '1210',  # 大成
    '1513',  # 中興電
    '1795',  # 美時
    '1434',  # 福懋
    '2492',  # 華新科
    '8016',  # 矽創
    '9938',  # 百和
    '2637',  # 慧洋-KY
    '2607',  # 榮運
    '3450',  # 聯鈞
]

# Tier 2: 次要活躍股 (補滿 200 檔用)
TIER_2 = [
    '6196',  # 帆宣
    '8210',  # 勤誠
    '3030',  # 德律
    '4763',  # 材料-KY
    '1477',  # 聚陽
    '3017',  # 奇鋐
    '6278',  # 台表科
    '8046',  # 南電
    '4915',  # 致伸
    '3665',  # 貿聯-KY
    '1808',  # 潤泰新
    '1319',  # 東陽
    '2458',  # 義隆
    '8070',  # 長華電材
    '6191',  # 精成科
    '6176',  # 瑞儀
    '3005',  # 神基
    '2441',  # 超豐
    '6139',  # 元鼎
    '1560',  # 中砂
    '6196',  # 帆宣
    '2838',  # 聯邦銀
    '3653',  # 健策
    '2406',  # 國碩
    '2323',  # 中環
    '2329',  # 華泰
    '8039',  # 台虹
    '9941',  # 裕融
    '6412',  # 元創精機
    '2367',  # 燿華
    '6191',  # 精成科
    '8028',  # 昇陽
    '3706',  # 神達
    '2485',  # 兆赫
    '8110',  # 華東
    '2605',  # 新興
    '3576',  # 聯合再生
    '1442',  # 名軒
    '2638',  # 海峽交流基金會
    '4953',  # 緯軟
    '2501',  # 國建
    '2014',  # 中鴻
    '1308',  # 亞聚
    '1710',  # 東聯
    '2816',  # 旺旺保
    '6488',  # 環球晶
    '3008',  # 大立光  (already have, skip)
    '6669',  # 緯穎   (already have)
    '2383',  # 台光電
    '8150',  # 南茂
    '2458',  # 義隆電
    '6533',  # 晶心科
    '6456',  # 奇翔
    '3034',  # 聯詠 (already have)
    '2543',  # 皇昌
    '1907',  # 永豐餘
    '1904',  # 正隆
    '1903',  # 士紙
    '6415',  # 矽力-KY (already have)
    '5211',  # 蒙恬科技
    '6456',  # 奇翔
    '3657',  # 金致科技
    '1536',  # 和大
    '1598',  # 岱宇
    '4961',  # 天鈺
    '6669',  # 緯穎 (dup)
    '3152',  # 璟德
    '5283',  # 聯宇
    '3047',  # 訊舟
    '4912',  # 聯德控股-KY
    '8044',  # 網家
    '5855',  # 合作金庫人壽
    '2231',  # 為升
    '3293',  # 鈊象
    '5269',  # 祥碩
    '3443',  # 創意
    '6278',  # 台表科
    '6533',  # 晶心科
    '2392',  # 正崴
    '3596',  # 智易
    '6168',  # 宏齊
    '3703',  # 欣陸
    '5521',  # 弘憶股份
    '3380',  # 明泰
    '4164',  # 友華
    '2459',  # 敦吉
    '4130',  # 健亞
    '3687',  # 元太
    '8069',  # 元太科技 (same as 3687?)
    '2466',  # 冠西電
    '2474',  # 可成 (already have)
    '6409',  # 旭隼
    '5009',  # 榮化
    '1314',  # 中石化
    '2006',  # 東和鋼鐵
    '2015',  # 豐興
    '1507',  # 永大
    '9914',  # 美利達
    '9921',  # 巨大
    '1520',  # 達新
    '5269',  # 祥碩 (dup)
    '3443',  # 創意 (dup)
]

def get_existing_stocks_with_enough_history(conn, min_days=250):
    """Return set of stockIds already having >= min_days quotes"""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= ?",
        (min_days,)
    )
    return set(row[0] for row in cursor.fetchall())

def get_valid_stock_ids(conn):
    """Return set of all stockIds in the Stock master table"""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM Stock")
    return set(row[0] for row in cursor.fetchall())

def sync_stock_quotes(conn, stock_id: str, start_year: int, start_month: int) -> int:
    """
    Sync historical quotes for a single stock from TWSE STOCK_DAY.
    Returns number of records inserted, or -1 if rate-limited.
    """
    cursor = conn.cursor()
    total_inserted = 0
    now = datetime.now()
    y, m = start_year, start_month
    consecutive_errors = 0

    while (y < now.year) or (y == now.year and m <= now.month):
        try:
            date_str = f"{y}{m:02d}01"
            url = f"https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date={date_str}&stockNo={stock_id}&response=json"
            resp = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})

            if resp.status_code in (307, 403, 429):
                return -1  # Rate limited

            if resp.status_code != 200:
                consecutive_errors += 1
                if consecutive_errors >= 3:
                    break
                m += 1
                if m > 12: m = 1; y += 1
                time.sleep(2)
                continue

            data = resp.json()
            if data.get('stat') != 'OK' or not data.get('data'):
                m += 1
                if m > 12: m = 1; y += 1
                time.sleep(1)
                continue

            consecutive_errors = 0

            for row in data['data']:
                try:
                    roc_date = row[0].strip()
                    parts = roc_date.split('/')
                    if len(parts) != 3:
                        continue
                    ad_year = int(parts[0]) + 1911
                    iso_date = f"{ad_year}-{parts[1]}-{parts[2]}"

                    def clean_num(s):
                        s = str(s).replace(',', '').replace('--', '0').replace('+', '').replace('X', '0').strip()
                        try:
                            return float(s) if s else 0.0
                        except:
                            return 0.0

                    volume       = clean_num(row[1])
                    trade_val    = clean_num(row[2])
                    open_p       = clean_num(row[3])
                    high_p       = clean_num(row[4])
                    low_p        = clean_num(row[5])
                    close_p      = clean_num(row[6])
                    change       = clean_num(row[7])
                    transactions = int(clean_num(row[8]))

                    if close_p <= 0:
                        continue

                    cursor.execute(
                        "INSERT OR REPLACE INTO StockQuote "
                        "(stockId, date, open, high, low, close, volume, tradeValue, change, transactions, createdAt) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                        (stock_id, iso_date, open_p, high_p, low_p, close_p,
                         volume, trade_val, change, transactions)
                    )
                    total_inserted += 1
                except Exception:
                    continue

            conn.commit()

        except requests.Timeout:
            pass
        except Exception as e:
            print(f"\n    ⚠ API error: {e}", end="")

        m += 1
        if m > 12: m = 1; y += 1
        time.sleep(3)  # conservative rate limiting

    return total_inserted

def print_report(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM StockQuote")
    total_rows = cursor.fetchone()[0]

    cursor.execute("""
        SELECT stockId, COUNT(*) as days FROM StockQuote GROUP BY stockId
    """)
    stock_data = cursor.fetchall()

    ge20  = [s for s, d in stock_data if d >= 20]
    ge60  = [s for s, d in stock_data if d >= 60]
    ge100 = [s for s, d in stock_data if d >= 100]
    ge250 = [s for s, d in stock_data if d >= 250]
    ge500 = [s for s, d in stock_data if d >= 500]

    cursor.execute("SELECT MIN(date), MAX(date) FROM StockQuote")
    min_d, max_d = cursor.fetchone()

    # Check ETFs
    etf_ids = [s for s, _ in stock_data if s.startswith('0')]

    print(f"\n{'='*70}")
    print(f"📊 StockQuote Coverage Report")
    print(f"{'='*70}")
    print(f"  總筆數:            {total_rows:,}")
    print(f"  有資料的股票:       {len(stock_data)}")
    print(f"  ≥20 天 (基本分析): {len(ge20)}")
    print(f"  ≥60 天 (MA60):     {len(ge60)}")
    print(f"  ≥100天 (回測最低): {len(ge100)}")
    print(f"  ≥250天 (技術分析): {len(ge250)}")
    print(f"  ≥500天 (長期分析): {len(ge500)}")
    print(f"  日期範圍:          {min_d} ~ {max_d}")
    print(f"  ETFs 覆蓋:         {len(etf_ids)} 檔 ({', '.join(sorted(etf_ids)[:10])}{'...' if len(etf_ids)>10 else ''})")
    print(f"{'='*70}")

    # Tier summary
    cursor.execute("SELECT COUNT(DISTINCT stockId) FROM InstitutionalChip")
    chip_stocks = cursor.fetchone()[0]
    chip_and_ge250 = 0
    chip_and_lt250 = 0
    cursor.execute("SELECT id FROM Stock WHERE id IN (SELECT DISTINCT stockId FROM InstitutionalChip)")
    chip_ids = set(row[0] for row in cursor.fetchall())
    for s, d in stock_data:
        if s in chip_ids:
            if d >= 250:
                chip_and_ge250 += 1
            else:
                chip_and_lt250 += 1

    print(f"\n📊 Coverage Tier Distribution (估計):")
    print(f"  Tier A (≥250天 + chip):   ~{chip_and_ge250} 檔 → 完整分析 + 回測可用")
    print(f"  Tier B (≥60天 + chip):    ~{chip_and_lt250 + chip_and_ge250} 檔 → 技術 + 法人分析，回測受限")
    print(f"  Tier C (資料不足):         ~{chip_stocks - chip_and_ge250 - chip_and_lt250} 檔 → 法人資料但無歷史報價")
    print(f"{'='*70}")

def main():
    parser = argparse.ArgumentParser(description='StockQuote 擴充補齊腳本')
    parser.add_argument('--tier', type=int, choices=[1, 2], default=1,
                        help='要補齊的 tier (1=Tier1, 2=Tier1+Tier2, 預設 1)')
    parser.add_argument('--years', type=int, default=2,
                        help='回溯年數 (預設 2，建議 2-3)')
    parser.add_argument('--resume', action='store_true',
                        help='跳過已有 >=250 天的股票')
    parser.add_argument('--report', action='store_true',
                        help='只印 report 不做 sync')
    parser.add_argument('--limit', type=int,
                        help='限制股票數量 (測試用)')
    parser.add_argument('--stocks', type=str,
                        help='指定股票代號 (逗號分隔)')
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    if args.report:
        print_report(conn)
        conn.close()
        return

    if args.stocks:
        target_stocks = [s.strip() for s in args.stocks.split(',')]
    else:
        if args.tier == 1:
            target_stocks = TIER_1[:]
        else:
            target_stocks = TIER_1 + TIER_2

    # Deduplicate
    target_stocks = list(dict.fromkeys(target_stocks))

    # Validate against Stock master table
    valid_ids = get_valid_stock_ids(conn)
    target_stocks = [s for s in target_stocks if s in valid_ids]
    print(f"目標股票池: {len(target_stocks)} 檔 (已過濾不存在的)")

    # Skip already-done stocks if --resume
    if args.resume:
        already_done = get_existing_stocks_with_enough_history(conn, 250)
        target_stocks = [s for s in target_stocks if s not in already_done]
        print(f"  跳過已有 ≥250 天的: {len(already_done)} 檔")
        print(f"  需補齊: {len(target_stocks)} 檔")
    else:
        # Still skip if already have ≥250 days
        already_done = get_existing_stocks_with_enough_history(conn, 250)
        skipped = [s for s in target_stocks if s in already_done]
        target_stocks = [s for s in target_stocks if s not in already_done]
        if skipped:
            print(f"  已有充足歷史 (skip): {len(skipped)} 檔")
        print(f"  待補齊: {len(target_stocks)} 檔")

    if args.limit:
        target_stocks = target_stocks[:args.limit]
        print(f"  限制為: {args.limit} 檔 (測試)")

    if not target_stocks:
        print("  ✅ 所有目標股票已有充足歷史！")
        print_report(conn)
        conn.close()
        return

    # Calculate start date
    now = datetime.now()
    start_year = now.year - args.years
    start_month = now.month

    print(f"\n  同步日期範圍: {start_year}/{start_month:02d} ~ {now.year}/{now.month:02d} ({args.years} 年)")
    print(f"  預計約 {args.years * 12} 個月 × {len(target_stocks)} 檔 = {args.years * 12 * len(target_stocks)} 次 API 請求")
    print(f"  (每月間隔 3s, 每檔之間 5s)")
    print(f"\n{'─'*70}")

    total_inserted = 0
    success_count = 0
    consecutive_blocked = 0

    for i, stock_id in enumerate(target_stocks, 1):
        # Check for prolonged blocking
        if consecutive_blocked >= 3:
            print(f"\n  ⏳ 連續被封鎖，等待 120 秒...")
            time.sleep(120)
            consecutive_blocked = 0

        print(f"  [{i:3d}/{len(target_stocks)}] {stock_id}...", end=" ", flush=True)

        count = sync_stock_quotes(conn, stock_id, start_year, start_month)

        if count > 0:
            print(f"✅ {count} 筆")
            total_inserted += count
            success_count += 1
            consecutive_blocked = 0
        elif count == -1:
            print("🚫 rate limited")
            consecutive_blocked += 1
            time.sleep(30)
        else:
            print("⚠️ 無資料或已存在")
            consecutive_blocked = 0

        time.sleep(5)  # between stocks

    print(f"\n{'='*70}")
    print(f"✅ 完成: {success_count}/{len(target_stocks)} 檔成功，共插入 {total_inserted:,} 筆")
    print_report(conn)
    conn.close()


if __name__ == '__main__':
    main()
