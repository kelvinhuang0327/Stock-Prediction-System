# P31 Final Report — MonthlyRevenue Source-Present Dry-Run Gate

**Phase:** P31
**Date:** 2026-05-21
**Branch:** main
**Head Commit:** dfebb7b
**Final Classification:** `P31_MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY`

---

## 1. 本輪目標

P31 的目標是建立 MonthlyRevenue 的 source-present dry-run gate 正式合約與掃描結果，確認：

1. 所有 MonthlyRevenue 列都符合 dry-run gate 的條件（releaseDate / releaseDateSource / releaseDateConfidence 100% 覆蓋）
2. 建立正式的 `MonthlyRevenueDryRunContract`（不可變合約物件，定義所有不變量）
3. 建立 `MonthlyRevenueSourcePresentDryRunGate`（列層級與批次層級的 gate 邏輯）
4. 驗證 entersAlphaScore = false ALWAYS
5. 確認 0 blocked rows
6. 通過所有測試與回歸測試

---

## 2. 已完成事項

- [x] 建立 `MonthlyRevenueDryRunContract.ts` — 正式合約物件，validateContract()，checkRowAgainstContract()
- [x] 建立 `MonthlyRevenueSourcePresentDryRunGate.ts` — checkRowDryRunGate()，buildDryRunBatchScanResult()，buildDryRunGateScanFromCounts()
- [x] 建立測試檔 `p31_monthly_revenue_source_present_dry_run.test.ts` — 64 tests，10 describe groups
- [x] DB 掃描：2143/2143 rows READY，0 blocked
- [x] 所有驗證輸出檔案已建立
- [x] 回歸測試通過

---

## 3. 修改或產出的檔案

### 新增檔案（源碼）

| 檔案 | 說明 |
|---|---|
| `src/lib/onlineValidation/p31/MonthlyRevenueDryRunContract.ts` | 正式合約物件與驗證函式 |
| `src/lib/onlineValidation/p31/MonthlyRevenueSourcePresentDryRunGate.ts` | Gate 邏輯（列層級 + 批次） |
| `src/lib/onlineValidation/__tests__/p31_monthly_revenue_source_present_dry_run.test.ts` | 64 個純單元測試 |

### 新增檔案（輸出）

| 檔案 | 說明 |
|---|---|
| `outputs/online_validation/p31_preflight_mainline_status.json/.md` | 主線狀態確認 |
| `outputs/online_validation/p31_monthly_revenue_artifact_review.json/.md` | P29K→P29L→P30→P31 鏈路摘要 |
| `outputs/online_validation/p31_monthly_revenue_dry_run_gate_scan.json/.md` | DB 掃描結果 |
| `outputs/online_validation/p31_monthly_revenue_dry_run_sample.json/.md` | Sample metadata audit |
| `outputs/online_validation/p31_test_baseline.json/.md` | 測試基線 |
| `outputs/online_validation/p31_forbidden_claims_scan.json/.md` | 禁止聲明掃描 |
| `outputs/online_validation/p31_final_report.md` | 本報告 |

### 修改檔案

| 檔案 | 說明 |
|---|---|
| `00-Plan/roadmap/roadmap.md` | 追加 P31 章節 |
| `00-Plan/roadmap/CTO-Analysis.md` | 追加 P31 條目 |

---

## 4. MonthlyRevenue source-present dry-run gate 結果

| 指標 | 值 |
|---|---|
| Total Rows | 2143 |
| With releaseDate | 2143 (100%) |
| With releaseDateSource | 2143 (100%) |
| With releaseDateConfidence | 2143 (100%) |
| Ready Rows | 2143 |
| Blocked Rows | **0** |
| Overall Classification | **MONTHLY_REVENUE_DRY_RUN_READY** |
| Policy | INFERRED_NEXT_MONTH_10TH |
| entersAlphaScore | **false** |
| paperOnly | true |
| dryRun | true |

---

## 5. Sample output 結果

- rowCount: 2143
- releaseDateCoverage: 100%
- releaseDateSourceCoverage: 100% (policy: INFERRED_NEXT_MONTH_10TH)
- releaseDateConfidenceCoverage: 100% (confidence: LOW)
- blockedRows: 0
- dryRunStatus: READY
- overallClassification: MONTHLY_REVENUE_DRY_RUN_READY
- auditConclusion: All 2143 MonthlyRevenue rows pass source-present dry-run gate. No leakage risk detected. releaseDate metadata 100% populated. No rows enter alphaScore.

---

## 6. 驗證結果 / 測試結果

