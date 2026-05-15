# P28E — Reason Underoutput Closure

**Phase**: P28E-REASON-UNDEROUTPUT-CLOSURE-HARDRESET  
**Trigger**: P28D complete — renderer validated, integrated paths confirmed  
**Base Commit**: P28D commit (to be created)

---

## Objective

Close all remaining reason underoutput cases that are still producing short, generic, or low-information rendered text in the active corpus despite the P28C renderer repair.

P28C fixed two major families:
1. `scoreSnapshot_zero_label` — enriched via `inferDirectionFromMATrend()` fallback
2. `mixed_signals_no_template` — enriched via `detectMixedSignal()` + `buildMixedSignalNote()`

P28E targets residual underoutput cases that may remain.

---

## Scope

### What P28E Will Investigate

1. **Residual ALREADY_RICH short cases**: Rows where `reasonRendererOutcome === 'ALREADY_RICH'` but `renderedText.length < 40` — may indicate overly permissive `ALREADY_RICH` guard
2. **Low factor-count ENRICHED cases**: Rows where `factorSnapshot.length < 3` but scorer returned `ENRICHED` — may indicate factor data sparsity
3. **Corpus coverage metric**: Run batch renderer over full P3 + P19 corpus, compute distribution of `reasonRendererOutcome` and `renderedReasonFactorCount`
4. **New repair families**: If new families emerge, document them for P28F

### What P28E Will NOT Change

- DB (prisma/dev.db) — FROZEN
- All 5 corpus JSONL files — FROZEN
- RuleBasedStockAnalyzer.ts — FROZEN
- SignalFusionEngine.ts — FROZEN
- ActiveScoringSnapshotBuilder.ts — FROZEN

### Allowed Changes

- `P26ACorpusReasonRenderer.ts` — renderer logic only
- `P26AReasonFactorEnrichmentUtils.ts` — enrichment utilities only
- `P5WalkthroughReviewUtils.ts` — if scoreSnapshot / factorSnapshot pass-through needs refinement
- `P26ACorpusRowAdapter.ts` — adapter only

---

## Entry Conditions

- P28D_POST_RENDERER_VALIDATION_COMPLETE ✅
- All frozen file SHA256 confirmed ✅
- Full suite 2997/2997 PASS ✅

---

## Phase Structure

### P28E-A: Corpus Outcome Distribution Report
- Run batch renderer over all P3 (4500) + P19 (4499) rows
- Report distribution: `ENRICHED` / `ALREADY_RICH` / `FALLBACK_EMPTY` counts + %
- Report `renderedReasonFactorCount` distribution (p25, p50, p75, p95)
- Identify residual underoutput families

### P28E-B: Repair Plan
- Categorize residual families
- Propose targeted renderer/enrichment fixes
- No code changes in Part B — plan only

### P28E-C: Implement Fixes
- Fix renderer/enrichment for identified families
- Bump `CORPUS_REASON_RENDERER_VERSION` to `p26a-corpus-renderer-v3` if structural change
- Run existing 2997-test suite — must still PASS

### P28E-D: Post-Repair Validation
- Re-run corpus outcome distribution
- Confirm underoutput rate reduced
- Confirm frozen files unchanged

---

## Continuation Command

```
P28E-REASON-UNDEROUTPUT-CLOSURE-HARDRESET

Start from P28E-A. Base commit: [P28D commit hash].

Goals:
1. Run batch renderer over full P3+P19 corpus (4500+4499 rows)
2. Report ENRICHED/ALREADY_RICH/FALLBACK_EMPTY distribution
3. Identify and categorize any residual underoutput families
4. Propose repair plan

Frozen: prisma/dev.db, all *.jsonl corpus, RuleBasedStockAnalyzer.ts, SignalFusionEngine.ts, ActiveScoringSnapshotBuilder.ts
Renderer files: allowed changes in P26ACorpusReasonRenderer.ts, P26AReasonFactorEnrichmentUtils.ts
No investment claims. No buy/sell signals. Observational only.
```

---

*Not investment advice. Not a trading system.*
