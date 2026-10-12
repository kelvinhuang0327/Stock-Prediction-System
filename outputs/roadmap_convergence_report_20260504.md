# Roadmap Convergence Report

**Stock Prediction System — Long-Term Optimization Master Plan**  
Date: 2026-05-04  
Author: Roadmap Convergence / TPM / AI Orchestrator Governance  
Status: **ROADMAP_PARTIAL_NEEDS_WORKER_CAPABILITY_CHECK**

---

## 1. 已完成項目

### Runtime Defaults（已穩定）

| 設定 | 值 |
|------|----|
| schedulerEnabled | false |
| plannerProvider | local-planner |
| CTO | local-review |
| workerProvider | copilot-daemon |
| workerCopilotModel | gpt-5-mini |
| external LLM execution_success | 0 |

### B-101 — Worker Model Propagation（PROVIDER_MANAGED_MODEL_ONLY）

- `desiredModel = gpt-5-mini`，`actualModel = provider-managed`，`modelPropagationStatus = provider-managed`
- `providers.ts` 支援 `{model}` token 插值
- external worker wrapper（`scripts/orchestrator_worker_external.sh`）接收 model arg
- `llm_usage.jsonl` / `llm_audit.jsonl` / API route / UI 均顯示 desiredModel / actualModel / propagation status
- 14/14 tests pass（`modelPropagation.test.ts`）
- 因 Copilot CLI 不支援明確 `--model` flag，最終分類：**PROVIDER_MANAGED_MODEL_ONLY**

### B-102 — Copilot TaskId Attribution（COPILOT_ATTRIBUTION_FIXED）

- 新增 `noTaskReason` 欄位（`NoTaskReason` type：`no_queued_task | scheduler_disabled | policy_blocked | null`）
- `workerTick.ts` 三個 call site 均呼叫 `logProviderPreflight`（Cases A / B / C/D）
- `llmAuditGuard.ts`：所有 audit record types 加入 `no_task_reason`
- Warning Rule E（COPILOT_PREFLIGHT_LOOP）：跳過有 `noTaskReason` 的記錄
- Warning Rule F（COPILOT_MISSING_TASK_ID）：拆為 F1（WARNING，anomalous execution）/ F2（INFO，unexplained）
- API routes（`/api/system/llm-usage` / `/api/orchestrator/llm-usage/recent`）透傳 `noTaskReason`
- UI（`LlmUsageDetailCard.tsx`）：新增「No-task Reason」欄，三種語意 badge
- 14/14 tests pass（`taskAttribution.test.ts`）
- 最終分類：**COPILOT_ATTRIBUTION_FIXED**

---

## 2. 尚未完成項目

| 項目 | 原始 Roadmap 對應 | 優先等級 |
|------|------------------|---------|
| B-103 Provider Capability Registry | 未列入 v1.0（B-101 衍生） | Phase 1 / 立即 |
| Lane-based Scheduler + Heartbeat | B-01 / T-01 | Phase 1 |
| Stale Job Cleanup + Lease Expiry | B-02 / T-02 | Phase 1 |
| Unified Freshness Guard / DataCoverageService | B-03 / T-02 | Phase 1 |
| Daily Ops Report v1 | B-04 / T-03 | Phase 1 |
| LLM hard-off / safe-run 模式切換 UI | B-05 / T-04（部分完成） | Phase 1 |
| Walk-forward Backtest Skeleton | B-08 / T-05 | Phase 2 |
| feature_store skeleton | B-06 | Phase 2 |
| KPI Dashboard | B-07 | Phase 2 |
| setup_id 標準化 + StrategyProposal schema | B-09 | Phase 2 |

> 注意：T-04（LLM hard-off）的 **attribution** 部分已由 B-102 完成；剩餘工作是 **safe-run 模式的 UI 切換開關**（後端 logic 已在 `execution_policy.py`，UI 尚無切換入口）。

---

## 3. Roadmap Gap Reconciliation

