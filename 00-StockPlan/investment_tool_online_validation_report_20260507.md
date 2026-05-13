# 股票投資輔助工具上線驗證分析報告

Date: 2026-05-07  
Scope: 以現有 Stock Prediction System 功能，規劃最快進入上線驗證的投資研究工具路線。  
Positioning: 本系統應定位為「股票研究與策略驗證輔助工具」，不是保證獲利或保證精準預測的交易指令系統。

---

## 1. 結論摘要

現有系統已具備進入 MVP 上線驗證的基礎，但驗證目標必須收斂：

1. 可以先上線驗證「投資研究工作流」：候選股篩選、個股詳情、技術指標、籌碼觀察、新聞事件、基本面摘要、回測與 watchlist。
2. 不應直接宣稱「精準預測」或「可自動交易」：目前資料深度與回測治理仍不足以支撐正式績效宣稱。
3. 最快路線是先做 shadow validation：每日產出研究候選與分數，記錄 as-of 當下的資料、理由與信心度，未來再用實際後驗報酬驗證。
4. P0 上線前必須加上 as-of date gate：目前 DB 有 `2026-05-18` 的 `StockQuote` 與 `MarketIndex` rows，但今天是 `2026-05-07`，正式驗證不可讓未來日期進入分析。
5. 法說/基本面與大戶投信可以先做解釋輔助，不應作為核心預測權重：月營收、財報、籌碼歷史仍不足以支撐完整 walk-forward 策略優化。

---

## 2. 現有功能盤點

| 需求 | 現有能力 | 主要模組/資料表 | 上線驗證判斷 |
|---|---|---|---|
| 歷史股價 | 已有 1,358 檔股票、129,151 筆 StockQuote；185 檔有 >=500 筆交易日 | `StockQuote`, `/api/stocks/[id]/detail`, `/api/stocks/[id]/history`, `CandidateDataAdapter` | 可作 MVP 核心資料源，但需排除未來日期與異常日期 |
| 技術指標 | MA、RSI、MACD、KD、BB、ATR、量能、技術訊號 | `TechnicalSignalCalculator`, `technicalIndicators.ts`, `RuleBasedStockAnalyzer` | 可直接上線驗證 |
| 大戶/投信追蹤 | 三大法人買賣超、外資、投信、自營商、holders400/1000 | `InstitutionalChip`, `MajorPlayerService`, `/api/institutional`, `/api/stocks/[id]/institutional` | 可做近一年輔助觀察，不足以做 500d 正式策略優化 |
| 新聞/事件 | `NewsEvent` 有 1,018 筆，多來源 RSS/新聞來源；事件與主題引擎已存在 | `NewsEvent`, `EventIngestionService`, `NewsService`, `NewsSentimentService` | 可做研究脈絡，但個股關聯與 PredictionEngine 查詢需修正 |
| 法說/基本面 | 有月營收、財報、StockMetrics、peer comparison / overlay | `MonthlyRevenue`, `FinancialReport`, `StockMetrics`, fundamentals modules | 目前是 limited：缺法說會 transcript/slide schema，月營收僅 2 個月、財報僅 2025-Q4 |
| 綜合評分 | 已有 technical/chip/fundamental/market regime fusion | `SignalFusionEngine`, `StrategyScreenEngine`, `/api/strategy/screen` | 可作研究候選排序 baseline |
| 個股研究頁 | 已整合 header、regime、fusion、signals、fundamentals、backtest、watchlist context | `/api/stocks/[id]/detail`, `/stocks/[symbol]` | 可作 MVP 主入口 |
| 回測/驗證 | 有成本模型回測、簡化個股回測、walk-forward observability skeleton | `StrategyBacktestEngine`, `/api/backtest/validate`, `/api/stocks/backtest`, T-05B~T-05F outputs | 可做研究驗證；正式績效宣稱需等 PIT/資料深度補齊 |
| 系統觀測 | Data quality、Ops report、freshness、regime context | `/api/admin/data-quality`, `/api/report/ops`, `OpsReportEngine` | 可作上線前 readiness gate |

---

## 3. 目前資料狀態

Local DB snapshot:

| 表 | 筆數/覆蓋 | 日期範圍 | 判斷 |
|---|---:|---|---|
| `Stock` | 1,358 檔 | static | 可用 |
| `StockQuote` | 129,151 rows | 1970-12-04 到 2026-05-18 | 可用，但有 1970 異常與 2026-05-18 未來日期風險 |
| `MarketIndex` | 2,666 rows | 2017-12-01 到 2026-05-18 | 可用，但同樣有未來日期風險 |
| `InstitutionalChip` | 291,068 rows, 1,358 檔, 236 trading days | 2025-05-02 到 2026-05-05 | 可做近一年籌碼觀察，正式 500d 策略不足 |
| `MonthlyRevenue` | 2,143 rows, 881 檔 | 2026-02 到 2026-03 | 不足以做 YoY 趨勢與正式驗證 |
| `FinancialReport` | 957 rows | 2025-Q4 only | 不足以做 8 季趨勢 |
| `NewsEvent` | 1,018 rows | 2025-12-29 到 2026-05-05 | 可用於事件摘要與主題追蹤 |
| `Prediction` | 0 rows | none | 尚未形成可審計 prediction log |
| `StrategySignal` | 0 rows | none | 尚未形成可審計策略訊號 log |

