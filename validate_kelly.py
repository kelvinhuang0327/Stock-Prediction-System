"""
Kelly Criterion vs Fixed Position Sizing Validation
驗證凱利準則相對於固定倉位的優勢

這個腳本模擬兩種倉位管理策略：
1. 固定 20% 倉位 (傳統方式)
2. Kelly Criterion 動態倉位 (新方式)

使用相同的交易序列，比較兩者的：
- 總報酬
- 夏普比率
- 最大回撤
- 資金曲線穩定度
"""

import sys
import json
from typing import List, Dict, Tuple
from dataclasses import dataclass

@dataclass
class Trade:
    """交易記錄"""
    entry_date: str
    exit_date: str
    pnl_pct: float  # 報酬率 (0.15 = 15%)
    hold_days: int
    stop_reason: str

@dataclass
class BacktestResult:
    """回測結果"""
    strategy_name: str
    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    avg_win: float
    avg_loss: float
    total_trades: int
    equity_curve: List[float]

class KellySimulator:
    """凱利準則模擬器"""
    
    def __init__(self, initial_capital: float = 1000000):
        self.initial_capital = initial_capital
        
    def calculate_kelly(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """計算 Half-Kelly"""
        if win_rate <= 0 or win_rate >= 1:
            return 0.0
            
        odds = avg_win / avg_loss if avg_loss > 0 else 0
        loss_rate = 1 - win_rate
        
        kelly_full = (odds * win_rate - loss_rate) / odds if odds > 0 else 0
        
        if kelly_full <= 0:
            return 0.0
            
        # Half-Kelly for safety
        half_kelly = kelly_full * 0.5
        
        # Cap at 30%
        return min(half_kelly, 0.30)
    
    def run_backtest(self, trades: List[Trade], strategy: str = 'kelly') -> BacktestResult:
        """
        執行回測
        strategy: 'kelly' 或 'fixed'
        """
        capital = self.initial_capital
        equity_curve = [capital]
        wins = []
        losses = []
        
        # 初始參數估算 (使用前 10 筆)
        initial_trades = trades[:min(10, len(trades))]
        initial_wins = [t.pnl_pct for t in initial_trades if t.pnl_pct > 0]
        initial_losses = [abs(t.pnl_pct) for t in initial_trades if t.pnl_pct <= 0]
        
        initial_win_rate = len(initial_wins) / len(initial_trades) if initial_trades else 0.5
        initial_avg_win = sum(initial_wins) / len(initial_wins) if initial_wins else 0.15
        initial_avg_loss = sum(initial_losses) / len(initial_losses) if initial_losses else 0.07
        
        for i, trade in enumerate(trades):
            # 動態更新參數 (使用最近 20 筆)
            lookback = 20
            recent_trades = trades[max(0, i-lookback):i] if i > 0 else initial_trades
            
            if recent_trades:
                recent_wins = [t.pnl_pct for t in recent_trades if t.pnl_pct > 0]
                recent_losses = [abs(t.pnl_pct) for t in recent_trades if t.pnl_pct <= 0]
                
                win_rate = len(recent_wins) / len(recent_trades)
                avg_win = sum(recent_wins) / len(recent_wins) if recent_wins else initial_avg_win
                avg_loss = sum(recent_losses) / len(recent_losses) if recent_losses else initial_avg_loss
            else:
                win_rate = initial_win_rate
                avg_win = initial_avg_win
                avg_loss = initial_avg_loss
            
            # 計算倉位
            if strategy == 'kelly':
                position_pct = self.calculate_kelly(win_rate, avg_win, avg_loss)
            else:  # fixed
                position_pct = 0.20  # 固定 20%
            
            # 執行交易
            position_value = capital * position_pct
            pnl = position_value * trade.pnl_pct
            capital += pnl
            
            equity_curve.append(capital)
            
            if trade.pnl_pct > 0:
                wins.append(trade.pnl_pct)
            else:
                losses.append(abs(trade.pnl_pct))
        
        # 計算績效指標
        total_return = (capital - self.initial_capital) / self.initial_capital
        
        # 夏普比率 (簡化版，假設無風險利率 = 0)
        returns = [(equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1] 
                   for i in range(1, len(equity_curve))]
        avg_return = sum(returns) / len(returns) if returns else 0
        std_return = (sum((r - avg_return)**2 for r in returns) / len(returns))**0.5 if returns else 0
        sharpe_ratio = (avg_return / std_return * (252**0.5)) if std_return > 0 else 0
        
        # 最大回撤
        peak = equity_curve[0]
        max_dd = 0
        for value in equity_curve:
            if value > peak:
                peak = value
            dd = (peak - value) / peak
            if dd > max_dd:
                max_dd = dd
        
        win_rate_final = len(wins) / len(trades) if trades else 0
        avg_win_final = sum(wins) / len(wins) if wins else 0
        avg_loss_final = sum(losses) / len(losses) if losses else 0
        
        return BacktestResult(
            strategy_name=strategy,
            total_return=total_return,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_dd,
            win_rate=win_rate_final,
            avg_win=avg_win_final,
            avg_loss=avg_loss_final,
            total_trades=len(trades),
            equity_curve=equity_curve
        )

def generate_realistic_trades(num_trades: int = 50) -> List[Trade]:
    """
    生成真實風格的交易序列
    基於資產翻倍策略的歷史表現
    """
    import random
    random.seed(42)  # 可重現
    
    trades = []
    date_counter = 1
    
    # 真實參數 (基於歷史回測)
    # 勝率約 60-65%，平均獲利 15-20%，平均虧損 7% (止損)
    
    for i in range(num_trades):
        # 60% 機率獲利
        is_win = random.random() < 0.62
        
        if is_win:
            # 獲利交易：5% ~ 30%，集中在 15-20%
            pnl = random.gauss(0.18, 0.05)
            pnl = max(0.05, min(0.30, pnl))  # 限制範圍
            hold_days = random.randint(5, 20)
            stop_reason = "Take Profit" if pnl > 0.20 else "Target Reached"
        else:
            # 虧損交易：約 -7% (停損)
            pnl = -0.07 + random.gauss(0, 0.01)  # 加入小波動
            pnl = max(-0.10, min(-0.05, pnl))
            hold_days = random.randint(3, 15)
            stop_reason = "Stop Loss"
        
        trades.append(Trade(
            entry_date=f"2025-{(date_counter % 12) + 1:02d}-{(date_counter % 28) + 1:02d}",
            exit_date=f"2025-{((date_counter + hold_days) % 12) + 1:02d}-{((date_counter + hold_days) % 28) + 1:02d}",
            pnl_pct=pnl,
            hold_days=hold_days,
            stop_reason=stop_reason
        ))
        
        date_counter += hold_days + 2  # 加入間隔
    
    return trades

def print_comparison(kelly_result: BacktestResult, fixed_result: BacktestResult):
    """印出比較結果"""
    print("\n" + "="*80)
    print("凱利準則 vs 固定倉位 - 回測比較")
    print("="*80 + "\n")
    
    print("📊 績效指標比較\n")
    print(f"{'指標':<20} {'固定 20%':<20} {'Kelly Criterion':<20} {'改善幅度':<15}")
    print("-" * 80)
    
    # 總報酬
    improvement = ((kelly_result.total_return - fixed_result.total_return) / abs(fixed_result.total_return) * 100)
    print(f"{'總報酬率':<20} {fixed_result.total_return*100:>18.2f}% {kelly_result.total_return*100:>18.2f}% {improvement:>13.1f}%")
    
    # 夏普比率
    improvement = ((kelly_result.sharpe_ratio - fixed_result.sharpe_ratio) / abs(fixed_result.sharpe_ratio) * 100) if fixed_result.sharpe_ratio != 0 else 0
    print(f"{'夏普比率':<20} {fixed_result.sharpe_ratio:>20.3f} {kelly_result.sharpe_ratio:>20.3f} {improvement:>13.1f}%")
    
    # 最大回撤
    improvement = ((fixed_result.max_drawdown - kelly_result.max_drawdown) / fixed_result.max_drawdown * 100)
    print(f"{'最大回撤':<20} {fixed_result.max_drawdown*100:>18.2f}% {kelly_result.max_drawdown*100:>18.2f}% {improvement:>13.1f}%")
    
    # 勝率
    print(f"{'勝率':<20} {fixed_result.win_rate*100:>18.2f}% {kelly_result.win_rate*100:>18.2f}% {'N/A':>15}")
    
    print("\n" + "-" * 80 + "\n")
    
    # 資金曲線對比
    print("💰 最終資金對比\n")
    print(f"固定 20%:      {fixed_result.equity_curve[-1]:>12,.0f} NTD")
    print(f"Kelly:         {kelly_result.equity_curve[-1]:>12,.0f} NTD")
    print(f"差額:          {kelly_result.equity_curve[-1] - fixed_result.equity_curve[-1]:>12,.0f} NTD\n")
    
    # 風險調整後報酬
    print("📈 風險調整後報酬 (Sharpe)\n")
    print(f"固定 20%: {fixed_result.sharpe_ratio:.3f}")
    print(f"Kelly:    {kelly_result.sharpe_ratio:.3f}")
    
    if kelly_result.sharpe_ratio > fixed_result.sharpe_ratio:
        print(f"✅ Kelly 策略風險調整後報酬更優 ({kelly_result.sharpe_ratio - fixed_result.sharpe_ratio:.3f})\n")
    else:
        print(f"⚠️ 固定倉位風險調整後報酬較優\n")
    
    print("="*80 + "\n")

def save_results(kelly_result: BacktestResult, fixed_result: BacktestResult):
    """儲存結果到 JSON"""
    results = {
        "kelly": {
            "total_return_pct": kelly_result.total_return * 100,
            "sharpe_ratio": kelly_result.sharpe_ratio,
            "max_drawdown_pct": kelly_result.max_drawdown * 100,
            "win_rate_pct": kelly_result.win_rate * 100,
            "avg_win_pct": kelly_result.avg_win * 100,
            "avg_loss_pct": kelly_result.avg_loss * 100,
            "final_capital": kelly_result.equity_curve[-1]
        },
        "fixed": {
            "total_return_pct": fixed_result.total_return * 100,
            "sharpe_ratio": fixed_result.sharpe_ratio,
            "max_drawdown_pct": fixed_result.max_drawdown * 100,
            "win_rate_pct": fixed_result.win_rate * 100,
            "avg_win_pct": fixed_result.avg_win * 100,
            "avg_loss_pct": fixed_result.avg_loss * 100,
            "final_capital": fixed_result.equity_curve[-1]
        }
    }
    
    with open('kelly_validation_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("✅ 結果已儲存至 kelly_validation_results.json\n")

if __name__ == "__main__":
    print("\n🚀 開始驗證凱利準則 vs 固定倉位...\n")
    
    # 生成交易序列
    num_trades = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    print(f"📌 生成 {num_trades} 筆模擬交易...")
    trades = generate_realistic_trades(num_trades)
    
    # 執行回測
    simulator = KellySimulator(initial_capital=1000000)
    
    print("📊 執行固定 20% 倉位回測...")
    fixed_result = simulator.run_backtest(trades, strategy='fixed')
    
    print("📊 執行 Kelly Criterion 回測...")
    kelly_result = simulator.run_backtest(trades, strategy='kelly')
    
    # 印出結果
    print_comparison(kelly_result, fixed_result)
    
    # 儲存結果
    save_results(kelly_result, fixed_result)
    
    print("✅ 驗證完成！\n")
