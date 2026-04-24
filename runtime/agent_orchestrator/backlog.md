# Agent Orchestrator Backlog

## North Star

在不破壞現有研究與自動化流程的前提下，讓 Planner / Worker 以可追蹤、可驗證、可重排程的閉環方式持續推進專案任務，並且能安全切換不同 Agent provider。

## Success Criteria

1. 每個 task 都有完整 artifacts：`prompt.md`、`contract.json`、`completed.md`、`result.json`、`meta.json`。
2. worker 交付必須經過 gate 驗證，不合格任務自動轉為 `REPLAN_REQUIRED`。
3. protected paths 不可被任務修改。
4. planner 會先讀取上一個任務結果再決定下一步。

## Priorities

### Priority 1: Orchestrator Stability

- 先確保排程、task 狀態轉移、artifact 寫入完整且可恢復。
- 優先重試 `REPLAN_REQUIRED` 任務。

### Priority 2: Delivery Throughput

- 保持 task queue 穩定流動，避免卡在 `RUNNING`。
- worker 遇到權限或 runtime 問題時，必須 finalize 而不是懸掛。

### Priority 3: Visibility

- 提供 API 與最小 UI，能看見 schedule、provider、task list、gate verdict、進度摘要。

### Priority 4: Continuous Improvement

- 根據 `task_result.json` 的 handoff 問題與失敗原因修正下一輪規劃策略。

## Planner Rules

1. 先讀最新 `task_result.json` 再產生新任務。
2. 若最新任務為 `RUNNING`，planner 必須跳過。
3. 若最新任務為 `REPLAN_REQUIRED`，必須優先處理。
4. 每個 prompt 都必須包含 `Objective`、`Scope`、`Constraints`、`Acceptance Criteria`、`Handoff Notes`。

## Constraints

- 不可修改 project profile 中的 `protected_paths`。
- 不可在缺乏證據下宣稱完成。
- 遇到無法執行的 worker 任務，必須輸出 `result.json` 並轉為可重排狀態。

## References

- `README.md`
- `docs/`
- `wiki/`
- `runtime/agent_orchestrator/project_profile.json`

## Auto Status Block

The orchestrator may maintain an auto-generated section below this line.
