# P25-HARDRESET: Post-Migration Observability + Active Scoring Smoke — Final Report

**Classification:** `P25_POST_MIGRATION_OBSERVABILITY_COMPLETE`  
**Generated:** 2026-05-12  
**Git Commit:** `e2cc962`  
**Prior Phase:** P24-HARDRESET (MonthlyRevenue production migration execution)

---

## Summary

P25-HARDRESET verifies the post-migration state of the MonthlyRevenue `releaseDate` column:
all 2143 rows were correctly tagged, the PIT query gate enforces the `releaseDate <= asOfDate`
boundary, active scoring smoke passes for all 25 symbol×date combinations, and all supporting
contracts, unit tests, and artifacts are valid.

---

## Part Results

| Part | Description | Result |
|------|-------------|--------|
| A | Pre-flight gate | ✅ 26/26 PASS — `P25_PREFLIGHT_PASS` |
| B | `P25PostMigrationObservabilityUtils.ts` | ✅ 9 functions + constants |
| C | MonthlyRevenue distribution audit | ✅ PASS — 2143/2143 rows, 0 invalid |
| D | Query gate smoke | ✅ 13/13 PASS |
| E | Active scoring smoke | ✅ 25/25 PASS — `smokeStatus=PASS` |
| F | Contract validation | ✅ 31/31 PASS — `warnCount=0` |
| G | Unit tests | ✅ 49/49 PASS |
| H | Forbidden claims scan | ✅ CLEAN — all hits in exempt/disclaimer context |
| I | Artifact validation | ✅ 41/41 PASS — JSON parse + field structure + frozen corpus |
| J | Git commit | ✅ `e2cc962` — 19 files, 4562 insertions |
| K | Final report | ✅ This document |

---

## DB State (Post-Migration)

```
MonthlyRevenue schema post-migration:
  0|id|INTEGER
  1|stockId|TEXT
  2|year|INTEGER
  3|month|INTEGER
  4|revenue|REAL
  5|yoyGrowth|REAL
  6|momGrowth|REAL
  7|createdAt|DATETIME
  8|releaseDate|DATETIME        ← added P24
  9|releaseDateSource|TEXT      ← added P24
 10|releaseDateConfidence|TEXT  ← added P24

Data distribution:
  2026-02 | 1070 rows | releaseDate=2026-03-10 00:00:00.000
  2026-03 | 1073 rows | releaseDate=2026-04-10 00:00:00.000
  Total: 2143 rows
  releaseDateSource: INFERRED_NEXT_MONTH_10TH (all 2143)
  releaseDateConfidence: LOW_TO_MEDIUM (all 2143)
```

---

## PIT Query Gate Verification (Part D)

| Case | Description | Result |
|------|-------------|--------|
| QG-01a | Feb 2026 rows = 0 before 2026-03-10 | PASS |
| QG-01b | Feb 2026 rows = 1070 on 2026-03-10 | PASS |
| QG-02a | Mar 2026 rows = 0 before 2026-04-10 | PASS |
| QG-02b | Mar 2026 rows = 1073 on 2026-04-10 | PASS |
| QG-03  | releaseDateSource uniform | PASS |
| QG-04a/b | filterMonthlyRevenueAvailableAsOf gate | PASS |
| QG-05a/b | Prisma PIT filter boundary | PASS |

---

## Active Scoring Smoke (Part E)

- **Symbols:** 1101, 1102, 1103, 1104, 1108
- **asOf dates:** 2026-03-09, 2026-03-10, 2026-03-15, 2026-04-09, 2026-05-12
- **Entries:** 25 total | **PASS:** 25 | **FAIL:** 0 | **PARTIAL:** 0
- **smokeStatus:** `PASS`
- **MonthlyRevenue PIT gate:**
  - `asOf 2026-03-09` → 5/5 entries correctly exclude Feb MonthlyRevenue
  - `asOf 2026-03-10` → Feb data becomes available via `releaseDate` gate
- **Forbidden fields:** none detected in any snapshot entry
- **Formula unchanged:** `overallScore`, `recommendation`, `reason` returned normally

