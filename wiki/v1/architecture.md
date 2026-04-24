# Architecture

Purpose

This page presents the canonical, code-aligned architecture for the Stock-Prediction-System. When conflicts exist, prefer source code, then `docs/`, then existing wiki, then `README.md`.

Layered Overview (L1 → L4)

- L1 — Signal & Event Fusion
	- Responsibilities: ingest market data and event sources, compute feature vectors and `alphaScore` values.
	- Primary code: [src/lib/alpha/SignalFusionEngine.ts](src/lib/alpha/SignalFusionEngine.ts), [src/lib/events/EventSourceQualityEngine.ts](src/lib/events/EventSourceQualityEngine.ts).

- L2 — Screening & Strategy Layer
	- Responsibilities: filter candidates, apply regime detection, produce `recommendationBucket` and initial ranking.
	- Primary code: [src/lib/screen/StrategyScreenEngine.ts](src/lib/screen/StrategyScreenEngine.ts).

- L3 — Autonomous Decisioning & Simulation
	- Responsibilities: build proposals, score triggers, run simulation execution, apply risk floors, and persist learning artifacts.
	- Primary code: [src/lib/autonomous/AutonomousOrchestrator.ts](src/lib/autonomous/AutonomousOrchestrator.ts), [src/lib/autonomous/TriggerScoringEngine.ts](src/lib/autonomous/TriggerScoringEngine.ts), [src/lib/autonomous/SimulationExecutionEngine.ts](src/lib/autonomous/SimulationExecutionEngine.ts), [src/lib/autonomous/AutonomousRiskEngine.ts](src/lib/autonomous/AutonomousRiskEngine.ts), [src/lib/autonomous/StrategyLearningEngine.ts](src/lib/autonomous/StrategyLearningEngine.ts).

- L4 — Research & Governance
	- Responsibilities: seed and run experiments, derive evidence labels and overlays, manage experiment lifecycle and registry.
	- Primary code: [src/lib/research/ExperimentRegistry.ts](src/lib/research/ExperimentRegistry.ts), [src/lib/research/ExperimentRunner.ts](src/lib/research/ExperimentRunner.ts), [scripts/run-autonomous-research.ts](scripts/run-autonomous-research.ts), [src/lib/research/ResearchStateMachine.ts](src/lib/research/ResearchStateMachine.ts).

Cross-cutting services

- Data contracts and sync scripts: [src/lib/data/DataSourceContract.ts](src/lib/data/DataSourceContract.ts) (maps to `scripts/ai_agents/*.py`).
- Persistence: Prisma models and `autonomousResearchSnapshot` upserts are used by the orchestrator.
- Observability: orchestrator logs, run-level JSON results from `scripts/run-autonomous-research.ts`.

Execution scoring & promotion (summary)

The execution path converts fused candidates to execution proposals via scoring and promotion rules:

1. Scoring: `SignalFusionEngine` produces `alphaScore` and base confidence.
2. Screening: `StrategyScreenEngine` applies regime-specific filters and bucket assignment.
3. Trigger scoring: `TriggerScoringEngine` applies bootstrap adjustments and maps scores into execution modes (`shadow`, `pending`, `full`). See [TriggerScoringEngine.ts](src/lib/autonomous/TriggerScoringEngine.ts) for numeric constants and bootstrap behavior.
4. Promotion: candidates may be promoted from `shadow` → `pending` → `full` based on score thresholds, time-in-sample bootstrapping, and contamination/learning adjustments (see `StrategyLearningEngine`).

Trade lifecycle (canonical)

- `shadow` — evaluation-only, low-weight candidates persisted for learning.
- `pending` — candidates approved for simulation/paper execution but not full live execution.
- `full` — candidates executed in live/paper accounts following `AutonomousRiskEngine` checks.

Close / exit rules

- `closeOpenTrades()` is responsible for closing positions that hit stop/target/time-exit. This is invoked early in the orchestrator to ensure correct promotion accounting. See [AutonomousOrchestrator.ts](src/lib/autonomous/AutonomousOrchestrator.ts).

Learning rules (summary)

- `StrategyLearningEngine` persists learning insights with `contaminationScore`, `promotedTradeWeight`, and time-exit neutrality adjustments. High contamination reduces insight influence; time-exit neutrality ensures learning does not bias on time-dependent exits.

Risk & data freshness guard

- Risk rejection floor: `AutonomousRiskEngine` applies hard rejection floors for proposals exceeding concentration or exposure thresholds.
- Data freshness guard: `SimulationExecutionEngine` rejects promotions when quote age exceeds the configured freshness window.

References & source of truth

Always link specific wiki statements to the owning file. Primary authoritative files for architecture decisions live under `src/lib/` and `scripts/`.