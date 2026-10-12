# P4 Replay Dataset Result

## Run Info
- **replayRunId**: p4-ledger-replay-20260511-001
- **replayDatasetVersion**: replay-dataset-v0
- **reviewDate**: 2026-06-30
- **totalRecords**: 6
- **eligibleCount**: **3**
- **blockedCount**: 3
- **validationStatus**: **PASS**

## Records
| Symbol | Horizon | Target Date | Window Status | Outcome Status | Eligible | Blocked Reason |
|---|---|---|---|---|---|---|
| 2330 | 5D | 2026-05-18 | DUE_FOR_BACKFILL | READY_FOR_REVIEW | true | NONE |
| 2330 | 20D | 2026-06-08 | DUE_FOR_BACKFILL | READY_FOR_REVIEW | true | NONE |
| 2330 | 60D | 2026-08-04 | NOT_DUE | NOT_DUE | false | WINDOW_NOT_DUE |
| 2454 | 5D | 2026-05-18 | DUE_FOR_BACKFILL | READY_FOR_REVIEW | true | NONE |
| 2454 | 20D | 2026-06-08 | DUE_FOR_BACKFILL | MISSING_PRICE | false | OUTCOME_MISSING |
| 2454 | 60D | 2026-08-04 | NOT_DUE | NOT_DUE | false | WINDOW_NOT_DUE |

## Summary
| Field | Value |
|---|---|
| eligibleCount | **3** |
| blockedCount | 3 |
| symbolCount | 2 |
| earliestAsOfDate | 2026-05-11 |
| latestTargetTradingDate | 2026-08-04 |

---
_Research audit only. No production writes. No trading signals. productionWriteAllowed=false. simulationWriteAllowed=false._
