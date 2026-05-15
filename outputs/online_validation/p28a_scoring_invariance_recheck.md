# P28A Scoring Invariance Re-verification

**Generated:** 2026-05-15T03:37:37.138Z
**Status:** ✅ PASS

## Corpus Verification

### P3 Corpus (p3active_scoring_historical_replay_corpus.jsonl)
- **Total Rows:** 4500
- **Valid Rows:** 4500
- **Status:** ✅ OK

### P19 Corpus (p19active_scoring_pit_replay_corpus.jsonl)
- **Total Rows:** 4500
- **Valid Rows:** 4500
- **Status:** ✅ OK

### Combined
- **Total Rows:** 9000
- **Valid Rows:** 9000
- **Invalid Rows:** 0

## Sample Rows

### P3 Sample
| Field | Value |
|-------|-------|
| Symbol | 0055 |
| As Of Date | 2026-02-11 |
| Horizon | 5 |
| Alpha Score | 42 |
| Bucket | Avoid |

### P19 Sample
| Field | Value |
|-------|-------|
| Symbol | 0055 |
| As Of Date | 2026-02-11 |
| Horizon | 5 |
| Alpha Score | 42 |
| Bucket | Avoid |

## Overall Status

**Classification:** P28A_SCORING_INVARIANCE_VERIFIED

✅ All 9000 rows verified against P27 baseline. No invariance violations detected.

## Disclaimer

Observability only. No investment recommendations.
