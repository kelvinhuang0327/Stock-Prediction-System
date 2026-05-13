**Stock Prediction System**

**Long-Term Optimization Master Plan**

3 – 12 個月落地式系統優化 Roadmap

*撰寫角色：資深系統架構師 / 量化研究主管 / AI Agent Orchestration 顧問 / 台股資料工程顧問*

Version 1.0   ·   2026-05-04

Owner: Kelvin Huang

Version 1.1 CTO Alignment Update · 2026-05-07

Version 1.2 CTO Alignment Update · 2026-05-11

Version 1.3 CTO Alignment Update · 2026-05-11

Version 1.5 CTO Alignment Update · 2026-05-13

## **0. CTO Alignment Update - 2026-05-13 P25 Complete / Prediction Feature Integration P0**

### **0.1 Inputs Reviewed**

本次 update 依據：

* 2026-05-13 起始任務文件：`00-StockPlan/20260513/20260513.md`
* 最新 CTO roadmap：`docs/plans/stock_roadmapPlan_20260513_cto_reprioritized.md`
* P6-LITE + P8-PREFLIGHT final report：`outputs/online_validation/p6lite_p8preflight_final_report.md`
* P12 PIT Feature Contract final report：`outputs/online_validation/p12pit_feature_contract_final_report.md`
* P17 MonthlyRevenue schema/query gate patch final report
* P20 pre/post PIT impact comparison final report
* P24 production migration execution final report
* P25 post-migration observability final report
* 目前 git head：`330b8ea P25: Add final report — P25_POST_MIGRATION_OBSERVABILITY_COMPLETE`

### **0.2 Current Goal Alignment**

Stock Prediction System 的核心目標維持兩大主軸：

1. **台股股價預測研究能力**：根據技術面、時事面、基本面、籌碼面、市場環境，產出可審計、PIT-safe、可解釋的 prediction snapshot。
2. **預測策略模擬優化能力**：以 shadow ledger、outcome write-back、PIT-safe replay、simulation snapshot、walk-forward contract、optimizer gate 作為後續策略優化基礎。

P25 完成後，roadmap 不應繼續以 migration observability 為主軸。MonthlyRevenue releaseDate migration 已完成並通過 post-migration smoke；bucket schema 也已被 P6-LITE 判定為 `BY_DESIGN_BOUNDARY`。下一階段最該補的是「prediction snapshot 的產品可解釋性」：把技術/籌碼/月營收/regime/時事 context 變成穩定 feature + reason contract。

### **0.3 Current Implementation Status**

| Area | Current Status | CTO Read |
| :---- | :---- | :---- |
| Bucket schema | P6-LITE verdict = `BY_DESIGN_BOUNDARY`；5/58 mismatch 皆屬 Watch low-score boundary | 已解除 P0 blocker，不需要繼續 P7 code trace，除非新批次出現不同 pattern |
| Reason quality | P8-PREFLIGHT 找到 24/58 generic reason；9 template、9 scoring underoutput、4 factor explanation、2 snapshot capture | 目前最直接影響預測產品可信度 |
| MonthlyRevenue PIT | P17 patch、P24 production migration、P25 post-migration smoke 均完成；2143 rows releaseDate/backfill/query gate 通過 | P12 v0 需要刷新為 v1，不能再把 MonthlyRevenue 當待修 P0 |
| Technical / chip / regime scoring | `RuleBasedStockAnalyzer`、`SignalFusionEngine`、`StrategyScreenEngine` 已整合 | 可用，但 reason/factor evidence 還不夠產品級 |
| Fundamental scoring | MonthlyRevenue 已 PIT-safe；FinancialReport 尚未 availabilityDate 化且未啟用 scoring | 下一步應先做 FinancialReport availability contract，不應直接進 scoring |
| Event/news scoring | Event/topic/relevance 模組存在，但 NewsEvent 未接入 active scoring | 時事面是主軸 A 缺口；需先以 read-only PIT context 接入 |
| Simulation corpus | 60 entries、10 dates、2 symbols、coverageRatio 0.2333、qualityStatus `BLOCKED` | 不可進 optimizer；需先擴 universe/date/horizon 並等 outcome maturity |
| Post-migration replay | P20 已證明 P3/P19 4500 rows scoring delta = 0；P25 smoke 25/25 PASS | 廣泛 replay comparison 可降級，不是今日 P0 |

### **0.4 Roadmap Alignment Decision**

2026-05-12 版 roadmap 已過期：

* `P6 Bucket Schema Repair Diagnosis` 已完成，verdict = `BY_DESIGN_BOUNDARY`。
* `P8 Signal/Reason Generic Preflight` 已完成，但 repair 尚未完成。
* `P12 PIT Feature Contract v0` 已完成，但其中 MonthlyRevenue 風險狀態已被 P17/P24/P25 修復，需 v1 refresh。
* `P25` 已完成 post-migration observability；下一步不應把全部資源投向 migration replay。

新的排序：

* **今日 P0 是 P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment。**
* **今日 P1 是 P26-B Event / News PIT Context Adapter v0。**
* **今日 P2 是 P26-C FinancialReport Availability Contract + Fixture Dry Run。**
* P26 broad replay comparison 降為 P3，且應改成 targeted coverage comparison。

### **0.5 Reordered P0 to P10 Execution Plan**

| Priority | Task | Goal | Gate / DOD |
| :---- | :---- | :---- | :---- |
| **P0** | **P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment** | 補強 active scoring snapshot 的 reason/factor evidence，刷新 P12 v1，讓台股 prediction output 可審計 | Generic reason 從 24/58 降到 <=6 或剩餘皆有分類；score/bucket 不變；P25 smoke PASS；tests PASS |
| **P1** | **P26-B Event / News PIT Context Adapter v0** | 將時事面以 read-only context 接入 prediction snapshot | NewsEvent 只用 `publishedAt <= asOf`；禁止 `ingestedAt` 作歷史 gate；SourceTrust/Relevance 可見；不改 scoring formula |
| **P2** | **P26-C FinancialReport Availability Contract + Fixture Dry Run** | 準備更深基本面 integration | `availabilityDate` contract + fixture validation；FinancialReport 在 gate PASS 前不進 scoring |
| **P3** | **P26-D Targeted Post-Migration Replay / Coverage Comparison** | 針對真有 MonthlyRevenue 的 rows 衡量 availability/coverage，而不是只 replay P3/P19 absent corpus | releaseDate boundary samples PASS；不覆蓋 corpus；不宣稱績效 |
| **P4** | **Data Coverage and Corpus Expansion Gate v2** | 擴 symbol/date/horizon，降低 fixture bias | qualityStatus 不再 BLOCKED 前不得進 optimizer；60D maturity tracker 明確 |
| **P5** | **Simulation Engine Contract Unification** | 統一 StrategyBacktest / shadow replay / walk-forward / 成本滑價部位限制 | 單一 simulation contract；舊簡化路徑包裝或棄用 |
| **P6** | **Optimizer Sandbox Readiness Gate v1** | 定義何時可執行策略參數搜尋 | sample size、train/test split、horizon maturity、feature coverage、reason integrity 皆 machine-readable |
| **P7** | **Dashboard Contract v1 for Prediction Snapshot Health** | UI 顯示 feature freshness、PIT status、reason quality、DATA_LIMITED | Dashboard 不宣稱 production/optimizer readiness |
| **P8** | **Autonomous Scheduler / Learning Safety Repair** | 修 scheduler timezone、double execution、zombie job、outcome-to-insight loop | 安全修復後才可接 optimization automation |
| **P9** | **ML Baseline / Ensemble Research v0** | feature/outcome/corpus 成熟後才做 ML baseline | holdout-aware；不自動改 production scoring |
| **P10** | **ManualReview / Operator Approval Surface v2** | 重新接回人工審查，但只讀穩定 contract | action audited；無明確 gate 不得修改 scoring |

### **0.6 Key Blockers**

1. **Reason quality blocker**：24/58 generic reason 會讓使用者看不懂 prediction 的依據。
2. **Feature breadth blocker**：時事面與 FinancialReport 尚未 PIT-safe 接入 active scoring context。
3. **P12 stale contract blocker**：MonthlyRevenue 已修復，但 P12 v0 仍把它列為待修 HIGH risk，會誤導後續 agent。
4. **Simulation corpus blocker**：`coverageRatio=0.2333`、2 symbols、60D maturity 不足，optimizer 仍不可啟動。
5. **Autonomous learning blocker**：timezone / double execution / zombie state / learning loop 問題未解前，不能讓自動化學習推動 production scoring。

### **0.7 Most Valuable Next System Optimization**

今日最值得做：

**P26-A Prediction Feature Snapshot v1 + Reason / Factor Enrichment**

理由：

* 直接推進主軸 A：台股股價預測需要可解釋的 feature snapshot，而不是只有 score/bucket。
* P6/P25 已解除 schema/migration 阻塞，繼續做 migration replay 的邊際價值下降。
* P8 已指出最大品質問題：generic reason。這是最接近使用者體感的缺口。
* 主軸 B 的 optimizer 需要穩定 feature/reason contract 作輸入，因此 P0 也是 simulation optimization 的前置基礎。

## **0. CTO Alignment Update - 2026-05-11 P9 Complete / P10 Ready**

### **0.1 Inputs Reviewed**

本次 update 依據：

* 最新 git head：`675771a P9: Append fourth-date corpus and add quality gate v0`
* 2026-05-11 P9 handoff：Fourth-Date Corpus Append + Corpus Quality Gate v0
* P9 artifacts：
  * `outputs/online_validation/simulation_snapshot_corpus.jsonl`
  * `outputs/online_validation/p9_corpus_metrics_store.json`
  * `outputs/online_validation/p9_corpus_quality_gate.json`
  * `outputs/online_validation/p8_corpus_trend_stability.json`
* 目前 corpus 狀態：24 entries、4 asOf dates、2 symbols、3 horizons、coverageRatio 0.5833。
* 目前 quality gate：`DATA_LIMITED`，validation PASS，主要限制為 60D horizon coverage gap。

### **0.2 Current Goal Alignment**

Stock Prediction System 的核心目標維持兩大主軸：

