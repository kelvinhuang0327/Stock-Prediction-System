# P26E Data Coverage / Corpus Expansion Gate v2 — Final Report

**Phase**: P26E-HARDRESET  
**Date**: 2026-05-13  
**Final Classification**: P26E_PARTIAL_SOURCE_MAPPING_REQUIRED

---

## 1. 本輪目標

P26E 目標：掃描 MonthlyRevenue、NewsEvent、FinancialReport 的 source readiness，建立 Data Coverage / Corpus Expansion Gate v2，以機器可讀格式輸出是否可以進入 corpus expansion 實作。**NOTHING in scoring must change。**

---

## 2. P26A/B/C/D Recap + P26E Scope

| Sprint | 成果 |
|--------|------|
| P26A | MonthlyRevenue reason enrichment (24→9 generic), 9000/0 scoring invariance |
| P26B | NewsEvent PIT adapter, publishedAt=gate, 10/10 leakage PASS |
| P26C | FinancialReport availability contract, availabilityDate priority chain, 13/13 PASS |
| P26D | Targeted replay coverage, P3+P19=9000 verified, 0 scoring mismatch, readinessForP26E=partial |
| **P26E** | Data Coverage Gate Contract v2, source mapping scan, coverage ratio scan, readiness classifier |

P26E 不做：corpus 重新生成、scoring 修改、optimizer 授權、external API、production DB 寫入。

---

## 3. Pre-flight 結論

- **Status**: PREFLIGHT_PASS ✅
- 所有 P26A/B/C/D artifacts 存在
- Corpus counts: 60/4500/9900/4500/4500 ✅
- Frozen scoring file sha256 已確認

---

## 4. Data Coverage Gate Contract v2

- **合約版本**: v2
- **Source States (7)**: REAL_DATA_READY, REAL_DATA_PRESENT_BUT_NOT_MAPPED, FIXTURE_ONLY, MISSING_SOURCE, PIT_GATE_READY_NO_SOURCE, BLOCKED_BY_CONTRACT, UNKNOWN_REQUIRES_MANUAL_MAPPING
- **Expansion Readiness (6)**: READY_FOR_EXPANSION_IMPLEMENTATION, PARTIAL_SOURCE_MAPPING_REQUIRED, FIXTURE_ONLY_NOT_READY, BLOCKED_BY_MISSING_SOURCE, BLOCKED_BY_PIT_CONTRACT, BLOCKED_BY_SCORING_INVARIANCE
- **Excluded Scope**: noCorpusGeneration, noScoringChange, noOptimizer, noProductionDbWrite, noExternalApi, noPerformanceClaim — 全部 true ✅

---

## 5. Source Mapping Scan 結果

