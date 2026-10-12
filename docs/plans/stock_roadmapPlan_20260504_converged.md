# Stock Prediction System — Long-Term Optimization Master Plan

**Converged Version**  
Base: v1.0 (2026-05-04)  
Convergence Date: 2026-05-04  
Convergence Author: Roadmap Convergence / TPM / AI Orchestrator Governance  
Classification: **ROADMAP_PARTIAL_NEEDS_WORKER_CAPABILITY_CHECK**

> **Disclaimer / Hard Rules：** 本計劃為系統優化技術藍圖，不構成投資建議，亦不保證任何獲利。所有策略調整必須先通過 backtest + shadow + KPI gate；LLM 不得自動修改交易 threshold；Planner / CTO 僅使用 local 模式；Worker 為唯一外部 execution path 且必須 audit-guard。

---

## Convergence Summary

本文件為 `stock_roadmapPlan_20260504.md`（v1.0）的收斂版本，反映以下已完成項目，並重新排定 Phase 1 Stabilization 剩餘任務。

### 已完成（截至 2026-05-04）

| 項目 | 分類 | 狀態 |
|------|------|------|
| Runtime Defaults（schedulerEnabled=false, planner/CTO local, worker=copilot-daemon） | Governance | ✅ COMPLETED |
| B-101 Worker Model Propagation | Worker Governance | ✅ COMPLETED — PROVIDER_MANAGED_MODEL_ONLY |
| B-102 Copilot TaskId Attribution | Worker Governance | ✅ COMPLETED — COPILOT_ATTRIBUTION_FIXED |
| llm_usage / llm_audit 基礎建設 | LLM Guard | ✅ COMPLETED |
| Usage dashboard（desiredModel / actualModel / noTaskReason badge） | Observability | ✅ COMPLETED（基礎版） |

### 待完成（Phase 1 聚焦）

B-103 → T-N2 → T-N3 → T-N4 → T-N5（詳見 Section 8 / 13）

---

## Table of Contents

1. Executive Summary
2. Current State Assessment（收斂後）
3. Target Architecture
4. PART 1 — 程式系統架構優化計畫
5. PART 2 — 預測台灣股票市場成功率優化計畫
6. PART 3 — 自我學習 / 模擬 / 回測優化計畫
7. PART 4 — 排程自我學習優化計畫
8. PART 5 — 12-Month Roadmap（收斂後）
9. Risks and Guardrails
10. KPI / Success Metrics Framework
11. Implementation Backlog（收斂後）
12. Suggested Scheduler Design
13. Recommended Next 5 Tasks（新版）
14. First 10 Concrete Tasks（收斂後）
15. Final Recommendation

---

# 1. Executive Summary

本計劃針對目前 Stock Prediction System 提出一份 3–12 個月、可落地的長期優化路線圖。

**截至 2026-05-04 的收斂狀態：**

- **B-101 Worker Model Propagation 已完成（PROVIDER_MANAGED_MODEL_ONLY）**：`desiredModel=gpt-5-mini`、`actualModel=provider-managed`、`modelPropagationStatus=provider-managed`。因 Copilot CLI 不支援明確 `--model` flag，model 由 provider 管理。全鏈（providers.ts / external wrapper / llm_usage / llm_audit / API / UI）均已更新。14/14 tests pass。

- **B-102 Copilot TaskId Attribution 已完成（COPILOT_ATTRIBUTION_FIXED）**：新增 `noTaskReason` 欄位（`no_queued_task | scheduler_disabled | policy_blocked | null`），使 idle cycle 與真實 anomaly 可被明確區分。Warning Rule E 不再對 idle 記錄誤報；Rule F 分為 F1（WARNING，真實執行缺 taskId）與 F2（INFO，說明不足）。API / UI / audit 全部更新。14/14 tests pass。

- **下一步（B-103）**：將 B-101 的 PROVIDER_MANAGED_MODEL_ONLY 結論固化為 runtime `provider_capabilities.json`，為後續 provider governance 自動化打底。完成後 roadmap 升為 `ROADMAP_CONVERGED_READY_FOR_PHASE1_EXECUTION`。

