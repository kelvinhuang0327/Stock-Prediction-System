# P40 — Forbidden Claims Scan

**Phase:** P40  
**Task:** Paper Simulation Framework Design Gate  
**Scanned:** 2026-05-21

---

## Scanned Files

- `src/lib/onlineValidation/p40/PaperSimulationFrameworkTypes.ts`
- `src/lib/onlineValidation/p40/PaperSimulationFrameworkBoundary.ts`
- `src/lib/onlineValidation/__tests__/p40_paper_simulation_framework_design_gate.test.ts`
- `outputs/online_validation/p40_*.json`
- `outputs/online_validation/p40_*.md`

---

## Forbidden Terms Scanned

`buy`, `sell`, `hold`, `ROI`, `win-rate`, `winRate`, `alpha claim`, `edge`, `profit`,
`outperform`, `investment recommendation`, `guaranteed`, `expected return`, `PnL`,
`returnPct`, `prediction`, `recommendation`

---

## Findings

All occurrences of forbidden terms are either:

1. **BENIGN_PROHIBITION_REFERENCE** — Listed in `PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS` or `PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES` constants as items that are explicitly forbidden. The presence of the word in a prohibition list is not a claim.

2. **BENIGN_TEST_ASSERTION** — Test cases that verify the framework REJECTS or DOES NOT CONTAIN the forbidden term. For example, `test("9.6 throws for payload with 'ROI' field")` is verifying that ROI is rejected, not making an ROI claim.

3. **BENIGN_COMMENT_DOCUMENTATION** — Comments like "No prediction, recommendation, buy/sell/hold, PnL, ROI" declare what the module does NOT do.

**No actual investment claims, performance claims, or action semantics found.**

---

## Verdict

| Term | Result |
|------|--------|
| `buy` / `sell` / `hold` | ✅ CLEAN — prohibition references + test assertions only |
| `ROI` | ✅ CLEAN — prohibition references + test assertions only |
| `win-rate` / `winRate` | ✅ CLEAN — prohibition references + test assertions only |
| `profit` | ✅ CLEAN — prohibition references only |
| `PnL` | ✅ CLEAN — prohibition references only |
| `prediction` | ✅ CLEAN — prohibition references + test assertions only |
| `recommendation` | ✅ CLEAN — prohibition references + test assertions only |
| `expected return` | ✅ CLEAN — prohibition references only |
| `investment recommendation` | ✅ CLEAN — prohibition references only |
| `edge` | ✅ CLEAN — prohibition references only |
| `alpha claim` | ✅ CLEAN — not found |
| `outperform` | ✅ CLEAN — not found |
| `guaranteed` | ✅ CLEAN — not found |
| `returnPct` | ✅ CLEAN — prohibition references + test assertions only |

---

## Overall Verdict: ✅ CLEAN

No forbidden claims found outside prohibition/test context.

**Classification:** `P40_FORBIDDEN_CLAIMS_SCAN_CLEAN`
