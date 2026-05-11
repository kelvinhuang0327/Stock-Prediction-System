# P4 Replay Dataset Summary

```json
{
  "totalRecords": 6,
  "eligibleCount": 3,
  "blockedCount": 3,
  "byHorizon": {
    "5D": 2,
    "20D": 2,
    "60D": 2
  },
  "byWindowStatus": {
    "DUE_FOR_BACKFILL": 4,
    "NOT_DUE": 2
  },
  "byOutcomeStatus": {
    "READY_FOR_REVIEW": 3,
    "NOT_DUE": 2,
    "MISSING_PRICE": 1
  },
  "byReplayBlockedReason": {
    "NONE": 3,
    "WINDOW_NOT_DUE": 2,
    "OUTCOME_MISSING": 1
  },
  "symbolCount": 2,
  "earliestAsOfDate": "2026-05-11",
  "latestAsOfDate": "2026-05-11",
  "earliestTargetTradingDate": "2026-05-18",
  "latestTargetTradingDate": "2026-08-04"
}
```

_Research audit only. productionWriteAllowed=false. simulationWriteAllowed=false._
