# P4 Replay Run Result

## Run Info
- **replayEngineVersion**: pit-safe-replay-engine-v0
- **replayRunId**: p4-ledger-replay-20260511-001
- **mode**: ELIGIBILITY_AUDIT
- **dryRun**: true
- **productionWriteAllowed**: false
- **simulationWriteAllowed**: false
- **validationStatus**: **PASS**

## Eligible Records
| Symbol | Horizon | Target Date | outcomeAvailable |
|---|---|---|---|
| 2330 | 5D | 2026-05-18 | true |
| 2330 | 20D | 2026-06-08 | true |
| 2454 | 5D | 2026-05-18 | true |

## Blocked Records
| Symbol | Horizon | Blocked Reason |
|---|---|---|
| 2330 | 60D | WINDOW_NOT_DUE |
| 2454 | 20D | OUTCOME_MISSING |
| 2454 | 60D | WINDOW_NOT_DUE |

## Audit Summary
| Metric | Value |
|---|---|
| inputRecordCount | 6 |
| replayEligibleCount | **3** |
| replayBlockedCount | 3 |
| missingOutcomeCount | 1 |
| notDueCount | 2 |
| pitViolationCount | 0 |

---
_Research audit only. dryRun=true. No production writes. No trading signals._