Coverage:

| 條件 | 檔數 |
|---|---:|
| quote >= 20 天 | 250 |
| quote >= 60 天 | 248 |
| quote >= 100 天 | 248 |
| quote >= 250 天 | 244 |
| quote >= 500 天 | 185 |
| quote >= 250 天且有籌碼 | 244 |
| quote >= 100 天且有籌碼 | 248 |

上線驗證建議先限制 universe：

1. MVP 主 universe：Tier A，`quote >= 250` 且有 `InstitutionalChip`，目前約 244 檔。
2. Walk-forward universe：`quote >= 500`，目前約 185 檔。
3. 若要納入基本面策略，需等月營收 >=13 個月、財報 >=8 季後再升權重。

---

## 4. 目標功能如何用現有系統達成

### 4.1 投資人研究主流程

建議第一版上線流程：

1. 系統健康檢查  
   使用 `/api/report/ops` 與 `/api/admin/data-quality` 確認資料新鮮度、coverage、MarketRegimeResult 狀態。

2. 候選股產生  
   使用 `/api/strategy/screen` 呼叫 `StrategyScreenEngine`，以 `SignalFusionEngine` 產生 `alphaScore`、`confidence`、`recommendationBucket`、`topFactors`、`keyRisks`。

3. 個股研究  
   使用 `/api/stocks/[id]/detail` 取得：
   - 歷史價格與基本資訊
   - market regime
   - fusion score
   - 技術訊號與價位估計
   - fundamentals snapshot
   - peer comparison
   - watchlist context
   - backtest quick summary

4. 風險與資料限制揭露  
   顯示 `dataCoverage`、`missingSources`、`limitations`、coverage tier，讓投資人知道分數是完整、有限或不足。

5. Watchlist 追蹤  
   使用既有 watchlist、price alert、daily report、notification delivery log，讓使用者追蹤而不是直接下單。

### 4.2 策略分析與優化

第一版不建議直接上 ML。應先做三層驗證：

| 層級 | 目標 | 現有功能 | 輸出 |
|---|---|---|---|
| Baseline ranking | 驗證 alphaScore 是否能協助排序 | `SignalFusionEngine`, `StrategyScreenEngine` | 每日候選與理由 |
| Shadow prediction log | 記錄 as-of 預測，不影響交易 | `Prediction` table 或 `ExperimentRun`/`SignalEffectivenessResult` | 可後驗檢查的 prediction log |
| Walk-forward observability | 驗證資料與流程是否 PIT-safe | T-05B 到 T-05F | coverage、regime context、candidate availability |

等 shadow log 累積後，再驗證：

1. Top bucket 後 5/20 交易日報酬是否優於 watch/neutral。
2. alphaScore 與 forward return 是否有排序關係。
3. confidence 是否校準。
4. market regime 下的結果是否穩定。
5. 技術/籌碼/基本面/新聞各因子是否有可重複貢獻。

### 4.3 歷史數據優化策略

可用現有系統做「參數優化」，但要用保守規則：

1. 固定 as-of：每次只看當時已可取得資料。
2. 拆 train/test：不可用同一段資料調參又宣稱績效。
3. walk-forward：用月度 rebalance schedule 驗證排序與候選變化。
4. 成本與流動性：正式回測用 `StrategyBacktestEngine`，包含交易成本、滑價、部位限制。
5. 不使用未成熟資料源升權：新聞、法說、營收、財報在 coverage 不足前先只做輔助解釋。

---

## 5. 上線驗證 MVP 範圍

建議上線驗證不要追求「完整投資 AI」，而是切成可測量 MVP：

### MVP 必備

1. Data readiness gate  
   - currentDate = 2026-05-07 或系統日期
   - 所有資料查詢強制 `date <= asOfDate`
   - 排除 `date > asOfDate` 的未來資料
   - 排除 `1970-12-04` 等異常日期

2. Candidate dashboard  
   - Strong / Watch / Neutral 分桶
   - 顯示 alphaScore、confidence、dataCoverage、topFactors、keyRisks
   - 僅對 Tier A / 185-244 檔成熟 universe 做主要排序

3. Stock detail page  
   - 歷史股價
   - 技術指標
   - 籌碼摘要
   - 基本面摘要
   - 新聞事件
   - backtest quick summary
   - limitations/disclaimer

4. Watchlist tracking  
   - 加入/移除 watchlist
   - 成本與數量
   - 價格提醒
   - 每日變動摘要

5. Shadow validation log  
   - 每日保存候選分數與理由
   - 保存 as-of date、資料版本、資料缺口
   - 5/20 trading days 後自動回填 outcome

### MVP 不包含

