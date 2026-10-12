
import sqlite3
import pandas as pd
import numpy as np
import talib
import sys
import json
from datetime import datetime
from jury_experts import MethodTheoryExpert, TechnicalPragmatistExpert, ProgramArchitectureExpert

def get_sentiment_logic(news_list):
    BULLISH = ['利多', '上漲', '突破', '新高', '成長', '優於預期', '營收創新高', '擴產']
    BEARISH = ['利空', '下跌', '跌破', '新低', '衰退', '不如預期', '虧損', '下修']
    if not news_list: return 0.5
    score = 0
    for text in news_list:
        text = text.lower()
        if any(w in text for w in BULLISH): score += 1
        if any(w in text for w in BEARISH): score -= 1
    return np.clip((score / len(news_list)) * 0.5 + 0.5, 0, 1)

def analyze_single_stock(stock_id, db_path='prisma/dev.db'):
    conn = sqlite3.connect(db_path)
    stock = pd.read_sql_query("SELECT id, name FROM Stock WHERE id = ?", conn, params=(stock_id,))
    if stock.empty:
        conn.close()
        return {"error": f"Stock {stock_id} not found"}
    
    sname = stock['name'].values[0]
    s_quotes = pd.read_sql_query("SELECT * FROM StockQuote WHERE stockId = ? ORDER BY date ASC", conn, params=(stock_id,))
    s_chips = pd.read_sql_query("SELECT * FROM InstitutionalChip WHERE stockId = ? ORDER BY date ASC", conn, params=(stock_id,))
    s_news = pd.read_sql_query("SELECT * FROM NewsEvent WHERE stockId = ? ORDER BY publishedAt DESC", conn, params=(stock_id,))
    conn.close()

    if len(s_quotes) < 30:
        return {"error": "Insufficient quote data (min 30 days needed)"}

    experts = [MethodTheoryExpert(), TechnicalPragmatistExpert(), ProgramArchitectureExpert()]

    # Data Prep
    s_quotes['ma5'] = talib.SMA(s_quotes['close'], 5)
    s_quotes['ma10'] = talib.SMA(s_quotes['close'], 10)
    s_quotes['ma20'] = talib.SMA(s_quotes['close'], 20)
    ma_slope = talib.LINEARREG_SLOPE(s_quotes['ma5'], 3).iloc[-1]
    vcp_volat = s_quotes.iloc[-11:-1]['close'].std() / s_quotes.iloc[-11:-1]['close'].mean()
    
    latest = s_quotes.iloc[-1]
    high20 = s_quotes['high'].shift(1).rolling(20).max().iloc[-1]
    is_breakout = latest['close'] > high20
    
    vol_ma5 = s_quotes['volume'].shift(1).rolling(5).mean().iloc[-1]
    vol_mult = latest['volume'] / vol_ma5 if vol_ma5 > 0 else 0
    
    industry = "電子半導體" if stock_id in ['2330', '2454'] else ("AI 伺服器" if stock_id in ['2382', '2317'] else "其他")
    sector_rotation = industry if ("電子" in industry or "AI" in industry) else None
    sentiment = get_sentiment_logic(s_news.head(10)['title'].tolist())
    
    # Chips
    trust_buys = s_chips.iloc[-10:]['trustBuy'].tolist()
    foreign_buys = s_chips.iloc[-10:]['foreignBuy'].tolist()
    trust_streak = 0
    for b in reversed(trust_buys):
        if b > 0: trust_streak += 1
        else: break
    foreign_streak = 0
    for b in reversed(foreign_buys):
        if b > 0: foreign_streak += 1
        else: break
    
    vol_3d = s_quotes['volume'].iloc[-3:].sum()
    inst_concentration = (sum(trust_buys[-3:]) + sum(foreign_buys[-3:])) / vol_3d if vol_3d > 0 else 0
    holders400 = s_chips['holders400'].dropna().tolist()
    holders_trend = holders400[-1] - holders400[-5] if len(holders400) >= 5 else 0
    
    inst_net_10d = s_chips.iloc[-10:]['totalBuy'].values
    inst_prices = s_quotes.iloc[-10:]['close'].values
    inst_buy_only = np.where(inst_net_10d > 0, inst_net_10d, 0)
    total_inst_buy_vol = np.sum(inst_buy_only)
    price_vs_inst_cost = (latest['close'] - (np.sum(inst_buy_only * inst_prices) / total_inst_buy_vol)) / (np.sum(inst_buy_only * inst_prices) / total_inst_buy_vol) if total_inst_buy_vol > 0 else 0

    s_quotes['tr'] = talib.TRANGE(s_quotes['high'], s_quotes['low'], s_quotes['close'])
    atr = talib.SMA(s_quotes['tr'], 14).iloc[-1]
    atr_percent = atr / latest['close']

    # Deliberation
    results = []
    results.append(experts[0].analyze({'vcp_volat': vcp_volat, 'ma_slope': ma_slope, 'is_breakout': is_breakout}, sentiment))
    results.append(experts[1].analyze({
        'trust_streak': trust_streak, 'foreign_streak': foreign_streak,
        'inst_concentration': inst_concentration, 'holders_trend': holders_trend,
        'price_vs_inst_cost': price_vs_inst_cost
    }, {'vol_mult': vol_mult}, sector_rotation))
    results.append(experts[2].analyze({'atr_percent': atr_percent, 'mdd_estimated': atr_percent * 2}))

    bullish_count = sum(1 for r in results if r['conclusion'] == "BULLISH")
    conviction = (bullish_count / 2) * 100

    return {
        "id": stock_id,
        "name": sname,
        "conviction": conviction,
        "experts": results,
        "metrics": {
            "vcp": round(vcp_volat * 100, 2),
            "vol_mult": round(vol_mult, 2),
            "inst_concentration": round(inst_concentration * 100, 2),
            "atr_percent": round(atr_percent * 100, 2)
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Stock ID required"}))
        sys.exit(1)
    
    stock_id = sys.argv[1]
    result = analyze_single_stock(stock_id)
    print(json.dumps(result, ensure_ascii=False))
