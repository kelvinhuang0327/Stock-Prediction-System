# Engine Map

## Purpose

This page maps major engines to their role and highlights cross-engine contracts that an agent or contributor should not rediscover from scratch.

## Stable Engine Families

| Area | Purpose | Contract Surface |
| --- | --- | --- |
| Signal fusion | Produce quantitative alpha and setup inputs | Must remain separate from deterministic research overlays. |
| Screening and validation | Filter candidates and determine bucket status | Must degrade honestly when data is insufficient. |
| Event and relevance engines | Convert raw event streams into trust, relevance, and coverage labels | Rule tables are documented in `quality-labels.md`. |
| Research engines | Produce deterministic analysis and registry-driven validation | Must not mutate L1 quantitative results. |
| Autonomous orchestrators | Run daily, monitor, review, learning, and research cycles | Research failure must not necessarily block the trading cycle. |
| Portfolio engines | Compute concentration, regime, and exposure summaries | Portfolio analysis is advisory, not a direct signal rewrite. |

## Do-Not-Modify Contracts

- Preserve separation between scoring and explanation.
- Preserve lowercase regime keys if downstream consumers depend on them.
- Preserve explicit degraded-mode labeling for insufficient evidence.
- Preserve canonical scheduler entrypoints in `scripts/run-autonomous-*.ts` and `scripts/local-autonomous-scheduler.ts`.

## Engine → File Map (canonical)

Use this table to find the owning implementation for each major engine family. These are the preferred references when editing the wiki or writing tests.

| Engine Family | Primary Implementation File(s) | Notes / Contracts |
| --- | --- | --- |
| Signal Fusion / Alpha | [src/lib/alpha/SignalFusionEngine.ts](src/lib/alpha/SignalFusionEngine.ts) | Produces `alphaScore`, `recommendationBucket`, `confidence`.
| Screening & Validation | [src/lib/screen/StrategyScreenEngine.ts](src/lib/screen/StrategyScreenEngine.ts) | Uses `detectRegime()` and `fuseBatch()`; regime-specific thresholds exist here.
| Trigger Scoring / Execution Modes | [src/lib/autonomous/TriggerScoringEngine.ts](src/lib/autonomous/TriggerScoringEngine.ts) | Defines `shadow` / `pending` / `full` tiers and bootstrap threshold adjustments.
| Autonomous Orchestration | [src/lib/autonomous/AutonomousOrchestrator.ts](src/lib/autonomous/AutonomousOrchestrator.ts) | Run ordering: promote shadow → close open trades → snapshot → proposals → simulate → persist learning → run research (non-blocking).
| Simulation Execution | [src/lib/autonomous/SimulationExecutionEngine.ts](src/lib/autonomous/SimulationExecutionEngine.ts) | Responsible for simulated orders, journal entries and review generation; contains quote freshness guard.
| Risk Assessment | [src/lib/autonomous/AutonomousRiskEngine.ts](src/lib/autonomous/AutonomousRiskEngine.ts) | `assessProposalRisk()` and rejection floor logic.
| Strategy Learning | [src/lib/autonomous/StrategyLearningEngine.ts](src/lib/autonomous/StrategyLearningEngine.ts) | Contamination filters, shadow-weighting, time-exit neutrality and learning insight persistence.
| Research Governance | [src/lib/research/ExperimentRegistry.ts](src/lib/research/ExperimentRegistry.ts), [src/lib/research/ResearchStateMachine.ts](src/lib/research/ResearchStateMachine.ts) | Seed experiments, lifecycle status, evidence mapping.
| Research Execution | [src/lib/research/ExperimentRunner.ts](src/lib/research/ExperimentRunner.ts), [scripts/run-autonomous-research.ts](scripts/run-autonomous-research.ts) | Standalone runner; can be scheduled separately and is non-blocking for the daily orchestrator.
| Event Quality | [src/lib/events/EventSourceQualityEngine.ts](src/lib/events/EventSourceQualityEngine.ts) | Source-trust rule table (LIVE_CONFIDENT / MIXED_SOURCE / SIMULATION_DOMINATED / INSUFFICIENT_EVENT_DATA).
| Relevance Overlay | [src/lib/relevance/RelevanceQualityOverlay.ts](src/lib/relevance/RelevanceQualityOverlay.ts) | Overlay scoring, label adjustments, zero-adjustment for event wave.
| Portfolio Impact | [src/lib/portfolio/PortfolioImpactEngine.ts](src/lib/portfolio/PortfolioImpactEngine.ts) | Aggregates fusion + event + topic data into narrative/impact.

## Do-Not-Modify Contracts (quick list)
- `alphaScore` computation and recommended bucketing (SignalFusion) — tests must guard changes.
- Trigger scoring thresholds used by execution logic in `TriggerScoringEngine.ts` — changing may alter promotion semantics.
- Event source quality thresholds in `EventSourceQualityEngine.ts` — tests must accompany edits.

When in doubt, link the wiki page section to the exact implementation file and, ideally, a specific exported function or constant.

## Follow-Up

This v1 page is intentionally high-level. As rule tables and guardrails are extracted from code, add file references and anchors here rather than duplicating large architecture tables in README.