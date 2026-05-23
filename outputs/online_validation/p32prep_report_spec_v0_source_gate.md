# Report Spec v0: source-gate

**specName:** source-gate  
**specVersion:** v0  
**specDesignDate:** 2026-05-21  
**specId:** p32prep_report_spec_v0_source_gate  
**designOnly:** true — not enforced  

> Disclaimer: DESIGN-ONLY spec. Not enforced. Does not constitute investment advice. No profit, return, or investment performance claims are made. This spec must not include buy/sell/hold/action fields.

---

## Purpose

Capture the gate result and classification for a named data source, documenting PIT-safety status, approval level, publication-lag assumptions, and schema migration state. A source-gate artifact represents the authoritative record of whether a data source has been approved to participate in the pipeline at a given phase.

---

## Governance Constraints

| Property | Value |
|----------|-------|
| entersAlphaScore | false (hard) |
| paperOnly | true |
| notInvestmentRecommendation | true |
| designOnly | true (v0 — not enforced) |

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Producing phase identifier, e.g. `P29I`, `P30`, `P32` |
| `capturedAt` | ISO-8601 datetime | Timestamp when the gate result was captured |
| `sourceName` | string | Canonical source name: `Quote` \| `Regime` \| `Chip` \| `MonthlyRevenue` \| `FinancialReport` \| `NewsEvent` |
| `gateResult` | enum | `PASS_PIT_SAFE` \| `PASS_PIT_SAFE_WITH_ASSUMPTION` \| `WARN_ASSUMPTION_REQUIRED` \| `STRUCTURAL_PLACEHOLDER_ONLY` \| `BLOCKED` \| `HIGH_RISK_SOURCE_ABSENT` |
| `entersAlphaScore` | boolean | Must be `false` for all sources at current paper-only stage |
| `disclaimer` | string | Governance disclaimer asserting this is not investment advice |

---

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `dbTable` | string | Prisma model name (e.g. `StockQuote`, `InstitutionalChip`) |
| `dateField` | string | Primary temporal gate field used for PIT comparison |
| `dateFormat` | string | Expected format (e.g. `ISO YYYY-MM-DD`) |
| `asOfDateHandling` | string | How `asOf` is normalised before the DB gate |
| `futureDataRisk` | string | Risk narrative for latent or confirmed future-data contamination |
| `publicationLagDocumented` | boolean | Whether T+N publication-lag assumption is documented |
| `migrationArtifactCreated` | boolean | Whether a DB migration artifact exists for this source |
| `migrationApplied` | boolean | Whether the migration has been applied |
| `classification` | string | Detailed classification string |
| `citedArtifacts` | string[] | Prior-phase artifact filenames informing this result |

---

## Field Type Expectations

- `capturedAt`: ISO-8601 datetime with `Z` suffix preferred
- `entersAlphaScore`: must be boolean `false` — hard constraint
- `gateResult`: one of the listed enum values; no buy/sell/hold semantics permitted
- `phase`: string matching identifier pattern `P` + digits + optional letter suffix

---

## Forbidden Fields

The following field names are forbidden in any source-gate artifact:

`buySignal`, `sellSignal`, `holdSignal`, `roi`, `winRate`, `win_rate`, `edge`, `profit`, `predictedReturn`, `outperform`, `investmentRecommendation`, `alpha` (except the structural governance term `alphaScore`)

---

## Mapped Artifacts from D1 Inventory

| Artifact | Phase | Field Mapping |
|----------|-------|---------------|
| `p29i_source_path_inventory.json` | P29I | `sourceName`, `gateResult`, `dbTable`, `dateField`, `asOfDateHandling`, `futureDataRisk` |
| `p30_chip_schema_migration_readiness.json` | P30 | `sourceName` (via `schemaModel`), `gateResult` (via `classification`), `migrationArtifactCreated`, `migrationApplied`, `entersAlphaScore` |
| `p30_reaudit_result.json` | P30 | `gateResult` (via `finalClassification`), `entersAlphaScore`, `migrationApplied` (via `chipAvailableAt.migrationApplied`) |

---

## Example Snippet (Synthesized)

```json
{
  "_note": "SYNTHESIZED EXAMPLE — not real data. Does not constitute investment advice.",
  "phase": "P29I",
  "capturedAt": "2026-05-20T09:00:00Z",
  "sourceName": "Quote",
  "gateResult": "PASS_PIT_SAFE",
  "dbTable": "StockQuote",
  "dateField": "date",
  "dateFormat": "ISO YYYY-MM-DD",
  "asOfDateHandling": "normalizePitDateToIso(asOf) applied before DB gate",
  "futureDataRisk": "Latent only if future-dated records enter DB; current sync ingests past dates only",
  "publicationLagDocumented": true,
  "entersAlphaScore": false,
  "disclaimer": "Does not constitute investment advice."
}
```

---

## P32 Consumption Note

P32 should produce one source-gate artifact per source evaluated during its dry-run execution. The `gateResult` field drives the pass/block decision; `entersAlphaScore` must be validated as `false` before any output is recorded.
