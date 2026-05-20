# P29G Test Baseline

**Phase:** P29G — Paper Simulation Dry-run Runner  
**Captured:** 2026-05-15  
**Runner:** `npx jest src/lib/onlineValidation/__tests__ --no-coverage`

## Test Results

| Metric | Value |
|--------|-------|
| Test Suites | 108 |
| Tests | 3315 |
| Passed | 3315 |
| Failed | 0 |

## Delta from P29H Baseline

| Metric | Delta |
|--------|-------|
| Suites | +1 (107 → 108) |
| Tests | +76 (3239 → 3315) |

New test suite: `p29g_paper_simulation_dry_run_runner.test.ts` (76 tests)

## P29G Test Groups

| Group | Description | Count |
|-------|-------------|-------|
| P29G-T01 | Input contract — paperOnly=true required | ✅ |
| P29G-T02 | Input contract — dryRun=true required | ✅ |
| P29G-T03 | Input contract — notInvestmentRecommendation=true required | ✅ |
| P29G-T04 | Forbidden action fields rejected from input | ✅ |
| P29G-T05 | Runner output — paperOnly enforced | ✅ |
| P29G-T06 | Runner output — dryRun enforced | ✅ |
| P29G-T07 | Runner output — all mutation flags false | ✅ |
| P29G-T08 | Leakage gate passes on every output | ✅ |
| P29G-T09 | No forbidden performance fields in output | ✅ |
| P29G-T10 | FinancialReport remains HIGH_RISK_SOURCE_ABSENT | ✅ |
| P29G-T11 | NewsEvent remains HIGH_RISK_SOURCE_ABSENT | ✅ |
| P29G-T12 | HIGH_RISK sources do not enter alphaScore | ✅ |
| P29G-T13 | Quote/Regime/Chip PIT_SAFE_VERIFIED representation | ✅ |
| P29G-T14 | Output determinism | ✅ |
| P29G-T15 | Output serializability | ✅ |
| P29G-T16 | No DB / corpus write | ✅ |
| P29G-T17 | P29G source files — no forbidden imports | ✅ |
| P29G-T18 | P29G source files — no forbidden performance claims | ✅ |
| P29G-T19 | Report — no performance claims | ✅ |
| P29G-T20 | Report governance flags | ✅ |
| P29G-T21 | Source coverage summary in report | ✅ |
| P29G-T22 | resolveSourceClassifications merging | ✅ |
| P29G-T23 | Runner throws for null config | ✅ |
| P29G-T24 | Input asOfDate format | ✅ |
| P29G-T25 | BLOCKED source alphaScore gating | ✅ |

**Overall: ALL 76 P29G TESTS PASS. ALL 3315 TOTAL TESTS PASS.**
