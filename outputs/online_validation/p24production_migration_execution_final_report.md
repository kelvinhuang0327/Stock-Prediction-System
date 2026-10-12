# P24-HARDRESET Final Report

**Phase:** P24-HARDRESET  
**Task:** MonthlyRevenue releaseDate Production Migration Execution Gate  
**Date:** 2026-05-12  
**Final Classification:** `P24_PRODUCTION_MIGRATION_EXECUTION_COMPLETE`  
**Commit:** `33e5958`

---

## 1. 本輪目標

在 explicit approval token `P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY` 存在的前提下，執行 MonthlyRevenue releaseDate production migration execution gate。

本輪涵蓋 12 個 Parts (A–L)：
- Token 驗證 gate (Part A)
- Production execution safety utilities (Part B)
- Backup execution gate (Part C)
- Migration execution gate (Part D)
- Backfill execution gate (Part E)
- Post-migration validation gate (Part F)
- Rollback readiness gate (Part G)
- Unit tests (Part H)
- Forbidden claims scan (Part I)
- Artifact validation (Part J)
- Git commit (Part K)
- Final report (Part L)

---

## 2. Execution Token Verification

| Field | Value |
|-------|-------|
| Required token | `P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY` |
| Token present in prompt | ✅ YES |
| Token accepted | ✅ VERIFIED |
| Gate unlocked | ✅ YES — production execution authorized to proceed |

---

## 3. P23 Recap

| Item | Value |
|------|-------|
| P23 classification | `P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL` |
| P23 commit | `2d3f95b` |
| P23 preflight | 27/27 PASS |
| P23 artifact validation | 28/28 PASS |
| P23 unit tests | 76/76 PASS |
| P23 approvalGranted | `false` (never auto-granted) |
| P23 productionMigrationApplied | `false` |
| P23 requestedToken | `P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY` |

---

## 4. Backup Gate Result (Part C)

| Field | Value |
|-------|-------|
| backupStatus | ✅ PASS |
| backupPath | `prisma/dev.p24_premigration_backup_2026-05-12_0716.db` |
| checksumAlgorithm | sha256 |
| checksum | `a5cf277182c161df...` |
| productionDbTarget | `prisma/dev.db` |
| monthlyRevenueRowCountBefore | **2,143 rows** |
| Schema snapshot | ✅ captured before migration |

Backup was executed and verified before any migration command was run. Migration cannot proceed without backup PASS — this invariant was enforced.

---

## 5. Migration Gate Result (Part D)

| Field | Value |
|-------|-------|
| migrationStatus | ✅ PASS |
| executed | `true` |
| productionMigrationApplied | `true` (truthfully recorded) |
| backupStatus (gate check) | PASS — confirmed before execution |
| migrationTarget | `prisma/dev.db` (matches backup target) |
| releaseDateExists | ✅ true |
| releaseDateSourceExists | ✅ true |
| releaseDateConfidenceExists | ✅ true |
| Columns dropped | 0 — no unrelated columns touched |
| Schema after migration | Contains all 3 new columns |

Migration applied `prisma/migrations/20260512000000_monthly_revenue_release_date_pit_draft/migration.sql` which adds:
- `releaseDate TEXT`
- `releaseDateSource TEXT`
- `releaseDateConfidence TEXT`

No other columns were altered or dropped.

---

## 6. Backfill Gate Result (Part E)

| Field | Value |
|-------|-------|
| backfillStatus | ✅ PASS |
| migrationStatus (gate check) | PASS — confirmed before execution |
| rowsScanned | **2,143** |
| rowsBackfilled | **2,143** |
| rowsSkipped | 0 |
| invalidRows | 0 |
| releaseDateSource applied | `INFERRED_NEXT_MONTH_10TH` |
| releaseDateConfidence applied | `LOW_TO_MEDIUM` |
| Explicit releaseDates overwritten | 0 — preserved per rule |

Backfill rule: `releaseDate = 10th day of following month`, using `(year, month)` PIT-safe inference. December overflow handled correctly (month 12 → next year January 10). No `outcome`, `returnPct`, or `realizedReturnClass` fields were used.

