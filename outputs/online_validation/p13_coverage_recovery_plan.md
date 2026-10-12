# P13 Coverage Recovery Plan

## Scope

- observability-only recovery plan
- dry-run planning only
- no production DB write
- no optimizer write
- no live execution
- no performance claim

## Plan

- recoveryRunId: p13-coverage-recovery-20260511-001
- recoveryStatus: DATA_LIMITED
- currentCoverageRatio: 0.23333333333333334
- targetCoverageRatio: 0.5
- currentHorizonCoverageGap: 0.35
- targetHorizonCoverageGap: 0.35
- currentUniqueAsOfDateCount: 10
- targetUniqueAsOfDateCount: 10

## Horizon Recovery Items

| horizon | currentCoverage | targetCoverage | blocked | topBlockedReason | recoveryNeed | nextStep |
|---|---:|---:|---:|---|---|---|
| 5D | 0.4000 | 0.5000 | 12 | WINDOW_NOT_DUE | WAIT_FOR_MATURITY | Hold 5D until target dates mature |
| 20D | 0.2500 | 0.5000 | 15 | WINDOW_NOT_DUE | WAIT_FOR_MATURITY | Hold 20D until target dates mature |
| 60D | 0.0500 | 0.5000 | 19 | WINDOW_NOT_DUE | WAIT_FOR_MATURITY | Hold 60D until target dates mature |

## Blockers

- coverageRatio=0.2333 is below targetCoverageRatio=0.5000
- 60D horizon is not due dominant

## Recommended Actions

- Wait for more outcomes to settle before reevaluating coverage.