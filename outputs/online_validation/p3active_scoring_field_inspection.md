# P3-HARDRESET Active Scoring Corpus — Field Inspection

Generated: 2026-05-11T14:34:41.881Z
Corpus: `p3active_scoring_historical_replay_corpus.jsonl`
Invariant checks: **PASS**

## Corpus Meta

| Field | Value |
|-------|-------|
| Total lines | 4500 |
| Unique symbols | 25 |
| Unique asOfDates | 60 |
| Parse errors | 0 |

## Research Bucket Distribution

| Bucket | Count | % |
|--------|-------|---|
| LowPriority | 1158 | 25.7% |
| Watch | 462 | 10.3% |
| Neutral | 1401 | 31.1% |
| Strong | 1479 | 32.9% |

## Scoring Completeness Distribution

| Status | Count | % |
|--------|-------|---|
| COMPLETE | 3099 | 68.9% |
| PARTIAL | 1401 | 31.1% |

## researchScore Coverage

- Non-zero: **4500/4500** (100.0%)
- Min: 21.0
- Max: 94.0
- Mean: 59.7

| Range | Count |
|-------|-------|
| 0 | 0 |
| 1-25 | 282 |
| 26-50 | 1338 |
| 51-75 | 1581 |
| 76-100 | 1299 |

## Core Field Presence

| Field | Count | Coverage |
|-------|-------|----------|
| `duplicateKey` | 4500 | 100.0% |
| `symbol` | 4500 | 100.0% |
| `originalAsOfDate` | 4500 | 100.0% |
| `createdAt` | 4500 | 100.0% |
| `researchBucket` | 4500 | 100.0% |
| `scoreSnapshot` | 4500 | 100.0% |
| `entryPriceSource` | 4500 | 100.0% |
| `closePriceAtPrediction` | 4500 | 100.0% |
| `outcomeSnapshot` | 4500 | 100.0% |
| `validationMessages` | 4500 | 100.0% |
| `scoringCompletenessStatus` | 4500 | 100.0% |
| `activeScoringSnapshot` | 4500 | 100.0% |

## activeScoringSnapshot Coverage

Present on: **4500/4500** (100.0%)
Non-zero alphaScore: **4500** (100.0% of snapshots)

### Snapshot Sub-field Presence

| Field | Count | Coverage (of snapshots) |
|-------|-------|--------------------------|
| `builderVersion` | 4500 | 100.0% |
| `scoringMode` | 4500 | 100.0% |
| `scoringEngineSource` | 4500 | 100.0% |
| `researchBucket` | 4500 | 100.0% |
| `alphaScore` | 4500 | 100.0% |
| `scoreSnapshot` | 4500 | 100.0% |
| `signalSnapshot` | 4500 | 100.0% |
| `factorSnapshot` | 4500 | 100.0% |
| `reasonSnapshot` | 4500 | 100.0% |
| `limitations` | 4500 | 100.0% |
| `dataCoverage` | 4500 | 100.0% |
| `dataPoints` | 4500 | 100.0% |
| `usedSources` | 4500 | 100.0% |
| `missingSources` | 4500 | 100.0% |
| `pitGateDate` | 4500 | 100.0% |
| `scoringAvailable` | 4500 | 100.0% |
| `completenessStatus` | 4500 | 100.0% |
| `scoringNote` | 4500 | 100.0% |

### scoreSnapshot Field Stats

| Field | Min | Max | Mean | Non-zero |
|-------|-----|-----|------|----------|
| `researchScore` | 21.0 | 94.0 | 59.7 | 4500 |
| `confidenceScore` | 0.0 | 0.0 | 0.0 | 0 |
| `technicalScore` | 8.0 | 100.0 | 56.8 | 4500 |
| `chipScore` | 50.0 | 80.0 | 65.9 | 4500 |
| `fundamentalScore` | 0.0 | 0.0 | 0.0 | 0 |
| `marketAdjustment` | 0.0 | 0.0 | 0.0 | 0 |

### factorSnapshot: 4500/4500 entries have factors (100.0%)

- Min factors per entry: 10
- Max factors per entry: 10
- Mean factors per entry: 10.0

### signalSnapshot: 4500/4500 entries

- `MA 趨勢`: 4500
- `RSI(14)`: 4500
- `MACD`: 4500
- `近 20 日動能`: 4500
- `近 5 日報酬`: 4500
- `近 20 日報酬`: 4500
- `量能變化`: 4500
- `波動率`: 4500
- `近期最大回撤`: 4500
- `法人近 10 日買超`: 4500

### reasonSnapshot: 4500/4500 entries

- `技術偏空`: 540
- `技術偏多`: 900
- `技術偏多 / 動能轉強 / 法人買超`: 618
- `法人買超`: 321
- `動能走弱 / 法人買超`: 360
- `技術偏空 / 動能走弱 / 法人買超`: 195
- `技術偏多 / 動能走弱`: 180
- `動能走弱`: 39
- `資料觀察中`: 39
- `技術偏多 / 法人買超`: 462
- `技術偏空 / 法人買超`: 423
- `技術偏空 / 動能走弱`: 423

## Outcome Distribution

| priceSource | Count | % |
|-------------|-------|---|
| stockQuote.close | 4204 | 93.4% |
| MISSING | 271 | 6.0% |
| PENDING | 25 | 0.6% |

returnPct coverage: 4204/4500

## Horizon Distribution

| Horizon | Count |
|---------|-------|
| 5 | 1500 |
| 20 | 1500 |
| 60 | 1500 |

## Invariant Checks

| Check | Result |
|-------|--------|
| forbiddenFields | PASS |
| malformedDuplicateKey | PASS (0) |
| malformedCreatedAt | PASS (0) |
| pitViolations | PASS (0) |

**Overall: PASS**

---
*P3-HARDRESET PART E — Not investment advice.*