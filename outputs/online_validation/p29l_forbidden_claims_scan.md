# P29L — Forbidden Claims Scan

**Scan ID:** P29L-FORBIDDEN-CLAIMS-SCAN  
**Captured At:** 2026-05-20T00:00:00.000Z  
**Status:** ✅ CLEAN

---

## Patterns Scanned

| Pattern | Result |
|---|---|
| `/guaranteed profit/i` | ✅ CLEAN |
| `/guaranteed return/i` | ✅ CLEAN |
| `/risk[- ]?free/i` | ✅ CLEAN |
| `/\b(will\|always) (profit\|gain\|double)\b/i` | ✅ CLEAN |
| `/\boutperform(s)? the market/i` | ✅ CLEAN |

## Notes

- Disclaimer text: `"No profit, return, or investment performance claims"` — applies P29K lesson (negated phrases avoided)
- T14 test group validates at runtime: 5/5 patterns CLEAN
- All P29L modules use structurally-neutral disclaimer language
