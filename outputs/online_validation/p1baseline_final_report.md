# P1-HARDRESET: Naive Baseline Historical Replay Corpus — Final Report

Generated: 2026-05-11  
Author: P1-HARDRESET automated pipeline  
Writer: `p1hardreset-naive-baseline-writer-v1`  
Run ID: `p1baseline-2026-05-11`

---

## 1. Overview

This report documents the successful completion of **P1-HARDRESET**: the Naive Baseline Historical Replay Corpus system. P1 generates 4 naive reference baseline corpus types over 25 TWSE symbols and 60 historical asOfDates, using the same real-price resolution infrastructure as P0.

P1 is **observability infrastructure only**. All statistics are historical descriptive summaries. No investment strategy, buy/sell signal, ROI claim, alpha claim, win rate, or outperformance claim is made or implied.

---

## 2. Safety Contract

| Invariant | Status |
|-----------|--------|
| `simulation_snapshot_corpus.jsonl` never written | ✅ FROZEN (60 lines — unchanged) |
| 0 mock-deterministic price sources | ✅ 0 mock entries |
| No forbidden claims (ROI/alpha/win_rate/outperform/profit/edge) | ✅ Verified |
| `qualityStatus` never `PRODUCTION_READY` | ✅ Not present in P1 schema |
| ManualReview* modules untouched | ✅ Not modified |
| No Math.random in RANDOM_N_DETERMINISTIC | ✅ Uses seeded LCG only |
| No external API, no LLM calls | ✅ DB-only (Prisma) |
| No modification to SignalFusion/RuleBased/StrategyScreen | ✅ Not modified |

---

## 3. Baseline Types

P1 defines 4 naive reference baseline types. All are **observational reference models, not investment strategies**.

| Type | Description | Symbol Count |
|------|-------------|-------------|
| `BUY_AND_HOLD_ALL` | All 25 universe symbols; simulates full-coverage holding | 25 per date |
| `TOP_N_EQUAL_WEIGHT` | Top N=10 by lexical order; deterministic control | 10 per date |
| `RANDOM_N_DETERMINISTIC` | N=10 seeded via djb2+LCG; repeatable randomisation | 10 per date |
| `STOCKQUOTE_COVERAGE_TOP_N` | Top N=10 by `quoteDays` (data availability proxy) | 10 per date |

**TOP_N_EQUAL_WEIGHT** uses lexical order as a deterministic fallback. This is labeled `DETERMINISTIC_LEXICAL_CONTROL — not a strategy` in the limitations field.

**RANDOM_N_DETERMINISTIC** uses a seeded LCG (djb2 hash of `baselineRunId:asOfDate`). No `Math.random()` is used anywhere. Determinism is verified by tests.

**STOCKQUOTE_COVERAGE_TOP_N** uses `quoteDays` as a data availability proxy — not a return predictor. Limitations field clearly states this.

---

## 4. Corpus Statistics

| Metric | Value |
|--------|-------|
| Total lines | 9,900 |
| Unique symbols | 25 |
| Unique asOfDates | 60 |
| Horizons | 5d, 20d, 60d |
| Coverage (stockQuote.close) | **94.23%** |
| Generation time | 2.6 seconds |
| Duplicate keys | 0 |
| Parse errors | 0 |

### Lines by Baseline Type

| Type | Lines |
|------|-------|
| BUY_AND_HOLD_ALL | 4,500 |
| TOP_N_EQUAL_WEIGHT | 1,800 |
| RANDOM_N_DETERMINISTIC | 1,800 |
| STOCKQUOTE_COVERAGE_TOP_N | 1,800 |

### Lines by Horizon

| Horizon | Lines (resolved) |
|---------|-----------------|
| 5d | 3,300 |
| 20d | 3,273 |
| 60d | 2,756 |

---

## 5. Acceptance Gates

All gates passed:

| Gate | Threshold | Result |
|------|-----------|--------|
| ≥ 4 baseline types | 4 | ✅ 4 |
| ≥ 25 unique symbols | 25 | ✅ 25 |
| ≥ 60 unique asOfDates | 60 | ✅ 60 |
| Each type ≥ 1,000 lines | 1,000 | ✅ min=1,800 |
| 0 mock-deterministic | 0 | ✅ 0 |
| stockQuote.close coverage ≥ 90% | 90% | ✅ 94.23% |
| No duplicate keys | 0 | ✅ 0 |

---

## 6. Price Source Distribution

| Source | Count | % |
|--------|-------|---|
| stockQuote.close | 9,329 | 94.23% |
| MISSING | 516 | 5.21% |
| PENDING | 55 | 0.56% |
| mock-deterministic | 0 | 0.00% |

PENDING entries are asOfDates where the outcome window had not yet matured as of the generation date (2026-05-11). MISSING entries are dates where no price data was found in the DB.

