import pandas as pd
import numpy as np
import sqlite3
from datetime import datetime

def find_major_player_activity(db_path='prisma/dev.db'):
    """
    Identifies stocks with significant 'Major Player' (institutional) activity.
    """
    conn = sqlite3.connect(db_path)
    
    # 1. Load Data
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    chip_df = pd.read_sql_query("""
        SELECT stockId, date, foreignBuy, trustBuy, dealerBuy, totalBuy
        FROM InstitutionalChip 
        ORDER BY date ASC
    """, conn)
    
    # Load recent volume for concentration check
    volume_df = pd.read_sql_query("""
        SELECT stockId, date, volume, close
        FROM StockQuote 
        ORDER BY date ASC
    """, conn)
    
    conn.close()
    
    results = []
    
    # 2. Process each stock
    for _, stock in stocks_df.iterrows():
        sid = stock['id']
        sname = stock['name']
        
        # Filter data for this stock
        chips = chip_df[chip_df['stockId'] == sid].copy()
        quotes = volume_df[volume_df['stockId'] == sid].copy()
        
        if len(chips) < 5 or len(quotes) < 5:
            continue
            
        # Get latest records
        latest_chips = chips.iloc[-5:] # Past 5 days
        latest_quote = quotes.iloc[-1]
        
        # A. Calculate Streaks
        # Trust Streak (Classic signal in Taiwan)
        trust_buys = latest_chips['trustBuy'].values
        trust_streak = 0
        for b in reversed(trust_buys):
            if b > 0: trust_streak += 1
            else: break
            
        # Foreign Streak
        foreign_buys = latest_chips['foreignBuy'].values
        foreign_streak = 0
        for b in reversed(foreign_buys):
            if b > 0: foreign_streak += 1
            else: break
            
        # B. Institutional Concentration
        # Institutional Buy as % of Today's Volume
        # Note: If volume is in shares and totalBuy is in shares, this is correct.
        inst_buy_ratio = latest_chips.iloc[-1]['totalBuy'] / latest_quote['volume'] if latest_quote['volume'] > 0 else 0
        
        # C. 5-day Net Buy Amount
        five_day_net = latest_chips['totalBuy'].sum()
        
        # D. Price Change (correlation check)
        # Check if price has been rising over the past 5 days
        price_start = quotes.iloc[-5]['close']
        price_end = latest_quote['close']
        price_trend = (price_end - price_start) / price_start * 100
        
        # Logic: If Trust or Foreign are buying for 3+ days, OR high intensity
        is_trust_pushing = trust_streak >= 3
        is_foreign_pushing = foreign_streak >= 3
        is_high_concentration = abs(inst_buy_ratio) > 0.10 # 10% concentration
        
        if is_trust_pushing or is_foreign_pushing or is_high_concentration:
            status = []
            if is_trust_pushing: status.append(f"投信連買{trust_streak}天")
            if is_foreign_pushing: status.append(f"外資連買{foreign_streak}天")
            if is_high_concentration: status.append(f"籌碼集中({round(inst_buy_ratio*100, 1)}%)")
            
            results.append({
                'StockId': sid,
                'Name': sname,
                'Price': latest_quote['close'],
                '5D_Price%': round(price_trend, 2),
                'Status': ", ".join(status),
                'NetBuy5D': round(five_day_net, 1)
            })
            
    # 3. Format Output
    final_df = pd.DataFrame(results)
    if not final_df.empty:
        # Sort by price trend or net buy
        final_df = final_df.sort_values(by='NetBuy5D', ascending=False)
        
    return final_df

if __name__ == "__main__":
    print(f"--- Major Player (Institutional) Tracking Report ({datetime.now().strftime('%Y-%m-%d')}) ---")
    try:
        activity_df = find_major_player_activity()
        if not activity_df.empty:
            print(activity_df.to_string(index=False))
            print(f"\nFound {len(activity_df)} stocks with significant major player activity.")
        else:
            print("No significant major player activity detected in the past few days.")
    except Exception as e:
        print(f"Error during tracking: {e}")
