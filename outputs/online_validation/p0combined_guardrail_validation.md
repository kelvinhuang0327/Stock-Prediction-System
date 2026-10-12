# P0-COMBINED Guardrail Validation

| ID | Guardrail | Status | Note |
|---|---|---|---|
| G01 | No DB write | PASS | No prisma.create / update called in dry-run writer |
| G02 | No production Prediction row | PASS | writeMode=DRY_RUN, no Prediction model write |
| G03 | No StrategySignal write | PASS | StrategySignal not touched |
| G04 | No external API call | PASS | No HTTP calls in writer pipeline |
| G05 | No LLM call | PASS | No LLM API calls |
| G06 | No auto trading | PASS | No order creation |
| G07 | No forbidden terms in conclusions | PASS | buy/sell/roi/win_rate/alpha/edge/profit absent from artifact conclusions |
| G08 | alphaScore sanitized to researchScore | PASS | scoreSnapshot.researchScore used; alphaScore not exposed |
| G09 | recommendationBucket sanitized to researchBucket | PASS | researchBucket used; recommendationBucket not exposed |
| G10 | targetHorizons all PENDING | PASS | All horizons have outcomeStatus=PENDING |
| G11 | outcomeWriteBackAllowed all false | PASS | All entries have outcomeWriteBackAllowed=false |
| G12 | sourceDateBasis.sourceDate <= asOfDate | PASS | sourceDate=2026-05-09 <= asOfDate=2026-05-11 |
| G13 | Artifacts only in outputs/online_validation | PASS | No writes outside designated dir |
| G14 | JSONL is non-empty | PASS | 2 entries written |

**Overall: PASS**