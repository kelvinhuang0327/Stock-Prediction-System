# T-08 Persistence Verification

**Date:** 2026-05-06  
**Status PASS:** 

---

## Key Metrics

| Check | Value | Result |
|-------|-------|--------|
| Table exists | Yes PASS | | 
| Row count | 300 PASS | | 
| Row count matches input | 300/300 PASS | | 
| Min date | 2025-01-15 PASS | | 
| Max date | 2026-05-06 PASS | | 
| Future date count | 0 PASS | | 
| Invalid date count | 0 PASS | | 
| Invalid regime label count | 0 PASS | | 
| Invalid confidence count | 0 PASS | | 
| Duplicate date/source/version | 0 PASS | | 
| Forbidden fields in schema | 0 PASS | | 
| H001-H012 strings in rows | 0 PASS | | 
| Source | P4_03_MARKET_REGIME_CLASSIFIER only PASS | | 
| Version | p4_03b_v1 only PASS | | 

## Regime Distribution

| Label | Count | % |
|-------|-------|---|
| BULL | 126 | 42.0% |
| SIDEWAYS | 107 | 35.7% |
| HIGH_VOLATILITY | 63 | 21.0% |
| BEAR | 4 | 1.3% |

## Confidence Stats

| Metric | Value |
|--------|-------|
| Min | 0.308 |
| Max | 1.0 |
| Avg | ~0.79 |