1. **台股股價預測研究能力**：以技術面、時事面、基本面、籌碼面、市場環境建立可審計的 research snapshot。
2. **預測策略模擬優化能力**：以 shadow ledger、outcome write-back、PIT-safe replay、simulation snapshot corpus、quality gate 作為後續 optimizer 的安全前置。

P0 到 P9 的工作已經把「資料安全 -> shadow ledger -> outcome -> replay -> simulation snapshot -> multi-date corpus -> metrics/trend/quality gate」串成 observability-only foundation。下一階段不應急著進 optimizer，而應先讓 metrics/quality/trend 變成 UI-ready contract，讓 CTO dashboard 與未來前端可以正確解讀 `DATA_LIMITED`。

### **0.3 Current Implementation Status**

| Phase | Status | CTO Read |
| :---- | :---- | :---- |
| P0-COMBINED | COMPLETE | Date format audit + shadow daily writer + outcome skeleton 已落地 |
| P1 | COMPLETE | Outcome write-back v0 + append-only ledger guard |
| P2 | COMPLETE | Cross-run append-only shadow ledger accumulation |
| P3 | COMPLETE | Shadow outcome window tracker + backfill scheduler |
| P4 | COMPLETE | PIT-safe ledger replay engine v0 |
| P5 | COMPLETE | Replay simulation snapshot engine v0 |
| P6 | COMPLETE | Multi-date simulation snapshot corpus accumulation v0 |
| P7 | COMPLETE | Second-date corpus append + corpus metrics store v0 |
| P8 | COMPLETE | Third-date corpus append + trend stability v0 |
| P9 | COMPLETE | Fourth-date corpus append + corpus quality gate v0 |
| P10 | NEXT | Dashboard-ready Metrics Contract v0 |

### **0.4 P9 Quality Gate Interpretation**

P9 結果：

| Metric | Value | CTO Read |
| :---- | :---- | :---- |
| totalEntries | 24 | 4 dates x 2 symbols x 3 horizons |
| readyCount / blockedCount | 14 / 10 | 有可用 outcome，也有合理 blocked cases |
| uniqueAsOfDateCount | 4 | Multi-date corpus foundation 已成形 |
| coverageRatio | 0.5833 | 高於 basic threshold，但仍有限 |
| symbolCoverageGap | 0.3333 | 可接受但需擴 symbol |
| horizonCoverageGap | 0.875 | 主要限制；60D horizon 尚未成熟 |
| qualityStatus | DATA_LIMITED | 不是 fail；是資料覆蓋限制 |
| validationStatus | PASS | Guardrails pass |

CTO 判斷：

* `DATA_LIMITED` 不代表策略失敗，也不代表測試失敗。
* 目前 corpus 仍是 deterministic fixture-driven，不可作 production 或 optimizer promotion 依據。
* 60D horizon coverage 是目前最大資料限制，P10 dashboard 必須把它清楚呈現，避免被誤讀。

### **0.5 Roadmap Alignment Decision**

上一版 v1.2 將 P0 設為 as-of hardening、P1 設為 shadow daily writer；目前最新 repo 已透過 `P0-COMBINED` 到 P9 連續完成這些 foundation。因此 v1.2 的 priority 已過期。

新的排序：

* **今日 P0 不再是 as-of hardening，也不是 P0-02C。**
* **今日 P0 是 P10 - Dashboard-ready Metrics Contract v0。**
* 在 P10 完成前，不應進 optimizer、不應新增 ML baseline、不應宣稱策略績效。

### **0.6 Reordered P0 to P10 Execution Plan**

| Priority | Task | Goal | Gate / DOD |
| :---- | :---- | :---- | :---- |
| **P0** | **P10 Dashboard-ready Metrics Contract v0** | 將 P9 metrics / quality gate / P8 trend stability 轉成 UI-ready contract | `p10_dashboard_metrics_contract.json` parse OK；readiness cards / warning cards / guardrail cards complete；不可出現 production readiness claim |
| **P1** | **P11 Dashboard Artifact Renderer / Read-only UI Adapter** | 將 P10 contract 對接 read-only dashboard 或 API response | 無 domain mutation；顯示 DATA_LIMITED、horizon gap、fixture warning |
| **P2** | **P12 Fifth-Date Corpus Append + 60D Maturity Fixture** | 增加第 5 個 asOfDate，改善 horizon coverage 或明確維持 DATA_LIMITED | corpus entries 增加；duplicate guard pass；60D blocked reason 更細 |
| **P3** | **P13 Symbol Universe Expansion v0** | 從 2 symbols 擴到小型 basket，仍 fixture-safe | per-symbol coverage table pass；no optimizer write；no performance claim |
| **P4** | **P14 Real Data Candidate Adapter for Shadow Corpus** | 將 deterministic fixture pathway 與真實 StrategyScreenEngine output contract 對齊 | real-data adapter dry-run only；asOf/PIT guard pass；不寫 production |
| **P5** | **P15 News/Fundamental PIT Snapshot Adapter** | 納入時事面與基本面 snapshot，但只作輔助特徵 | `publishedAt <= asOf`、月營收/財報 availability lag、missingSources 明確 |
| **P6** | **P16 Simulation Engine Contract Unification** | 統一 replay snapshot 與成本/滑價/部位限制模型 | 使用 TradingCostModel；舊簡化 backtest 降級或包裝；仍不宣稱績效 |
| **P7** | **P17 Optimizer Sandbox Readiness Gate** | 定義 optimizer 可啟動條件，不執行 optimizer promotion | minimum corpus size、coverage threshold、outcome maturity threshold 全明確 |
| **P8** | **P18 Strategy Optimizer Sandbox v0** | 在通過 P17 gate 後才做參數 search | train/test split；approval-required output；no auto mutation |
| **P9** | **P19 Production Data Backfill Plan** | 擴充 InstitutionalChip、MonthlyRevenue、FinancialReport、NewsEvent coverage | backfill plan + source audit + PIT availability rules |
| **P10** | **P20 ML Baseline / Ensemble Research v0** | 只有在 feature/outcome/corpus 成熟後才建 ML baseline | calibration report、holdout report、no production claim |

### **0.7 Key Blockers**

1. **Dashboard contract missing**：P6-P9 artifacts 已有，但尚無穩定 UI-ready schema，導致 CTO / 前端 / operator 無法一致解讀 corpus 狀態。
2. **DATA_LIMITED explanation risk**：目前 `horizonCoverageGap=0.875`，60D 大多 blocked。若 dashboard 沒有明確警示，容易被誤解成策略失敗或 production blocker。
3. **Fixture-driven corpus**：目前 corpus 仍以 deterministic fixture 為主，尚不能代表真實台股 universe。
4. **Universe too small**：2 symbols 不足以做 strategy optimization。
5. **No optimizer readiness gate**：即便有 quality gate，仍缺「何時可進 optimizer」的門檻定義。
6. **News/fundamental 尚未納入 corpus contract**：兩大目標要求技術面/時事面/基本面，但目前 corpus 仍偏技術與 fixture outcome。

### **0.8 Most Valuable Next System Optimization**

今日最值得做：

**P10 - Dashboard-ready Metrics Contract v0**

理由：

* P6-P9 已完成 corpus、metrics、trend、quality gate。
* 現在最缺的是一個讓 CTO dashboard / future UI agent 可以直接消費的穩定 contract。
* P10 不會碰 optimizer，不會產生交易訊號，不會宣稱策略績效。
* P10 會把 `DATA_LIMITED`、horizon gap、fixture-driven limitation、guardrail status、dashboard readiness 清楚結構化。

完成 P10 後，下一步才適合選擇：

* 若重視產品可視化：做 P11 read-only dashboard adapter。
* 若重視資料成熟：做 P12 fifth-date corpus + 60D fixture maturity。

## **0B. Previous CTO Alignment Update - 2026-05-11**

### **0.1 Inputs Reviewed**

本次 CTO update 依據：

* 2026-05-07 投資輔助工具上線驗證方向：MVP 上線前先完成資料安全、as-of gate、shadow validation，不先宣稱策略績效。
* 2026-05-11 每日工程交接報告：T-05B 到 T-05F、P0-01、P0-02A、P0-03、P0-04、P0-02B 完成狀態。
* 目前 repo 狀態：`outputs/online_validation/*` readiness artifacts、`src/lib/data/AsOfDataGate.ts`、`src/lib/data/MvpUniverseLock.ts`、`src/lib/onlineValidation/ShadowPredictionLogContract.ts`、MVP API as-of tests、MarketRegime as-of tests。
* 目前程式碼查核：`StrategyScreenEngine`、`/api/strategy/screen`、`MarketRegimeEngine`、`detectRegime()` caller audit。

### **0.2 Strategic Goal Reconfirmation**

Stock Prediction System 的下一階段不是單純延伸 walk-forward skeleton，而是回到兩大產品/技術主軸：

1. **台股股價預測研究能力**：根據技術面、時事面、基本面、籌碼面、市場環境產出可審計的 research prediction snapshot。
2. **預測策略模擬優化能力**：將 research snapshot 放入 shadow ledger，累積 5D / 20D / 60D outcome，再用 PIT-safe walk-forward / simulation / optimizer 驗證與調整策略。

所有輸出仍維持研究模式：不得宣稱保證獲利、精準預測、ROI、win-rate、alpha、edge、profit，也不得自動交易。

### **0.3 Current Implementation Status**

| Area | Current Status | CTO Read |
| :---- | :---- | :---- |
| Walk-forward observability | T-05B / T-05C / T-05D / T-05E / T-05F 已完成 | 可作 PIT / coverage / observability foundation；不是正式回測 |
| As-of gate foundation | P0-01 完成 `AsOfDataGate`、future-date quarantine、`MvpUniverseLock` | Foundation 可用，但仍需 date-format hardening |
| MVP API as-of integration | P0-02A / P0-03 完成 strategy screen、stock detail、history、backtest、validate、ops 主要路徑 | 主要路徑完成，但需統一 ISO vs YYYYMMDD |
| MarketIndex / MarketRegime gate | P0-04 完成 `detectRegime(asOf)` 與 MarketRegimeResult as-of lookup | 主流程完成，但仍有 7 個 non-MVP callers 待分類/補 gate |
| Shadow log contract | P0-02B 完成 contract、sanitization、duplicateKey、JSON/JSONL preview | Contract ready，但尚無 daily writer、append-only ledger、outcome write-back |
| Technical prediction | MA/RSI/MACD/KD/BB/ATR、fusion score、screen bucket 已存在 | 可進 shadow research，但不可稱正式模型 |
| Fundamental prediction | MonthlyRevenue / FinancialReport / StockMetrics 有 schema 與部分 overlay | 資料深度不足；月營收、財報、metrics 需補 as-of availability 與 backfill |
| News/event prediction | NewsEvent / event engines 存在 | 尚未完成個股 relatedSymbols as-of scoring 與 shadow log mapping |
| Simulation optimization | Backtest engine、T-05F observability、SimulatedTrade pipeline 皆存在 | 缺 shadow ledger outcome；不可先做 optimizer promotion |

