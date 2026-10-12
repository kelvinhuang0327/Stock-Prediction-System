# P3 Backfill Scheduler Plan

## Plan Info
- **planVersion**: backfill-scheduler-v0
- **reviewDate**: 2026-06-30
- **candidateCount**: 6
- **scheduledCount**: **4**
- **skippedCount**: 2
- **blockedCount**: 0
- **validationStatus**: **PASS**

## Scheduled Items (dryRun only)
| Symbol | Horizon | Target Date | Action | dryRun | productionWriteAllowed |
|---|---|---|---|---|---|
| 2330 | 5D | 2026-05-18 | OUTCOME_WRITEBACK_ARTIFACT_ONLY | true | false |
| 2330 | 20D | 2026-06-08 | OUTCOME_WRITEBACK_ARTIFACT_ONLY | true | false |
| 2454 | 5D | 2026-05-18 | OUTCOME_WRITEBACK_ARTIFACT_ONLY | true | false |
| 2454 | 20D | 2026-06-08 | OUTCOME_WRITEBACK_ARTIFACT_ONLY | true | false |

## Skipped Items
| Symbol | Horizon | Status | Reason |
|---|---|---|---|
| 2330 | 60D | NOT_DUE | NOT_DUE: targetTradingDate=2026-08-04 > reviewDate=2026-06-30 |
| 2454 | 60D | NOT_DUE | NOT_DUE: targetTradingDate=2026-08-04 > reviewDate=2026-06-30 |

## Blocked Items
| Symbol | Horizon | Reason |
|---|---|---|
_None_

---
_Artifact-only backfill plan. action=OUTCOME_WRITEBACK_ARTIFACT_ONLY. No production writes. No trading signals._
