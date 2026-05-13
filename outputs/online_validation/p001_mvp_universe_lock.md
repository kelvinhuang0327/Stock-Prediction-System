# P0-01 MVP Universe Lock

**Task**: P0-01 — MVP Universe Lock
**Date**: 2026-05-07 | **asOfDate**: 2026-05-07

**Safety Labels**: P0-01 | MVP universe lock | research tool only | no auto trading | no precision prediction claim | no performance claim | no edge claim | no DB write | no external API | no LLM call

---

## Universe Tier Criteria

| Tier | Min Quote Count | Requires Chip | Excludes Future Dates | Expected Count |
|---|---|---|---|---|
| **WalkForward** | >= 500 | NO | YES | ~185 stocks |
| **TierA** | >= 250 | YES | YES | ~244 stocks |
| **Limited** | >= 60 | NO | YES | varies |
| **Insufficient** | < 60 | - | YES | - |

## Classification Rules

1. WalkForward checked first (quoteCount >= 500)
2. TierA: quoteCount 250–499 AND hasInstitutionalChip
3. Limited: quoteCount 60–249
4. Insufficient: quoteCount < 60

## Module

- `src/lib/data/MvpUniverseLock.ts` — 4 exports: `buildMvpUniverseCriteria`, `classifyMvpUniverseTier`, `filterUniverseByMvpTier`, `validateMvpUniverseCoverage`
- 83 tests PASS

---

*Research tool only. Tier classification is data coverage measurement only. Not investment advice.*
