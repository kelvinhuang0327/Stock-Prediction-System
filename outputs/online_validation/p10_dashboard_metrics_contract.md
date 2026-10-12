# P10 Dashboard-Ready Metrics Contract Report

**Generated:** 2026-05-11T06:55:18.139Z
**Contract Version:** dashboard-metrics-contract-v0
**Dashboard Run ID:** p10-dashboard-metrics-contract-20260511-001
**Validation Status:** PASS

---

## Dashboard Overview

| Metric | Value |
|--------|-------|
| Total Corpus Entries | 24 |
| Unique As-Of Dates | 4 |
| Unique Symbols | 2 |
| Unique Horizons | 3 |
| Coverage Ratio | 58.3% |
| Quality Gate Status | **DATA_LIMITED** |
| Trend Stability | STABLE_FOR_OBSERVABILITY_ONLY |

---

## Readiness Cards

| Card | Status |
|------|--------|
| Corpus Metrics Readiness | OK |
| Quality Gate Readiness | **DATA_LIMITED** |
| Trend Stability Readiness | READY_FOR_OBSERVABILITY_DASHBOARD |
| **Final Dashboard Readiness** | **DATA_LIMITED** |

**Disclaimers:**
- Dashboard readiness does not imply production readiness.
- Dashboard readiness does not imply optimizer readiness.
- All metrics are observability-only. No trading signals. No performance claims.

> isProductionReady: false
> isOptimizerReady: false

---

## Quality Warnings

Total: **6** warnings | High severity: **5**

🔴 **[HIGH]** Quality gate status is DATA_LIMITED. Reasons: horizonCoverageGap=0.875 > maxHorizonCoverageGap=0.35 => DATA_LIMITED

🔴 **[HIGH]** horizonCoverageGap=0.875 exceeds allowed maximum. 60D horizon coverage is severely limited (coverageRatio=0.125).

🔴 **[HIGH]** 60D horizon has only 1 ready snapshot out of 8. 60D coverage will not mature until sufficient real-time data accumulates.

🟡 **[MEDIUM]** Corpus is fixture-driven (synthetic as-of dates). All entries are simulation snapshots, not live outcome data. No real market outcomes are present.

🔴 **[HIGH]** This dashboard does NOT represent production readiness. Dashboard readiness differs from production readiness. Do not use for live trading decisions.

🔴 **[HIGH]** This dashboard does NOT represent optimizer readiness. Data is observability-only. Optimizer is not permitted to consume these metrics.

---

## Guardrails

| Guardrail | Active |
|-----------|--------|
| noProductionWrite | true |
| noSimulationWrite | true |
| noOptimizerWrite | true |
| noPerformanceClaim | true |
| noTradingSignal | true |
| observabilityOnly | true |
| allGuardrailsActive | **true** |

---

## Known Limitations

1. **60D Horizon Coverage**: Only 1/8 ready (horizonCoverageGap=0.875). The 60D window cannot be validated until real outcome data accumulates over 60 trading days.
2. **Fixture-Driven Corpus**: All 24 entries use synthetic as-of dates. No real market outcomes are present. This corpus represents simulation state only.
3. **2-Symbol Universe**: Only 2330 and 2454 are represented. Coverage is not representative of the full Taiwan stock universe.
4. **DATA_LIMITED Status**: The quality gate has flagged this corpus as DATA_LIMITED. No optimizer, no production, no performance claims may be derived.

---

## Next Recommended Direction

1. Continue accumulating real-time snapshot corpus across live trading dates.
2. Allow 60D horizon windows to mature (requires 60 trading days of real data per symbol).
3. When horizonCoverageGap drops below 0.35, re-evaluate quality gate status.
4. Expand symbol universe beyond 2330 and 2454 to improve representativeness.
5. Dashboard metrics remain observability-only until quality gate reaches PASS_FOR_OBSERVABILITY_ONLY.
