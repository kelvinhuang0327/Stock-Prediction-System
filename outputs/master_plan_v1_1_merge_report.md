# Master Plan v1.1 合併報告

**檔案**: `outputs/master_plan_v1_1_merge_report.md`
**合併日期**: 2026-05-04
**操作類型**: DOCUMENTATION_ONLY（無程式碼變更）
**合併結果**: ✅ 成功

---

## 1. 合併摘要

| 項目 | 詳情 |
|------|------|
| 來源版本 | Master Plan v1.0（對話中產生） |
| 目標版本 | Master Plan v1.1 |
| 合併觸發 | Master Plan 稽核發現 10 個 Worker Governance 缺口 |
| 稽核結論 | `MASTER_PLAN_PARTIAL_WORKER_GAP_FOUND` |
| 合併後分類 | `MASTER_PLAN_COMPLETE_WITH_WORKER_GOVERNANCE` |
| 輸出檔案 | `docs/plans/Long_Term_Optimization_Master_Plan_20260504_v1_1.md` |

---

## 2. 新增章節

### 2.1 Section 1.5 — Worker Provider/Model Governance Plan（全新）

| 子章節 | 標題 | 內容摘要 |
|--------|------|----------|
| 1.5.1 | Worker Provider Policy | 三角色分工表（Planner/CTO/Worker）；強制執行機制（providerFactory、launchd.env、scheduler_state.json）；禁止行為清單 |
| 1.5.2 | Worker Model Policy | desiredModel vs actualModel 分離原則；記錄格式規範；NEVER fill actualModel with desiredModel 規則 |
| 1.5.3 | Model Propagation Plan | 8 個涉及檔案的修改計劃（providers.ts → LlmUsageDetailCard.tsx）|
| 1.5.4 | Copilot-Daemon Capability Check | 3 種結果分類；provider_capabilities.json 輸出格式 |
| 1.5.5 | Copilot TaskId Attribution Policy | Case A/B/C 三種案例定義；idle 不觸發警報；執行遺失 taskId 觸發異常 |
| 1.5.6 | Worker Governance Safety Constraints | 7 條硬性規則 |

### 2.2 稽核發現的 10 個缺口（補強前）

| 缺口編號 | 缺口描述 | 補強方式 |
|----------|----------|----------|
| G-01 | 未說明 Worker 是唯一外部 LLM 執行路徑 | Section 1.5.1 明確定義 |
| G-02 | 未說明 providerFactory 如何限制角色 | Section 1.5.1 強制執行機制 |
| G-03 | desiredModel / actualModel 分離原則未記載 | Section 1.5.2 完整政策 |
| G-04 | model 傳播路徑未定義（8 個檔案）| Section 1.5.3 逐檔說明 |
| G-05 | Copilot CLI `--model` 支援未驗證 | Section 1.5.4 + B-103 |
| G-06 | provider_capabilities.json 輸出格式未定義 | Section 1.5.4 JSON schema |
| G-07 | taskId=null 歧義問題（idle vs anomaly）| Section 1.5.5 Case A/B/C |
| G-08 | COPILOT_PREFLIGHT_LOOP 誤觸發問題 | Section 1.5.5 Case B 明確不觸警報 |
| G-09 | COPILOT_TASK_ATTRIBUTION_ANOMALY 未定義 | Section 1.5.5 Case C |
| G-10 | 七條安全約束未集中記載 | Section 1.5.6 |

---

## 3. Roadmap 更新

### 3.1 Phase 1 新增項目（P0/P1）

**P0（月 1）新增**:
- Worker Model Propagation（`interpolateCommand()` + shell script + logging）→ B-101
- Copilot TaskId Attribution Fix（noTaskReason + anomaly detection）→ B-102
- Copilot-Daemon Capability Check（dry-run `--help` + provider_capabilities.json）→ B-103

**P1（月 2）新增**:
- Hard-Off Smoke Test（global scheduler hard-off 驗證）→ B-104
- UI Model Propagation Status（LlmUsageDetailCard 顯示 model 狀態）→ B-105

### 3.2 Phase 2 新增項目

