# Data Model & Runtime Data Contracts (final)

This page describes the runtime data contracts and the key persisted artifacts used by the autonomous system. For full schema definitions, consult the Prisma schema and `src/lib/types/`.

## Canonical data-source mappings (authoritative: src/lib/data/DataSourceContract.ts)

- `DataSourceContract` contains named sources and optional `syncScript` values. Examples:
  - `INSTITUTIONAL_CHIP.syncScript = 'scripts/ai_agents/sync_institutional.py'`
  - `single_stock_jury` is invoked by the API route [src/app/api/strategy/jury/route.ts](src/app/api/strategy/jury/route.ts) → `scripts/ai_agents/single_stock_jury.py`.

Any file referenced from `DataSourceContract` or executed directly by an API route is a runtime dependency and must not be archived without updating the reference.

## Snapshot objects (high level)

- `autonomousDataSnapshot` (daily decision snapshot) includes:
  - `snapshotDate` / `timestamp`
  - `universe` list and selection metadata
  - `eventCoverage` (per-source counts + quality labels)
  - `fusionInputs` (alpha vectors, feature matrix)

- `autonomousResearchSnapshot` extends the above with:
  - `parameterSet` (id/version)
  - `experimentContext` (seed ids)
  - `coverageGaps` (missing sources or low-trust flags)

## Persisted artifacts (where to look)

- `autonomousResearchSnapshot` — persisted via Prisma upsert in the orchestrator.
- Strategy proposals and simulated trades — persisted in `StrategyProposal` and `SimulatedTrade` tables (see `src/lib/autonomous/SimulationExecutionEngine.ts`).
- Learning insights — persisted by `StrategyLearningEngine` with fields like `insightId`, `derivedMetrics`, `contaminationScore`, `promotedTradeWeight`.

## Sync script safety checklist

1. When adding a new `syncScript`, add a `DataSourceContract` entry and tests that ensure the script is referenced only by safe, idempotent ingestion paths.
2. If an archival action removes a script, update all `DataSourceContract` references and API routes before merging.

## Quick developer pointers

- For concrete types, see `src/lib/types/` and `prisma/schema.prisma`.
- For snapshot generation and persisted field names, see `src/lib/autonomous/AutonomousOrchestrator.ts` and `src/lib/autonomous/SimulationExecutionEngine.ts`.