"""
Risk Defense Module Validation
驗證四層級風險防禦系統的保護效果

比較三種策略：
1. 無止損 (No Stop Loss)
2. 單一止損 (7% Emergency Only)
3. 四層防禦 (L1+L2+L3+L4)
"""

import random
from typing import List, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class Position:
    """倉位資訊"""
    entry_price: float
    entry_date: datetime
    current_price: float
    highest_price: float
    atr: float

@dataclass
class SimulationResult:
    """模擬結果"""
    strategy_name: str
    total_trades: int
    stopped_trades: int
    avg_hold_days: float
    avg_exit_pnl: float
    max_loss: float
    protected_losses: int  # 防止大虧的次數

class RiskDefenseValidator:
    """風險防禦驗證器"""
    
    EMERGENCY_STOP = 0.07
    ATR_MULTIPLIER = 2.0
    TRAILING_THRESHOLD = 0.20
    TRAILING_PCT = 0.10
    MAX_HOLD_DAYS = 20
    
    def evaluate_stop_loss(self, position: Position, days_held: int, strategy: str) -> Tuple[bool, str, float]:
        """
        評估是否觸發止損
        Returns: (should_exit, reason, pnl)
        """
        current_pnl = (position.current_price - position.entry_price) / position.entry_price
        
        if strategy == 'none':
            # 無止損：只在獲利 >25% 或虧損 >15% 時出場 (模擬人性)
            if current_pnl > 0.25:
                return True, 'Manual Exit (Profit)', current_pnl
            elif current_pnl < -0.15:
                return True, 'Panic Sell', current_pnl
            return False, 'Hold', current_pnl
            
        elif strategy == 'simple':
            # 單一 7% 止損
            if current_pnl <= -self.EMERGENCY_STOP:
                return True, 'L1 Emergency', current_pnl
            elif current_pnl > 0.25:  # 獲利 25% 出場
                return True, 'Manual Exit', current_pnl
            return False, 'Hold', current_pnl
            
        else:  # 'multi_layer'
            # L1: Emergency
            if current_pnl <= -self.EMERGENCY_STOP:
                return True, 'L1 Emergency', current_pnl
            
            # L2: ATR
            atr_stop = position.entry_price - self.ATR_MULTIPLIER * position.atr
            if position.current_price < atr_stop:
                return True, 'L2 ATR', current_pnl
            
            # L3: Trailing
            if current_pnl >= self.TRAILING_THRESHOLD:
                trailing_stop = position.highest_price * (1 - self.TRAILING_PCT)
                if position.current_price < trailing_stop:
                    return True, 'L3 Trailing', current_pnl
            
            # L4: Time
            if days_held >= self.MAX_HOLD_DAYS and current_pnl < self.TRAILING_THRESHOLD:
                return True, 'L4 Time', current_pnl
            
            return False, 'Hold', current_pnl
    
    def simulate_trade(self, strategy: str, seed: int = None) -> Tuple[int, float, str]:
        """
        模擬單筆交易
        Returns: (持倉天數, 最終報酬率, 出場原因)
        """
        if seed:
            random.seed(seed)
        
        # 隨機生成交易參數
        entry_price = 100.0
        atr = random.uniform(2.0, 5.0)
        
        # 模擬價格走勢 (60 天)
        days = 0
        max_days = 60
        highest = entry_price
        
        # 初始走勢方向 (60% 機率上漲)
        is_uptrend = random.random() < 0.6
        
        while days < max_days:
            days += 1
            
            # 價格波動 (基於 ATR)
            if is_uptrend:
                # 上漲趨勢：平均每天 +0.5%，波動 ±1%
                daily_change = random.gauss(0.005, atr/entry_price)
            else:
                # 下跌趨勢：平均每天 -0.3%，波動 ±1%
                daily_change = random.gauss(-0.003, atr/entry_price)
            
            current_price = entry_price * (1 + daily_change * days/10)  # 累積效應
            current_price = max(current_price, entry_price * 0.7)  # 不低於 -30%
            
            if current_price > highest:
                highest = current_price
            
            # 檢查止損
            position = Position(
                entry_price=entry_price,
                entry_date=datetime.now(),
                current_price=current_price,
                highest_price=highest,
                atr=atr
            )
            
            should_exit, reason, pnl = self.evaluate_stop_loss(position, days, strategy)
            
            if should_exit:
                return days, pnl, reason
            
            # 10% 機率趨勢反轉
            if random.random() < 0.1:
                is_uptrend = not is_uptrend
        
        # 最大持倉天數到期
        final_pnl = (current_price - entry_price) / entry_price
        return max_days, final_pnl, 'Max Days Reached'
    
    def run_validation(self, num_trades: int = 100) -> dict:
        """執行驗證"""
        results = {}
        
        for strategy in ['none', 'simple', 'multi_layer']:
            print(f"\n執行 {strategy} 策略...")
            
            trades = []
            for i in range(num_trades):
                days, pnl, reason = self.simulate_trade(strategy, seed=i)
                trades.append({
                    'days': days,
                    'pnl': pnl,
                    'reason': reason
                })
            
            # 統計
            stopped_trades = len([t for t in trades if 'Stop' in t['reason'] or 'Emergency' in t['reason']])
            avg_hold_days = sum(t['days'] for t in trades) / len(trades)
            avg_exit_pnl = sum(t['pnl'] for t in trades) / len(trades)
            max_loss = min(t['pnl'] for t in trades)
            protected_losses = len([t for t in trades if t['pnl'] < -0.10])
            
            results[strategy] = SimulationResult(
                strategy_name=strategy,
                total_trades=num_trades,
                stopped_trades=stopped_trades,
                avg_hold_days=avg_hold_days,
                avg_exit_pnl=avg_exit_pnl,
                max_loss=max_loss,
                protected_losses=protected_losses
            )
        
        return results

