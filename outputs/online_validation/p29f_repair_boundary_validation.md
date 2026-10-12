# P29F-Repair Boundary Validation

**Report ID:** p29f-repair-boundary-validation  
**Generated:** 2026-05-21  
**Status:** ALL BOUNDARIES PASS

---

## PIT Gate Boundary Cases

| ID | Scenario | asOf | Record Date | Result | Pass |
|----|----------|------|-------------|--------|------|
| BV-01 | Future same-year excluded | 2026-05-20 | 2026-05-21 | FALSE (excluded) | ✓ |
| BV-02 | Same-day included | 2026-05-20 | 2026-05-20 | TRUE (included) | ✓ |
| BV-03 | Historical included | 2026-05-20 | 2026-05-01 | TRUE (included) | ✓ |
| BV-04 | Cross-year boundary | 2026-01-01 | 2025-12-31 | TRUE (included) | ✓ |
| BV-05 | OLD BUG: future ISO vs YYYYMMDD | N/A (bug) | 2026-05-21 | TRUE (WAS WRONG) | Fixed |
| BV-06 | YYYYMMDD asOf input normalized | 20260520 | 2026-05-21 | FALSE (excluded) | ✓ |
| BV-07 | Invalid date input → throw | "not-a-date" | N/A | throws PIT error | ✓ |
| BV-08 | No asOf (null) → gate disabled | null | any | all records returned | ✓ |

---

## Key Proofs

**Bug proof (BV-05):**
```
"2026-05-21" <= "20260520"   → TRUE  ← string '-'(45) < '0'(48), BUG
```

**Fix proof (BV-01):**
```
"2026-05-21" <= "2026-05-20"  → FALSE ← ISO lexicographic correct
```

**Cross-year ISO works (BV-04):**
```
"2025-12-31" <= "2026-01-01"  → TRUE  ← '2025...' < '2026...' correct
```

---

## YYYYMMDD Input Handling (BV-06)

If external callers ever pass YYYYMMDD format as `asOf`, `normalizePitDateToIso` converts it to ISO before the gate comparison. No silent bypass.

## Invalid Input Handling (BV-07)

`normalizePitDateToIso` throws `[PIT] Invalid date format: "..."` on unrecognized input. This prevents any silent gate bypass through unexpected date strings.
