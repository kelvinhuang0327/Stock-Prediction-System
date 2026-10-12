# T-09 API Contract

**Endpoint:** `GET /api/daily-report/regime`
**File:** `src/app/api/daily-report/regime/route.ts`
**Date:** 2026-05-06

## OK Response

```json
{
  "status": "ok",
  "reportDate": "2026-05-06",
  "regime": {
    "date": "2026-05-06",
    "regimeLabel": "BULL",
    "confidence": 1.0,
    "taiexClose": 41138.85,
    "source": "P4_03_MARKET_REGIME_CLASSIFIER",
    "version": "p4_03b_v1",
    "freshnessStatus": "FRESH",
    "freshnessLagDays": 0,
    "warning": null
  },
  "guardrails": {
    "notTradingRecommendation": true,
    "notBuySellSignal": true,
    "notPerformanceEvidence": true
  }
}
```

## Missing Response

```json
{
  "status": "missing",
  "reportDate": "2026-05-06",
  "regime": null,
  "guardrails": { "notTradingRecommendation": true, ... }
}
```

## Forbidden Fields

`buy, sell, signal, roi, win_rate, alpha, edge, profit, recommendation, outperform`
