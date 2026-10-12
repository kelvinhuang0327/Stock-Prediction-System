
import pandas as pd
import numpy as np

class BaseExpert:
    def __init__(self, name, background):
        self.name = name
        self.background = background

    def analyze(self, data):
        raise NotImplementedError

class MethodTheoryExpert(BaseExpert):
    """关注科學方法、熟悉各種先進的技術指標，熟悉AI理論"""
    def __init__(self):
        super().__init__("方法理論專家", "專長於量化指標與多代理系統協作邏輯")

    def analyze(self, technical_data, news_sentiment):
        # 邏輯：檢查指標是否過熱，是否存在背離，並評估情緒是否具備持續性
        vcp_volat = technical_data.get('vcp_volat', 1.0)
        ma_slope = technical_data.get('ma_slope', 0)
        is_breakout = technical_data.get('is_breakout', False)
        
        vcp_status = "精確壓縮" if vcp_volat < 0.015 else ("合理壓縮" if vcp_volat < 0.03 else "過於震盪")
        trend_strength = "超強" if ma_slope > 0.02 else ("強勁" if ma_slope > 0.005 else "偏弱")
        
        report = f"--- [{self.name}] 評核建議 ---\n"
        report += f"理論基礎：VCP 現狀為 {vcp_status} ({round(vcp_volat*100,2)}%)，趨勢強度為 {trend_strength}。\n"
        
        if is_breakout and vcp_volat < 0.02:
            report += "理論確認：符合標普 500 名家 Mark Minervini 的 VCP 突破模型，具備翻倍潛力。\n"
        
        if news_sentiment > 0.7:
            report += "情緒面得分極高，具備『自我實現預言』的非理性獲利特質，建議追蹤動能。\n"
        elif news_sentiment < 0.3:
            report += "情緒低迷，技術面突破可能為『假突破』，需警惕理論失效。\n"
        else:
            report += "情緒中性，遵循標準技術指標操作即可。\n"
            
        return {
            "role": self.name,
            "conclusion": "BULLISH" if news_sentiment > 0.6 and technical_data.get('ma_slope', 0) > 0 else "NEUTRAL",
            "report": report
        }

class TechnicalPragmatistExpert(BaseExpert):
    """關注系統邊界、程式預測方法可行性和實作，熟悉AI運作"""
    def __init__(self):
        super().__init__("技術務實專家", "關注數據邊界與實際交易邊際效應")

    def analyze(self, chip_data, volume_data, sector_rotation=None):
        trust_streak = chip_data.get('trust_streak', 0)
        foreign_streak = chip_data.get('foreign_streak', 0)
        inst_concentration = chip_data.get('inst_concentration', 0)
        holders_trend = chip_data.get('holders_trend', 0)
        cost_diff = chip_data.get('price_vs_inst_cost', 0)
        vol_mult = volume_data.get('vol_mult', 0)
        
        report = f"--- [{self.name}] 籌碼深度評核 ---\n"
        
        # Check data availability
        has_chips = (trust_streak + foreign_streak + abs(inst_concentration)) > 0
        
        if not has_chips:
            report += "⚠️ 警示：資料庫中缺乏該股票的法人籌碼明細。僅能依賴量价特徵評估。\n"
            if vol_mult > 3:
                report += f"量能觀察：成交量爆出 {round(vol_mult, 1)} 倍，屬『無名火』爆發，需注意是否為短線主力隔日沖。\n"
        else:
            report += f"1. 法人動態：投信連買{trust_streak}天，外資連買{foreign_streak}天。\n"
            report += f"2. 籌碼集中度：近期成交量中 {round(inst_concentration*100, 2)}% 由法人貢獻。\n"
            if holders_trend > 0:
                report += f"3. 大戶動向：400張大戶持股比例呈現上升趨勢，利於鎖籌。\n"
        
        if sector_rotation:
            report += f"4. 產業輪動：符合 {sector_rotation} 板塊熱點資金流入。\n"

        # Logic for "Doubling Stock" potential
        is_accumulating = has_chips and (trust_streak >= 3 or foreign_streak >= 3) and inst_concentration > 0.05
        is_vol_breakout = vol_mult > 3
        
        if is_accumulating and is_vol_breakout:
            report += "👉 結論：【強烈吸籌突破】。法人籌碼高度集中且量能爆發，係典型的飆股起漲形態。\n"
            conclusion = "BULLISH"
        elif is_vol_breakout:
            report += "👉 結論：【純量能爆發】。缺乏法人背書，建議小部位先行或等待回測支撐。\n"
            # We still give a BULLISH if volume is insane, but with caution
            conclusion = "BULLISH" if vol_mult > 6 else "NEUTRAL"
        elif is_accumulating:
            report += "👉 結論：【潛在低位吸籌】。股價尚未爆發但法人持續進場，適合中長期佈局。\n"
            conclusion = "BULLISH"
        else:
            report += "👉 結論：【籌碼分散】。目前尚無法人介入跡象。\n"
            conclusion = "NEUTRAL"

        return {
            "role": self.name,
            "conclusion": conclusion,
            "report": report
        }

class ProgramArchitectureExpert(BaseExpert):
    """關注實作成本、開發優先級，熟悉AI實作"""
    def __init__(self):
        super().__init__("程式架構專家", "專注於風險控制與執行優先權")

    def analyze(self, risk_profile):
        # 邏輯：評估當前波動率與潛在下行風險
        atr = risk_profile.get('atr_percent', 0)
        mdd = risk_profile.get('mdd_estimated', 0)
        
        report = f"--- [{self.name}] 評核建議 ---\n"
        report += f"執行層面：當前波動率為 {round(atr*100, 2)}%，預期回撤風險為 {round(mdd*100, 2)}%。\n"
        
        if atr > 0.05:
            report += "優先級：高風險高回報標的。建議分批進場，降低初始實作成本（風險敞口）。\n"
        else:
            report += "優先級：穩定標的。可作為核心持股優先開發（買入）。\n"

        return {
            "role": self.name,
            "conclusion": "STABLE" if atr < 0.03 else "VOLATILE",
            "report": report
        }
