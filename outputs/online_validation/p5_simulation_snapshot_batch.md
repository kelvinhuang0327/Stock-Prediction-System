# P5 Simulation Snapshot Batch

## Run Info
- **simulationRunId**: p5-replay-simulation-20260511-001
- **simulationBatchVersion**: sim-batch-v0
- **mode**: SNAPSHOT_ONLY
- **dryRun**: true
- **sourceReplayRunId**: p4-ledger-replay-20260511-001
- **inputRecordCount**: 6
- **snapshotReadyCount**: **3**
- **snapshotBlockedCount**: 3
- **validationStatus**: PASS

## Snapshots
| Symbol | Horizon | Status | outcomeAvailable | Blocked Reason |
|---|---|---|---|---|
| 2330 | 5D | SNAPSHOT_READY | true | NONE |
| 2330 | 20D | SNAPSHOT_READY | true | NONE |
| 2330 | 60D | SNAPSHOT_BLOCKED | false | WINDOW_NOT_DUE |
| 2454 | 5D | SNAPSHOT_READY | true | NONE |
| 2454 | 20D | SNAPSHOT_BLOCKED | false | OUTCOME_MISSING |
| 2454 | 60D | SNAPSHOT_BLOCKED | false | WINDOW_NOT_DUE |

## Summary
| Field | Value |
|---|---|
| readyCount | **3** |
| blockedCount | 3 |
| symbolCount | 2 |
| outcomeAvailableCount | 3 |
| missingOutcomeCount | 3 |

---
_Research audit only. No production writes. No trading signals. productionWriteAllowed=false. simulationWriteAllowed=false. optimizerWriteAllowed=false._
