# CTO Agent — 系統下一階段優化方向分析

**Date**: 2026-05-06
**Owner**: Kelvin Huang
**Inputs**: `stock_roadmapPlan_20260504.md` (12-month roadmap), `20260505.md` (P3-14 交接報告)

---

## 0. TL;DR — 最重要的一件事

**P3-14 的研究結論已經把原 roadmap 的核心假設打掉了一半。**

原 roadmap (5/4) 的 Phase 2-5 全部建立在一個隱性假設上：「現有 rule-based triggerScore 是一個有意義的 baseline，後續用 ML / simulation realism / self-learning 把它優化得更好。」

但昨天 (5/5) 的 P3-14 結論：**H001-H012 在所有 configuration 下都找不到 edge**，且這個結論已通過 walk-forward + permutation + BH-FDR 驗證。

這表示：
- 「rule baseline = 0」是經科學驗證的事實，不是工程問題
- Phase 3 的 exit criteria（「ML baseline walk-forward 顯著優於 rule」）失去意義 — rule baseline 本來就是 0
- Phase 4 (Simulation Realism) / Phase 5 (Self-Learning Maturity) 的前提（有 signal 可以 simulate / promote）目前不存在

**核心建議**：在原 Phase 2 ↔ Phase 3 之間插入 **Phase 2.5 — Research Reset & Data Foundation**，並把 Phase 4 / 5 改為 conditional triggers。

---

## 1. Roadmap 對齊度檢查

### 1.1 Roadmap 仍然成立的部分（保留）

- **Phase 1 Stabilization 全部仍然有效**：lane-based scheduler / freshness guard / Daily Ops / LLM guard / stale cleaner 都是 infrastructure，不依賴有 edge 的 strategy
- **Layered architecture (L1-L11) 設計仍然正確**：解耦、contract、observability 是正確工程方向
- **Reliability / Observability / LLM Audit / Guard 章節全部仍然對的**
- **PART 4 排程設計（lane × frequency）仍適用**
- **PART 5 風險守則（不假資料、不 in-sample、不 LLM 動 threshold）正是 P3-14 結論能成立的根本原因** — 這些 guardrail 是讓「沒有 edge」這個結論可信的功臣

### 1.2 Roadmap 已經被打破的部分（需重做）

| 項目 | 原 phase | 現況 | 處理方式 |
|---|---|---|---|
| Phase 3 exit criteria「ML 顯著優於 rule」 | 2-4m | rule = 0，比較沒意義 | 重定義為「H013+ portfolio hypothesis 通過 walk-forward + permutation + BH-FDR」 |
| B-11 logistic + LightGBM baseline | 3 | rule retire 後失去對照組 | 取代為 hypothesis-driven feature → model（不再做 ML vs rule 對比）|
| B-12 ensembleScore = w_rule × ruleScore + w_ml × mlScore | 3 | rule 端已 retire | 暫緩；改為 portfolio-level signal aggregation |
| B-13 intraday + slippage 模型 | 4 | 沒 signal 可 fill | 下移；slippage / cost 數字保留，intraday fill model 延後 |
| B-14 shadow → full promotion gate | 5 | 沒 candidate 可 promote | 下移；保留概念設計但不執行 |

### 1.3 原 roadmap 漏掉、實際上很關鍵的部分

P3-14 之後浮現出來的、原 roadmap 沒涵蓋的東西：

1. **Hypothesis Registry / Quality Score / Retirement Decision lifecycle**：原 roadmap 是 trading-loop centric (setup → trade → review)，P3-14 多了一條 research-loop (hypothesis → validate → archive/retire)
2. **Cross-Sectional Ranking + Portfolio-Level Backtester**：P4-02 / P4-04 的核心，但原 roadmap 只談 single-symbol KPI（setup/regime/symbol level），portfolio 維度只在 6.1 提了一句 Kelly fraction
3. **Data history depth backfill**：原 roadmap B-10 只談 multi-source 補欄位，沒談 history depth。但實際上 InstitutionalChip 1y / MonthlyRevenue 2m 是現在最大的 blocker

---

## 2. 關鍵阻塞 (Critical Blockers)

按嚴重程度排序：

### Blocker #1 — 資料歷史深度不足 ⚠️ CRITICAL

