import pandas as pd
import numpy as np
import sqlite3
import talib
from datetime import datetime, timedelta

# Basic Sentiment Dictionary (Traditional Chinese)
BULLISH_KEYWORDS = [
    '利多', '上漲', '突破', '新高', '成長', '優於預期', '買進', '看好',
    '旺季', '獲利', '營收創新高', '大漲', '暴漲', '復甦', '加碼', '並購',
    '轉虧為盈', '訂單滿載', '缺貨潮', '擴產'
]

BEARISH_KEYWORDS = [
    '利空', '下跌', '跌破', '新低', '衰退', '不如預期', '賣出', '看淡',
    '淡季', '虧損', '營收下滑', '大跌', '崩盤', '衰退', '減碼', '制裁',
    '停工', '砍單', '違約', '下修'
]

def analyze_sentiment(news_list):
    """
    Simple keyword-based sentiment analysis.
    Returns a score between -1.0 and 1.0.
    """
    if not news_list:
        return 0.0
    
    total_score = 0
    for title, summary in news_list:
        text = (title + (summary or "")).lower()
        score = 0
        for word in BULLISH_KEYWORDS:
            if word in text: score += 1
        for word in BEARISH_KEYWORDS:
            if word in text: score -= 1
        total_score += np.clip(score, -2, 2)
        
    avg_score = total_score / len(news_list)
    return np.clip(avg_score / 2.0, -1.0, 1.0)

def get_ai_advice(db_path='prisma/dev.db'):
    conn = sqlite3.connect(db_path)
    
    # 1. Load Stocks
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    
    # 2. Load latest quotes
    quotes_df = pd.read_sql_query("""
        SELECT stockId, date, open, high, low, close 
        FROM StockQuote 
        ORDER BY date ASC
    """, conn)
    
    # 3. Load latest news
    news_df = pd.read_sql_query("""
        SELECT stockId, title, summary, publishedAt 
        FROM NewsEvent 
        ORDER BY publishedAt DESC
    """, conn)
    
    conn.close()
    
    results = []
    
    for _, stock in stocks_df.iterrows():
        sid = stock['id']
        sname = stock['name']
        
        # Filter data
        s_quotes = quotes_df[quotes_df['stockId'] == sid]
        s_news = news_df[news_df['stockId'] == sid]
        
        if len(s_quotes) < 5:
            continue
            
        # A. Technical Baseline (Pivot Points)
        # Use previous day's data for today's pivots
        prev = s_quotes.iloc[-1]
        p = (prev['high'] + prev['low'] + prev['close']) / 3
        s1 = (2 * p) - prev['high']
        r1 = (2 * p) - prev['low']
        
        current_price = prev['close']
        
        # B. Sentiment Adjustment
        # Get news from the last 7 days
        recent_news = []
        for _, n in s_news.head(10).iterrows():
            recent_news.append((n['title'], n['summary']))
            
        sentiment = analyze_sentiment(recent_news)
        
        # Multiplier: -2% to +2% shift based on sentiment
        # Positive sentiment raises the entry price (less waiting for dip) 
        # and raises the target exit.
        sentiment_adj = sentiment * 0.02 
        
        # C. AI Logic
        suggested_entry = s1 * (1 + sentiment_adj)
        suggested_exit = r1 * (1 + sentiment_adj)
        
        # Safety Check: If current price is already below S1, entry is Market or S2
        # For simplicity, we suggest the calculated value but add a label
        
        advice = "HOLD"
        if sentiment > 0.3 and current_price < suggested_entry * 1.02:
            advice = "BUY (Wait for Entry)"
        elif sentiment < -0.3:
            advice = "CAUTION"
            
        results.append({
            'StockId': sid,
            'Name': sname,
            'Price': current_price,
            'Entry_入手': round(suggested_entry, 2),
            'Exit_出手': round(suggested_exit, 2),
            'Sentiment': "Positive" if sentiment > 0.2 else ("Negative" if sentiment < -0.2 else "Neutral"),
            'Advice': advice
        })
        
    return pd.DataFrame(results)

if __name__ == "__main__":
    print(f"--- AI Stock Entry/Exit Advisor Report ({datetime.now().strftime('%Y-%m-%d')}) ---")
    try:
        advice_df = get_ai_advice()
        if not advice_df.empty:
            # Sort by Sentiment or Advice
            print(advice_df.to_string(index=False))
            print("\n* 入手價格 (Entry): 基於技術支撐位與當前時事情緒調整後的建議買入點。")
            print("* 出手價格 (Exit): 基於技術壓力位與當前時事情緒調整後的建議獲利點。")
        else:
            print("No data available for AI advice.")
    except Exception as e:
        print(f"Error in AI Advisor: {e}")