### **0.4 Roadmap Alignment Decision**

2026-05-07 roadmap 的 P0 已經過期：T-05B 不再是今日 P0，因為 T-05B 到 T-05F 已完成。新的 roadmap 必須以「可安全產生每日 shadow research prediction log」為核心。

但在啟動 P0-02C daily dry-run writer 前，CTO audit 發現一個新的 P0 blocker：

* 目前 DB date rows 多數為 `YYYY-MM-DD`，例如 `StockQuote.date = 2026-05-18`。
* 部分 API route 會把 `asOfDate=2026-05-11` 轉為 `20260511` 再傳入 engine。
* 若下游 Prisma query 對 ISO date rows 使用 `date <= '20260511'`，字串比較可能無法排除 `2026-05-18`，因為 `2026-05-18` lexicographically 小於 `20260511`。
* 因此 P0-02C 如果直接使用現有 API path，可能把 future rows 寫入 dry-run artifact。

結論：下一步最值得優化的方向是先做 **P0 - As-of Date Format Hardening and MVP Path Leakage Recheck**，接著做 **P1 - Shadow Prediction Daily Dry-run Writer**。

### **0.5 Reordered P0 to P10 Execution Plan**

| Priority | Task | Goal | Gate / DOD |
| :---- | :---- | :---- | :---- |
| **P0** | **As-of Date Format Hardening and MVP Path Leakage Recheck** | 統一 `YYYY-MM-DD` / `YYYYMMDD` gate 行為，確認 strategy screen、fusion、regime、backtest 不會讀到 future rows | Red test 證明現有風險；修正後同一測試 PASS；實 DB asOf=2026-05-11 不讀 2026-05-18 |
| **P1** | **P0-02C Shadow Prediction Daily Dry-run Writer** | 將 StrategyScreenEngine research candidates 轉成每日 JSON / JSONL dry-run artifact | 使用 P0-02B contract；no DB write；no Prediction row；JSON/JSONL parse OK |
| **P2** | **P0-02D Append-only Shadow Ledger Guard** | 從 dry-run artifact 升級為 append-only research ledger，但仍不寫 production Prediction | duplicateKey guard、idempotent append、run manifest、no overwrite |
| **P3** | **P0-05 Non-MVP detectRegime Caller Audit** | 釐清 7 個 `detectRegime()` caller 是否屬 MVP path；屬 MVP 就補 asOf，非 MVP 就 artifact 標示 | detail、market/regime、RelevanceInsights、DailyAlert、DailyReport、PortfolioImpact、AutonomousResearch 全部有結論 |
| **P4** | **Outcome Write-back v1 for 5D / 20D** | 對 shadow ledger 回填後驗 outcome，建立 prediction quality 的第一個可審計基礎 | sourceDate > asOfDate only for outcome phase；entry snapshot immutable；outcome status CLOSED |
| **P5** | **PIT-safe Feature Store v1 - Technical + Regime** | 建立可版本化 feature snapshot，先只納入 OHLCV technical 與 MarketRegime | feature version、sourceDateBasis、golden tests、no future feature |
| **P6** | **News + Fundamentals As-of Integration** | 將時事面、月營收、財報、StockMetrics 納入 shadow snapshot 的輔助因子 | NewsEvent `publishedAt <= asOf`、relatedSymbols 查詢、月營收/財報 availability lag |
| **P7** | **Simulation Engine Unification** | 統一簡化 backtest 與成本模型 backtest，接上 shadow ledger outcome | 使用 TradingCostModel、slippage、position cap、liquidity guard；舊簡化 endpoint 降級或改接 |
| **P8** | **Strategy Optimizer Sandbox** | 對 researchScore 權重與 thresholds 做 walk-forward parameter search | train/test split、no in-sample promotion、optimizer output requires approval |
| **P9** | **Research Mode UI + Readiness Dashboard** | 讓使用者看到 asOfDate、dataCoverage、limitations、shadow status，不誤解為交易建議 | Dashboard 顯示 P0-P4 readiness；前端文案不出現 trading command |
| **P10** | **ML Baseline / Ensemble Score** | 只有在 P4 outcome 與 P5 feature store 穩定後，建立 ML baseline | feature coverage pass、outcome sample pass、calibration report pass |

### **0.6 Key Blockers**

1. **P0 date-format leakage risk**：asOf gate contract 已存在，但 ISO / YYYYMMDD 混用仍可能讓 future rows 漏進 MVP path。這是 P0-02C 前置 blocker。
2. **No daily shadow ledger yet**：P0-02B 只是 contract / preview，尚未每日產生 ledger，因此預測品質無法後驗。
3. **No outcome write-back**：沒有 5D / 20D outcome，就無法量化策略預測是否真的改善。
4. **News / fundamentals not PIT-complete**：時事與基本面還沒完整納入 as-of availability；目前只能作輔助描述。
5. **Simulation not unified**：`StrategyBacktestEngine` 有成本模型，但部分 API 仍有簡化回測；策略優化前必須統一。
6. **Non-MVP regime callers pending**：P0-04 已處理主流程，但 7 個 caller 仍需 audit，避免被前端或 daily report 間接使用。

### **0.7 Most Valuable Next System Optimization**

今日最應聚焦：

**P0 - As-of Date Format Hardening and MVP Path Leakage Recheck**

理由：如果 future-date gate 還存在格式風險，任何 shadow log 都可能被污染。污染的 shadow ledger 會讓後續 outcome、simulation optimizer、甚至 ML baseline 全部失去可信度。

完成 P0 後，立即接：

**P1 - P0-02C Shadow Prediction Daily Dry-run Writer**

目標是每天產出一份可 parse、可重跑、可審計、無交易語意的 research prediction snapshot，正式把系統推進到「可以開始累積預測資料」的階段。

## **0A. Previous CTO Alignment Update — 2026-05-07**

### **0.1 Inputs Reviewed**

本次更新依據：

* 原始 roadmap：`00-StockPlan/stock_roadmapPlan_20260504.md`
* 每日總結：`00-StockPlan/20260506/20260506.md`
* 目前 repo 狀態：T-03 / T-04 / T-09 / T-11 / T-12 / T-12b 相關檔案、outputs readiness artifacts、現有 T-05 Python walk-forward skeleton、targeted regression test。

### **0.2 Current System Status**

截至 2026-05-07 CTO audit，系統狀態更新如下：

| Area | Current Status | CTO Read |
| :---- | :---- | :---- |
| Daily Ops / Regime Observability | T-03 / T-09 / T-11 / T-12 / T-12b 已完成；Ops Report API 與 DailyReportEngine 已使用 persisted MarketRegimeResult 與 current date provider | Foundation 可用 |
| Scheduler Safety | T-04 SafetyGuard 已完成並接入 `daily-sync`；LLM hard-off / safe-run / missing-taskId alert 可用 | 局部完成，尚未覆蓋所有 orchestrator routes |
| Dynamic Date | runtime hardcoded `DEFAULT_CURRENT_DATE = '2026-05-06'` 已移除；API 支援 `?date=` override | 已解除 P0 date risk |
| Walk-forward | 舊 T-05 Python skeleton 存在，120 trading days、可讀取 persisted regime context，但仍有 hardcoded `TODAY_CAP` 且不是 TypeScript engine | 需要升級為 T-05B |
| Strategy Research | H001-H012 retired / 不得重啟；目前不應設計 H013+ 或宣稱 edge | Research line 暫停在 guardrail 內 |
| Data Foundation | 500-day feature history 仍不足；InstitutionalChip / MonthlyRevenue / FinancialReport backfill 未達 production-grade | P1/P2 blocker |
| Verification | 2026-05-07 targeted regression：7 suites / 89 tests PASS | Stabilization foundation 可繼續承接下一階段 |

### **0.3 Roadmap Alignment Decision**

原 roadmap 的大方向仍正確：先讓系統可觀測、可治理，再建立可驗證的 prediction / backtest / learning foundation。但根據 2026-05-06 每日總結與目前 repo 狀態，優先序需要調整：

* Phase 1 的核心 observability / safety 已大幅前進，下一步不是重新做 T-03 / T-04 / T-12b。
* 原 T-05 名稱已造成混淆；現有 Python skeleton 已做過一輪，下一任務必須命名為 **T-05B**，目標是 regime-aware、rule-only、portfolio-level、TypeScript-first skeleton v2。
* 原 Phase 2 的「rule-only walk-forward baseline」需改為「observability-only portfolio walk-forward skeleton」。不得輸出 buy / sell / signal，不得輸出 ROI / win-rate / alpha / edge 結論。
* Phase 3 的 ML baseline / ensembleScore 不應提前；必須等 T-05B contract、portfolio-level outputs、data foundation coverage 先穩定。
* Phase 4 / Phase 5 只有在 portfolio-level validation 產生可審計 candidate 後才啟動；否則 simulation realism 與 self-learning promotion gate 會變成無 signal 可模擬。

### **0.4 Current P0 / P1 / P2 Reorder**

