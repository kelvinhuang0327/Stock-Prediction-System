# P29I Forbidden Claims Scan

**Phase:** P29I — Quote / Regime / Chip PIT Validation Audit  
**Captured:** 2026-05-20T09:02:21Z  
**Result:** `CLEAN_NO_VIOLATIONS`  
**Disclaimer:** This scan verifies that P29I audit files do not make investment advice or performance claims. It does not evaluate the trading effectiveness of any strategy.

---

## Scanned Files

| File | Status |
|------|--------|
| `src/lib/onlineValidation/p29i/PitSafetyRules.ts` | ✅ CLEAN |
| `src/lib/onlineValidation/p29i/QuoteRegimeChipPitAuditScanner.ts` | ✅ CLEAN |
| `src/lib/onlineValidation/__tests__/p29i_quote_regime_chip_pit_audit.test.ts` | ✅ CLEAN |
| All `outputs/online_validation/p29i_*.md/json` | ✅ CLEAN |

---

## Forbidden Term Categories Scanned

- **Investment actions:** buy / sell / hold / invest / trade / order / position / allocation / recommendation
- **Performance claims:** profit / roi / win rate / sharpe / outperform / predicted gain / edge / backtest result
- **Return claims:** return% / annual return / cumulative return / CAGR
- **Future predictions:** will go up / will increase / will outperform / expected to

---

## Violations

**None.** No P29I artifact makes any investment advice or predictive performance claim.

---

## False Positives Resolved

1. **`alphaScore`** in scanner/tests — structural pipeline governance term, not a performance claim.
2. **`profit`, `outperform`, `win rate`, `roi`, `sharpe`, `predicted gain`** in test file (line ~244) — these appear inside a `forbiddenTerms` array that T12 asserts do NOT appear in scanner output. They are absence-check values, not claims.

---

## Verdict

`CLEAN_NO_VIOLATIONS` — All P29I files comply with the no-forbidden-claims constraint.
