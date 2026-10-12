# P14 Outcome Backfill Candidate Selection

## Scope

- artifact-only rehearsal selection
- observability-only
- no production DB write
- no corpus write
- no optimizer write
- no live execution

## Selection

- selectorRunId: p14-outcome-backfill-selector-20260511-001
- selectedCount: 3
- skippedCount: 57
- validationStatus: PASS
- prior maturity status: PARTIALLY_MATURE
- prior recovery status: DATA_LIMITED

## Summary

- symbolsSelected: 2454
- earliestTargetTradingDate: 2026-06-08
- latestTargetTradingDate: 2026-06-10

## Notes

- only 5D / 20D are eligible by default
- 60D remains excluded unless explicitly enabled