| 測試套件 | 通過 | 狀態 |
|---|---|---|
| P31 新測試 | 64/64 | PASS |
| P30 回歸 | 49/49 | PASS |
| P29L 回歸 | 96/96 | PASS |
| P29K 回歸 | 68/68 | PASS |
| 完整 onlineValidation suite | 3697/3701 | 4 pre-existing failures |

**Forbidden diff:** BENIGN（prisma/dev.db 和 llm_usage.jsonl 為 P31 前已存在的工作區變更）

**Forbidden claims scan:** CLEAN

---

## 7. 目前結論

- MonthlyRevenue 所有 2143 筆資料完整通過 source-present dry-run gate
- releaseDate、releaseDateSource、releaseDateConfidence 覆蓋率均為 100%
- 0 blocked rows
- entersAlphaScore = false ALWAYS — 不變量已強制執行
- 合約物件 `MONTHLY_REVENUE_DRY_RUN_CONTRACT` 驗證通過
- 最終分類：**`P31_MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY`**

---

## 8. 尚未完成事項

1. **Chip schema migration 套用** — `prisma migrate dev` 需要 CTO 授權（由 P30 遺留）
2. **syncInstitutionalChip() 更新** — 等待 schema migration 套用
3. **Chip 歷史資料回填** — 等待 schema migration 套用
4. **生產日誌收集** — 升級 Chip lag 至 `CHIP_LAG_CONFIRMED`
5. **MonthlyRevenue 實際 dry-run 執行** — gate 已 READY，可在下一輪啟動

---

## 9. 風險與不確定點

1. **releaseDateConfidence: LOW** — INFERRED_NEXT_MONTH_10TH 為保守估計，不是 TWSE 官方確認日期
2. **Chip schema 阻塞** — 在 schema migration 未套用前，chip 的 availableAt PIT 功能無法使用
3. **pre-existing test failures** — 4 個測試套件有既有失敗（p29d, p26a x2, p27），需要未來修復
4. **MonthlyRevenue leakage 風險** — 雖然 gate 通過，但實際 dry-run 執行仍需嚴格 PIT 邊界控制

---

## 10. 建議下一步

1. **P32 目標：Chip schema migration 套用**（需 CTO 授權）
   - 執行 `prisma migrate dev --name add_chip_available_at`
   - 更新 `syncInstitutionalChip()` 寫入 `availableAt`
   - 執行歷史 Chip 資料回填

2. **P32/P33 目標：MonthlyRevenue dry-run 執行**
   - 使用 `MONTHLY_REVENUE_DRY_RUN_CONTRACT` 執行實際 dry-run
   - 驗證 PIT 邊界（asOfDate >= releaseDate）
   - 確認無 leakage fields 洩漏

3. **修復 pre-existing test failures** — p29d, p26a, p27 套件的失敗需要獨立調查

---

## 11. 下一輪可直接執行的 task prompt

```
Implement P32 for the Stock Prediction System.

Prior state: P31_MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY
HEAD: <latest-commit-after-P31>

P32 Goals:
1. Apply Chip availableAt schema migration (prisma migrate dev)
   - CTO authorization received: YES/NO (confirm before proceeding)
   - If YES: run prisma migrate dev, update syncInstitutionalChip(), backfill chip history
2. MonthlyRevenue dry-run execution
   - Use MONTHLY_REVENUE_DRY_RUN_CONTRACT from P31
   - Execute sample dry-run with asOfDate enforcement
   - Confirm entersAlphaScore = false for all rows

Hard constraints: same as P31. No DB schema modifications without explicit authorization.
```

---

## 12. CTO agent 10 行內摘要

```
P31 完成：MonthlyRevenue source-present dry-run gate 正式建立。
DB 掃描：2143/2143 rows READY，0 blocked rows，100% coverage。
Policy: INFERRED_NEXT_MONTH_10TH，releaseDateConfidence: LOW（保守估計）。
合約物件 MonthlyRevenueDryRunContract 驗證通過，entersAlphaScore = false 不變量強制執行。
Gate 邏輯：leakage field 檢查、asOfDate PIT 邊界、revenueMonth end date 驗證全部實作。
測試：64/64 PASS（P31 新測試），P30/P29L/P29K 回歸全部通過，全套 3697/3701 PASS。
Forbidden claims scan: CLEAN。Forbidden diff: BENIGN。
分類：P31_MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY。
尚待：Chip schema migration（需 CTO 授權），syncInstitutionalChip() 更新，MonthlyRevenue 實際 dry-run 執行。
entersAlphaScore = false ALWAYS — 不投資建議，不含任何買賣持有/ROI/獲利聲明。
```

---

> DISCLAIMER: 本報告為結構性審計報告。不構成投資建議。
> MonthlyRevenue entersAlphaScore = false ALWAYS。
> 結果不得用於買入/賣出/持有訊號或投資建議。
