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

## Verified Blockers

The following surfaces are not archive-safe yet:

- `scripts/ai_agents/single_stock_jury.py` is executed by `src/app/api/strategy/jury/route.ts`
- `scripts/ai_agents/sync_institutional.py` is referenced by `src/lib/data/DataSourceContract.ts`
- `scripts/ai_agents/jury_backtest.py` and several root-level Python files still share imports around `rolling_backtest_engine.py`

Because of those live references, `scripts/ai_agents/*` is currently a migration target, not an archive target.