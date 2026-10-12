# T-05F WalkForward Observability Runner — Contract

**Task:** T-05F_WALK_FORWARD_OBSERVABILITY_RUNNER
**Date:** 2026-05-07
**Run Mode:** DRY_RUN_OBSERVABILITY_ONLY

**Safety Labels:** T-05F | WalkForward Observability Runner | dry-run only | safe-run only | no DB write | no external API | no LLM call | no production overwrite | no strategy mutation | no performance claim | no edge claim

---

## Overview

T-05F wires T-05C (RegimeContextLoader), T-05D (TaiwanTradingCalendar), and T-05E (CandidateDataAdapter) into T-05B (buildWalkForwardSkeleton). Produces dry-run observability-only artifacts. Not a trading recommendation. Not investment advice.

## Source Modules Integrated

| Module | Component |
|---|---|
| T-05B | WalkForwardEngine — buildWalkForwardSkeleton() |
| T-05C | RegimeContextLoader — loadRegimeContextMap() |
| T-05D | TaiwanTradingCalendar — buildTaiwanTradingCalendar() |
| T-05E | CandidateDataAdapter — loadCandidateSnapshotsForDate() |

## Exported Functions

- `runWalkForwardObservability()` — async, end-to-end pipeline
- `buildWalkForwardRunConfig()` — deterministic config builder
- `validateWalkForwardRunGuardrails()` — returns PASS/WARN/FAIL
- `summarizeWalkForwardObservabilityRun()` — pure sync summarizer
- `buildWalkForwardRunnerArtifacts()` — pure sync artifact payload builder

## Config Contract

| Field | Default / Rule |
|---|---|
| dryRun | always `true` (locked) |
| safeRun | always `true` (locked) |
| lookbackDays | 500 (T05B_LOOKBACK_DAYS) — configurable |
| currentDate | resolved via `resolveCurrentDate()` — no hardcoded TODAY_CAP |
| startDate | endDate minus lookbackDays if not provided |
| endDate | currentDate if not provided |
| artifactOutputDir | outputs/backtest |

## Guardrail Summary

| Guardrail | Expected Status |
|---|---|
| dryRunEnabled | PASS (locked true) |
| safeRunEnabled | PASS (locked true) |
| noDbWrite | PASS (structural) |
| noExternalApiCall | PASS (structural) |
| noLlmCall | PASS (structural) |
| noStrategyMutation | PASS (structural) |
| noProductionOverwrite | PASS (outputs only) |
| noForbiddenFieldsAsClaims | PASS (naming enforced) |
| noPerformanceMetricComputation | PASS (structural) |
| sourceDateLeRebalanceDate | PASS if data present, WARN if empty |
| tradingCalendarInjected | PASS (T-05D always used) |
| regimeContextReadOnly | PASS if data present, WARN if empty |
| candidateSnapshotsReadOnly | PASS if data present, WARN if empty |

## Forbidden Output Fields

buy / sell / signal / roi / win_rate / alpha / edge / profit / recommendation / outperform / H001–H012

These must not appear in any output field names, claims, or conclusions.

---

*Observability-only contract. No performance claim. No edge claim. No production write.*
