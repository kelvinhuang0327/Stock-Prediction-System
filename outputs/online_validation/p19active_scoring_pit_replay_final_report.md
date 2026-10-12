# P19-HARDRESET: Active Scoring PIT Replay Corpus — Final Report

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. PIT gate governance documentation only.

**Phase**: P19-HARDRESET  
**Classification**: P19_ACTIVE_SCORING_PIT_REPLAY_COMPLETE  
**Commit**: `bfceb28`  
**Generated**: 2026-05-12  
**Author**: Automated pipeline — productionApplyAllowed=false

---

## 1. Phase Overview

P19-HARDRESET regenerates the active scoring corpus (derived from the P3 base) with full MonthlyRevenue Point-in-Time (PIT) gate metadata applied. The objective is to ensure that no unreleased MonthlyRevenue data can leak into active scoring snapshots, and to verify the corpus is structurally ready for the P20 pre/post-PIT comparison.

---

## 2. Motivation

P17 introduced the Taiwan MonthlyRevenue PIT gate (`MonthlyRevenueAvailability.ts`). P18 performed a dry-run backfill of release dates into the fixture DB. P19 closes the loop by:

1. Classifying every active scoring row's MonthlyRevenue PIT status
2. Adding explicit `monthlyRevenuePitGateStatus` and `monthlyRevenueAvailabilitySummary` to each row
3. Verifying zero look-ahead leakage across 4500 rows

---

## 3. Corpus Dimensions

| Metric | P3 (Base) | P19 (Replay) |
|--------|-----------|--------------|
| Row count | 4500 | 4500 |
| Unique symbols | 25 | 25 |
| Unique asOfDates | 60 | 60 |
| Horizons | {30,60,90} | {30,60,90} |
| COMPLETE rows | 3099 | 3099 |
| PARTIAL rows | 1401 | 1401 |
| COMPLETE+PARTIAL % | 100% | 100% |

---

## 4. MonthlyRevenue PIT Gate Summary

| Status | Count |
|--------|-------|
| NOT_APPLICABLE_NO_DATA | 4500 |
| GATE_PASSED | 0 |
| GATE_REJECTED_UNRELEASED | 0 |
| INFERRED_GATE_PASSED | 0 |
| INFERRED_GATE_REJECTED | 0 |

**Interpretation**: All 4500 P3 base rows have MonthlyRevenue in `missingSources`. No row used MonthlyRevenue in scoring. The PIT gate correctly classifies all as NOT_APPLICABLE_NO_DATA — there is nothing to reject or allow.

---

## 5. Leakage Audit

| Check | Result |
|-------|--------|
| Unreleased MonthlyRevenue used in scoring | 0 violations |
| outcomePrice in activeScoringSnapshot | 0 violations |
| returnPct in activeScoringSnapshot | 0 violations |
| realizedReturnClass in activeScoringSnapshot | 0 violations |
| mock-deterministic priceSource rows | 0 |
| productionDbWritten=true rows | 0 |

---

## 6. Part-by-Part Gate Results

| Part | Description | Gates | Status |
|------|-------------|-------|--------|
| A | Pre-flight | — | PASS |
| B | PIT replay utils TS | — | COMPILED |
| C | Corpus generation | 21/21 | PASS |
| D | MonthlyRevenue PIT guard validation | 14/14 | PASS |
| E | Field inspection + P3 shape comparison | 22/22 | PASS |
| F | Unit tests | 53/53 | PASS |
| G | Forbidden claims scan | — | CLEAN |
| H | Artifact validation | 43/43 | PASS |
| I | Git commit | — | `bfceb28` |
| J | Final report | — | This document |

---

## 7. TypeScript Compilation

```
npx tsc --noEmit
```

Pre-existing errors (not from P19):
- `src/app/api/admin/data-quality/route.ts:174` — TS1128 (pre-existing)
- `src/app/api/admin/data-quality/route.ts:181` — TS1128 (pre-existing)

No P19-sourced TypeScript errors.

---

## 8. Test Coverage

| Suite | Tests | Status |
|-------|-------|--------|
| p19active_scoring_pit_replay_utils.test.ts | 53 | PASS |
| src/lib/onlineValidation/__tests__ (full) | 1615 | PASS |
| src/lib/data/__tests__ | 118 | PASS |

---

## 9. Frozen Corpus Integrity

