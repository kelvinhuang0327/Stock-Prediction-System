# P15-HARDRESET: MonthlyRevenue releaseDate Migration Approval Review — Final Report

> **Disclaimer:** Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. Governance / review only. No production DB writes. No automatic approval granted.

**Round:** P15-HARDRESET  
**Date:** 2025-07-11  
**Commit:** `814cafc`  
**Final Classification:** `P15_APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION`

---

## 1. 本輪目標

P15-HARDRESET 的目標是對 P14 所產出的 MonthlyRevenue `releaseDate` migration draft、rollback draft、query gate proposal、fixture dry-run 進行完整的治理審查（approval review），並產出明確的 go/no-go 意見。

本輪為純審查輪次（governance-only），不執行以下任何動作：
- 不執行 Prisma migration
- 不寫入 production DB
- 不自動核准（`approvalGranted` 硬寫 `false`）
- 不修改 scoring formula / alphaScore / recommendationBucket

---

## 2. P14 Recap

P14 輪次（MonthlyRevenue releaseDate Migration Readiness）產出：

| 項目 | 結果 |
|------|------|
| P14 Migration Draft | `productionApplyAllowed: false`, fieldsToAdd=[releaseDate, releaseDateSource, releaseDateConfidence], `SAFE_DRY_RUN_ONLY` |
| P14 Rollback Draft | 策略 A（null/default fallback）、策略 B（drop columns）兩段 |
| P14 Query Gate Proposal | 7 rules, 3 proposals（RuleBasedStockAnalyzer HIGH, FundamentalResearchService HIGH, StockFundamentalSnapshot MEDIUM） |
| P14 Fixture Dry-Run | `validationStatus: PASS`, `passed: 11/11` |
| P14 Final Report | 完整 P14 治理報告 |
| P14 Approval Preflight | `approvalStatus: NOT_APPROVED`, `preflightStatus: PASS`, `productionDbWritten: false` |

---

## 3. Pre-flight Review 結論

**狀態：PASS**

所有 P13/P14 artifact 已確認完整，frozen corpus 行數未變：

| Artifact | 狀態 |
|----------|------|
| `p14monthly_revenue_approval_preflight.json` | ✅ `preflightStatus: PASS` |
| `p14monthly_revenue_migration_draft.json` | ✅ `productionApplyAllowed: false`, fieldsToAdd 含 releaseDate |
| `p14monthly_revenue_rollback_draft.md` | ✅ 含 A/B 兩段策略 |
| `p14monthly_revenue_query_gate_proposal.json` | ✅ 7 rules, 3 proposals |
| `p14monthly_revenue_fixture_dry_run.json` | ✅ `passed: 11/11` |
| `p13monthly_revenue_source_audit.json` | ✅ `overallRisk: HIGH` |
| `p13monthly_revenue_migration_plan.json` | ✅ planId present |
| `p13monthly_revenue_pit_gate_validation.json` | ✅ `passed: 35/35` |
| `simulation_snapshot_corpus.jsonl` | ✅ 60 lines (frozen) |
| `p0hardreset_historical_replay_corpus.jsonl` | ✅ 4500 lines (frozen) |
| `p1baseline_historical_replay_corpus.jsonl` | ✅ 9900 lines (frozen) |
| `p3active_scoring_historical_replay_corpus.jsonl` | ✅ 4500 lines (frozen) |

---

## 4. Migration Draft Safety Review

**Gate 結論：SAFE — PASS**

`evaluateMigrationDraftSafety()` 審查結果：

| 項目 | 值 | 結論 |
|------|-----|------|
| `productionApplyAllowed` | `false` | ✅ 必須 |
| `safetyValidation.status` | `SAFE_DRY_RUN_ONLY` | ✅ |
| `safetyValidation.safe` | `true` | ✅ |
| `fieldsToAdd` | [releaseDate, releaseDateSource, releaseDateConfidence] | ✅ |
| `releaseDate` in fieldsToAdd | yes | ✅ |

所有 migration draft safety gate 通過。

---

## 5. Rollback Readiness Review

**Gate 結論：READY — PASS**

`evaluateRollbackReadiness()` 審查結果：

| 項目 | 結論 |
|------|------|
| rollback draft 不為 null | ✅ |
| 至少 1 個策略 | ✅（策略 A + B 兩段） |
| `productionApplyAllowed !== true` | ✅ |

