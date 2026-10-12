"""
Targeted InstitutionalChip Backfill
目標：補齊 2025-11 ~ 2026-03 的三大法人資料，跳過已有的日期

重點改進：
- 先測試 API 是否可用
- 更智慧的 rate limiting
- 清楚記錄哪些日期成功/失敗
"""

import sqlite3
import requests
import time
import sys
from datetime import datetime, timedelta

DB_PATH = 'prisma/dev.db'

def get_existing_chip_dates(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT date FROM InstitutionalChip ORDER BY date")
    return set(row[0] for row in cursor.fetchall())

def get_valid_stock_ids(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM Stock")
    return set(row[0] for row in cursor.fetchall())

def sync_chip_date(conn, date_str, valid_ids):
    """同步單一日期的法人資料，回傳插入筆數或 -1(rate limited) 或 0(no data)"""
    iso_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    url = f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_str}&selectType=ALL&response=json"
    
    try:
        resp = requests.get(url, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code in (429, 307, 403):
            return -1  # rate limited
        if resp.status_code != 200:
            return 0
            
        data = resp.json()
        if data.get('stat') != 'OK' or not data.get('data'):
            return 0
        
        cursor = conn.cursor()
        inserted = 0
        
        for row in data['data']:
            try:
                stock_id = str(row[0]).strip()
                if not stock_id or not stock_id.isdigit():
                    continue
                if stock_id not in valid_ids:
                    continue
                
                def clean(s):
                    s = str(s).replace(',', '').replace('+', '').strip()
                    if s in ('--', '', 'X'):
                        return 0.0
                    try:
                        return float(s)
                    except:
                        return 0.0
                
                foreign_buy = clean(row[4]) if len(row) > 4 else 0
                trust_buy   = clean(row[7]) if len(row) > 7 else 0
                dealer_buy  = clean(row[8]) if len(row) > 8 else 0
                total_buy   = clean(row[9]) if len(row) > 9 else 0
                
                cursor.execute(
                    "INSERT OR REPLACE INTO InstitutionalChip "
                    "(stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy, createdAt) "
                    "VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                    (stock_id, iso_date, foreign_buy, trust_buy, dealer_buy, total_buy)
                )
                inserted += 1
            except Exception:
                continue
        
        conn.commit()
        return inserted
        
    except requests.Timeout:
        return 0
    except Exception as e:
        print(f"    Error: {e}")
        return 0

def generate_trading_days(start_date: str, end_date: str):
    """Generate Mon-Fri dates between start and end (inclusive)"""
    dates = []
    current = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    while current <= end:
        if current.weekday() < 5:  # Mon-Fri
            dates.append(current.strftime('%Y%m%d'))
        current += timedelta(days=1)
    return dates

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    
    existing_dates = get_existing_chip_dates(conn)
    valid_ids = get_valid_stock_ids(conn)
    
    print(f"現有 chip 日期: {len(existing_dates)}")
    print(f"有效股票數: {len(valid_ids)}")
    
    # Target: Nov 2025 ~ Mar 2026, excluding existing dates
    all_dates = generate_trading_days('2025-11-01', '2026-03-18')
    missing_dates = [d for d in all_dates if f"{d[:4]}-{d[4:6]}-{d[6:8]}" not in existing_dates]
    
    print(f"目標日期數: {len(all_dates)}")
    print(f"需補齊日期: {len(missing_dates)}")
    
    if not missing_dates:
        print("無需補齊，已完整！")
        conn.close()
        return
    
    total = 0
    success_count = 0
    rate_limited = 0
    consecutive_fail = 0
    
    for i, date_str in enumerate(missing_dates, 1):
        if consecutive_fail >= 3:
            print(f"\n  ⏳ 連續失敗 3 次，等待 60 秒...")
            time.sleep(60)
            consecutive_fail = 0
        
        print(f"  [{i:3d}/{len(missing_dates)}] {date_str}...", end=" ", flush=True)
        count = sync_chip_date(conn, date_str, valid_ids)
        
        if count > 0:
            print(f"✅ {count} 筆")
            total += count
            success_count += 1
            consecutive_fail = 0
        elif count == -1:
            print("🚫 rate limited")
            rate_limited += 1
            consecutive_fail += 1
            time.sleep(30)
        else:
            print("⚠️ 無資料（非交易日或 API 空）")
            consecutive_fail = 0
        
        time.sleep(2)  # Be gentle to TWSE API
    
    print(f"\n完成: {success_count} 日成功, {rate_limited} 日限流, 共 {total:,} 筆")
    
    # Final report
    existing_after = get_existing_chip_dates(conn)
    print(f"DB 中 chip 日期總數: {len(existing_after)}")
    if existing_after:
        dates_sorted = sorted(existing_after)
        print(f"日期範圍: {dates_sorted[0]} ~ {dates_sorted[-1]}")
    
    conn.close()

if __name__ == '__main__':
    main()
