# Archive Inventory

This file tracks candidates for archival, not automatic moves. Nothing listed here should be moved until live references are checked.

## Rules

1. Archive before delete.
2. Preserve original filenames inside archive folders.
3. Do not archive anything still referenced by runtime code, package scripts, or deploy surfaces.

## Proposed Archive Layout

- `archive/legacy-python-v0/`
- `archive/legacy-python-agents/`
- `archive/legacy-python-modules/`
- `archive/day-phase-scripts-2026q1/`
- `archive/legacy-backtest-outputs/`
- `archive/legacy-results/`
- `archive/one-off-scripts/`
- `archive/run-logs-2026q1/`
- `archive/reports/`

## Bucket Summary

### Keep

- `src/lib/**`
- `src/app/**`
- `src/components/**`
- `src/types/**`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `scripts/run-autonomous-*.ts`
- `scripts/local-autonomous-scheduler.ts`
- `docs/autonomous-quickstart.md`
- `docs/autonomous-scheduler.md`
- `docs/DATA_SYNC_GUIDE.md`
- `docs/KELLY_RISK_INTEGRATION.md`

### Refactor Later

- `README.md`
- `USER_GUIDE.md`
- long architecture header comments in engine files

### Archive Candidates

- Root-level legacy Python prototypes such as `ai_advisor.py`, `asset_doubling.py`, `asset_doubling_hunter.py`, `rolling_backtest_engine.py`, `strategy_research_framework.py`, and related validation scripts
- Root-level one-off JavaScript utilities such as `check_coverage.js`, `check_sync.js`, `find_gems.js`, and `find_potential.js`
- Day/phase scaffolding under `scripts/day*-*.ts` and `scripts/day*-*.js`
- Python modules under `src/analyzers/`, `src/sandbox/`, and `src/validators/`
- Large root-level text outputs and JSON result snapshots
- Historical reports under `docs/reports/`
- Run-state JSON snapshots under `logs/`

### Remove Candidates

- `scripts/_test_index.py` if confirmed unused
- Empty or orphaned scaffolding directories once verified

---

## P0-COMBINED Detailed Inventory (2026-05-11)

### Root-level Legacy Python Files (15)

| File | Status |
|---|---|
| `ai_advisor.py` | Archive candidate |
| `asset_doubling.py` | Archive candidate |
| `asset_doubling_hunter.py` | Archive candidate |
| `auto_optimizer.py` | Archive candidate |
| `doubling_final_report.py` | Archive candidate |
| `execution_policy.py` | Archive candidate |
| `major_players.py` | Archive candidate |
| `rolling_backtest_engine.py` | Archive candidate |
| `strategy_research_framework.py` | Archive candidate |
| `super_surge_detector.py` | Archive candidate |
| `validate_kelly.py` | Archive candidate |
| `validate_kelly_backtest.py` | Archive candidate |
| `validate_risk_defense.py` | Archive candidate |
| `validate_walk_forward.py` | Archive candidate |
| `verify_hunter.py` | Archive candidate |

### scripts/day[4-8]-phase* Files (15)

| File | Status |
|---|---|
| `scripts/day4-phase0-snapshot.js` | Archive candidate |
| `scripts/day5-phase0-snapshot.js` | Archive candidate |
| `scripts/day5-phase1-contamination-cleanup.js` | Archive candidate |
| `scripts/day6-phase0-1-audit-remediate.js` | Archive candidate |
| `scripts/day6-phase0d-lock-diagnosis.ts` | Archive candidate |
| `scripts/day6-phase2-regime-analysis.js` | Archive candidate |
| `scripts/day6-phase4-setup-exploration.ts` | Archive candidate |
| `scripts/day7-phase0-state-reconstruction.ts` | Archive candidate |
| `scripts/day7-phase1-regime-analysis.ts` | Archive candidate |
| `scripts/day7-phase3-learning-recovery.ts` | Archive candidate |
| `scripts/day7-phase4-setup-diagnosis.ts` | Archive candidate |
| `scripts/day8-phase0-baseline.ts` | Archive candidate |
| `scripts/day8-phase1-diagnosis.ts` | Archive candidate |
| `scripts/day8-phase3-5cycles.ts` | Archive candidate |
| `scripts/day8-phase3-verify.ts` | Archive candidate |

### src/{analyzers,sandbox,validators}/*.py

| File | Status |
|---|---|
| `src/analyzers/HistoricalDoublingScanner.py` | Archive candidate |
| `src/analyzers/ClusteringAnalyzer.py` | Archive candidate |
| `src/sandbox/StrategySandbox.py` | Archive candidate |
| `src/lib/indicators/ChipConcentrationIndex.py` | Archive candidate |
| `src/validators/MonteCarloValidator.py` | Archive candidate |
| `src/validators/SurvivorshipFilter.py` | Archive candidate |
| `src/validators/LookAheadBiasDetector.py` | Archive candidate |

### scripts/ai_agents/*.py

| File | Status |
|---|---|
| `scripts/ai_agents/discover_doubling.py` | Archive candidate |
| `scripts/ai_agents/final_jury_report.py` | Archive candidate |
| `scripts/ai_agents/jury_backtest.py` | Archive candidate |
| `scripts/ai_agents/jury_experts.py` | Archive candidate |
| `scripts/ai_agents/jury_experts.py` | Archive candidate |
| `scripts/ai_agents/single_stock_jury.py` | Archive candidate |
| `scripts/ai_agents/sync_institutional.py` | Archive candidate |
| `scripts/ai_agents/taiwan_stock_agent.py` | Archive candidate |

> Note: Files listed here are candidates only. No files are moved or deleted by this inventory.
> Check live references before archiving any file.

## Verified Blockers

The following surfaces are not archive-safe yet:

- `scripts/ai_agents/single_stock_jury.py` is executed by `src/app/api/strategy/jury/route.ts`
- `scripts/ai_agents/sync_institutional.py` is referenced by `src/lib/data/DataSourceContract.ts`
- `scripts/ai_agents/jury_backtest.py` and several root-level Python files still share imports around `rolling_backtest_engine.py`

Because of those live references, `scripts/ai_agents/*` is currently a migration target, not an archive target.