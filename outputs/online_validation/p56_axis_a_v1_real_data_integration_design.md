# P56 — Axis A v1 Real Data Integration Design

**Phase:** P56  
**Date:** 2026-05-26  
**Authorization:** CEO Decision 2026-05-25 P4 — Axis A v1 real-data integration design  
**Classification:** `P56_AXIS_A_V1_REAL_DATA_INTEGRATION_DESIGN_READY`

---

## 1. Purpose

Design how the Axis A v0 scaffold pipeline can connect to trusted real Taiwan stock data sources in a future implementation round. **No `src/`, `tests/`, `prisma/`, `data/`, `scripts/`, or migration files are modified in P56.**

---

## 2. Governance Invariants

| Flag | Value |
|---|---|
| `paperOnly` | `true` |
| `dryRunOnly` | `true` |
| `entersAlphaScore` | `false` |
| `noActualMetrics` | `true` |
| `noRealExecution` | `true` |
| `notInvestmentAdvice` | `true` |

---

## 3. Axis A v0 Chain Summary

The v0 chain (P42–P52) is a complete, CI-green scaffold of 11 stages:

| Stage | Module | Input → Output |
|---|---|---|
| P42 | `SnapshotReader` | `ControlledResearchSnapshot` → `SnapshotReadout` (eligibleSources, blockedSources, auditOnlySources) |
| P43 | `SnapshotFormatter` | `SnapshotReadout` → formatted display strings |
| P44 | `SnapshotEmitter` | Formatted readout → emitted lines |
| P45 | `SnapshotLogWriter` | Emitted lines → `SnapshotLogRecord` (19 fields) |
| P46 | `SnapshotLogCollector` | `SnapshotLogRecord[]` → frozen collector |
| P47 | Pipeline E2E | End-to-end integration test coverage |
| P48 | `SnapshotBatchRunner` | Batch symbols → `SnapshotBatchReport` |
| P49 | `SnapshotLogExporter` | Collector → `SnapshotLogExport` (governance summary, records, symbols) |
| P50 | `SnapshotExportFilter` | `SnapshotLogExport` → filtered subset |
| P51 | `SnapshotExportSerializer` | `SnapshotLogExport` → `SnapshotExportSerializedEnvelope` |
| P52 | `SnapshotExportDiff` | `diffSnapshotLogExports(before, after)` → `SnapshotExportDiffReport` |

**V0 gap:** All stages operate on caller-supplied `ControlledResearchSnapshot` stubs. No real DB source data flows through any stage. The chain is scaffold-complete but not data-connected.

**V1 goal:** Connect the chain entry point (`ControlledResearchSnapshot` construction) to actual Prisma source adapters. Stages P43–P52 remain **completely unchanged**.

---

## 4. Source Eligibility Matrix

| Source | Prisma Model | Candidate State | PIT Gate | Gate Status |
|---|---|---|---|---|
| Quote | `StockQuote` | **ELIGIBLE_DESIGN_CANDIDATE** | `date` (YYYY-MM-DD) | Present in schema, non-nullable |
| Regime | `MarketRegimeResult` | **ELIGIBLE_DESIGN_CANDIDATE** | `date` (YYYY-MM-DD) + `pitSafetyJson` | Present in schema, pitSafetyJson audit field exists |
| MonthlyRevenue | `MonthlyRevenue` | **ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING** | `releaseDate` (DateTime?) | Present, nullable — releaseDateSource/Confidence must be checked |
| NewsEvent | `NewsEvent` | **AUDIT_ONLY_OR_BLOCKED_PENDING_QUALITY** | `publishedAt` (DateTime, non-null) | PIT gate mechanically available; quality/symbol-linkage audit not completed |
| FinancialReport | `FinancialReport` | **BLOCKED_PENDING_PIT_METADATA** | `releaseDate` — DOES NOT EXIST | DB migration authorization required (CEO P6) |
| Chip | `InstitutionalChip` | **BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS** | `availableAt` (DateTime?) | Present but nullable; DB migration + production lag confirmation required (CEO P8/P9) |

---

## 5. Per-Source Detail

### 5.1 Quote — ELIGIBLE_DESIGN_CANDIDATE

**Prisma model:** `StockQuote`

**PIT analysis:** `StockQuote.date` (YYYY-MM-DD string) is the trading date. Records are immutable after the exchange closes. A query of `WHERE date <= asOfDate ORDER BY date DESC LIMIT 1` is PIT-safe for any given `asOfDate`.

**Allowed input fields:**
- `stockId` (→ normalized `symbol` string)
- `date` (→ PIT gate comparison against `asOfDate`)
- `close`, `open`, `high`, `low`, `volume`, `change`, `transactions`, `tradeValue`