核心目標不變：(1) 系統健康度可被觀測；(2) 預測品質的提升可被 walk-forward 驗證；(3) 自我學習對 KPI 的影響可被歸因；(4) 排程器在不需要人介入的情況下安全地運作數週並產出可信報告。

---

# 2. Current State Assessment（收斂後）

## 2.1 系統已具備能力

- 資料層：台股資料同步、DailyMarketSnapshot、DailyCandidateSnapshot、Q1 FinancialReport ingest。
- 決策層：StrategyProposal、triggerScore、SimulatedTrade（pending / shadow / open / closed）。
- 學習層：TradeReviewReport、StrategyLearningInsight、OptimizationInsightRecord。
- 排程層：Autonomous scheduler、Planner / Worker / CTO orchestration、single_active_task guard。
- 治理層：LLM usage audit / guard、Copilot-Daemon usage visibility、KPI report / follow-up。
- **B-101（NEW）**：Worker model propagation 全鏈完成；PROVIDER_MANAGED_MODEL_ONLY 已分類。
- **B-102（NEW）**：Copilot taskId attribution 修正完成；`noTaskReason` 全鏈追蹤；warning engine 精確化。

## 2.2 已知差距（Gap Analysis，收斂後）

| 維度 | 現況 | 差距 | 影響 |
|------|------|------|------|
| Provider capability registry | 未建立（B-101 衍生） | 缺 runtime `provider_capabilities.json` | provider governance 無機器可讀依據 |
| Lane-based scheduler | single_active_task（單一鎖） | 未改 per-lane | intraday / nightly 互卡 |
| Stale job cleanup | 無 | 未實作 | 殭屍 job 可卡死 scheduler |
| 統一 freshness guard | 散落各處 | 無統一接口 | 過期資料可能進入 proposal |
| Daily Ops Report | 無 | 未實作 | 系統好壞無法 5 分鐘內判斷 |
| 資料完整度 | Q1 財報只到 limited | TWSE API 欄位有限、缺 ROE/ROA | fundamental feature 缺 |
| Learning Signal | 近期才恢復 lifecycle | 樣本仍少 | insight 統計噪音大 |
| 預測品質 | 僅 rule-based triggerScore | 缺 ML baseline、walk-forward | 無法量化預測品質 |
| Simulation 真實性 | close-based exit、無 slippage | 缺 intraday / gap / fill-prob | shadow → full 風險被低估 |
| 可觀測性 | 基礎 usage dashboard | 缺 health / pipeline / KPI dashboard | 人類無法快速判斷系統好壞 |
| ~~Copilot 歸因~~ | ~~taskId attribution 不夠細~~ | **B-102 已完成** | — |
| ~~Worker model propagation~~ | ~~缺 model field~~ | **B-101 已完成** | — |

## 2.3 風險登記（摘要，同 v1.0）

- 資料偏誤風險：Q1 財報缺欄位導致 fundamental feature biased。
- Overfitting 風險：台股單一市場、樣本有限。
- Simulation-to-Live Gap：close-based simulation 高估勝率。
- Self-Optimization 飄移：threshold 自動調整可能漂移。
- LLM 預算 / 隱私風險：Copilot 與 Worker 外呼若無 audit 將難追蹤。
- 排程互相干擾風險：long-running job 卡住 single_active_task。

---

# 3. Target Architecture

（同 v1.0，以「分層 + 契約 + 可觀測」為原則）

## 3.1 分層（Layered Reference Architecture）

