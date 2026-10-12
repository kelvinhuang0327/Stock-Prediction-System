# P26F3-2-HARDRESET — Manual Historical MonthlyRevenue Source Acquisition Package

**Date**: 2026-05-13  
**Final Classification**: P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY

---

## 1. 本輪目標

建立 Manual Historical Source Acquisition Package，讓人工作業者可安全取得 TWSE 2025-09～2026-01 月營收資料，放入 drop-zone 後通過驗證閘門，再進 P26F4 Controlled Import Gate。

---

## 2. P26F3 Recap + P26F3-2 Scope

| Item | Value |
|---|---|
| P26F3 commit | b556473 |
| P26F3 Classification | P26F3_SOURCE_NOT_FOUND_TEMPLATE_ONLY |
| Real source rows | 0 |
| Template rows | 125 |
| DB write | NONE |
| PIT safety | 13/13 PASS |
| Scoring invariance | PASS |
| Quality gate | 12/12 PASS |

P26F3-2 scope: Package-only. No DB write. No corpus change. No scoring change.

---

## 3. Pre-flight 結論

- P26F3 artifacts: 9/9 PRESENT ✅
- Classification confirmed: P26F3_SOURCE_NOT_FOUND_TEMPLATE_ONLY ✅
- Frozen corpus: 60/4500/9900/4500/4500 ✅
- MonthlyRevenue baseline: 2143 rows ✅
- Scoring sha256: frozen ✅
- Status: **PREFLIGHT_PASS**

---

## 4. Manual Source Acquisition Contract v1

Defined at: `outputs/online_validation/p26f3_2_manual_source_acquisition_contract_v1.json`

| Field | Value |
|---|---|
| Target periods | 2025-09 to 2026-01 (5 periods) |
| Target symbols | 25 symbols (P3/P19 distinct set) |
| Accepted formats | CSV, JSON, JSONL |
| dbWriteAllowed | false |
| corpusWriteAllowed | false |
| fabricatedDataAllowed | false |
| PIT gate | releaseDate <= asOfDate |

---

## 5. Drop-zone Package

| File | Status |
|---|---|
| `data/manual/monthly-revenue/p26f3-2-dropzone/README.md` | ✅ Created |
| `data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_SCHEMA.json` | ✅ Created |
| `data/manual/monthly-revenue/p26f3-2-dropzone/.gitkeep` | ✅ Created |

Drop-zone is EMPTY (awaiting human operator to place TWSE data).

---

## 6. Manual Source Scan Result

- Files: 0 (empty drop-zone)
- Classification: **P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY**
- DB write: false | Corpus write: false

---

## 7. Acceptance Validation Result

- Accepted rows: 0 (empty drop-zone)
- Rejected rows: 0
- Classification: P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY
- Ready for P26F4: false (no data yet)

---

## 8. Coverage Preview Result

- Classification: P26F3_2_SOURCE_NOT_PROVIDED
- Coverage: 0/0 (0%)
- Ready for P26F4: false

---

## 9. Safety / No-write Gate

All checks PASS:
- DB MonthlyRevenue row count: 2143 (unchanged) ✅
- Frozen corpus: 60/4500/9900/4500/4500 ✅
- Scoring sha256: unchanged ✅
- Accepted rows outcome fields: 0 violations ✅
- dryRunOnly contract: PASS ✅

**Classification: P26F3_2_SAFETY_GATE_PASS**

---

## 10. Scoring Invariance Gate

- P3+P19 rows: 9000/9000 ✅
- Scoring sha256: PASS ✅
- Accepted source does not enter scoring ✅

**Classification: P26F3_2_SCORING_INVARIANCE_PASS**

---

## 11. Frozen Corpus / DB Write 驗證

| Corpus | Expected | Actual |
|---|---|---|
| simulation_snapshot_corpus.jsonl | 60 | 60 ✅ |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | 4500 ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9900 | 9900 ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | 4500 ✅ |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 | 4500 ✅ |

DB write: NONE | MonthlyRevenue: 2143 rows unchanged

---

## 12. 新增 / 修改檔案清單

**TypeScript Utils:**
- `src/lib/onlineValidation/P26F32ManualSourceAcquisitionContractUtils.ts`
- `src/lib/onlineValidation/P26F32ManualMonthlyRevenueSourceScannerUtils.ts`
- `src/lib/onlineValidation/P26F32ManualSourceAcceptanceValidatorUtils.ts`