---

## Frozen Corpus Line Counts (Verified Parts I + F)

| Corpus | Expected | Actual |
|--------|----------|--------|
| `simulation_snapshot_corpus.jsonl` | 60 | ✅ 60 |
| `p0hardreset_historical_replay_corpus.jsonl` | 4500 | ✅ 4500 |
| `p1baseline_historical_replay_corpus.jsonl` | 9900 | ✅ 9900 |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4500 | ✅ 4500 |
| `p19active_scoring_pit_replay_corpus.jsonl` | 4500 | ✅ 4500 |

---

## Output Artifacts

All in `outputs/online_validation/`:

| Artifact | Status |
|----------|--------|
| `p25post_migration_observability_preflight.json` | `P25_PREFLIGHT_PASS` |
| `p25post_migration_observability_preflight.md` | ✅ |
| `p25monthly_revenue_distribution_audit.json` | `PASS` |
| `p25monthly_revenue_distribution_audit.md` | ✅ |
| `p25monthly_revenue_query_gate_smoke.json` | `PASS` (13/13) |
| `p25monthly_revenue_query_gate_smoke.md` | ✅ |
| `p25active_scoring_smoke_after_migration.json` | `PASS` (25/25) |
| `p25active_scoring_smoke_after_migration.md` | ✅ |
| `p25post_migration_contract_validation.json` | `PASS` (31/31) |
| `p25post_migration_contract_validation.md` | ✅ |
| `p25artifact_validation.json` | `PASS` (41/41) |
| `p25post_migration_observability_final_report.md` | ✅ This file |

---

## Source Files

| File | Description |
|------|-------------|
| `src/lib/onlineValidation/P25PostMigrationObservabilityUtils.ts` | 9 utility functions |
| `src/lib/onlineValidation/__tests__/p25post_migration_observability_utils.test.ts` | 49 unit tests |
| `scripts/run-p25-preflight-gate.js` | Part A |
| `scripts/run-p25-monthly-revenue-distribution-audit.js` | Part C |
| `scripts/run-p25-monthly-revenue-query-gate-smoke.js` | Part D |
| `scripts/run-p25-active-scoring-smoke-after-migration.js` | Part E |
| `scripts/validate-p25-post-migration-contract.js` | Part F |
| `scripts/run-p25-artifact-validation.js` | Part I |

---

## Constraint Compliance

| Constraint | Status |
|------------|--------|
| No production migration re-run | ✅ |
| No drop/alter production DB schema | ✅ |
| releaseDate/source/confidence values unchanged | ✅ |
| P0/P1/P3/P4/P19 corpus frozen | ✅ |
| simulation_snapshot_corpus.jsonl frozen (60 lines) | ✅ |
| ManualReview* modules untouched | ✅ |
| Scoring formula / alphaScore / recommendationBucket unchanged | ✅ |
| No outcome/returnPct/realizedReturnClass in smoke judgment | ✅ |
| No external API / LLM calls | ✅ |
| No auto-trading | ✅ |

---

## TypeScript Status

- **Pre-existing errors:** 3 in `src/app/api/admin/data-quality/route.ts` (TS1128/TS1005)
  — pre-existing since P23, not introduced by P25
- **P25 code:** 0 new TypeScript errors

---

## Next Suggested Phase

**P26: Post-Migration Active Scoring Replay Comparison**

Suggested scope:
- Replay the P3/P19 active scoring corpora with and without `releaseDate` gate
- Compare `revenueYoY` field availability before/after gate enforcement
- Measure change in `dataCoverage` distribution across the corpus
- Produce comparison table: coverage levels per asOf month bracket

---

## Disclaimer

This report is for engineering observability and system integrity verification only.
It does not constitute investment advice. No ROI, profit, alpha, win-rate, edge,
or outperformance claims are made or implied. Historical data analysis does not
predict future market outcomes.

---

*Classification: `P25_POST_MIGRATION_OBSERVABILITY_COMPLETE`*
