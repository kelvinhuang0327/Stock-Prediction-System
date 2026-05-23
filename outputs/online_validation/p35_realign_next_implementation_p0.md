# P35-REALIGN — Designated Next Implementation P0

**Phase:** P35-REALIGN  
**Date:** 2026-05-21  
**Designated P0:** Candidate A  

---

## Decision: Candidate A — Controlled Feature Consumer Readiness DESIGN for MonthlyRevenue

**Touches:** `src/lib/onlineValidation/` only  
**Hard invariant:** `entersAlphaScore = false`

### Justification

Candidate A is the only option that satisfies the CEO mandate to stop paper-only rounds and deliver a `src/`-touching task. Candidate B (FinancialReport PIT Metadata Migration Readiness DESIGN) remains design-only — it would be a seventh consecutive paper round, which is explicitly prohibited by the CEO Decision (2026-05-21 late review).

MonthlyRevenue is the most mature PROMOTE candidate: P32 produced FULL_CONFORMANCE dry-run results with all 2143 rows eligible, a stratified PIT-traced sample (`p32_monthly_revenue_dry_run_sample.json`), and a defined `releaseDate` PIT gate. The Feature Consumer Readiness DESIGN task would create the scaffold for reading MonthlyRevenue rows through the PIT gate in `src/lib/onlineValidation/`, with no scoring system integration (`entersAlphaScore=false` enforced at the code level). This is the minimum viable `src/`-touching step that advances Axis A (Taiwan stock PIT-safe prediction) without modifying scoring, DB, schema, corpus, or fixtures.

FinancialReport (Candidate B) cannot be acted upon without migration authorization and remains BLOCKED. NewsEvent follows MonthlyRevenue in the feature consumer queue.

---

## Next Round Mandate (record verbatim)

> **MANDATE:** Next round MUST touch `src/`. No further design-only round until at least one code-touching round lands.
>
> **Carry-forward invariants:**
> - `entersAlphaScore = false` — enforced in code, not just configuration
> - `paperOnly = true`
> - `dryRun = true`
> - `notInvestmentRecommendation = true`
>
> **Carry-forward prohibitions:**
> - No DB / schema / migration apply
> - No corpus modifications
> - No scoring file changes (`RuleBasedStockAnalyzer.ts`, `SignalFusionEngine.ts`, `ActiveScoringSnapshotBuilder.ts`)
> - No GUI, optimizer, or real backtest
> - No new branches or worktrees

---

## Scope Boundary for the src/ Task

| Allowed | Forbidden |
|---------|-----------|
| `src/lib/onlineValidation/` — new or modified files | `src/lib/scoring/**` |
| `outputs/online_validation/` — validation artifacts | `src/lib/**` outside onlineValidation/ |
| `tests/` — if new consumer tests required | `prisma/**` |
| roadmap + CTO-Analysis status updates | Any migration apply |

---

## Input Artifacts for the src/ Task

| Artifact | Purpose |
|----------|---------|
| `outputs/online_validation/p32_monthly_revenue_dry_run_sample.json` | PIT-traced sample rows for consumer integration test design |
| `outputs/online_validation/p32prep_report_spec_v0_source_gate.json` | Spec contract for source gate integration |
| `outputs/online_validation/p32_monthly_revenue_source_present_dry_run.json` | Full dry-run gate result (2143 rows, 100% coverage) |

---

*Governance: entersAlphaScore=false. No investment advice. No buy/sell/hold semantics.*