1. 不自動下單。
2. 不宣稱勝率、alpha、edge。
3. 不允許 LLM 自動改 threshold。
4. 不把法說/新聞情緒作為高權重交易因子。
5. 不對資料不足個股輸出強烈結論。

---

## 6. P0 / P1 / P2 執行計畫

### P0: 進入上線驗證前必做

1. As-of data gate  
   所有 screen、detail、backtest、prediction 查詢都要支援並預設 `asOfDate <= today`。目前 DB 有 `2026-05-18` 未來 rows，必須隔離或在查詢層硬性排除。

2. Prediction log contract  
   啟用 `Prediction` 或新增研究用 prediction artifact，記錄 daily alphaScore / bucket / confidence / factors / asOfDate / target horizon。現在 `Prediction` 為 0 rows，無法後驗。

3. 修正新聞個股關聯  
   `NewsEvent` schema 使用 `relatedSymbols` JSON，但 `PredictionEngine` 仍嘗試用 `stockId` 查詢。需統一成 `relatedSymbols` 查詢或建立 normalized join table。

4. MVP universe lock  
   第一版只使用 quote >=250 且有 chip 的 Tier A universe；正式 walk-forward 用 quote >=500 universe。

5. Ops readiness dashboard  
   把 `/api/report/ops`、`/api/admin/data-quality` 的結果放到上線前檢查流程。若 freshness 或 future-date guard fail，當日不產出正式研究分數。

### P1: 上線驗證期間補強

1. 法說會資料層  
   新增 `EarningsCallEvent` 或 `CorporateBriefingEvent`，存日期、公司、來源、簡報 URL、transcript/summary、as-of availability。

2. 基本面 backfill  
   月營收補到至少 13 個月，財報補到至少 8 季，StockMetrics 補成時間序列。

3. 籌碼 backfill  
   `InstitutionalChip` 從 236 trading days 補到 500+ trading days，並明確 T+1 availability。

4. Backtest engine 統一  
   `/api/stocks/backtest` 目前是簡化版且 disclaimer 說不含成本滑價；正式驗證應改用 `StrategyBacktestEngine` 的成本模型。

5. News/Event scoring 降噪  
   新聞先做 trust level、來源權重、事件分類，不直接讓單篇新聞大幅改變交易分數。

### P2: 有足夠驗證資料後再做

1. Feature store versioning。
2. ML baseline / ensembleScore。
3. Regime-aware strategy optimization。
4. Calibration dashboard。
5. Portfolio-level risk/sizing simulation。

---

## 7. 驗證 KPI

### 資料 KPI

| KPI | 目標 |
|---|---|
| StockQuote freshness | <= 1 trading day |
| InstitutionalChip freshness | <= 1 trading day after release |
| MarketRegime freshness | <= 3 days |
| Future-date rows used | 0 |
| Tier A universe size | >= 200 |
| Missing source disclosure | 100% displayed |

### 預測/策略 KPI

第一階段只做 shadow KPI，不做投資宣稱：

| KPI | 用途 |
|---|---|
| Top bucket 5d / 20d forward return | 檢查排序是否有研究價值 |
| Hit rate vs baseline | 僅作後驗，不作上線宣稱 |
| Brier-like calibration | 檢查 confidence 是否可信 |
| Information coefficient | 檢查 score 排序與後驗報酬相關性 |
| Max drawdown / volatility | 風險觀察 |
| Turnover | 檢查候選池是否過度跳動 |

### 產品 KPI

| KPI | 用途 |
|---|---|
| 使用者從候選到個股研究的完成率 | 檢查研究流程是否順 |
| watchlist add rate | 檢查候選是否有參考價值 |
| 使用者標註/回饋率 | 蒐集投資人判斷資料 |
| data limitation 被查看率 | 確認風險揭露是否可見 |

---

## 8. 建議的最快上線驗證路線

最短可行路線如下：

1. 第 1 天：完成 as-of guard、future-date quarantine、MVP universe lock。
2. 第 2 天：建立 daily shadow prediction log，串 `/api/strategy/screen` 與 `/api/stocks/[id]/detail`。
3. 第 3 天：把 `/api/report/ops` 與 data-quality 接成上線前 readiness gate。
4. 第 4-5 天：前端只開研究模式：候選股、個股分析、watchlist、提醒、限制揭露。
5. 第 6 天起：每日 shadow run，收集 5/20 trading-day 後驗結果。
6. 第 3-4 週：有足夠樣本後再評估是否擴大策略、增加權重或引入 ML baseline。

---

## 9. 最終建議

現有系統已經足夠支撐「股票投資研究輔助工具」的上線驗證，但必須把承諾講清楚：

1. 對使用者承諾：更快整理資訊、更一致地篩選候選、更透明地呈現理由與風險。
2. 對內部驗證承諾：用 PIT-safe shadow log 驗證分數與後驗結果的關係。
3. 暫不承諾：精準預測、穩定獲利、自動交易。

若目標是最快進入線上驗證，建議先以上述 MVP 推進；真正的「策略優化與預測模型」應在資料回填、PIT guard、prediction log、walk-forward outcome 都穩定後再升級。