**Forbidden adaptations:**
- Deriving `targetPrice` from `close`
- Computing return or ROI from `close` values
- Producing a buy/sell signal from `change`

**Design note:** Adapter returns `null` when no record exists at or before `asOfDate`. This is not an error — it means data is simply absent for that PIT boundary. Builder assigns `SourceInputState = BLOCKED`.

---

### 5.2 Regime — ELIGIBLE_DESIGN_CANDIDATE

**Prisma model:** `MarketRegimeResult`

**PIT analysis:** `MarketRegimeResult.date` is the regime computation date. The existing `pitSafetyJson` nullable column provides a structured audit trail for PIT compliance — this field was already designed for this exact purpose. `source` and `version` enable multi-version regime tracking.

**Allowed input fields:**
- `date` (→ PIT gate)
- `regimeLabel` (Bull / Bear / Sideways / Unknown — descriptive)
- `confidence` (numeric, 0–1)
- `pitSafetyJson` (passthrough audit JSON)
- `source`, `version` (adapter versioning)

**Forbidden adaptations:**
- Using `regimeLabel` as a buy/sell signal
- Combining `confidence` with `alphaScore`
- Claiming regime predicts future returns

**Design note:** `regimeLabel` and `confidence` are descriptive context, not predictive signals. The audit artifact must never state that a Bull regime implies expected return or investment opportunity.

---

### 5.3 MonthlyRevenue — ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING

**Prisma model:** `MonthlyRevenue`

**PIT analysis:** `releaseDate` (DateTime?, P17 PIT gate) was added as a nullable column in a previous phase. `releaseDateSource` distinguishes between `INFERRED_NEXT_MONTH_10TH` (estimated TWSE deadline) and `EXPLICIT` (confirmed). `releaseDateConfidence` (`LOW_TO_MEDIUM` / `HIGH`) gates the confidence tier.

**Eligibility rules:**

| Condition | SourceInputState | Flag |
|---|---|---|
| `releaseDate IS NOT NULL` AND `releaseDate <= asOfDate` AND confidence HIGH | `ELIGIBLE` | None |
| `releaseDate IS NOT NULL` AND `releaseDate <= asOfDate` AND confidence LOW_TO_MEDIUM | `ELIGIBLE` | `LOW_CONFIDENCE_PIT_INFERRED` |
| `releaseDate IS NULL` | `BLOCKED` | `MISSING_RELEASE_DATE` |
| `releaseDate > asOfDate` | `BLOCKED` | `FUTURE_RELEASE_NOT_YET_PUBLIC` |

**Allowed input fields:**
- `year`, `month`
- `revenue`, `yoyGrowth`, `momGrowth`
- `releaseDate`, `releaseDateSource`, `releaseDateConfidence`

**Forbidden adaptations:**
- Using `yoyGrowth` as a return estimate
- Using `revenue` to derive expected profit
- Treating `LOW_TO_MEDIUM` confidence as equivalent to `HIGH` without flagging

**Design note:** The `LOW_CONFIDENCE_PIT_INFERRED` flag must propagate through the adapter, builder, readout, and final report. It must NEVER be silently suppressed.

---

### 5.4 NewsEvent — AUDIT_ONLY_OR_BLOCKED_PENDING_QUALITY

**Prisma model:** `NewsEvent`

**PIT analysis:** `publishedAt` is non-nullable — the PIT gate is mechanically available. However, CEO P7 identifies that source-present ≠ quality-ready. `trustLevel` values (`official|mainstream|secondary|unknown`) exist but a filtering policy has not been established. `relatedSymbols` is stored as a JSON string — linkage accuracy is unvalidated.

**Current state:** `AUDIT_ONLY` — can appear in `auditOnlySources` list of `SnapshotReadout` but must not be assigned `SourceInputState = ELIGIBLE`.

**Upgrade path:** Complete CEO P7 NewsEvent quality audit → define trustLevel filtering policy → validate symbol linkage accuracy → only then upgrade to ELIGIBLE.

**Allowed audit fields:** `publishedAt`, `trustLevel`, `source`, `title`, `relatedSymbols`

---

### 5.5 FinancialReport — BLOCKED_PENDING_PIT_METADATA

**Prisma model:** `FinancialReport`

**Schema finding:** No `releaseDate`, `filingDate`, or `announceDate` field exists in `FinancialReport`. The model has only `year`, `quarter`, `eps`, `netIncome`, `grossMargin`, `operatingMargin`, `createdAt`. Using `(year, quarter)` as a PIT boundary is **not acceptable** — financial reports in Taiwan can be filed weeks to months after quarter end.

