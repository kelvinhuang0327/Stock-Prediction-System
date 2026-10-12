# PIT-safe Feature Availability Registry v1

**Version:** v1 · Paper design only · Not investment advice
**Phase:** P29A-HARDRESET
**Date:** 2026-05-23

## Summary

| Source | Family | Status | Enters alphaScore | PIT Gate | SFE Weight (Stock) |
| --- | --- | --- | :---: | --- | ---: |
| TWSE_TPEX_Quote | price/tech | AVAILABLE_NEEDS_VALIDATION | ✅ | `date` <= asOfDate | 0.35 |
| MarketRegime | market | AVAILABLE_NEEDS_VALIDATION | ✅ | asOf param (TAIEX) | 0.15 |
| InstitutionalChip | chip/flow | AVAILABLE_NEEDS_VALIDATION | ✅ | `date` <= asOfDate | 0.25 |
| MonthlyRevenue | fundamental | REPAIRED_BUT_SOURCE_GATED | ✅ | `releaseDate` <= asOfDate | 0.25 |
| FinancialReport | fundamental | HIGH_RISK_SOURCE_ABSENT | ❌ | *(not implemented)* | 0.00 |
| NewsEvent | event/news | HIGH_RISK_SOURCE_ABSENT | ❌ | publishedAt <= asOfDate | 0.00 |

## Source Details

### 1. TWSE_TPEX_Quote — AVAILABLE_NEEDS_VALIDATION

- **PIT gate:** `date` <= asOfDate (YYYYMMDD string, lexicographic, AsOfDataGate)
- **Enters alphaScore:** YES — SFE weight 0.35 (stock), 0.50 (ETF)
- **Limitations:** tz edge at market close not formally encoded; min 20 days required
- **Forbidden:** no quote with `date` > asOfDate

### 2. MarketRegime — AVAILABLE_NEEDS_VALIDATION

- **PIT gate:** `detectRegime(asOf)` reads TAIEX quotes up to asOfDate only
- **Enters alphaScore:** YES — SFE weight 0.15 (stock), 0.25 (ETF)
- **Limitations:** Unknown regime gives partial credit (5/20 pts); no walk-forward calibration
- **Forbidden:** no look-ahead to future TAIEX prices

### 3. InstitutionalChip — AVAILABLE_NEEDS_VALIDATION

- **PIT gate:** `date` <= asOfDate (YYYYMMDD string)
- **Enters alphaScore:** YES — SFE weight 0.25 (stock + ETF)
- **Limitations:** Missing → chipScore=0 with weight redistribution
- **Forbidden:** no chip data from `date` > asOfDate

### 4. MonthlyRevenue — REPAIRED_BUT_SOURCE_GATED

- **PIT gate:** `releaseDate` <= asOfDate (repaired P17/P24/P25)
- **Enters alphaScore:** YES (when available) — SFE weight 0.25 (stock), 0.00 (ETF)
- **Current gap:** 2025-09 to 2026-01 historical data not acquired; P26F4 WAITING
- **Fallback:** `missingSources=[MonthlyRevenue]`; weight redistributed
- **Forbidden:** no rows with `releaseDate` > asOfDate; no fabricated data; no import without approval token

### 5. FinancialReport — HIGH_RISK_SOURCE_ABSENT ❌

- **PIT gate:** NOT IMPLEMENTED — no `availabilityDate` governance
- **Enters alphaScore:** NO (forbidden by R2)
- **Activation path:** implement `availabilityDate`, verify gate, update contract
- **Forbidden:** must NOT enter scoring until AVAILABLE_PIT_SAFE; must NOT use `periodEndDate` as gate

### 6. NewsEvent — HIGH_RISK_SOURCE_ABSENT ❌

- **PIT gate field:** `publishedAt` (NOT `ingestedAt`)
- **Enters alphaScore:** NO (forbidden by R2)
- **P26B contract:** `p26b-event-news-pit-contract-v0` (read-only metadata only)
- **Forbidden:** must NOT enter scoring; `ingestedAt` is NEVER a valid PIT gate

## Contract Rules Snapshot (10 rules)

R1–R10 documented in `p29a_pit_feature_availability_registry_contract.json`.
Key: R2 → HIGH_RISK = entersAlphaScore=false. R9 → ingestedAt/createdAt/periodEndDate/fiscalQuarter forbidden as gate fields.

## Next Steps

1. **P29-B** — NewsEvent / FinancialReport Real Source Acquisition Plan
2. **P29-C** — Backtest / Simulation Contract Paper Design
3. **Future P30** — Formal PIT gate validation audit for Quote / MarketRegime / InstitutionalChip → AVAILABLE_PIT_SAFE

*Observability only. Not investment advice.*
