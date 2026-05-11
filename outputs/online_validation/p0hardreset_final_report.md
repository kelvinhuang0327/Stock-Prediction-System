# P0-HARDRESET FINAL REPORT
## Historical Replay Shadow Writer + Real-Price Outcome Resolver

**Report Generated:** 2026-05-11  
**Git Commit:** `5426c68`  
**Final Classification:** `P0_HARDRESET_HISTORICAL_REPLAY_COMPLETE`

---

## 1. Problem Statement

The shadow corpus was stuck in a degenerate state:
- **60 lines, 2 stocks, all mock-deterministic prices**
- No real price resolution from the database
- No ability to distinguish real outcomes from placeholder values
- `simulation_snapshot_corpus.jsonl` frozen and non-expandable

The P0-HARDRESET objective was to redesign the corpus architecture from  
`"today + wait"` → `"historical replay + real prices"` using a dedicated  
historical replay pipeline that does not touch the frozen corpus.

---

## 2. Architecture Before vs After

| Dimension | Before P0-HARDRESET | After P0-HARDRESET |
|-----------|---------------------|--------------------|
| Corpus size | 60 lines | 4500 lines (new) + 60 frozen |
| Price source | mock-deterministic | `stockQuote.close` (real DB) |
| Symbol coverage | 2 symbols | 25 symbols |
| asOfDate coverage | 2 dates | 60 historical dates |
| Horizons | unknown | 5D, 20D, 60D |
| PIT safety | none | full (asOfDate < today) |
| Mock fallback | present | NONE (hard fail on missing) |
| Frozen corpus | at risk | VERIFIED 60 lines, unchanged |

---

## 3. Deliverables Summary

### PART A — Universe Audit
- **Tool:** `scripts/p0hardreset-part-a-audit.js`
- **Result:** 247 qualifying symbols (stockQuote ≥ 180d, chip ≥ 120d, overlap ≥ 150d)
- **Artifacts:**
  - `outputs/online_validation/p0hardreset_universe_audit.json` — 247 symbols
  - `outputs/online_validation/p0hardreset_universe_audit.md` — audit summary
  - `outputs/online_validation/p0hardreset_historical_asofdate_candidates.json` — 60 asOfDates

### PART B — RealPriceOutcomeResolver
- **Module:** `src/lib/onlineValidation/RealPriceOutcomeResolver.ts`
- **Tests:** `src/lib/onlineValidation/__tests__/p0hardreset_real_price_outcome_resolver.test.ts` — **19 PASS**
- **Key properties:**
  - `RESOLVER_VERSION = 'p0hardreset-real-price-resolver-v1'`
  - PIT-safe: only reads `stockQuote` rows where `date ≤ asOfDate`
  - No mock fallback: returns `priceSource='MISSING'` or `'PENDING'` when data unavailable
  - `resolveEntryPrice(symbol, asOfDate)` → `ResolvedEntryPrice`
  - `resolveOutcomePrice(symbol, asOfDate, horizonDays)` → `ResolvedOutcomePrice`
  - `buildRealPriceOutcomeBatch()` + `validateRealPriceOutcomeBatch()`

### PART C — ShadowPredictionHistoricalReplayWriter
- **Module:** `src/lib/onlineValidation/ShadowPredictionHistoricalReplayWriter.ts`
- **Tests:** `src/lib/onlineValidation/__tests__/p0hardreset_historical_replay_writer.test.ts` — **26 PASS**
- **Key properties:**
  - `REPLAY_WRITER_VERSION = 'p0hardreset-historical-replay-writer-v1'`
  - `OUTPUT_CORPUS_FILENAME = 'p0hardreset_historical_replay_corpus.jsonl'`
  - `FROZEN_CORPUS_FILENAME = 'simulation_snapshot_corpus.jsonl'` (never written)
  - Throws if output path === frozen path
  - Skips asOfDates ≥ today (PIT safety)
  - `buildHistoricalReplayConfig()` → validates universe, dates, corpusRunId contains `'historical'`
  - `runHistoricalReplayShadowWrite(config)` → iterates symbol × asOfDate × horizon
  - `buildHistoricalReplayArtifact()` + `summarizeHistoricalReplay()`

### PART D — Corpus Generation (Execution)
- **Script:** `scripts/generate-p0hardreset-historical-replay-corpus.js`
- **Config:** 25 symbols × 60 asOfDates × 3 horizons = 4500 potential lines
- **Execution time:** 61.1s
- **Results:**

