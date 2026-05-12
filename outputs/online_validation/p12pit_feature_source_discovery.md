# P12-HARDRESET Feature Source Discovery

**Date:** 2026-05-12  
**Phase:** P12-HARDRESET PART B  
**Sources Discovered:** 11

> **Disclaimer:** Feature source discovery only. No investment recommendations. No scoring changes. No corpus modifications.

## PIT Risk Summary

| Risk Level | Count |
|-----------|-------|
| LOW | 7 |
| HIGH | 2 |
| MEDIUM | 2 |

## High-Risk Sources

- **MonthlyRevenue** — requires PIT contract guardrail
- **NewsEvent** — requires PIT contract guardrail

## Feature Sources

### StockQuote

| Field | Value |
|-------|-------|
| Module | `src/lib/analysis/RuleBasedStockAnalyzer.ts` |
| Data Table | `prisma.stockQuote` |
| Date Field | `date` |
| PIT Risk | **LOW** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** WHERE date <= asOfDate (YYYYMMDD lexicographic). Entry price: date == asOfDate. Scoring features: date <= asOfDate only. No future quotes permitted.

**Missing Data Behavior:** buildInsufficientResult() — returns researchBucket=InsufficientData, scoringCompletenessStatus=EMPTY

**Notes:** Correctly gated. analyzeStock(symbol, asOf) caps all queries to date <= asOf. String lexicographic comparison is valid for YYYYMMDD. closePriceAtPrediction is entry price on asOfDate. outcomeClose in outcomeSnapshot is captured AFTER prediction and is NOT part of the scoring snapshot — it is a separate write-back field.

**Fields:** `date`, `open`, `high`, `low`, `close`, `volume`, `stockId`

---

### InstitutionalChip

| Field | Value |
|-------|-------|
| Module | `src/lib/analysis/RuleBasedStockAnalyzer.ts` |
| Data Table | `prisma.institutionalChip` |
| Date Field | `date` |
| PIT Risk | **LOW** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** WHERE date <= asOfDate. orderBy date DESC, take recent N rows.

**Missing Data Behavior:** If chipCount < 5, chip factor is skipped. chipStrength = 0. missingSources includes InstitutionalChip.

**Notes:** Correctly gated by date <= asOf. Requires minimum 5 rows for chip score contribution. Chip tags (法人買超/法人賣超) appear in signalSnapshot and reasonSnapshot when chipStrength >= 65 or <= 35.

**Fields:** `date`, `stockId`, `foreignBuy`, `trustBuy`, `dealerBuy`

---

### MonthlyRevenue

| Field | Value |
|-------|-------|
| Module | `src/lib/analysis/RuleBasedStockAnalyzer.ts` |
| Data Table | `prisma.monthlyRevenue` |
| Date Field | `year + month (composite)` |
| PIT Risk | **HIGH** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** WHERE (year < asOfYear) OR (year == asOfYear AND month <= asOfMonth). No releaseDate field in schema — uses reporting period (year, month) as proxy.

**Missing Data Behavior:** If revenueCount < 13, revenue factor is skipped. revenueYoY = null. missingSources includes MonthlyRevenue.

**Notes:** CRITICAL PIT RISK: MonthlyRevenue uses reporting period (year, month) as the date gate, NOT a releaseDate. In Taiwan, monthly revenue is released on the 10th of the following month. Using month-end as the cutoff may include data that was NOT yet publicly available on asOfDate if asOfDate < 10th of (month+1). No releaseDate field exists in the prisma schema. This is a known PIT leakage risk that must be documented in the contract. Repair requires adding a releaseDate field to the schema — out of scope for P12.

**Fields:** `year`, `month`, `revenue`, `yoyGrowth`, `momGrowth`, `stockId`

---

### FinancialReport

| Field | Value |
|-------|-------|
| Module | `src/lib/analysis/RuleBasedStockAnalyzer.ts` |
| Data Table | `prisma.financialReport` |
| Date Field | `year + quarter (composite)` |
| PIT Risk | **MEDIUM** |
| Used in Scoring | ❌ No |
| Captured in Snapshot | ❌ No |

**asOf Rule:** Not currently used in RuleBasedStockAnalyzer scoring formula. Exists in schema but not queried for alphaScore/researchBucket computation.

**Missing Data Behavior:** N/A — not queried currently