| Layer | Responsibility | Output Contract |
|-------|----------------|-----------------|
| L1 Data Ingestion | TWSE/TPEx OHLCV、月營收、季報、新聞、籌碼 | raw_* tables + ingest_run_log |
| L2 Data Quality | freshness / completeness / outlier 偵測 | data_quality_report + dataCoverage flag |
| L3 Feature Engineering | technical / fundamental / event / regime feature | feature_store (versioned) |
| L4 Strategy & Scoring | rule-based + ML score、ensemble、regime-aware | StrategyProposal w/ scoreBreakdown |
| L5 Risk & Sizing | Kelly fraction、liquidity guard、sector cap | sized_proposal |
| L6 Simulation Engine | fill model、slippage、gap、intraday exit | SimulatedTrade lifecycle events |
| L7 Review & Learning | trade review、insight、calibration | TradeReviewReport + LearningInsight |
| L8 Self-Optimization | task miner、threshold proposal、gate | OptimizationInsightRecord + tasks |
| L9 Scheduler | intraday / daily / nightly / weekly / monthly | JobRunLog + heartbeat |
| L10 LLM Audit / Guard | budget / hard-off / safe-run / attribution | llm_usage_audit |
| L11 UI / Observability | dashboards、daily ops、anomaly alert | read-only views |

## 3.2 設計原則

- Single source of truth：每個 domain 概念只有一個權威 schema。
- Append-only learning：insight / proposal / trade 不被覆寫，只追加版本。
- Idempotent jobs：同 inputHash 重跑不影響狀態。
- Explicit contracts：跨層僅透過 typed DTO。
- Observability first：任何新模組必須同時提供 health metric。
- Default deny for LLM：任何外呼必須宣告 taskId、budget、reason。

---

# 4–7. PART 1–4（架構 / 預測 / 模擬 / 排程）

> 內容同 v1.0，不重複列出。以下僅標注與 v1.0 的差異點。

### v1.0 vs 收斂版差異摘要

| v1.0 節 | 收斂後狀態 |
|---------|-----------|
| 4.1 LLM Audit/Guard Layer | B-102 已完成 taskId attribution；`noTaskReason` 全鏈實作 |
| 4.1 Worker model field | B-101 已完成；`desiredModel / actualModel / modelPropagationStatus` 全鏈 |
| 7.5 LLM Usage Control — No-task reason | B-102 已完成；`noTaskReason` 機制已落地 |
| 7.5 LLM Usage Control — TaskId attribution | B-102 已完成 |

---

# 8. PART 5 — 12-Month Roadmap（收斂後）

| Phase | 時程 | 重點 | Exit Criteria | 收斂後狀態 |
|-------|------|------|---------------|-----------|
| **0. Worker Governance** | 已完成 | B-101 Model Propagation、B-102 TaskId Attribution | ~~pending~~ | ✅ COMPLETED |
| **1. Stabilization** | 0–1m | B-103 + Freshness + Lifecycle + LLM Guard + Daily Ops + Stale Cleanup | Daily Ops 連續 14 天綠燈 | 🔄 IN PROGRESS（見 Section 13） |
| 2. Measurement | 1–2m | KPI Dashboard、Backtest Baseline、Setup Metrics | 可看到每 setup 的 EV / Sharpe | ⏳ PENDING |
| 3. Prediction Upgrade | 2–4m | Feature Eng、ML Baseline、Walk-forward、Top-K | ML baseline walk-forward 顯著優於 rule | ⏳ PENDING |
| 4. Simulation Realism | 4–6m | Slippage、Cost、Intraday、Liquidity Fill | Sim vs Paper 偏差 < 30% | ⏳ PENDING |
| 5. Self-Learning Maturity | 6–9m | Threshold Guard、Promotion / Retire、Regime、Shadow→Full | 至少 1 個 setup 由 shadow 安全提升至 full | ⏳ PENDING |
| 6. Institutionalization | 9–12m | Weekly Research、Monthly Review、Data Governance | 排程器無人介入連續 30 天 | ⏳ PENDING |

## 8.1 Phase 1 Stabilization（收斂後，僅列剩餘任務）

> **已從 Phase 1 移除的項目（已完成）：**
> - ~~完善 LLM usage audit + taskId attribution~~（B-102 ✅）
> - ~~Worker model propagation + desiredModel / actualModel~~（B-101 ✅）

**Phase 1 剩餘任務（依依賴排序）：**

