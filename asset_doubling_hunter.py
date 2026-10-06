import pandas as pd
import numpy as np
import sqlite3
import talib
from datetime import datetime

# Sentiment Analysis logic from ai_advisor
BULLISH_KEYWORDS = ['利多', '上漲', '突破', '新高', '成長', '優於預期', '買進', '看好', '營收創新高', '擴產', '訂單']
BEARISH_KEYWORDS = ['利空', '下跌', '跌破', '新低', '衰退', '不如預期', '賣出', '看淡', '虧損', '下修']

def get_sentiment_score(news_list):
    if not news_list: return 0.5 # Neutral
    count = 0
    for title, summary in news_list:
        text = (title + (summary or "")).lower()
        if any(w in text for w in BULLISH_KEYWORDS): count += 1
        if any(w in text for w in BEARISH_KEYWORDS): count -= 1
    return np.clip((count / len(news_list)) * 0.5 + 0.5, 0, 1)

def hunt_doubling_stocks(db_path='prisma/dev.db'):
    conn = sqlite3.connect(db_path)
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    quotes_df = pd.read_sql_query("SELECT * FROM StockQuote ORDER BY date ASC", conn)
    chips_df = pd.read_sql_query("SELECT * FROM InstitutionalChip ORDER BY date ASC", conn)
    news_df = pd.read_sql_query("SELECT * FROM NewsEvent ORDER BY publishedAt DESC", conn)
    conn.close()

    results = []
    for _, stock in stocks_df.iterrows():
        sid, sname = stock['id'], stock['name']
        s_quotes = quotes_df[quotes_df['stockId'] == sid].copy()
        s_chips = chips_df[chips_df['stockId'] == sid].copy()
        s_news = news_df[news_df['stockId'] == sid].copy()

        if len(s_quotes) < 30: continue

        # 1. Technical Signals
        s_quotes['ma5'] = talib.SMA(s_quotes['close'], 5)
        s_quotes['ma10'] = talib.SMA(s_quotes['close'], 10)
        s_quotes['ma20'] = talib.SMA(s_quotes['close'], 20)
        s_quotes['high20'] = s_quotes['high'].shift(1).rolling(20).max()
        s_quotes['vol_ma5'] = s_quotes['volume'].shift(1).rolling(5).mean()
        
        latest = s_quotes.iloc[-1]
        prev = s_quotes.iloc[-2]
        
        # VCP Logic: Check volatility of last 10 days before today
        vcp_volat = s_quotes.iloc[-11:-1]['close'].std() / s_quotes.iloc[-11:-1]['close'].mean()
        
        # 2. Institutional Signals
        trust_buys = s_chips.iloc[-3:]['trustBuy'].values
        trust_streak = 0
        for b in reversed(trust_buys):
            if b > 0: trust_streak += 1
            else: break
            
        foreign_buys = s_chips.iloc[-3:]['foreignBuy'].values
        foreign_streak = 0
        for b in reversed(foreign_buys):
            if b > 0: foreign_streak += 1
            else: break

        # 3. Sentiment
        sentiment = get_sentiment_score([(n.title, n.summary) for n in s_news.head(5).itertuples()])

        # --- CONVICTION SCORING ---
        score = 0
        signals = []
        
        # A. Technical Breakout (Crucial)
        if latest['close'] > latest['high20'] and latest['ma5'] > latest['ma10'] > latest['ma20']:
            score += 40
            signals.append("突破高點+多頭排列")
        
        # B. Volume Spike
        vol_mult = latest['volume'] / latest['vol_ma5'] if latest['vol_ma5'] > 0 else 0
        if vol_mult > 3:
            score += 20
            signals.append(f"爆量確認({round(vol_mult,1)}倍)")
        elif vol_mult > 2:
            score += 10
            signals.append(f"帶量突破({round(vol_mult,1)}倍)")

        # C. Institutional Backing
        if trust_streak >= 2 or foreign_streak >= 2:
            score += 20
            signals.append(f"法人連買({max(trust_streak, foreign_streak)}天)")

        # D. VCP Pattern
        if vcp_volat < 0.015: # Very tight consolidation
            score += 10
            signals.append("VCP窄幅整理")

        # E. Sentiment
        if sentiment > 0.6:
            score += 10
            signals.append("時事利多")

        # Filter: Only show high conviction (Score > 50)
        if score >= 50:
            results.append({
                '代號': sid,
                '名稱': sname,
                '今日收盤': latest['close'],
                '漲幅%': round((latest['close'] - prev['close'])/prev['close']*100, 2),
                '信心分數': score,
                '關鍵訊號': ", ".join(signals),
                '成交量倍數': round(vol_mult, 2)
            })

    return pd.DataFrame(results).sort_values('信心分數', ascending=False)

if __name__ == "__main__":
    print(f"🚀 --- 資產翻倍計劃：高勝率飆股獵人報告 ({datetime.now().strftime('%Y-%m-%d')}) ---")
    try:
        hunter_df = hunt_doubling_stocks()
        if not hunter_df.empty:
            # Display nicely
            print(hunter_df.to_string(index=False))
            print("\n📈 投資建議：信心分數 > 70 為重點關注標的，法人連買且帶量突破通常是起漲點。")
        else:
            print("目前市場尚未偵測到符合「資產翻倍」高標準的飆股，建議暫時空手觀察。")
    except Exception as e:
        print(f"Error: {e}")
