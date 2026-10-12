# T-05D Taiwan Trading Calendar Adapter — Validation

**Task:** T-05D  
**Labels:** Taiwan trading calendar adapter | deterministic calendar | static override contract  
**Labels:** no external API | no DB write | no LLM call | no strategy mutation | no performance claim | no edge claim

---

## Sample Calendar Validation

| Field | Value |
|---|---|
| Range | 2025-04-07 to 2025-04-11 |
| Total calendar days | 5 |
| Trading day count | 5 |
| Weekend excluded | 0 |
| Holiday override excluded | 0 |
| Coverage status | **PASS** |

---

## Key Behavioral Validations

| Scenario | Date | Expected | Reason |
|---|---|---|---|
| Built-in holiday | 2025-01-01 | Not trading | New Year's Day |
| Weekend | 2025-04-05 | Not trading | Saturday |
| Special override | 2025-04-05 (override) | Trading | specialTradingDayOverrides |
| Custom holiday | 2025-04-07 (override) | Not trading | holidayOverrides |
| Normal weekday | 2025-04-07 | Trading | Mon, no overrides |

---

## Monthly Rebalance Sample

| Month | Scheduled Date | Status | Notes |
|---|---|---|---|
| 2025-04 | 2025-04-01 | AVAILABLE | Apr 3-4 are holidays; Apr 1 (Tue) is first trading day |
| 2025-05 | 2025-05-02 | AVAILABLE | May 1 is Labor Day; May 2 (Fri) is first trading day |

---

## 500-Day Lookback Validation

- End date: 2026-05-07
- Start date: approx 2025-01-22
- Trading day count: ~350 (in 500 calendar days)
- Calendar basis: `TAIWAN_TRADING_CALENDAR`
- Status: VALIDATED_IN_TEST (test 18)