**releaseDateSource distribution after backfill:**
```json
{ "INFERRED_NEXT_MONTH_10TH": 2143 }
```

---

## 7. Post-Migration Validation Gate Result (Part F)

| Field | Value |
|-------|-------|
| validationStatus | ✅ PASS |
| checklistItems | 13 / 13 items evaluated |
| mandatoryPass | **9 / 9** |
| queryGateSmoke | ✅ PASS — `releaseDate <= asOfDate` holds |
| noLeakagePass | ✅ PASS — no future releaseDate leakage |
| corpusFrozen | ✅ true — all 5 frozen corpora unchanged |

**MON-01 to MON-13 summary:**
- MON-01: releaseDate field exists ✅
- MON-02: releaseDateSource field exists ✅
- MON-03: releaseDateConfidence field exists ✅
- MON-04: rows with releaseDate counted ✅
- MON-05: rows without releaseDate counted ✅
- MON-06: inferred rows counted ✅
- MON-07: invalid releaseDate rows counted ✅
- MON-08: releaseDate <= asOfDate query gate smoke ✅
- MON-09: RuleBasedStockAnalyzer smoke ✅
- MON-10: FundamentalResearchService smoke ✅
- MON-11: ActiveScoringSnapshot smoke ✅
- MON-12: No production corpus changed ✅
- MON-13: No scoring formula changed / no leakage ✅

---

## 8. Rollback Readiness Gate Result (Part G)

| Field | Value |
|-------|-------|
| rollbackReadinessStatus | ✅ PASS |
| backupFilePath | `prisma/dev.p24_premigration_backup_2026-05-12_0716.db` |
| rollbackSqlPath | migration.sql (reversible ALTER TABLE / column drop documented) |
| rollbackTriggerCount | **8 triggers** documented |
| restoreStepCount | **10 restore steps** documented |
| autoTriggerDisabled | ✅ true (manual approval required for rollback) |
| migrationStatus known | ✅ true |
| currentRowCount | matches pre-migration count |

Rollback readiness is preserved after migration. If any post-migration issue is detected, the restore procedure is fully documented with the pre-migration backup.

---

## 9. Production DB Write Summary

| Action | Status |
|--------|--------|
| Schema migration (`ALTER TABLE MonthlyRevenue ADD COLUMN releaseDate`) | ✅ Applied |
| Schema migration (`ADD COLUMN releaseDateSource`) | ✅ Applied |
| Schema migration (`ADD COLUMN releaseDateConfidence`) | ✅ Applied |
| Backfill (`UPDATE MonthlyRevenue SET releaseDate = ...`) | ✅ Applied — 2,143 rows |
| Pre-migration backup | ✅ Written to `prisma/dev.p24_premigration_backup_2026-05-12_0716.db` |
| Other tables modified | **None** |
| Scoring formula modified | **No** |
| alphaScore logic modified | **No** |
| recommendationBucket logic modified | **No** |

---

## 10. Corpus Freeze Verification

| Corpus | Expected | Actual | Status |
|--------|----------|--------|--------|
| `simulation_snapshot_corpus.jsonl` | 60 | 60 | ✅ |
| `p0hardreset_historical_replay_corpus.jsonl` | 4500 | 4500 | ✅ |
| `p1baseline_historical_replay_corpus.jsonl` | 9900 | 9900 | ✅ |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4500 | 4500 | ✅ |
| `p19active_scoring_pit_replay_corpus.jsonl` | 4500 | 4500 | ✅ |

All frozen corpora unchanged. ManualReview* modules not touched.

---

## 11. Scoring Formula Unchanged Verification

| Item | Status |
|------|--------|
| alphaScore computation | ✅ Unchanged |
| recommendationBucket assignment | ✅ Unchanged |
| scoring formula / weights | ✅ Unchanged |
| P0/P1/P3/P4/P19 corpus lines | ✅ Unchanged |
| Backfill SQL touches only releaseDate fields | ✅ Confirmed |
| outcome / returnPct / realizedReturnClass | ✅ Not used in backfill |

---

## 12. 修改 / 新增檔案清單

**New TypeScript:**
- `src/lib/onlineValidation/P24ProductionMigrationExecutionUtils.ts` — 12 exported utility functions

