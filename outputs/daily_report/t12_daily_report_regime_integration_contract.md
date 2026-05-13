# T-12 DailyReport Regime Integration Contract

**Task**: T-12 — DailyReportEngine Deeper Integration  
**Contract Version**: t12_v1  
**Generated**: 2026-05-06

---

## Field: `marketSummary.regimeContext`

Type: `RegimeContextSummary` (optional — backward compatible)

```typescript
interface RegimeContextSummary {
  source: 'PERSISTED_MARKET_REGIME_RESULT' | 'FALLBACK_LIVE_DETECT' | 'UNAVAILABLE'
  date: string | null
  regimeLabel: string | null
  confidence: number | null
  taiexClose: number | null
  freshnessStatus: string | null
  freshnessLagDays: number | null
  freshnessAlert: FreshnessAlert
  fallbackUsed: boolean
  warning: string | null
}
```

---

## Example: FRESH (normal state)

```json
{
  "source": "PERSISTED_MARKET_REGIME_RESULT",
  "date": "2026-05-06",
  "regimeLabel": "BULL",
  "confidence": 1.0,
  "taiexClose": 41138.85,
  "freshnessStatus": "FRESH",
  "freshnessLagDays": 0,
  "freshnessAlert": {
    "alertLevel": "FRESH",
    "freshnessLagDays": 0,
    "lastRegimeDate": "2026-05-06",
    "currentDate": "2026-05-06",
    "message": null,
    "requiresAction": false
  },
  "fallbackUsed": false,
  "warning": null
}
```

## Example: MISSING (no persisted data)

```json
{
  "source": "UNAVAILABLE",
  "date": null,
  "regimeLabel": null,
  "confidence": null,
  "taiexClose": null,
  "freshnessStatus": "MISSING",
  "freshnessLagDays": null,
  "freshnessAlert": {
    "alertLevel": "MISSING",
    "freshnessLagDays": null,
    "lastRegimeDate": null,
    "currentDate": "2026-05-06",
    "message": "No persisted MarketRegimeResult available.",
    "requiresAction": true
  },
  "fallbackUsed": true,
  "warning": "Persisted regime context not available."
}
```

---

## Fallback Rules

| Condition | source | fallbackUsed | warning |
|-----------|--------|--------------|---------|
| Persisted available, FRESH | `PERSISTED_MARKET_REGIME_RESULT` | false | null |
| Persisted available, STALE/CRITICAL_STALE | `PERSISTED_MARKET_REGIME_RESULT` | false | freshness message |
| No persisted records | `UNAVAILABLE` | true | warning message |
| Fetch error | `UNAVAILABLE` | true | error message |

---

## Integration Points

| Point | Details |
|-------|---------|
| Added to `generateDailyReport()` | `getLatestMarketRegimeContext()` in `Promise.all` |
| New helper | `buildRegimeContextSummary(ctx)` |
| `buildMarketSummary()` | Now accepts optional `persistedCtx?: RegimeContext` |
| `MarketSummary` interface | Optional `regimeContext?: RegimeContextSummary` added |
| API route change | None — `/api/report/daily` gets it automatically |

---

## Guardrails

- No buy/sell/signal fields
- No ROI / win-rate
- No DB write
- No external API call
- No H001-H012
- No strategy behavior change
- Additive only — backward compatible
- `detectRegime()` retained (not removed)
