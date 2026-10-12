# P36 Forbidden Claims Scan

**Target:** `src/lib/onlineValidation/p36/`  
**Verdict:** ✅ CLEAN

---

## Scan Pattern

`ROI | win-rate | win rate | profit | outperform | beat the market | guaranteed | 買進 | 賣出 | 買入 | buy | sell | hold`

## Findings

All matches are in prohibition or disclaimer clauses:

| File | Lines | Text | Classification |
|------|-------|------|----------------|
| MonthlyRevenueControlledConsumerReadiness.ts | 12 | "No profit, return, win-rate, or investment performance claims are made." | BENIGN — disclaimer |
| MonthlyRevenueControlledConsumerReadiness.ts | 98, 107–111 | `profitLoss, buy, sell, hold, profit` | BENIGN — FUTURE_LOOKING_FIELDS prohibition array |
| MonthlyRevenueControlledConsumerContract.ts | 13 | "No profit, return, win-rate..." | BENIGN — disclaimer |
| MonthlyRevenueControlledConsumerContract.ts | 25, 29, 81–89, 191–198 | forbidden field names | BENIGN — FORBIDDEN_CONSUMER_OUTPUT_FIELDS array + disclaimer prohibition list |

## Conclusion

**No affirmative investment claims detected.**  
All occurrences are structural prohibitions or disclaimers.  
Scan: **CLEAN** ✅