**Authorization required:** `YES apply FinancialReport releaseDate migration to dev DB` (CEO P6)

**Unblock path:**
1. Add `releaseDate DateTime?` column to `FinancialReport` model
2. Apply migration to dev DB
3. Backfill `releaseDate` from TWSE/MOPS public announcement dates
4. Add `releaseDateConfidence` field (design to mirror MonthlyRevenue)
5. Revisit eligibility per P56 rules above

**Design note:** `eps`, `netIncome`, `grossMargin`, `operatingMargin` are high-value fundamental inputs. The PIT gap is a schema governance issue, not a data quality issue. No workarounds (e.g., using `createdAt` as a proxy) are permitted.

---

### 5.6 Chip — BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS

**Prisma model:** `InstitutionalChip`

**Schema finding:** `availableAt DateTime?` (P30 PIT gate) exists but is nullable. P30 assumed T+0 data is available at ~17:30 TWN (09:30 UTC). This assumption has NOT been validated against production sync logs (`CHIP_LAG_CONFIRMED` not yet granted).

**Authorization required:** `YES apply Chip availableAt migration to dev DB` (CEO P8)  
**Production evidence required:** `CHIP_LAG_CONFIRMED` from production sync logs (CEO P9)

**Unblock path:**
1. Apply `availableAt` migration to dev DB
2. Acquire production sync logs
3. Confirm T86 actual lag empirically (vs assumed 17:30 TWN)
4. Upgrade `availableAt` to `NOT NULL` with confirmed constraint
5. Revisit eligibility

**Design note:** `foreignBuy`, `trustBuy`, `dealerBuy`, `totalBuy`, `holders400`, `holders1000` are high-value institutional flow indicators. The blocking conditions are real and consequential. Do not attempt workarounds.

---

## 6. Axis A v1 Input Layer Design Contract

### 6.1 Architecture

```
[Real DB Records] ─→ [SourceAdapterLayer] ─→ [ResearchSnapshotInputBuilder] ─→ [ControlledResearchSnapshot]
                                                                                          │
                                                                              [P42-P52 chain unchanged]
                                                                                          │
                                                                              [SnapshotExportDiffReport]
```

The **SourceAdapterLayer** is purely functional — adapters transform typed input structs, they do **not** query the DB. The query responsibility belongs to the caller (a future service/repository layer).

### 6.2 New Concepts (to be implemented in P57+)

**`SourceInputFact<T>`** — Typed, PIT-validated wrapper:

```typescript
// NOT implemented in P56 — design only
type SourceInputFact<T> = {
  readonly sourceType: string;             // "Quote" | "Regime" | "MonthlyRevenue"
  readonly asOfDate: string;               // YYYY-MM-DD, PIT boundary
  readonly pitGateField: string;           // "date" | "releaseDate" | etc.
  readonly pitGateValue: string;           // actual field value from DB record
  readonly pitGateStatus: string;          // "PIT_SAFE" | "LOW_CONFIDENCE_PIT_INFERRED"
  readonly data: T;                        // typed source data (no forbidden fields)
};
```

**`SourceAdapterContract<TInput, TFact>`** — Per-source adapter interface:

```typescript
// NOT implemented in P56 — design only
interface SourceAdapterContract<TInput, TFact> {
  adapt(input: TInput, asOfDate: string): SourceInputFact<TFact> | null;
  // Returns null when: input has no PIT-safe record, PIT gate is null, or gate > asOfDate
}
```

**`ResearchSnapshotInputBuilder`** — Assembles `ControlledResearchSnapshot`:

```typescript
// NOT implemented in P56 — design only
function buildResearchSnapshotInput(
  symbol: string,
  asOfDate: string,
  quoteFact: SourceInputFact<QuoteFactData> | null,
  regimeFact: SourceInputFact<RegimeFactData> | null,
  monthlyRevenueFact: SourceInputFact<MonthlyRevenueFactData> | null,
): ControlledResearchSnapshot;
// Sets SourceInputState per source: non-null → ELIGIBLE (or ELIGIBLE_WITH_CAVEAT), null → BLOCKED
// Governance invariants always set regardless of source states
```

### 6.3 PIT Safety Principles

