# Report Spec v0: pit-audit

**specName:** pit-audit  
**specVersion:** v0  
**specDesignDate:** 2026-05-21  
**specId:** p32prep_report_spec_v0_pit_audit  
**designOnly:** true — not enforced  

> Disclaimer: DESIGN-ONLY spec. Not enforced. Does not constitute investment advice. No profit, return, or investment performance claims are made. This spec must not include buy/sell/hold/action fields.

---

## Purpose

Capture the result of a Point-in-Time (PIT) safety audit across one or more data sources. A pit-audit artifact documents rule-by-rule checks (PSR-01..PSR-15 or equivalent), forbidden-field scans, and the overall PIT-safety classification of each audited source. It is a structural data-integrity gate — it does not claim predictive performance, return, or any investment outcome.

---

## Governance Constraints

| Property | Value |
|----------|-------|
| `entersAlphaScore` | false (hard — no source is promoted via this artifact alone) |
| `paperOnly` | true |
| `notInvestmentRecommendation` | true |
| designOnly | true (v0 — not enforced) |

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Producing phase identifier, e.g. `P29I`, `P29F`, `P30` |
| `capturedAt` | ISO-8601 datetime | Timestamp of the audit scan |
| `overallResult` | enum | `ALL_PIT_SAFE` \| `PARTIAL_PASS` \| `WARN` \| `BLOCKED` |
| `sourceOutputs` | array | Per-source audit results (see Per-Source Item structure below) |
| `disclaimer` | string | Governance disclaimer asserting this is not investment advice |

### Per-Source Item (`sourceOutputs[]`) — Required Sub-Fields

| Field | Type | Description |
|-------|------|-------------|
| `sourceName` | string | Canonical source name: `Quote` \| `Regime` \| `Chip` \| `MonthlyRevenue` \| ... |
| `result` | enum | `PASS_PIT_SAFE` \| `PASS_PIT_SAFE_WITH_ASSUMPTION` \| `WARN_ASSUMPTION_REQUIRED` \| `BLOCKED` \| `STRUCTURAL_PLACEHOLDER_ONLY` |
| `forbiddenFieldsFound` | string[] | Must be `[]` (empty) to achieve `PASS_PIT_SAFE` |
| `ruleChecks` | array | `[{ruleId, passed, detail}]` — one entry per rule evaluated |

### Per-Source Item — Optional Sub-Fields

| Field | Description |
|-------|-------------|
| `assumptionNotes` | string[] — documented assumptions (e.g. publication lag) |
| `reportLine` | string — one-line human-readable summary |

---

## Optional Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `scannerVersion` | string | Scanner implementation version, e.g. `p29i-audit-scanner-v1` |
| `allowedAlphaScoreSources` | string[] | Sources confirmed PIT_SAFE_VERIFIED for alphaScore pathway |
| `blockedSources` | string[] | Sources explicitly blocked from alphaScore pathway |
| `ruleRegistry` | string | Reference to rule definition file |
| `forbiddenFieldPatternGroups` | object | Named groups of forbidden field patterns used by scanner |

---

## Field Type Expectations

- `overallResult`: one of the listed enum values; no buy/sell/hold semantics
- `sourceOutputs`: non-empty array with one entry per audited source
- `forbiddenFieldsFound`: must be `[]` to achieve `PASS_PIT_SAFE`
- `capturedAt`: ISO-8601 datetime with `Z` suffix preferred
- `entersAlphaScore` per source: must remain `false` unless explicitly upgraded by a governance gate

---

## Rule Reference (PSR-01..PSR-15)

The existing rule set from `p29i_pit_safety_rules.md` is the reference implementation for this spec. Key categories:

| Category | Rules | Fail-on-Violation |
|----------|-------|-------------------|
| DATE_INTEGRITY | PSR-01, PSR-02 | Yes |
| FUTURE_FIELD_REJECTION | PSR-03, PSR-04, PSR-05 | Yes |
| LABEL_CONTAMINATION | PSR-06, PSR-07 | Yes |
| GATE_EFFECTIVENESS | PSR-08, PSR-09 | Yes |
| ALPHA_SCORE_GOVERNANCE | PSR-10, PSR-11, PSR-12, PSR-13 | Yes |
| PUBLICATION_LAG | PSR-14 | No (warning only) |
| SIMULATION_BOUNDARY | PSR-15 | Yes |

---

## Forbidden Fields

`buySignal`, `sellSignal`, `holdSignal`, `roi`, `winRate`, `win_rate`, `edge`, `profit`, `predictedReturn`, `outperform`, `investmentRecommendation`, `alpha` (except structural governance term `alphaScore`)

---

## Mapped Artifacts from D1 Inventory

| Artifact | Phase | Field Mapping |
|----------|-------|---------------|
| `p29i_pit_audit_scan.json` | P29I | `overallResult`, `sourceOutputs` (Quote/Regime/Chip with PSR-01..15 ruleChecks), `disclaimer`, `scannerVersion`, `allowedAlphaScoreSources`, `blockedSources` |
| `p29i_test_baseline.json` | P29I | Companion test-execution record; confirms audit rules are test-covered |
| `p30_reaudit_result.json` | P30 | `overallResult` (via `finalClassification`), source outputs (via `chipAvailableAt`, `monthlyRevenueBackfill`), `entersAlphaScore` |

---

## Example Snippet (Synthesized)

```json
{
  "_note": "SYNTHESIZED EXAMPLE — not real data. Does not constitute investment advice.",
  "phase": "P29I",
  "capturedAt": "2026-05-20T09:00:00Z",
  "scannerVersion": "p29i-audit-scanner-v1",
  "overallResult": "ALL_PIT_SAFE",
  "allowedAlphaScoreSources": ["Quote", "Regime", "Chip"],
  "blockedSources": ["FinancialReport", "NewsEvent"],
  "sourceOutputs": [
    {
      "sourceName": "Quote",
      "result": "PASS_PIT_SAFE",
      "forbiddenFieldsFound": [],
      "ruleChecks": [
        { "ruleId": "PSR-01", "passed": true, "detail": "Date field 'date' present" },
        { "ruleId": "PSR-08", "passed": true, "detail": "PIT gate present in DB query path" },
        { "ruleId": "PSR-15", "passed": true, "detail": "Simulation boundary enforced" }
      ],
      "reportLine": "Quote: PASS_PIT_SAFE — ISO-to-ISO gate, asOf propagated"
    }
  ],
  "disclaimer": "Does not constitute investment advice."
}
```

---

## P32 Consumption Note

When P32 executes its dry-run, any source-level PIT audit performed should produce an artifact conforming to this spec. The `forbiddenFieldsFound` field in each `sourceOutputs` entry serves as the machine-readable pass/fail signal for that source. The `allowedAlphaScoreSources` list must not expand without an explicit governance gate approval.
