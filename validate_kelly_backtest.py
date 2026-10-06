"""
Kelly vs Fixed Position Sizing Validation
使用真實回測引擎比較兩種倉位管理策略

執行方式：
python3 validate_kelly_backtest.py
"""

import sys
sys.path.append('.')

from rolling_backtest_engine import RollingBacktestEngine, example_breakout_strategy
import json

def run_comparison(start_date='2025-07-01', end_date='2026-01-14'):
    """執行固定倉位 vs Kelly 倉位比較"""
    
    print("\n" + "="*80)
    print("Kelly Criterion vs 固定倉位 - 真實回測比較")
    print("="*80 + "\n")
    
    print(f"📅 回測期間: {start_date} ~ {end_date}\n")
    
    # 1. 固定 20% 倉位回測
    print("📊 執行固定 20% 倉位回測...")
    engine_fixed = RollingBacktestEngine(position_mode='fixed')
    results_fixed = engine_fixed.run(example_breakout_strategy, start_date=start_date, end_date=end_date)
    
    # 2. Kelly 動態倉位回測
    print("\n📊 執行 Kelly Criterion 動態倉位回測...")
    engine_kelly = RollingBacktestEngine(position_mode='kelly')
    results_kelly = engine_kelly.run(example_breakout_strategy, start_date=start_date, end_date=end_date)
    
    # 3. 比較結果
    print("\n" + "="*80)
    print("📈 回測結果比較")
    print("="*80 + "\n")
    
    print(f"{'指標':<20} {'固定 20%':<20} {'Kelly Criterion':<20} {'差異':<15}")
    print("-" * 80)
    
    # 總交易數
    print(f"{'總交易數':<20} {results_fixed['total_trades']:<20} {results_kelly['total_trades']:<20} "
          f"{results_kelly['total_trades'] - results_fixed['total_trades']:<15}")
    
    # 勝率
    print(f"{'勝率':<20} {results_fixed['win_rate']*100:<19.2f}% {results_kelly['win_rate']*100:<19.2f}% "
          f"{'N/A':<15}")
    
    # 平均損益
    print(f"{'平均損益':<20} {results_fixed['avg_pnl']*100:<19.2f}% {results_kelly['avg_pnl']*100:<19.2f}% "
          f"{(results_kelly['avg_pnl'] - results_fixed['avg_pnl'])*100:<14.2f}%")
    
    # 總報酬
    improvement = ((results_kelly['total_return_pct'] - results_fixed['total_return_pct']) / 
                   abs(results_fixed['total_return_pct']) * 100) if results_fixed['total_return_pct'] != 0 else 0
    print(f"{'總報酬率':<20} {results_fixed['total_return_pct']:<19.2f}% {results_kelly['total_return_pct']:<19.2f}% "
          f"{improvement:<14.1f}%")
    
    print("\n" + "="*80 + "\n")
    
    # 詳細交易記錄分析
    trades_fixed = results_fixed['trades']
    trades_kelly = results_kelly['trades']
    
    if not trades_fixed.empty and not trades_kelly.empty:
        print("📊 交易統計細節:\n")
        
        # 獲利交易
        wins_fixed = trades_fixed[trades_fixed['pnl_pct'] > 0]
        wins_kelly = trades_kelly[trades_kelly['pnl_pct'] > 0]
        
        print(f"獲利交易:")
        print(f"  固定 20%: {len(wins_fixed)} 筆, 平均 {wins_fixed['pnl_pct'].mean()*100:.2f}%")
        print(f"  Kelly:    {len(wins_kelly)} 筆, 平均 {wins_kelly['pnl_pct'].mean()*100:.2f}%")
        
        # 虧損交易
        losses_fixed = trades_fixed[trades_fixed['pnl_pct'] <= 0]
        losses_kelly = trades_kelly[trades_kelly['pnl_pct'] <= 0]
        
        print(f"\n虧損交易:")
        print(f"  固定 20%: {len(losses_fixed)} 筆, 平均 {losses_fixed['pnl_pct'].mean()*100:.2f}%")
        print(f"  Kelly:    {len(losses_kelly)} 筆, 平均 {losses_kelly['pnl_pct'].mean()*100:.2f}%")
    
    # 結論
    print("\n" + "="*80)
    print("📝 結論")
    print("="*80 + "\n")
    
    if results_kelly['total_return_pct'] > results_fixed['total_return_pct']:
        diff = results_kelly['total_return_pct'] - results_fixed['total_return_pct']
        print(f"✅ Kelly Criterion 策略表現較優")
        print(f"   - 總報酬提升 {diff:.2f} 個百分點")
        print(f"   - 驗證了動態倉位管理的優勢")
    else:
        diff = results_fixed['total_return_pct'] - results_kelly['total_return_pct']
        print(f"⚠️  固定倉位策略在此期間表現較優")
        print(f"   - 領先 {diff:.2f} 個百分點")
        print(f"   - 可能原因：市場環境適合固定倉位，或樣本數不足")
    
    print(f"\n💡 建議：")
    print(f"   - Kelly 策略需要足夠歷史數據才能準確估算參數")
    print(f"   - 建議累積至少 50+ 筆交易後再評估長期表現")
    print(f"   - 當前 Kelly 策略使用 Half-Kelly (較保守)")
    
    print("\n" + "="*80 + "\n")
    
    # 儲存結果
    summary = {
        'period': {
            'start': start_date,
            'end': end_date
        },
        'fixed': {
            'total_trades': int(results_fixed['total_trades']),
            'win_rate': float(results_fixed['win_rate']),
            'avg_pnl': float(results_fixed['avg_pnl']),
            'total_return_pct': float(results_fixed['total_return_pct'])
        },
        'kelly': {
            'total_trades': int(results_kelly['total_trades']),
            'win_rate': float(results_kelly['win_rate']),
            'avg_pnl': float(results_kelly['avg_pnl']),
            'total_return_pct': float(results_kelly['total_return_pct'])
        },
        'winner': 'kelly' if results_kelly['total_return_pct'] > results_fixed['total_return_pct'] else 'fixed'
    }
    
    with open('kelly_backtest_comparison.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print("💾 結果已儲存至 kelly_backtest_comparison.json\n")

if __name__ == "__main__":
    run_comparison()
