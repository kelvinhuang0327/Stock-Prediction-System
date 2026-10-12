# Report Spec v0: dry-run-sample

**specName:** dry-run-sample  
**specVersion:** v0  
**specDesignDate:** 2026-05-21  
**specId:** p32prep_report_spec_v0_dry_run_sample  
**designOnly:** true — not enforced  

> Disclaimer: DESIGN-ONLY spec. Not enforced. Does not constitute investment advice. No profit, return, or investment performance claims are made. This spec must not include buy/sell/hold/action fields.

---

## Purpose

Capture the output of a paper-only dry-run execution: what rows were evaluated, how many passed or were blocked, and which coverage metadata fields were populated. A dry-run-sample artifact documents a simulation boundary — no real DB writes, no corpus mutations, no scoring activations occurred.

---

## Governance Constraints

| Property | Value |
|----------|-------|
| `entersAlphaScore` | **false** (hard — MonthlyRevenue and all current sources excluded) |
| `paperOnly` | **true** (hard) |
| `dryRun` | **true** (hard) |
| `notInvestmentRecommendation` | **true** (hard) |
| designOnly | true (v0 — not enforced) |

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Producing phase identifier, e.g. `P31`, `P32` |
| `capturedAt` | ISO-8601 datetime | Timestamp of the dry-run execution |
| `mode` | string | Execution mode; expected value for MonthlyRevenue: `source-present-dry-run` |
| `paperOnly` | boolean | Must be `true` |
| `dryRun` | boolean | Must be `true` |
| `entersAlphaScore` | boolean | Must be `false` |
| `notInvestmentRecommendation` | boolean | Must be `true` |
| `dryRunStatus` | enum | `READY` \| `BLOCKED` \| `PARTIAL` \| `WAITING_FOR_AUTHORIZATION` |
| `overallClassification` | string | Machine-readable outcome label, e.g. `MONTHLY_REVENUE_DRY_RUN_READY` |
| `disclaimer` | string | Governance disclaimer asserting this is not investment advice |

---

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `rowCount` | integer | Total rows evaluated |
| `blockedRows` | integer | Rows that did not pass the gate |
| `releaseDateCoverage` | object | `{count, pct}` — releaseDate field coverage |
| `releaseDateSourceCoverage` | object | `{count, pct, policy}` — releaseDateSource coverage |
| `releaseDateConfidenceCoverage` | object | `{count, pct, confidence}` — releaseDateConfidence coverage |
| `auditConclusion` | string | One-sentence human-readable conclusion |
| `authorizationReceived` | boolean | For authorization-gated dry-runs |
| `gate` | string | Gate status string (e.g. `WAITING_FOR_USER_AUTHORIZATION`) |
| `dbQueryMethod` | string | Method used to query DB (e.g. `sqlite3 prisma/dev.db`) |
| `dbQuery` | string | SQL query executed for the scan |
| `policy` | string | Release date inference policy (e.g. `INFERRED_NEXT_MONTH_10TH`) |
| `runId` | string | Unique run identifier for fixture pinning |
| `source` | string | Source model name if targeting a single source |
| `executionNote` | string | Narrative note about how the dry-run was executed |

---

## Field Type Expectations

- `paperOnly`: must be boolean `true` — hard constraint
- `dryRun`: must be boolean `true` — hard constraint
- `entersAlphaScore`: must be boolean `false` — hard constraint
- `notInvestmentRecommendation`: must be boolean `true` — hard constraint
- `rowCount`: non-negative integer
- `blockedRows`: non-negative integer
- `capturedAt`: ISO-8601 datetime with `Z` suffix preferred

---

## Forbidden Fields

`buySignal`, `sellSignal`, `holdSignal`, `roi`, `winRate`, `win_rate`, `edge`, `profit`, `predictedReturn`, `outperform`, `investmentRecommendation`, `alpha` (except structural governance term `alphaScore`)

---

## Mapped Artifacts from D1 Inventory

| Artifact | Phase | Field Mapping |
|----------|-------|---------------|
| `p31_monthly_revenue_dry_run_sample.json` | P31 | `mode`, `paperOnly`, `dryRun`, `entersAlphaScore`, `notInvestmentRecommendation`, `dryRunStatus`, `overallClassification`, `rowCount`, `blockedRows`, `releaseDateCoverage`, `auditConclusion` |
| `p31_monthly_revenue_dry_run_gate_scan.json` | P31 | `source`, `dbQueryMethod`, `dbQuery`, `rowCount` (totalRows), `blockedRows`, `policy`, `overallClassification`, `entersAlphaScore`, `paperOnly`, `dryRun` |
| `p30_monthly_revenue_backfill_dry_run.json` | P30 | `dryRun`, `dryRunStatus` (gate), `authorizationReceived`, `dbQueryMethod`, `executionNote`, `entersAlphaScore` |
| `p29g_dry_run_sample_output.json` | P29G | `runId`, `mode` (simulationMode), `paperOnly`, `dryRun`, `entersAlphaScore`, `notInvestmentRecommendation` |

---

## Example Snippet (Synthesized)

```json
{
  "_note": "SYNTHESIZED EXAMPLE — not real data. Does not constitute investment advice.",
  "phase": "P32",
  "capturedAt": "2026-05-22T00:00:00Z",
  "mode": "source-present-dry-run",
  "paperOnly": true,
  "dryRun": true,
  "entersAlphaScore": false,
  "notInvestmentRecommendation": true,
  "rowCount": 2143,
  "blockedRows": 0,
  "releaseDateCoverage": { "count": 2143, "pct": 100 },
  "releaseDateSourceCoverage": { "count": 2143, "pct": 100, "policy": "INFERRED_NEXT_MONTH_10TH" },
  "releaseDateConfidenceCoverage": { "count": 2143, "pct": 100, "confidence": "LOW" },
  "dryRunStatus": "READY",
  "overallClassification": "MONTHLY_REVENUE_DRY_RUN_READY",
  "auditConclusion": "All 2143 MonthlyRevenue rows pass source-present dry-run gate. No leakage risk detected.",
  "disclaimer": "Does not constitute investment advice."
}
```

---

## P32 Consumption Note

This spec is the **primary output contract** for P32 MonthlyRevenue Source-present Dry-run Execution. P32 should produce exactly one artifact conforming to this spec. The `overallClassification` field is the pass/block signal. `entersAlphaScore=false` must be validated and recorded before the artifact is committed.