---

## 7. Observability Comparison Summary (P0 vs P1)

| Dimension | P0 (System Predictions) | P1 (Naive Baseline) |
|-----------|------------------------|---------------------|
| Total lines | 4,500 | 9,900 |
| Unique symbols | 25 | 25 |
| Unique asOfDates | 60 | 60 |
| Coverage % | 93.42% (P0 schema) | 94.23% |
| Schema | corpusRunId / scoreSnapshot / outcomeSnapshot | baselineRunId / baselineType / returnPct |

**P1 returnPct descriptive statistics (observational only):**

| Type | Mean returnPct% |
|------|----------------|
| BUY_AND_HOLD_ALL | 6.32% |
| TOP_N_EQUAL_WEIGHT | 3.87% |
| RANDOM_N_DETERMINISTIC | 6.12% |
| STOCKQUOTE_COVERAGE_TOP_N | 9.91% |
| All P1 combined | 6.52% |

> ⚠️ These figures are historical descriptive statistics from TWSE close prices during a broadly upward-trending period (2024–2026). They must NOT be interpreted as expected returns, predicted returns, or evidence of strategy performance. Past statistics do not predict future outcomes.

---

## 8. Frozen Corpus Verification

`outputs/online_validation/simulation_snapshot_corpus.jsonl` — **60 lines, UNCHANGED**.

Pre-generation and post-generation line count both = 60. The P1 pipeline never writes to this file.

---

## 9. Test Coverage

File: `src/lib/onlineValidation/__tests__/p1baseline_naive_baseline_shadow_writer.test.ts`

**39 tests, 39 passed, 0 failed.**

Coverage areas:
- Config validation (empty universe, empty dates, bad baselineRunId)
- Deterministic helpers: `deterministicHash`, `makeSeededPRNG`, `deterministicShuffle`
- All 4 symbol selectors
- All 4 baseline types in output
- All 3 horizons in output
- `duplicateKey` format
- `createdAt` = `asOfDate + "T00:00:00.000Z"`
- `writerVersion` = `BASELINE_WRITER_VERSION`
- `priceSource` never `mock-deterministic`
- `limitations` populated for all entries
- No duplicate keys
- `returnPct` null/non-null by priceSource
- Frozen corpus not created
- JSONL output written
- asOfDates ≥ today skipped
- RANDOM_N determinism (same config → same corpus)
- No forbidden claims in any field
- `buildNaiveBaselineArtifact`: pass/fail gates
- `summarizeNaiveBaseline`: status, coveragePct, safetyNote

---

## 10. Limitations

- **Not a strategy**: All 4 baseline types are observational reference models. None should be used as trading strategies.
- **Universe selection bias**: Top-25 by `quoteDays` may favour larger, more liquid stocks with longer quote history.
- **Coverage gaps**: 5.77% of entries are MISSING or PENDING due to DB gaps or immature outcome windows.
- **STOCKQUOTE_COVERAGE_TOP_N proxy**: Uses `quoteDays` as a data availability proxy — not a return predictor.
- **TOP_N lexical control**: Lexical ordering is a deterministic fallback, not a financial rationale.
- **RANDOM_N seed scope**: Seed is `baselineRunId:asOfDate` — changing baselineRunId changes all random selections.
- **Horizon approximation**: Outcome dates are computed via `addTwseTradingDays` (static 2024-2026 calendar); gaps at calendar boundaries may produce MISSING entries.
- **Historical period**: All asOfDates fall in 2024-2026, a period of broadly rising TWSE prices. Statistics from this window are not representative of all market conditions.

---

## 11. Next Steps

- **P2 (proposed)**: Connect P0 prediction corpus to P1 baseline corpus via a structured observability bridge — comparing prediction returnPct distributions against baseline returnPct distributions, with full uncertainty accounting.
- **Calendar extension**: Extend `TwseTradingCalendar` to 2027+ to reduce PENDING entries in future corpus runs.
- **Coverage monitoring**: Track MISSING% trend across runs; investigate symbols with persistent MISSING outcomes.
- **Frozen corpus review**: Periodically audit `simulation_snapshot_corpus.jsonl` (60 lines) to confirm it reflects intended simulation snapshot entries.

---

## 12. Disclaimer

**This document is for observability and engineering audit purposes only.**

Nothing in this report constitutes investment advice, a trading signal, a buy/sell recommendation, a return guarantee, or a prediction of future returns. All return percentage figures are historical descriptive statistics computed from TWSE close prices. Past statistics do not predict future outcomes. This system is not certified for production trading use. `qualityStatus` is not `PRODUCTION_READY`.

---

*P1-HARDRESET pipeline complete. All 8 PARTS executed. All gates passed.*
