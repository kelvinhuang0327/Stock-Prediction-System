"""
Chip Concentration Index Calculator
籌碼集中度指標計算器

使用 HHI (Herfindahl-Hirschman Index) 計算分點集中度
HHI = Σ(分點持股比例)²
"""

from typing import List, Dict, Tuple
from dataclasses import dataclass

@dataclass
class BrokerPosition:
    """券商分點持股"""
    broker_id: str
    broker_name: str
    shares: int
    percentage: float

class ChipConcentrationCalculator:
    """籌碼集中度計算器"""
    
    def calculate_hhi(self, positions: List[BrokerPosition]) -> float:
        """
        計算 HHI 指數
        
        HHI 範圍: 0-10000
        - 0-1500: 分散 (低集中度)
        - 1500-2500: 中等集中度
        - >2500: 高度集中
        
        Returns:
            HHI 指數 (0-10000)
        """
        if not positions:
            return 0.0
        
        # 計算總股數
        total_shares = sum(p.shares for p in positions)
        
        if total_shares == 0:
            return 0.0
        
        # 計算 HHI: Σ(持股比例%)²
        hhi = sum((p.shares / total_shares * 100) ** 2 for p in positions)
        
        return hhi
    
    def get_concentration_level(self, hhi: float) -> str:
        """
        取得集中度等級
        
        Returns:
            'LOW' | 'MEDIUM' | 'HIGH'
        """
        if hhi < 1500:
            return 'LOW'
        elif hhi < 2500:
            return 'MEDIUM'
        else:
            return 'HIGH'
    
    def identify_dominant_brokers(self, positions: List[BrokerPosition], 
                                   threshold: float = 5.0) -> List[BrokerPosition]:
        """
        識別主力分點 (持股比例 > threshold%)
        
        Args:
            positions: 分點持股列表
            threshold: 門檻百分比 (預設 5%)
        
        Returns:
            主力分點列表
        """
        total_shares = sum(p.shares for p in positions)
        
        if total_shares == 0:
            return []
        
        dominant = []
        for pos in positions:
            percentage = (pos.shares / total_shares) * 100
            if percentage >= threshold:
                dominant.append(BrokerPosition(
                    broker_id=pos.broker_id,
                    broker_name=pos.broker_name,
                    shares=pos.shares,
                    percentage=percentage
                ))
        
        # 按持股比例排序
        dominant.sort(key=lambda x: x.percentage, reverse=True)
        
        return dominant
    
    def calculate_top_n_concentration(self, positions: List[BrokerPosition], 
                                       top_n: int = 5) -> float:
        """
        計算前 N 大分點集中度
        
        Args:
            positions: 分點持股列表
            top_n: 前 N 大 (預設 5)
        
        Returns:
            前 N 大持股比例總和 (%)
        """
        if not positions:
            return 0.0
        
        total_shares = sum(p.shares for p in positions)
        
        if total_shares == 0:
            return 0.0
        
        # 按持股數排序
        sorted_positions = sorted(positions, key=lambda x: x.shares, reverse=True)
        
        # 取前 N 大
        top_positions = sorted_positions[:top_n]
        top_shares = sum(p.shares for p in top_positions)
        
        return (top_shares / total_shares) * 100

# 匯出給 TypeScript 使用的介面
if __name__ == "__main__":
    # 測試範例
    calc = ChipConcentrationCalculator()
    
    # 模擬分點持股
    positions = [
        BrokerPosition("9100", "元大永和", 50000, 0),
        BrokerPosition("9200", "凱基台北", 30000, 0),
        BrokerPosition("5380", "第一金證券", 20000, 0),
        BrokerPosition("1160", "日盛證券", 15000, 0),
        BrokerPosition("9600", "富邦證券", 10000, 0),
        # ... 其他小分點
        BrokerPosition("other", "其他", 75000, 0),  # 其他散戶
    ]
    
    # 計算 HHI
    hhi = calc.calculate_hhi(positions)
    print(f"HHI 指數: {hhi:.2f}")
    print(f"集中度等級: {calc.get_concentration_level(hhi)}")
    
    # 識別主力
    dominant = calc.identify_dominant_brokers(positions, threshold=5.0)
    print(f"\n主力分點 (持股 >5%):")
    for broker in dominant:
        print(f"  {broker.broker_name}: {broker.percentage:.2f}%")
    
    # 前 5 大集中度
    top5 = calc.calculate_top_n_concentration(positions, top_n=5)
    print(f"\n前 5 大分點集中度: {top5:.2f}%")
