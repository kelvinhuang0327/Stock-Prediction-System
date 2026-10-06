import pandas as pd
import itertools
from rolling_backtest_engine import RollingBacktestEngine

def generate_strategy(ma_window, vol_mult, breakout_window):
    """
    Returns a strategy function with captured parameters
    """
    def strategy(date, daily_data):
        # We need dynamic column names based on windows, but pre-calculation was static.
        # RollingBacktestEngine pre-calculates: ma5, ma10, ma20, ma60, vol_ma20, high20.
        # To strictly optimize ANY window, we would need the engine to calculate on the fly or pre-calc more.
        # For this Phase 1, we will optimize based on the AVAILABLE pre-calcs.
        
        # Mapping param to column
        ma_col = f'ma{ma_window}' 
        # breakout_window must be 20 for high20, or we can't test 60 easily without modifying engine?
        # Engine has high20. To support high60, we need to add it to engine?
        # Yes, engine implementation had:
        # df['high20'] = df['high'].shift(1).rolling(20).max()
        # It did NOT have high60 in the final correct version code snippet I recall? 
        # Let's check engine code implicitly. If high60 missing, we skip it.
        # Actually, let's Stick to available: ma5, ma10, ma20. 
        # Vol MA is vol_ma20.
        
        # If columns don't exist, we can't use them. 
        # Current Engine Pre-calcs: ma5, ma10, ma20, vol_ma20, high20.
        
        # So flexible params are:
        # ma_trend_ma: 5, 10, 20
        # vol_multiplier: float
        
        # Strategy Logic:
        # 1. Close > High20
        # 2. MA5 > MA_Trend (param)
        # 3. Volume > Mult * Vol_MA20
        
        try:
            # Check availability
            if ma_col not in daily_data.columns: return []
            
            mask = (
                (daily_data['close'] > daily_data['high20']) &
                (daily_data['ma5'] > daily_data[ma_col]) &
                (daily_data['volume'] > vol_mult * daily_data['vol_ma20'])
            )
            return daily_data[mask].index.tolist()
        except KeyError:
            return []

    return strategy

def run_optimization():
    print("Initializing Engine...")
    engine = RollingBacktestEngine()
    
    # Grid Search Space
    # We can only test what we have data for.
    ma_windows = [10, 20] # MA5 > MA10 or MA5 > MA20
    vol_multipliers = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0]
    
    results = []
    
    # 6 Month Window
    START_DATE = '2025-07-01'
    END_DATE = '2026-01-15'
    
    print(f"\n--- Starting Grid Search ({len(ma_windows) * len(vol_multipliers)} combinations) ---")
    
    for ma in ma_windows:
        for vol in vol_multipliers:
            label = f"MA{ma} / Vol>{vol}x"
            print(f"Testing: {label}...", end="", flush=True)
            
            strat_fn = generate_strategy(ma, vol, 20)
            res = engine.run(strat_fn, start_date=START_DATE, end_date=END_DATE)
            
            summary = {
                "Params": label,
                "MA": ma,
                "Vol": vol,
                "Trades": res['total_trades'],
                "WinRate": res['win_rate'],
                "Return": res['total_return_pct'],
                "AvgPnL": res['avg_pnl']
            }
            results.append(summary)
            print(f" -> Win: {res['win_rate']*100:.1f}%, Ret: {res['total_return_pct']:.1f}%")

    # Sorting
    df_res = pd.DataFrame(results)
    
    print("\n--- Optimization Results (Top 5 by Return) ---")
    print(df_res.sort_values('Return', ascending=False).head(5).to_string(index=False))
    
    print("\n--- Optimization Results (Top 5 by Win Rate - Min 5 Trades) ---")
    df_valid = df_res[df_res['Trades'] >= 5]
    if not df_valid.empty:
        print(df_valid.sort_values('WinRate', ascending=False).head(5).to_string(index=False))
    else:
        print("No configs with >= 5 trades found.")

if __name__ == "__main__":
    run_optimization()
