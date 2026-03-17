import pandas as pd
import sqlite3
import talib
from datetime import datetime, timedelta

def run_backtest(days_to_test=30, horizon=10):
    """
    Backtests the Doubling Hunter strategy.
    days_to_test: How many past days to run the filter on.
    horizon: How many days to wait to check the return.
    """
    conn = sqlite3.connect('prisma/dev.db')
    quotes_df = pd.read_sql_query("SELECT * FROM StockQuote ORDER BY date ASC", conn)
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    conn.close()

    # Get sorted list of all trading dates
    all_dates = sorted(quotes_df['date'].unique())
    if len(all_dates) < (days_to_test + horizon + 20):
        print("Not enough data for backtesting.")
        return

    # Dates to "run" the hunter on
    test_dates = all_dates[-(days_to_test + horizon):-horizon]
    
    backtest_results = []

    print(f"Starting Backtest for {len(test_dates)} trading days...")

    for current_date in test_dates:
        # 1. Simulate the "state" of the world on current_date
        past_quotes = quotes_df[quotes_df['date'] <= current_date]
        
        # 2. Run logic for each stock on this date
        for _, stock in stocks_df.iterrows():
            sid = stock['id']
            s_quotes = past_quotes[past_quotes['stockId'] == sid].copy()
            
            if len(s_quotes) < 25: continue
            
            # Simple version of the Hunter logic for speed
            s_quotes['ma5'] = talib.SMA(s_quotes['close'], 5)
            s_quotes['ma10'] = talib.SMA(s_quotes['close'], 10)
            s_quotes['ma20'] = talib.SMA(s_quotes['close'], 20)
            s_quotes['high20'] = s_quotes['high'].shift(1).rolling(20).max()
            s_quotes['vol_ma5'] = s_quotes['volume'].shift(1).rolling(5).mean()
            
            latest = s_quotes.iloc[-1]
            
            # Filter Criteria
            is_breakout = latest['close'] > latest['high20']
            is_bullish = latest['ma5'] > latest['ma10'] > latest['ma20']
            is_volume = latest['volume'] > (2 * latest['vol_ma5'])
            
            if is_breakout and is_bullish and is_volume:
                # 3. "Look into the future" to see performance
                future_quotes = quotes_df[(quotes_df['stockId'] == sid) & (quotes_df['date'] > current_date)]
                if len(future_quotes) < horizon: continue
                
                entry_price = latest['close']
                exit_price = future_quotes.iloc[horizon-1]['close']
                pnl = (exit_price - entry_price) / entry_price * 100
                
                backtest_results.append({
                    'Date': current_date,
                    'StockId': sid,
                    'Entry': entry_price,
                    'Exit': exit_price,
                    'PnL%': pnl
                })

    # 4. Analyze Results
    results_df = pd.DataFrame(backtest_results)
    if not results_df.empty:
        win_rate = (results_df['PnL%'] > 0).mean() * 100
        avg_pnl = results_df['PnL%'].mean()
        print(f"\n--- Backtest Summary ({days_to_test} days) ---")
        print(f"Total Signals: {len(results_df)}")
        print(f"Win Rate: {round(win_rate, 2)}%")
        print(f"Average Return ({horizon}d): {round(avg_pnl, 2)}%")
        print("\nTop 5 Best Trades:")
        print(results_df.sort_values('PnL%', ascending=False).head(5).to_string(index=False))
    else:
        print("No signals found in the backtest period.")

if __name__ == "__main__":
    run_backtest(30, 10) # Test last 30 windows, 10-day holding
