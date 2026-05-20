# P30 Test Baseline

**Phase:** P30
**Captured:** 2026-05-20T00:00:00.000Z

## P30 Tests: PASS

| Suite | Passed | Failed | Total |
|---|---|---|---|
| `p30_chip_available_at_schema_and_backfill_gate` | 49 | 0 | 49 |

All 49 P30 tests pass.

## P29L Regression: PASS

| Suite | Passed | Failed | Total |
|---|---|---|---|
| `p29l_chip_available_at_and_monthly_revenue_backfill` | 96 | 0 | 96 |

## P29K/J/I Regression: PASS

| Suite | Passed | Failed | Total |
|---|---|---|---|
| `p29k_monthly_revenue_release_date_repair` | 68 | 0 | 68 |
| `p29j_chip_lag_and_monthly_revenue_readiness` | 76 | 0 | 76 |
| `p29i_quote_regime_chip_pit_audit` | 33 | 0 | 33 |
| **Total** | **177** | **0** | **177** |

## Full onlineValidation Suite

| Metric | Value |
|---|---|
| Suites passed | 109/113 |
| Tests passed | 3633/3637 |
| Pre-existing failures | 4 suites |

### Pre-existing Failures (Not P30 Regressions)

These 4 suites were failing before P30 and are documented as pre-existing:

1. `p29d_dropzone_scaffold`
2. `p26a_renderer_fix`
3. `p26a_batch_pipeline_wiring`
4. `p27_waiting_state_policy_guard`

## Forbidden Diff

`prisma/dev.db` and `runtime/agent_orchestrator/llm_usage.jsonl` appear in the overall git diff as pre-existing runtime modifications. P30 did NOT modify these files.

P30 actual changes:
- `prisma/schema.prisma` — additive nullable field only
- New source/test/output files
