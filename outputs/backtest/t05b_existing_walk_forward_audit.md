# T-05B Existing Walk-Forward Audit

**Task:** T-05B — Portfolio Walk-Forward Backtest Skeleton v2  
**Date:** 2026-05-07  
**Labels:** T-05B | observability-only | no edge claim | no production write | no DB write | no external API | no LLM call | no strategy mutation | no H001-H012

---

## Summary

| Component | Path | Status |
|-----------|------|--------|
| Python skeleton T-05 | scripts/build-portfolio-walk-forward-skeleton.py | EXISTS_WITH_GAPS |
| TypeScript WalkForwardValidator | src/lib/signals/WalkForwardValidator.ts | EXISTS_DO_NOT_USE |
| PersistedRegimeResult service | src/lib/marketRegimeResult.ts | AVAILABLE_READ_ONLY |
| resolveCurrentDate | src/lib/time/currentDate.ts | AVAILABLE |

---

## Python T-05 Skeleton Gaps

| Gap | Detail |
|-----|--------|
| TODAY_CAP hardcoded | `TODAY_CAP = "2026-05-06"` — must not carry to T-05B |
| Not TypeScript | Cannot be used as TS engine |
| Inline regime logic | `compute_regime_for_date()` re-derives regime; must use persisted result instead |
| No resolveCurrentDate | Date resolution is not using the TS contract |
| Direct SQLite conn | `sqlite3.connect(DB_PATH)` — T-05B must inject context map instead |

---

## Decision: CREATE_NEW_TYPESCRIPT_SKELETON

**New file:** `src/lib/backtest/WalkForwardEngine.ts`

**Rationale:**
- T-05B must be TypeScript
- Must use `resolveCurrentDate()` — no hardcoded date cap
- Must inject `PersistedRegimeContext` context map (no DB in engine)
- Must never reference H001-H012
- All output must be observability-only

---

## Forbidden Components (DO NOT USE in T-05B)

- `src/lib/signals/WalkForwardValidator.ts` — H001-H012 per-signal logic
- `src/lib/research/ExperimentRegistry.ts` — retired hypothesis registry
- `src/lib/research/ExperimentRunner.ts` — retired hypothesis runner

---

## Reusable Patterns from T-05 Python

- PIT-safe read-only regime lookup pattern (`WHERE date <= asof_date ORDER DESC LIMIT 1`)
- forbidden_logic_flags structure → rephrased as `safetyContract`
- placeholder_metrics null pattern
- pit_safety_flags pattern
