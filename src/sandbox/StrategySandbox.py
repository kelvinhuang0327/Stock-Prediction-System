"""
Strategy Sandbox
策略沙盒與自動發現模組

功能：
1. 自動生成策略參數變體
2. 平行執行回測
3. 尋找最佳參數組合
4. 儲存發現結果
"""

import sys
import os
import json
import random
import multiprocessing
from typing import Dict, List, Any
from datetime import datetime
import pandas as pd
import numpy as np

# Add project root to path
sys.path.append(os.getcwd())

from rolling_backtest_engine import RollingBacktestEngine

class StrategySandbox:
    def __init__(self, db_path='prisma/dev.db'):
        self.db_path = db_path
        self.results = []
        
    def generate_variants(self, n_variants=100) -> List[Dict]:
        """生成參數變體"""
        variants = []
        for _ in range(n_variants):
            params = {
                # 進場參數 (Strategy Logic)
                'ma_period': random.randint(5, 60),
                'revenue_yoy_threshold': random.uniform(10, 50),
                'volatility_threshold': random.uniform(2.0, 5.0),
                
                # 出場參數 (Engine Logic)
                'stop_loss': round(random.uniform(0.05, 0.15), 3),
                'take_profit': round(random.uniform(0.15, 0.50), 3),
                'time_stop': random.randint(10, 60)
            }
            variants.append(params)
        return variants

    def _run_single_simulation(self, args):
        """執行單一模擬（用於多進程）"""
        params, start_date, end_date = args
        
        # 這裡定義策略邏輯
        # 為了能被 pickle 序列化，我們在這裡定義或使用 top-level function
        
        # 動態定義策略函數
        def dynamic_strategy(current_date, daily_data):
            candidates = []
            
            # 確保 MA 資料存在 (因為 engine 預先計算了 ma5, ma10, ma20)
            # 但我們的參數 ma_period 可能是任意值，engine 只預算了固定的
            # 這裡為了效能，我們暫時限制 ma_period 只能選 engine 有算的 ma5, 10, 20
            # 或者我們得在 strategy 內自己算...
            # 為了 Sandbox 的靈活性，我們假設 strategy 只能用 daily_data 裡有的
            # 但 engine 預算的只有 ma5, 10, 20
            # *修正計劃*: 讓 variant 只從 [5, 10, 20] 選 MA
            
            # 簡單策略邏輯：
            # 1. 收盤價 > MA
            # 2. 營收 YoY > threshold (假設資料庫有這欄位，或從 daily_slice 取得)
            # 目前 StockQuote 表沒有營收資料，只有 MonthlyRevenue 表
            # 這是一個限制。為了簡化，我們先用這幾個因子：
            # - Volume > MA20_Volume * 1.5 (爆量)
            # - Close > MA (趨勢)
            
            try:
                # 篩選符合條件的股票
                # 條件 1: 收盤價站上 MA (這裡簡化用 MA20, 因為 engine 有算)
                ma_col = f"ma{params['ma_period']}"
                if ma_col not in daily_data.columns:
                    ma_col = 'ma20' # Fallback
                
                # 條件 2: 爆量
                vol_cond = daily_data['volume'] > daily_data['vol_ma20'] * 1.5
                
                # 條件 3: 價格強勢
                price_cond = daily_data['close'] > daily_data[ma_col]
                
                # 結合
                matches = daily_data[vol_cond & price_cond]
                candidates = matches.index.get_level_values('stockId').tolist()
            except Exception:
                pass
                
            return candidates

        try:
            # 每個進程需要自己的 engine 實例 (SQLite 連接不能跨進程共享)
            engine = RollingBacktestEngine(
                db_path=self.db_path, 
                position_mode='fixed',
                strict_mode=False, # Sandbox 跑快一點，先關閉 strict check
                filter_survivorship=True
            )
            
            # 使用受限的參數空間修正
            if params['ma_period'] not in [5, 10, 20]:
                params['ma_period'] = [5, 10, 20][params['ma_period'] % 3]

            result = engine.run(
                dynamic_strategy, 
                start_date=start_date, 
                end_date=end_date, 
                params=params
            )
            
            # 提取關鍵指標
            return {
                'params': params,
                'metrics': {
                    'total_return': result.get('total_return_pct', 0),
                    'win_rate': result.get('win_rate', 0),
                    'sharpe': result.get('sharpe_ratio', 0),
                    'trades': result.get('total_trades', 0)
                }
            }
        except Exception as e:
            return {'error': str(e), 'params': params}

    def run_sandbox(self, n_variants=20, start_date='2025-06-01', end_date='2025-12-31'):
        """執行沙盒實驗"""
        print(f"🧪 Starting Strategy Sandbox with {n_variants} variants...")
        print(f"📅 Period: {start_date} to {end_date}")
        
        variants = self.generate_variants(n_variants)
        
        # 準備多進程參數
        tasks = [(v, start_date, end_date) for v in variants]
        
        # 使用 CPU 核心數 - 1
        num_workers = max(1, multiprocessing.cpu_count() - 1)
        print(f"🚀 Running on {num_workers} cores...")
        
        with multiprocessing.Pool(processes=num_workers) as pool:
            results = pool.map(self._run_single_simulation, tasks)
        
        # 過濾錯誤
        valid_results = [r for r in results if 'error' not in r]
        print(f"✅ Completed {len(valid_results)}/{n_variants} simulations.")
        
        # 排序結果 (依回報率)
        sorted_results = sorted(valid_results, key=lambda x: x['metrics']['total_return'], reverse=True)
        
        self.results = sorted_results
        return sorted_results

    def save_discoveries(self, filename='sandbox_discoveries.json'):
        """儲存優秀策略"""
        top_10 = self.results[:10]
        
        output = {
            'timestamp': datetime.now().isoformat(),
            'total_simulations': len(self.results),
            'top_discoveries': top_10
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
            
        print(f"💾 Top 10 strategies saved to {filename}")

if __name__ == "__main__":
    sandbox = StrategySandbox()
    top_results = sandbox.run_sandbox(n_variants=10) # 測試跑 10 組
    
    print("\n🏆 Top 3 Strategies:")
    for i, res in enumerate(top_results[:3], 1):
        m = res['metrics']
        p = res['params']
        print(f"{i}. Return: {m['total_return']:.2f}% | Win Rate: {m['win_rate']*100:.1f}% | Sharpe: {m['sharpe']:.2f}")
        print(f"   Params: MA{p['ma_period']}, SL{p['stop_loss']}, TP{p['take_profit']}, Time{p['time_stop']}")
        print("-" * 50)
    
    sandbox.save_discoveries()
