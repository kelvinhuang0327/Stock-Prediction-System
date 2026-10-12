# T-05E Candidate Data Adapter — Contract

**Task:** T-05E — PIT-safe Candidate Data Adapter for WalkForwardEngine
**Safety Labels:** T-05E | PIT-safe candidate data adapter | read-only candidate snapshots | sourceDate <= rebalanceDate | no future data | no DB write | no external API | no LLM call | no strategy mutation | no performance claim | no edge claim | no H001-H012

---

## Adapter Path

`src/lib/backtest/CandidateDataAdapter.ts`

---

## Exported Functions

| Function | Purpose |
|---|---|
| `normalizeCandidateSnapshotDateKey(input)` | Normalize Date/string → YYYY-MM-DD. Throws `InvalidCandidateSnapshotDateKeyError` on invalid input. |
| `mapStockDataToCandidateSnapshot(row, rebalanceDate, sourceLabel?)` | Map raw DB row → observability-only `CandidateSnapshot`. No strategy fields. |
| `validateCandidateSnapshotFreshness(rebalanceDate, snapshot)` | Validate sourceDate ≤ rebalanceDate. Returns PASS/WARN/FAIL. |
| `validateCandidateSnapshotCoverage(snapshots)` | Compute coverage summary. Returns PASS/WARN/FAIL. |
| `loadCandidateSnapshotsForDate(rebalanceDate, client, config?)` | PIT-safe async DB query. Only reads data ≤ rebalanceDate. |

---

## PIT Safety Contract

- `sourceDate` must not exceed `rebalanceDate`
- DB query uses `date: { lte: rebalanceDateYYYYMMDD }` filter
- Future sourceDate → flagged `INVALID_FUTURE_DATE`, never silently accepted
- Missing sourceDate → `WARN` or `FAIL`, never auto-filled
- Read-only: no `create`, `upsert`, `update`, `delete`

---

## WalkForwardEngine Integration

- New `WalkForwardConfig.candidateSnapshots?: CandidateSnapshot[]` field
- New `WalkForwardSkeletonOutput.candidateSource` field
  - `'PIT_SAFE_CANDIDATE_SNAPSHOT'` when snapshots provided
  - `'MOCK_OBSERVABILITY_ONLY'` when using mock fallback
- Fully backward compatible — existing T-05B/C/D tests unchanged

---

## CandidateSnapshot Allowed Fields

`symbol`, `snapshotDate`, `sourceDate`, `dataFreshnessDays`, `dataAvailabilityStatus`, `observableFields`, `ruleOnlySortKey`, `exclusionReasons`, `sourceLabel`

## Coverage Thresholds

| Status | Condition |
|---|---|
| PASS | coverageRatio ≥ 70% AND no PIT violations |
| WARN | coverageRatio 40-69% OR some PIT violations |
| FAIL | coverageRatio < 40% OR (PIT violations AND < 50% available) |

---

*Observability only. No edge claim. No performance claim. No production write.*