| Gate | Threshold | Actual | Status |
|------|-----------|--------|--------|
| Lines written | ≥ 1000 | 4500 | ✅ PASS |
| Unique symbols | ≥ 20 | 25 | ✅ PASS |
| Unique asOfDates | ≥ 20 | 60 | ✅ PASS |
| stockQuote.close ratio | ≥ 50% | 93.4% (4204/4500) | ✅ PASS |
| mock-deterministic | 0 | 0 | ✅ PASS |
| Error count | 0 | 0 | ✅ PASS |

- **Price source breakdown:**
  - `stockQuote.close`: 4204 (93.4%)
  - `MISSING`: 271 (6.0%)
  - `PENDING`: 25 (0.6%)
- **Output:** `outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl`
- **Artifact:** `outputs/online_validation/p0hardreset_historical_replay_artifact.json`
- **Summary:** `outputs/online_validation/p0hardreset_historical_replay_summary.md`

### PART E — Corpus Quality Gate
- **Script:** `scripts/rerun-corpus-quality-gate-on-historical-replay.js`
- **Quality gate status:** `PASS_FOR_OBSERVABILITY_ONLY`
- **This is the maximum allowed status** (not `PRODUCTION_READY` — by design)
- **Results:**

| Check | Threshold | Actual | Status |
|-------|-----------|--------|--------|
| uniqueAsOfDates | ≥ 20 | 60 | ✅ PASS |
| uniqueSymbols | ≥ 20 | 25 | ✅ PASS |
| uniqueHorizons | ≥ 3 | 3 | ✅ PASS |
| coverageRatio | ≥ 0.5 | 0.9342 | ✅ PASS |
| Forbidden claims | 0 | 0 | ✅ PASS |
| Mock-deterministic | 0 | 0 | ✅ PASS |
| Frozen corpus lines | = 60 | 60 | ✅ PASS |

- **Outputs:**
  - `outputs/online_validation/p0hardreset_corpus_quality_gate_rerun.json`
  - `outputs/online_validation/p0hardreset_corpus_quality_gate_rerun.md`

### PART F — Regression Tests
- **Test suite:** `npx jest src/lib/onlineValidation/__tests__`
  - **42 test suites, 803 tests — ALL PASS** ✅
- **Test suite:** `npx jest src/lib/data/__tests__`
  - **5 test suites, 118 tests — ALL PASS** ✅
- **P0-HARDRESET specific tests:** 45 PASS (19 resolver + 26 writer)

### PART G — Git Commit
- **Commit:** `5426c68`
- **Branch:** `main`
- **Files added:** 14
- **Insertions:** 10,097

### PART H — Final Report
- This document.

---

## 4. Safety Contract Verification

| Contract | Status |
|----------|--------|
| `simulation_snapshot_corpus.jsonl` unchanged (60 lines) | ✅ VERIFIED |
| No production DB writes | ✅ VERIFIED |
| No external API calls | ✅ VERIFIED |
| No LLM calls | ✅ VERIFIED |
| No mock-deterministic price source in new corpus | ✅ VERIFIED |
| No forbidden claims (buy/sell/roi/alpha/win_rate/guaranteed) | ✅ VERIFIED |
| No auto trading | ✅ VERIFIED |
| ManualReview* modules untouched | ✅ VERIFIED |
| P18 manual review UI proposal refused | ✅ VERIFIED |
| qualityStatus never PRODUCTION_READY | ✅ VERIFIED (`PASS_FOR_OBSERVABILITY_ONLY`) |
| New corpus writes to separate file only | ✅ VERIFIED |
| Writer throws if output === frozen path | ✅ VERIFIED (test + code) |

---

## 5. Key Invariants

1. **`simulation_snapshot_corpus.jsonl`** — frozen at 60 lines. P0-HARDRESET writes only to `p0hardreset_historical_replay_corpus.jsonl`.
2. **All new corpus lines** have `priceSource` of `stockQuote.close`, `MISSING`, or `PENDING` — never `mock-deterministic`.
3. **PIT safety** — no asOfDate ≥ today is ever processed. Entry prices use `asOfDate`; outcome prices use calendar-calculated future dates.
4. **Quality ceiling** — `PASS_FOR_OBSERVABILITY_ONLY` is the maximum permitted status. This corpus is for research observation only.
5. **No production path** — the new corpus cannot flow to production, simulation, or optimizer writes without a future explicit governance decision.

---

## 6. Corpus Artifacts Index