def print_risk_comparison(results: dict):
    """印出風險比較"""
    print("\n" + "="*80)
    print("風險防禦系統驗證 - 三策略比較")
    print("="*80 + "\n")
    
    none = results['none']
    simple = results['simple']
    multi = results['multi_layer']
    
    print(f"{'指標':<25} {'無止損':<20} {'單層 (7%)':<20} {'四層防禦':<20}")
    print("-" * 85)
    
    # 平均報酬
    print(f"{'平均報酬率':<25} {none.avg_exit_pnl*100:>18.2f}% {simple.avg_exit_pnl*100:>18.2f}% {multi.avg_exit_pnl*100:>18.2f}%")
    
    # 最大虧損
    print(f"{'最大單筆虧損':<25} {none.max_loss*100:>18.2f}% {simple.max_loss*100:>18.2f}% {multi.max_loss*100:>18.2f}%")
    
    # 大虧次數
    print(f"{'虧損 >10% 次數':<25} {none.protected_losses:>20} {simple.protected_losses:>20} {multi.protected_losses:>20}")
    
    # 平均持倉
    print(f"{'平均持倉天數':<25} {none.avg_hold_days:>20.1f} {simple.avg_hold_days:>20.1f} {multi.avg_hold_days:>20.1f}")
    
    print("\n" + "="*80 + "\n")
    
    # 保護效果
    protected_count = none.protected_losses - multi.protected_losses
    print(f"✅ 四層防禦成功防止 {protected_count} 次大額虧損 (>10%)")
    
    max_loss_reduced = (none.max_loss - multi.max_loss) * 100
    print(f"✅ 最大虧損降低 {max_loss_reduced:.1f} 個百分點")
    
    if multi.avg_exit_pnl > none.avg_exit_pnl:
        improvement = (multi.avg_exit_pnl - none.avg_exit_pnl) * 100
        print(f"✅ 平均報酬提升 {improvement:.2f} 個百分點")
    
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    print("\n🛡️ 開始驗證風險防禦系統...\n")
    
    validator = RiskDefenseValidator()
    results = validator.run_validation(num_trades=100)
    
    print_risk_comparison(results)
    
    print("✅ 驗證完成！\n")
