已完成 CTO roadmap 更新：

[00-StockPlan/stock_roadmapPlan_20260504.md](/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/00-StockPlan/stock_roadmapPlan_20260504.md:13)

我把 roadmap 補上 **Version 1.2 CTO Alignment Update - 2026-05-11**，並把系統方向重新對齊成兩大主軸：

1. **台股股價預測研究能力**  
   技術面、時事面、基本面、籌碼面、市場環境，產出可審計的 research prediction snapshot。

2. **預測策略模擬優化能力**  
   shadow ledger -> 5D/20D/60D outcome -> PIT-safe simulation -> optimizer，再逐步進入策略改良。

**最重要的 CTO 判斷**

交接報告建議下一步做 `P0-02C Shadow Prediction Daily Dry-run Writer`，方向是對的，但我把它降到 **P1**。原因是我查到一個新的 P0 blocker：

目前 DB date 多數是 `YYYY-MM-DD`，但部分 API route 會把 `asOfDate=2026-05-11` 轉成 `20260511` 傳入下游。若下游用字串比較 `date <= '20260511'`，可能讓 `2026-05-18` 這種 future row 漏進查詢。這會污染 shadow log，所以在寫 daily dry-run 前要先修。

**新的 P0-P10 排序**

| Priority | Task |
|---|---|
| P0 | As-of Date Format Hardening and MVP Path Leakage Recheck |
| P1 | P0-02C Shadow Prediction Daily Dry-run Writer |
| P2 | P0-02D Append-only Shadow Ledger Guard |
| P3 | P0-05 Non-MVP `detectRegime()` Caller Audit |
| P4 | Outcome Write-back v1 for 5D / 20D |
| P5 | PIT-safe Feature Store v1 - Technical + Regime |
| P6 | News + Fundamentals As-of Integration |
| P7 | Simulation Engine Unification |
| P8 | Strategy Optimizer Sandbox |
| P9 | Research Mode UI + Readiness Dashboard |
| P10 | ML Baseline / Ensemble Score |

**目前進度確認**

T-05B 到 T-05F、P0-01、P0-02A、P0-03、P0-04、P0-02B 都已在 repo/artifacts 中看到對應落地。`P0-02C` 尚未存在，`ShadowPredictionDailyDryRunWriter.ts` 也尚未建立。

另外，交接中提到的初始投資工具分析報告檔，我在目前工作樹沒有找到；這次 roadmap 是依照你貼的交接報告、現有 artifacts、實際程式碼狀態重新對齊。

本輪只更新 roadmap，未改程式碼，未跑測試。