| File | Description | Lines |
|------|-------------|-------|
| `outputs/online_validation/p0hardreset_universe_audit.json` | 247-symbol universe audit | — |
| `outputs/online_validation/p0hardreset_universe_audit.md` | Universe audit report | — |
| `outputs/online_validation/p0hardreset_historical_asofdate_candidates.json` | 60 historical asOfDate candidates | — |
| `outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl` | Main corpus (real prices) | 4500 |
| `outputs/online_validation/p0hardreset_historical_replay_artifact.json` | Run artifact / metadata | — |
| `outputs/online_validation/p0hardreset_historical_replay_summary.md` | Generation summary | — |
| `outputs/online_validation/p0hardreset_corpus_quality_gate_rerun.json` | Quality gate result JSON | — |
| `outputs/online_validation/p0hardreset_corpus_quality_gate_rerun.md` | Quality gate report | — |
| `outputs/online_validation/simulation_snapshot_corpus.jsonl` | **FROZEN** (unchanged) | **60** |

---

## 7. Source Modules

| Module | Purpose |
|--------|---------|
| `src/lib/onlineValidation/RealPriceOutcomeResolver.ts` | PIT-safe real price resolution from stockQuote |
| `src/lib/onlineValidation/ShadowPredictionHistoricalReplayWriter.ts` | Historical replay corpus writer |
| `src/lib/onlineValidation/__tests__/p0hardreset_real_price_outcome_resolver.test.ts` | 19 resolver tests |
| `src/lib/onlineValidation/__tests__/p0hardreset_historical_replay_writer.test.ts` | 26 writer tests |
| `scripts/generate-p0hardreset-historical-replay-corpus.js` | PART D execution script |
| `scripts/rerun-corpus-quality-gate-on-historical-replay.js` | PART E quality gate script |

---

## 8. Problem Resolution

The original stuck-corpus problem is resolved:

| Before | After |
|--------|-------|
| 60 lines, 2 stocks, mock-deterministic | 4500 lines, 25 stocks, real `stockQuote.close` |
| No historical date coverage | 60 historical asOfDates (2024–2025) |
| No horizon diversity | 3 horizons: 5D, 20D, 60D |
| Cannot distinguish real vs mock | All prices traceable to source |
| Frozen corpus held all data | Frozen corpus preserved; new corpus is separate |

---

## 9. What Was NOT Done (By Design)

- **P18 manual review UI** — proposal refused. ManualReview* modules frozen.
- **Production writes** — never enabled. Corpus is observability-only.
- **Simulation corpus expansion** — `simulation_snapshot_corpus.jsonl` remains frozen at 60 lines.
- **Optimizer writes** — not enabled.
- **External data sources** — only `stockQuote` table (local DB).
- **LLM-assisted scoring** — not used. All scores are deterministic zeros from `DefaultStockQuoteCandidateProvider`.

---

## 10. Test Coverage Summary

| Test Suite | Tests | Status |
|-----------|-------|--------|
| p0hardreset_real_price_outcome_resolver | 19 | ✅ PASS |
| p0hardreset_historical_replay_writer | 26 | ✅ PASS |
| All onlineValidation suites (42 total) | 803 | ✅ PASS |
| All data suites (5 total) | 118 | ✅ PASS |

---

## 11. Corpus Quality Classification

```
qualityStatus:       PASS_FOR_OBSERVABILITY_ONLY
coverageRatio:       0.9342  (93.4% real prices)
uniqueSymbols:       25
uniqueAsOfDates:     60
uniqueHorizons:      3
totalEntries:        4500
readyCount:          4204
blockedCount:        296
forbiddenClaims:     0
mockDeterministic:   0
frozenCorpusLines:   60 (UNCHANGED)
```

---

## 12. Limitations and Notes

1. Scores are all zeros — `DefaultStockQuoteCandidateProvider` provides minimal candidates with `recommendationBucket: 'Neutral'` and all scores = 0. This is intentional for the corpus skeleton; real scoring requires full pipeline integration.
2. 271 `MISSING` price entries (6%) reflect stocks that had no `stockQuote` record for that specific date (e.g., suspended, not yet listed on that asOfDate).
3. 25 `PENDING` price entries (0.6%) reflect outcome dates that fall within the PIT gate window.
4. Universe is capped at 25 symbols (top 25 by `quoteDays` descending from the 247-symbol qualified universe).
5. `asOfDates` are 60 calendar-verified TWSE trading days from the historical candidates list.

---

## 13. Final Classification

```
P0_HARDRESET_HISTORICAL_REPLAY_COMPLETE
```

All 8 PARTS delivered. Safety contracts verified. Frozen corpus unchanged. No production writes. No forbidden claims. 803 tests pass.

---

*This corpus is for research observability only. Not investment advice. Not a trading system. No buy/sell recommendations. No ROI guarantees. No alpha claims.*