| Roadmap 項目 | 原始狀態 | 目前實際狀態 | 是否仍需做 | 調整建議 |
|---|---|---|---|---|
| LLM hard-off / safe-run | Gap（已有 policy，缺完整切換） | 後端已有 `schedulerEnabled=false`；`execution_policy.py` 支援 SCHEDULER_DISABLED；safe-run 切換 UI 缺失 | 是（UI 切換 + 指標） | 拆出 B-05a（safe-run UI toggle）；後端 logic 標為 done |
| Worker provider governance | Gap（缺 model propagation） | B-101 已完成 model propagation；UI/API/audit 全通 | **已完成** | 從「缺口」改為「✅ 已完成」 |
| Worker model propagation | Gap | B-101 PROVIDER_MANAGED_MODEL_ONLY | **已完成** | 標記 completed |
| Copilot taskId attribution | Gap（taskId 不夠細） | B-102 COPILOT_ATTRIBUTION_FIXED | **已完成** | 標記 completed |
| Missing taskId alert | Gap（missing taskId = anomaly 但無分類） | B-102 完成；F1 WARNING = 真實 anomaly；F2 INFO = 說明不足 | **已完成** | 標記 completed |
| Usage dashboard | 部分（visibility 已有） | LlmUsageDetailCard 已有 desiredModel / actualModel / noTaskReason badge | 大部分完成；缺每日 cap 使用率 gauge | 留在 Daily Ops / KPI dashboard 作補充 |
| Lane-based scheduler | Gap（single_active_task 未改 per-lane） | 未開始 | 是 | B-01 / T-01，Phase 1 最高優先 |
| Heartbeat | Gap | 未開始（JobRunLog 有 lane 欄位規劃，未實作） | 是 | 與 Lane scheduler 合併執行 |
| Stale job cleanup | Gap | 未開始 | 是 | B-02 / 與 Heartbeat 合包 |
| Unified freshness guard | Gap | 散落各處，無統一接口 | 是 | B-03 / T-02 |
| Daily Ops Report | Gap | 未開始 | 是 | B-04 / T-03 |
| Walk-forward backtest skeleton | Gap | `rolling_backtest_engine.py` 存在但非完整 walk-forward；無 per-setup 月度輸出 | 是 | B-08 / Phase 2 |
| Feature store skeleton | Gap | 無 `feature_store` table / service | 是 | B-06 / Phase 2 |
| KPI dashboard | Gap | LlmUsageDetailCard 存在；trading pipeline / learning KPI 缺 | 是 | B-07 / Phase 2 |
| Provider capability registry | 未列入 v1.0 | 未建立（B-101 衍生需求） | 是 | B-103 / Phase 1 立即（小 task） |

---

## 4. B-103 — 是否應該下一個做？

### 定義

- 以 dry-run 方式偵測 Copilot CLI 是否支援 `--model` 參數
- 建立 `runtime/agent_orchestrator/provider_capabilities.json`
- 記錄 `supportsModelParam`、`modelParamFlag`、`classification`
- 若不支援，正式標記 `PROVIDER_MANAGED_MODEL_ONLY`
- 不呼叫真實 Copilot execution

### 分析

| 面向 | 評估 |
|------|------|
| 是否必要 | 是。B-101 已在執行時「猜測」provider 不支援 model；B-103 將此事實落地為機器可讀 JSON，讓後續 scheduler / governance 邏輯可依此決策，而非假設 |
| 是否安全 | 是。dry-run 模式，不呼叫真實 API，無 usage 產生 |
| 影響後續 roadmap | 是。若未來 Copilot CLI 支援 `--model`，capability registry 讓 `providers.ts` 可自動偵測；若不建立，B-101 的 PROVIDER_MANAGED_MODEL_ONLY 結論只存在於 final report 而非 runtime |
| 與 lane scheduler 的順序 | B-103 工作量小（估 0.5d），不阻塞 lane scheduler；建議先做 B-103（確立 capability truth），再做 B-01 |
| 風險 | 極低。只讀寫本地 JSON 檔案 |

### 結論

**B-103 應該下一個做。** 工作量小、風險低、為後續 provider governance 打底。

---

## 5. Recommended Next 5 Tasks（新版）

### T-N1 — B-103 Copilot-Daemon Capability Check / Provider Capability Registry

**目的：** 將 B-101 的 PROVIDER_MANAGED_MODEL_ONLY 結論固化為 runtime 機器可讀格式，為未來 provider governance 自動化打底。

**為什麼現在做：** B-101 已完成，B-103 是其直接收尾；工作量約 0.5d，不阻塞其他任務。

**需要改的模組：**
- 新建 `scripts/check_provider_capability.sh`（dry-run copilot CLI help）
- 新建 `src/lib/agent-orchestrator/providerCapabilities.ts`（讀/寫 capability JSON）
- 新建 `runtime/agent_orchestrator/provider_capabilities.json`（初始化）
- `providers.ts`：讀取 capability 決定是否傳 model flag

**驗收標準：**
- `provider_capabilities.json` 存在，包含 `supportsModelParam: false`、`classification: "PROVIDER_MANAGED_MODEL_ONLY"`
- `providers.ts` 在 `supportsModelParam = false` 時不傳 model flag（現有行為）
- dry-run 腳本輸出格式化 capability 報告

**風險：** 極低。

**需要人工審核：** 否。

---

### T-N2 — Lane-based Scheduler + Heartbeat（B-01）

**目的：** 將 `single_active_task` 改為 per-lane 鎖（L-INTRADAY / L-DAILY / L-NIGHTLY / L-WEEKLY / L-MONTHLY），讓 intraday monitor 與 nightly learning 不互相卡死。同時加入 heartbeat（每 60s 寫一次）。

**為什麼現在做：** 目前所有 job 共用一把鎖，任何 long-running job 都會卡死整個 scheduler。這是 Phase 1 Stabilization 的基礎，其他 Phase 1 任務（freshness guard、daily ops）都依賴它。

**需要改的模組：**
- `src/lib/agent-orchestrator/workerTick.ts`：lane claim 邏輯
- `prisma/schema.prisma`：`JobRunLog` 加 `lane` / `heartbeat_at` 欄位
- `orchestrator/` 排程入口：依 lane 分配 cron
- `src/app/api/orchestrator/`：lane status API