| Source | sourceState | pitGateField | fixtureFound | realCandidates |
|--------|-------------|-------------|--------------|----------------|
| MonthlyRevenue | REAL_DATA_PRESENT_BUT_NOT_MAPPED | releaseDate | false | prisma/schema.prisma, src/lib/data/*.ts |
| NewsEvent | FIXTURE_ONLY | publishedAt | true | none |
| FinancialReport | FIXTURE_ONLY | availabilityDate | true | none |

- allReadOnly: true ✅
- anyOutcomeFieldsDetected: false ✅

---

## 6. Coverage Ratio Scan 結果

| Source | Coverage in P3/P19 | Ratio | Classification |
|--------|-------------------|-------|---------------|
| MonthlyRevenue | 0 rows | 0 | NONE |
| NewsEvent | N/A (fixture-only) | 0 | NONE |
| FinancialReport | N/A (fixture-only) | 0 | NONE |

- MonthlyRevenue 有 real source 但 corpus 中尚無 context field
- Fixture-only sources 標記 fixtureCoverageOnly=true，不計入 real corpus coverage
- outcomeFieldsInSummary: false ✅

---

## 7. Corpus Expansion Readiness Classification

| Source | Readiness | Recommended Next |
|--------|----------|-----------------|
| MonthlyRevenue | PARTIAL_SOURCE_MAPPING_REQUIRED | P26F_MONTHLY_REVENUE_CORPUS_EXPANSION_IMPLEMENTATION |
| NewsEvent | FIXTURE_ONLY_NOT_READY | P26E_2_SOURCE_ACQUISITION_PLAN |
| FinancialReport | FIXTURE_ONLY_NOT_READY | P26E_2_SOURCE_ACQUISITION_PLAN |
| **Overall** | **PARTIAL_SOURCE_MAPPING_REQUIRED** | **P26F_MONTHLY_REVENUE_CORPUS_EXPANSION_IMPLEMENTATION** |

---

## 8. Gate Runner Result

- P3 Corpus Rows: 4500
- P19 Corpus Rows: 4500
- monthlyRevenueContextInCorpus: 0
- newsEventContextInCorpus: 0
- financialReportContextInCorpus: 0
- noOutcomeFieldsInCorpus: **true** ✅
- **scoringChangeAllowed: false** ✅
- **optimizerAllowed: false** ✅
- **Status: PASS** ✅

---

## 9. Scoring Invariance Gate

- Total rows: 9000 (P3: 4500, P19: 4500)
- mismatchedAlphaScoreCount: **0** ✅
- mismatchedBucketCount: **0** ✅
- scoringPathSha256Unchanged: **true** ✅
- readOnlyContextsEnterAlphaScore: **false** ✅
- **Status: SCORING_INVARIANCE_PASS** ✅

| File | SHA256 Match |
|------|-------------|
| ActiveScoringSnapshotBuilder.ts | ✅ MATCH |
| RuleBasedStockAnalyzer.ts | ✅ MATCH |
| SignalFusionEngine.ts | ✅ MATCH |

---

## 10. Frozen Corpus 驗證

| Corpus | Rows |
|--------|------|
| simulation_snapshot_corpus.jsonl | 60 ✅ |
| p0hardreset_historical_replay_corpus.jsonl | 4500 ✅ |
| p1baseline_historical_replay_corpus.jsonl | 9900 ✅ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 ✅ |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 ✅ |

---

## 11. 修改/新增檔案清單

### 新增 TypeScript 源碼
- `src/lib/onlineValidation/P26EDataCoverageExpansionGateContractUtils.ts`
- `src/lib/onlineValidation/P26ESourceMappingScannerUtils.ts`
- `src/lib/onlineValidation/P26ECoverageRatioScannerUtils.ts`
- `src/lib/onlineValidation/P26ECorpusExpansionReadinessClassifierUtils.ts`

### 新增測試
- `src/lib/onlineValidation/__tests__/p26e_data_coverage_expansion_gate_contract_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26e_source_mapping_scanner_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26e_coverage_ratio_scanner_utils.test.ts`
- `src/lib/onlineValidation/__tests__/p26e_corpus_expansion_readiness_classifier_utils.test.ts`

### 新增腳本
- `scripts/run-p26e-data-coverage-expansion-gate.js`
- `scripts/run-p26e-scoring-invariance-check.js`
- `scripts/generate-p26e-contract.js`
- `scripts/generate-p26e-aux.js`

### 新增 Outputs
- `outputs/online_validation/p26e_data_coverage_expansion_gate_preflight.json`
- `outputs/online_validation/p26e_data_coverage_expansion_gate_preflight.md`
- `outputs/online_validation/p26e_data_coverage_expansion_gate_contract_v2.json`
- `outputs/online_validation/p26e_data_coverage_expansion_gate_contract_v2.md`
- `outputs/online_validation/p26e_source_mapping_scan.json`
- `outputs/online_validation/p26e_source_mapping_scan.md`
- `outputs/online_validation/p26e_coverage_ratio_scan.json`
- `outputs/online_validation/p26e_coverage_ratio_scan.md`
- `outputs/online_validation/p26e_corpus_expansion_readiness.json`
- `outputs/online_validation/p26e_corpus_expansion_readiness.md`
- `outputs/online_validation/p26e_data_coverage_expansion_gate_result.json`
- `outputs/online_validation/p26e_data_coverage_expansion_gate_result.md`
- `outputs/online_validation/p26e_scoring_invariance_check.json`
- `outputs/online_validation/p26e_scoring_invariance_check.md`
- `outputs/online_validation/p26e_data_coverage_corpus_expansion_gate_final_report.md`

---

## 12. 測試結果

| Test Suite | Tests | Status |
|------------|-------|--------|
| p26e_data_coverage_expansion_gate_contract_utils | 9 | ✅ PASS |
| p26e_source_mapping_scanner_utils | 9 | ✅ PASS |
| p26e_coverage_ratio_scanner_utils | 10 | ✅ PASS |
| p26e_corpus_expansion_readiness_classifier_utils | 13 | ✅ PASS |
| **All onlineValidation tests** | **2349** | **✅ PASS** |
| data tests | 118 | ✅ PASS |

Total new tests: **41** (9+9+10+13)

---

## 13. TypeScript Validation

Pre-existing error (DO NOT FIX):
- `src/app/api/admin/data-quality/route.ts:174` — TS1128/TS1005 (pre-existing, unrelated to P26E)

No new TypeScript errors introduced.

---

## 14. Forbidden Claims Scan

Matches found: alphaScore field references, `src/lib/alpha` path reference, and disclaimer statement "No ROI / win-rate / profit / outperform / buy / sell claims" — all **explicitly allowed**.

**Result: PASS** ✅

---

## 15. Artifact Validation

All 7 P26E JSON files parse successfully:
- p26e_corpus_expansion_readiness.json ✅
- p26e_coverage_ratio_scan.json ✅
- p26e_data_coverage_expansion_gate_contract_v2.json ✅
- p26e_data_coverage_expansion_gate_preflight.json ✅
- p26e_data_coverage_expansion_gate_result.json ✅
- p26e_scoring_invariance_check.json ✅
- p26e_source_mapping_scan.json ✅

---

## 16. 對 CEO 兩大主軸貢獻

### 主軸 A: Source Readiness Machine-Readable Gate
P26E 建立了 MonthlyRevenue / NewsEvent / FinancialReport 的 source readiness 掃描框架：
- MonthlyRevenue: Prisma schema + src/lib/data/ 實體存在 → REAL_DATA_PRESENT_BUT_NOT_MAPPED
- NewsEvent: fixture-only (6 events from P26B) → FIXTURE_ONLY
- FinancialReport: fixture-only (8 reports from P26C) → FIXTURE_ONLY
所有結果以 JSON 機器可讀格式輸出，可直接作為 P26F gate condition。

### 主軸 B: 判斷是否可進 Corpus Expansion Implementation
- MonthlyRevenue: 源碼存在但需 source mapping connector → **PARTIAL_SOURCE_MAPPING_REQUIRED** → 可進 P26F
- NewsEvent / FinancialReport: fixture-only → **FIXTURE_ONLY_NOT_READY** → 需另行 source acquisition
- Overall: **PARTIAL_SOURCE_MAPPING_REQUIRED** — P26E gate 完整執行，MonthlyRevenue 可進 P26F

---

## 17. 風險與不確定點

1. MonthlyRevenue 雖有 Prisma model，但 realSourceCandidates 是基於檔案掃描 — 實際 DB 資料量未知
2. NewsEvent / FinancialReport 只有 fixture — 需額外 source acquisition 計畫
3. Corpus 中 monthlyRevenueContext=0 — P26F 需建立 context populator

---

## 18. 下一輪建議

**P26F: MonthlyRevenue Corpus Expansion Implementation**
- 前提：MonthlyRevenue Prisma model 已確認存在 (releaseDate PIT gate)
- 目標：建立 MonthlyRevenue → corpus context populator
- 在 P3/P19 corpus 中填充 monthlyRevenueContext
- 驗證 symbol + releaseDate join，確認 PIT compliance
- 不做 scoring 修改，不做 optimizer 授權

---

## 19. Final Classification

**P26E_PARTIAL_SOURCE_MAPPING_REQUIRED**

理由：
- P26E Gate 本身已完整執行 (gate is COMPLETE)
- MonthlyRevenue 有 real source → PARTIAL_SOURCE_MAPPING_REQUIRED (source exists, mapping incomplete)
- NewsEvent + FinancialReport → FIXTURE_ONLY_NOT_READY (不阻擋 P26E 完成)
- scoringChangeAllowed=false, optimizerAllowed=false 已驗證
- 推薦進入 P26F: MonthlyRevenue Corpus Expansion Implementation