**Notes:** FinancialReport exists in prisma schema but is NOT currently used by RuleBasedStockAnalyzer or SignalFusionEngine for scoring. If added in future: requires availabilityDate field (Taiwan quarterly reports released 45–60 days after quarter end). Currently MEDIUM risk because it is not active, but HIGH risk if added without availabilityDate gate.

**Fields:** `year`, `quarter`, `eps`, `netIncome`, `grossMargin`, `operatingMargin`, `stockId`

---

### NewsEvent

| Field | Value |
|-------|-------|
| Module | `src/lib/events/adapters/RSSNewsAdapter.ts` |
| Data Table | `prisma.newsEvent` |
| Date Field | `publishedAt` |
| PIT Risk | **HIGH** |
| Used in Scoring | ❌ No |
| Captured in Snapshot | ❌ No |

**asOf Rule:** WHERE publishedAt <= asOfDate. Must NOT use ingestedAt as PIT gate. ingestedAt reflects DB write time which may lag publishedAt.

**Missing Data Behavior:** Not currently consumed by scoring pipeline

**Notes:** NewsEvent exists in schema and has RSSNewsAdapter for ingestion. NOT currently consumed by RuleBasedStockAnalyzer or SignalFusionEngine scoring. If added in future: must gate by publishedAt <= asOfDate. Must NOT use ingestedAt (DB write time). relatedSymbols must be validated as parseable JSON string array.

**Fields:** `title`, `summary`, `source`, `trustLevel`, `publishedAt`, `relatedSymbols`, `relatedThemes`, `ingestedAt`

---

### TechnicalIndicators

| Field | Value |
|-------|-------|
| Module | `src/lib/analysis/TechnicalSignalCalculator.ts, src/lib/analysis/RuleBasedStockAnalyzer.ts` |
| Data Table | `Computed from prisma.stockQuote (in-memory)` |
| Date Field | `Inherits from StockQuote.date <= asOfDate` |
| PIT Risk | **LOW** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** All technical indicator windows (MA, momentum, etc.) must use only stockQuote rows with date <= asOfDate. Rolling window must not cross the asOfDate boundary.

**Missing Data Behavior:** If quoteCount < minimum window, technical indicators fallback to partial computation. technicalScore may be low-confidence.

**Notes:** Derived from StockQuote which is correctly gated. Risk is LOW as long as StockQuote gate is maintained. Captured in scoreSnapshot.technicalScore and factorSnapshot (Technical factor descriptions).

**Fields:** `technicalScore`, `momentumScore`, `riskLevel`, `trendSignals`

---

### MarketRegime

| Field | Value |
|-------|-------|
| Module | `src/lib/market/MarketRegimeEngine.ts (via SignalFusionEngine.ts)` |
| Data Table | `Computed from market-wide indicators` |
| Date Field | `asOf parameter passed from SignalFusionEngine` |
| PIT Risk | **MEDIUM** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ❌ No |

**asOf Rule:** detectRegime(asOf) must use data <= asOf. Regime classification must not use future market data.

**Missing Data Behavior:** If detectRegime throws, defaults to { regime: Unknown, confidence: 0, factors: [] }

**Notes:** Used in SignalFusionEngine for market adjustment. detectRegime is called with asOf. Not explicitly captured in activeScoringSnapshot fields — market adjustment is reflected in scoreSnapshot.marketAdjustment. MEDIUM risk: regime detection data sourcing needs verification.

**Fields:** `regime`, `confidence`, `factors`

---

### ActiveScoringSnapshot

| Field | Value |
|-------|-------|
| Module | `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts` |
| Data Table | `In-memory artifact, written to corpus JSONL` |
| Date Field | `asOfDate` |
| PIT Risk | **LOW** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** pitGateDate MUST equal asOfDate. All scoring data capped at asOfDate.

**Missing Data Behavior:** buildEmptySnapshot() if analyzeStock throws. scoringAvailable=false, completenessStatus=EMPTY.

**Notes:** FORBIDDEN FIELDS in activeScoringSnapshot: outcomePrice, returnPct, realizedReturnClass, baseline comparison results, any future price or future feature. These are write-back fields that exist at corpus row level (outcomeSnapshot) but must NOT appear inside activeScoringSnapshot itself.

