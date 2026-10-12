# P8 Known-Failure Repair — Final Report

**Generated:** 2026-05-23T08:24:29Z
**Branch:** main | **HEAD:** 261cd369db68f100e7d609b85dbd8af86094249d (P48, unchanged)
**Classification:** `P8_KNOWN_FAILURE_REPAIR_READY_FULL_BASELINE_GREEN`

---

## 1. Pre-flight

| Check | Result |
|---|---|
| Context-lock scan | CLEAN — no P26J/K/Betting-pool/CLV/COMPLETE_PAIR/TSL contamination |
| TSL scan | CLEAN |
| HEAD | 261cd369 on main (P48) |
| Baseline (P49-LEDGER) | 4842/4846 PASS; 4 pinned failures |

---

## 2. Root Cause (Confirmed)

All 4 pinned failures shared a single root cause: **stale hardcoded `prisma/dev.db` SHA from the P29C era**.

| Attribute | Value |
|---|---|
| Stale SHA (P29C era) | `9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6` |
| Current canonical SHA (P48+) | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |
| DB file mutated? | **NO** — only the test expectation was updated |
| New failures introduced? | **NONE** — 93 other tests in these 4 files continued to PASS throughout |

---

## 3. Repairs Applied

| File | Location | Change |
|---|---|---|
| `src/lib/onlineValidation/__tests__/p26a_renderer_fix.test.ts` | Line 368 — `const expected = '...'` | Stale → canonical SHA |
| `src/lib/onlineValidation/__tests__/p26a_batch_pipeline_wiring.test.ts` | Line 233 — inline `.toBe('...')` | Stale → canonical SHA |
| `src/lib/onlineValidation/__tests__/p27_waiting_state_policy_guard.test.ts` | Lines 138-140 — `.toContain("...")` | Stale → canonical SHA |
| `src/lib/onlineValidation/__tests__/p29d_dropzone_scaffold.test.ts` | Line 34 — `BASELINE_DB_SHA = '...'` constant | Stale → canonical SHA |

No other lines in any file were modified.

---

## 4. Verification Results

### 4.1 Targeted (4 repaired suites)

| Suite | Before | After |
|---|---|---|
| `p26a_renderer_fix` | 1 FAIL / 27 PASS | **28/28 PASS** |
| `p26a_batch_pipeline_wiring` | 1 FAIL / 24 PASS | **25/25 PASS** |
| `p27_waiting_state_policy_guard` | 1 FAIL / 24 PASS | **25/25 PASS** |
| `p29d_dropzone_scaffold` | 1 FAIL / 18 PASS | **19/19 PASS** |
| **Total** | **4 FAIL / 93 PASS** | **97/97 PASS** |

### 4.2 Chain regression

| Suite group | Result |
|---|---|
| P36 / P37 / P38 (165 tests) | **PASS** |
| `src/lib/research/__tests__/` (225 tests) | **PASS** |
| `src/lib/simulation/__tests__/` (275 tests, incl. P4/P6/P7) | **PASS** |

### 4.3 Full onlineValidation suite

| Metric | P49-LEDGER baseline | P8 result |
|---|---|---|
| Test Suites | 127 | 127 |
| Tests PASS | **4842** | **4846** |
| Tests FAIL | 4 | **0** |
| Time | — | 171 s |

**Full baseline green achieved: 4846/4846 PASS.**

---

## 5. DB Invariant

```
prisma/dev.db SHA256 = a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8
```

Verified unchanged before and after repair. The 4 test assertions now reflect the current
canonical DB state (P48+). Guard intent preserved: each test still asserts the DB was not
mutated by the test suite run.

---

## 6. Forbidden Claims Scan (repaired files)

| Check | Result |
|---|---|
| `buy/sell/ROI/guaranteed` injection | CLEAN |
| `alphaScore` governance violation | CLEAN — pre-existing `alphaScore` in p26a_renderer_fix are governance invariance tests (asserting renderer does NOT mutate alphaScore), not advice |
| Context-lock contamination | CLEAN |

---

## 7. Governance Constraints Met

- NO `prisma/**` changes (DB file not touched)
- NO `data/**` changes
- NO scoring formula / optimizer / alphaScore changes
- NO `git add`, `git commit`, `git checkout`
- NO `package.json` / `package-lock.json` changes
- Only 4 test files + this report + roadmap overlay modified

---

## 8. Classification

`P8_KNOWN_FAILURE_REPAIR_READY_FULL_BASELINE_GREEN`

P49 target achieved: **4846/4846 PASS** (0 failures, 0 pinned).

---

## 9. Next Prompt

```
[Stock Prediction System] P9 — [Next axis or deferred governance work]
Baseline: P8_KNOWN_FAILURE_REPAIR_READY_FULL_BASELINE_GREEN
HEAD: 261cd369 (P48)
P49 target achieved: 4846/4846 PASS (0 failures)
Anti-axis-monopoly: P8 cross-cutting repair → P9 may resume Axis A or Axis B
```
