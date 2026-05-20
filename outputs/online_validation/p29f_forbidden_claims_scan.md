# P29F Forbidden Claims Scan (Part I)

**Phase:** P29F-HARDRESET  
**Task:** Forbidden Claims Scan  
**Generated:** 2026-05-20  
**Mode:** Static regex scan across all P29F added/modified files

---

## Scanned Files

- `src/lib/onlineValidation/p29f/quoteRegimeChipPitAudit.ts`
- `src/lib/onlineValidation/p29f/pitAuditTypes.ts`
- `src/lib/onlineValidation/__tests__/p29f_quote_regime_chip_pit_audit.test.ts`

---

## Pattern Results

| Pattern | Found | Context | Violation |
|---------|-------|---------|-----------|
| ROI | ❌ Not found | — | No |
| win-rate | ❌ Not found | — | No |
| win rate | ❌ Not found | — | No |
| alpha (standalone) | ❌ Not found | — | No |
| edge (standalone) | ❌ Not found | — | No |
| profit | ❌ Not found | — | No |
| outperform | ❌ Not found | — | No |
| beat | ❌ Not found | — | No |
| buy (signal/claim) | ❌ Not found | — | No |
| sell (signal/claim) | ❌ Not found | — | No |
| guaranteed | ❌ Not found | — | No |
| investment recommendation | ✅ Found (×2) | PROHIBITION_CONTEXT | **No** |
| alphaScore | ✅ Found (×8) | GOVERNANCE_FIELD | **No** |
| 買進 | ❌ Not found | — | No |
| 賣出 | ❌ Not found | — | No |
| 買入 | ❌ Not found | — | No |

---

## Detailed Findings

### Finding 1 — "NOT investment recommendation" (prohibition context)

- **File:** `quoteRegimeChipPitAudit.ts:3`, `p29f_...test.ts:3`
- **Text:** `paper-only / audit-only / NOT investment recommendation`
- **Classification:** PROHIBITION_CONTEXT — explicit negation/anti-claim
- **Violation:** No

### Finding 2 — `alphaScore` references (governance field)

- **Files:** `quoteRegimeChipPitAudit.ts:262,384,525` and `test.ts:164,165,282,283,295,296`
- **Text:** `mayRemainInAlphaScore`, `entersAlphaScore=false`
- **Classification:** AUDIT_GOVERNANCE_FIELD — boolean governance flag, not a performance claim
- **Violation:** No

---

## Verdict

| Gate | Result |
|------|--------|
| Violations confirmed | 0 |
| Prohibition context hits | 2 (ACCEPTABLE) |
| Governance field hits | 8 (ACCEPTABLE) |

**→ FORBIDDEN CLAIMS SCAN: CLEAN — PASS**
