# T-05C Regime Context Loader — Validation

**Task:** T-05C — Persisted MarketRegimeResult Loader  
**Date:** 2026-05-07  
**Labels:** T-05C | read-only loader | persisted MarketRegimeResult only | no regime recomputation | no production write | no DB write except read query | no external API | no LLM call | no strategy mutation | no performance claim

---

## Sample: normalizeRegimeContextDateKey

| Input | Output |
|-------|--------|
| `new Date('2026-05-07T12:00:00Z')` | `'2026-05-07'` |
| `'2026-05-07'` | `'2026-05-07'` |
| `'2026-05-07T23:59:59Z'` | `'2026-05-07'` |
| `''` (empty) | throws `InvalidDateKeyError` |
| `'not-a-date'` | throws `InvalidDateKeyError` |

## Sample: mapMarketRegimeResultToPersistedContext

Input DB row:
```json
{ "date": "2026-05-07", "regimeLabel": "BULL", "confidence": 0.85, "taiexClose": 21000, "source": "P4_03_MARKET_REGIME_CLASSIFIER", "version": "p4_03b_v1" }
```

Output PersistedRegimeContext:
```json
{ "date": "2026-05-07", "regimeLabel": "BULL", "confidence": 0.85, "taiexClose": 21000, "source": "P4_03_MARKET_REGIME_CLASSIFIER", "version": "p4_03b_v1", "freshnessStatus": "FRESH", "freshnessLagDays": 0, "warning": null, "isAvailable": true }
```

## Sample: validateRegimeContextCoverage

Range: 2026-05-04 to 2026-05-08 (5 weekdays), 3 records available:

```json
{ "expectedDateCount": 5, "availableContextCount": 3, "missingContextCount": 2, "coverageRatio": 0.6, "status": "WARN", "statusNote": "Coverage 60.0% is below 90% threshold. Partial context only." }
```

## Integration With T-05B

Before loader (`recordsWithRegimeContext = 0`):
```
skeleton.summary.recordsWithRegimeContext = 0
```

After loader injection (2 DB records in range):
```
skeleton.summary.recordsWithRegimeContext > 0
```

All placeholder metrics remain `null` — no performance conclusions.
