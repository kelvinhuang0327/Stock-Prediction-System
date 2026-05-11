# P3 Outcome Window Tracker Result

## Run Info
- **reviewDate**: 2026-06-30
- **trackerVersion**: outcome-window-tracker-v1
- **sourceEntryCount**: 2
- **windowCount**: 6
- **validationStatus**: **PASS**

## Windows
| Symbol | Horizon | Target Date | Status | isDue | backfillAllowed |
|---|---|---|---|---|---|
| 2330 | 5D | 2026-05-18 | DUE_FOR_BACKFILL | true | true |
| 2330 | 20D | 2026-06-08 | DUE_FOR_BACKFILL | true | true |
| 2330 | 60D | 2026-08-04 | NOT_DUE | false | false |
| 2454 | 5D | 2026-05-18 | DUE_FOR_BACKFILL | true | true |
| 2454 | 20D | 2026-06-08 | DUE_FOR_BACKFILL | true | true |
| 2454 | 60D | 2026-08-04 | NOT_DUE | false | false |

## Summary
| Field | Value |
|---|---|
| totalWindows | 6 |
| dueCount | **4** |
| notDueCount | 2 |
| blockedCount | 0 |
| overdueCount | 4 |
| symbolsDue | 2330, 2454 |
| earliestDueDate | 2026-05-18 |
| latestDueDate | 2026-06-08 |

---
_Research audit only. No production writes. No trading signals. productionWriteAllowed=false._
