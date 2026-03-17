
import os
from datetime import datetime
from taiwan_stock_agent import run_agent_analysis

def generate_doubling_report():
    reports = run_agent_analysis()
    
    md_content = f"""# 🚀 台股資產翻倍系統：AI 專家審評會報告
日期：{datetime.now().strftime('%Y-%m-%d')}

## ⚖️ 虛擬設計評審團成員
1. **方法理論專家**：關注科學方法、VCP 突破模型與 AI 預測邏輯。
2. **技術務實專家**：關注籌碼邊界、法人動態與產業輪動熱點。
3. **程式架構專家**：關注執行優先級、波動風險與 MDD 風險控制。

---

## 💎 今日潛力股掃描 (Asset Doubling Candidates)
"""
    
    if not reports:
        md_content += "\n> **今日結論**：市場目前處於整理期，尚未偵測到符合「資產翻倍」高標準的標的。建議保留現金，等待 VCP 壓縮到位。\n"
    else:
        for r in reports:
            md_content += f"\n### 🎯 {r['id']} {r['name']} (總體信心：{r['score']}%)\n"
            md_content += r['report'] + "\n"
            md_content += "\n---\n"

    md_content += """
## 📅 短中長期可行性策略建議

### 🔴 短期策略 (1-5日)：情緒動能套利
- **監測指標**：成交量倍率 > 3x 且為產業龍頭。
- **AI 角色分工**：由「技術務實專家」監控盤中爆量情況，若發現法人同步進場則立刻提示。
- **目標**：捕捉 5-15% 的爆發波段。

### 🟡 中期策略 (1-3月)：VCP 模型佈局
- **監測指標**：VCP 壓縮 < 2% 且 MA 多頭排列。
- **AI 角色分工**：由「方法理論專家」進行歷史回測校準，確認該股在過去兩年內的突破成功率。
- **目標**：參與產業景氣復甦帶來的 30-50% 漲幅。

### 🟢 長期策略 (1年以上)：資產翻倍計畫
- **監測指標**：月營收成長 > 20% 且具備 AI/半導體等長期護城河。
- **AI 角色分工**：由「程式架構專家」建立 MDD 防線，一旦回撤超過 15% 觸發 AI 風險預警。
- **目標**：透過複利與強勢股長期持有，實現資產翻倍。

---
*本報告由 Antigravity AI Agent 驅動之專家陪審團自動生成，不構成投資建議。*
"""
    
    filename = f"docs/reports/doubling_report_{datetime.now().strftime('%Y%m%d')}.md"
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    print(f"✅ 報告已生成：{filename}")
    return filename

if __name__ == "__main__":
    generate_doubling_report()
