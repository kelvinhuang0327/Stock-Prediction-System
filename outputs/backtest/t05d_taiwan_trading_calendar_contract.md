# T-05D Taiwan Trading Calendar Adapter — Contract

**Task:** T-05D  
**Status:** Taiwan trading calendar adapter | deterministic calendar | static override contract  
**Labels:** no external API | no DB write | no LLM call | no strategy mutation | no performance claim | no edge claim

---

## Module Contract

**Path:** `src/lib/backtest/TaiwanTradingCalendar.ts`

### Exported Functions

| Function | Description |
|---|---|
| `normalizeTradingDateKey(input)` | Normalize Date or string to YYYY-MM-DD (UTC, deterministic) |
| `isTaiwanTradingDay(date, calendar)` | Check if date is in calendar's trading date set |
| `buildTaiwanTradingCalendar(config)` | Build deterministic Taiwan trading calendar with overrides |
| `buildTaiwanTradingDateRange(start, end, holidays?, special?)` | Return sorted trading date array |
| `buildMonthlyTradingRebalanceSchedule(start, end, calendar)` | Build monthly rebalance schedule skeleton |
| `validateTradingCalendarCoverage(calendar)` | Compute PASS/WARN/FAIL coverage summary |

### Error Classes

- `InvalidTradingDateKeyError` — thrown on invalid date input

### Exported Constant

- `TAIWAN_STATIC_HOLIDAYS_2024_2026` — readonly string[] of approximate TWSE holidays

---

## Calendar Basis Contract

| Basis | Description |
|---|---|
| `TAIWAN_TRADING_CALENDAR` | Uses static holiday list + optional overrides. Excludes weekends. Includes special trading days. |
| `WEEKDAY_APPROXIMATION` | WalkForwardEngine fallback (Mon-Fri only, no holiday exclusion). |

---

## Lookback Contract

- **Max lookback:** 500 days
- **Date key format:** `YYYY-MM-DD`
- **Timezone:** UTC-safe, locale-independent
- **Deterministic:** same inputs → same output; no hidden state; no `process.env` dependencies

---

## Static Holiday Contract

- **Year range:** 2024–2026
- **Status:** APPROXIMATION SKELETON
- **Note:** Requires official TWSE data for production accuracy. Subject to annual maintenance.
- **Holiday count:** ~40 entries

---

## WalkForwardEngine Integration

- `WalkForwardConfig.tradingDates?: string[]` — inject Taiwan calendar dates
- `WalkForwardSkeletonOutput.calendarBasis` — `'TAIWAN_TRADING_CALENDAR'` | `'WEEKDAY_APPROXIMATION'`
- Backward compatible: if `tradingDates` not provided, fallback to weekday approximation
- T-05B tests (45/45) preserved; T-05C tests (45/45) preserved

---

## Safety Contract

- No DB write | No external API | No LLM call | No strategy mutation
- No performance claims | No trading conclusions | No edge claims | No H001-H012
- Uses `resolveCurrentDate()` — no hardcoded date cap