| Priority | Task | Reason | Gate / DOD |
| :---- | :---- | :---- | :---- |
| P0 Today | **T-05B Portfolio Walk-Forward Backtest Skeleton v2** | 把 regime context、currentDate provider、Ops foundation、安全守則串成可執行 Measurement foundation | TypeScript engine、tests、contract artifacts、guardrail validation、no forbidden fields |
| P1 | Ops Report UI Dashboard + T-05B summary integration | API 已有但 operator 仍缺前端入口；T-05B 完成後需可觀測 | UI read-only、無 domain mutation、顯示 freshness / guardrails / walk-forward readiness |
| P1 | SafetyGuard orchestrator-wide integration | 目前只接 `daily-sync`，外部 task routes 尚未全覆蓋 | all orchestrator mutating/external-AI routes require taskId and SafetyDecision |
| P1 | Data Foundation Audit / Backfill Plan | 500-day walk-forward 與 H013+ 前置條件 | InstitutionalChip / MonthlyRevenue / FinancialReport coverage report and backfill plan |
| P2 | Feature store skeleton technical-only | 在 T-05B contract 穩定後建 feature pipeline | point-in-time tests and golden samples |
| P2 | KPI Dashboard v1 | T-05B / Ops / Safety artifacts 穩定後整合 | pipeline / freshness / LLM / walk-forward readiness |
| P2 | Hypothesis Registry / H013+ quality gate | 不可在 data foundation 不足時啟動 | no H013+ validation until coverage and portfolio skeleton pass |
| P2 Deferred | ML baseline / ensembleScore / shadow-to-full | 目前沒有可 promote signal，且 rule baseline retired | Wait for portfolio validation and data coverage |

### **0.5 Key Blockers**

1. **T-05 naming and implementation drift**：原 roadmap 的 T-05 容易與舊 Python skeleton / T-10 context enrichment 混淆。必須改名 T-05B，且要求 TypeScript engine 與 artifact contract。
2. **Data depth blocker**：500-day lookback 與後續 H013+ 需要更完整 InstitutionalChip / MonthlyRevenue / FinancialReport history。T-05B 可先做 skeleton，但正式 KPI / ML 不可提前。
3. **SafetyGuard coverage blocker**：`daily-sync` 已接 guard，但 orchestrator task routes 尚未全覆蓋，外部 AI / mutating route 仍需統一防線。
4. **Ops visibility blocker**：Ops Report API 已完成，但 UI dashboard 未完成，人類 operator 還不能快速掃描系統狀態。
5. **Research guardrail blocker**：H001-H012 不可重啟，H013+ 不可在 data foundation / portfolio skeleton 未完成前啟動。

### **0.6 Today Focus**

今天最值得聚焦的系統優化方向：

**T-05B - Portfolio Walk-Forward Backtest Skeleton v2**

這個任務是目前 Stabilization 與 Measurement 的交會點。它不追求績效結論，而是把系統推進到「可以安全、可測、可審計地衡量 portfolio-level readiness」的下一層。

## **Disclaimer / Hard Rules**

| 本計劃為系統優化技術藍圖，不構成投資建議，亦不保證任何獲利。系統的所有調整僅在 backtest / shadow / KPI gate 通過後才會進入 full execution。 |
| :---- |

* 不保證獲利、不聲稱可準確預測股價。

* 不跳過風控；所有 threshold / sizing / promotion 調整必須先通過 backtest \+ shadow \+ KPI gate。

* 不使用假資料；資料不足時明確標註 dataCoverage \= insufficient / limited。

* 不把 in-sample 成績當作有效；以 walk-forward / out-of-sample 為唯一驗證標準。

* LLM 不得自動修改交易 threshold；threshold 變更為 Requires-Approval 等級。

* Planner / CTO local-only；Worker 為唯一外部 execution path，且必須 audit-guard。

## **Table of Contents**

*（請於 Word 中按 F9 更新此目錄）*

# **1\. Executive Summary**

本計劃針對目前 Stock Prediction System 提出一份 3 – 12 個月、可落地的長期優化路線圖。系統目前已具備完整的 ingest → snapshot → proposal → simulated trade → review → learning → optimization 閉環，並導入 Planner / Worker / CTO 三層 orchestration 與 LLM usage audit / guard。短期 stabilization 已完成，接下來的核心目標是讓系統「能持續、可驗證、可被信任地變好」。

本計劃以四大主軸推進：

1. 程式系統架構優化：以分層為核心，將 ingestion / quality / feature / strategy / risk / simulation / learning / scheduler / observability 解耦，並固定 schema 與 contract。

2. 預測台股成功率優化：以資料擴張、特徵工程、ML baseline、walk-forward 驗證為主軸，提升「可被驗證的預測品質」，而非追求單點高勝率。

3. 自我學習 / 模擬 / 回測優化：強化 simulation realism（slippage、gap、intraday、liquidity）、區分 full / shadow / pending learning、並將 setup / regime / symbol 維度的 KPI 標準化。

4. 排程自我學習：以 Intraday / Daily / Nightly / Weekly / Monthly 五層排程為骨幹，整合架構健康、預測、模擬、學習、優化挖掘與 LLM 預算控制。

本計劃的成功標準不是「股價漲了多少」，而是：(1) 系統健康度可被觀測；(2) 預測品質的提升可被 walk-forward 驗證；(3) 自我學習對 KPI 的影響可被歸因；(4) 排程器在不需要人介入的情況下安全地運作數週並產出可信報告。

# **2\. Current State Assessment**

## **2.1 系統已具備能力**

* 資料層：台股資料同步、DailyMarketSnapshot、DailyCandidateSnapshot、Q1 FinancialReport ingest。

* 決策層：StrategyProposal、triggerScore、SimulatedTrade（pending / shadow / open / closed）。

* 學習層：TradeReviewReport、StrategyLearningInsight、OptimizationInsightRecord。

* 排程層：Autonomous scheduler、Planner / Worker / CTO orchestration、single\_active\_task guard。

* 治理層：LLM usage audit / guard、Copilot-Daemon usage visibility、KPI report / follow-up。

* 近期修正：dataCoverage 從 insufficient 恢復至 limited、trading pipeline 從 rejected-only 恢復為 pending / shadow / open、monitor lifecycle 可更新 pnl / mfe / mae、time-exit neutral learning 已修正、freshness 影響 dataCoverage。

## **2.2 已知差距 (Gap Analysis)**

| 維度 | 現況 | 差距 | 影響 |
| :---- | :---- | :---- | :---- |
| 資料完整度 | Q1 財報只到 limited | TWSE API 欄位有限、缺 ROE/ROA/cash flow | fundamental feature 缺、無法做品質篩 |
| Learning Signal | 近期才恢復 lifecycle | stop / target / time-exit 樣本仍少 | insight 統計噪音大、信心區間寬 |
| 預測品質 | 僅 rule-based triggerScore | 缺 ML baseline、缺 walk-forward 驗證 | 無法量化「系統是否真的變好」 |
| Simulation 真實性 | close-based exit、無 slippage | 缺 intraday / gap / fill-prob 模型 | shadow → full 推升風險被低估 |
| 排程自我學習 | scheduler 已存在 | 缺分層 (intraday/daily/nightly/weekly/monthly) | 高風險與低風險任務混在一起 |
| 可觀測性 | JobRunLog 已有 | 缺 health / pipeline / KPI dashboard | 人類無法快速判斷系統好壞 |
| Copilot 歸因 | 已有 visibility | taskId attribution 仍不夠細 | 預算控制與責任追蹤不精準 |
| 架構耦合 | 單體 service 多 | UI / scripts 仍含 domain logic | 改動風險高、測試覆蓋低 |

## **2.3 風險登記 (Risk Register, 摘要)**

* 資料偏誤風險：Q1 財報缺欄位導致 fundamental feature biased。

* Overfitting 風險：台股單一市場、樣本有限，ML 容易過擬合。

* Simulation-to-Live Gap：close-based simulation 高估勝率。

* Self-Optimization 飄移：threshold 自動調整可能導致策略漂移。

* LLM 預算 / 隱私風險：Copilot 與 Worker 外呼若無 audit 將難追蹤。

* 排程互相干擾風險：long-running job 卡住 single\_active\_task。

# **3\. Target Architecture**

目標架構以「分層 \+ 契約 \+ 可觀測」為原則。每一層只能透過明確 contract 與 schema 與相鄰層溝通，scheduler 是唯一觸發者，UI / script 為消費者，不再內含 domain logic。

## **3.1 分層 (Layered Reference Architecture)**

| Layer | Responsibility | Output Contract |
| :---- | :---- | :---- |
| L1 Data Ingestion | TWSE/TPEx OHLCV、月營收、季報、新聞、籌碼 | raw\_\* tables \+ ingest\_run\_log |
| L2 Data Quality | freshness / completeness / outlier 偵測 | data\_quality\_report \+ dataCoverage flag |
| L3 Feature Engineering | technical / fundamental / event / regime feature | feature\_store (versioned) |
| L4 Strategy & Scoring | rule-based \+ ML score、ensemble、regime-aware | StrategyProposal w/ scoreBreakdown |
| L5 Risk & Sizing | Kelly fraction、liquidity guard、sector cap | sized\_proposal |
| L6 Simulation Engine | fill model、slippage、gap、intraday exit | SimulatedTrade lifecycle events |
| L7 Review & Learning | trade review、insight、calibration | TradeReviewReport \+ LearningInsight |
| L8 Self-Optimization | task miner、threshold proposal、gate | OptimizationInsightRecord \+ tasks |
| L9 Scheduler | intraday / daily / nightly / weekly / monthly | JobRunLog \+ heartbeat |
| L10 LLM Audit / Guard | budget / hard-off / safe-run / attribution | llm\_usage\_audit |
| L11 UI / Observability | dashboards、daily ops、anomaly alert | read-only views |

## **3.2 設計原則**

* Single source of truth：每個 domain 概念只有一個權威 schema。

* Append-only learning：insight / proposal / trade 不被覆寫，只追加版本。

* Idempotent jobs：同 inputHash 重跑不影響狀態。

* Explicit contracts：跨層僅透過 typed DTO；JSON metadata 僅作為 forward-compat 容器。

* Observability first：任何新模組必須同時提供 health metric。

* Default deny for LLM：任何外呼必須宣告 taskId、budget、reason。

# **4\. PART 1 — 程式系統架構優化計畫**

## **4.1 Architecture Layering (per-layer 優化建議)**

### **Data Ingestion Layer**

* 拆分 source-specific adapter：TWSE / TPEx / FUGLE / News / 法人籌碼 各自一個 adapter，共用 IngestRunner 介面。

* 每個 adapter 必須回傳 (rows, source\_meta, retrieved\_at)，並寫入 raw\_\<source\> 表 \+ ingest\_run\_log。