| Source | 現況 | P4 需求 | Gap | 是否有 backfill script |
|---|---|---|---|---|
| InstitutionalChip | ~1 year | 5y+ for 500d window | 4y+ | 待 P4-01 確認 |
| MonthlyRevenue | ~2 months | 5y+ | 5y | 待 P4-01 確認 |
| FinancialReport | unknown | 5y+ Q | 待 audit | 待 P4-01 確認 |
| Short selling / margin / dividend | MISSING | 5y+ | 全部 | 通常不存在 |

**影響**：沒有這些資料，P4-02 / P4-04 / P4-05 全部 underpowered。
**這是整條 P4 研究線的 P0 阻塞。**

### Blocker #2 — Industry / Sector Mapping 不完整 ⚠️ HIGH

`Stock.industry` 只有 numeric code，缺：
- industry code → sector name
- sector index mapping (對應 MarketIndex 的 sector indices)
- ETF / 個股 bucket
- 上市 / 上櫃分類

**影響**：sector-neutral basket、cross-sectional relative strength、sector regime classifier 全部做不出來。
**工作量小（mapping 表 + join），但 ROI 極高。P0。**

### Blocker #3 — Portfolio-Level Backtester 缺位 ⚠️ HIGH

P3 全是 single-symbol，但 P4 hypothesis 必須是 basket-level (cross-sectional ranking → top-N basket → portfolio-level validation)。

**影響**：P4-04 / P4-06 都不能跑。
**工作量大（2-3 週），是 P4 通過 / 失敗的關鍵基礎設施。P1。**

### Blocker #4 — Hypothesis Registry production schema 缺位 ⚠️ MEDIUM

P3-14 已有 retirement decision 概念，但 H013+ 需要 production schema (HypothesisRegistry table、Quality Score、Promotion gate fields)。

**P4-05 之前必做，工作量中等。**

### Blocker #5 — Phase 1 Stabilization 進度狀態未知 ⚠️ MEDIUM

5/4 roadmap 列了 T-01 ~ T-05 五個 stabilization task，但 5/5 報告完全沒提這些（可能是 research-only 交接，所以沒寫；也可能是實際上沒做）。

**必須在今天 audit 一下這五件事的當前狀態。**

---

## 3. 重新排序的 P0 / P1 / P2

我把工作分成三條 swimlane：**Research / Infra / Trading**，分別重排。

### 3.1 P0 — 本週必做 (Today + Next 5 days)

| # | Lane | 任務 | 為什麼 P0 | 預估 |
|---|---|---|---|---|
| P0-1 | Research | 執行 P4-01 Stock Data Source Expansion Audit (prompt 已備) | 不知道資料邊界，後面所有 P4 都不能設計 | 1d |
| P0-2 | Research | Industry code → sector name mapping 表 | 是 P4-02 / P4-03 / P4-04 的共同前提 | 0.5-1d |
| P0-3 | Infra | Audit Phase 1 Stabilization (T-01~T-05) 當前狀態 | roadmap 對齊最基本問題 | 0.5d |
| P0-4 | Trading | MarketIndex coverage / 與 StockQuote 對齊 audit | P4-03 Market Regime 前提，且最便宜 | 0.5d |

### 3.2 P1 — 下週做 (Next 5-10 days)

| # | Lane | 任務 | 觸發條件 |
|---|---|---|---|
| P1-1 | Research | InstitutionalChip backfill (5y+) | P0-1 完成且 backfill script 不存在 |
| P1-2 | Research | MonthlyRevenue + FinancialReport backfill | P0-1 完成 |
| P1-3 | Infra | Lane-based scheduler / Heartbeat 補齊 | P0-3 audit 顯示未完成 |
| P1-4 | Infra | Daily Ops Report v1（含 P4 research progress 區塊） | P0-3 audit 顯示未完成 |
| P1-5 | Research | P4-03 Market Regime Classifier (TAIEX-based, MarketIndex 已現成) | P0-4 通過 |
| P1-6 | Research | Portfolio-Level Backtester skeleton (P4-04) | 與 P1-5 並行 |

### 3.3 P2 — Week 3+ (兩週後)

