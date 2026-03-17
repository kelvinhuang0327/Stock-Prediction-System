"""
Walk-Forward Validation with Real Historical Stock Data
嚴格的 Walk-forward 驗證：確保訓練期與驗證期完全分離

驗證方法：
1. 使用真實 StockQuote 資料庫數據
2. 滾動窗口：訓練期 6 個月 → 驗證期 3 個月
3. 嚴格規則：驗證期數據絕不出現在訓練期
4. 比較策略：Kelly Criterion vs 固定 20% 倉位
"""

import sqlite3
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import json

@dataclass
class Trade:
    """交易記錄"""
    stock_id: str
    entry_date: datetime
    exit_date: datetime
    entry_price: float
    exit_price: float
    pnl_pct: float
    hold_days: int
    exit_reason: str

class DateParser:
    """日期解析器 - 處理 ROC 和 ISO 格式"""
    
    @staticmethod
    def parse(date_str: str) -> Optional[datetime]:
        """解析日期字串 (支援 ROC 和 ISO 格式)"""
        try:
            # 嘗試 ISO 格式 (2026-01-15)
            return datetime.strptime(date_str, '%Y-%m-%d')
        except:
            pass
        
        try:
            # 嘗試 ROC 格式 (1150108 = 115年1月8日 = 2026-01-08)
            if len(date_str) == 7:
                roc_year = int(date_str[:3])
                month = int(date_str[3:5])
                day = int(date_str[5:])
                return datetime(roc_year + 1911, month, day)
        except:
            pass
        
        return None
    
    @staticmethod  
    def to_db_format(dt: datetime) -> str:
        """轉換為資料庫格式"""
        return dt.strftime('%Y-%m-%d')

