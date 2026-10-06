"""
Historical Data Sync Script for 2025
下載 2025 年台股歷史數據

數據來源：
1. TWStock API (台股資料套件)
2. TWSE 公開資料

需安裝：pip install twstock
"""

import sys
import sqlite3
from datetime import datetime, timedelta
import time

try:
    import twstock
    print("✅ twstock 已安裝")
except ImportError:
    print("❌ 未安裝 twstock，正在安裝...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "twstock"])
    import twstock
    print("✅ twstock 安裝完成")

class HistoricalDataSync:
    """歷史數據同步器"""
    
    def __init__(self, db_path='prisma/dev.db'):
        self.db_path = db_path
        self.conn = None
        
    def connect(self):
        """連接資料庫"""
        self.conn = sqlite3.connect(self.db_path)
        print(f"✅ 已連接資料庫: {self.db_path}")
    
    def get_stock_list(self):
        """取得要同步的股票列表"""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, name FROM Stock ORDER BY id")
        stocks = cursor.fetchall()
        
        print(f"📊 待同步股票數: {len(stocks)}")
        return stocks
    
    def sync_stock_quotes(self, stock_id: str, year: int = 2025):
        """
        同步單支股票的 2025 年報價數據
        
        使用 twstock 套件下載
        """
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        try:
            # 使用 twstock 下載
            stock = twstock.Stock(stock_id)
            
            # 設定日期範圍
            target = twstock.Stock(stock_id)
            
            # 下載 2025 整年數據
            data = target.fetch_from(year, 1)  # 從 2025/1 開始
            
            if not data:
                print(f"  ⚠️ {stock_id}: 無數據")
                return 0
            
            inserted = 0
            
            for record in data:
                # record 是 Data 物件，包含：
                # date, capacity, turnover, open, high, low, close, change, transaction
                
                try:
                    # 轉換日期格式
                    date_str = record.date.strftime('%Y%m%d')
                    
                    # 插入或更新
                    cursor.execute("""
                        INSERT OR REPLACE INTO StockQuote (
                            stockId, date, open, high, low, close, volume, 
                            tradeValue, change, transactions, createdAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (
                        stock_id,
                        date_str,
                        record.open,
                        record.high,
                        record.low,
                        record.close,
                        record.capacity,  # 成交量（張）
                        record.turnover,   # 成交金額
                        record.change,
                        record.transaction  # 成交筆數
                    ))
                    
                    inserted += 1
                    
                except Exception as e:
                    print(f"  ❌ {stock_id} 日期 {record.date}: {e}")
                    continue
            
            self.conn.commit()
            return inserted
            
        except Exception as e:
            print(f"  ❌ {stock_id} 同步失敗: {e}")
            return 0
    
    def sync_all_stocks(self, year: int = 2025, limit: int = None):
        """同步所有股票的歷史數據"""
        stocks = self.get_stock_list()
        
        if limit:
            stocks = stocks[:limit]
            print(f"⚠️ 限制同步前 {limit} 支股票")
        
        print(f"\n🚀 開始同步 {year} 年數據...\n")
        
        total_inserted = 0
        success_count = 0
        
        for i, (stock_id, stock_name) in enumerate(stocks, 1):
            print(f"[{i}/{len(stocks)}] {stock_id} {stock_name}...", end=" ")
            
            inserted = self.sync_stock_quotes(stock_id, year)
            
            if inserted > 0:
                print(f"✅ {inserted} 筆")
                total_inserted += inserted
                success_count += 1
            else:
                print(f"❌ 無數據")
            
            # 避免 API Rate Limit
            time.sleep(0.5)
        
        print(f"\n" + "="*80)
        print(f"✅ 同步完成！")
        print(f"成功: {success_count}/{len(stocks)} 支股票")
        print(f"總筆數: {total_inserted:,} 筆報價")
        print(f"="*80 + "\n")
    
    def verify_data(self, year: int = 2025):
        """驗證數據完整性"""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        # 統計數據
        cursor.execute(f"""
            SELECT 
                COUNT(DISTINCT stockId) as stocks,
                COUNT(DISTINCT date) as days,
                COUNT(*) as total_quotes
            FROM StockQuote
            WHERE date LIKE '{year}%'
        """)
        
        stocks, days, total = cursor.fetchone()
        
        print(f"\n📊 {year} 年數據統計:")
        print(f"  股票數: {stocks}")
        print(f"  交易日: {days}")
        print(f"  總筆數: {total:,}")
        
        # 顯示日期範圍
        cursor.execute(f"""
            SELECT MIN(date), MAX(date)
            FROM StockQuote
            WHERE date LIKE '{year}%'
        """)
        
        min_date, max_date = cursor.fetchone()
        print(f"  日期範圍: {min_date} ~ {max_date}\n")
    
    def close(self):
        """關閉連接"""
        if self.conn:
            self.conn.close()

def main():
    """主程序"""
    import argparse
    
    parser = argparse.ArgumentParser(description='同步台股歷史數據')
    parser.add_argument('--year', type=int, default=2025, help='年份 (預設: 2025)')
    parser.add_argument('--limit', type=int, help='限制股票數量（測試用）')
    parser.add_argument('--verify-only', action='store_true', help='只驗證不下載')
    
    args = parser.parse_args()
    
    print("\n" + "="*80)
    print(f"台股歷史數據同步器 - {args.year} 年")
    print("="*80 + "\n")
    
    syncer = HistoricalDataSync()
    
    try:
        if args.verify_only:
            syncer.connect()
            syncer.verify_data(args.year)
        else:
            syncer.sync_all_stocks(year=args.year, limit=args.limit)
            syncer.verify_data(args.year)
    
    except Exception as e:
        print(f"\n❌ 發生錯誤: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        syncer.close()
        print("✅ 程序結束\n")

if __name__ == "__main__":
    main()
