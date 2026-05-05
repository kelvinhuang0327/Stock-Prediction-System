# GBGF Real Stock Batch Evaluation — P3-07

**Run date:** 2026-05-05 06:08 UTC
**As-of date:** 2026-05-01
**Pipeline:** P3-07

## Summary

| Field | Value |
|-------|-------|
| Symbols evaluated | 1 |
| Hypotheses | 3 |
| Windows | [150, 500] |
| Total tests | 6 |
| Valid tests | 5 |
| Passed PIT guard | 6 |
| Data insufficient | 1 |
| Avg Sharpe | +2.1131 |
| Avg ROI | -0.0564 |
| Permutation pass rate | 0.00% |
| BH-FDR passes | 0 |
| Leakage violations | 0 |
| Promoted candidates | 0 |
| Rejected | 3 |

## Promoted Candidates

_None — no hypothesis met all promotion criteria_

## Final Classification

**REAL_BATCH_EVALUATION_DATA_INSUFFICIENT**

## Safety

- Read-only access to prisma/dev.db
- No production write
- No trade execution
- PIT guard R01–R04 enforced
- BH-FDR correction applied globally
- Time-based split only (no random split)

_Not a trading recommendation._