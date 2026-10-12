# P29C Corpus Expansion Gate Design

**Paper design** | *Not investment advice*

## Current State
`simulation_snapshot_corpus.jsonl`: 60 entries, 2 symbols, **BLOCKED**

## Blocked Until (all must pass)
1. P26F4 MonthlyRevenue import + post-import coverage PASS
2. PIT registry: no HIGH_RISK source in alphaScore
3. Coverage threshold met (symbols × dates × horizons)
4. Outcome isolation gate PASS (no leakage)
5. Frozen corpus sha256 unchanged
6. CTO approval token provided

## Key Rule
**Corpus expansion ≠ optimizer.** Expanding corpus only increases observability coverage. Optimizer requires separate additional gates.