* 資料層只負責「拉 \+ 落地」，不做欄位映射；映射移到 Data Quality Layer。

* 錯誤分類：transient（重試）、schema-drift（停 ingest 並開 task）、permanent（黑名單）。

### **Data Quality Layer**

* freshness check：依資料種類定義 SLA（quote 1 day、財報 90 day、新聞 6h）。

* completeness check：必填欄位、欄位型別、值域、跨表 referential 檢查。

* outlier check：z-score、winsorize、cross-source diff。

* 輸出 data\_quality\_report 並反映到 dataCoverage \= full / limited / insufficient。

* 新增 quality\_event 表：每一次 fail 留痕，做為 self-optimization 任務輸入。

### **Feature Engineering Layer**

* 建立 feature\_store：(symbol, asof\_date, feature\_name, value, version, source)。

* feature 必須 point-in-time correct，禁止 look-ahead。

* 每個 feature 寫一個 builder function \+ unit test \+ golden sample。

* 提供 feature lineage：哪個 feature 來自哪個 raw \+ 哪個 transform 版本。

### **Strategy / Trigger Scoring Layer**

* 目前 triggerScore 為單一加權；改為 score\_components: { momentum, breakout, fundamental, event, regime }。

* 新增 model\_score 欄位：未來接 ML baseline；ensemble \= w1·rule \+ w2·ml。

* 每個 setup（如 \+5 / \-5 / time）必須有獨立 setup\_id，並被 learning 層追蹤。

* 輸出 StrategyProposal 時固定欄位：scoreBreakdown、setup\_id、regime\_tag、dataCoverage。

### **Risk / Position Sizing Layer**

* 獨立成 service：input \= sized request，output \= position 或 reject reason。

* 整合 Kelly fraction、ATR-based stop、流動性上限、產業集中度。

* rejection reason 必須結構化（liquidity / volatility / coverage / sector / kelly\_negative）。

### **SimulationExecutionEngine**

* 從 strategy layer 解耦：input \= sized\_proposal，output \= SimulatedTrade events。

* Fill model 抽象：market / limit / stop，並支援 partial fill。

* Lifecycle 由事件驅動：opened / partially\_filled / monitored / stop\_hit / target\_hit / time\_exit / closed。

* 每個事件留 event\_log，方便事後重建。

### **TradeReviewReport / Learning Layer**

* 每筆 closed trade 必須有 review；review 區分 contributing factor 與 noise。

* review schema 固定：win/loss、attribution、anomaly、coverage\_used、setup\_id。

* Learning 層讀 review，產出 setup-level insight，不直接改 production threshold。

### **OptimizationInsightRecord / Self-Optimization Layer**

* Insight → Proposal → Gate → Apply 四步驟，無 gate 不 apply。

* Gate 包含 backtest pass、shadow pass、KPI delta significance、CTO review（高風險）。

* Apply 後寫入 change\_log，可一鍵 rollback。

### **Scheduler / Job Orchestration Layer**

* 分層 intraday / daily / nightly / weekly / monthly（PART 4 詳述）。

* single\_active\_task 改為 per-lane（不同 lane 可平行；同 lane 互斥）。

* 每個 job 需宣告 idempotency key、timeout、retry policy、lane。

### **LLM Usage Audit / Guard Layer**

* 所有外呼包一層 audited\_call(provider, taskId, budget, reason)。

* hard-off / safe-run 模式：safe-run 只允許 read-only LLM；hard-off 全停。

* Copilot-Daemon 必須申報 taskId 與用途；無 taskId 視為 anomaly。

### **UI / Observability Layer**

* UI 與 script 不可呼叫 domain mutation，只能呼叫 read-only view 或 trigger job。

* 新增 dashboards：health、pipeline、learning、freshness、LLM usage。

* Daily Ops 報告由 nightly 產出，不由 UI on-demand 計算。

## **4.2 Domain Model 強化**

### **StrategyProposal**

* 新增：setup\_id、scoreBreakdown JSON、modelScore、ruleScore、ensembleScore、regimeTag、dataCoverage、coverageReason。

* Normalize：rejection\_reason 從自由字串 → enum 表 (rejection\_reason\_id)。

* 保留 JSON：scoreBreakdown（schema 演化頻繁，先放 JSON）。

### **SimulatedTrade**

* 新增：fill\_model、slippage\_bps、gap\_at\_open\_pct、intraday\_high、intraday\_low、time\_exit\_reason、coverageAtEntry。

* 拆出 SimulatedTradeEvent 表：opened / fill / monitor / exit。

* 保留 JSON：raw\_quote\_snapshot（debug 用）。

### **TradeReviewReport**

* 新增：attribution\[\]（factor、weight）、anomaly\_flags\[\]、setup\_id、regime\_at\_entry、regime\_at\_exit。

* 把 review\_text 拆成 review\_summary \+ review\_findings JSON。

### **StrategyLearningInsight**

* Normalize：setup\_id、metric\_name、metric\_value、sample\_size、confidence\_interval、regime、period。

* 保留 JSON：raw\_observations（採樣明細）。

### **OptimizationInsightRecord**

* 新增：insight\_id、proposal\_id、gate\_status、gate\_evidence JSON、applied\_at、rollback\_of。

* 明確區分 read-only insight 與 actionable proposal。

### **DailyMarketSnapshot / DailyCandidateSnapshot**

* Snapshot 必須包含 regime\_tag、market\_breadth、sector\_strength。

* Candidate snapshot 加 setup\_id、scoreBreakdown，跟 proposal 對齊。

### **FinancialReport**

* 從 TWSE 欄位有限拓展為多 source（TWSE \+ 公開資訊觀測站 \+ 第三方）。

* Schema：period (Q/Y)、revenue、cogs、gross\_profit、op\_income、net\_income、eps、equity、assets、liabilities、operating\_cf、free\_cf（缺值允許）。

* 保留 JSON：raw\_payload（保留每個 source 的原始回傳）。

### **NewsEvent / JobRunLog / LLM usage**

* NewsEvent：新增 event\_type（earnings / revenue / policy / sector）、symbols\[\]、sentiment、source。

* JobRunLog：新增 lane、idempotency\_key、retries、parent\_job\_id、heartbeat\_at。

* LLM usage：標準化 (provider, model, taskId, prompt\_tokens, completion\_tokens, cost\_usd, reason, mode)。

## **4.3 Reliability**

* Stale Job Cleanup：scheduler 每 5 分鐘掃一次，running 但 heartbeat 超過 timeout × 2 → 標 stale。

* Idempotency Policy：同 (job\_name, idempotency\_key, business\_date) 在 24h 內視為重跑。

* single\_active\_task 改良：per-lane 鎖；intraday lane 與 nightly lane 可同時跑。

* Retry / Replan：transient 錯誤 exp-backoff 最多 3 次；schema-drift / permanent 直接開 self-optimization task。

* Heartbeat health check：scheduler 每 60 秒寫一次 heartbeat；超過 5 分鐘無 heartbeat 觸發 alert。

* Quote / financial / event freshness guard：在 proposal 階段檢查；不 fresh 直接降級 dataCoverage。

* Holiday-aware trading calendar guard：以 TWSE 行事曆為準；非交易日不開 full trade。

* Runtime Smoke Test：開機後跑 3 個 read-only smoke test（資料庫 ping、最近一筆 quote、最近一筆 proposal）。

## **4.4 Observability**

* System Health Dashboard：DB latency、scheduler heartbeat、stale job 數、lane backlog。

* Planner / Worker / CTO Usage Dashboard：每日 / 每週使用量、taskId 分佈、平均 token、失敗率。

* Copilot-Daemon Usage Warning：超過 daily cap 的 80% 黃色、95% 紅色、100% 自動 hard-off。

* Trading Pipeline Dashboard：candidate → proposal → sized → simulated → closed 各階段轉化率。

* Learning KPI Dashboard：win rate / target hit / stop hit / time-exit positive，依 setup / regime 切。

* Data Freshness Dashboard：每 source × 每 SLA 的 freshness gauge。

* Daily Ops Report：nightly 自動寄出，含 KPI、freshness、stale jobs、LLM usage、anomalies。

* Anomaly Alert：threshold-based \+ 簡易 z-score；alert 必含 taskId 與 runbook 連結。

# **5\. PART 2 — 預測台灣股票市場成功率優化計畫**

| 目標：提升「可驗證的預測品質」。Predictability ≠ Profitability；本計劃只追求可被 walk-forward / out-of-sample 驗證的預測能力提升。 |
| :---- |

## **5.1 Data Expansion**

| Tier | 資料源 | 用途 | 理由 |
| :---- | :---- | :---- | :---- |
| Must-have | TWSE/TPEx 歷史 OHLCV (10y+) | 技術特徵、回測樣本 | 目前樣本不足，先解決樣本量 |
| Must-have | 月營收公告 | fundamental momentum | 台股月營收為高頻 fundamental signal |
| Must-have | 季報 / 年報 | EPS、利潤率、ROE | 預測中長期 setup 必備 |
| Must-have | 法人買賣超 (3 大法人) | 籌碼面 | 短線 setup 重要 alpha 來源 |
| Should-have | 融資融券 | 散戶情緒、軋空風險 | 對放空策略尤其重要 |
| Should-have | 主力 / 大戶持股 | 中長期籌碼 | 進階 setup |
| Should-have | 產業分類 / ETF 成分 | sector neutralization | 避免假分散 |
| Should-have | 新聞 / 法說會 / 除權息 | 事件特徵 | event-driven setup |
| Should-have | 市場寬度 | regime feature | 辨識 risk-on / risk-off |
| Nice-to-have | 台指期、匯率、利率、美股科技股 | 宏觀 / 跨市場 | 用於 regime model |
| Nice-to-have | Sector rotation 指標 | 策略選擇 | 輔助 setup 選擇 |
| Nice-to-have | 替代資料 (Google Trends 等) | 情緒 | 尚需驗證 alpha |

## **5.2 Feature Engineering**

### **Technical Features**

* Momentum：1d/5d/20d/60d return、relative strength vs 加權指數 / 同產業。

* Trend strength：ADX、MA slope、Donchian breakout strength。

* Volatility：rolling std、ATR、IV proxy（若可得）。

* Volume anomaly：vol z-score、turnover spike、abnormal vol-on-up days。

