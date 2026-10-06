#!/bin/bash
set -e
cd /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

git add \
  src/lib/onlineValidation/P19ActiveScoringPitReplayUtils.ts \
  src/lib/onlineValidation/__tests__/p19active_scoring_pit_replay_utils.test.ts \
  scripts/generate-p19-active-scoring-pit-replay-corpus.js \
  scripts/validate-p19-monthly-revenue-pit-guard-in-corpus.js \
  scripts/inspect-p19-active-scoring-pit-replay-fields.js \
  outputs/online_validation/p19active_scoring_pit_replay_preflight.json \
  outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl \
  outputs/online_validation/p19active_scoring_pit_replay_summary.json \
  outputs/online_validation/p19active_scoring_pit_replay_summary.md \
  outputs/online_validation/p19monthly_revenue_pit_guard_validation.json \
  outputs/online_validation/p19monthly_revenue_pit_guard_validation.md \
  outputs/online_validation/p19active_scoring_pit_replay_field_inspection.json \
  outputs/online_validation/p19active_scoring_pit_replay_field_inspection.md

git status --short

git commit -m "P19-HARDRESET: Active scoring PIT replay corpus after MonthlyRevenue gate

- New: P19ActiveScoringPitReplayUtils.ts — 7 exports, PIT gate classification
- New: active scoring PIT replay corpus (4500 rows, 25 symbols, 60 dates)
- New: MonthlyRevenue PIT guard validation (14/14 gates PASS)
- New: P19 field inspection and P3 shape comparison (22/22 gates PASS, COMPATIBLE)
- New: 53 unit tests for P19 utils (all PASS)
- Frozen: P0/P1/P3/simulation corpus unchanged (60/4500/9900/4500 lines)
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- No production DB writes
- productionApplyAllowed=false throughout
- No ROI / alpha / edge / win-rate / outperform / profit claims"
