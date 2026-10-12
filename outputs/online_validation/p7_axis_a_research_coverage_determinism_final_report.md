# P7 — Axis A Research Coverage Engine Determinism Final Report

**Classification:** P7_AXIS_A_RESEARCH_COVERAGE_DETERMINISM_READY
**Generated:** 2026-05-23T06:31:40Z
**Gate:** P6_AXIS_B_FIXTURE_RESULT_CONTRACT_READY (satisfied)

---

## 1. Pre-flight Result

| Check | Result |
|-------|--------|
| Repo root | `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System` |
| Branch | `main` |
| HEAD | `261cd369db68f100e7d609b85dbd8af86094249d` (P48) |
| Dirty files | Pre-existing only (logs, roadmap, p28c/p28d outputs) |
| Contamination scan (P26J/P26K/Betting-pool/CLV) | CLEAN ✅ — historical docs only |
| Bare TSL scan | CLEAN ✅ — no contamination |

---

## 2. Files Changed

| File | Action |
|------|--------|
| `src/lib/research/__tests__/p7_research_coverage_determinism.test.ts` | Created (new, untracked `??`) |
| `outputs/online_validation/p7_axis_a_research_coverage_determinism_final_report.md` | Created |
| `00-Plan/roadmap/roadmap.md` | Appended (P7 overlay) |

No source modifications. No prisma/data/corpus/scoring formula changes.

---

## 3. Test Results

| Suite | Tests | PASS | FAIL | Status |
|-------|-------|------|------|--------|
| `p7_research_coverage_determinism.test.ts` | 25 | 25 | 0 | ✅ PASS |
| All research `__tests__/` (6 suites) | 225 | 225 | 0 | ✅ PASS |
| P36/P37/P38 chain | 165 | 165 | 0 | ✅ PASS |

**New tests by group:**

| Group | Description | Tests | Status |
|-------|-------------|-------|--------|
| P7.1 | Determinism and ordering | 5 | ✅ PASS |
| P7.2 | Boundary values | 5 | ✅ PASS |
| P7.3 | Summary invariants | 5 | ✅ PASS |
| P7.4 | Governance / anti-advice invariants | 5 | ✅ PASS |
| P7.5 | Edge-case paths | 5 | ✅ PASS |

---

## 4. Research Coverage Determinism Behaviour Covered

| Test | Coverage Surface |
|------|-----------------|
| P7.T1.1–T1.4 | Same input → same readyCount / items.length / topGaps.length / overallReadiness |
| P7.T1.5 | Signal items appear before validation/regime/confidence/event/relevance in items array |
| P7.T2.1 | sampleSize=9 → INSUFFICIENT_DATA (just below degraded floor 10) |
| P7.T2.2 | sampleSize=10 → PARTIAL (at degraded floor, TAIEX available) |
| P7.T2.3 | sampleSize=29 → PARTIAL (just below READY floor 30) |
| P7.T2.4 | sampleSize=30 → READY (at READY floor, TAIEX available) |
| P7.T2.5 | taiexRowCount=9 → UNAVAILABLE (below MIN_TAIEX_ROWS=10) |
| P7.T3.1 | readyCount + partialCount + … + unavailableCount = totalModules |
| P7.T3.2 | overallReadiness always in [0, 100] |
| P7.T3.3 | Empty signalBatch → totalModules = 5 (non-signal modules only) |
| P7.T3.4 | All coverageRatio values in [0, 1] |
| P7.T3.5 | All items have non-empty key string |
| P7.T4.1 | No coverage item has an alphaScore field |
| P7.T4.2 | primaryLimitations per item ≤ 3 entries (slice(0,3) invariant) |
| P7.T4.3 | generatedAt is a non-empty ISO-shaped string (contains 'T') |
| P7.T4.4 | Signal item keys all start with 'signal:' |
| P7.T4.5 | All topGaps have non-empty affectedAreas array |
| P7.T5.1 | Walk-forward PARTIAL path: 1 READY + 1 walk-forward-eligible signal |
| P7.T5.2 | Regime DEGRADED path: snapshots >= 30, all regime breakdown < 5 per bucket |
| P7.T5.3 | NOISE classification on sampleSize >= 10 → NOISE limitation added |
| P7.T5.4 | topGaps within same priority level sorted alphabetically by key |
| P7.T5.5 | Both TAIEX gap and regime gap in HIGH topGaps when both sources unavailable |

---

## 5. PIT-Safety / Provenance / Anti-Advice Invariants