* Breakout / mean reversion：N-day high break、Bollinger position、distance to MA。

* Drawdown / liquidity：rolling max DD、bid-ask spread proxy、turnover ratio。

### **Fundamental Features**

* EPS、revenue YoY、QoQ growth；net / operating income。

* Gross / operating margin、ROE、ROA、leverage、current ratio。

* Interest coverage、free cash flow（若資料 available）。

* Quality score：以多 fundamental 指標 z-score 合成。

### **Event Features**

* Earnings / revenue release proximity（前後 N 日 dummy）。

* News sentiment（per-symbol、per-sector、aggregate）。

* Sector / policy / global macro event 標記。

### **Regime Features**

* Bull / bear / defensive：以指數 trend \+ breadth 判定。

* High / low volatility：VIX-like proxy（台指選擇權 IV 或 realized vol）。

* Liquidity contraction：總成交額 z-score。

* Risk-on / risk-off：跨資產動能。

* Sector rotation：產業 RS 變化率。

## **5.3 Model / Scoring Strategy**

* Baseline：保留現有 rule-based triggerScore \+ logistic regression（可解釋）。

* 升級：gradient boosting / LightGBM（tabular 表現好、訓練快）。

* 進階：regime-specific model（每個 regime 一個 model）+ meta-model 選 setup。

* ensemble：ensembleScore \= w\_rule × ruleScore \+ w\_ml × mlScore，weight 由 walk-forward 決定。

* 避免 overfitting：strict time-based split、early stopping、feature 上限、permutation importance、SHAP 檢視 leakage。

* 資料量不足對策：以 setup 為單位訓練（不是每檔股票）、bootstrap、半監督、跨產業 pooling。

* Full / Pending / Shadow：分開訓練；shadow 為 hold-out，full 為 deployed model。

* ML 與 triggerScore 結合：先以 ensemble 並行；ML 連續 3 個月 walk-forward 顯著優於 rule 才提權。

## **5.4 Prediction Targets**

| Target | 定義 | 適合階段 | 備註 |
| :---- | :---- | :---- | :---- |
| 1d return | T+1 收盤 / T 收盤 \- 1 | baseline | noise 高，作為 sanity check |
| 5d return | T+5 / T \- 1 | 現階段主力 | 對應目前 setup window |
| 10d return | T+10 / T \- 1 | 中期 | 需更多樣本 |
| Hit target \+4.5% | T+N 是否觸及 \+4.5% | 現階段主力 | 對齊現有 setup |
| Hit stop \-3.8% | T+N 是否觸及 \-3.8% | 風險預測 | 用於 stop optimization |
| Time-exit positive | N 日後是否為正 | neutral 學習 | 已修正 |
| MFE \> threshold | 最大有利移動 | 品質指標 | 搭配 sizing |
| MAE \< threshold | 最大不利移動 | 風險指標 | 搭配 stop |
| Risk-adj exp return | (target\_prob × \+4.5%) \- (stop\_prob × 3.8%) | 未來主指標 | 計算 EV per trade |

現階段建議：以 hit-target / hit-stop / time-exit 三元分類為主，配合 5d return regression 作 calibration。

## **5.5 Validation Framework**

* Time-based split：永遠以 T 之前為 train、T 之後為 test，禁止 random split。

* Walk-forward：每月 retrain；每月評估前一個月 out-of-sample。

* Permutation test：打亂 label，觀察 metric 是否退化至隨機水準。

* Baseline comparison：必須對比 (1) random、(2) 0050 持有、(3) 加權指數、(4) 現有 rule baseline。

* Transaction cost / slippage：每筆 5–15 bps，敏感度分析 25 bps。

* Liquidity filter：日均成交額 \< 門檻直接排除回測。

* Capacity limit：每日每檔不超過該檔 ADV 的 1%。

* Sector neutral validation：去除產業 beta 後仍有 alpha。

* Drawdown control：max DD、Calmar、ulcer index。

* False discovery control：多重比較 Bonferroni / BH 校正。

## **5.6 Success Metrics**

* Win rate、avg / median return、Sharpe、Sortino、max DD。

* MFE/MAE ratio、target hit rate、stop hit rate、time-exit positive rate。

* Precision@TopK（K=5/10/20，每日 ranking 的命中率）。

* Calibration curve、Brier score（probabilistic 預測的可信度）。

* Expected value per trade（含成本後）。

* Coverage by setup type、stability across regimes（regime-conditional Sharpe）。

# **6\. PART 3 — 自我學習 / 模擬股價 / 回測優化計畫**

## **6.1 Simulation Engine Optimization**

* Entry price：以 T+1 開盤 \+ slippage\_bps 為主，可選 T+1 VWAP。

* Exit price：拆 close-based 與 intraday-based 兩種模式並存；shadow 用 intraday-based、full 兩者皆 record。

* Gap risk：T+1 開盤 vs T 收盤 gap 超過 N% 觸發 gap\_event 並標記。

* Intraday high/low simulation：以日內高低價判斷 stop / target 是否觸及。

* Slippage：以 turnover 與 spread proxy 估計，最小 3 bps。

* Transaction cost：手續費 \+ 證交稅，標準化為 fee\_bps。

* Volume-based fill probability：order\_size / ADV 超過 1% 開始降 fill rate。

* Position sizing realism：Kelly fraction × cap × liquidity guard。

* Partial fill：fill\_rate \< 1 時記錄、後續按 fill 後 size 計 PnL。

* Stop logic：close-based vs intraday-based 雙軌記錄；報告同時呈現兩者結果。

* ETF / 個股 不同規則：ETF 有日內漲跌限制 / 折溢價考量，需獨立 fill model。

* Liquidity guard：fail liquidity 直接拒絕進入 simulation，理由結構化記錄。

## **6.2 Backtesting Framework**

* Single-strategy backtest：對單一 setup 做 walk-forward。

* Multi-strategy backtest：多 setup 同時跑、考慮資金分配與 sector cap。

* Regime-specific backtest：每個 regime 分別評估，避免一個 regime 拖累整體。

* Walk-forward backtest：12-month window roll、retrain frequency \= 1 month。

* Paper vs Historical 對比：以最近 N 個月 paper（shadow）成績與 historical backtest 對齊；差距 \> 30% 觸發 drift alert。

* Shadow vs Full 對比：相同 proposal 在 shadow 與 full 的 PnL diff 應在誤差範圍。

* Benchmark：必對比 0050、加權指數、等權重持有；列示 alpha / beta / IR。

## **6.3 Learning Signal Quality**

* \+5 / \-5 / time triggerType：必須在 review 階段填入；time-exit neutral 已修正，繼續監控。

* Stop / target signal：必區分 close-based 與 intraday-based 觸發。

* MFE improvement signal：以 setup 為單位追蹤 MFE 的中位數；上升表示 setup 真的進步。

* Setup success / failure pattern：找出共同 feature；用 SHAP / mutual information。

* Data-quality-contaminated trades：dataCoverage \= insufficient 的 trade 預設排除學習。

* Low coverage trades：dataCoverage \= limited 的 trade 進入 learning 但 weight 降為 0.3。

* Shadow trade：獨立統計 shadow\_kpi；shadow promote → full 必須通過 shadow gate。

* Full / pending / shadow 分開 learning：避免相互污染、避免 leak future signal。

## **6.4 Self-Learning Policy**

| 情境 | 動作 | Gate |
| :---- | :---- | :---- |
| sample\_size 不足 (n \< 30\) | 只產 insight，不調 threshold | — |
| walk-forward KPI 顯著改善 | 提案 threshold 調整 | backtest \+ shadow \+ CTO review |
| 最近 4 週 KPI 退化 \> 10% | 進入 shadow-only mode | auto by scheduler |
| 某 setup 連續 3 個月負 EV | 暫停該 setup | auto, notify |
| dataCoverage 大規模降為 insufficient | gate 不允許 recovery | 等資料修復 |
| threshold 調整 \> 20% | 需要 CTO review | manual approval |
| 新增資料源 | gate 包含 data quality \+ backtest | manual approval |

## **6.5 Simulation KPI**

* Before/After insight KPI：每次 self-optimization 必有 before / after 對比表。

* Strategy-level KPI：每個 strategy 的 win rate、Sharpe、calmar。

* Setup-level KPI：每個 setup\_id 的 EV、target hit、stop hit、time-exit positive。

* Symbol-level KPI：高貢獻 / 高拖累 symbol top-N。

* Regime-level KPI：bull / bear / vol-high / vol-low。

* Shadow-to-Full Promotion KPI：shadow 連續 N 週優於門檻才能 promote。

* False-positive / false-negative KPI：以 hit-target / hit-stop ground truth 計算。

# **7\. PART 4 — 排程自我學習優化計畫**

排程系統是把架構、預測、模擬、學習這四件事「黏起來」的關鍵。本部分整合前面三大主軸，設計分層 scheduler、guardrail、task miner、approval boundary 與 LLM usage control。

## **7.1 Scheduler Layers**

### **Intraday Jobs (high-frequency, short timeout)**

* Quote sync（每 N 分鐘）

* Open trades monitor（每 5 分鐘）

* Lifecycle close（盤中 stop / target 觸發）

* LLM usage guard（每 15 分鐘檢查 budget）

* Health check（heartbeat / DB ping）

### **Daily Jobs (T+0 close 後)**

* Market snapshot（regime tag、breadth）

* Candidate screening（feature\_store \+ setup rule）

* Proposal generation（rule \+ ml ensemble）

* Execution simulation（pending → shadow → simulated）

* TradeReviewReport generation（針對 closed trade）

* KPI report（daily KPI delta）

* Daily Ops report（health \+ KPI \+ anomalies）

### **Nightly Jobs (off-peak)**

* Learning insight build（rolling 30 / 90 / 180 day）

* Optimization miner（task discovery）

* Code health scan（lint / dead-code / coverage）

* Stale job cleanup

* Report consolidation（壓縮成 daily / weekly digest）

### **Weekly Jobs**

* Backtest（walk-forward 增量）

* Model evaluation（calibration、Brier、precision@K）

* Feature importance（SHAP / permutation）

* Regime analysis

* Strategy retirement / promotion review

* Architecture audit（contract drift、schema drift）

### **Monthly Jobs**

* Long-term KPI review（rolling 6m / 12m）

