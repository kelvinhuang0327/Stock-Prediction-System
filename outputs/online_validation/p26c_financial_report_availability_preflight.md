# P26C FinancialReport Availability Pre-flight

**Phase:** P26C-HARDRESET  
**Generated:** 2026-05-13

> No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.

## Classification

**`P26C_PREFLIGHT_PASS`**

## P26A/P26B Status

| Property | Value |
|----------|-------|
| p26aClassification | P26A_FEATURE_SNAPSHOT_V1_COMPLETE |
| p26bClassification | P26B_EVENT_NEWS_PIT_CONTEXT_ADAPTER_COMPLETE |
| p26aArtifactsPresent | true |
| p26bArtifactsPresent | true |

## Frozen Corpus (P26A/P26B artifacts)

| File | sha256 |
|------|--------|
| P26AReasonFactorEnrichmentUtils.ts | `b1d8323b399b3bde012aacb8b50a9bed1a0a91eb4f88724b5cc1fa1d89ba46ef` |
| P26BEventNewsPitAdapterUtils.ts | `d918c97e0848aa7db72afd71a497b1409c7ae3049662738e8704c2c1ea8a7ba2` |
| P26BEventNewsPitContractUtils.ts | `9885020023ce5e44aa9554ecaa8edaed990a429d9700d363f568f98fecde6d62` |
| P12FeatureContractV1Utils.ts | `eed17a32458b255ae04525b6bb3ad6bf3585199282f77271e79898a9fce5f2a3` |

## Code Baseline Snapshot (scoring files — must not change)

| File | sha256 |
|------|--------|
| ActiveScoringSnapshotBuilder.ts | `063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d` |
| RuleBasedStockAnalyzer.ts | `bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d` |
| SignalFusionEngine.ts | `b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4` |

## P26C New Artifacts

| File | sha256 |
|------|--------|
| P26CFinancialReportAvailabilityContractUtils.ts | `c01114269bf6c37a43af81a62b0112f1169c56fa3adad8ea67b567101957be13` |
| P26CFinancialReportAvailabilityAdapterUtils.ts | `4bf2a88aa16772cc8dda3350deab4cf0a697f2da0878ce4fbe917134305d80db` |

## Core Rule

FinancialReport is visible iff `availabilityDate <= asOfDate`.

availabilityDate priority: `filingDate → announcementDate → publishedAt → availableAt`

**FORBIDDEN visibility gates:** `periodEndDate`, `fiscalYear`, `fiscalQuarter`, `periodStartDate`, `ingestedAt`, `createdAt`, `updatedAt`
