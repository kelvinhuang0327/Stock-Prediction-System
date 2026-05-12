# P25 MonthlyRevenue Query Gate Smoke

**Phase:** P25-HARDRESET Part D  
**Generated:** 2026-05-12T10:10:49.362Z  
**Validation Status:** `PASS`

## Summary

| Metric | Value |
|--------|-------|
| Total cases | 13 |
| PASS | 13 |
| FAIL | 0 |

## Smoke Cases

- [PASS] `QG-01a` — Feb 2026 | asOf one day before releaseDate (2026-03-09) → unavailable: releaseDate=2026-03-10 > asOfDate=2026-03-09 — unavailable
- [PASS] `QG-01b` — Feb 2026 | asOf = releaseDate (2026-03-10) → available: releaseDate=2026-03-10 <= asOfDate=2026-03-10 — available
- [PASS] `QG-01c` — Feb 2026 | asOf one day after releaseDate (2026-03-11) → available: releaseDate=2026-03-10 <= asOfDate=2026-03-11 — available
- [PASS] `QG-02a` — Mar 2026 | asOf one day before releaseDate (2026-04-09) → unavailable: releaseDate=2026-04-10 > asOfDate=2026-04-09 — unavailable
- [PASS] `QG-02b` — Mar 2026 | asOf = releaseDate (2026-04-10) → available: releaseDate=2026-04-10 <= asOfDate=2026-04-10 — available
- [PASS] `QG-03a` — Feb 2026 | allowInferred=false | asOf 2026-03-09 → unavailable: releaseDate=2026-03-10 > asOfDate=2026-03-09 — unavailable
- [PASS] `QG-03b` — Feb 2026 | allowInferred=false | asOf 2026-03-10 → available: releaseDate=2026-03-10 <= asOfDate=2026-03-10 — available
- [PASS] `QG-04` — Feb 2026 | asOf 2026-01-01 (well before) → unavailable: releaseDate=2026-03-10 > asOfDate=2026-01-01 — unavailable
- [PASS] `QG-05a` — Feb 2026 | asOf 2026-05-12 (current date) → available: releaseDate=2026-03-10 <= asOfDate=2026-05-12 — available
- [PASS] `QG-05b` — Mar 2026 | asOf 2026-05-12 (current date) → available: releaseDate=2026-04-10 <= asOfDate=2026-05-12 — available
- [PASS] `QG-DB-09` — DB gate: 0 rows available before 2026-03-10
- [PASS] `QG-DB-10` — DB gate: 1070 rows available on 2026-03-10
- [PASS] `QG-DB-11` — DB gate: 1070 rows available after 2026-03-10

## DB-Level Gate Verification

| Query | Count | Expected | Status |
|-------|-------|----------|--------|
| Feb 2026 rows available asOf 2026-03-09 | 0 | 0 | ✅ |
| Feb 2026 rows available asOf 2026-03-10 | 1070 | 1070 | ✅ |
| Feb 2026 rows available asOf 2026-03-11 | 1070 | 1070 | ✅ |

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
