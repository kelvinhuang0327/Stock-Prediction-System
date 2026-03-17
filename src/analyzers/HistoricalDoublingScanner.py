"""
Historical Doubling Stock Scanner
掃描 2022-2025 年間達成翻倍的股票，並提取其起漲前特徵

目標：
1. 找出漲幅 >= 100% 的股票
2. 識別起漲點與達成翻倍時間點
3. 提取起漲前 20 天的技術與籌碼特徵
4. 儲存至 DoublingFeatures 資料表
"""

import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import json

@dataclass
class DoublingStock:
    """翻倍股資訊"""
    stock_id: str
    stock_name: str
    doubling_start_date: datetime
    doubling_end_date: datetime
    doubling_days: int
    start_price: float
    peak_price: float
    max_gain: float  # Percentage

class HistoricalDoublingScanner:
    """歷史翻倍股掃描器"""
    
    def __init__(self, db_path: str = 'prisma/dev.db'):
        self.db_path = db_path
        self.conn = None
    
    def connect(self):
        """連接資料庫"""
        self.conn = sqlite3.connect(self.db_path)
        print(f"✅ 已連接資料庫: {self.db_path}")
    
    def scan_period(self, start_date: str = '2022-01-01', end_date: str = '2025-12-31') -> List[DoublingStock]:
        """
        掃描指定期間的翻倍股
        
        策略：
        1. 對每支股票，找出任意時間窗口內的最大漲幅
        2. 如果漲幅 >= 100%，記錄起點與終點
        3. 窗口大小：最少 30 天，最多 365 天（排除當沖飆股）
        """
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        # 1. 取得在此期間有數據的所有股票
        stock_query = """
        SELECT DISTINCT s.id, s.name
        FROM Stock s
        JOIN StockQuote sq ON s.id = sq.stockId
        WHERE sq.date >= ? AND sq.date <= ?
        """
        
        cursor.execute(stock_query, (start_date.replace('-', ''), end_date.replace('-', '')))
        stocks = cursor.fetchall()
        
        print(f"\n🔍 掃描期間: {start_date} ~ {end_date}")
        print(f"📊 待分析股票數: {len(stocks)}\n")
        
        doubling_stocks = []
        
        for stock_id, stock_name in stocks:
            # 2. 取得該股票的歷史價格
            price_query = """
            SELECT date, close
            FROM StockQuote
            WHERE stockId = ?
              AND date >= ?
              AND date <= ?
            ORDER BY date ASC
            """
            
            cursor.execute(price_query, (stock_id, start_date.replace('-', ''), end_date.replace('-', '')))
            prices = cursor.fetchall()
            
            if len(prices) < 30:
                continue
            
            # 3. 滑動窗口尋找翻倍區間
            for i in range(len(prices)):
                start_date_str, start_price = prices[i]
                
                # 尋找後續最高點
                max_gain = 0
                max_gain_idx = i
                
                for j in range(i + 30, min(i + 366, len(prices))):  # 30-365 天窗口
                    end_date_str, end_price = prices[j]
                    
                    if start_price <= 0:  # 避免除以零
                        break
                    
                    gain = ((end_price - start_price) / start_price) * 100
                    
                    if gain > max_gain:
                        max_gain = gain
                        max_gain_idx = j
                
                # 4. 如果找到翻倍區間
                if max_gain >= 100:
                    end_date_str, peak_price = prices[max_gain_idx]
                    
                    try:
                        start_dt = self._parse_date(start_date_str)
                        end_dt = self._parse_date(end_date_str)
                        days = (end_dt - start_dt).days
                    except:
                        continue
                    
                    doubling_stocks.append(DoublingStock(
                        stock_id=stock_id,
                        stock_name=stock_name,
                        doubling_start_date=start_dt,
                        doubling_end_date=end_dt,
                        doubling_days=days,
                        start_price=start_price,
                        peak_price=peak_price,
                        max_gain=max_gain
                    ))
                    
                    print(f"✅ 發現翻倍股: {stock_id} {stock_name}")
                    print(f"   起漲: {start_dt.strftime('%Y-%m-%d')} @ {start_price:.2f}")
                    print(f"   達成: {end_dt.strftime('%Y-%m-%d')} @ {peak_price:.2f}")
                    print(f"   漲幅: {max_gain:.1f}% ({days} 天)\n")
                    
                    break  # 每支股票只記錄第一個翻倍區間
        
        print(f"\n🎯 總共發現 {len(doubling_stocks)} 支翻倍股\n")
        return doubling_stocks
    
    def extract_pre_surge_features(self, stock: DoublingStock) -> Dict:
        """
        提取起漲前 20 天的特徵
        """
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        # 計算特徵提取期間（起漲前 20 天）
        feature_end = stock.doubling_start_date - timedelta(days=1)
        feature_start = feature_end - timedelta(days=20)
        
        features = {
            'stock_id': stock.stock_id,
            'revenue_yoy': None,
            'chip_concentration': None,
            'foreign_holding': None,
            'trust_holding': None,
            'volatility': None,
            'momentum': None
        }
        
        # 1. 營收年增率
        start_year = feature_start.year
        start_month = feature_start.month
        
        revenue_query = """
        SELECT yoyGrowth
        FROM MonthlyRevenue
        WHERE stockId = ?
          AND year = ?
          AND month = ?
        """
        
        cursor.execute(revenue_query, (stock.stock_id, start_year, start_month))
        revenue_row = cursor.fetchone()
        if revenue_row:
            features['revenue_yoy'] = revenue_row[0]
        
        # 2. 籌碼數據（外資、投信）
        chip_query = """
        SELECT AVG(foreignBuy), AVG(trustBuy), AVG(totalBuy)
        FROM InstitutionalChip
        WHERE stockId = ?
          AND date >= ?
          AND date <= ?
        """
        
        cursor.execute(chip_query, (
            stock.stock_id,
            feature_start.strftime('%Y%m%d'),
            feature_end.strftime('%Y%m%d')
        ))
        chip_row = cursor.fetchone()
        if chip_row and chip_row[0] is not None:
            features['foreign_holding'] = chip_row[0]
            features['trust_holding'] = chip_row[1]
            features['chip_concentration'] = abs(chip_row[2])  # 簡化版籌碼集中度
        
        # 3. 技術指標（波動率、動能）
        price_query = """
        SELECT close, high, low
        FROM StockQuote
        WHERE stockId = ?
          AND date >= ?
          AND date <= ?
        ORDER BY date ASC
        """
        
        cursor.execute(price_query, (
            stock.stock_id,
            feature_start.strftime('%Y%m%d'),
            feature_end.strftime('%Y%m%d')
        ))
        price_rows = cursor.fetchall()
        
        if len(price_rows) >= 10:
            # 計算 ATR (簡化版)
            prices = [row[0] for row in price_rows]
            avg_price = sum(prices) / len(prices)
            ranges = [row[1] - row[2] for row in price_rows]  # high - low
            avg_range = sum(ranges) / len(ranges)
            features['volatility'] = (avg_range / avg_price) * 100 if avg_price > 0 else None
            
            # 計算 RSI (簡化版 - 用漲跌比)
            gains = [prices[i] - prices[i-1] for i in range(1, len(prices)) if prices[i] > prices[i-1]]
            losses = [prices[i-1] - prices[i] for i in range(1, len(prices)) if prices[i] < prices[i-1]]
            
            if gains and losses:
                avg_gain = sum(gains) / len(gains)
                avg_loss = sum(losses) / len(losses)
                rs = avg_gain / avg_loss if avg_loss > 0 else 0
                rsi = 100 - (100 / (1 + rs))
                features['momentum'] = rsi
        
        return features
    
    def save_to_database(self, stock: DoublingStock, features: Dict):
        """儲存翻倍股特徵至資料庫"""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        # 建立特徵向量 JSON
        feature_vector = json.dumps({
            'revenue_yoy': features.get('revenue_yoy'),
            'chip_concentration': features.get('chip_concentration'),
            'foreign_holding': features.get('foreign_holding'),
            'trust_holding': features.get('trust_holding'),
            'volatility': features.get('volatility'),
            'momentum': features.get('momentum')
        })
        
        insert_query = """
        INSERT OR REPLACE INTO DoublingFeatures (
            stockId, stockName,
            doublingStartDate, doublingEndDate, doublingDays,
            startPrice, peakPrice, maxGain,
            preRevenueYoY, preChipConcentration,
            preForeignHolding, preTrustHolding,
            preVolatility, preMomentum,
            featureVector, detectedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        cursor.execute(insert_query, (
            stock.stock_id,
            stock.stock_name,
            stock.doubling_start_date.strftime('%Y%m%d'),
            stock.doubling_end_date.strftime('%Y%m%d'),
            stock.doubling_days,
            stock.start_price,
            stock.peak_price,
            stock.max_gain,
            features.get('revenue_yoy'),
            features.get('chip_concentration'),
            features.get('foreign_holding'),
            features.get('trust_holding'),
            features.get('volatility'),
            features.get('momentum'),
            feature_vector,
            'historical_scanner'
        ))
        
        self.conn.commit()
    
    def _parse_date(self, date_str: str) -> datetime:
        """解析日期字串（支援 YYYYMMDD 和 YYYY-MM-DD）"""
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except:
            return datetime.strptime(date_str, '%Y%m%d')
    
    def close(self):
        """關閉連接"""
        if self.conn:
            self.conn.commit()
            self.conn.close()

def main():
    """主程序"""
    print("\n" + "="*80)
    print("歷史翻倍股特徵資料庫建立器")
    print("="*80 + "\n")
    
    scanner = HistoricalDoublingScanner()
    
    try:
        # 1. 掃描翻倍股
        doubling_stocks = scanner.scan_period(
            start_date='2022-01-01',
            end_date='2025-12-31'
        )
        
        if not doubling_stocks:
            print("⚠️ 未發現翻倍股，請檢查資料庫數據")
            return
        
        # 2. 提取特徵並儲存
        print("📊 開始提取起漲前特徵...\n")
        
        for stock in doubling_stocks:
            features = scanner.extract_pre_surge_features(stock)
            scanner.save_to_database(stock, features)
            print(f"✅ 已儲存: {stock.stock_id} {stock.stock_name}")
        
        print(f"\n✅ 完成！共處理 {len(doubling_stocks)} 支翻倍股")
        print(f"💾 數據已儲存至 DoublingFeatures 資料表\n")
        
    except Exception as e:
        print(f"\n❌ 發生錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        scanner.close()

if __name__ == "__main__":
    main()
