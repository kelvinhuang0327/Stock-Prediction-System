# Guardrails (final)

This page records runtime safety guardrails enforced by the implementation. Edits must be backed by code changes and tests.

## Execution guardrails (authoritative files: SimulationExecutionEngine.ts, AutonomousOrchestrator.ts)

- Quote freshness guard: `STALE_ENTRY_DAYS = 5`. Both creation-time and close-time paths use this guard and will skip proposals/trades when the latest quote is older than 5 days.
- Bootstrap seeding and cap:
	- `MAX_BOOTSTRAP_TRADES = 10` prevents unbounded low-quality seeding when the system has no closed trades.
	- Bootstrap thresholds (TriggerScoring) lower entry thresholds (see `BOOTSTRAP_THRESHOLDS` in `TriggerScoringEngine.ts`) to seed initial shadow trades.
- Promotion limits per cycle: `MAX_PROMOTIONS_PER_CYCLE = 2` — at most two shadow→pending promotions per simulation cycle.

## Risk & rejection floors (authoritative: AutonomousRiskEngine.ts)

- Rejection floor: if `adjustedPositionSizing <= 0.01` the proposal is rejected (unless bootstrap exceptions are applied).
- `maxRiskPerTrade = 0.02` and `totalExposureCap = 0.3` (reduced to 0.15 when `marketState === 'defensive'`).

## Learning & contamination (authoritative: StrategyLearningEngine.ts)

- Learning insights include `contaminationScore`. If contamination exceeds configured thresholds, insights are down-weighted or discarded rather than applied to promotion logic.
- Time-exit neutrality: learning persistence applies adjustments so that insights are not biased by time-based exit mechanics.

## Research safety (authoritative: ExperimentRegistry.ts, ExperimentRunner.ts)

- Experiments must declare `requiredData` and `successCriteria` in `ExperimentRegistry`.
- Research outputs are overlays and annotations only; they must not directly modify live positions or `alphaScore` values.

## Operational notes

- Do not bypass `STALE_ENTRY_DAYS` checks in production. Tests and local simulation helpers may use `bypassFreshnessGuard` explicitly, but such overrides must be isolated.
- When changing guardrail constants, update the code and include a short `CHANGELOG.md` note linking the IDE/PR that changed the guardrail.