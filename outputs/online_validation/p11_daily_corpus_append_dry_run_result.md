# P11 Daily Real-Market Snapshot Corpus Append Dry-Run Report

**Generated:** 2026-05-11T07:28:02.597Z
**As-Of Date:** 2026-05-15
**Simulation Run ID:** p11-daily-real-market-simulation-20260515-001
**Source Mode:** EXISTING_LOCAL_DATA_ONLY

---

## Seed Status

- Validation: **PASS**
- TWSE Trading Day: **true**
- Calendar Version: twse-static-2024-2026-v1

## Append Preview

- Existing Corpus Count: 30
- Existing Unique As-Of Dates: 5
- Proposed Snapshot Count: **6**
- Proposed Ready: 0
- Proposed Blocked (WINDOW_NOT_DUE): 6
- Duplicate Key Count: 6
- Append Would Pass: **false**
- Block Reasons: DUPLICATE_AS_OF_DATE, DUPLICATE_KEY_BLOCKED

## Proposed Snapshots

| Symbol | Horizon | Target Date | Status |
|--------|---------|-------------|--------|
| 2330 | 5D | 2026-05-22 | SNAPSHOT_BLOCKED |
| 2330 | 20D | 2026-06-12 | SNAPSHOT_BLOCKED |
| 2330 | 60D | 2026-08-10 | SNAPSHOT_BLOCKED |
| 2454 | 5D | 2026-05-22 | SNAPSHOT_BLOCKED |
| 2454 | 20D | 2026-06-12 | SNAPSHOT_BLOCKED |
| 2454 | 60D | 2026-08-10 | SNAPSHOT_BLOCKED |

## Dry-Run Execution Result

- Append Status: **BLOCKED_DUPLICATE**
- Existing Count: 30
- Incoming Count: 6
- Appended Count: **0**
- Total After Append: **30**
- Dry-Run: true
- Validation: **FAIL**

---

## Guardrails

- noProductionWrite: **true**
- noExternalApi: **true**
- noOptimizerWrite: **true**
- noTradingSignal: **true**
- observabilityOnly: **true**

## Known Limitations

- All P11 entries are SNAPSHOT_BLOCKED (WINDOW_NOT_DUE) — outcome windows have not closed.
- This is a dry-run controlled append, NOT a production daily job.
- Corpus remains fixture-driven until real TWSE outcome data is ingested.
- 60D horizon coverage will improve only as real trading days accumulate.
