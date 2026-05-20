# P29I Test Baseline

**Phase:** P29I — Quote / Regime / Chip PIT Validation Audit  
**Captured:** 2026-05-20T09:02:21Z  
**Result:** `ALL_PASS`

---

## P29I Test Suite: 33/33 PASS

| Group | Tests | Pass | Fail |
|-------|-------|------|------|
| T01–T15 (scenarios) | 15 | 15 | 0 |
| STRUCT-01–08 (structural) | 8 | 8 | 0 |
| GOV-01–09 (governance) | 9 | 9 | 0 |
| DISC-01 (disclaimer) | 1 | 1 | 0 |
| **Total** | **33** | **33** | **0** |

---

## Regression Suites: 224/224 PASS

| Suite | Tests | Result |
|-------|-------|--------|
| p29f_quote_regime_chip_pit_audit | 60 | ✅ ALL_PASS |
| p29f_repair_quote_chip_pit_date | 30 | ✅ ALL_PASS |
| p29e_paper_simulation_scaffold | 30 | ✅ ALL_PASS |
| p29g_paper_simulation_dry_run_runner | 104 | ✅ ALL_PASS |

---

## Full Suite Baseline: 3348/3348 PASS (109 suites)

- Previous total (pre-P29I): 3315/3315, 108 suites
- P29I adds: +33 tests, +1 suite
- No regressions introduced
