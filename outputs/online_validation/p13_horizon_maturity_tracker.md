# P13 Horizon Maturity Tracker

## Scope

- observability-only tracker
- dry-run analysis only
- no production DB write
- no optimizer write
- no live execution
- no performance claim

## Tracker

- trackerRunId: p13-horizon-maturity-20260511-001
- reviewDate: 2026-07-13
- totalEntries: 60
- maturityStatus: PARTIALLY_MATURE
- validationStatus: PASS

## Horizon Summaries

| horizon | total | ready | blocked | coverage | due | notDue | maturity | topBlockedReason |
|---|---:|---:|---:|---:|---:|---:|---|---|
| 5D | 20 | 8 | 12 | 0.4000 | 20 | 0 | PARTIAL | WINDOW_NOT_DUE |
| 20D | 20 | 5 | 15 | 0.2500 | 20 | 0 | PARTIAL | WINDOW_NOT_DUE |
| 60D | 20 | 1 | 19 | 0.0500 | 0 | 20 | NOT_DUE_DOMINANT | WINDOW_NOT_DUE |

## Dashboard Context

- prior dashboard readiness: BLOCKED
- quality gate: BLOCKED
- warning count: 4

## Notes

- 60D is not due dominant in the current corpus view
- this artifact is not production ready
- this artifact is not optimizer input