class WalkForwardValidator:
    """Walk-Forward 驗證器"""
    
    def __init__(self, db_path: str = 'prisma/dev.db'):
        self.db_path = db_path
        self.conn = None
        self.parser = DateParser()
    
    def connect(self):
        """連接資料庫"""
        self.conn = sqlite3.connect(self.db_path)
        print(f"✅ 已連接資料庫: {self.db_path}")
    
    def get_available_date_range(self) -> Tuple[datetime, datetime]:
        """取得資料庫中可用的日期範圍"""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        cursor.execute("SELECT MIN(date), MAX(date) FROM StockQuote WHERE date IS NOT NULL")
        min_date_str, max_date_str = cursor.fetchone()
        
        min_date = self.parser.parse(min_date_str)
        max_date = self.parser.parse(max_date_str)
        
        return min_date, max_date
    
    def simulate_trades_in_period(self, start_date: datetime, end_date: datetime) -> List[Trade]:
        """
        在指定期間模擬交易
        
        策略：
        1. 找出每支股票在此期間的價格數據
        2. 模擬簡單突破策略：當價格突破 20 日高點時買入
        3. 出場：-7% 止損 or +20% 停利 or 20 天時間止損
        """
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        # 取得此期間所有有交易的股票
        query = """
        SELECT DISTINCT stockId 
        FROM StockQuote 
        WHERE date >= ? AND date <= ?
        """
        
        start_str = self.parser.to_db_format(start_date)
        end_str = self.parser.to_db_format(end_date)
        
        cursor.execute(query, (start_str, end_str))
        stock_ids = [row[0] for row in cursor.fetchall()]
        
        trades = []
        
        for stock_id in stock_ids[:20]:  # 限制數量避免太慢
            # 取得該股票的歷史數據 (需要更早的數據來計算指標)
            lookback_start = (start_date - timedelta(days=90)).strftime('%Y-%m-%d')
            
            quote_query = """
            SELECT date, open, high, low, close, volume
            FROM StockQuote
            WHERE stockId = ?
              AND date >= ?
              AND date <= ?
            ORDER BY date ASC
            """
            
            cursor.execute(quote_query, (stock_id, lookback_start, end_str))
            quotes = cursor.fetchall()
            
            if len(quotes) < 30:
                continue
            
            # 找出在指定期間內的突破點
            period_start_idx = 0
            for i, (date_str, _, _, _, _, _) in enumerate(quotes):
                if self.parser.parse(date_str) >= start_date:
                    period_start_idx = i
                    break
            
            # 模擬交易
            position_open = False
            entry_idx = 0
            
            for i in range(max(20, period_start_idx), len(quotes)):
                date_str, open_price, high, low, close, volume = quotes[i]
                current_date = self.parser.parse(date_str)
                
                if current_date > end_date:
                    break
                
                if not position_open:
                    # 檢查買入訊號：突破 20 日高點
                    past_20_highs = [q[2] for q in quotes[i-20:i]]  # high prices
                    max_high_20 = max(past_20_highs) if past_20_highs else 0
                    
                    if close > max_high_20 * 1.01:  # 突破 1%
                        # 買入
                        position_open = True
                        entry_idx = i
                        entry_price = close
                        entry_date = current_date
                        highest_price = close
                        
                else:
                    # 已持倉，檢查出場訊號
                    hold_days = i - entry_idx
                    current_pnl = (close - entry_price) / entry_price
                    highest_price = max(highest_price, high)
                    
                    should_exit = False
                    exit_reason = ""
                    
                    # L1: 止損 -7%
                    if current_pnl <= -0.07:
                        should_exit = True
                        exit_reason = "Stop Loss (-7%)"
                    
                    # L3: 停利 +20%
                    elif current_pnl >= 0.20:
                        should_exit = True
                        exit_reason = "Take Profit (+20%)"
                    
                    # L4: 時間止損 20 天
                    elif hold_days >= 20:
                        should_exit = True
                        exit_reason = "Time Stop (20d)"
                    
                    if should_exit:
                        trades.append(Trade(
                            stock_id=stock_id,
                            entry_date=entry_date,
                            exit_date=current_date,
                            entry_price=entry_price,
                            exit_price=close,
                            pnl_pct=current_pnl,
                            hold_days=hold_days,
                            exit_reason=exit_reason
                        ))
                        position_open = False
                        break  # 每支股票只記錄一筆交易
        
        return trades
    
    def run_walk_forward(self, 
                         train_months: int = 6,
                         test_months: int = 3) -> Dict:
        """
        執行 Walk-Forward 驗證
        
        Args:
            train_months: 訓練期月數 (預設 6 個月)
            test_months: 驗證期月數 (預設 3 個月)
        """
        if not self.conn:
            self.connect()
        
        # 取得可用日期範圍
        min_date, max_date = self.get_available_date_range()
        print(f"\n資料期間: {min_date.strftime('%Y-%m-%d')} ~ {max_date.strftime('%Y-%m-%d')}\n")
        
        results = {
            'windows': [],
            'kelly_performance': [],
            'fixed_performance': []
        }
        
        current_start = min_date
        window_num = 0
        
        while True:
            window_num += 1
            
            # 定義訓練期與驗證期
            train_start = current_start
            train_end = train_start + timedelta(days=30 * train_months)
            test_start = train_end + timedelta(days=1)  # 嚴格分離
            test_end = test_start + timedelta(days=30 * test_months)
            
            if test_end > max_date:
                print(f"\n⚠️ 驗證期超出資料範圍，停止")
                break
            
            print(f"\n{'='*80}")
            print(f"📊 Window {window_num}")
            print(f"訓練期: {train_start.strftime('%Y-%m-%d')} ~ {train_end.strftime('%Y-%m-%d')}")
            print(f"驗證期: {test_start.strftime('%Y-%m-%d')} ~ {test_end.strftime('%Y-%m-%d')}")
            print(f"{'='*80}")
            
            # 階段 1: 在訓練期模擬交易並估算參數
            print(f"\n📈 訓練階段 - 模擬交易並估算 Kelly 參數...")
            train_trades = self.simulate_trades_in_period(train_start, train_end)
            
            if len(train_trades) < 10:
                print(f"⚠️ 訓練期交易數量不足 ({len(train_trades)} 筆)，跳過此窗口")
                current_start = test_end + timedelta(days=1)
                continue
            
            # 從訓練期數據估算 Kelly 參數
            wins = [t.pnl_pct for t in train_trades if t.pnl_pct > 0]
            losses = [abs(t.pnl_pct) for t in train_trades if t.pnl_pct <= 0]
            
            win_rate = len(wins) / len(train_trades) if train_trades else 0
            avg_win = sum(wins) / len(wins) if wins else 0.15
            avg_loss = sum(losses) / len(losses) if losses else 0.07
            
            # 計算 Half-Kelly
            if avg_loss > 0:
                odds = avg_win / avg_loss
                kelly_full = (odds * win_rate - (1 - win_rate)) / odds if odds > 0 else 0
                kelly_half = max(0.05, min(0.30, kelly_full * 0.5))  # 5-30% 範圍
            else:
                kelly_half = 0.15
            
            print(f"\n訓練期統計:")
            print(f"  交易數: {len(train_trades)}")
            print(f"  勝率: {win_rate*100:.1f}%")
            print(f"  平均獲利: {avg_win*100:.1f}%")
            print(f"  平均虧損: {avg_loss*100:.1f}%")
            print(f"  Kelly 建議倉位: {kelly_half*100:.1f}%")
            
            # 階段 2: 在驗證期測試 (嚴格不使用驗證期數據)
            print(f"\n🧪 驗證階段 - 測試策略績效...")
            test_trades = self.simulate_trades_in_period(test_start, test_end)
            
            if len(test_trades) < 3:
                print(f"⚠️ 驗證期交易數量不足 ({len(test_trades)} 筆)，跳過此窗口")
                current_start = test_end + timedelta(days=1)
                continue
            
            # 比較兩種策略
            capital_kelly = 1000000
            capital_fixed = 1000000
            
            for trade in test_trades:
                # Kelly 策略 (使用訓練期估算的參數)
                kelly_position_value = capital_kelly * kelly_half
                kelly_pnl = kelly_position_value * trade.pnl_pct
                capital_kelly += kelly_pnl
                
                # 固定 20% 策略
                fixed_position_value = capital_fixed * 0.20
                fixed_pnl = fixed_position_value * trade.pnl_pct
                capital_fixed += fixed_pnl
            
            kelly_return = (capital_kelly - 1000000) / 1000000
            fixed_return = (capital_fixed - 1000000) / 1000000
            
            print(f"\n驗證期結果:")
            print(f"  交易數: {len(test_trades)}")
            print(f"  Kelly 報酬: {kelly_return*100:>7.2f}%")
            print(f"  固定 20%:  {fixed_return*100:>7.2f}%")
            print(f"  差異:      {(kelly_return - fixed_return)*100:>7.2f}% {'✅' if kelly_return > fixed_return else '⚠️'}")
            
            # 記錄結果
            results['windows'].append({
                'window': window_num,
                'train_start': train_start.strftime('%Y-%m-%d'),
                'train_end': train_end.strftime('%Y-%m-%d'),
                'test_start': test_start.strftime('%Y-%m-%d'),
                'test_end': test_end.strftime('%Y-%m-%d'),
                'train_trades': len(train_trades),
                'test_trades': len(test_trades),
                'kelly_position': kelly_half,
                'win_rate': win_rate,
                'kelly_return_pct': kelly_return * 100,
                'fixed_return_pct': fixed_return * 100
            })
            
            results['kelly_performance'].append(kelly_return)
            results['fixed_performance'].append(fixed_return)
            
            # 滾動窗口
            current_start = test_start  # 下一個訓練期從這次驗證期開始
            
            # 限制窗口數量
            if window_num >= 4:
                print(f"\n⚠️ 已達窗口數量上限，停止")
                break
        
        return results
    
    def print_summary(self, results: Dict):
        """印出總結報告"""
        if not results['windows']:
            print("\n⚠️ 沒有完成任何驗證窗口")
            return
        
        print("\n" + "="*80)
        print("Walk-Forward 驗證總結報告")
        print("="*80 + "\n")
        
        kelly_perf = results['kelly_performance']
        fixed_perf = results['fixed_performance']
        
        print(f"📊 總窗口數: {len(results['windows'])}\n")
        
        # 各窗口詳細結果
        print("各窗口績效:")
        print(f"{'Window':<10} {'訓練期交易':<12} {'Kelly 倉位':<12} {'Kelly 報酬':<12} {'固定報酬':<12} {'勝出':<8}")
        print("-" * 80)
        
        for w in results['windows']:
            winner = "Kelly ✅" if w['kelly_return_pct'] > w['fixed_return_pct'] else "Fixed ⚠️"
            print(f"{w['window']:<10} {w['train_trades']:<12} {w['kelly_position']*100:<11.1f}% "
                  f"{w['kelly_return_pct']:<11.2f}% {w['fixed_return_pct']:<11.2f}% {winner:<8}")
        
        print("\n" + "-" * 80)
        
        # 總體統計
        avg_kelly = sum(kelly_perf) / len(kelly_perf) * 100
        avg_fixed = sum(fixed_perf) / len(fixed_perf) * 100
        
        kelly_wins = sum(1 for k, f in zip(kelly_perf, fixed_perf) if k > f)
        
        print(f"\n📈 總體績效:")
        print(f"  Kelly 平均報酬:  {avg_kelly:>7.2f}%")
        print(f"  固定 20% 平均:   {avg_fixed:>7.2f}%")
        print(f"  差異:            {avg_kelly - avg_fixed:>7.2f}%")
        print(f"\n  Kelly 勝出窗口: {kelly_wins}/{len(results['windows'])} ({kelly_wins/len(results['windows'])*100:.1f}%)")
        
        if avg_kelly > avg_fixed:
            print(f"\n✅ 結論: Kelly Criterion 策略在 Walk-forward 驗證中表現較優")
        else:
            print(f"\n⚠️ 結論: 固定倉位策略在此期間表現較優")
        
        print("\n" + "="*80 + "\n")
    
    def close(self):
        """關閉連接"""
        if self.conn:
            self.conn.close()

if __name__ == "__main__":
    print("\n🔬 Walk-Forward 驗證 (使用真實歷史股票數據)\n")
    print("⚠️ 關鍵原則: 訓練期與驗證期嚴格分離，避免 Look-ahead Bias\n")
    
    validator = WalkForwardValidator()
    
    try:
        results = validator.run_walk_forward(
            train_months=6,  # 6 個月訓練
            test_months=3    # 3 個月驗證
        )
        
        # 印出總結
        validator.print_summary(results)
        
        # 儲存結果
        with open('walk_forward_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print("💾 完整結果已儲存至 walk_forward_results.json\n")
        
    except Exception as e:
        print(f"\n❌ 驗證過程發生錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        validator.close()
        print("\n✅ 驗證完成\n")
