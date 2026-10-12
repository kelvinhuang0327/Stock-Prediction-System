# P26F2-HARDRESET: Release Date Population Rule Contract v1

## Version
v1

## Inference Rule

**Rule Name**: INFERRED_NEXT_MONTH_10TH

**Description**: candidateReleaseDate = first day of (year/month + 1 month), specifically the 10th day

**Examples**:
| Year | Month | candidateReleaseDate |
|---|---|---|
| 2026 | 2 | 2026-03-10 |
| 2026 | 3 | 2026-04-10 |
| 2026 | 12 | 2027-01-10 |

**Confidence**: LOW  
**Needs Manual Review**: Yes  
**Verified Official Date**: No

## PIT Safety Rules

| Rule | Value |
|---|---|
| Visibility gate | `candidateReleaseDate <= asOfDate` |
| Null candidate is not visible | ✅ true |
| year/month are NOT visibility gates | ✅ true |
| createdAt is NOT a visibility gate | ✅ true |
| Existing releaseDate not overwritten | ✅ true |

## Dry-Run Contract

| Field | Value |
|---|---|
| outputMode | DRY_RUN_ONLY |
| writeAllowed | ❌ false |
| productionBackfillAllowed | ❌ false |
| corpusOverwriteAllowed | ❌ false |
| databaseWriteAllowed | ❌ false |
| migrationApplyAllowed | ❌ false |
| requiresManualApproval | ✅ true |

## Excluded Scope (all false = excluded)

- DB write: ❌
- Corpus generation: ❌
- Scoring change: ❌
- Optimizer: ❌
- External API: ❌
- Performance claim: ❌

## Status

**CONTRACT_ACTIVE** ✅