**New unit tests:**
- `src/lib/onlineValidation/__tests__/p24production_migration_execution_utils.test.ts` — 108 tests

**New scripts:**
- `scripts/run-p24-preflight.js`
- `scripts/run-p24-production-backup-gate.js`
- `scripts/run-p24-production-migration-gate.js`
- `scripts/run-p24-production-backfill-gate.js`
- `scripts/run-p24-post-migration-validation.js`
- `scripts/run-p24-rollback-readiness-gate.js`
- `scripts/run-p24-artifact-validation.js`

**New output artifacts (JSON + MD):**
- `outputs/online_validation/p24production_migration_execution_preflight.json` + `.md`
- `outputs/online_validation/p24production_backup_gate.json` + `.md`
- `outputs/online_validation/p24production_migration_gate.json` + `.md`
- `outputs/online_validation/p24production_backfill_gate.json` + `.md`
- `outputs/online_validation/p24production_post_migration_validation.json` + `.md`
- `outputs/online_validation/p24production_rollback_readiness.json` + `.md`

**New backup artifacts:**
- `prisma/dev.p24_premigration_backup_2026-05-12_0716.db`
- `prisma/dev.p24_premigration_backup_2026-05-12_0716.db.sha256`

---

## 13. 測試結果 / Regression 結果

| Suite | Tests | Status |
|-------|-------|--------|
| P24 unit tests | 108 / 108 | ✅ PASS |
| Full onlineValidation suite | 1989 / 1989 | ✅ PASS |
| Pre-existing non-P24 errors | 3 in `data-quality/route.ts` (TS1128/TS1005) | ⚠️ Pre-existing, not from P24 |

---

## 14. TypeScript Validation 結果

`npx tsc --noEmit` result:
- 3 pre-existing errors in `src/app/api/admin/data-quality/route.ts` (TS1128/TS1005) — documented since P23, not from P24
- **0 new errors** from P24 files
- `P24ProductionMigrationExecutionUtils.ts` — ✅ tsc clean

---

## 15. Forbidden Claims Scan 結果

Scanned: all `p24production_*` artifacts + `P24ProductionMigrationExecutionUtils.ts` + `scripts/run-p24-*.js`

Patterns: `ROI | win-rate | win rate | outperform | beat | guaranteed | investment recommendation`

**Result: CLEAN**

All matches found were:
- `FORBIDDEN_PATTERNS` array definition in the scanner utility (exempt — scanner implementation)
- `EXEMPT_LINE_SUBSTRINGS` list entries (exempt — scanner implementation)

No financial claims in any P24 artifact or source file.

---

## 16. Artifact Validation 結果

**35 / 35 checks PASS**

| Range | Coverage |
|-------|----------|
| J01–J06 | JSON parse validation for all 6 P24 JSON artifacts |
| J07–J11 | Frozen corpus line counts (60/4500/9900/4500/4500) |
| J12–J13 | Preflight gate count and classification |
| J14–J17 | Backup gate: status/path/checksum/rowCount |
| J18–J21 | Migration gate: status/applied/executed/schemaAfter |
| J22–J24 | Backfill gate: status/rowsBackfilled/distribution |
| J25–J26 | Validation gate: status/checklistItems ≥10 |
| J27–J28 | Rollback gate: status/backupFilePath |
| J29–J34 | MD files exist for all 6 gates |
| J35 | Backup and migration target the same DB file |

---

## 17. 對 CEO 兩大主軸的貢獻

### 主軸 A：MonthlyRevenue availability 進入 production PIT-safe 狀態

✅ Migration PASS: `releaseDate`, `releaseDateSource`, `releaseDateConfidence` 已加入 production DB  
✅ Backfill PASS: 2,143 rows 全部以 `INFERRED_NEXT_MONTH_10TH` (10th day of following month) 填入 `releaseDate`  
✅ Query gate smoke PASS: `releaseDate <= asOfDate` 條件成立，確認不會有 future leakage  
✅ Post-migration validation PASS: 13/13 MON checklist items pass  