**Tests:**
- `src/lib/onlineValidation/__tests__/p26f3_2_manual_source_acquisition_contract_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26f3_2_manual_source_scanner_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26f3_2_manual_source_acceptance_validator_utils.test.ts`

**Drop-zone:**
- `data/manual/monthly-revenue/p26f3-2-dropzone/README.md`
- `data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_SCHEMA.json`
- `data/manual/monthly-revenue/p26f3-2-dropzone/.gitkeep`

**Scripts:**
- `scripts/run-p26f3-2-manual-source-validator.js`
- `scripts/run-p26f3-2-accepted-source-coverage-preview.js`
- `scripts/run-p26f3-2-manual-source-safety-gate.js`
- `scripts/run-p26f3-2-scoring-invariance-check.js`

**Artifacts:**
- `outputs/online_validation/p26f3_2_manual_source_acquisition_preflight.json/md`
- `outputs/online_validation/p26f3_2_manual_source_acquisition_contract_v1.json/md`
- `outputs/online_validation/p26f3_2_manual_source_scan.json/md`
- `outputs/online_validation/p26f3_2_manual_source_acceptance.json/md`
- `outputs/online_validation/p26f3_2_manual_source_manifest.json/md`
- `outputs/online_validation/p26f3_2_accepted_source_coverage_preview.json/md`
- `outputs/online_validation/p26f3_2_manual_source_safety_gate.json/md`
- `outputs/online_validation/p26f3_2_scoring_invariance_check.json/md`

---

## 13. 測試結果

| Suite | Tests | Status |
|---|---|---|
| P26F3-2 Contract Utils | 26 | PASS ✅ |
| P26F3-2 Scanner Utils | 29 | PASS ✅ |
| P26F3-2 Acceptance Validator | 28 | PASS ✅ |
| **New total** | **83** | PASS ✅ |
| **Regression total** | **2718/2718** | PASS ✅ |

---

## 14. TypeScript Validation

`npx tsc --noEmit` → 3 pre-existing errors in `src/app/api/admin/data-quality/route.ts:174`.  
This is a pre-P26 series error, NOT caused by this sprint. All P26F3-2 TypeScript files compile cleanly.

---

## 15. Forbidden Claims Scan

Scan of all P26F3-2 output/source files:
- No ROI / alpha / edge / profit / outperform / beat / buy / sell / guaranteed / investment recommendation claims
- Only allowed mentions: `src/lib/alpha/` file path reference, `alphaScore` field name in corpus checks, disclaimer context
- **CLEAN** ✅

---

## 16. Artifact Validation

All 7 JSON artifacts parse cleanly. All frozen corpus line counts confirmed.

---

## 17. 對 CEO 兩大主軸貢獻

**系統安全性**: Drop-zone acceptance gate + safety gate + scoring invariance gate 確保 TWSE 資料進入前經過完整驗證，不污染 DB 或 corpus。

**資料可信度**: 5-period × 25-symbol target contract 明確定義 real source 標準。Template rows 與 real coverage 嚴格區分，revenueMissing=true 的 template 不可視為 real source。

---

## 18. 風險與不確定點

1. TWSE 資料格式因月份不同可能有欄位差異 — scanner 已處理 CSV/JSON/JSONL 三種格式
2. 官方 releaseDate 可能與推算的 next-month-10th 不同 — contract 要求以官方公告日期為準
3. P26F4 Controlled Import Gate 尚未實作 — 本輪僅產出 readyForP26F4 flag

---

## 19. 下一輪建議

1. 人工從 TWSE/MOPS 下載 2025-09～2026-01 月營收資料，放入 drop-zone
2. 執行 `node scripts/run-p26f3-2-manual-source-validator.js`
3. 若 readyForP26F4=true，進入 P26F4 Controlled Import Gate
4. P26F4 應包含：Prisma migration apply (20260512000000)、DB import gate、PIT-safe upsert

---

## 20. Final Classification

**P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY**

Drop-zone is empty (correct state — no TWSE files placed yet).  
Manual acquisition package is fully operational and ready for use.  
Awaiting human operator to place official TWSE 2025-09～2026-01 monthly revenue data.

---

*Disclaimer: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. No buy/sell recommendations are generated.*
