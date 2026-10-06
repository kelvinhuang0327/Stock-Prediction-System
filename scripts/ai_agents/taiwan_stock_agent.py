
import sqlite3
import pandas as pd
import numpy as np
import talib
from datetime import datetime
from jury_experts import MethodTheoryExpert, TechnicalPragmatistExpert, ProgramArchitectureExpert

def get_sentiment_logic(news_list):
    # Improved heuristic for sentiment
    BULLISH = ['利多', '上漲', '突破', '新高', '成長', '優於預期', '營收創新高', '擴產']
    BEARISH = ['利空', '下跌', '跌破', '新低', '衰退', '不如預期', '虧損', '下修']
    
    if not news_list: return 0.5
    score = 0
    for text in news_list:
        text = text.lower()
        if any(w in text for w in BULLISH): score += 1
        if any(w in text for w in BEARISH): score -= 1
    return np.clip((score / len(news_list)) * 0.5 + 0.5, 0, 1)

def run_agent_analysis(db_path='prisma/dev.db'):
    conn = sqlite3.connect(db_path)
    stocks_df = pd.read_sql_query("SELECT id, name FROM Stock", conn)
    quotes_df = pd.read_sql_query("SELECT * FROM StockQuote ORDER BY date ASC", conn)
    chips_df = pd.read_sql_query("SELECT * FROM InstitutionalChip ORDER BY date ASC", conn)
    news_df = pd.read_sql_query("SELECT * FROM NewsEvent ORDER BY publishedAt DESC", conn)
    conn.close()

    experts = [MethodTheoryExpert(), TechnicalPragmatistExpert(), ProgramArchitectureExpert()]
    
    final_reports = []
    
    for _, stock in stocks_df.iterrows():
        sid, sname = stock['id'], stock['name']
        s_quotes = quotes_df[quotes_df['stockId'] == sid].copy()
        s_chips = chips_df[chips_df['stockId'] == sid].copy()
        s_news = news_df[news_df['stockId'] == sid].copy()

        if len(s_quotes) < 30: continue

        # --- Data Prep for Experts ---
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
        
        # Mock Sector Rotation (In reality, we'd query the Industry table)
        industry = "電子半導體" if sid in ['2330', '2454'] else ("AI 伺服器" if sid in ['2382', '2317'] else "其他")
        sector_rotation = industry if ("電子" in industry or "AI" in industry) else None

        sentiment = get_sentiment_logic(s_news.head(10)['title'].tolist())
        
        # Advanced Chip Metrics
        trust_buys = s_chips.iloc[-10:]['trustBuy'].tolist()
        foreign_buys = s_chips.iloc[-10:]['foreignBuy'].tolist()
        
        # Calculate streaks
        trust_streak = 0
        for b in reversed(trust_buys):
            if b > 0: trust_streak += 1
            else: break
            
        foreign_streak = 0
        for b in reversed(foreign_buys):
            if b > 0: foreign_streak += 1
            else: break

        # 3-day net totals
        trust_net_3d = sum(trust_buys[-3:])
        foreign_net_3d = sum(foreign_buys[-3:])
        
        # Inst Concentration (Net Buy / Total Volume over 3 days)
        vol_3d = s_quotes['volume'].iloc[-3:].sum()
        inst_concentration = (trust_net_3d + foreign_net_3d) / vol_3d if vol_3d > 0 else 0
        
        # Holders Trend (change in 400 holders over last 10 records)
        holders400 = s_chips['holders400'].dropna().tolist()
        holders_trend = holders400[-1] - holders400[-5] if len(holders400) >= 5 else 0
        
        # Estimated Institutional Cost Basis (Simplified)
        # We look at the last 10 days of buying and weighted by price
        inst_net_10d = s_chips.iloc[-10:]['totalBuy'].values
        inst_prices = s_quotes.iloc[-10:]['close'].values
        
        inst_buy_only = np.where(inst_net_10d > 0, inst_net_10d, 0)
        total_inst_buy_vol = np.sum(inst_buy_only)
        if total_inst_buy_vol > 0:
            inst_avg_cost = np.sum(inst_buy_only * inst_prices) / total_inst_buy_vol
            price_vs_inst_cost = (latest['close'] - inst_avg_cost) / inst_avg_cost
        else:
            price_vs_inst_cost = 0

        # ATR-like volatility for Risk Expert
        s_quotes['tr'] = talib.TRANGE(s_quotes['high'], s_quotes['low'], s_quotes['close'])
        atr = talib.SMA(s_quotes['tr'], 14).iloc[-1]
        atr_percent = atr / latest['close']

        # --- Expert Jury Deliberation ---
        results = []
        results.append(experts[0].analyze({'vcp_volat': vcp_volat, 'ma_slope': ma_slope, 'is_breakout': is_breakout}, sentiment))
        
        chip_metrics = {
            'trust_streak': trust_streak,
            'foreign_streak': foreign_streak,
            'trust_net_3d': trust_net_3d,
            'foreign_net_3d': foreign_net_3d,
            'inst_concentration': inst_concentration,
            'holders_trend': holders_trend,
            'price_vs_inst_cost': price_vs_inst_cost
        }
        results.append(experts[1].analyze(chip_metrics, {'vol_mult': vol_mult}, sector_rotation))
        results.append(experts[2].analyze({'atr_percent': atr_percent, 'mdd_estimated': atr_percent * 2})) 

        # --- Synthesis (The "Jury Consensus") ---
        bullish_count = sum(1 for r in results if r['conclusion'] == "BULLISH")
        conviction = (bullish_count / 2) * 100 # Max 100
        
        if conviction >= 50:
            combined_report = f"\n🔍股票：{sid} {sname} (信心指數：{conviction}%)"
            for r in results:
                combined_report += "\n" + r['report']
            
            final_reports.append({
                'id': sid,
                'name': sname,
                'score': conviction,
                'report': combined_report
            })

    return sorted(final_reports, key=lambda x: x['score'], reverse=True)

if __name__ == "__main__":
    print(f"🚀 --- 台股 AI 專家審評會：資產翻倍獵人報告 V2 ({datetime.now().strftime('%Y-%m-%d')}) ---")
    reports = run_agent_analysis()
    
    if reports:
        for r in reports:
            print(r['report'])
            print("-" * 50)
    else:
        print("今日市場尚未發現具備強大潛力的標的。")