| Invariant | Status |
|-----------|--------|
| `entersAlphaScore = false` on all items (T4.1) | ✅ VERIFIED |
| `primaryLimitations.length <= 3` per item (T4.2) | ✅ VERIFIED |
| `generatedAt` is ISO timestamp, not date-manipulated (T4.3) | ✅ VERIFIED |
| All signal keys follow `signal:` prefix format (T4.4) | ✅ VERIFIED |
| All topGap affectedAreas arrays non-empty (T4.5) | ✅ VERIFIED |
| No buy/sell/hold semantics in any test assertion | ✅ CONFIRMED |
| No ROI / PnL / profit claims in any test assertion | ✅ CONFIRMED |
| No alphaScore / recommendationBucket mutation | ✅ CONFIRMED |

---

## 6. Boundary Check Result

| Check | Result |
|-------|--------|
| sampleSize=9 (below degraded floor 10) → INSUFFICIENT_DATA | ✅ |
| sampleSize=10 (at degraded floor) → PARTIAL | ✅ |
| sampleSize=29 (below READY floor) → PARTIAL | ✅ |
| sampleSize=30 (at READY floor) → READY | ✅ |
| taiexRowCount=9 (below MIN_TAIEX_ROWS=10) → UNAVAILABLE | ✅ |
| regimeSnapshotCount >= 30 but all regime per-bucket < 5 → DEGRADED | ✅ |
| walk-forward PARTIAL: readyCount + partialCount = batch.length, readyCount < batch.length | ✅ |

---

## 7. Forbidden Claims Scan Result

| Pattern | Hits | Verdict |
|---------|------|---------|
| ROI / profit / outperform / guaranteed | 1 (governance disclaimer) | ✅ CLEAN |
| 買進 / 賣出 / 買入 | 0 | ✅ CLEAN |
| alphaScore | 3 (header comment + T4.1 `undefined` assertion) | ✅ CLEAN — anti-advice invariant only |
| recommendationBucket | 0 | ✅ CLEAN |

---

## 8. Known P49 Pre-existing Failures (Untouched)

| Test | Status |
|------|--------|
| p26a_renderer_fix | FAIL (pre-existing, pinned) |
| p26a_batch_pipeline_wiring | FAIL (pre-existing, pinned) |
| p27_waiting_state_policy_guard | FAIL (pre-existing, pinned) |
| p29d_dropzone_scaffold | FAIL (pre-existing, pinned) |

Baseline 4842/4846 PASS unchanged.

---

## 9. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| 4 pinned failures still unresolved | MEDIUM | Deferred to P8 triage |
| `generatedAt` uses `new Date().toISOString()` — non-deterministic across calls | LOW | Only affects timestamp, not logic; tests use .toMatch(/T/) not equality |
| STATUS_READINESS_WEIGHT values are hardcoded constants | LOW | No test exercises the exact weighting arithmetic, only range [0,100] |

---

## 10. Next Recommended Prompt

```
[Stock Prediction System] P8 — P49 Pinned Failure Triage and Repair Round

Baseline: P7_AXIS_A_RESEARCH_COVERAGE_DETERMINISM_READY
HEAD: 261cd369 (P48)
Anti-axis-monopoly: P7 Axis A → P8 may address Axis B or cross-cutting deferred work.

Goal: Repair the 4 pre-existing pinned test failures:
  1. p26a_renderer_fix
  2. p26a_batch_pipeline_wiring
  3. p27_waiting_state_policy_guard
  4. p29d_dropzone_scaffold

Or address any other deferred governance/coverage work.
P49 target: 4846/4846 PASS (eliminate all 4 pinned failures)
```

---

## 11. CTO Agent 10-line Summary

P7 Axis A delivered 25 new tests across 5 groups (determinism, boundary values, summary invariants, governance, edge-case paths) for the ResearchCoverageEngine.
Pre-flight confirmed clean HEAD 261cd369 on main with no contamination (P26J/K/Betting-pool/CLV/TSL CLEAN).
All 25 P7 tests PASS on first run; broader research suite 225/225 PASS; P36/P37/P38 chain 165/165 PASS.
Boundary coverage new for P7: exact sampleSize floors (9/10/29/30), taiexRowCount=9, regime DEGRADED path, walk-forward PARTIAL path.
Governance invariants verified: no alphaScore field in any coverage item, primaryLimitations bounded to ≤ 3, generatedAt is ISO-shaped.
Anti-advice scan CLEAN: no buy/sell/hold, no ROI/PnL/profit claims, no recommendationBucket mutation.
Ordering determinism confirmed: same input → same summary, items order, topGaps, overallReadiness.
4 pinned pre-existing failures (p26a renderer, p26a batch, p27 waiting-state, p29d dropzone) untouched; baseline 4842/4846 preserved.
No source files modified; no prisma/data/scoring/optimizer changes; no git commits/pushes.
P7_AXIS_A_RESEARCH_COVERAGE_DETERMINISM_READY — next: P8 pinned failure triage targeting 4846/4846 PASS.
