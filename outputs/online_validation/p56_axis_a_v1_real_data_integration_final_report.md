# P56 — Axis A v1 Real Data Integration Design — Final Report

**Phase:** P56  
**Classification:** `P56_AXIS_A_V1_REAL_DATA_INTEGRATION_DESIGN_COMMITTED`  
**Date:** 2026-05-26  
**Authorization:** CEO Decision 2026-05-25 P4  

---

## Pre-flight Verification

| Check | Result |
|---|---|
| Repo | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` ✅ |
| Branch | `main` ✅ |
| HEAD | `5e0fc7d` (P55 committed, P56 clean fast-forward) ✅ |
| Staged files | None ✅ |
| Dirty files | Only known: P28 drift, runtime, roadmap docs, 00-StockPlan/ ✅ |
| PROJECT_CONTEXT_LOCK scan | All hits are historical documentation references ✅ |

---

## Governance Invariants

| Flag | Value |
|---|---|
| `paperOnly` | `true` |
| `dryRunOnly` | `true` |
| `entersAlphaScore` | `false` |
| `noActualMetrics` | `true` |
| `noRealExecution` | `true` |
| `notInvestmentAdvice` | `true` |
| `noCodeModified` | `true` |
| `noDbModified` | `true` |
| `noDataImported` | `true` |

---

## Executive Summary

P56 completed a design-only Axis A v1 real-data integration plan. The Axis A v0 chain (P42–P52) is complete and CI-green as pure in-memory scaffold. V1 designs how to connect the chain entry point (`ControlledResearchSnapshot` construction) to real, PIT-safe Taiwan stock data sources from the existing Prisma schema — without modifying any production code, DB schema, or data files.

**Key conclusions:**

1. **Two sources are immediately eligible for design:** `StockQuote` (Quote) and `MarketRegimeResult` (Regime) — both have non-nullable PIT gate fields present in schema.
2. **One source is eligible with confidence caveat:** `MonthlyRevenue` — `releaseDate` is nullable/inferred, `LOW_CONFIDENCE_PIT_INFERRED` flag must propagate.
3. **One source is audit-only pending quality audit:** `NewsEvent` — `publishedAt` exists but trustLevel/symbol-linkage policy is not established (CEO P7).
4. **Two sources are blocked by authorization gates:** `FinancialReport` (no `releaseDate` column, CEO P6) and `InstitutionalChip` (nullable `availableAt`, production lag unconfirmed, CEO P8/P9).

---

## Source Eligibility Matrix

| Source | Model | State | PIT Gate | Gate Status |
|---|---|---|---|---|
| Quote | `StockQuote` | **ELIGIBLE_DESIGN_CANDIDATE** | `date` (YYYY-MM-DD) | ✅ Non-nullable in schema |
| Regime | `MarketRegimeResult` | **ELIGIBLE_DESIGN_CANDIDATE** | `date` + `pitSafetyJson` | ✅ Non-nullable + audit field |
| MonthlyRevenue | `MonthlyRevenue` | **ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING** | `releaseDate` (DateTime?) | ⚠️ Nullable, INFERRED_NEXT_MONTH_10TH caveat |
| NewsEvent | `NewsEvent` | **AUDIT_ONLY** | `publishedAt` (DateTime) | ⚠️ PIT gate present but quality policy missing |
| FinancialReport | `FinancialReport` | **BLOCKED_PENDING_PIT_METADATA** | `releaseDate` — MISSING | 🔴 Column does not exist; migration required |
| Chip | `InstitutionalChip` | **BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS** | `availableAt` (DateTime?) | 🔴 Nullable; production lag unconfirmed |

---

## Answers to P56 Design Questions

### 1. Which existing real-data sources may feed Axis A v1?

Three sources may feed the v1 input layer in design scope:
- **Quote** (`StockQuote`) — PIT-safe via `date` field
- **Regime** (`MarketRegimeResult`) — PIT-safe via `date` + `pitSafetyJson`
- **MonthlyRevenue** (`MonthlyRevenue`) — PIT-safe via `releaseDate` when non-null, with `LOW_CONFIDENCE_PIT_INFERRED` flag when releaseDateConfidence = `LOW_TO_MEDIUM`

### 2. What PIT-safe gate is required per source?

| Source | PIT Gate | Query Pattern |
|---|---|---|
| Quote | `StockQuote.date <= asOfDate` | `ORDER BY date DESC LIMIT 1` |
| Regime | `MarketRegimeResult.date <= asOfDate` | Filter by source + version |
| MonthlyRevenue | `releaseDate IS NOT NULL AND releaseDate <= asOfDate` | Must check null; flag INFERRED |
| NewsEvent | `publishedAt <= asOfDate` | Audit-only; not simulation-eligible |
| FinancialReport | `releaseDate` column required — does not exist | BLOCKED |
| Chip | `availableAt IS NOT NULL AND availableAt <= asOfDate` | BLOCKED — nullable + unconfirmed lag |

### 3. What data fields are allowed into research snapshot input?

**Quote:** `stockId`, `date`, `close`, `open`, `high`, `low`, `volume`, `change`, `transactions`, `tradeValue`  
**Regime:** `date`, `regimeLabel`, `confidence`, `pitSafetyJson`, `source`, `version`  
**MonthlyRevenue:** `year`, `month`, `revenue`, `yoyGrowth`, `momGrowth`, `releaseDate`, `releaseDateSource`, `releaseDateConfidence`

### 4. What fields remain forbidden?

All 20 forbidden fields remain forbidden at every layer:
`recommendation`, `action`, `buy`, `sell`, `hold`, `targetPrice`, `ROI`, `PnL`, `winRate`, `edge`, `alphaScore`, `score`, `forecast`, `expectedReturn`, `benchmark`, `optimizer`, `backtest`, `outcomePrice`, `returnPct`, `profit`

### 5. What source states are blocked / eligible / audit-only?

See Source Eligibility Matrix above. Summary:
- ELIGIBLE: Quote, Regime, MonthlyRevenue (with caveat)
- AUDIT_ONLY: NewsEvent
- BLOCKED: FinancialReport, Chip

### 6. What future implementation files are needed (not created in P56)?

| File | Role | Phase |
|---|---|---|
| `src/lib/research/snapshot/v1/SourceInputFact.ts` | Core `SourceInputFact<T>` type | P57 |
| `src/lib/research/snapshot/v1/adapters/QuoteAdapter.ts` | Quote → fact | P57 |
| `src/lib/research/snapshot/v1/adapters/RegimeAdapter.ts` | Regime → fact | P57 |
| `src/lib/research/snapshot/v1/adapters/MonthlyRevenueAdapter.ts` | MonthlyRevenue → fact + LOW_CONFIDENCE | P57 |
| `src/lib/research/snapshot/v1/index.ts` | Re-exports | P57 |
| `src/lib/research/snapshot/v1/ResearchSnapshotInputBuilder.ts` | Assembles ControlledResearchSnapshot | P58 |

### 7. What tests are required in a later implementation round?

16 test groups across P57 and P58 (see design doc for full list). Key groups:
- T57.2–3: QuoteAdapter PIT boundary enforcement
- T57.6–9: MonthlyRevenueAdapter all eligibility branches + LOW_CONFIDENCE flag
- T57.10–11: All adapters: non-mutation, frozen output, forbidden-fields scan
- T58.1–3: Builder: all-ELIGIBLE, partial-BLOCKED, all-BLOCKED
- T58.4: Builder: LOW_CONFIDENCE caveat visible in SnapshotReadout

### 8. What explicit user authorizations are required before DB/migration/source import work?

| Authorization Phrase | Unlocks |
|---|---|
| `YES apply FinancialReport releaseDate migration to dev DB` | FinancialReport adapter design + implementation |
| `YES apply Chip availableAt migration to dev DB` | InstitutionalChip adapter design |
| `CHIP_LAG_CONFIRMED` (production logs) | ChipAdapter ELIGIBLE upgrade |
| `YES begin NewsEvent quality and symbol-linkage audit` | NewsEvent AUDIT_ONLY → ELIGIBLE upgrade path |

---

## PIT Safety Principles (Design Invariants)

1. No source record may feed a `SnapshotReadout` unless its PIT gate field value is `<=` `asOfDate`
2. `NULL` PIT gate field = `BLOCKED`. Never infer PIT boundary from `createdAt` alone
3. Adapter returns `null` → builder assigns `BLOCKED`, never a fallback `ELIGIBLE`
4. `LOW_CONFIDENCE_PIT_INFERRED` must propagate: adapter → builder → readout → report
5. Adapter modules must have zero DB/network/FS imports — they transform structs only
6. All adapter output types must pass the 20-field forbidden scan as a test invariant

---

## V1 Architecture (Design)

```
[DB: StockQuote]      ─→ [QuoteAdapter]          ─┐
[DB: MarketRegimeResult] → [RegimeAdapter]          ├→ [ResearchSnapshotInputBuilder] → [ControlledResearchSnapshot]
[DB: MonthlyRevenue]  ─→ [MonthlyRevenueAdapter] ─┘         │
(query layer = caller)   (pure, no DB imports)           [P42-P52 chain unchanged]
                                                              │
                                                   [SnapshotExportDiffReport]
