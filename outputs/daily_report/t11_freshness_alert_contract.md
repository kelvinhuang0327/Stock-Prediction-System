# T-11 Freshness Alert Contract

**Task**: T-11 — Freshness Alert for MarketRegimeResult  
**Generated**: 2026-05-06  
**Contract Version**: t11_v1

---

## Alert Levels

| Level | Rule | requiresAction | Description |
|-------|------|----------------|-------------|
| `FRESH` | lag <= 3 days | false | Regime data is current. No action required. |
| `STALE` | lag 4–7 days | true | Mildly stale. Refresh recommended. |
| `CRITICAL_STALE` | lag > 7 days | true | Critically stale. Immediate refresh required. |
| `MISSING` | isAvailable === false | true | No regime records in DB. |
| `FUTURE_DATE_ERROR` | persisted date > currentDate | true | Data integrity error. |

---

## Alert Object Schema

```typescript
interface FreshnessAlert {
  alertLevel: FreshnessAlertLevel   // 'FRESH' | 'STALE' | 'CRITICAL_STALE' | 'MISSING' | 'FUTURE_DATE_ERROR'
  freshnessLagDays: number | null   // null for MISSING
  lastRegimeDate: string | null     // null for MISSING
  currentDate: string
  message: string | null            // null only for FRESH
  requiresAction: boolean
}
```

---

## Examples

### FRESH
```json
{
  "alertLevel": "FRESH",
  "freshnessLagDays": 0,
  "lastRegimeDate": "2026-05-06",
  "currentDate": "2026-05-06",
  "message": null,
  "requiresAction": false
}
```

### STALE
```json
{
  "alertLevel": "STALE",
  "freshnessLagDays": 5,
  "lastRegimeDate": "2026-05-01",
  "currentDate": "2026-05-06",
  "message": "MarketRegimeResult is stale by 5 calendar days.",
  "requiresAction": true
}
```

### CRITICAL_STALE
```json
{
  "alertLevel": "CRITICAL_STALE",
  "freshnessLagDays": 10,
  "lastRegimeDate": "2026-04-26",
  "currentDate": "2026-05-06",
  "message": "MarketRegimeResult is critically stale by 10 calendar days. Immediate refresh required.",
  "requiresAction": true
}
```

### MISSING
```json
{
  "alertLevel": "MISSING",
  "freshnessLagDays": null,
  "lastRegimeDate": null,
  "currentDate": "2026-05-06",
  "message": "No MarketRegimeResult found.",
  "requiresAction": true
}
```

### FUTURE_DATE_ERROR
```json
{
  "alertLevel": "FUTURE_DATE_ERROR",
  "freshnessLagDays": -1,
  "lastRegimeDate": "2026-05-07",
  "currentDate": "2026-05-06",
  "message": "Persisted regime date 2026-05-07 is after currentDate 2026-05-06.",
  "requiresAction": true
}
```

---

## Guardrails

- No buy/sell signal
- No ROI / win-rate
- No DB write
- No external API call
- No H001-H012
- No strategy behavior change from freshness alert
