# P2-HARDRESET Corpus Field Inspection

**Date:** 2026-05-11
**Audit Mode:** `LIMITED_NON_DISCRIMINATIVE_FIELDS`
**Classification:** `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS`

## P0 Corpus — Score Fields

| Field | Cardinality | Distribution / Values |
|-------|------------|----------------------|
| scoreSnapshot.researchScore | 1 | 0=4500 |
| scoreSnapshot.confidenceScore | 1 | 0=4500 |
| scoreSnapshot.technicalScore | 1 | 0=4500 |
| scoreSnapshot.chipScore | 1 | 0=4500 |
| scoreSnapshot.fundamentalScore | 1 | 0=4500 |
| scoreSnapshot.marketAdjustment | 1 | 0=4500 |

**Score discriminative:** NO — all values are 0 (default)

## P0 Corpus — Bucket Fields

| Field | Cardinality | Distribution / Values |
|-------|------------|----------------------|
| researchBucket | 1 | Neutral=4500 |

**Bucket discriminative:** NO — all values are "Neutral" (default)

## P0 Corpus — Outcome Fields Available

| Field | Present | Cardinality |
|-------|---------|-------------|
| outcomeSnapshot.horizonDays | YES | 3 |
| outcomeSnapshot.returnPct | YES | 3844 |
| outcomeSnapshot.priceSource | YES | 3 |
| outcomeSnapshot.outcomeAvailable | YES | 2 |
| closePriceAtPrediction | YES | 948 |
| symbol | YES | 25 |
| originalAsOfDate | YES | 60 |

## P1 Corpus — Expected Fields

| Field | Present | Cardinality |
|-------|---------|-------------|
| baselineType | YES | 4 |
| symbol | YES | 25 |
| originalAsOfDate | YES | 60 |
| horizonDays | YES | 3 |
| returnPct | YES | 3844 |
| priceSource | YES | 3 |
| duplicateKey | YES | 9900 |

## P0 All Fields (29)

`closePriceAtPrediction`, `corpusRunId`, `createdAt`, `duplicateKey`, `entryPriceSource`, `logVersion`, `originalAsOfDate`, `outcomeSnapshot.horizonDays`, `outcomeSnapshot.horizonLabel`, `outcomeSnapshot.outcomeAvailable`, `outcomeSnapshot.outcomeClose`, `outcomeSnapshot.outcomeDate`, `outcomeSnapshot.priceSource`, `outcomeSnapshot.returnPct`, `researchBucket`, `runId`, `scoreSnapshot.chipScore`, `scoreSnapshot.confidenceScore`, `scoreSnapshot.fundamentalScore`, `scoreSnapshot.marketAdjustment`, `scoreSnapshot.researchScore`, `scoreSnapshot.technicalScore`, `sourceDateBasis.missingDataFlags[]`, `sourceDateBasis.sourceDate`, `sourceDateBasis.sourceType`, `symbol`, `universeTier`, `validationMessages[]`, `writerVersion`

## P1 All Fields (16)

`baselineRunId`, `baselineType`, `createdAt`, `duplicateKey`, `entryPrice`, `horizonDays`, `horizonLabel`, `limitations[]`, `originalAsOfDate`, `outcomeDate`, `outcomePrice`, `priceSource`, `returnPct`, `symbol`, `validationMessages[]`, `writerVersion`

## Audit Mode Decision

**LIMITED_NON_DISCRIMINATIVE_FIELDS**: Bucket field `researchBucket` exists but has cardinality=1 (always "Neutral"). Score fields in `scoreSnapshot` exist but all values are 0. The P0 historical replay corpus was generated with scoring engine in default/zero-output mode. **Downgrading to return distribution + descriptive audit.** Final classification: `P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS`.

---
*Observability-only. Not investment advice.*
