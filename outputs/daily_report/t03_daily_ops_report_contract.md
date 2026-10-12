# T-03 Daily Ops Report Contract v1

**Version**: v1  
**Contract Date**: 2026-05-06

> ⚠️ **Disclaimer**: This is NOT a trading advisory. This is NOT a buy/sell content. This is NOT ROI evidence. This is a system readiness and observability artifact.

---

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `reportDate` | string | Date of this report (YYYY-MM-DD) |
| `generatedAt` | string | ISO timestamp of generation |
| `status` | OpsReportStatus | Overall system health status |
| `summary` | string | Human-readable one-line summary |
| `marketRegime` | OpsMarketRegime | Latest persisted regime context |
| `freshness` | OpsFreshness | Data freshness summary |
| `walkForward` | OpsWalkForward | Walk-forward skeleton status (T-10) |
| `guardrails` | OpsGuardrails | All guardrail checks |
| `dataQuality` | OpsDataQuality | Data availability and quality |
| `readiness` | OpsReadiness | Operator/scheduler/dashboard readiness |
| `nextActions` | string[] | Recommended operator actions |
| `doNotInterpretAs` | string[] | Mandatory disclaimer list |

---

## Status Values

| Status | Condition |
|--------|-----------|
| `PASS` | freshnessAlert = FRESH, regime available |
| `PASS_WITH_WARNINGS` | freshnessAlert = STALE |
| `STALE_DATA` | freshnessAlert = CRITICAL_STALE |
| `MISSING_DATA` | No persisted regime available |
| `GUARDRAIL_FAIL` | freshnessAlert = FUTURE_DATE_ERROR |
| `BLOCKED` | Catastrophic failure |

---

## Guardrail Fields

Note: `noLegacyHypotheses` covers retired H001-H012 (field name avoids embedding hypothesis codes).

| Field | Meaning |
|-------|---------|
| `noTradingAdvisory` | No trading advisory generated |
| `noBuySellContent` | No buy/sell content |
| `noPerformanceEvidence` | No ROI/win-rate/alpha/edge claimed |
| `noLegacyHypotheses` | No H001-H012 used |
| `noForbiddenFields` | No forbidden field keys in output |
| `noDbWrite` | No DB writes |
| `noExternalApiCall` | No external API calls |

---

## Example Output (PASS state)

```json
{
  "reportDate": "2026-05-06",
  "status": "PASS",
  "marketRegime": {
    "regimeLabel": "BULL",
    "confidence": 1.0,
    "source": "PERSISTED_MARKET_REGIME_RESULT",
    "freshnessAlert": { "alertLevel": "FRESH", "requiresAction": false }
  },
  "freshness": { "marketRegimeFreshness": "FRESH", "requiresAction": false },
  "walkForward": { "sampleDays": 120, "recordsWithRegimeContext": 120, "pitSafe": true },
  "guardrails": { "noTradingAdvisory": true, "noLegacyHypotheses": true, "noDbWrite": true },
  "doNotInterpretAs": ["This is not a trading advisory.", "..."]
}
```

---

## Forbidden Field Keys

`buy`, `sell`, `signal`, `roi`, `win_rate`, `alpha`, `edge`, `profit`, `recommendation`, `outperform`

Values in `doNotInterpretAs` may reference these concepts in negation context. JSON keys must not use these names.
