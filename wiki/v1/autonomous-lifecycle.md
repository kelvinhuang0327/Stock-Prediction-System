# Autonomous Lifecycle

## Purpose

This page documents the canonical operational lifecycle for the autonomous system and clarifies the relationship between scheduled jobs and the research runner.

## Canonical scheduled cycles (source of truth)

The code-defined job registry lists the canonical scheduled cycles. See: [src/lib/jobs/autonomousJobRegistry.ts](src/lib/jobs/autonomousJobRegistry.ts).

- `autonomous:daily` — full daily cycle producing snapshots and proposals.
- `autonomous:monitor` — lightweight interval monitor for open state and health.
- `autonomous:review` — daily review generation for closed trades and review reports.
- `autonomous:learning` — periodic learning / insight generation from review reports.

These are the scheduled jobs that the orchestrator and scheduler examples assume. Operator runbooks are under `docs/` (see [docs/autonomous-quickstart.md](docs/autonomous-quickstart.md) and [docs/autonomous-scheduler.md](docs/autonomous-scheduler.md)).

## Research runner: standalone, non-blocking (important correction)

The research experiment execution exists, but it is implemented as a separate runner and governance layer:

- Standalone runner: [scripts/run-autonomous-research.ts](scripts/run-autonomous-research.ts) — can be scheduled independently (e.g. 3×/week).
- Governance & state: [src/lib/research/ExperimentRegistry.ts](src/lib/research/ExperimentRegistry.ts) and [src/lib/research/ResearchStateMachine.ts](src/lib/research/ResearchStateMachine.ts).

Critical operational rule: the orchestrator runs the research cycle as a non-blocking substep and the scheduled job registry does NOT include `autonomous:research` as a core scheduled job. The authoritative behavior is in [src/lib/autonomous/AutonomousOrchestrator.ts](src/lib/autonomous/AutonomousOrchestrator.ts) — the research cycle is invoked but failures are explicitly caught and logged without blocking the trading run.

## Run ordering and important semantics (source-of-truth)

`runAutonomousCycle()` order (summarised from [src/lib/autonomous/AutonomousOrchestrator.ts](src/lib/autonomous/AutonomousOrchestrator.ts)):

1. Promote eligible shadow trades to `pending` (must happen before closing to ensure correct weighting).
2. Close open trades that hit stops/targets/time-exit.
3. Build data snapshot and research snapshot (data coverage merged).
4. Persist snapshot (`prisma.autonomousResearchSnapshot.upsert`).
5. Build strategy proposals (`DecisionLayerEngine`).
6. Execute simulation cycle (`SimulationExecutionEngine`).
7. Build and persist learning insight (`StrategyLearningEngine`).
8. Run research experiment cycle (`ExperimentRunner`) as a non-blocking step; failures do not abort the orchestrator.

## Idempotency, scheduling, and health

- Idempotency keys and canonical job windows are defined in [src/lib/jobs/autonomousJobRegistry.ts](src/lib/jobs/autonomousJobRegistry.ts). Use those keys in scheduler templates.
- Scheduler examples: `deploy/examples/autonomous-windows-task.md` and `deploy/examples/autonomous.cron.example`.
- Health & pre-flight checks are implemented in the runner and the operator runbooks in `docs/`.

## Operational guidance

- Do not schedule `scripts/run-autonomous-research.ts` as a daily peer unless you intentionally want research runs to coincide with daily cycles — research is heavier and intentionally non-blocking.
- For local setups, follow `docs/autonomous-scheduler.md` for the minimal safe schedule.
