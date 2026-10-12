
import sqlite3
import requests
import time
from datetime import datetime, timedelta

def get_trading_days(days=10):
    # Try to get the last N days from our own DB first
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT date FROM StockQuote ORDER BY date DESC LIMIT ?", (days,))
    dates = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    if not dates:
        # Fallback to current date minus some range
        today = datetime.now()
        dates = [(today - timedelta(days=i)).strftime('%Y%m%d') for i in range(days)]
    
    return dates

def sync_institutional_data(dates):
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # Target stocks we care about for the doubling plan
    target_stocks = ['2014', '2028', '9103', '2330', '2317', '2454', '2382', '2603', '2881']
    
    total_synced = 0
    
    for date_str in dates:
        print(f"🔄 Syncing Institutional Chips for {date_str}...")
        url = f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_str}&selectType=ALL&response=json"
        
        try:
            resp = requests.get(url, timeout=10)
            json_data = resp.json()
            
            if json_data.get('stat') != 'OK':
                print(f"  ⚠️ No data for {date_str} (Status: {json_data.get('stat')})")
                continue
                
            data_rows = json_data.get('data', [])
            synced_count = 0
            
            for row in data_rows:
                # Fields: ["證券代號", "證券名稱", "外資買賣超股數", "投信買賣超股數", "自營商買賣超股數", "三大法人買賣超股數", ...]
                sid = row[0].strip()
                if sid not in target_stocks: continue
                
                # Normalize values (remove commas and convert to float/int)
                # Note: TWSE returned data is usually in "shares" but many local tools use "lots (1000 shares)"
                # Looking at our prisma schema: foreignBuy is Float. 
                # test-institutional.ts says: 外資買賣超: row[2] 張. 
                # Let's check the fields to be sure about indices.
                # Fields for T86 usually: 0:Code, 1:Name, 2:ForeignBuy, ..., 11:TrustBuy, 14:DealerBuy, 18:Total (example indices vary)
                
                fields = json_data.get('fields', [])
                
                def get_val(name):
                    try:
                        idx = fields.index(name)
                        val = row[idx].replace(',', '')
                        return float(val) if val != '--' else 0.0
                    except: return 0.0

                f_buy = get_val("外資買賣超股數") 
                if f_buy == 0: f_buy = get_val("外陸資買賣超股數(不含外資自營商)") # Some dates use different names
                
                t_buy = get_val("投信買賣超股數")
                d_buy = get_val("自營商買賣超股數")
                total_buy = get_val("三大法人買賣超股數")

                cursor.execute("""
                    INSERT OR REPLACE INTO InstitutionalChip (
                        stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (sid, date_str, f_buy, t_buy, d_buy, total_buy))
                
                synced_count += 1
            
            conn.commit()
            print(f"  ✅ Synced {synced_count} target stocks.")
            total_synced += synced_count
            
            # Sleep to avoid rate limiting
            time.sleep(1.5)
            
        except Exception as e:
            print(f"  ❌ Error for {date_str}: {e}")
            
    conn.close()
    return total_synced

if __name__ == "__main__":
    print("🚀 --- Taiwan Institutional Chip Sync (Asset Doubling Target) ---")
    trading_days = get_trading_days(15) # Last 15 trading days to ensure overlap
    print(f"Trading days to check: {trading_days}")
    count = sync_institutional_data(trading_days)
    print(f"\n✨ Sync Complete. Total records updated: {count}")
