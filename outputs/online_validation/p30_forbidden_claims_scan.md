# P30 Forbidden Claims Scan

**Phase:** P30
**Captured:** 2026-05-20T00:00:00.000Z
**Classification:** CLEAN

## Scan Method

All P30 source, test, migration, and output files were scanned for investment-related terms.

## Findings

| Term | Context | Verdict |
|---|---|---|
| `buy` | In `buy/sell/hold signals` prohibition, or field names `foreignBuy`/`trustBuy`/`dealerBuy` | BENIGN |
| `sell` | In `buy/sell/hold signals` prohibition | BENIGN |
| `profit` | In `No profit, return, or investment performance claims` prohibition | BENIGN |
| `ROI` | In `Does not compute ROI, profit...` prohibition | BENIGN |
| `alpha` | In `entersAlphaScore = false` field/invariant, not performance claim | BENIGN |
| `outperformance` | In `does not compute... outperformance` prohibition | BENIGN |
| `win-rate` | In `does not compute... win-rate` prohibition | BENIGN |

## No Positive Claims Found

- No "guaranteed return" or "guaranteed profit"
- No "buy recommendation" or "sell recommendation"
- No "expected return" or "expected profit"
- No "outperform market" claims
- No "investment advice" offered (only prohibited)

## Conclusion

**CLEAN** — all investment-related terms appear exclusively in prohibition/disclaimer context or as technical field names. No P30 artifact makes any positive investment claim.

---
*This scan report itself does not constitute investment advice.*
