import pandas as pd
import numpy as np
import sqlite3
import talib
from datetime import datetime

# Ultra-Flexible Super Surge Detector
def detect_super_surges(db_path='prisma/dev.db'):
    conn = sqlite3.connect(db_path)
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    quotes_df = pd.read_sql_query("SELECT * FROM StockQuote ORDER BY date ASC", conn)
    chips_df = pd.read_sql_query("SELECT * FROM InstitutionalChip ORDER BY date ASC", conn)
    conn.close()

    candidates = []
    
    for _, stock in stocks_df.iterrows():
        sid, sname = stock['id'], stock['name']
        s_quotes = quotes_df[quotes_df['stockId'] == sid].copy()
        s_chips = chips_df[chips_df['stockId'] == sid].copy()

        # Relaxed history requirement for broader detection
        if len(s_quotes) < 30: continue

        # Technical Indicators
        # Using EMA for faster signal response
        s_quotes['ma5'] = talib.EMA(s_quotes['close'], 5)
        s_quotes['ma20'] = talib.EMA(s_quotes['close'], 20)
        s_quotes['vol_ma20'] = s_quotes['volume'].shift(1).rolling(20).mean()
        s_quotes['h20'] = s_quotes['high'].shift(1).rolling(20).max()
        
        last = s_quotes.iloc[-1]
        prev = s_quotes.iloc[-2]
        
        score = 0
        markers = []
        
        # 1. Breakout (30 pts)
        if last['close'] > last['h20']:
            score += 30
            markers.append("20D突破")
            
        # 2. Volume Spike (>1.5x for early detection) (40 pts)
        v_ratio = last['volume'] / last['vol_ma20'] if last['vol_ma20'] > 0 else 0
        if v_ratio > 1.5:
            score += 40
            markers.append(f"量能({round(v_ratio,1)}x)")
            
        # 3. Institutional Presence (30 pts)
        last_chips = s_chips.iloc[-5:]
        if (last_chips['trustBuy'] > 0).sum() >= 1 or (last_chips['foreignBuy'] > 0).sum() >= 2:
            score += 30
            markers.append("大戶買入")

        # Threshold for Candidate
        if score >= 60:
            candidates.append({
                'StockId': sid,
                'Name': sname,
                'LatestDate': last['date'],
                'Price': round(last['close'], 2),
                'Score': score,
                'Signals': ", ".join(markers),
                'Target20': round(last['close'] * 1.2, 2),
                'Target50': round(last['close'] * 1.5, 2)
            })

    if not candidates: return pd.DataFrame()
    return pd.DataFrame(candidates).sort_values(by='Score', ascending=False)

if __name__ == "__main__":
    print(f"🔥 --- 資產翻倍計劃：20%-50% 潛力掃描模式 (截止於最新數據) ---")
    try:
        report = detect_super_surges()
        if not report.empty:
            # Only show top 10 for focus
            print(report.head(10).to_string(index=False))
            print("\n📈 執行策略：鎖定 Score 70 以上標的。")
        else:
            print("目前數據中尚未發現符合條件的飆股。")
    except Exception as e:
        print(f"Error: {e}")