1. **No future data:** No source record may feed a `SnapshotReadout` unless its PIT gate field value is `<=` `asOfDate`.
2. **No null bypass:** `NULL` PIT gate field = `BLOCKED`. Never infer PIT boundary from `createdAt` alone.
3. **No fallback ELIGIBLE:** Adapter returns `null` → builder assigns `BLOCKED`, never a default `ELIGIBLE`.
4. **Explicit caveat propagation:** `LOW_CONFIDENCE_PIT_INFERRED` must surface in artifact, readout, and report.
5. **Pure adapters:** Adapter modules must have zero DB/network/FS imports — they transform structs only.
6. **Forbidden-fields invariant:** All adapter output types must pass the 20-field forbidden scan as a test invariant.

---

## 7. Future File Map

| File | Role | Phase |
|---|---|---|
| `src/lib/research/snapshot/v1/SourceInputFact.ts` | Core `SourceInputFact<T>` type | P57 |
| `src/lib/research/snapshot/v1/adapters/QuoteAdapter.ts` | Quote → SourceInputFact | P57 |
| `src/lib/research/snapshot/v1/adapters/RegimeAdapter.ts` | Regime → SourceInputFact | P57 |
| `src/lib/research/snapshot/v1/adapters/MonthlyRevenueAdapter.ts` | MonthlyRevenue → SourceInputFact + LOW_CONFIDENCE flag | P57 |
| `src/lib/research/snapshot/v1/index.ts` | Re-exports all v1 types | P57 |
| `src/lib/research/snapshot/v1/ResearchSnapshotInputBuilder.ts` | Assembles ControlledResearchSnapshot from facts | P58 |
| `src/lib/research/__tests__/p57_axis_a_v1_source_adapter_contract.test.ts` | ≥16 tests for SourceInputFact + adapters | P57 |
| `src/lib/research/__tests__/p58_axis_a_v1_snapshot_input_builder.test.ts` | ≥16 tests for builder: null→BLOCKED, non-null→ELIGIBLE, caveat propagation | P58 |

**Files NOT modified in P56:** All of the above. Design only.

---

## 8. Authorization Gates

| Gate | Authorization Phrase | Blocked Item |
|---|---|---|
| FinancialReport PIT migration | `YES apply FinancialReport releaseDate migration to dev DB` | FinancialReport adapter + eligibility |
| Chip availableAt migration | `YES apply Chip availableAt migration to dev DB` | InstitutionalChip adapter + eligibility |
| Chip lag confirmation | `CHIP_LAG_CONFIRMED` (production logs) | ChipAdapter ELIGIBLE upgrade |
| NewsEvent quality audit | `YES begin NewsEvent quality and symbol-linkage audit` | NewsEvent AUDIT_ONLY → ELIGIBLE upgrade |

---

## 9. Required Future Tests Summary

| Group | Description | Phase |
|---|---|---|
| T57.1 | SourceInputFact shape, PIT field presence, no forbidden fields | P57 |
| T57.2–3 | QuoteAdapter: PIT-safe → ELIGIBLE fact; future date → null | P57 |
| T57.4–5 | RegimeAdapter: valid → ELIGIBLE fact; no record → null | P57 |
| T57.6–9 | MonthlyRevenueAdapter: all eligibility rule branches + LOW_CONFIDENCE flag | P57 |
| T57.10–11 | All adapters: non-mutation, frozen output, JSON-safe, no DB imports, forbidden-fields scan | P57 |
| T58.1–3 | Builder: all ELIGIBLE, partial BLOCKED, all BLOCKED | P58 |
| T58.4 | Builder: MonthlyRevenue LOW_CONFIDENCE flag visible in SnapshotReadout | P58 |
| T58.5–6 | Builder: governance invariants always set; forbidden fields absent | P58 |

---

## 10. Scope Confirmation

P56 is design-only. The following were NOT modified:

- No `src/**` files created or modified
- No `tests/**` files created or modified
- No `prisma/**` files created or modified
- No `data/**`, `scripts/**`, `runtime/**`, `logs/**` files touched
- No migration files created
- No `CEO-Decision.md`, `CTO-Analysis.md`, `roadmap.md` modified

P56 output files committed:
1. `outputs/online_validation/p56_axis_a_v1_real_data_integration_design.json`
2. `outputs/online_validation/p56_axis_a_v1_real_data_integration_design.md` — this document
3. `outputs/online_validation/p56_axis_a_v1_real_data_integration_final_report.md`

---

## 11. Axis Balance Note

Current Axis A : B ratio after P52–P55 ≈ 12:4. P56 is design-only and does not count as a new Axis A implementation round. Before P57 implementation, assess whether another Axis B round is needed to maintain the anti-axis-monopoly rule per CEO Decision 2026-05-25.

---

**Next recommended phase:** `P57_AXIS_A_V1_SOURCE_ADAPTER_CONTRACT_STUB`
