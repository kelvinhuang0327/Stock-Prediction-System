# P32 — MonthlyRevenue Dry-run Sample (Spec-conformant Output)

**Phase:** P32  
**Date:** 2026-05-21  
**Conforms to:** `p32prep_report_spec_v0_dry_run_sample` v0  

> Disclaimer: Structural audit contract only. Does not constitute investment advice. No profit, return, or investment performance claims are made. MonthlyRevenue `entersAlphaScore = false`. ALWAYS. Results must not be used as buy/sell/hold signals or investment recommendations.

---

## Spec Alignment

This artifact is the primary P32 output conforming to the P32PREP dry-run-sample v0 report spec.

| Spec field | Required | This artifact |
|------------|----------|---------------|
| `phase` | ✅ required | `P32` |
| `capturedAt` | ✅ required | `2026-05-21T00:00:00.000Z` |
| `mode` | ✅ required | `source-present-dry-run` |
| `paperOnly` | ✅ required (must be true) | `true` |
| `dryRun` | ✅ required (must be true) | `true` |
| `entersAlphaScore` | ✅ required (must be false) | `false` |
| `notInvestmentRecommendation` | ✅ required (must be true) | `true` |
| `dryRunStatus` | ✅ required | `READY` |
| `overallClassification` | ✅ required | `MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY` |
| `disclaimer` | ✅ required | Present |
| `rowCount` | optional | `2143` |
| `blockedRows` | optional | `0` |
| `releaseDateCoverage` | optional | `{count: 2143, pct: 100}` |
| `releaseDateSourceCoverage` | optional | `{count: 2143, pct: 100, policy: INFERRED_NEXT_MONTH_10TH}` |
| `releaseDateConfidenceCoverage` | optional | `{count: 2143, pct: 100, confidence: LOW}` |
| `auditConclusion` | optional | Present |
| `source` | optional | `MonthlyRevenue` |
| `dbQueryMethod` | optional | `sqlite3 prisma/dev.db` |
| `dbQuery` | optional | Present |

---

## Governance Flags

| Flag | Value |
|------|-------|
| `entersAlphaScore` | **false** |
| `paperOnly` | **true** |
| `dryRun` | **true** |
| `notInvestmentRecommendation` | **true** |

---

## Dry-run Result Summary

| Metric | Value |
|--------|-------|
| rowCount | 2143 |
| blockedRows | 0 |
| dryRunStatus | READY |
| overallClassification | MONTHLY_REVENUE_SOURCE_PRESENT_DRY_RUN_READY |
| releaseDateCoverage | 100% (2143/2143) |
| releaseDateSourceCoverage | 100% (2143/2143) |
| releaseDateConfidenceCoverage | 100% (2143/2143) |
| policy | INFERRED_NEXT_MONTH_10TH |
| confidence | LOW |

---

## Input Lineage

| Input | Reference |
|-------|-----------|
| P31 dry-run sample | `outputs/online_validation/p31_monthly_revenue_dry_run_sample.json` |
| P31 gate scan | `outputs/online_validation/p31_monthly_revenue_dry_run_gate_scan.json` |
| P32PREP spec | `outputs/online_validation/p32prep_report_spec_v0_dry_run_sample.json` |

---

## Exclusions (Governance-driven)

The following field categories are intentionally excluded per no-investment-advice governance:

- `roi`, `winRate`, `win_rate`, `edge`, `profit`, `predictedReturn` — investment performance claims forbidden
- `buySignal`, `sellSignal`, `holdSignal` — buy/sell/hold/action semantics forbidden
- `outperform`, `beat`, `guaranteed` — prediction quality claims forbidden
- `alpha` (except structural `alphaScore` governance term) — forbidden