| # | Lane | 任務 | 觸發條件 |
|---|---|---|---|
| P2-1 | Research | P4-02 Cross-Sectional Ranking | sector mapping 完成 |
| P2-2 | Research | P4-05 Next-Gen Hypothesis Registry + Quality Score schema | P4-01~04 完成 |
| P2-3 | Research | P4-06 P4 Batch Validation (H013+) | P4-05 完成 |
| P2-4 | Infra | KPI Dashboard v1（pipeline / freshness / LLM / **research progress**） | Phase 1 Stabilization 完成 |
| P2-5 | Infra | Walk-forward backtest skeleton 改為 **portfolio walk-forward** (取代原 rule-only 版本) | P1-6 完成 |

### 3.4 已 De-prioritize / Defer 的任務

| 原 roadmap 項 | 原 phase | 處理 | 理由 |
|---|---|---|---|
| B-11 logistic + LightGBM baseline | 3 | 重定義（不做 ML vs rule） | rule baseline = 0 |
| B-12 ensembleScore | 3 | 暫緩 | rule 端已 retire |
| B-13 intraday + slippage | 4 | 下移；保留 cost / slippage 數字 | 沒 signal 不需 sim realism |
| B-14 shadow → full gate | 5 | 下移；保留概念設計 | 沒 candidate 可 promote |
| 5.3 ML model strategy | 3 | 重定義為 hypothesis quality score ≥ 70 才能 validation | rule baseline 失效 |

---

## 4. Roadmap 調整建議

### 4.1 在 Phase 2 與 Phase 3 之間插入 Phase 2.5

**Phase 2.5 — Research Reset & Data Foundation**

Exit Criteria:
- P4-01 ~ P4-04 完成
- InstitutionalChip / MonthlyRevenue / FinancialReport ≥ 5y 歷史
- Industry mapping 完成
- Market Regime classifier 上線
- Portfolio-Level Backtester skeleton 可跑
- 至少 3 個 H013+ hypothesis 通過 quality score ≥ 70（但尚未 validation）

### 4.2 Phase 3 重定義

| 維度 | 原版 | 新版 |
|---|---|---|
| 主目標 | rule-based + ML baseline + ensemble | hypothesis-driven feature + cross-sectional ranking + portfolio signal aggregation |
| Exit criteria | ML walk-forward 顯著優於 rule | 至少 1 個 H013+ portfolio hypothesis 在 walk-forward + permutation + BH-FDR 都通過，且 IR ≥ X |
| Feature 哲學 | technical 為主，ML model 解釋 | hypothesis 必須先有 economic rationale + stronger prior，model 為輔 |

### 4.3 Phase 4 / 5 變成 conditional

只有當 Phase 3 產出 **至少 1 個 promotable signal** 時，Phase 4 / 5 才啟動。否則工時轉到 Phase 2.5 加碼。

### 4.4 不變的部分

- Phase 1 Stabilization：該完成就完成
- Phase 6 Institutionalization：方向更重要 — 因為現在多了一條 research-loop，governance scorecard 必須涵蓋 hypothesis registry

### 4.5 調整後的 6-month view

| Phase | 原 timing | 新 timing | 變化 |
|---|---|---|---|
| Phase 1 Stabilization | 0-1m | 0-1m | 不變 |
| Phase 2 Measurement | 1-2m | 1-2m | KPI dashboard 增加 research progress 區塊 |
| **Phase 2.5 Research Reset & Data Foundation** | — | **1.5-3.5m** | **新增** |
| Phase 3 Prediction Upgrade | 2-4m | 3-5m | 順延 + 內容換 |
| Phase 4 Simulation Realism | 4-6m | 5-7m | 條件觸發 |
| Phase 5 Self-Learning Maturity | 6-9m | 7-10m | 順延 |
| Phase 6 Institutionalization | 9-12m | 10-13m | 順延 |

---

## 5. 今日 / 本週 / 下兩週建議行動

### 今天 (2026-05-06)

1. **執行 P4-01 prompt**（已準備好在 `outputs/stock_research_program/p4_01_next_task_prompt.md`）→ 產出 data source audit / backfill requirements / industry mapping
2. **同時 audit Phase 1 Stabilization** 五件事（T-01~T-05）的當前狀態 — 不能因為 research line 重啟就忘了 infra

### 本週末前

