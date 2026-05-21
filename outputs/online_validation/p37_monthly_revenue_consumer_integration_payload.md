# P37 — Sample Integration Payload

**Date:** 2026-05-21

## Payload Overview

| Field | Value |
|---|---|
| sourceName | MonthlyRevenue |
| surfaceMode | controlled-consumer-integration |
| rowCount | 3 |
| consumerReadyRows | 2 |
| warningRows | 1 |
| blockedRows | 0 |
| entersAlphaScore | false |
| dryRunOnly | true |
| paperOnly | true |

## Confidence Distribution

| Tier | Count |
|---|---|
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 1 |

## Row Classifications

| Symbol | Classification | Confidence | consumerReady |
|---|---|---|---|
| 2330 | CONSUMER_READY | HIGH | true |
| 2317 | CONSUMER_READY | MEDIUM | true |
| 2454 | CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING | LOW | false |

> All rows: `entersAlphaScore=false`, `paperOnly=true`, `dryRunOnly=true`
