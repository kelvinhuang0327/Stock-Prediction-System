import pandas as pd
import numpy as np
import sqlite3
import talib
from datetime import datetime, timedelta

def find_surging_stocks(db_path='prisma/dev.db'):
    """
    Find stocks with "Asset Doubling" potential based on technical criteria.
    """
    # 1. Connect to Database
    conn = sqlite3.connect(db_path)
    
    # Load Stock names
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    
    # Load Quotes (get enough data for indicators - at least 60 days)
    # We'll fetch all quotes and filter in pandas for simplicity, 
    # but in production you'd optimize this.
    quotes_df = pd.read_sql_query("""
        SELECT stockId, date, open, high, low, close, volume 
        FROM StockQuote 
        ORDER BY date ASC
    """, conn)
    
    conn.close()
    
    results = []
    
    # Process each stock
    for _, stock in stocks_df.iterrows():
        sid = stock['id']
        sname = stock['name']
        
        # Filter quotes for this stock
        df = quotes_df[quotes_df['stockId'] == sid].copy()
        
        if len(df) < 20:
            continue
            
        # 2. Calculate Indicators
        # Moving Averages
        df['ma5'] = talib.SMA(df['close'], timeperiod=5)
        df['ma10'] = talib.SMA(df['close'], timeperiod=10)
        df['ma20'] = talib.SMA(df['close'], timeperiod=20)
        
        # 20-day High (Previous 20 days, excluding current)
        df['high20'] = df['high'].shift(1).rolling(window=20).max()
        
        # Volume Indicators (Previous 5 days average, excluding current)
        df['vol_ma5_past'] = df['volume'].shift(1) .rolling(window=5).mean()
        
        # Slopes (using linear regression slope or simple diff)
        df['ma5_slope'] = talib.LINEARREG_SLOPE(df['ma5'], timeperiod=3)
        df['ma10_slope'] = talib.LINEARREG_SLOPE(df['ma10'], timeperiod=3)
        
        # Volatility (VCP - Volatility Compression Pattern)
        # We look at the coefficient of variation (std/mean) over the last 20 days
        df['vcp_volat'] = df['close'].rolling(window=20).std() / df['close'].rolling(window=20).mean()
        
        # Price Change
        df['pct_change'] = df['close'].pct_change() * 100
        
        # Get latest data point
        latest = df.iloc[-1]
        
        # 3. Filtering Logic
        # A. Form Filter: Breakout 20d High + Bullish Alignment
        is_breakout = latest['close'] > latest['high20']
        is_bullish = latest['ma5'] > latest['ma10'] > latest['ma20']
        
        # B. Volume Verify: Volume > 2 * 5d Avg Volume
        is_vol_spike = latest['volume'] > (2 * latest['vol_ma5_past'])
        
        # C. Price Range: 3% < pct_change < 9% (Taiwan limit is 10%)
        is_range_ok = 3.0 < latest['pct_change'] < 9.0
        
        # D. Slope & VCP logic (Enhanced)
        is_slope_up = latest['ma5_slope'] > 0 and latest['ma10_slope'] > 0
        
        # VCP: Ideally volatility was low before the spike 
        # Check if 1-day ago volatility was low (< 2%)
        prev_vcp = df.iloc[-2]['vcp_volat'] if len(df) > 1 else 1.0
        is_vcp_compressed = prev_vcp < 0.02 # 2% threshold for compression
        
        if is_breakout and is_bullish and is_vol_spike and is_range_ok:
            results.append({
                'StockId': sid,
                'Name': sname,
                'Price': latest['close'],
                'Change%': round(latest['pct_change'], 2),
                'VolMult': round(latest['volume'] / latest['vol_ma5_past'], 2),
                'VCP': "Yes" if is_vcp_compressed else "No",
                'MA_Slope': round(latest['ma5_slope'], 4)
            })
            
    # 4. Return as DataFrame
    final_df = pd.DataFrame(results)
    return final_df

if __name__ == "__main__":
    print(f"--- Asset Doubling Strategy Screening ({datetime.now().strftime('%Y-%m-%d')}) ---")
    try:
        potential_stocks = find_surging_stocks()
        if not potential_stocks.empty:
            print(potential_stocks.to_string(index=False))
            print(f"\nFound {len(potential_stocks)} potential stocks.")
        else:
            print("No stocks matched the 'Asset Doubling' criteria today.")
    except Exception as e:
        print(f"Error during screening: {e}")
