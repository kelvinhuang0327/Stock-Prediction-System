
import pandas as pd
import sqlite3
import numpy as np
from datetime import datetime, timedelta

def discover_doubling_stocks(db_path='prisma/dev.db', window_days=180, min_gain=1.0):
    conn = sqlite3.connect(db_path)
    # Load all quotes
    quotes = pd.read_sql_query("SELECT stockId, date, close FROM StockQuote ORDER BY date ASC", conn)
    stocks_info = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    conn.close()
    
    print(f"Analyzing {len(quotes)} quotes...")
    
    results = []
    
    for sid in quotes['stockId'].unique():
        s_quotes = quotes[quotes['stockId'] == sid].copy()
        if len(s_quotes) < 20: continue
        
        # Calculate max gain within rolling window
        # For simplicity, we compare current price to min price in last 6 months
        for i in range(len(s_quotes)):
            current_price = s_quotes.iloc[i]['close']
            current_date = s_quotes.iloc[i]['date']
            
            # Look back window
            start_i = max(0, i - window_days)
            if i == start_i: continue
            
            min_price = s_quotes.iloc[start_i:i]['close'].min()
            if min_price > 0:
                gain = (current_price - min_price) / min_price
                if gain >= min_gain:
                    # Found a doubling stock!
                    min_idx = s_quotes.iloc[start_i:i]['close'].idxmin()
                    min_date = s_quotes.loc[min_idx]['date']
                    
                    # We only record the FIRST time it doubles from a low to avoid duplicates
                    results.append({
                        'stockId': sid,
                        'name': stocks_info[stocks_info['id'] == sid]['name'].values[0],
                        'low_date': min_date,
                        'peak_date': current_date,
                        'low_price': min_price,
                        'peak_price': current_price,
                        'gain': gain
                    })
                    # Skip some days to find the NEXT distinct move
                    # i += 60 (actually handled by for loop logic but we can jump)
                    break 

    df = pd.DataFrame(results)
    if not df.empty:
        print(f"Found {len(df)} historical doubling events.")
    else:
        print("No doubling events found in the current dataset.")
    return df

if __name__ == "__main__":
    discover_doubling_stocks()
