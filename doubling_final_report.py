import pandas as pd
import numpy as np
import sqlite3
import talib
from datetime import datetime

# --- Logic from Asset Doubling Hunter ---
BULLISH_KEYWORDS = ['利多', '上漲', '突破', '新高', '成長', '優於預期', '買進', '看好', '營收創新高', '擴產', '訂單']
BEARISH_KEYWORDS = ['利空', '下跌', '跌破', '新低', '衰退', '不如預期', '賣出', '看淡', '虧損', '下修']

def get_sentiment_score(news_list):
    if not news_list: return 0.5
    count = 0
    for title, summary in news_list:
        text = (title + (summary or "")).lower()
        if any(w in text for w in BULLISH_KEYWORDS): count += 1
        if any(w in text for w in BEARISH_KEYWORDS): count -= 1
    return np.clip((count / len(news_list)) * 0.5 + 0.5, 0, 1)

def run_integrated_report(db_path='prisma/dev.db'):
    conn = sqlite3.connect(db_path)
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    quotes_df = pd.read_sql_query("SELECT * FROM StockQuote ORDER BY date ASC", conn)
    chips_df = pd.read_sql_query("SELECT * FROM InstitutionalChip ORDER BY date ASC", conn)
    news_df = pd.read_sql_query("SELECT * FROM NewsEvent ORDER BY publishedAt DESC", conn)
    conn.close()

    action_list = []
    
    # Process each stock
    for _, stock in stocks_df.iterrows():
        sid, sname = stock['id'], stock['name']
        s_quotes = quotes_df[quotes_df['stockId'] == sid].copy()
        s_chips = chips_df[chips_df['stockId'] == sid].copy()
        s_news = news_df[news_df['stockId'] == sid].copy()

        if len(s_quotes) < 30: continue

        # A. Technical Analysis (Hunter Logic)
        s_quotes['ma5'] = talib.SMA(s_quotes['close'], 5)
        s_quotes['ma10'] = talib.SMA(s_quotes['close'], 10)
        s_quotes['ma20'] = talib.SMA(s_quotes['close'], 20)
        s_quotes['high20'] = s_quotes['high'].shift(1).rolling(20).max()
        s_quotes['vol_ma5'] = s_quotes['volume'].shift(1).rolling(5).mean()
        s_quotes['vol_ma20'] = s_quotes['volume'].shift(1).rolling(20).mean()
        
        latest = s_quotes.iloc[-1]
        prev_quote = s_quotes.iloc[-1] # For pivot points, use latest closed candle
        
        # B. Conviction Signals
        score = 0
        signals = []
        is_breakout = latest['close'] > latest['high20']
        # Optimized: Backtest shows MA5 > MA10 is the most effective trend filter
        is_bullish = latest['ma5'] > latest['ma10'] 
        vol_mult = latest['volume'] / latest['vol_ma20'] if latest['vol_ma20'] > 0 else 0
        
        if is_breakout and is_bullish:
            score += 40
            signals.append("突破排列")
        
        # Optimized Thresholds: 2.5x is the "Sweet Spot" from Auto-Optimizer
        if vol_mult > 2.5:
            score += 20
            signals.append(f"黃金爆量({round(vol_mult,1)}x)")
        elif vol_mult > 2.0:
            score += 10
            signals.append("量能啟動")

        # C. Sentiment & Advice (Advisor Logic)
        news_items = [(n.title, n.summary) for n in s_news.head(5).itertuples()]
        sentiment_val = get_sentiment_score(news_items)
        sentiment_adj = (sentiment_val - 0.5) * 0.04 # -2% to +2% shift
        
        # Calculate Technical Levels (Pivot Points)
        p = (prev_quote['high'] + prev_quote['low'] + prev_quote['close']) / 3
        s1 = (2 * p) - prev_quote['high']
        r1 = (2 * p) - prev_quote['low']
        
        # Adjusted Entry/Exit
        entry_price = s1 * (1 + sentiment_adj)
        exit_price = r1 * (1 + sentiment_adj)

        # Final Filter: Only keep candidates with strong signals
        if score >= 40:
            action_list.append({
                '日期': latest['date'],
                '代號': sid,
                '名稱': sname,
                '現價': latest['close'],
                '漲跌%': round((latest['close'] - s_quotes.iloc[-2]['close'])/s_quotes.iloc[-2]['close']*100, 2),
                '信心': score,
                '訊號': ", ".join(signals),
                '建議入手於': round(entry_price, 2),
                '建議出手於': round(exit_price, 2),
                '時事': "利多" if sentiment_val > 0.6 else ("利空" if sentiment_val < 0.4 else "中性")
            })

    return pd.DataFrame(action_list).sort_values('信心', ascending=False)

if __name__ == "__main__":
    print(f"💰 --- 資產翻倍計劃：今日飆股入手/出手全攻略 ({datetime.now().strftime('%Y-%m-%d %H:%M')}) ---")
    try:
        final_df = run_integrated_report()
        if not final_df.empty:
            print(final_df.to_string(index=False))
            print("\n💡 執行指南：")
            print("1. [建議入手於] 為最佳埋伏點，若股價大幅跳空開高建議分批布局。")
            print("2. [建議出手於] 為首波短線獲利壓力位，達標後可先行減碼保本。")
            print("3. 請務必確認時事情緒，[利多] 訊號具備更高續航力。")
        else:
            print("今日大盤氣氛較淡，目前無高信心飆股訊號。建議空手等待形態完美。")
    except Exception as e:
        print(f"執行錯誤: {e}")