1. **B-103** Provider Capability Registry（B-101 的最終收尾）
2. **B-01** Lane-based scheduler + heartbeat（Phase 1 基礎建設）
3. **B-02** Stale job cleanup + lease expiry（依賴 B-01 heartbeat）
4. **B-03** Unified freshness guard / DataCoverageService（proposal 品質門）
5. **B-05a** LLM safe-run UI toggle（後端 logic 已有，UI 切換缺失）
6. **B-04** Daily Ops Report v1（依賴 B-01 + B-02 + B-03）

**Phase 1 Exit Criteria：**
- Daily Ops Report 連續 14 天顯示「綠燈」
- 兩個不同 lane 的 job 可同時運行
- stale job 比例 ≤ 1%
- non-fresh source 自動觸發 dataCoverage 降級
- missing-taskId 比例 = 0%（B-102 已保證，持續監控）

---

# 9. Risks and Guardrails（同 v1.0）

（詳見 v1.0 Section 9）

---

# 10. KPI / Success Metrics Framework（同 v1.0）

（詳見 v1.0 Section 10）

---

# 11. Implementation Backlog（收斂後）

| # | 任務 | Layer | Phase | Approval | 收斂後狀態 |
|---|------|-------|-------|----------|-----------|
| B-101 | Worker Model Propagation | LLM Guard | — | Auto | ✅ COMPLETED |
| B-102 | Copilot TaskId Attribution | LLM Guard | — | Auto | ✅ COMPLETED |
| **B-103** | **Provider Capability Registry** | **LLM Guard** | **1** | **Auto** | **🔄 NEXT** |
| B-01 | lane-based single_active_task | Scheduler | 1 | Auto | ⏳ |
| B-02 | stale job cleaner cron + heartbeat | Scheduler | 1 | Auto | ⏳ |
| B-03 | freshness guard 統一接口 | Quality | 1 | Auto | ⏳ |
| B-04 | Daily Ops report v1 | Observability | 1 | Auto | ⏳ |
| B-05 | LLM audit hardening + hard-off mode | LLM Guard | 1 | Auto | 🔄 PARTIAL（後端done，UI toggle缺） |
| B-05a | LLM safe-run UI toggle | Observability | 1 | Auto | ⏳ |
| B-06 | feature_store skeleton（technical only） | Feature | 2 | Auto | ⏳ |
| B-07 | KPI dashboard（pipeline / freshness / LLM） | Observability | 2 | Auto | ⏳ |
| B-08 | rule-only walk-forward backtest | Backtest | 2 | Auto | ⏳ |
| B-09 | setup_id 標準化 + StrategyProposal schema 補齊 | Strategy | 2 | Approval | ⏳ |
| B-10 | fundamental feature ingest（多 source 補欄位） | Ingestion | 3 | Approval | ⏳ |
| B-11 | logistic + LightGBM baseline 模型 | Strategy | 3 | Auto | ⏳ |
| B-12 | ensembleScore（rule × ml） | Strategy | 3 | Approval | ⏳ |
| B-13 | intraday high/low exit + slippage 模型 | Simulation | 4 | Approval | ⏳ |
| B-14 | shadow → full promotion gate + playbook | Self-Opt | 5 | Approval | ⏳ |
| B-15 | regime-specific learning | Learning | 5 | Approval | ⏳ |
| B-16 | weekly research automation | Scheduler | 6 | Auto | ⏳ |
| B-17 | monthly model review automation | Scheduler | 6 | Auto | ⏳ |
| B-18 | data source governance scorecard | Governance | 6 | Approval | ⏳ |

---

# 12. Suggested Scheduler Design（同 v1.0）

（詳見 v1.0 Section 12）

---

# 13. Recommended Next 5 Tasks（新版，收斂後）

> **已從 Next 5 移除：** B-101（✅）、B-102（✅）

---

## T-N1 — B-103 Copilot-Daemon Capability Check / Provider Capability Registry

**目的：** 將 B-101 的 PROVIDER_MANAGED_MODEL_ONLY 結論固化為 runtime 機器可讀格式（`provider_capabilities.json`），為後續 provider governance 自動化打底。

**為什麼現在做：** B-101 已完成，B-103 是其直接收尾；工作量約 0.5d，不阻塞其他任務。完成後 roadmap 分類升為 `ROADMAP_CONVERGED_READY_FOR_PHASE1_EXECUTION`。

