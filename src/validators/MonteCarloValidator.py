"""
Monte Carlo Robustness Validator
蒙地卡羅穩健性測試器

測試策略是否對以下因素穩健：
1. 買入時間點的微小變化 (±1, ±2 天)
2. 參數的微小變化 (MA 週期 ±2, 門檻 ±5%)
3. 隨機性影響

如果策略對這些小變化非常敏感，可能是過度優化 (overfitting)
"""

import numpy as np
from typing import List, Dict, Callable, Any
from dataclasses import dataclass
import random

@dataclass
class SimulationResult:
    """單次模擬結果"""
    win_rate: float
    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    total_trades: int

class MonteCarloValidator:
    """蒙地卡羅穩健性驗證器"""
    
    def __init__(self, seed: int = 42):
        """
        Args:
            seed: 隨機種子（確保可重現）
        """
        self.seed = seed
        random.seed(seed)
        np.random.seed(seed)
    
    def time_shift_test(
        self,
        backtest_func: Callable,
        iterations: int = 1000,
        max_shift_days: int = 2
    ) -> Dict:
        """
        時間位移測試
        
        將買入時間點隨機位移 ±1, ±2 天，觀察績效變化
        
        Args:
            backtest_func: 回測函數 (接受 shift_days 參數)
            iterations: 模擬次數
            max_shift_days: 最大位移天數
        
        Returns:
            穩健性報告
        """
        print(f"\n🔬 執行時間位移測試 ({iterations} 次模擬)...")
        
        results = []
        
        for i in range(iterations):
            # 隨機位移 -max_shift_days 到 +max_shift_days 天
            shift = random.randint(-max_shift_days, max_shift_days)
            
            try:
                # 執行回測（傳入位移參數）
                result = backtest_func(shift_days=shift)
                results.append({
                    'shift': shift,
                    'win_rate': result.get('win_rate', 0),
                    'return': result.get('total_return_pct', 0),
                    'sharpe': result.get('sharpe_ratio', 0)
                })
            except Exception as e:
                print(f"  ⚠️ 模擬 {i+1} 失敗: {e}")
                continue
            
            if (i + 1) % 100 == 0:
                print(f"  進度: {i+1}/{iterations}")
        
        # 計算統計數據
        win_rates = [r['win_rate'] for r in results]
        returns = [r['return'] for r in results]
        sharpes = [r['sharpe'] for r in results]
        
        win_rate_std = np.std(win_rates) * 100  # 轉為百分比
        return_std = np.std(returns)
        sharpe_std = np.std(sharpes)
        
        # 穩健性判定
        is_robust = win_rate_std < 10  # 勝率標準差 < 10%
        
        return {
            'test_type': 'TIME_SHIFT',
            'iterations': len(results),
            'is_robust': is_robust,
            'win_rate': {
                'mean': np.mean(win_rates) * 100,
                'std': win_rate_std,
                'min': np.min(win_rates) * 100,
                'max': np.max(win_rates) * 100
            },
            'return': {
                'mean': np.mean(returns),
                'std': return_std,
                'min': np.min(returns),
                'max': np.max(returns)
            },
            'sharpe': {
                'mean': np.mean(sharpes),
                'std': sharpe_std
            },
            'judgment': '穩健 ✅' if is_robust else '不穩健 ⚠️',
            'recommendation': self._get_recommendation(win_rate_std, return_std)
        }
    
    def parameter_sensitivity_test(
        self,
        backtest_func: Callable,
        base_params: Dict[str, Any],
        param_variations: Dict[str, List[float]]
    ) -> Dict:
        """
        參數敏感度測試
        
        測試策略參數微調對績效的影響
        
        Args:
            backtest_func: 回測函數 (接受 params 字典)
            base_params: 基準參數
            param_variations: 參數變化範圍
                例如: {'ma_period': [18, 19, 20, 21, 22]}
        
        Returns:
            敏感度報告
        """
        print(f"\n🔬 執行參數敏感度測試...")
        
        # 測試基準參數
        base_result = backtest_func(params=base_params)
        base_return = base_result.get('total_return_pct', 0)
        
        sensitivity_results = {}
        
        for param_name, variations in param_variations.items():
            param_results = []
            
            for value in variations:
                # 複製基準參數並修改當前測試參數
                test_params = base_params.copy()
                test_params[param_name] = value
                
                try:
                    result = backtest_func(params=test_params)
                    return_pct = result.get('total_return_pct', 0)
                    
                    # 計算績效變化
                    if base_return != 0:
                        change_pct = ((return_pct - base_return) / abs(base_return)) * 100
                    else:
                        change_pct = 0
                    
                    param_results.append({
                        'value': value,
                        'return': return_pct,
                        'change_pct': change_pct
                    })
                except Exception as e:
                    print(f"  ⚠️ 測試 {param_name}={value} 失敗: {e}")
            
            # 計算參數敏感度
            changes = [r['change_pct'] for r in param_results]
            max_degradation = min(changes) if changes else 0
            
            # 判定：參數變化 ±5% 導致績效下降 >20% = 過度優化
            is_overfitted = max_degradation < -20
            
            sensitivity_results[param_name] = {
                'results': param_results,
                'max_degradation': max_degradation,
                'is_overfitted': is_overfitted,
                'status': '過度優化 ❌' if is_overfitted else '穩健 ✅'
            }
            
            print(f"  {param_name}: {sensitivity_results[param_name]['status']} (最大降幅: {max_degradation:.1f}%)")
        
        return {
            'test_type': 'PARAMETER_SENSITIVITY',
            'base_return': base_return,
            'parameters': sensitivity_results,
            'overall_robust': all(not r['is_overfitted'] for r in sensitivity_results.values())
        }
    
    def _get_recommendation(self, win_rate_std: float, return_std: float) -> str:
        """根據測試結果給出建議"""
        if win_rate_std < 5:
            return "策略非常穩健，可以實盤使用"
        elif win_rate_std < 10:
            return "策略穩健性可接受，建議小倉位測試"
        elif win_rate_std < 15:
            return "策略穩健性不足，建議調整參數"
        else:
            return "策略可能過度優化，不建議實盤"
    
    def generate_report(self, time_shift_result: Dict, sensitivity_result: Dict) -> str:
        """生成綜合報告"""
        report = []
        report.append("\n" + "="*80)
        report.append("Monte Carlo 穩健性測試報告")
        report.append("="*80 + "\n")
        
        # 時間位移測試
        report.append("📊 時間位移測試結果:")
        report.append(f"  模擬次數: {time_shift_result['iterations']}")
        report.append(f"  勝率: {time_shift_result['win_rate']['mean']:.2f}% ± {time_shift_result['win_rate']['std']:.2f}%")
        report.append(f"  報酬: {time_shift_result['return']['mean']:.2f}% ± {time_shift_result['return']['std']:.2f}%")
        report.append(f"  判定: {time_shift_result['judgment']}")
        report.append(f"  建議: {time_shift_result['recommendation']}\n")
        
        # 參數敏感度測試
        report.append("📊 參數敏感度測試結果:")
        for param_name, result in sensitivity_result['parameters'].items():
            report.append(f"  {param_name}: {result['status']} (最大降幅: {result['max_degradation']:.1f}%)")
        report.append(f"\n  整體判定: {'穩健 ✅' if sensitivity_result['overall_robust'] else '過度優化 ❌'}\n")
        
        # 總結
        report.append("="*80)
        report.append("✅ 測試完成！" if (time_shift_result['is_robust'] and sensitivity_result['overall_robust']) else "⚠️ 發現問題，請檢視上述建議")
        report.append("="*80 + "\n")
        
        return "\n".join(report)

if __name__ == "__main__":
    # 測試範例
    validator = MonteCarloValidator(seed=42)
    
    # 模擬回測函數
    def mock_backtest(shift_days=0, params=None):
        """模擬回測函數"""
        # 基準績效
        base_win_rate = 0.6
        base_return = 15.0
        
        # 加入隨機性（模擬買入時間影響）
        noise = np.random.normal(0, 2)  # ±2% 隨機變化
        
        return {
            'win_rate': base_win_rate + np.random.normal(0, 0.05),
            'total_return_pct': base_return + noise + shift_days * 0.5,
            'sharpe_ratio': 1.5 + np.random.normal(0, 0.2)
        }
    
    # 測試 1: 時間位移
    time_result = validator.time_shift_test(mock_backtest, iterations=100)
    
    # 測試 2: 參數敏感度
    sens_result = validator.parameter_sensitivity_test(
        mock_backtest,
        base_params={'ma_period': 20},
        param_variations={'ma_period': [18, 19, 20, 21, 22]}
    )
    
    # 生成報告
    print(validator.generate_report(time_result, sens_result))
