# P0-01 Next Execution Order — 2026-05-07

**Task**: P0-01 — As-of Data Gate / Future-Date Quarantine / MVP Universe Lock
**Date**: 2026-05-07

**Safety Labels**: P0-01 | research tool only | no auto trading | no performance claim | no edge claim

---

## Completed This Round

- [x] `src/lib/data/AsOfDataGate.ts` — 6 exports, 2 error classes, injectable Prisma client
- [x] `src/lib/data/MvpUniverseLock.ts` — 4 exports, tier classification
- [x] `src/lib/data/__tests__/p001_as_of_data_gate.test.ts` — 46 tests PASS
- [x] `src/lib/data/__tests__/p001_mvp_universe_lock.test.ts` — 37 tests PASS
- [x] All 11 P0-01 output artifacts created

## Next Round: P0-02

**Title**: Shadow Prediction Log Contract

**Goals**:
1. Each day: save candidate data coverage scores and reasons with asOfDate
2. Log data version, data gaps, target horizon
3. Enable future posterior validation
4. No trading advice, no performance claims

**After P0-02**:
- P0-03: Minimal API integration (integrate asOf gate into /api/strategy/screen, /api/stocks/[id]/detail)
- P0-04: Data pipeline fix (remove future-date rows at source)

## Known Issues / Technical Debt

| Issue | Priority | Notes |
|---|---|---|
| Future-date rows in DB (2026-05-18) | HIGH | Query layer excludes; pipeline fix needed |
| 1970-era anomalous dates | MEDIUM | Quarantine policy needed |
| /api/strategy/screen missing asOf gate | MEDIUM | P0-03 |
| /api/stocks/[id]/history external API | LOW | Cannot add as-of gate; P0-03 |

---

*Research tool only. Not investment advice. Not a trading system.*
