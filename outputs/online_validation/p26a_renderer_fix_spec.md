# P26A Renderer Fix Spec

**Renderer Version:** p26a-corpus-renderer-v1

## Rules

| Condition | Action | Outcome |
|-----------|--------|---------|
| factorSnapshot non-empty AND reasonSnapshot is single generic token | Apply enrichReasonFromExistingFactors | ENRICHED |
| factorSnapshot empty | Keep original | FALLBACK_EMPTY |
| reasonSnapshot already rich | Keep as-is | ALREADY_RICH |

## Forbidden

- No alphaScore change
- No bucket change
- No DB write
- No corpus mutation

> Does not constitute investment advice.