3. Industry code → sector name mapping 表完成
4. MarketIndex coverage 與 StockQuote 對齊驗證
5. 根據 P4-01 結果評估 P1-1 ~ P1-2 的 backfill scope（多深、多少 symbol、是否要 paid source）

### 下兩週

6. 開始 InstitutionalChip backfill（最大資料阻塞）— 若需要新資料源請走 approval boundary
7. P4-03 Market Regime Classifier skeleton（不需 backfill，可立即啟動）
8. Portfolio-Level Backtester skeleton — 與 P4-03 並行

---

## 6. 風險與守則 (Hard Rules)

1. **不要因為 P3-14 找不到 edge 就放棄 walk-forward / permutation / BH-FDR**：這些方法本身正是讓我們知道「rule-based 沒 edge」的工具，沒有它們我們會錯誤地以為現有 strategy 有用
2. **不要因為趕進度就跳過 hypothesis quality score**：H013+ 必須先過 70 分才能進 validation；否則會重複 P3 的 data snooping
3. **不要把 Phase 4 simulation realism 提前**：在沒 signal 的情況下做 sim realism 是 over-engineering
4. **不要在 backfill 完成前設計 institutional-flow hypothesis**：1y InstitutionalChip 撐不起 500d window，BH-FDR underpowered
5. **Daily Ops Report 從 Phase 1 上線開始就要含 research progress**：P4-01~06 的進度應該是 Daily Ops 一個固定區塊，而不是另一個獨立 dashboard
6. **沿用原 roadmap 的 disclaimer**：threshold 變更必須走 gate；LLM 不得自動修改 trading parameter；資料不足直接標 insufficient

---

## 7. 一句話總結

> 原 roadmap 寫的「先讓系統誠實，才有資格變得聰明」這句話本身沒錯，但 P3-14 又往前推了一步：**先讓研究方法可以真的找到 edge，simulation 才有 signal 可以 simulate**。Phase 2.5 就是這個「找 edge 的能力」的階段。

---

## Appendix A — Backlog 重排總覽

| Original ID | Task | Original Phase | New Priority | New Phase |
|---|---|---|---|---|
| B-01 | lane-based single_active_task | 1 | P1 | 1 |
| B-02 | stale job cleaner cron + heartbeat | 1 | P1 | 1 |
| B-03 | freshness guard 統一接口 | 1 | P1 | 1 |
| B-04 | Daily Ops report v1 | 1 | P1 | 1 (+ research progress 區塊) |
| B-05 | LLM audit hardening + hard-off mode | 1 | P1 | 1 |
| B-06 | feature_store skeleton (technical) | 2 | P2 | 2 |
| B-07 | KPI dashboard | 2 | P2 | 2 (含 research progress) |
| B-08 | rule-only walk-forward backtest | 2 | **DEPRECATE**（rule 已 retire） | — |
| B-09 | setup_id 標準化 + StrategyProposal schema | 2 | **REDESIGN**（改為 hypothesis_id） | 2.5 |
| B-10 | fundamental feature ingest | 3 | **EXPAND**（含 history backfill） | 2.5 |
| B-11 | logistic + LightGBM baseline | 3 | **REDEFINE**（不做 ML vs rule） | 3 |
| B-12 | ensembleScore | 3 | **DEFER** | 4+ |
| B-13 | intraday + slippage | 4 | **PARTIAL**（cost 保留，intraday 延後） | 5 |
| B-14 | shadow → full gate | 5 | **DEFER** | 5+ |
| B-15 | regime-specific learning | 5 | **PROMOTE**（P4-03 拆出） | 2.5 |
| B-16 | weekly research automation | 6 | unchanged | 6 |
| B-17 | monthly model review | 6 | unchanged | 6 |
| B-18 | data source governance scorecard | 6 | **PROMOTE**（含 hypothesis registry） | 5 |
| **NEW** | Industry → sector mapping | — | P0 | 2.5 |
| **NEW** | InstitutionalChip backfill | — | P1 | 2.5 |
| **NEW** | Portfolio-Level Backtester | — | P1 | 2.5 |
| **NEW** | Hypothesis Registry schema (production) | — | P2 | 2.5 |
| **NEW** | H013+ design with quality score gate | — | P2 | 3 |

---

*本分析不構成投資建議。所有 strategy / threshold 調整仍須通過原 roadmap 的 backtest + shadow + KPI gate。*