```

**Key invariant:** The v0 chain stages (P43–P52) remain **completely unchanged**. Only the `ControlledResearchSnapshot` construction at the chain entry point changes in v1.

---

## Scope Confirmation

P56 is design-only. **Not modified:**

- `src/**` — no changes
- `tests/**` — no changes
- `prisma/**` — no changes
- `data/**`, `scripts/**`, `runtime/**`, `logs/**` — no changes
- `CEO-Decision.md`, `CTO-Analysis.md`, `roadmap.md` — no changes

**P56 output files:**
1. `outputs/online_validation/p56_axis_a_v1_real_data_integration_design.json` ✅
2. `outputs/online_validation/p56_axis_a_v1_real_data_integration_design.md` ✅
3. `outputs/online_validation/p56_axis_a_v1_real_data_integration_final_report.md` ✅ (this document)

---

## Axis Balance Note

Current Axis A : B ratio ≈ 12:4. P56 is design-only (no Axis A `src/` round). Before P57 implementation, verify whether another Axis B round is needed per the anti-axis-monopoly rule (CEO Decision 2026-05-25).

---

**Next phase:** `P57_AXIS_A_V1_SOURCE_ADAPTER_CONTRACT_STUB`  
**Classification:** `P56_AXIS_A_V1_REAL_DATA_INTEGRATION_DESIGN_COMMITTED`