- Worker model usage dashboard（Copilot per-task 使用 KPI）
- Copilot 重試迴圈偵測
- External LLM cost/token 趨勢報告
- actualModel 分布分析

### 3.3 Phase 3+ 新增項目

- Worker provider governance 儀表板
- Model capability registry（所有 provider 能力登錄）
- Provider fallback policy（失效時自動降級）
- Model performance vs cost 比較報告

---

## 4. Backlog 更新

### 4.1 新增 Backlog 項目（v1.1 新增）

| ID | 標題 | 優先級 | 類別 |
|----|------|--------|------|
| B-101 | Worker Model Propagation | P0（月 1）| 架構治理 |
| B-102 | Copilot TaskId Attribution Fix | P0（月 1）| 可觀測性 |
| B-103 | Copilot-Daemon Capability Check | P0（月 1）| 架構治理 |
| B-104 | Hard-Off Smoke Test | P1（月 2）| 測試驗證 |
| B-105 | UI Model Propagation Status | P1（月 2）| 可觀測性 UI |

### 4.2 既有 Backlog 項目（v1.0 保留）

| ID | 標題 | 優先級 |
|----|------|--------|
| B-201 | Lane-Based Scheduler | P0（月 1）|
| B-202 | Unified Freshness Guard | P0（月 1）|
| B-203 | Daily Ops Report v1 | P1（月 2）|
| B-204 | LLM Audit Dashboard v1 | P1（月 2）|

---

## 5. Near-Term Top 5 Tasks 更新

### v1.0 版本（合併前）

1. Lane-Based Scheduler + Heartbeat
2. Unified Freshness Guard
3. Daily Ops Report v1
4. LLM Audit Dashboard v1
5. Walk-Forward 自動化

### v1.1 版本（合併後）

| 順序 | 任務 | Backlog | 調整原因 |
|------|------|---------|----------|
| 1 | Worker Model Propagation + desiredModel/actualModel Logging | B-101 | W-01 高嚴重度；model 欄位為空影響審計 |
| 2 | Copilot TaskId Attribution Fix | B-102 | 可觀測性盲點；idle vs anomaly 無法區分 |
| 3 | Lane-Based Scheduler + Heartbeat | B-201 | 排程飢餓風險；高優先任務可能被阻塞 |
| 4 | Unified Freshness Guard | B-202 | 資料新鮮度不足是預測失準主因 |
| 5 | Daily Ops Report v1 | B-203 | 無自動報告導致問題發現延遲 |

**變動說明**: Worker Governance 相關任務（B-101, B-102）因高嚴重度與高優先級，插隊至 Top 1 和 Top 2 位置。

---

## 6. 最終分類

```
MERGE_OPERATION: v1.0 → v1.1
MERGE_DATE: 2026-05-04
MERGE_TYPE: DOCUMENTATION_ONLY

PRE_MERGE_CLASSIFICATION:  MASTER_PLAN_PARTIAL_WORKER_GAP_FOUND
POST_MERGE_CLASSIFICATION: MASTER_PLAN_COMPLETE_WITH_WORKER_GOVERNANCE

GAPS_CLOSED: 10/10
NEW_SECTIONS: 1 (Section 1.5 with 6 sub-sections)
NEW_BACKLOG_ITEMS: 5 (B-101 ~ B-105)
ROADMAP_UPDATES: Phase 1 P0/P1 + Phase 2 + Phase 3+
TOP5_TASKS_CHANGED: Yes (2 new items inserted at rank 1 and 2)

HARD_RULES_COMPLIANCE:
  NO_CODE_CHANGE: ✅ Confirmed
  NO_THRESHOLD_CHANGE: ✅ Confirmed
  NO_EXTERNAL_LLM: ✅ Confirmed
  DOCUMENTATION_ONLY: ✅ Confirmed

OUTPUT_FILE: docs/plans/Long_Term_Optimization_Master_Plan_20260504_v1_1.md
STATUS: COMPLETE
```

---

*Merge Report — Master Plan v1.0 → v1.1*
*2026-05-04 | MASTER_PLAN_COMPLETE_WITH_WORKER_GOVERNANCE*