**需要改的模組：**
- 新建 `scripts/check_provider_capability.sh`（dry-run copilot CLI help，不呼叫真實 API）
- 新建 `src/lib/agent-orchestrator/providerCapabilities.ts`（讀/寫 capability JSON）
- 初始化 `runtime/agent_orchestrator/provider_capabilities.json`
- `providers.ts`：讀取 capability 決定是否傳 model flag

**驗收標準：**
- `provider_capabilities.json` 存在，包含 `supportsModelParam: false`、`classification: "PROVIDER_MANAGED_MODEL_ONLY"`
- `providers.ts` 在 `supportsModelParam = false` 時行為不變（不傳 model flag）
- dry-run 腳本輸出格式化 capability 報告
- 有對應 unit test

**風險：** 極低。  
**需要人工審核：** 否。

---

## T-N2 — Lane-based Scheduler + Heartbeat（B-01）

**目的：** 將 `single_active_task` 改為 per-lane 鎖（L-INTRADAY / L-DAILY / L-NIGHTLY / L-WEEKLY / L-MONTHLY），讓不同頻率 job 不互相卡死。同時加入 heartbeat（每 60s 寫一次）。

**為什麼現在做：** Phase 1 基礎建設；其他 Phase 1 任務（stale cleanup、freshness guard、daily ops）都依賴它。

**需要改的模組：**
- `src/lib/agent-orchestrator/workerTick.ts`：lane claim 邏輯
- `prisma/schema.prisma`：`JobRunLog` 加 `lane` / `heartbeat_at` 欄位（additive）
- `orchestrator/` 排程入口：依 lane 分配 cron
- `src/app/api/orchestrator/`：lane status API

**驗收標準：**
- 兩個不同 lane 的 job 可同時運行
- 同 lane 下第二個 job 自動排隊（不 fail）
- heartbeat 每 60s 更新；超過 5 分鐘無 heartbeat → stale 標記
- unit test 含 lane 互斥案例

**風險：** 中。  
**需要人工審核：** 否（additive schema change）。

---

## T-N3 — Stale Job Cleanup + Lease Expiry（B-02）

**目的：** 每 5 分鐘掃描 `JobRunLog`，將 `running` 但 heartbeat 超過 `timeout × 2` 的記錄標為 `stale`，釋放 lane lock，並觸發 alert。

**為什麼現在做：** 依賴 T-N2 的 heartbeat；一旦 heartbeat 存在，此 cleanup cron 是直接後續。

**需要改的模組：**
- `src/lib/agent-orchestrator/staleJobCleaner.ts`（新建）
- `orchestrator/` intraday cron（每 5 分鐘）
- `src/app/api/orchestrator/health/route.ts`：回傳 stale job count

**驗收標準：**
- stale job 比例 ≤ 1%
- stale 記錄有 `stale_reason` 與 `stale_at` 欄位
- cleaner 本身 idempotent
- 有 alert 觸發

**風險：** 低。  
**需要人工審核：** 否。

---

## T-N4 — Unified Freshness Guard / DataCoverageService（B-03）

**目的：** 統一所有 ingest source 的 freshness SLA 檢查，在 proposal 階段自動降級 `dataCoverage`。

**為什麼現在做：** 保證「不用過期資料下 full trade」是 Phase 1 Exit Criteria 的前置條件。

**需要改的模組：**
- `src/lib/data-quality/DataCoverageService.ts`（新建或整合）
- `src/lib/strategy/proposalBuilder.ts`：呼叫 freshness guard
- `prisma/schema.prisma`：`data_quality_report` 表（若不存在）
- API：freshness status endpoint

**驗收標準：**
- 所有 ingest source 走同一個 freshness guard
- non-fresh source 自動觸發 `dataCoverage` 降級
- 降級事件有記錄
- 不 fresh 時無 full trade 可被觸發

**風險：** 中。  
**需要人工審核：** 否。

---

## T-N5 — Daily Ops Report v1（B-04）

