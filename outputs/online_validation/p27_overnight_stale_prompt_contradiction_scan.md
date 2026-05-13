# P27  Stale Prompt / Contradiction ScanOvernight 

**Date:** 2026-05-18 UTC

## Results

| Category | Count |
|----------|-------|
| BLOCKER | **0** |
| WARNING | 1 |
| INFO | 3 |

## Blockers

_None found._ Governance is clean:
- No artifact marked import-ready while freeze marker says WAITING
- No empty drop-zone scan as 24h primary task
- No contradicting next prompts in active routing
- No DB write allowed without token

## Warnings

| ID | Issue | Action |
|----|-------|--------|
| W1 | `p26f4_next_prompt_when_source_present.md` is superseded | Labeled SUPERSEDED; canonical is `p26_next_prompt_source_arrival_only.md` |

## Info

| ID | Issue |
|----|-------|
| I1 | 3 historical route-decision artifacts (`p26f4_or_ labeled HISTORICAL |p26a_*`) 
| I2 | 50 artifacts missing json/md pairs (pre-dates pair convention) |
| I3 | 267+ unknown-type artifacts in historical phase reports |

## Final Classification: `NO_BLOCKERS_FOUND`

---
*Observability only. No investment recommendations.*
