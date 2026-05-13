# P26F MonthlyRevenue Mapping Contract v1

**Phase:** P26F-HARDRESET  
**Version:** v1  
**Generated:** 2026-05-13

## PIT Gate

- **Gate Field:** `releaseDate`
- **Rule:** `releaseDate <= asOfDate`
- `null releaseDate` → NOT visible
- `year`, `month`, `createdAt` do NOT grant visibility

## Join Rules

| Corpus Key | Source Key | Type |
|---|---|---|
| `symbol` | `stockId` | LEFT_JOIN_EXACT_SYMBOL (case-sensitive) |

`MonthlyRevenue.stockId = Stock.id = symbol`

## Source Fields

| Corpus Alias | DB Field | Role |
|---|---|---|
| symbol | stockId | Join key |
| year | year | Observability only |
| month | month | Observability only |
| revenue | revenue | Data field |
| yoyGrowth | yoyGrowth | Data field |
| momGrowth | momGrowth | Data field |
| releaseDate | releaseDate | **PIT GATE** |
| releaseDateSource | releaseDateSource | Observability only |
| releaseDateConfidence | releaseDateConfidence | Observability only |
| createdAt | createdAt | Observability only |

## Candidate Output Contract

- `outputType`: CANDIDATE_DRY_RUN_ONLY
- `overwritesFrozenCorpus`: false
- `entersAlphaScore`: false
- `readOnly`: true
- `contextFieldName`: p26fMonthlyRevenueContext
- `scoringChangeAllowed`: false
- `optimizerAllowed`: false
- **Forbidden output fields**: outcomePrice, returnPct, realizedReturnClass

## Excluded Scope

No ROI, no buy/sell, no profit, no outperform, no win-rate, no alpha claim, no edge claim, no scoring formula change, no optimizer authorization, no formal corpus replacement.

---
*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. Candidate dry-run only.*
