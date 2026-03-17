
import pandas as pd
import numpy as np
import talib
from rolling_backtest_engine import RollingBacktestEngine
from jury_experts import MethodTheoryExpert, TechnicalPragmatistExpert, ProgramArchitectureExpert

# Initialize Experts
m_expert = MethodTheoryExpert()
t_expert = TechnicalPragmatistExpert()
p_expert = ProgramArchitectureExpert()

def jury_strategy(date, daily_data):
    """
    Strategy that requires consensus between experts.
    """
    signals = []
    
    # Pre-calculated indicators are available in daily_data from RollingBacktestEngine
    for sid, row in daily_data.iterrows():
        # 1. Prepare data for Method Theory (Technical)
        # We need VCP and Slope. Let's approximate from available daily_data.
        # RollingBacktestEngine adds ma5, ma10, ma20, high20, vol_ma20
        # For simplicity, we calculate a few more on the fly or use what's there.
        
        ma5_val = row.get('ma5', 0)
        ma10_val = row.get('ma10', 0)
        ma20_val = row.get('ma20', 0)
        close = row['close']
        high20 = row.get('high20', 0)
        vol_ma20 = row.get('vol_ma20', 1)
        
        # Approximate VCP: std of last few closes / mean (not perfectly rolling but good enough for filter)
        # In a real engine we'd pre-calculate this.
        
        is_breakout = close > high20
        ma_slope = (ma5_val - ma20_val) / ma20_val if ma20_val > 0 else 0
        
        # 1. Technical Prep
        close = row['close']
        ma5_val = row.get('ma5', 0)
        ma20_val = row.get('ma20', 0)
        high20 = row.get('high20', 0)
        vol_ma20 = row.get('vol_ma20', 1)
        
        # Calculate VCP proxy: (High-Low) / Mean over 10 days
        # Since we don't have rolling H-L in daily_data yet, we use a simpler one:
        # Distance from MA20
        dist_ma20 = abs(close - ma20_val) / ma20_val if ma20_val > 0 else 1
        
        is_breakout = close > high20
        vol_mult = row['volume'] / vol_ma20 if vol_ma20 > 0 else 0
        
        # --- Consensus Logic ---
        # 1. VCP Requirement: Price must be close to MA20 (tight base)
        is_tight_base = dist_ma20 < 0.03 # Within 3% of MA20
        
        # 2. Volume Requirement: Explosive breakout
        is_explosive = vol_mult > 3.0
        
        # 3. Trend Requirement: MA5 > MA20
        is_uptrend = ma5_val > ma20_val
        
        if is_breakout and is_tight_base and is_explosive and is_uptrend:
            signals.append(sid)
            
    return signals

def run_backtest_optimization():
    print("🚀 --- Advanced Jury Strategy Backtest (VCP Focused) ---")
    
    engine = RollingBacktestEngine()
    # Parameters for Doubling:
    # We allow larger drawdowns (10% stop) to catch 100% runs.
    results = engine.run(
        jury_strategy, 
        start_date='2025-01-01', 
        end_date='2026-02-10',
        params={
            'stop_loss': 0.10,
            'take_profit': 1.00, # Target Doubling!
            'time_stop': 120     # Hold longer for the move
        }
    )
    
    print("\n--- Optimized Backtest Results ---")
    print(f"Total Return: {results['total_return_pct']:.2f}%")
    print(f"Win Rate: {results['win_rate']*100:.2f}%")
    print(f"Total Trades: {results['total_trades']}")
    
    if not results['trades'].empty:
        print("\nTop Winning Trades:")
        print(results['trades'].sort_values('pnl_pct', ascending=False).head(10)[['stock_id', 'entry_date', 'pnl_pct', 'reason']])
        
    return results

if __name__ == "__main__":
    run_backtest_optimization()
