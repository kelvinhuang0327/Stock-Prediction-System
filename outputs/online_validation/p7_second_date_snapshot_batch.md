# P7 Second-Date Snapshot Batch

**simulationRunId:** p7-second-date-simulation-20260512-001
**sourceReplayRunId:** p7-second-date-replay-fixture-20260512-001
**reviewDate:** 2026-07-01
**dryRun:** true
**inputRecordCount:** 6
**snapshotReadyCount:** 3
**snapshotBlockedCount:** 3

| Symbol | Horizon | Status | Outcome Available | Blocked Reason |
|---|---|---|---|---|
| 2330 | 5D | SNAPSHOT_READY | true | NONE |
| 2330 | 20D | SNAPSHOT_READY | true | NONE |
| 2330 | 60D | SNAPSHOT_BLOCKED | false | WINDOW_NOT_DUE |
| 2454 | 5D | SNAPSHOT_READY | true | NONE |
| 2454 | 20D | SNAPSHOT_BLOCKED | false | OUTCOME_MISSING |
| 2454 | 60D | SNAPSHOT_BLOCKED | false | WINDOW_NOT_DUE |

> Deterministic test fixture. No production writes. No performance claims.
