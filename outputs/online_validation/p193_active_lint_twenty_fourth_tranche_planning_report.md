# P193 Active Lint Twenty-Fourth Tranche Planning Report

## 1. 任務資訊
- **Repo**: `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`
- **Branch**: `main`
- **Start HEAD**: `a43a879`
- **End HEAD**: `a43a879`
- **Final Classification**: `P193_ACTIVE_LINT_TWENTY_FOURTH_TRANCHE_PLANNED`

## 2. ESLint Baseline 摘要
- **問題總數**: 347 (Errors: 135, Warnings: 212)
- **Top 規則**:
  1. `@typescript-eslint/no-unused-vars` (201)
  2. `@typescript-eslint/no-explicit-any` (81)
  3. `@typescript-eslint/no-require-imports` (32)
- **分析與篩選邏輯**: 優先挑選 test-only 檔案，降低對 production code 行為的風險。

## 3. P194 預計修復範圍 (Selected Tranche)
選定 6 個測試檔案：
1. `src/lib/agent-orchestrator/adaptivePolicy.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
2. `src/lib/agent-orchestrator/aiModulesService.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
3. `src/lib/agent-orchestrator/types.test.ts` (1 error: `@typescript-eslint/ban-ts-comment`)
4. `src/lib/onlineValidation/__tests__/p0combined_outcome_writeback_skeleton.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
5. `src/lib/onlineValidation/__tests__/p12pit_feature_contract_utils.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
6. `src/lib/onlineValidation/__tests__/p13_horizon_maturity_tracker.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)

- **修復規則**: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`
- **風險等級**: 低 (Low)
- **預估 Lint 減少**: -6 errors
- **Targeted Test 指令**:
  ```bash
  npx jest src/lib/agent-orchestrator/adaptivePolicy.test.ts src/lib/agent-orchestrator/aiModulesService.test.ts src/lib/agent-orchestrator/types.test.ts src/lib/onlineValidation/__tests__/p0combined_outcome_writeback_skeleton.test.ts src/lib/onlineValidation/__tests__/p12pit_feature_contract_utils.test.ts src/lib/onlineValidation/__tests__/p13_horizon_maturity_tracker.test.ts --no-coverage
  ```

## 4. 排除名單 (Excluded Candidates)
- `src/lib/jobs/autonomousJobRunners.ts` (含有 10 個警告，因屬於 production code 故在此 tranche 排除)

## 5. 治理與驗證
- **已讀取治理檔案**: SHARED_AGENT_BOOTSTRAP.md, TASK_TEMPLATES.md, active_task.md
- **本地 Jest 驗證結果**: 86 tests PASS
- **是否需要強模型**: 否 (No)
- **CI Run ID Inspected**: `26992625499` (Failure due to unrelated components/lint errors)
