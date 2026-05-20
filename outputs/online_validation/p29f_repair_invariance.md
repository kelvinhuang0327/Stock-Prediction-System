# P29F-Repair Invariance Check

**Report ID:** p29f-repair-invariance  
**Generated:** 2026-05-21  
**Status:** INVARIANCE PASSED — all locked files unchanged

---

## Invariant Files

| File | Expected SHA256 | Actual SHA256 | Match |
|------|----------------|---------------|-------|
| `src/lib/alpha/SignalFusionEngine.ts` | `b8ce3fa3...` | `b8ce3fa3...` | ✓ MATCH |
| `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts` | `063a3bd5...` | `063a3bd5...` | ✓ MATCH |

---

## Scoring Impact Assessment

| Concern | Changed? |
|---------|----------|
| alphaScore formula | NO |
| Bucket logic | NO |
| Signal weights | NO |
| Thresholds | NO |
| New scoring lines in patched file | NO |

**Pattern search in diff additions** (`grep alpha|score|bucket|weight|threshold|signal|fuse`): **0 matches**

---

## Patched File: RuleBasedStockAnalyzer.ts

The only changes are in the **PIT gate section** (lines 49–100, pre/post-repair):
- Added `normalizePitDateToIso` helper (date format normalization only)
- Replaced `asOfDb` with `asOfIso` in PIT gate queries only
- Fixed `asOfMonth` slice offset (ISO offset 5 vs YYYYMMDD offset 4 — same result)

**Post-repair SHA256:** `4f6434a3...`  
The scoring calculation section (alphaScore, MA/RSI/MACD aggregation, signal fusion) is **downstream of data fetch** and was not touched.