| Corpus | Expected Lines | Verified |
|--------|---------------|----------|
| simulation_snapshot_corpus.jsonl | 60 | ✓ |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | ✓ |
| p1baseline_historical_replay_corpus.jsonl | 9900 | ✓ |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | ✓ |

All frozen corpus files unchanged after P19 write.

---

## 10. Artifacts Produced

| Artifact | Description |
|----------|-------------|
| `outputs/online_validation/p19active_scoring_pit_replay_preflight.json` | Pre-flight checks |
| `outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl` | 4500-row PIT-annotated corpus |
| `outputs/online_validation/p19active_scoring_pit_replay_summary.json` | Corpus summary + validation |
| `outputs/online_validation/p19active_scoring_pit_replay_summary.md` | Human-readable summary |
| `outputs/online_validation/p19monthly_revenue_pit_guard_validation.json` | PIT guard validation result |
| `outputs/online_validation/p19monthly_revenue_pit_guard_validation.md` | Human-readable guard report |
| `outputs/online_validation/p19active_scoring_pit_replay_field_inspection.json` | Field inspection + P3 shape comparison |
| `outputs/online_validation/p19active_scoring_pit_replay_field_inspection.md` | Human-readable inspection |

---

## 11. New P19 Row Fields

Each P19 row adds the following fields to its P3 base:

```json
{
  "pitReplayRunId": "p19-pit-replay-2026-05-12",
  "pitReplayRunDate": "2026-05-12",
  "pitReplayVersion": "p19-hardreset-v1",
  "universeTierP19": "P19_ACTIVE_SCORING_PIT_REPLAY",
  "productionApplyAllowed": false,
  "productionDbWritten": false,
  "monthlyRevenuePitGateStatus": "NOT_APPLICABLE_NO_DATA",
  "monthlyRevenueAvailabilitySummary": {
    "pitGateStatus": "NOT_APPLICABLE_NO_DATA",
    "releaseDate": null,
    "releaseDateSource": null,
    "releaseDateConfidence": null,
    "inferred": false,
    "reason": "No MonthlyRevenue record available for this symbol/asOfDate",
    "dataPresent": false,
    "usedInScoring": false
  }
}
```

---

## 12. Schema Compatibility with P3

- schemaCompatible: **true**
- shapeCompatibility: **COMPATIBLE**
- p19ReadyForP20Comparison: **true**

P19 preserves all P3 core fields and adds P19-specific PIT gate metadata. The two corpora can be joined on `(symbol, originalAsOfDate, horizonDays)` for P20 pre/post analysis.

---

## 13. Forbidden Claims Audit

Grep scan of all P19 artifacts and scripts for: ROI | win-rate | win rate | outperform | beat the market | guaranteed | profit | investment recommendation.

**Result**: Zero substantive matches. All matches were in DISCLAIMER lines or scanner pattern definition strings.

---

## 14. Production Safety Guarantees

| Guarantee | Status |
|-----------|--------|
| productionApplyAllowed=false in all rows | ✓ |
| productionDbWritten=false in all rows | ✓ |
| No writes to production DB | ✓ |
| Scoring formula unchanged | ✓ |
| alphaScore formula unchanged | ✓ |
| recommendationBucket logic unchanged | ✓ |
| Frozen corpus unchanged | ✓ |
| Math.random not used (deterministic) | ✓ |

---

## 15. Prior Phase Chain

| Phase | Commit | Status |
|-------|--------|--------|
| P17: MonthlyRevenue PIT gate helper | — | COMPLETE |
| P18: Fixture DB backfill dry-run | `33eec5b`, `2c482c3` | COMPLETE |
| **P19: Active scoring PIT replay** | **`bfceb28`** | **COMPLETE** |

---

## 16. Next Steps (P20+)

| Phase | Description |
|-------|-------------|
| P20 | Pre/post PIT MonthlyRevenue availability impact comparison |
| P21 | Production migration approval review |
| P22 | NewsEvent PIT contract repair |

P19 corpus is ready as the "post-PIT" baseline for P20.

---

## 17. Final Classification

**P19_ACTIVE_SCORING_PIT_REPLAY_COMPLETE**

- Corpus: 4500 rows, 25 symbols, 60 dates, 3 horizons
- PIT gate violations: 0
- Leakage violations: 0
- Tests: 53 new + 1615 regression all PASS
- Frozen corpus: unchanged
- Production writes: 0
- Commit: `bfceb28`