**驗收標準：**
- 兩個不同 lane 的 job 可同時運行
- 同 lane 下第二個 job 自動排隊（不 fail）
- heartbeat 每 60s 更新；超過 5 分鐘無 heartbeat → stale 標記
- unit test 含 lane 互斥案例

**風險：** 中。schema migration 需謹慎；新增欄位（`lane`）屬 additive，不破壞現有記錄。

**需要人工審核：** 否（additive schema change）。

---

### T-N3 — Stale Job Cleanup + Lease Expiry（B-02）

**目的：** 每 5 分鐘掃描 `JobRunLog`，將 `running` 但 heartbeat 超過 `timeout × 2` 的記錄標為 `stale`，釋放 lane lock，並觸發 alert。

**為什麼現在做：** 依賴 T-N2 的 heartbeat；一旦 heartbeat 存在，此 cleanup cron 是直接後續。若不做，scheduler 可能被殭屍 job 卡死。

**需要改的模組：**
- `src/lib/agent-orchestrator/staleJobCleaner.ts`（新建）
- `orchestrator/` intraday cron（每 5 分鐘呼叫 cleaner）
- `src/app/api/orchestrator/health/route.ts`：回傳 stale job count

**驗收標準：**
- stale job 比例 ≤ 1%
- stale 記錄有 `stale_reason` 與 `stale_at` 欄位
- cleaner 本身有 idempotency（同一 job 不重複標）
- 有 alert（log / API）觸發

**風險：** 低。

**需要人工審核：** 否。

---

### T-N4 — Unified Freshness Guard / DataCoverageService（B-03）

**目的：** 統一所有 ingest source 的 freshness SLA 檢查（quote: 1d、financial: 90d、news: 6h），並在 proposal 階段自動降級 `dataCoverage`（non-fresh → `limited` / `insufficient`）。

**為什麼現在做：** 目前 freshness 散落各處；統一後才能保證「不用過期資料下 full trade」。這是 Phase 1 Exit Criteria 的前置條件。

**需要改的模組：**
- `src/lib/data-quality/DataCoverageService.ts`（新建或整合現有）
- `src/lib/strategy/proposalBuilder.ts`：呼叫 freshness guard
- `prisma/schema.prisma`：`data_quality_report` 表（若不存在）
- API：freshness status endpoint

**驗收標準：**
- 所有 ingest source 走同一個 freshness guard
- non-fresh source 自動觸發 `dataCoverage` 降級
- 降級事件有記錄（`quality_event` 或等效）
- 不 fresh 時無 full trade 可被觸發

**風險：** 中。需確認現有 freshness 邏輯分佈位置，避免遺漏。

**需要人工審核：** 否。

---

### T-N5 — Daily Ops Report v1（B-04）

**目的：** Nightly job 自動產出每日系統狀態報告，包含：KPI delta、freshness 綠燈/黃燈/紅燈、stale job 數、LLM usage（token / cost / budget 占比）、異常列表。

**為什麼現在做：** 依賴 T-N2（heartbeat）+ T-N3（stale cleaner）+ T-N4（freshness guard）；三者完成後 Daily Ops 可直接聚合輸出。這是 Phase 1 Exit Criteria（連續 14 天綠燈）的可觀測基礎。

**需要改的模組：**
- `src/lib/reports/DailyOpsReport.ts`（新建）
- `orchestrator/` nightly cron：trigger report build
- `src/app/api/reports/daily-ops/route.ts`（新建）
- `src/components/orchestrator/DailyOpsCard.tsx`（新建）

**驗收標準：**
- 報告包含 7 個健康指標 + 3 個 KPI 區塊
- 報告可從 UI 閱讀（或儲存為 JSON/Markdown）
- 連續 14 天報告顯示為「綠燈」（無 alert 觸發）
- report 本身是 idempotent（同一天重跑結果相同）

**風險：** 低（純彙總，無寫入 domain 資料）。

**需要人工審核：** 否。

---

## 6. Final Classification

```
ROADMAP_PARTIAL_NEEDS_WORKER_CAPABILITY_CHECK
```

**理由：** B-101 / B-102 已完成，但 B-103（Provider Capability Registry）尚未建立。B-101 的 PROVIDER_MANAGED_MODEL_ONLY 結論目前只存在於 final report；缺少 runtime `provider_capabilities.json` 使後續 provider governance 自動化邏輯無據可依。B-103 完成後，分類可升為 `ROADMAP_CONVERGED_READY_FOR_PHASE1_EXECUTION`。

**後續升級條件：**
1. B-103 完成 → 升為 `ROADMAP_CONVERGED_READY_FOR_PHASE1_EXECUTION`
2. T-N2 + T-N3 + T-N4 + T-N5 完成 → 升為 `PHASE1_STABILIZATION_COMPLETE`
3. Phase 2 KPI Dashboard + Walk-forward Skeleton 完成 → 升為 `PHASE2_MEASUREMENT_READY`