**Fields:** `asOfDate`, `pitGateDate`, `scoringMode`, `scoringEngineSource`, `researchBucket`, `alphaScore`, `scoreSnapshot`, `signalSnapshot`, `factorSnapshot`, `reasonSnapshot`, `limitations`, `dataCoverage`, `dataPoints`, `usedSources`, `missingSources`, `scoringAvailable`, `completenessStatus`, `scoringNote`

---

### ReasonSignalFactorSnapshot

| Field | Value |
|-------|-------|
| Module | `src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts` |
| Data Table | `Subset of activeScoringSnapshot` |
| Date Field | `Inherits asOfDate from activeScoringSnapshot` |
| PIT Risk | **LOW** |
| Used in Scoring | ❌ No |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** Same as activeScoringSnapshot. Reason/signal/factor text must be derived from data available on asOfDate only.

**Missing Data Behavior:** Empty string / empty array. P8-PREFLIGHT classified 24 GENERIC reason cases.

**Notes:** FORBIDDEN in reasonSnapshot/signalSnapshot/factorSnapshot: outcomePrice, returnPct, realizedReturnClass, baseline comparison, future price/factor. P8-PREFLIGHT found 24 generic cases: TEMPLATE_TOO_GENERIC=9, SCORING_ENGINE_UNDEROUTPUT=9, FACTOR_EXPLANATION_MISSING=4, SNAPSHOT_CAPTURE_MISSING=2.

**Fields:** `reasonSnapshot`, `signalSnapshot`, `factorSnapshot`

---

### BucketContract

| Field | Value |
|-------|-------|
| Module | `outputs/online_validation/p6lite_bucket_contract_freeze.json` |
| Data Table | `p6lite_bucket_contract_freeze.json (frozen artifact)` |
| Date Field | `N/A — design contract, not time-series data` |
| PIT Risk | **LOW** |
| Used in Scoring | ✅ Yes |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** N/A — bucket mapping is stateless with respect to asOfDate

**Missing Data Behavior:** Unknown bucket label → normalize to Unknown. Score null/NaN → InsufficientData bucket.

**Notes:** P6-LITE final verdict: BY_DESIGN_BOUNDARY. Watch bucket accepts score=[21,29] as signal-qualified boundary cases. This is a design decision, not a schema bug. Bucket contract is frozen and should not be modified without a new P6 diagnosis cycle.

**Fields:** `canonicalBucketLabels`, `scoreThresholds`, `watchLowScoreBoundary`, `nonGoals`

---

### TwseTradingCalendar

| Field | Value |
|-------|-------|
| Module | `src/lib/backtest/TaiwanTradingCalendar.ts, src/lib/market/twTradingCalendar.ts` |
| Data Table | `Static calendar data / TWSE rules` |
| Date Field | `tradingDate` |
| PIT Risk | **LOW** |
| Used in Scoring | ❌ No |
| Captured in Snapshot | ✅ Yes |

**asOf Rule:** outcomeDate must be computed forward from asOfDate using only trading calendar — no market data involved in date arithmetic. Trading calendar data itself has no PIT leakage risk.

**Missing Data Behavior:** Default to calendar-day approximation if trading calendar unavailable.

**Notes:** Used for outcomeDate computation in corpus builder. outcomeDate is AFTER asOfDate — this is intentional for outcome tracking. The trading calendar itself does not introduce data leakage as it is a static artifact.

**Fields:** `tradingDays`, `horizonDays`, `outcomeDate`


## Key Findings

1. MonthlyRevenue: HIGH PIT risk — no releaseDate field in schema. Uses reporting period (year, month) as gate. Taiwan monthly revenue released on 10th of following month — may include unreleased data.
2. NewsEvent: HIGH PIT risk — not currently used in scoring but ingestedAt (DB write time) must NOT be used as PIT gate if added.
3. MarketRegime: MEDIUM risk — used in SignalFusionEngine but data sourcing for regime detection needs verification.
4. FinancialReport: MEDIUM risk — not currently used but lacks availabilityDate field.
5. StockQuote, InstitutionalChip, TechnicalIndicators, BucketContract: LOW risk — correctly gated.
6. ActiveScoringSnapshot: LOW risk — pitGateDate == asOfDate enforced. Forbidden fields validated.
7. ReasonSignalFactorSnapshot: LOW risk — inherits asOfDate gate. 24 generic cases tracked by P8-PREFLIGHT.