* Data source evaluation（coverage、freshness、cost）

* Financial report refresh（季報、年報）

* Model recalibration（threshold、weight）

* Roadmap review

## **7.2 Guardrails**

* 不得在資料不足時開 full trade。

* 不得因短期樣本（n \< 30）調整 threshold。

* 不得重複產生相同 task（idempotency\_key 必設）。

* 不得外呼 LLM 無紀錄；missing taskId \= anomaly。

* 不得在 hard-off 模式下執行 external LLM。

* 不得假造資料；缺值就以 NaN \+ coverage flag 表示。

* 不得用 in-sample 成績當成功；只有 walk-forward / out-of-sample 才算。

* 不得讓 scheduler 自行修改 production threshold；必須走 gate。

## **7.3 Self-Optimization Task Miner**

| 類別 | 可挖掘任務 | 預設動作 |
| :---- | :---- | :---- |
| Data | data freshness issue、schema drift | auto-create task \+ 降 coverage |
| Pipeline | repeated rejection reason、stuck lifecycle | auto-create task |
| Strategy | high stop rate、low target rate、poor setup | insight \+ gate-based proposal |
| Model | calibration drift、feature importance shift | weekly job \+ retrain proposal |
| Infra | stale job rows、long-running jobs | auto-cleanup \+ alert |
| LLM | Copilot anomaly、missing taskId | audit alert |
| UI | observability gap（找不到的指標） | create dashboard task |
| Code | schema mismatch、duplicate metadata、untested module | create refactor task |
| Architecture | large module decomposition、unused script | human-review task |

## **7.4 Human Approval Boundary**

### **Auto-execute（無需人工）**

* Report generation、dashboard update、test generation。

* Data freshness check、stale job cleanup。

* Read-only audit、anomaly detection。

* Shadow trade 開關（在 shadow lane 內）。

### **Requires Approval（必須人工）**

* Threshold change（任何 setup 的 trigger / sizing / stop / target）。

* Strategy promotion to full（shadow → full）。

* Schema migration（含 add column 之外的所有變更）。

* 新增 external data source（含付費資料）。

* 高風險重構（跨多模組、影響 contract）。

* LLM provider change、外呼模型升級。

* Production trading logic change。

## **7.5 LLM Usage Control**

* Planner local-only：不允許外呼。

* CTO local-only by default：除非明確 task 申請外呼。

* Worker external execution only with audit guard：所有外呼必標 taskId \+ reason \+ budget。

* Copilot warning threshold：\> 80% daily cap → warning；\> 95% → red；100% → hard-off。

* Task-level LLM usage cap：每個 task 預設上限（token / cost）。

* Daily budget cap：全系統每日上限；超出觸發 hard-off。

* Hard-off / safe-run mode：safe-run 只允許 read-only LLM。

* Usage card：每日寄送 LLM usage card（taskId × token × cost）。

* Audit trail：完整保留 prompt hash、response hash、token、cost。

* No-task reason：missing taskId 視為 anomaly，自動寫 incident。

* TaskId attribution：每筆 LLM call 必對應一個 taskId；UI 上可下鑽。

# **8\. PART 5 — 12-Month Roadmap**

## **8.0 CTO-Reordered Roadmap (2026-05-07)**

| Phase | 時程 | 重點 | Current Status / Exit Criteria |
| :---- | :---- | :---- | :---- |
| 1\. Stabilization | 0–1m | Freshness、Lifecycle、LLM Guard、Daily Ops、Stale Cleanup | T-03 / T-04 / T-12b foundation mostly complete；remaining gap = orchestrator-wide SafetyGuard + Ops UI |
| 2\. Measurement | 1–2m | Portfolio walk-forward skeleton、KPI Dashboard、Setup / Regime readiness | P0 = T-05B TypeScript portfolio walk-forward skeleton；先產 readiness，不產 ROI / edge |
| 2.5 Research Reset & Data Foundation | 1.5–3.5m | Data history depth、sector mapping、portfolio-level contracts、hypothesis quality gate | InstitutionalChip / MonthlyRevenue / FinancialReport coverage >= 500 trading days or explicitly flagged insufficient |
| 3\. Prediction Upgrade | 3–5m | Hypothesis-driven features、cross-sectional ranking、portfolio validation、ML only after coverage | 至少 1 個 H013+ portfolio hypothesis 通過 walk-forward + permutation + BH-FDR；不得以 retired rule baseline 當成功 |
| 4\. Simulation Realism | Conditional 5–7m | Slippage、Cost、Intraday、Liquidity Fill | 只有 Phase 3 出現 promotable signal 後啟動；Sim vs Paper 偏差 \< 30% |
| 5\. Self-Learning Maturity | Conditional 7–10m | Threshold Guard、Promotion / Retire、Regime、Shadow→Full | 只有通過 portfolio validation 的 setup 才可進 shadow gate |
| 6\. Institutionalization | 10–13m | Weekly Research、Monthly Review、Data Governance | 排程器無人介入連續 30 天，且 research-loop / ops-loop 均可審計 |

## **8.1 Phase-by-Phase Plan (詳細)**

### **Phase 1 — Stabilization (0–1m)**

* 完善 stale job cleanup \+ heartbeat health check。

* 完善 freshness guard（quote / financial / event）。

* 完善 LLM usage audit \+ hard-off / safe-run 切換。

* 上線 Daily Ops report v1。

* 建立 lane-based scheduler，single\_active\_task 改 per-lane。

### **Phase 2 — Measurement (1–2m)**

* 建立 feature\_store skeleton（先放 technical feature）。

* 建立 KPI dashboard（trading pipeline、learning、freshness、LLM usage）。

* 建立 T-05B portfolio walk-forward skeleton（rule-only、regime-aware、observability-only）。

* Setup-level / regime-level KPI 標準化。

* T-05B 輸出只允許 readiness / turnover / placeholder equity curve / dataQualityFlags；不得輸出 buy、sell、signal、ROI、win-rate、alpha、edge、profit、recommendation、outperform。

### **Phase 2.5 — Research Reset & Data Foundation (1.5–3.5m)**

* Data coverage audit：InstitutionalChip / MonthlyRevenue / FinancialReport / sector mapping / MarketIndex alignment。

* 建立 500 trading day coverage report；不足時標 `dataCoverage = insufficient / limited`，不可補假值。

* 建立 industry code → sector name mapping，支援 sector-neutral portfolio readiness。

* 建立 hypothesis registry / quality score / retirement lifecycle 的 production contract。

* H013+ 僅可在 data foundation 與 portfolio walk-forward skeleton 都通過 guardrail 後啟動。

### **Phase 3 — Prediction Upgrade (3–5m)**

* Fundamental feature 補齊（含 Q1 缺欄位策略：以多 source 補、缺值以 coverage flag 標）。

* ML baseline（logistic \+ LightGBM）+ walk-forward 暫緩到 data foundation 完成後；不得拿 retired H001-H012 rule baseline 當成有效對照。

* Top-K ranking 與 calibration。

* ensembleScore \= w\_rule × ruleScore \+ w\_ml × mlScore 暫緩；改以 hypothesis-driven cross-sectional ranking / portfolio signal aggregation 作為 Phase 3 主線。

* Permutation / leakage check。

### **Phase 4 — Simulation Realism (Conditional 5–7m)**

* Conditional trigger：只有 Phase 3 產生至少 1 個可審計 promotable portfolio signal 後才啟動。

* Slippage / 手續費 / 證交稅 模型。

* Intraday high/low exit 模式（與 close-based 雙軌）。

* Volume-based fill probability \+ partial fill。

* ETF / 個股不同 fill model。

* Sim vs Paper drift detection。

### **Phase 5 — Self-Learning Maturity (Conditional 7–10m)**

* Conditional trigger：沒有通過 portfolio validation 的 signal 時，不啟動 threshold / promotion 自動化。

* Threshold change gate：backtest \+ shadow \+ KPI delta significance \+ CTO review。

* Promotion / Retirement policy 與 cron。

* Regime-specific learning：每 regime 分開 KPI 與 model weight。

* Shadow → Full promotion playbook。

### **Phase 6 — Institutionalization (10–13m)**

* Weekly research automation：feature importance、regime、calibration。

* Monthly model review：retrain、threshold recalibration、roadmap update。

* Data source governance：coverage、cost、ROI 評分卡。

* Long-term strategy evaluation：rolling 6m / 12m KPI、retirement candidates。

# **9\. Risks and Guardrails**

| Risk | 影響 | Guardrail / Mitigation |
| :---- | :---- | :---- |
| Overfitting | ML 在歷史好、未來爛 | walk-forward \+ permutation \+ 限 feature 數 \+ SHAP |
| Data leakage | 驗證偏高 | point-in-time feature\_store \+ golden test |
| Sim-to-Live gap | shadow 看似好、實盤差 | intraday \+ slippage \+ cost；sim/paper drift alert |
| Self-opt drift | 自動調 threshold 漂移 | gate \+ change\_log \+ rollback |
| LLM 預算超支 | 成本失控 | daily cap \+ per-task cap \+ hard-off |
| Stale job 卡死 | scheduler 卡住 | heartbeat \+ per-lane lock \+ cleanup cron |
| Schema drift | ingest 失敗 | schema-version \+ auto-task \+ freeze ingest |
| Regime change | 策略單區域 over-trained | regime-specific KPI \+ retire on neg EV |
| 低樣本誤導 | n\<30 噪音大 | 禁止 threshold 調整、只產 insight |
| UI 含 domain logic | 不可測 / 易壞 | 把 logic 移到 service、UI 只 read |

# **10\. KPI / Success Metrics Framework**

## **10.1 系統健康 KPI**

* Scheduler heartbeat uptime（目標 ≥ 99%）。

* Stale job 比例（目標 ≤ 1%）。

* Data freshness pass rate（每 source 目標 ≥ 95%）。

* Daily Ops 綠燈率（目標 ≥ 90%）。

## **10.2 預測品質 KPI**

* Walk-forward Sharpe / Sortino / Calmar。

* Precision@TopK（K=5/10/20）。

* Calibration error / Brier score。

* Win rate、target hit rate、stop hit rate、time-exit positive rate。

## **10.3 Simulation / Learning KPI**

* Sim-to-Paper 偏差。