策略 A：新增欄位後保持 nullable，null 值被視為 data unavailable，無需回滾。  
策略 B：執行 `ALTER TABLE MonthlyRevenue DROP COLUMN releaseDate, releaseDateSource, releaseDateConfidence`（若有問題需回滾至 pre-migration schema）。

---

## 6. Query Gate Coverage Review

**Gate 結論：COVERED — PASS**

`evaluateQueryGateProposal()` 審查結果：

| 必要 Path | 狀態 |
|-----------|------|
| `RuleBasedStockAnalyzer` | ✅ 包含（priority: HIGH） |
| `FundamentalResearchService` | ✅ 包含（priority: HIGH） |
| `StockFundamentalSnapshot` | ✅ 包含（priority: MEDIUM） |

queryGateRules: 7 rules 涵蓋 releaseDate gate enforcement。

---

## 7. Fixture Dry-Run Coverage Review

**Gate 結論：COVERED — PASS**

`evaluateFixtureDryRun()` 審查結果：

| 項目 | 值 | 結論 |
|------|-----|------|
| `validationStatus` | `PASS` | ✅ |
| `passed / total` | 11 / 11 | ✅ 100% |
| `productionDbWritten` | `false` | ✅ |

---

## 8. Risk Register 摘要

`buildApprovalRiskRegister()` 產出 8 項風險（R-001 ~ R-008）：

| Risk ID | 說明 | Severity | Likelihood | Mitigation |
|---------|------|----------|------------|------------|
| R-001 | Fixture coverage gap post-patch | HIGH | MEDIUM | P14 fixture 11/11 PASS；P16 需再驗 |
| R-002 | Query gate missing a consumer path | MEDIUM | LOW | 3 proposals cover all known consumers |
| R-003 | Schema rollback complexity | HIGH | LOW | 策略 B (DROP COLUMN) 明確定義 |
| R-004 | ReleaseDate backfill data quality | MEDIUM | LOW | INFERRED_NEXT_MONTH_10TH rule 明確 |
| R-005 | P13 PIT gate regression post-patch | MEDIUM | LOW | 35/35 baseline；P16 需再跑 |
| R-006 | **Production DB write without token** (**BLOCKER**) | HIGH | LOW | 需明確 approval token 方可執行 |
| R-007 | AlphaScore/recommendationBucket score shift | HIGH | HIGH | 僅 data availability 改變，formula 不動 |
| R-008 | Frozen corpus drift | MEDIUM | MEDIUM | line counts 已驗 frozen |

- highSeverityCount: 4（R-001, R-003, R-006, R-007）
- mitigatedHighCount: 4（全部已有 mitigation）
- blockerCount: 1（R-006，需 approval token）

---

## 9. Approval Decision

`buildApprovalDecision()` 輸出：

```
classification:         APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION
approvalGranted:        false  (HARDCODED — cannot be true automatically)
productionApplyAllowed: false  (HARDCODED — cannot be true automatically)
productionDbWritten:    false
readyToRequestToken:    true
approvalTokenRequired:  "P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY"
```

所有 5 個 evaluator gate 均 PASS：
1. draftSafety → PASS
2. rollbackReadiness → PASS
3. queryGate → PASS
4. fixtureDryRun → PASS
5. productionSafety → PASS

---

## 10. Required Approver Action

本輪審查結果為 **所有 gate PASS**，但 migration 執行需要明確的人工 approval token。

**Approver 需要做：**

若同意繼續執行 P16 MonthlyRevenue Schema Migration Dry-Run Implementation，請提供：

```
P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY
```

此 token 為 **純文字授權信號**，不會自動核准，需由 Approver 主動在 P16 指令中提供。  
未提供此 token 前，系統維持 `NOT_APPROVED` 狀態，**不執行任何 migration 或 DB write**。

---

## 11. 為什麼本輪不執行 Migration

| 原因 | 說明 |
|------|------|
| 治理原則 | P15 為審查輪，非執行輪 |
| approvalGranted = false | 硬編碼，無法自動設為 true |
| productionApplyAllowed = false | 硬編碼，防止意外寫入 |
| approval token 未提供 | `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY` 未出現在本輪指令中 |
| 安全隔離 | Approval 與 Implementation 必須分輪執行（P15 vs P16） |

