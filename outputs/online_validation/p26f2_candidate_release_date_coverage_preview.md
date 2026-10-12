# P26F2-HARDRESET: Candidate Release Date Coverage Preview

## Phase
P26F2-HARDRESET

## Date
2026-05-13

## Results

| Metric | Value |
|---|---|
| P3 corpus rows | 4500 |
| P19 corpus rows | 4500 |
| Candidate rows | 2143 |
| Candidate date range | 2026-03-10 → 2026-04-10 |
| Corpus asOfDate range | null → null |
| P3 matched rows | 0 |
| P19 matched rows | 0 |
| Total matched rows | 0 |
| Coverage ratio | 0 |
| Coverage classification | **NONE** |

## Reason No Coverage

All candidateReleaseDates (2026-03-10, 2026-04-10) exceed corpus asOfDates max (2026-02-11). Data gap: DB only has 2026-02 and 2026-03 revenue data, but corpus covers 2025-10 to 2026-02.

## Data Gap Analysis

| Field | Value |
|---|---|
| DB data months | 2026-02, 2026-03 |
| Corpus asOfMonths | 2025-10 to 2026-02 |
| Candidate dates range | 2026-03-10 to 2026-04-10 |
| Gap type | DB_DATA_TOO_RECENT_FOR_CORPUS_PERIOD |
| Required data months | 2025-09 through 2026-01 (for asOfDates 2025-10 to 2026-02) |
| Required candidate dates | 2025-10-10 through 2026-02-10 |

## Classification

**P26F2_RELEASE_DATE_CANDIDATE_NO_COVERAGE**

## Status

**PREVIEW_COMPLETE** ✅
