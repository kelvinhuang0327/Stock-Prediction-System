# T-09 Service Contract

**File:** `src/lib/marketRegimeResult.ts`
**Function:** `getLatestMarketRegimeContext(currentDate?: string): Promise<RegimeContext>`
**Date:** 2026-05-06

## Freshness Rules

| Status | Condition |
|---|---|
| FRESH | lag <= 3 calendar days |
| STALE | lag > 3 calendar days |
| MISSING | no rows in DB or DB error |
| FUTURE_DATE_ERROR | persisted date > currentDate |

## Return Types

```typescript
type RegimeContext = PersistedRegimeContext | MissingRegimeContext
```

Available: `{ isAvailable: true, date, regimeLabel, confidence, taiexClose, source, version, freshnessStatus, freshnessLagDays, warning }`

Missing: `{ isAvailable: false, freshnessStatus: "MISSING", freshnessLagDays: -1, warning }`