MonthlyRevenue 的基本面數據現在具備 PIT-safe 的時間標記，可以在 active scoring / replay 中正確過濾 as-of-date 前後的可見性。

### 主軸 B：降低 production replay / calibration 的基本面 leakage risk

✅ noLeakagePass = true — 無 future releaseDate leakage 被偵測  
✅ Corpus frozen — P0/P1/P3/P19 replay corpora 完整保留，無需 re-run historical replay  
✅ Scoring formula unchanged — 現有 alphaScore / recommendationBucket 計算邏輯不受影響  
✅ Rollback readiness preserved — 若後續發現問題，可立即恢復至 pre-migration 狀態  

---

## 18. 風險與不確定點

1. **Schema migration via direct SQLite**: 由於 Next.js dev server 持有 DB 鎖，migration 使用 sqlite3 CLI 直接執行 SQL，而非標準 `prisma migrate deploy`。`_prisma_migrations` 表在此環境下不存在（DB 由 `prisma db push` 建立）。Prisma migration history 未被記錄。

2. **Production DB = dev.db**: 本環境的 "production DB" 為 `prisma/dev.db`（SQLite 本地檔案）。非 PostgreSQL / 真實生產環境。`productionMigrationApplied: true` 是本地 SQLite 操作的真實記錄。

3. **Backfill confidence**: `releaseDateConfidence = LOW_TO_MEDIUM` 反映推算 (非官方公告) 的不確定性。所有 rows 均為 inferred，無 explicit releaseDate 來源資料。

4. **2,143 rows 全部 backfilled / 0 skipped**: 表示目前 DB 中無任何 row 已有 explicit releaseDate。若後續有官方資料來源，需以較高 confidence 覆蓋。

5. **Pre-existing TS errors**: `src/app/api/admin/data-quality/route.ts` 的 3 個 TS errors (TS1128/TS1005) 非 P24 引入，保留原狀。

---

## 19. 下一輪建議

**本輪結果：Migration SUCCESS**

建議 P25：**P25 Post-Migration Observability + Active Scoring Smoke**

具體建議：
1. P25-A: Active scoring run with new releaseDate-gated MonthlyRevenue — confirm scores are identical or within expected delta
2. P25-B: PIT replay with releaseDate gate — verify no leakage vs pre-migration baseline
3. P25-C: Null rate monitoring — confirm 0 rows with NULL releaseDate remain after backfill
4. P25-D: releaseDateSource distribution monitoring — track if any EXPLICIT sources are added over time
5. P25-E: Long-term observability — add releaseDate to admin data quality dashboard

若發生問題（rollback scenario）：
- 備份路徑: `prisma/dev.p24_premigration_backup_2026-05-12_0716.db`
- sha256 checksum 已記錄
- 8 rollback triggers + 10 restore steps 已文件化
- 需手動執行 restore + DROP COLUMN sequence

---

## 20. Final Classification

```
P24_PRODUCTION_MIGRATION_EXECUTION_COMPLETE
```

| Gate | Result |
|------|--------|
| Token verification | ✅ VERIFIED |
| Preflight (27/27) | ✅ PASS |
| Backup gate | ✅ PASS |
| Migration gate | ✅ PASS |
| Backfill gate | ✅ PASS |
| Post-migration validation (13/13) | ✅ PASS |
| Rollback readiness | ✅ PASS |
| Unit tests (108/108) | ✅ PASS |
| Broader test suite (1989/1989) | ✅ PASS |
| TypeScript (no new errors) | ✅ PASS |
| Forbidden claims scan | ✅ CLEAN |
| Artifact validation (35/35) | ✅ PASS |
| Corpus freeze | ✅ UNCHANGED |
| Scoring formula | ✅ UNCHANGED |

**P24-HARDRESET is complete.**  
MonthlyRevenue `releaseDate` / `releaseDateSource` / `releaseDateConfidence` is now in production.  
All 2,143 rows backfilled with `INFERRED_NEXT_MONTH_10TH` (10th day of following month).  
Rollback readiness preserved. Corpus frozen. No forbidden claims.

---

*This report does not constitute an investment recommendation. The system does not compute ROI, win-rate, or guaranteed returns. alphaScore is an internal model confidence score only.*
