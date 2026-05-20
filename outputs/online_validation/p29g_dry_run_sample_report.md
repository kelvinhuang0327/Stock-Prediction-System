# P29G Dry-Run Report

**Report ID:** p29g-report-p29g-dry-run-p29g-fixture-v1-2026-01-15-p29g-dry-run-candidate-001-1779263742924  
**Generated At:** 2026-05-20T07:55:42.924Z  
**Contract Version:** p29g-dry-run-runner-v1

---

## Governance Status

| Check | Result |
|-------|--------|
| Governance Check | ✅ PASS |
| Leakage Gate | ✅ PASS (status: `NOT_EVALUATED_SCAFFOLD_ONLY`) |
| Input Validation | ✅ PASS |
| AlphaScore Gating | ✅ PASS |

## Boundary Flags

| Flag | Value |
|------|-------|
| dryRunOnly | true |
| paperOnly | true |
| notInvestmentRecommendation | true |
| scaffoldOnly | true |
| scoringMutation | false |
| corpusMutation | false |
| optimizerExecuted | false |
| realBacktestExecuted | false |

## Source Coverage (Count Only — No Performance Values)

| Status | Count |
|--------|-------|
| PIT_SAFE_VERIFIED | 3 |
| HIGH_RISK_SOURCE_ABSENT | 2 |
| STRUCTURAL_PLACEHOLDER_ONLY | 1 |
| BLOCKED | 0 |
| **Total** | **6** |

**HIGH_RISK_SOURCE_ABSENT sources:** FinancialReport, NewsEvent  
**BLOCKED sources:** none  
**entersAlphaScore=true count:** 0 (must be 0 for HIGH_RISK/BLOCKED)


## Observability Notes

- PAPER ONLY — no real simulation performed.
- DRY RUN ONLY — no DB, corpus, or scoring mutations.
- NOT INVESTMENT RECOMMENDATION — this report contains no performance claims.
- Leakage gate scaffold note: SCAFFOLD ONLY: PIT validation for Quote/Regime/Chip is the NEXT hard gate (Quote/Regime/Chip PIT Validation Audit). FinancialReport/NewsEvent remain HIGH_RISK_SOURCE_ABSENT and must not enter alphaScore.
- Source classifications: 6 sources evaluated.
- HIGH_RISK_SOURCE_ABSENT sources: FinancialReport, NewsEvent.
- FinancialReport and NewsEvent remain HIGH_RISK_SOURCE_ABSENT — entersAlphaScore=false.
- Next hard gate: Quote/Regime/Chip PIT Validation Audit (Axis A).

---

*This report contains no investment advice, no performance claims, and no buy/sell/hold signals.*  
*It is a governance audit artifact only.*
