# P3-HARDRESET: Active Scoring Historical Replay — Final Report

**Classification**: `P3_ACTIVE_SCORING_REPLAY_COMPLETE`
**Commit**: `f78b412`
**Date**: 2026-05

---

## Summary

P3-HARDRESET resolved the root cause identified in PART A: `DefaultStockQuoteCandidateProvider` always returned all-zero scores. The fix creates `ActiveScoringSnapshotBuilder`, which calls `RuleBasedStockAnalyzer.analyzeStock(symbol, asOfDate)` with a PIT-safe date parameter and captures real historical scores.

---

## Corpus Results

| Corpus | Lines | Status |
|--------|-------|--------|
| `simulation_snapshot_corpus.jsonl` | 60 | FROZEN ✓ |
| `p0hardreset_historical_replay_corpus.jsonl` | 4500 | FROZEN ✓ |
| `p1baseline_historical_replay_corpus.jsonl` | 9900 | FROZEN ✓ |
| `p3active_scoring_historical_replay_corpus.jsonl` | **4500** | NEW ✓ |

### Completeness Distribution (P3 corpus)

| Status | Count | % |
|--------|-------|---|
| COMPLETE | 3099 | 68.9% |
| PARTIAL | 1401 | 31.1% |
| EMPTY | 0 | 0.0% |
| **Usable ratio** | **4500/4500** | **100.0%** |

---

## Invariants

| Invariant | Result |
|-----------|--------|
| `simulation_snapshot_corpus.jsonl` = 60 | PASS ✓ |
| `p0hardreset_historical_replay_corpus.jsonl` = 4500 | PASS ✓ |
| `p1baseline_historical_replay_corpus.jsonl` = 9900 | PASS ✓ |
| `p3active_scoring_historical_replay_corpus.jsonl` = 4500 | PASS ✓ |
| pitViolations = 0 | PASS ✓ |
| forbidden fields = 0 | PASS ✓ |
| mock-deterministic = 0 | PASS ✓ |
| `scoringCompletenessStatus` present: 4500/4500 | PASS ✓ |
| ManualReview* modules unchanged | PASS ✓ |
| Preflight audit gates (32/32) | PASS ✓ |

---

## Parts Completed

| Part | Description | Result |
|------|-------------|--------|
| A | Preflight audit (32/32 PASS) | COMPLETE ✓ |
| B | `ActiveScoringSnapshotBuilder.ts` | COMPLETE ✓ |
| C | `ShadowPredictionHistoricalReplayWriter.ts` patched | COMPLETE ✓ |
| D | `generate-p3active-scoring-historical-replay-corpus.js` (4500 lines, 9/9 gates) | COMPLETE ✓ |
| E | `inspect-p3active-scoring-corpus-fields.js` (0 violations) | COMPLETE ✓ |
| F | 48 tests (2 test files) — 48/48 PASS | COMPLETE ✓ |
| G | Artifact validation (all invariants PASS) | COMPLETE ✓ |
| H | Git commit `f78b412` | COMPLETE ✓ |
| I | This report | COMPLETE ✓ |

---

## New Files

- `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts` — PIT-safe scoring builder
- `src/lib/onlineValidation/__tests__/p3active_scoring_snapshot_builder.test.ts` — 28 tests
- `src/lib/onlineValidation/__tests__/p3active_scoring_historical_replay_writer.test.ts` — 20 tests
- `scripts/p3active-scoring-preflight-audit.js`
- `scripts/generate-p3active-scoring-historical-replay-corpus.js`
- `scripts/inspect-p3active-scoring-corpus-fields.js`
- `outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl`
- `outputs/online_validation/p3active_scoring_historical_replay_artifact.json`
- `outputs/online_validation/p3active_scoring_historical_replay_summary.md`
- `outputs/online_validation/p3active_scoring_preflight_audit.json` / `.md`
- `outputs/online_validation/p3active_scoring_field_inspection.json` / `.md`

---

## Safety Contract

- Research mode only — no production DB write
- PIT-safe: all DB queries capped at `asOfDate`
- No fabricated scores — all scores from `RuleBasedStockAnalyzer`
- No random score generation
- No ROI / alpha / win-rate / edge / outperform claims
- ManualReview* modules: FROZEN (not modified)
- No external API calls / no LLM calls
- EMPTY snapshots still written (no silent skip)

---

*Not investment advice. Not a trading system.*