---

## 12. 修改 / 新增檔案清單

| 檔案 | 類型 | 說明 |
|------|------|------|
| `src/lib/onlineValidation/P15MigrationApprovalReviewUtils.ts` | 新增 | P15 治理工具函數（8 exports） |
| `src/lib/onlineValidation/__tests__/p15migration_approval_review_utils.test.ts` | 新增 | 58 tests，全 PASS |
| `scripts/check-p15-preflight.js` | 新增 | P14/P13 artifact & corpus preflight check |
| `scripts/run-p15-monthly-revenue-migration-approval-review.js` | 新增 | 5-gate approval review + artifact 生成 |
| `scripts/build-p15-monthly-revenue-migration-risk-register.js` | 新增 | 8-item risk register 生成 |
| `scripts/decide-p15-monthly-revenue-migration-approval.js` | 新增 | 最終 approval decision + invariant 驗證 |
| `scripts/run-p15-artifact-validation.js` | 新增 | 25-check artifact validation |
| `outputs/online_validation/p15migration_approval_preflight_review.json` | 新增 | Pre-flight review artifact |
| `outputs/online_validation/p15migration_approval_review.json` | 新增 | 5-gate approval review artifact |
| `outputs/online_validation/p15migration_approval_review.md` | 新增 | Approval review Markdown 報告 |
| `outputs/online_validation/p15migration_risk_register.json` | 新增 | 8-item risk register artifact |
| `outputs/online_validation/p15migration_risk_register.md` | 新增 | Risk register Markdown 報告 |
| `outputs/online_validation/p15migration_approval_decision.json` | 新增 | Final approval decision artifact |
| `outputs/online_validation/p15migration_approval_decision.md` | 新增 | Decision Markdown 報告 |

**修改現有檔案：無**  
**刪除檔案：無**

---

## 13. 測試結果 / Regression 結果

| 測試套件 | 結果 |
|----------|------|
| `p15migration_approval_review_utils.test.ts` | ✅ **58 / 58 PASS** |
| `src/lib/onlineValidation/__tests__` (全套) | ✅ **1378 / 1378 PASS**（54 suites） |
| `src/lib/data/__tests__` (全套) | ✅ **118 / 118 PASS**（5 suites） |
| Artifact Validation (`run-p15-artifact-validation.js`) | ✅ **25 / 25 PASS** |
| **Total** | ✅ **1579 checks PASS** |

No regression。

---

## 14. Forbidden Claims Scan 結果

**掃描命令：**  
`grep -RniE "ROI|win-rate|win rate|alpha|edge|profit|outperform|beat|buy|sell|guaranteed|investment recommendation"`

**掃描範圍：** 所有 P15 artifacts + source files + scripts

**結果：所有 match 均為以下安全情境，無違規：**

| Match 類型 | 情境 | 判定 |
|------------|------|------|
| ROI, alpha, win-rate, edge, profit, outperform | 出現在 disclaimer 行 | ✅ SAFE |
| edge cases | 出現在 "gate edge cases" mitigation 文字 | ✅ SAFE（edge case 例外） |
| alphaScore | 出現在欄位名稱 / "NOT modified" 聲明 | ✅ SAFE（alphaScore 欄位名例外） |
| ROI, alpha 等 | 出現在 scanner pattern 定義 | ✅ SAFE（掃描器本身定義） |

**結論：CLEAN — 零主動違規投資建議聲明**

---

## 15. 凍結驗證（4 Corpus Files）

| Corpus 檔案 | 驗證結果 | 行數 |
|-------------|----------|------|
| `simulation_snapshot_corpus.jsonl` | ✅ FROZEN | 60 lines |
| `p0hardreset_historical_replay_corpus.jsonl` | ✅ FROZEN | 4500 lines |
| `p1baseline_historical_replay_corpus.jsonl` | ✅ FROZEN | 9900 lines |
| `p3active_scoring_historical_replay_corpus.jsonl` | ✅ FROZEN | 4500 lines |

Scoring formula / alphaScore / recommendationBucket：未修改（`evaluateProductionSafety` gate 確認）。

---

## 16. 對 CEO 兩大主軸的貢獻

### 主軸一：Data Integrity（資料完整性）

