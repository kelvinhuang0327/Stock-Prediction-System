
import sqlite3
import time
import requests
from datetime import datetime

class TWSEDataSync:
    def __init__(self, db_path='prisma/dev.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
    def fetch_month_data(self, stock_id, date_str):
        url = f"https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date={date_str}&stockNo={stock_id}"
        print(f"  Fetching {url}...")
        try:
            resp = requests.get(url, headers=self.headers)
            data = resp.json()
            if data.get('stat') != 'OK':
                print(f"    ⚠️ Stat not OK: {data.get('stat')}")
                return []
            return data.get('data', [])
        except Exception as e:
            print(f"    ❌ Request error: {e}")
            return []

    def sync_stock(self, stock_id):
        print(f"🚀 Syncing {stock_id}...")
        cursor = self.conn.cursor()
        
        # We want 2025 and 2026 data
        # Months to fetch: 2025/01 to 2025/12, and 2026/01 to 2026/02
        dates = [f"2025{m:02d}01" for m in range(1, 13)] + [f"2026{m:02d}01" for m in range(1, 3)]
        
        total_inserted = 0
        for ds in dates:
            records = self.fetch_month_data(stock_id, ds)
            if not records:
                continue
                
            for r in records:
                # TWSE format: [日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數]
                # Date format: 114/01/02 (Minguo year)
                date_parts = r[0].split('/')
                year = int(date_parts[0]) + 1911
                clean_date = f"{year}{date_parts[1]}{date_parts[2]}"
                
                def clean_val(v):
                    if isinstance(v, str):
                        v = v.replace(',', '')
                        if v == 'X' or v == '--': return 0.0
                    try: return float(v)
                    except: return 0.0

                cursor.execute("""
                    INSERT OR REPLACE INTO StockQuote (
                        stockId, date, open, high, low, close, volume, 
                        tradeValue, change, transactions, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    stock_id, clean_date, 
                    clean_val(r[3]), clean_val(r[4]), clean_val(r[5]), clean_val(r[6]), 
                    clean_val(r[1]), clean_val(r[2]), clean_val(r[7]), clean_val(r[8])
                ))
                total_inserted += 1
            
            self.conn.commit()
            time.sleep(3) # Heavy rate limiting for TWSE
            
        print(f"✅ {stock_id} sync complete: {total_inserted} records.")
        return total_inserted

    def close(self):
        self.conn.close()

if __name__ == "__main__":
    targets = ['8374', '1503', '1519']
    syncer = TWSEDataSync()
    for sid in targets:
        syncer.sync_stock(sid)
    syncer.close()
    print("\n✨ All target stocks synced.")