**目的：** Nightly job 自動產出每日系統狀態報告（KPI delta、freshness 燈號、stale job 數、LLM usage、異常列表）。

**為什麼現在做：** 依賴 T-N2 + T-N3 + T-N4；三者完成後 Daily Ops 可直接聚合輸出。這是 Phase 1 Exit Criteria 的可觀測基礎。

**需要改的模組：**
- `src/lib/reports/DailyOpsReport.ts`（新建）
- `orchestrator/` nightly cron
- `src/app/api/reports/daily-ops/route.ts`（新建）
- `src/components/orchestrator/DailyOpsCard.tsx`（新建）

**驗收標準：**
- 報告包含 7 個健康指標 + 3 個 KPI 區塊
- 報告可從 UI 閱讀（或儲存為 JSON/Markdown）
- 連續 14 天報告顯示「綠燈」
- report 本身 idempotent

**風險：** 低。  
**需要人工審核：** 否。

---

# 14. First 10 Concrete Tasks（收斂後）

| # | 任務 | 預估工時 | 驗收 / DOD | 狀態 |
|---|------|---------|-----------|------|
| 0a | B-101 Worker Model Propagation | — | 14/14 tests pass | ✅ DONE |
| 0b | B-102 Copilot TaskId Attribution | — | 14/14 tests pass | ✅ DONE |
| **1** | **B-103 Provider Capability Registry** | **0.5d** | **provider_capabilities.json + dry-run 腳本** | **🔄 NEXT** |
| 2 | Lane-based scheduler | 3d | 2 lane 並行；unit test 含互斥案例 | ⏳ |
| 3 | Heartbeat + stale cleaner | 2d | stale 比例 ≤ 1%；有 alert | ⏳ |
| 4 | Freshness guard 統一 | 3d | 所有 ingest 走同一 guard；coverage 自動降級 | ⏳ |
| 5 | Daily Ops Report v1 | 3d | 包含 7 個健康指標 + 3 個 KPI 區塊 | ⏳ |
| 6 | LLM safe-run UI toggle | 1d | UI 可切換 safe-run / hard-off；後端已有 | ⏳ |
| 7 | feature_store skeleton（technical） | 5d | 至少 20 個 feature；point-in-time test | ⏳ |
| 8 | KPI dashboard v1 | 5d | pipeline / freshness / LLM 三個區塊 | ⏳ |
| 9 | Walk-forward backtest skeleton | 5d | 每 setup 月度 walk-forward 結果可下載 | ⏳ |
| 10 | setup_id 標準化 + StrategyProposal schema 補齊 | 4d | scoreBreakdown / setup_id / regimeTag 上線 | ⏳ |

---

# 15. Final Recommendation

**兩條主線並行：**

**主線 A — Stability & Visibility（Phase 1，當前焦點）：**  
B-103 → Lane-based Scheduler → Stale Cleanup → Freshness Guard → Daily Ops Report  
目標：把「系統有沒有變差」變成可觀測的事實（Daily Ops 連續 14 天綠燈）。

**主線 B — Predictability（Phase 2 / 3，同步啟動）：**  
feature_store → walk-forward backtest → ML baseline  
目標：讓「系統有沒有變好」能用 walk-forward + Top-K + Calibration 量化。

交會點是 Phase 4 的 Simulation Realism — 那時 sim、paper、live 三者開始對齊，self-learning 才有真正可信賴的訊號。

---

**Roadmap Classification：**

```
ROADMAP_PARTIAL_NEEDS_WORKER_CAPABILITY_CHECK
```

B-101 / B-102 已完成。B-103 完成後升為：

```
ROADMAP_CONVERGED_READY_FOR_PHASE1_EXECUTION
```

B-103 + T-N2 + T-N3 + T-N4 + T-N5 全部完成後升為：

```
PHASE1_STABILIZATION_COMPLETE
```

---

> 最後再次提醒：本計劃不保證獲利，所有策略調整都必須通過 backtest + shadow + KPI gate；資料不足時直接標 insufficient，不靠 LLM 自動修改交易參數。系統先變得「誠實」，才有資格變得「聰明」。
