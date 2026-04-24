# Research Layer

## Purpose

This page consolidates the semantics, execution model, and governance for research experiments and overlays. The authoritative implementations are linked throughout — code is the source of truth.

## Core semantics (code-backed)

- Research is an evidence overlay: it may annotate, contextualize, and provide a `qualityLabel` for insights, but it must not mutate L1 quantitative outputs such as `alphaScore` or `recommendationBucket`. (See [src/lib/relevance/RelevanceQualityOverlay.ts](src/lib/relevance/RelevanceQualityOverlay.ts)).
- Research execution is governed by a registry and a state machine. The registry seeds experiments; the state machine defines allowed transitions and derives evidence levels. See: [src/lib/research/ExperimentRegistry.ts](src/lib/research/ExperimentRegistry.ts) and [src/lib/research/ResearchStateMachine.ts](src/lib/research/ResearchStateMachine.ts).

## Experiment lifecycle (authoritative)

Primary status values (from `ExperimentStateMachine`): `IDEA`, `READY`, `RUNNING`, `BLOCKED`, `PARTIAL`, `VALIDATED`, `REJECTED`, `DEFERRED`.

Evidence levels: `VERIFIED`, `INFERRED`, `NEEDS_DATA`, `UNVERIFIED`.

Transition rules: the implementation in [ResearchStateMachine.ts](src/lib/research/ResearchStateMachine.ts) controls allowed transitions and the derivation of `evidenceLevel` from metrics; consult that file for exact logic when writing tests or updating the registry.

## ExperimentRunner and scheduling

- The experiment runner lives in [src/lib/research/ExperimentRunner.ts](src/lib/research/ExperimentRunner.ts). It executes parameterized experiment sets, produces per-experiment `findings`, and emits a run-level `gapsReport` summarizing coverage readiness.
- The CLI runner is [scripts/run-autonomous-research.ts](scripts/run-autonomous-research.ts) and can be scheduled independently. The orchestrator calls `runResearchCycle()` non-blockingly but does not rely on research to complete before finishing the daily cycle (see [src/lib/autonomous/AutonomousOrchestrator.ts](src/lib/autonomous/AutonomousOrchestrator.ts)).

## Data & parameter versioning

- Experiment runs are parameter-set versioned. The runner output includes `parameterSet.version` and `parameterSet.id` (see output of `scripts/run-autonomous-research.ts`).
- Keep a changelog entry when parameter sets or evidence-derivation rules change.

## Best practices for contributors

1. When adding an experiment seed, add it to `ExperimentRegistry.ts` with clear `linkedModules`, `requiredData`, and `successCriteria`.
2. If you modify evidence derivation, update `ResearchStateMachine.ts` and add tests that assert expected `deriveEvidenceLevelFromMetrics()` outputs.
3. Do not claim `VALIDATED` without `VERIFIED` evidence in the code-backed registry.