* Shadow → Full promotion 成功率。

* Insight → Proposal → Apply 通過率與 KPI delta。

* False-positive / false-negative。

## **10.4 治理 KPI**

* LLM daily cost 與 budget 占比。

* Missing-taskId 比例（目標 0%）。

* Approval-required 任務 SLA。

* Rollback 次數（越低越好）。

# **11\. Implementation Backlog**

以下 backlog 為 Phase 1–3 的初版任務集合，每筆都對應到上述 layer / KPI。

| \# | 任務 | Layer | Phase | Approval |
| :---- | :---- | :---- | :---- | :---- |
| B-01 | lane-based single\_active\_task | Scheduler | 1 | Auto |
| B-02 | stale job cleaner cron \+ heartbeat | Scheduler | 1 | Auto |
| B-03 | freshness guard 統一接口 | Quality | 1 | Auto |
| B-04 | Daily Ops report v1 | Observability | 1 | Auto |
| B-05 | LLM audit hardening \+ hard-off mode | LLM Guard | 1 | Auto |
| B-06 | feature\_store skeleton（technical only） | Feature | 2 | Auto |
| B-07 | KPI dashboard（pipeline / freshness / LLM） | Observability | 2 | Auto |
| B-08 | rule-only walk-forward backtest | Backtest | 2 | Auto |
| B-09 | setup\_id 標準化 \+ StrategyProposal schema 補齊 | Strategy | 2 | Approval |
| B-10 | fundamental feature ingest（多 source 補欄位） | Ingestion | 3 | Approval |
| B-11 | logistic \+ LightGBM baseline 模型 | Strategy | 3 | Auto |
| B-12 | ensembleScore（rule × ml） | Strategy | 3 | Approval |
| B-13 | intraday high/low exit \+ slippage 模型 | Simulation | 4 | Approval |
| B-14 | shadow → full promotion gate \+ playbook | Self-Opt | 5 | Approval |
| B-15 | regime-specific learning | Learning | 5 | Approval |
| B-16 | weekly research automation | Scheduler | 6 | Auto |
| B-17 | monthly model review automation | Scheduler | 6 | Auto |
| B-18 | data source governance scorecard | Governance | 6 | Approval |

## **11.1 Current Reprioritized Backlog (2026-05-07)**

| New Priority | Original ID | Updated Task | Status / Decision | Next Action |
| :---- | :---- | :---- | :---- | :---- |
| P0 | B-08 / T-05 | **T-05B Portfolio Walk-Forward Backtest Skeleton v2** | Rename and redesign required; old Python skeleton is reusable evidence but not final engine | Implement TypeScript `WalkForwardEngine` + artifacts + tests |
| P1 | B-07 / B-04 | Ops Report UI + T-05B readiness section | API exists; UI missing | Build read-only dashboard after T-05B artifact contract |
| P1 | B-05 / T-04 | SafetyGuard orchestrator-wide integration | `daily-sync` covered; other task routes pending | Add guard to mutating / external-AI routes |
| P1 | B-10 | Data foundation audit / backfill plan | Coverage depth still blocks formal validation | Audit InstitutionalChip / MonthlyRevenue / FinancialReport coverage |
| P2 | B-06 | feature\_store skeleton technical-only | Still useful, but after T-05B contract | Build PIT-safe technical feature skeleton |
| P2 | B-09 | setup\_id schema work | Redesign with `hypothesis_id` / portfolio-level contract | Do after T-05B and hypothesis registry contract |
| P2 | NEW | Hypothesis registry / quality score gate | Needed before H013+ | Define quality score, retirement, promotion states |
| Deferred | B-11 | logistic + LightGBM baseline | Defer until data foundation and portfolio validation | Do not start today |
| Deferred | B-12 | ensembleScore | Defer; retired rule baseline is not a valid anchor | Revisit after Phase 3 |
| Conditional | B-13 | intraday + slippage realism | Only useful after promotable signal exists | Keep design notes, do not implement now |
| Conditional | B-14 / B-15 | shadow promotion / regime learning | Requires validated signal and shadow evidence | Keep approval boundary |

# **12\. Suggested Scheduler Design**

以「Lane × Frequency」二維度設計，每個 job 屬於一個 lane（決定互斥），同 lane 同時間只允許一個 job 運行；不同 lane 可平行。所有 job 必有 idempotency\_key、timeout、retry policy、heartbeat。

## **12.1 Lane 規劃**

| Lane | 說明 | 互斥對象 | 範例 Job |
| :---- | :---- | :---- | :---- |
| L-INTRADAY | 盤中高頻 | L-INTRADAY | quote\_sync, monitor\_open |
| L-DAILY | T+0 close 後 | L-DAILY | daily\_snapshot, candidate\_screen, proposal\_gen |
| L-NIGHTLY | off-peak | L-NIGHTLY | learning\_build, optimization\_miner |
| L-WEEKLY | 週末 | L-WEEKLY | backtest, model\_eval, feature\_importance |
| L-MONTHLY | 月底 | L-MONTHLY | long\_term\_kpi, model\_recalibration |
| L-ONDEMAND | 人工觸發 | — | ad-hoc backtest, debug job |

## **12.2 Job Spec（必填欄位）**

* name、lane、frequency（cron）、timeout、retry\_policy、idempotency\_key\_template。

* input\_contract、output\_contract（JSON Schema）。

* approval\_level（auto / approval）。

* llm\_budget（token / cost）、llm\_mode（local / external）。

* owner、runbook\_url。

* alert\_channel、SLA。

## **12.3 Scheduler 安全機制**

* Heartbeat：每 60s 寫；超 5 分鐘無 heartbeat 標 stale。

* Idempotency：同 (name, idempotency\_key, business\_date) 24h 內視為重跑。

* Cascading guard：上游 fail 自動延遲下游（避免在壞資料上跑學習）。

* Holiday-aware：非交易日跳過 trading-related job。

* Budget guard：LLM 用量達 cap 直接 hard-off external lane。

* Approval queue：approval-required job 自動進入 queue 等待 CTO review。

# **13\. Recommended Next 5 Tasks**

2026-05-07 CTO reorder 後，下一批任務如下。T-03 / T-04 / T-12b foundation 已完成或局部完成，因此不再把它們列為從零開始的任務。

| \# | 任務 | 目的 | 驗收 |
| :---- | :---- | :---- | :---- |
| T-05B | **Portfolio Walk-Forward Backtest Skeleton v2** | 建立 regime-aware / rule-only / portfolio-level Measurement foundation | TypeScript engine、tests PASS、contract artifacts、guardrail validation PASS、no buy/sell/signal/ROI/win-rate/edge |
| T-03b | Ops Report UI Dashboard | 讓 operator 透過 UI 5 分鐘內判斷 health / freshness / walk-forward readiness | read-only UI，可呈現 `/api/report/ops` 與 T-05B summary |
| T-04b | SafetyGuard orchestrator-wide integration | 將 safety guard 從 daily-sync 擴到所有 mutating / external-AI task routes | missing taskId blocks risky tasks；safe-run / hard-off 一致生效 |
| T-02b | Unified freshness/dataCoverage expansion | 把 MarketRegime freshness 模式擴到 data foundation source | quote / regime / financial / chip / revenue 均有 coverage flag |
| P4-05A | Data Foundation Coverage Audit | 判斷 500-day walk-forward 與後續 H013+ 是否可行 | InstitutionalChip / MonthlyRevenue / FinancialReport coverage report + backfill plan |

# **14\. First 10 Concrete Tasks (含驗收)**

| \# | 任務 | 預估工時 | 驗收 / DOD |
| :---- | :---- | :---- | :---- |
| 1 | T-05B Portfolio Walk-Forward Backtest Skeleton v2 | 1–2d | TypeScript engine、artifact contract、guardrail validation、targeted tests PASS |
| 2 | Ops Report UI Dashboard | 2–4d | read-only dashboard 顯示 ops status / freshness / T-05B readiness |
| 3 | SafetyGuard orchestrator-wide integration | 2–3d | all mutating / external-AI routes require SafetyDecision + taskId |
| 4 | Unified freshness/dataCoverage expansion | 3–5d | quote / regime / financial / chip / revenue 均有 coverage flag |
| 5 | Data Foundation Coverage Audit | 1–2d | 500-day coverage matrix + backfill scope + insufficiency flags |
| 6 | Data backfill scripts for highest-value source | 3–7d | priority source coverage improved or explicitly blocked with evidence |
| 7 | feature\_store skeleton（technical-only） | 5d | point-in-time tests + golden samples |
| 8 | KPI dashboard v1 | 5d | pipeline / freshness / LLM / walk-forward readiness 四個區塊 |
| 9 | Hypothesis Registry / quality score contract | 3–5d | hypothesis states、quality gate、retirement decision schema |
| 10 | Sim-to-Paper drift detector | Conditional | 只有 promotable signal 出現後啟動 |

# **15\. Final Recommendation**

綜合以上四大主軸，建議您接下來以兩條主線並行推進：

5. Stability & Visibility（短期 4–6 週）：完成剩餘 orchestrator-wide SafetyGuard、Ops UI、freshness/dataCoverage 擴展，把「系統有沒有變差」變成可觀測的事實，而不是憑感覺。

6. Measurement & Research Foundation（同步啟動 Phase 2 / 2.5）：先完成 T-05B portfolio walk-forward skeleton 與 data foundation audit，再進 feature\_store / H013+ / ML baseline。讓「系統是否具備可驗證研究能力」先被量化，再談「是否變聰明」。

這兩條主線交會點已從原本 Phase 4 的 Simulation Realism，前移到 **T-05B + Data Foundation**。只有當 portfolio-level measurement foundation 可審計，且資料深度足夠，simulation realism 與 self-learning 才有真正可信賴的訊號。

2026-05-07 CTO final call：今天立即執行 **T-05B Portfolio Walk-Forward Backtest Skeleton v2**。不要啟動 H013+，不要重啟 H001-H012，不要做 ROI / win-rate / edge 結論。

| 最後再次提醒：本計劃不保證獲利，所有策略調整都必須通過 backtest \+ shadow \+ KPI gate；資料不足時直接標 insufficient，不靠 LLM 自動修改交易參數。系統先變得「誠實」，才有資格變得「聰明」。 |
| :---- |
