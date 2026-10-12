# P31 Test Baseline

## P31 New Tests

| Suite | Tests | Status |
|---|---|---|
| p31_monthly_revenue_source_present_dry_run | 64/64 | PASS |

### Describe Groups
- T01 Contract (15 tests)
- T02 Row Gate — BLOCKED cases (7 tests)
- T03 Row Gate — READY case (4 tests)
- T04 Batch Scan (7 tests)
- T05 Contract Row Check (5 tests)
- T06 Forbidden claims (4 tests)
- T07 Determinism (2 tests)
- T08 revenueMonth cannot be availabilityDate (3 tests)
- T09 asOfDate ordering (3 tests)
- T10 Additional edge cases (14 tests)

## Regression Results

| Suite | Tests | Status |
|---|---|---|
| p30 (regression) | 49/49 | PASS |
| p29l (regression) | 96/96 | PASS |
| p29k (regression) | 68/68 | PASS |

## Full Suite

- Total: 3697/3701 PASS
- 4 pre-existing failures (p29d, p26a x2, p27 — not regressions)
- P31 regressions: 0

## Forbidden Diff

`BENIGN` — `prisma/dev.db` and `llm_usage.jsonl` are pre-existing working tree changes present before P31 session started. No P31 code modified these files.
