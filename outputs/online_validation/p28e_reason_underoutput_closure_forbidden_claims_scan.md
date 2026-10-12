# P28E Forbidden Claims Scan

**Classification:** `P28E_FORBIDDEN_CLAIMS_CLEAN`
**Regex:** `ROI|win-rate|win rate|alpha(?!Score)|edge|profit|outperform|beat|buy|sell|guaranteed|investment recommendation|買進|賣出|買入`

## Scope Scanned

- `outputs/online_validation/p28e_*`
- `outputs/online_validation/p28_reason_underoutput_*`
- `outputs/online_validation/p28_next_prompt_after_reason_underoutput_closure.md`
- `outputs/online_validation/ARTIFACT_INDEX.json`, `.md`
- `outputs/online_validation/PHASE_INDEX.md`
- `outputs/online_validation/p26_phase_chain_registry.json`
- `src/lib/onlineValidation/__tests__/p28e_reason_underoutput_closure.test.ts`
- `scripts/run-p28e-residual-underoutput-distribution-scan.ts`

## Hits (all allowed)

| # | File | Match | Allowed reason |
| --: | --- | --- | --- |
| 1 | `p28e_..._invariance.json` | `src/lib/alpha/SignalFusionEngine.ts` | file path (folder name `alpha`) |
| 2 | `p28e_..._preflight.json` | `src/lib/alpha/SignalFusionEngine.ts` | file path |
| 3 | `PHASE_INDEX.md` | "Observability only. No investment recommendations." | disclaimer |
| 4 | `ARTIFACT_INDEX.md` | "Observability only. This system does not provide investment recommendations." | disclaimer |
| 5 | `ARTIFACT_INDEX.json` | "Observability only. No investment recommendations." | disclaimer |
| 6 | `p26_phase_chain_registry.json` | "Observability only. No investment recommendations." | disclaimer |
| 7 | `p28_next_prompt_...md` | "ROI / win-rate / alpha / edge / profit / outperform / buy / sell / guaranteed" | explicit forbidden-list (prompt prohibition section) |
| 8 | `p28_next_prompt_...md` | "No investment advice. No ROI / alpha / edge / win-rate / profit / outperform / buy / sell claims." | disclaimer |

## Verdict

`CLEAN` — all hits are in disclaimer, file-path, or explicit forbidden-list contexts. Zero true violations.
