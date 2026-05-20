# P29F Simulation Dependency Gate

**Phase:** P29F-HARDRESET  
**Date:** 2026-05-20

## Gate Decision Summary

| Source | Classification | Gate Decision | Simulation Tag |
|--------|---------------|---------------|----------------|
| Quote | PIT_UNVERIFIED_NEEDS_REPAIR | BLOCKER_REMAINS | UNVERIFIED |
| Regime | PIT_SAFE_VERIFIED | PERMITTED | VERIFIED |
| Chip | PIT_UNVERIFIED_NEEDS_REPAIR | BLOCKER_REMAINS | UNVERIFIED |

## Aggregate Decision

**Trust Root Blocker Remains: YES**  
**Simulation Expansion Allowed: NO**  
**Optimizer Readiness Allowed: NO**

## Required Before Promotion

1. Quote PIT date format repair — verify and fix ISO vs YYYYMMDD inconsistency in `RuleBasedStockAnalyzer.ts`
2. Chip PIT date format repair — fix gate + correct schema comment
3. Integration tests confirming same-year future record exclusion for both Quote and Chip

## Already Verified

- Regime: PIT_SAFE_VERIFIED — no repair needed

## P29E Paper Simulation Scaffold Status

| Metric | Status |
|--------|--------|
| Current mode | PAPER_ONLY |
| LeakageGateStatus | NOT_EVALUATED_SCAFFOLD_ONLY |
| Trust root | UNVERIFIED_NEEDS_REPAIR |
| Can promote to OBSERVABILITY? | NO |
| Can promote to EVALUATION? | NO |

**Blocker reason:** Quote and Chip PIT gates need repair before any simulation output can claim PIT-safe feature inputs.

## Gate Rule Summary

- ANY PIT_VIOLATION_CONFIRMED → simulation output must NOT use that source
- ANY PIT_UNVERIFIED_NEEDS_REPAIR → simulation output tagged `inputs_unverified`, blocker remains
- ALL PIT_SAFE_VERIFIED → trust-root blocker may be lifted, P29-G may proceed
- INSUFFICIENT_EVIDENCE → blocker maintained, evidence instrumentation required
