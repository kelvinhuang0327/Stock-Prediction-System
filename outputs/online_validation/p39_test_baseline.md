# P39 — Test Baseline

**Phase:** P39 — Paper Simulation Input Contract for Eligible Sources  
**Run at:** 2026-05-21  
**Runner:** Jest

---

## P39 Test Suite

| File | Total | Pass | Fail |
|------|-------|------|------|
| `p39_paper_simulation_input_contract.test.ts` | **77** | **77** | **0** |

### Groups
| Group | Tests | Pass |
|-------|-------|------|
| 1 — Bundle governance invariants | 8 | 8 |
| 2 — Mode and version | 5 | 5 |
| 3 — MonthlyRevenue is eligible | 5 | 5 |
| 4 — Quote is eligible | 5 | 5 |
| 5 — Regime is eligible | 4 | 4 |
| 6 — Blocked sources are explicitly blocked | 8 | 8 |
| 7 — Validator accepts valid bundle | 4 | 4 |
| 8 — Validator rejects invalid bundles | 10 | 10 |
| 9 — buildPaperSimulationInputBundle from P38 entries | 5 | 5 |
| 10 — Default bundle structure | 7 | 7 |
| 11 — Forbidden fields and uses constants | 10 | 10 |
| 12 — Isolation and governance | 6 | 6 |
| **TOTAL** | **77** | **77** |

---

## Regression Suites

| Suite | Total | Pass | Fail |
|-------|-------|------|------|
| P38 — SimulationInputReadinessMapping | 55 | 55 | 0 |
| P37 — MonthlyRevenue Consumer Integration Surface | 60 | 60 | 0 |
| P36 — MonthlyRevenue Controlled Consumer Readiness | 50 | 50 | 0 |
| **Regression Total** | **165** | **165** | **0** |

---

## Full Suite (onlineValidation)

| Total | Pass | Fail |
|-------|------|------|
| 3943 | 3939 | 4 |

**4 pre-existing failures:** `p27_waiting_state_policy_guard.test.ts` — DB hash drift, unrelated to P39. Present before P39 and unchanged.

---

## Governance
- `entersAlphaScore = false` ✅
- `paperOnly = true` ✅
- `dryRunOnly = true` ✅
- No DB, Prisma, scoring, or optimizer touched ✅

**Classification:** `P39_PAPER_SIMULATION_INPUT_CONTRACT_READY`
