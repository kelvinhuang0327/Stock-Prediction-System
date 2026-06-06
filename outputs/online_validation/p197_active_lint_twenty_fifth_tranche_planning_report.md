# P197 Active Lint Twenty-Fifth Tranche Planning Report

## 1. 任務資訊
- **Repo**: `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`
- **Branch**: `main`
- **Start HEAD**: `5fc47a5`
- **End HEAD**: `5fc47a5`
- **Final Classification**: `P197_ACTIVE_LINT_TWENTY_FIFTH_TRANCHE_PLANNED`

## 2. ESLint Baseline 摘要
- **問題總數**: 341 (Errors: 129, Warnings: 212)
- **Top 規則**:
  1. `@typescript-eslint/no-unused-vars` (201)
  2. `@typescript-eslint/no-explicit-any` (76)
  3. `@typescript-eslint/no-require-imports` (32)

## 3. P198 預計修復範圍 (Selected Tranche)
選定 8 個測試檔案：
1. `src/lib/onlineValidation/__tests__/p13_coverage_recovery_planner.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
2. `src/lib/onlineValidation/__tests__/p14_backfill_quality_impact_preview.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
3. `src/lib/onlineValidation/__tests__/p15_backfill_manual_review_package.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
4. `src/lib/onlineValidation/__tests__/p26f2_release_date_rule_contract_utils.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
5. `src/lib/onlineValidation/__tests__/p26f_monthly_revenue_mapping_contract_utils.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
6. `src/lib/onlineValidation/__tests__/p8_corpus_trend_stability.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
7. `src/lib/onlineValidation/__tests__/p9_corpus_quality_gate.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)
8. `src/lib/strategies/__tests__/AssetDoublingStrategy.test.ts` (1 error: `@typescript-eslint/no-explicit-any`)

- **修復規則**: `@typescript-eslint/no-explicit-any`
- **風險等級**: 低 (Low, test-only)
- **預估 Lint 減少**: -8 errors
- **Targeted Test 指令**:
  ```bash
  npx jest src/lib/onlineValidation/__tests__/p13_coverage_recovery_planner.test.ts src/lib/onlineValidation/__tests__/p14_backfill_quality_impact_preview.test.ts src/lib/onlineValidation/__tests__/p15_backfill_manual_review_package.test.ts src/lib/onlineValidation/__tests__/p26f2_release_date_rule_contract_utils.test.ts src/lib/onlineValidation/__tests__/p26f_monthly_revenue_mapping_contract_utils.test.ts src/lib/onlineValidation/__tests__/p8_corpus_trend_stability.test.ts src/lib/onlineValidation/__tests__/p9_corpus_quality_gate.test.ts src/lib/strategies/__tests__/AssetDoublingStrategy.test.ts --no-coverage
  ```

## 4. 排除名單 (Excluded Candidates)
- Production 程式碼檔如 `KellyCalculator.ts` (以防破壞核心邏輯)
- React hooks 相關錯誤的元件 (避免 client/server boundary 影響)

## 5. 治理與驗證
- **已讀取治理檔案**: active_task.md
- **是否需要強模型**: 否 (No)