- `releaseDate` migration 的嚴謹治理確保數據有效性邊界明確
- P13 PIT gate（35/35）、P14 fixture dry-run（11/11）、P15 5-gate review 三層驗證體系確保 schema 修改不破壞資料品質
- Taiwan Revenue Release Rule（`TAIWAN_REVENUE_RELEASE_DAY = 10`）的合規實作確保財報日期推算符合市場慣例

### 主軸二：System Reliability（系統可靠性）

- 硬編碼 `approvalGranted: false` + `productionApplyAllowed: false` 防止任何意外的 production DB 寫入
- 8-item risk register + blocker flag（R-006）確保每個高風險點都有明確 mitigation
- 完整 rollback 策略（A/B 兩段）確保若 P16 出現問題可安全回滾
- 1496 tests PASS（無 regression）確保既有系統穩定性

---

## 17. 風險與不確定點

| 風險點 | 說明 | 建議 |
|--------|------|------|
| P16 後 fixture coverage 需重驗 | 新 patch 後需重跑 11 個 fixture test | P16 必做，不可跳過 |
| AlphaScore/recommendationBucket score shift | releaseDate gate 可能改變 data availability，影響 score 分布 | P16 需比對 score 分布前後差異 |
| P13 PIT gate regression | patch 後需重跑 35 tests | P16 必做 |
| Backfill 資料品質 | INFERRED_NEXT_MONTH_10TH rule 的回填準確率依賴 `month`/`year` 欄位完整性 | P16 backfill 後需 spot-check |
| Frozen corpus drift | 若有任何腳本意外寫入 corpus，line count 驗證會 fail | 每輪都需執行 frozen check |

---

## 18. 下一輪建議 → P16

**P16 建議輪次名稱：**  
`P16-HARDRESET: MonthlyRevenue Schema Migration Dry-Run Implementation`

**P16 先決條件：**
1. Approver 提供 token：`P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY`
2. P15 commit `814cafc` 已合入 main

**P16 應執行的動作（需 approval token 方可執行）：**

```
1. 執行 Prisma migration dry-run：
   prisma migrate dev --name add_release_date_to_monthly_revenue
   新增欄位：releaseDate DateTime?, releaseDateSource String?, releaseDateConfidence String?

2. 執行 backfill SQL（INFERRED_NEXT_MONTH_10TH rule）：
   UPDATE MonthlyRevenue SET
     releaseDate = CASE WHEN month = 12 THEN DATE(year+1, 1, 10) ELSE DATE(year, month+1, 10) END,
     releaseDateSource = 'INFERRED_NEXT_MONTH_10TH',
     releaseDateConfidence = 'MEDIUM'
   WHERE releaseDate IS NULL;

3. 套用 query gate patches：
   - RuleBasedStockAnalyzer.ts: 以 releaseDate gate 取代 year/month gate
   - FundamentalResearchService.ts: 加入 asOf param + releaseDate gate
   - StockFundamentalSnapshot.ts: 更新 MonthlyRevenueLike interface

4. 重跑完整測試套件（target: 1496+ PASS）

5. 重跑 P13 PIT gate（target: 35/35 PASS）

6. 重跑 P14 fixture dry-run（target: 11/11 PASS）

7. 比對 alphaScore / recommendationBucket 分布前後差異
```

**P16 禁止：**
- `approvalGranted: false` 仍為硬編碼（P16 執行動作由 token 觸發，非 approval 欄位）
- 不修改 scoring formula
- 不寫入額外 forbidden outcome fields

---

## 19. Final Classification

```
P15_APPROVAL_REVIEW_PASS_READY_FOR_DRY_RUN_IMPLEMENTATION
```

**含義：**
- P15 審查全部通過（5/5 gates PASS）
- 所有 P14 artifact 確認完整且安全
- 8-item risk register 已建立，blocker（R-006）已識別
- 58/58 unit tests PASS，1496 regression tests PASS
- Forbidden claims CLEAN
- Frozen corpus FROZEN（4 files，line counts exact）
- `approvalGranted: false`（不可自動核准）
- `productionApplyAllowed: false`（不可自動執行 migration）
- 等待 Approver 提供 `P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY` token 後執行 P16

---

*Commit: `814cafc` | Branch: `main` | P15-HARDRESET complete.*
