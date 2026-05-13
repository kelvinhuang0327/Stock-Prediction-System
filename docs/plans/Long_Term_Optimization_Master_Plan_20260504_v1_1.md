# 長期優化計劃 Master Plan v1.1
**Stock Prediction System — 3–12 個月優化路線圖**
**版本**: v1.1 (合併 Worker Provider/Model Governance 補強)
**建立日期**: 2026-05-04
**最後更新**: 2026-05-04 (v1.1 merge)
**狀態**: MASTER_PLAN_COMPLETE_WITH_WORKER_GOVERNANCE

---

## 目錄

1. [系統現況評估](#1-系統現況評估)
   - 1.1 [架構現況](#11-架構現況)
   - 1.2 [已知弱點](#12-已知弱點)
   - 1.3 [已驗證強項](#13-已驗證強項)
   - 1.4 [LLM 使用現況](#14-llm-使用現況)
   - 1.5 [Worker Provider/Model Governance Plan](#15-worker-providermodel-governance-plan) ⭐ NEW v1.1
2. [四大優化支柱](#2-四大優化支柱)
3. [12 個月路線圖](#3-12-個月路線圖)
   - Phase 1 (月 1–3)
   - Phase 2 (月 4–6)
   - Phase 3 (月 7–9)
   - Phase 3+ (月 10–12)
4. [Backlog 清單](#4-backlog-清單)
5. [推薦近期 5 個任務](#5-推薦近期-5-個任務)
6. [風險與護欄](#6-風險與護欄)
7. [計劃分類](#7-計劃分類)

---

## 1. 系統現況評估

### 1.1 架構現況

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App (src/)                   │
│   UI Dashboard ← API Routes ← Business Logic Services  │
├─────────────────────────────────────────────────────────┤
│              Agent Orchestrator (src/lib/agent-         │
│              orchestrator/)                             │
│  Planner (local-planner) → Worker (copilot-daemon)      │
│                          → CTO (local-review)           │
├─────────────────────────────────────────────────────────┤
│         Prisma ORM + SQLite (dev.db)                    │
│  Models: StrategyProposal, SimulatedTrade,              │
│          TradeReviewReport, StrategyLearningInsight,    │
│          OptimizationInsightRecord, DailyMarketSnapshot │
│          DailyCandidateSnapshot, FinancialReport,       │
│          JobRunLog, LlmUsageRecord                      │
├─────────────────────────────────────────────────────────┤
│   Runtime State (runtime/agent_orchestrator/)           │
│   scheduler_state.json, project_profile.json,           │
│   llm_usage.jsonl, llm_audit.jsonl,                     │
│   provider_capabilities.json (planned)                  │
└─────────────────────────────────────────────────────────┘
```

**核心服務清單**:
- `SimulationExecutionEngine.ts` — 模擬交易執行引擎
- `TriggerScoringEngine.ts` — 觸發評分引擎（含閾值控制）
- `StrategyLearningEngine.ts` — 策略學習引擎（含污染過濾）
- `DataFreshnessService.ts` — 資料新鮮度服務
- `DataCoverageService.ts` — 資料覆蓋率服務
- `RollingBacktestEngine.ts` — 滾動回測引擎
- `KellyPositionSizingService.ts` — Kelly 倉位計算
- `LlmUsageLogger.ts` — LLM 使用量審計日誌
- `LlmAuditGuard.ts` — LLM 外部呼叫防護

### 1.2 已知弱點

| 編號 | 類別 | 問題描述 | 嚴重度 |
|------|------|----------|--------|
| W-01 | 架構 | Agent Orchestrator Worker model 欄位為空（未傳播 desiredModel）| 高 |
| W-02 | 架構 | orchestrator_worker_external.sh 不接受 model 參數 | 高 |
| W-03 | 可觀測性 | llm_usage.jsonl 中 taskId 為 null（idle 預飛無法區分）| 中 |
| W-04 | 資料 | 部分台股數據覆蓋率不足（節假日/停牌股） | 中 |
| W-05 | 排程 | 無 Lane-Based 排程器（高/低優先佇列） | 中 |
| W-06 | 預測 | 技術指標計算缺乏台股特化調校 | 中 |
| W-07 | 學習 | StrategyLearningEngine 污染過濾規則需定期審查 | 低 |
| W-08 | 監控 | 無自動化每日 Ops 報告 | 低 |

### 1.3 已驗證強項

- ✅ Kelly 倉位計算已驗證（validate_kelly_backtest.py）
- ✅ 滾動回測框架完整（rolling_backtest_engine.py）
- ✅ LLM 審計防護已部署（LlmAuditGuard.ts）
- ✅ 風險防禦驗證通過（validate_risk_defense.py）
- ✅ Walk-Forward 驗證框架就緒（validate_walk_forward.py）
- ✅ Prisma schema 完整涵蓋所有領域模型
- ✅ Worker provider 已設定為 copilot-daemon（本地執行）
- ✅ Planner / CTO 維持 local-only（不呼叫外部 LLM）

### 1.4 LLM 使用現況

**runtime/agent_orchestrator/llm_usage.jsonl 稽核結果**:

```
狀態: 已確認無真實外部 LLM 呼叫
Worker provider: copilot-daemon ✓
Worker model: "" (空字串) ← W-01 待修
Planner: local-planner ✓ (無外部呼叫)
CTO: local-review ✓ (無外部呼叫)
provider_execution_success 筆數: 0
所有紀錄均為預飛事件 (preflight) 或空 provider 事件
```

**關鍵發現**:
1. `desiredModel = "gpt-5-mini"` 已儲存於 scheduler_state.json
2. `actualModel` 未被記錄（orchestrator_worker_external.sh 未傳 model 參數）
3. idle 週期預飛與真實執行預飛無法區分（taskId 均為 null）

---

### 1.5 Worker Provider/Model Governance Plan

> **v1.1 新增章節** — 補強 Worker Governance 完整政策

#### 1.5.1 Worker Provider Policy

**原則**: 三角色各司其職，Worker 是唯一外部執行路徑。

| 角色 | Provider | 執行位置 | 外部 LLM 呼叫 |
|------|----------|----------|--------------|
| Planner | local-planner | 本地 | ❌ 禁止 |
| CTO | local-review | 本地 | ❌ 禁止 |
| Worker | copilot-daemon | Copilot CLI | ✅ 允許（受控） |

**強制執行機制**:
- `providerFactory.ts` 根據角色限定可用 provider
- `launchd.env` 環境變數 `AGENT_ORCHESTRATOR_WORKER_PROVIDER='copilot-daemon'`
- `scheduler_state.json` 持久化 `workerProvider: "copilot-daemon"`
- `project_profile.json` 預設值 `worker_provider: "copilot-daemon"`

**禁止行為**:
- Planner 或 CTO 使用任何外部 provider（包含 copilot-daemon、claude、openai）
- Worker 使用未經登記的 provider
- 未經 LlmAuditGuard 檢查的外部 API 呼叫

#### 1.5.2 Worker Model Policy

**原則**: desiredModel ≠ actualModel，必須分開記錄。

```
desiredModel  = scheduler_state.workerCopilotModel (目前: "gpt-5-mini")
actualModel   = Copilot CLI 回應/輸出中確認的模型
fallback      = "provider-managed"（當 CLI 不揭露模型時）
```

**嚴禁**: 以 desiredModel 填充 actualModel（即使值相同也不允許，因為無法確認）

**記錄格式（目標狀態）**:
```jsonl
{
  "event": "provider_execution_start",
  "provider": "copilot-daemon",
  "desiredModel": "gpt-5-mini",
  "actualModel": "provider-managed",
  "modelPropagationStatus": "propagated_to_cli | not_supported | unknown",
  "taskId": "task_177",
  "caller": "worker_tick"
}
```

#### 1.5.3 Model Propagation Plan

需要修改的 8 個檔案：

| 順序 | 檔案 | 變更內容 |
|------|------|----------|
| 1 | `src/lib/agent-orchestrator/providers.ts` | `interpolateCommand()` 新增 `{model}` token 支援 |
| 2 | `scripts/orchestrator_worker_external.sh` | 讀取 `AGENT_ORCHESTRATOR_WORKER_MODEL` 環境變數，傳遞 `--model` 給 Copilot CLI |
| 3 | `deploy/launchd-orchestrator/launchd.env` | 確認 `AGENT_ORCHESTRATOR_WORKER_MODEL='gpt-5-mini'` 已存在 ✓ |
| 4 | `src/lib/agent-orchestrator/workerTick.ts` | 傳遞 `desiredModel` 給 provider 呼叫；idle 週期設 `noTaskReason='no_queued_task'` |
| 5 | `src/lib/agent-orchestrator/aiService.ts` | 擷取 CLI 輸出中的模型確認；回傳 `actualModel` |
| 6 | `src/lib/agent-orchestrator/llmUsageLogger.ts` | 日誌新增 `desiredModel`, `actualModel`, `modelPropagationStatus` 欄位 |
| 7 | `src/lib/agent-orchestrator/llmAuditGuard.ts` | 驗證 actualModel 不等於 desiredModel（除非有 CLI 確認）|
| 8 | `src/components/LlmUsageDetailCard.tsx` | UI 顯示 `desiredModel`, `actualModel`, `modelPropagationStatus` |

#### 1.5.4 Copilot-Daemon Capability Check

**目的**: 確認 Copilot CLI 是否支援 `--model` 參數，避免盲目傳遞無效參數。

**執行方式**: Dry-run（不執行真實任務）
```bash
copilot --help 2>&1 | grep -i model
```

**三種結果分類**:

| 結果碼 | 條件 | 後續行動 |
|--------|------|----------|
| `WORKER_MODEL_PROPAGATION_READY` | CLI 支援 `--model` 參數 | 實作 B-101（完整 model 傳播）|
| `PROVIDER_MANAGED_MODEL_ONLY` | CLI 不支援 `--model` | actualModel 固定記為 "provider-managed"；不傳 model 參數 |
| `NEEDS_PROVIDER_CAPABILITY_CHECK` | 無法確定 | 手動確認後再決定 |

**輸出檔案**: `runtime/agent_orchestrator/provider_capabilities.json`
```json
{
  "provider": "copilot-daemon",
  "checkedAt": "ISO8601 timestamp",
  "supportsModelParam": true | false | null,
  "modelParamFlag": "--model" | null,
  "classification": "WORKER_MODEL_PROPAGATION_READY | PROVIDER_MANAGED_MODEL_ONLY | NEEDS_PROVIDER_CAPABILITY_CHECK",
  "rawHelpOutput": "..."
}
```

#### 1.5.5 Copilot TaskId Attribution Policy

**目的**: 消除 llm_usage.jsonl 中 taskId=null 的歧義。

**三種案例定義**:

| 案例 | 條件 | 處理方式 |
|------|------|----------|
| **Case A** — 正常執行 | Worker 有排隊任務 | `taskId = task.id`（真實 task ID）|
| **Case B** — Idle 週期 | Worker 無排隊任務（排程器正常巡迴）| `taskId = null`, `noTaskReason = 'no_queued_task'`，**不觸發警報** |
| **Case C** — 執行異常 | Worker 執行中但 taskId 仍為 null | 記錄 anomaly warning，觸發 `COPILOT_TASK_ATTRIBUTION_ANOMALY` 警報 |

**禁止行為**:
- Case B 不得觸發 `COPILOT_PREFLIGHT_LOOP` 警報
- Case C 不得靜默忽略

#### 1.5.6 Worker Governance 安全約束

以下為不可違反的硬性規則：

1. **NO_EXTERNAL_LLM_PLANNER**: Planner 絕不使用外部 LLM provider
2. **NO_EXTERNAL_LLM_CTO**: CTO 絕不使用外部 LLM provider
3. **NO_THRESHOLD_CHANGE**: 任何優化不得修改現有評分閾值（需走 A/B 測試流程）
4. **NO_ACTUAL_MODEL_GUESS**: actualModel 不得使用 desiredModel 填充（除非 CLI 明確確認）
5. **NO_SILENT_ANOMALY**: taskId 遺失的執行事件不得靜默忽略
6. **NO_UNREGISTERED_PROVIDER**: Worker 不得使用未在 providerFactory 登記的 provider
7. **NO_CODE_CHANGE_IN_DOC**: 本計劃為純文件，不包含程式碼變更指令

---

## 2. 四大優化支柱

### 支柱一：程式系統架構優化

**核心目標**: 提升系統可靠性、可觀測性、與維護性

- Agent Orchestrator 完整治理（Worker provider/model 傳播、taskId 歸因）
- Lane-Based 排程器（高/低優先佇列，防止任務飢餓）
- 統一資料新鮮度護欄（DataFreshnessService + DataCoverageService）
- 自動化每日 Ops 報告

### 支柱二：台股預測成功率優化

**核心目標**: 提升預測準確率與信號品質

- 台股特化技術指標調校（均線參數、量價關係）
- 產業/族群輪動訊號
- 法人籌碼整合（外資、投信、自營商）
- 財報驅動策略優化

### 支柱三：自我學習/模擬/回測優化

**核心目標**: 提升策略自我演化能力

- Walk-Forward 驗證自動化（已有框架，待自動化觸發）
- Monte Carlo 情境壓力測試自動化
- StrategyLearningEngine 污染過濾規則自動審查
- 學習洞察品質評分機制

### 支柱四：排程自我學習優化

**核心目標**: 確保排程器穩健、可觀測、自我修復

- Heartbeat 監控（stale job 自動清理）
- Lane-Based 優先佇列
- 排程執行 KPI 追蹤（成功率、延遲、重試次數）
- 自動 Ops 報告觸發

---

## 3. 12 個月路線圖

### Phase 1 — 基礎治理與可觀測性（月 1–3）

> **目標**: 修復已知弱點、建立監控基線、確保 Worker Governance 完整

#### P0（必做，月 1）

| 項目 | 說明 | 對應 Backlog |
|------|------|-------------|
| Worker Model Propagation | `interpolateCommand()` 新增 `{model}` token；`orchestrator_worker_external.sh` 讀取 `AGENT_ORCHESTRATOR_WORKER_MODEL`；desiredModel/actualModel/modelPropagationStatus 記錄 | B-101 |
| Copilot TaskId Attribution | `workerTick.ts` idle 週期設 `noTaskReason`；execution 遺失 taskId → anomaly | B-102 |
| Copilot-Daemon Capability Check | Dry-run `--help` 確認 `--model` 支援；輸出 `provider_capabilities.json` | B-103 |
| Lane-Based Scheduler | 高/低優先 Lane + heartbeat + `staleJobCleanup` + `tradingDaysBetween` | B-201 |
| Unified Freshness Guard | DataFreshnessService + DataCoverageService 整合統一入口 | B-202 |

#### P1（重要，月 2–3）

| 項目 | 說明 | 對應 Backlog |
|------|------|-------------|
| Daily Ops Report v1 | 自動化每日 Ops 報告 Job（排程成功率、LLM 使用、資料覆蓋）| B-203 |
| Hard-Off Smoke Test | 驗證 global scheduler hard-off 後 Worker 完全靜默 | B-104 |
| UI Model Propagation Status | LlmUsageDetailCard 顯示 desiredModel / actualModel / propagationStatus | B-105 |
| LLM Audit Dashboard v1 | 每日 LLM 費用估算、外部呼叫次數、provider 分布圖表 | B-204 |

### Phase 2 — 台股特化與學習優化（月 4–6）

> **目標**: 提升預測成功率，自動化學習閉環

| 項目 | 說明 |
|------|------|
| 台股技術指標特化 | 均線週期調校（5/10/20 vs 台股慣用）、量比計算 |
| 法人籌碼整合 | 外資/投信/自營商資料同步、籌碼強度指標 |
| Walk-Forward 自動化 | validate_walk_forward.py 整合至排程器，自動觸發 |
| Monte Carlo 自動化 | 定期壓力測試，輸出風險儀表板 |
| Worker Model Usage Dashboard | Copilot per-task 使用 KPI、重試迴圈偵測 |
| External LLM Cost Trend | actualModel 分布、token 趨勢、費用估算 |
| 學習洞察品質評分 | OptimizationInsightRecord 品質評分機制 |
| 污染過濾自動審查 | StrategyLearningEngine 污染過濾規則定期審查 Job |

### Phase 3 — 策略演化與進階回測（月 7–9）

> **目標**: 系統具備自主策略優化能力

| 項目 | 說明 |
|------|------|
| 策略 A/B 測試框架 | 新策略與現有策略並行回測，勝者晉升 |
| 財報驅動策略 | FinancialReport 整合至策略評分 |
| 產業輪動訊號 | 族群強度指標，跨股票相關性分析 |
| 進階 Kelly 調校 | 動態 Kelly 分數（依市況調整保守係數）|
| Provider Governance 強化 | Worker provider 治理儀表板；model 能力登錄 |
| Provider Fallback Policy | provider 失效時自動降級規則 |

### Phase 3+ — 自動化與長期維護（月 10–12）

> **目標**: 系統達到高度自動化，人工干預最小化

| 項目 | 說明 |
|------|------|
| 自主策略提案 | Agent 自動提案新策略，等待人工審核 |
| Model Performance vs Cost | actualModel 效能 vs 費用比較報告 |
| Provider Capability Registry | 所有 provider 能力登錄，自動路由 |
| 長期回測資料庫 | 歷史回測結果持久化，跨版本比較 |
| 自動化文件同步 | 程式碼變更自動更新 CHANGELOG / ARCHITECTURE |

---

## 4. Backlog 清單

### Worker Governance 相關（v1.1 新增）

#### B-101: Worker Model Propagation
**優先級**: P0（月 1）
**類別**: 架構治理
**描述**: 實作完整的 Worker model 傳播鏈，確保 desiredModel 能傳達至 Copilot CLI，actualModel 能從 CLI 回應擷取並記錄。

**涉及檔案**:
1. `src/lib/agent-orchestrator/providers.ts` — `interpolateCommand()` 新增 `{model}` token
2. `scripts/orchestrator_worker_external.sh` — 讀取 `AGENT_ORCHESTRATOR_WORKER_MODEL`，傳遞 `--model` 給 CLI
3. `src/lib/agent-orchestrator/workerTick.ts` — 傳遞 `desiredModel` 給 provider
4. `src/lib/agent-orchestrator/aiService.ts` — 擷取 CLI 輸出中的 actualModel
5. `src/lib/agent-orchestrator/llmUsageLogger.ts` — 新增 `desiredModel`, `actualModel`, `modelPropagationStatus` 欄位
6. `src/lib/agent-orchestrator/llmAuditGuard.ts` — 驗證 actualModel 記錄完整性
7. `src/components/LlmUsageDetailCard.tsx` — UI 顯示 model propagation 狀態

**驗收標準**:
- [ ] `llm_usage.jsonl` 中 `desiredModel = "gpt-5-mini"` 正確記錄
- [ ] `actualModel = "provider-managed"` 或經 CLI 確認的真實模型
- [ ] `modelPropagationStatus` 欄位存在且非空
- [ ] Planner / CTO 日誌無任何 `desiredModel` 或 `actualModel` 欄位（不應有外部 model 紀錄）
- [ ] `provider_execution_success` 筆數維持 0（Planner/CTO 維持 local-only）

**前置條件**: B-103（Capability Check）需先完成，確認 CLI 是否支援 `--model`

---

#### B-102: Copilot TaskId Attribution Fix
**優先級**: P0（月 1）
**類別**: 可觀測性
**描述**: 修復 `llm_usage.jsonl` 中 taskId=null 的歧義問題，區分 idle 預飛與執行異常。

**涉及檔案**:
1. `src/lib/agent-orchestrator/workerTick.ts` — idle 週期設 `noTaskReason = 'no_queued_task'`
2. `src/lib/agent-orchestrator/llmUsageLogger.ts` — 新增 `noTaskReason` 欄位
3. `src/lib/agent-orchestrator/llmAuditGuard.ts` — 區分 Case B（idle）與 Case C（anomaly）

**驗收標準**:
- [ ] 所有 idle 預飛有 `noTaskReason = 'no_queued_task'`（而非 `taskId = null` 裸露）
- [ ] Idle 週期不觸發 `COPILOT_PREFLIGHT_LOOP` 警報
- [ ] 執行事件（有任務）遺失 taskId → 記錄 `COPILOT_TASK_ATTRIBUTION_ANOMALY`
- [ ] 歷史分析：可區分 `taskId=null+noTaskReason` vs `taskId=null+anomaly`

---

#### B-103: Copilot-Daemon Capability Check
**優先級**: P0（月 1）
**類別**: 架構治理
**描述**: 執行 dry-run capability check，確認 Copilot CLI 是否支援 `--model` 參數，輸出 `provider_capabilities.json`。

**執行方式**: 純 dry-run，不執行真實任務

**輸出**:
```
runtime/agent_orchestrator/provider_capabilities.json
```

**驗收標準**:
- [ ] `provider_capabilities.json` 存在且包含 `supportsModelParam`, `modelParamFlag`, `classification`
- [ ] classification 為三種之一: `WORKER_MODEL_PROPAGATION_READY | PROVIDER_MANAGED_MODEL_ONLY | NEEDS_PROVIDER_CAPABILITY_CHECK`
- [ ] `checkedAt` 為 ISO8601 timestamp
- [ ] 執行此 check 不觸發任何真實 LLM 呼叫

---

#### B-104: Hard-Off Smoke Test
**優先級**: P1（月 2）
**類別**: 測試驗證
**描述**: 驗證 global scheduler hard-off 啟用後，Worker 完全靜默（無任何 Copilot CLI 呼叫）。

**驗收標準**:
- [ ] hard-off 啟用後，`llm_usage.jsonl` 無新增 `provider_execution_start` 事件
- [ ] hard-off 後 5 分鐘內 Copilot CLI process 無新啟動
- [ ] hard-off 狀態在 scheduler_state.json 正確持久化

---

#### B-105: UI Model Propagation Status
**優先級**: P1（月 2）
**類別**: 可觀測性 UI
**描述**: 在 LlmUsageDetailCard 新增 desiredModel / actualModel / modelPropagationStatus 顯示。

**涉及檔案**:
- `src/components/LlmUsageDetailCard.tsx`
- `src/app/api/orchestrator/providers/route.ts`（確認已回傳 model 資訊）

**前置條件**: B-101 完成

---

### 系統架構相關

#### B-201: Lane-Based Scheduler
**優先級**: P0（月 1）
**類別**: 架構
**描述**: 實作高/低優先 Lane，防止高優先任務被低優先任務飢餓。加入 heartbeat 與 `staleJobCleanup`。

**驗收標準**:
- [ ] 高優先任務（如資料同步）不被低優先任務（如回測）阻塞
- [ ] `staleJobCleanup` 自動清理超時任務
- [ ] heartbeat 每 N 分鐘記錄 scheduler 存活狀態

---

#### B-202: Unified Freshness Guard
**優先級**: P0（月 1）
**類別**: 資料治理
**描述**: DataFreshnessService + DataCoverageService 整合為統一入口，所有策略在執行前必須通過 freshness check。

**驗收標準**:
- [ ] 統一 `DataGuardService.check()` 入口
- [ ] 資料過期時策略執行自動中止並記錄原因
- [ ] 覆蓋率低於閾值時觸發補填 Job

---

#### B-203: Daily Ops Report v1
**優先級**: P1（月 2）
**類別**: 可觀測性
**描述**: 自動化每日 Ops 報告 Job，涵蓋排程成功率、LLM 使用量、資料覆蓋率。

**驗收標準**:
- [ ] 每個交易日結束後自動產生報告
- [ ] 報告包含：任務成功/失敗率、LLM 呼叫次數（按 provider）、資料覆蓋率摘要
- [ ] 報告儲存至 `logs/daily_ops/YYYY-MM-DD.json`

---

#### B-204: LLM Audit Dashboard v1
**優先級**: P1（月 2）
**類別**: 可觀測性 UI
**描述**: UI 儀表板顯示每日 LLM 費用估算、外部呼叫次數、provider 分布。

**前置條件**: B-101, B-102 完成

---

## 5. 推薦近期 5 個任務

> 依優先順序排列，聚焦月 1 核心工作

### Task 1 — Worker Model Propagation + desiredModel/actualModel Logging（B-101）

**為何優先**: W-01 是目前最高嚴重度的弱點；model 欄位為空導致無法審計 Worker 實際使用的模型。
**前置**: B-103（Capability Check）需先確認 CLI 支援情況。
**硬性約束**: 不得修改閾值；actualModel 不得用 desiredModel 填充。

---

### Task 2 — Copilot TaskId Attribution Fix（B-102）

**為何優先**: 目前無法區分 idle 預飛與執行異常，導致可觀測性盲點。
**硬性約束**: idle 不得觸發警報；執行遺失 taskId 必須警報。

---

### Task 3 — Lane-Based Scheduler + Heartbeat（B-201）

**為何優先**: 排程器無優先佇列，高優先任務（資料同步）可能被低優先任務佔滿。
**涉及**: `staleJobCleanup`、heartbeat、`tradingDaysBetween`。

---

### Task 4 — Unified Freshness Guard（B-202）

**為何優先**: 資料新鮮度不足是台股預測失準的主要原因之一。
**涉及**: DataFreshnessService + DataCoverageService 整合。

---

### Task 5 — Daily Ops Report v1（B-203）

**為何優先**: 無自動化報告導致問題發現延遲；Ops 報告是可觀測性基礎。
**輸出**: `logs/daily_ops/YYYY-MM-DD.json`

---

## 6. 風險與護欄

### 6.1 技術風險

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| Copilot CLI 不支援 `--model` | 中 | 中（actualModel 固定為 provider-managed）| B-103 先做 capability check |
| Worker model 傳播導致 CLI 錯誤 | 低 | 高（Worker 停止執行）| dry-run 測試；失敗時回退至無 model 模式 |
| 排程器 Lane 實作引入競態 | 低 | 高（任務重複執行）| 嚴格 jobLock 機制；整合測試覆蓋 |
| 台股資料源不穩定 | 高 | 中（預測準確率下降）| Unified Freshness Guard + 備援資料源 |

### 6.2 不可違反的護欄

1. **NO_THRESHOLD_CHANGE**: 任何計劃項目不得直接修改評分閾值（需走 A/B 測試 → 人工審核 → 漸進上線）
2. **NO_EXTERNAL_LLM_EXPANSION**: Planner 與 CTO 維持 local-only；不得新增外部 LLM 角色
3. **NO_PRODUCTION_DATA_MUTATION**: 所有回測使用唯讀資料；不得寫入生產資料
4. **NO_SILENT_FAILURE**: 任何異常必須記錄並觸發警報；不得靜默吞錯
5. **AUDIT_TRAIL_REQUIRED**: 所有 LLM 呼叫必須通過 LlmAuditGuard；llm_usage.jsonl 必須完整

---

## 7. 計劃分類

```
MASTER_PLAN_CLASSIFICATION: MASTER_PLAN_COMPLETE_WITH_WORKER_GOVERNANCE
VERSION: v1.1
COVERAGE:
  - 四大優化支柱: ✅
  - 12 個月路線圖 (Phase 1–3+): ✅
  - Worker Provider Policy: ✅ (v1.1 新增)
  - Worker Model Policy: ✅ (v1.1 新增)
  - Model Propagation Plan: ✅ (v1.1 新增)
  - Copilot Capability Check Plan: ✅ (v1.1 新增)
  - TaskId Attribution Policy: ✅ (v1.1 新增)
  - Safety Constraints: ✅ (v1.1 新增)
  - Backlog B-101 ~ B-204: ✅
  - Near-term Top 5 Tasks: ✅
  - Risk & Guardrails: ✅
HARD_RULES:
  - NO_CODE_CHANGE: This document contains NO code changes
  - NO_THRESHOLD_CHANGE: No scoring thresholds modified
  - NO_EXTERNAL_LLM: No external LLM calls authorized
  - DOCUMENTATION_ONLY: Pure planning document
```

---

*Master Plan v1.1 — Stock Prediction System Long-Term Optimization Roadmap*
*Generated: 2026-05-04 | MASTER_PLAN_COMPLETE_WITH_WORKER_GOVERNANCE*
