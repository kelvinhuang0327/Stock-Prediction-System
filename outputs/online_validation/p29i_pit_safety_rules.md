# P29I PIT Safety Rules (PSR-01 through PSR-15)

**Phase:** P29I — Quote / Regime / Chip PIT Validation Audit  
**Generated:** 2026-05-20T09:02:21Z  
**Source:** `src/lib/onlineValidation/p29i/PitSafetyRules.ts`  
**Disclaimer:** This document describes structural audit rules for data integrity. It does not constitute investment advice and makes no claim of predictive performance.

---

## Rule Table

| ID     | Category                | Mandatory | FailOnViolation | Description |
|--------|-------------------------|-----------|-----------------|-------------|
| PSR-01 | DATE_INTEGRITY          | ✅        | ✅              | Source must have a date/asOfDate field |
| PSR-02 | DATE_INTEGRITY          | ✅        | ✅              | Date format must be consistent between storage and gate comparison |
| PSR-03 | FUTURE_FIELD_REJECTION  | ✅        | ✅              | No future-price fields (outcomePrice, forecastReturn, horizonReturn…) |
| PSR-04 | FUTURE_FIELD_REJECTION  | ✅        | ✅              | No future-volume fields (futureVolume, volumeOutcome…) |
| PSR-05 | FUTURE_FIELD_REJECTION  | ✅        | ✅              | No future-regime label fields (nextRegime, futureRegime…) |
| PSR-06 | LABEL_CONTAMINATION     | ✅        | ✅              | No post-outcome label fields (outcomeLabel, targetLabel, classLabel…) |
| PSR-07 | LABEL_CONTAMINATION     | ✅        | ✅              | No realized-return fields used as features (realizedReturn, actualReturn…) |
| PSR-08 | GATE_EFFECTIVENESS      | ✅        | ✅              | PIT gate must exist in DB query path (pipeline sources only) |
| PSR-09 | GATE_EFFECTIVENESS      | ✅        | ✅              | asOf must propagate correctly from caller to DB query (pipeline sources only) |
| PSR-10 | ALPHA_SCORE_GOVERNANCE  | ✅        | ✅              | Only PIT_SAFE_VERIFIED sources may enter alphaScore |
| PSR-11 | ALPHA_SCORE_GOVERNANCE  | ✅        | ✅              | FinancialReport must remain blocked from alphaScore |
| PSR-12 | ALPHA_SCORE_GOVERNANCE  | ✅        | ✅              | NewsEvent must remain blocked from alphaScore |
| PSR-13 | ALPHA_SCORE_GOVERNANCE  | ✅        | ✅              | MonthlyRevenue must not enter alphaScore (structural placeholder only) |
| PSR-14 | PUBLICATION_LAG         | ❌        | ❌              | Publication lag assumption must be documented when T+0 data assumed available |
| PSR-15 | SIMULATION_BOUNDARY     | ✅        | ✅              | Simulation must enforce paperOnly=true, dryRun=true (no live orders) |

---

## Forbidden Field Pattern Groups

### FUTURE_PRICE_PATTERNS
`outcomePrice`, `forecastReturn`, `horizonReturn`, `futurePrice`, `futureReturn`, `predictedReturn`, `targetReturn`, `forwardReturn`, `nextReturn`

### FUTURE_VOLUME_PATTERNS
`futureVolume`, `volumeOutcome`, `nextVolume`, `forecastVolume`, `projectedVolume`

### FUTURE_REGIME_PATTERNS
`nextRegime`, `futureRegime`, `regimeOutcome`, `predictedRegime`, `forecastRegime`

### LABEL_CONTAMINATION_PATTERNS
`outcomeLabel`, `targetLabel`, `classLabel`, `futureLabel`, `predictionTarget`, `yLabel`, `trainLabel`

### REALIZED_RETURN_PATTERNS
`realizedReturn`, `actualReturn`, `exPostReturn`, `tradeOutcome`, `positionOutcome`, `portfolioOutcome`

---

## Application Notes

- PSR-01, PSR-02, PSR-08, PSR-09: **Only apply to pipeline sources** (`permittedInAlphaScore: true`). Absent/blocked sources are exempt by design — no gate needed for data not in the pipeline.
- PSR-10: **Absent sources pass by design** — `permittedInAlphaScore: false` means the source is correctly excluded.
- PSR-14: Non-mandatory. `WARN_ASSUMPTION_REQUIRED` is issued (not `FAIL_LEAKAGE_RISK`) when lag assumption is documented.
- PSR-11/12/13: Source-specific governance rules applied only to the named source.
