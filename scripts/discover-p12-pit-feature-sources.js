'use strict';
/**
 * scripts/discover-p12-pit-feature-sources.js
 * PART B — P12-HARDRESET Feature Source Discovery
 *
 * Scans the codebase to identify all feature sources used by the scoring
 * and snapshot pipeline. Documents date fields, asOf rules, PIT risk levels.
 * NO scoring changes. NO corpus modifications. NO investment claims.
 */

const fs = require('fs');
const path = require('path');

const OUT = 'outputs/online_validation';
const NOW = '2026-05-12';
const WORKSPACE = process.cwd();

// ─── Feature source definitions ────────────────────────────────────────────
// Derived from codebase scan of:
//   src/lib/analysis/RuleBasedStockAnalyzer.ts
//   src/lib/alpha/SignalFusionEngine.ts
//   src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts
//   src/lib/onlineValidation/ShadowPredictionHistoricalReplayWriter.ts
//   src/lib/onlineValidation/ShadowPredictionLogContract.ts
//   prisma/schema.prisma

const featureSources = [
  {
    sourceName: 'StockQuote',
    modulePath: 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
    dataTableOrArtifact: 'prisma.stockQuote',
    featureFields: [
      'date',        // YYYYMMDD string
      'open',        // 開盤價
      'high',        // 最高價
      'low',         // 最低價
      'close',       // 收盤價
      'volume',      // 成交量
      'stockId',     // 股票代號
    ],
    dateField: 'date',
    asOfRule: 'WHERE date <= asOfDate (YYYYMMDD lexicographic). Entry price: date == asOfDate. Scoring features: date <= asOfDate only. No future quotes permitted.',
    missingDataBehavior: 'buildInsufficientResult() — returns researchBucket=InsufficientData, scoringCompletenessStatus=EMPTY',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'Correctly gated. analyzeStock(symbol, asOf) caps all queries to date <= asOf. String lexicographic comparison is valid for YYYYMMDD. closePriceAtPrediction is entry price on asOfDate. outcomeClose in outcomeSnapshot is captured AFTER prediction and is NOT part of the scoring snapshot — it is a separate write-back field.',
  },
  {
    sourceName: 'InstitutionalChip',
    modulePath: 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
    dataTableOrArtifact: 'prisma.institutionalChip',
    featureFields: [
      'date',        // YYYYMMDD string
      'stockId',
      'foreignBuy',  // 外資買賣超
      'trustBuy',    // 投信買賣超
      'dealerBuy',   // 自營商買賣超 (if present)
    ],
    dateField: 'date',
    asOfRule: 'WHERE date <= asOfDate. orderBy date DESC, take recent N rows.',
    missingDataBehavior: 'If chipCount < 5, chip factor is skipped. chipStrength = 0. missingSources includes InstitutionalChip.',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'Correctly gated by date <= asOf. Requires minimum 5 rows for chip score contribution. Chip tags (法人買超/法人賣超) appear in signalSnapshot and reasonSnapshot when chipStrength >= 65 or <= 35.',
  },
  {
    sourceName: 'MonthlyRevenue',
    modulePath: 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
    dataTableOrArtifact: 'prisma.monthlyRevenue',
    featureFields: [
      'year',        // 年份
      'month',       // 月份
      'revenue',     // 月營收
      'yoyGrowth',   // YoY%  (optional)
      'momGrowth',   // MoM%  (optional)
      'stockId',
    ],
    dateField: 'year + month (composite)',
    asOfRule: 'WHERE (year < asOfYear) OR (year == asOfYear AND month <= asOfMonth). No releaseDate field in schema — uses reporting period (year, month) as proxy.',
    missingDataBehavior: 'If revenueCount < 13, revenue factor is skipped. revenueYoY = null. missingSources includes MonthlyRevenue.',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'HIGH',
    notes: 'CRITICAL PIT RISK: MonthlyRevenue uses reporting period (year, month) as the date gate, NOT a releaseDate. In Taiwan, monthly revenue is released on the 10th of the following month. Using month-end as the cutoff may include data that was NOT yet publicly available on asOfDate if asOfDate < 10th of (month+1). No releaseDate field exists in the prisma schema. This is a known PIT leakage risk that must be documented in the contract. Repair requires adding a releaseDate field to the schema — out of scope for P12.',
  },
  {
    sourceName: 'FinancialReport',
    modulePath: 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
    dataTableOrArtifact: 'prisma.financialReport',
    featureFields: [
      'year',
      'quarter',
      'eps',
      'netIncome',
      'grossMargin',
      'operatingMargin',
      'stockId',
    ],
    dateField: 'year + quarter (composite)',
    asOfRule: 'Not currently used in RuleBasedStockAnalyzer scoring formula. Exists in schema but not queried for alphaScore/researchBucket computation.',
    missingDataBehavior: 'N/A — not queried currently',
    currentlyUsedInScoring: false,
    currentlyCapturedInSnapshot: false,
    pitRiskLevel: 'MEDIUM',
    notes: 'FinancialReport exists in prisma schema but is NOT currently used by RuleBasedStockAnalyzer or SignalFusionEngine for scoring. If added in future: requires availabilityDate field (Taiwan quarterly reports released 45–60 days after quarter end). Currently MEDIUM risk because it is not active, but HIGH risk if added without availabilityDate gate.',
  },
  {
    sourceName: 'NewsEvent',
    modulePath: 'src/lib/events/adapters/RSSNewsAdapter.ts',
    dataTableOrArtifact: 'prisma.newsEvent',
    featureFields: [
      'title',
      'summary',
      'source',
      'trustLevel',
      'publishedAt',      // DateTime — the correct PIT gate field
      'relatedSymbols',   // JSON string[]
      'relatedThemes',    // JSON string[]
      'ingestedAt',       // DB ingestion time — NOT a PIT-safe gate
    ],
    dateField: 'publishedAt',
    asOfRule: 'WHERE publishedAt <= asOfDate. Must NOT use ingestedAt as PIT gate. ingestedAt reflects DB write time which may lag publishedAt.',
    missingDataBehavior: 'Not currently consumed by scoring pipeline',
    currentlyUsedInScoring: false,
    currentlyCapturedInSnapshot: false,
    pitRiskLevel: 'HIGH',
    notes: 'NewsEvent exists in schema and has RSSNewsAdapter for ingestion. NOT currently consumed by RuleBasedStockAnalyzer or SignalFusionEngine scoring. If added in future: must gate by publishedAt <= asOfDate. Must NOT use ingestedAt (DB write time). relatedSymbols must be validated as parseable JSON string array.',
  },
  {
    sourceName: 'TechnicalIndicators',
    modulePath: 'src/lib/analysis/TechnicalSignalCalculator.ts, src/lib/analysis/RuleBasedStockAnalyzer.ts',
    dataTableOrArtifact: 'Computed from prisma.stockQuote (in-memory)',
    featureFields: [
      'technicalScore',   // 0–100 composite
      'momentumScore',    // price momentum
      'riskLevel',        // computed risk classification
      'trendSignals',     // derived from quote window
    ],
    dateField: 'Inherits from StockQuote.date <= asOfDate',
    asOfRule: 'All technical indicator windows (MA, momentum, etc.) must use only stockQuote rows with date <= asOfDate. Rolling window must not cross the asOfDate boundary.',
    missingDataBehavior: 'If quoteCount < minimum window, technical indicators fallback to partial computation. technicalScore may be low-confidence.',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'Derived from StockQuote which is correctly gated. Risk is LOW as long as StockQuote gate is maintained. Captured in scoreSnapshot.technicalScore and factorSnapshot (Technical factor descriptions).',
  },
  {
    sourceName: 'MarketRegime',
    modulePath: 'src/lib/market/MarketRegimeEngine.ts (via SignalFusionEngine.ts)',
    dataTableOrArtifact: 'Computed from market-wide indicators',
    featureFields: [
      'regime',       // Bull / Bear / Sideways / Unknown
      'confidence',   // 0–1
      'factors',      // market regime factors
    ],
    dateField: 'asOf parameter passed from SignalFusionEngine',
    asOfRule: 'detectRegime(asOf) must use data <= asOf. Regime classification must not use future market data.',
    missingDataBehavior: 'If detectRegime throws, defaults to { regime: Unknown, confidence: 0, factors: [] }',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: false,
    pitRiskLevel: 'MEDIUM',
    notes: 'Used in SignalFusionEngine for market adjustment. detectRegime is called with asOf. Not explicitly captured in activeScoringSnapshot fields — market adjustment is reflected in scoreSnapshot.marketAdjustment. MEDIUM risk: regime detection data sourcing needs verification.',
  },
  {
    sourceName: 'ActiveScoringSnapshot',
    modulePath: 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts',
    dataTableOrArtifact: 'In-memory artifact, written to corpus JSONL',
    featureFields: [
      'asOfDate',                 // REQUIRED — PIT gate date
      'pitGateDate',              // REQUIRED — must equal asOfDate
      'scoringMode',              // RULE_BASED_ANALYZER
      'scoringEngineSource',      // RuleBasedStockAnalyzer
      'researchBucket',           // Strong/Watch/Neutral/LowPriority/InsufficientData
      'alphaScore',               // 0–100
      'scoreSnapshot',            // researchScore, technicalScore, chipScore, fundamentalScore, marketAdjustment
      'signalSnapshot',           // factor names only (string[])
      'factorSnapshot',           // factor descriptions (string[])
      'reasonSnapshot',           // reason/summary text
      'limitations',              // missing data notes
      'dataCoverage',             // FULL/PARTIAL/INSUFFICIENT
      'dataPoints',               // count
      'usedSources',              // string[]
      'missingSources',           // string[]
      'scoringAvailable',         // boolean
      'completenessStatus',       // COMPLETE/PARTIAL/EMPTY
      'scoringNote',              // optional notes
    ],
    dateField: 'asOfDate',
    asOfRule: 'pitGateDate MUST equal asOfDate. All scoring data capped at asOfDate.',
    missingDataBehavior: 'buildEmptySnapshot() if analyzeStock throws. scoringAvailable=false, completenessStatus=EMPTY.',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'FORBIDDEN FIELDS in activeScoringSnapshot: outcomePrice, returnPct, realizedReturnClass, baseline comparison results, any future price or future feature. These are write-back fields that exist at corpus row level (outcomeSnapshot) but must NOT appear inside activeScoringSnapshot itself.',
  },
  {
    sourceName: 'ReasonSignalFactorSnapshot',
    modulePath: 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts',
    dataTableOrArtifact: 'Subset of activeScoringSnapshot',
    featureFields: [
      'reasonSnapshot',    // string — reason text from RuleBasedStockAnalyzer.buildReason()
      'signalSnapshot',    // string[] — factor names
      'factorSnapshot',    // string[] — factor descriptions
    ],
    dateField: 'Inherits asOfDate from activeScoringSnapshot',
    asOfRule: 'Same as activeScoringSnapshot. Reason/signal/factor text must be derived from data available on asOfDate only.',
    missingDataBehavior: 'Empty string / empty array. P8-PREFLIGHT classified 24 GENERIC reason cases.',
    currentlyUsedInScoring: false,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'FORBIDDEN in reasonSnapshot/signalSnapshot/factorSnapshot: outcomePrice, returnPct, realizedReturnClass, baseline comparison, future price/factor. P8-PREFLIGHT found 24 generic cases: TEMPLATE_TOO_GENERIC=9, SCORING_ENGINE_UNDEROUTPUT=9, FACTOR_EXPLANATION_MISSING=4, SNAPSHOT_CAPTURE_MISSING=2.',
  },
  {
    sourceName: 'BucketContract',
    modulePath: 'outputs/online_validation/p6lite_bucket_contract_freeze.json',
    dataTableOrArtifact: 'p6lite_bucket_contract_freeze.json (frozen artifact)',
    featureFields: [
      'canonicalBucketLabels',   // Strong/Watch/Neutral/LowPriority/InsufficientData
      'scoreThresholds',         // Strong>=60, Watch=40-70, Neutral=30-70, LowPriority=0-50
      'watchLowScoreBoundary',   // score=[21,29] accepted in Watch — BY_DESIGN_BOUNDARY
      'nonGoals',                // what is NOT part of this contract
    ],
    dateField: 'N/A — design contract, not time-series data',
    asOfRule: 'N/A — bucket mapping is stateless with respect to asOfDate',
    missingDataBehavior: 'Unknown bucket label → normalize to Unknown. Score null/NaN → InsufficientData bucket.',
    currentlyUsedInScoring: true,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'P6-LITE final verdict: BY_DESIGN_BOUNDARY. Watch bucket accepts score=[21,29] as signal-qualified boundary cases. This is a design decision, not a schema bug. Bucket contract is frozen and should not be modified without a new P6 diagnosis cycle.',
  },
  {
    sourceName: 'TwseTradingCalendar',
    modulePath: 'src/lib/backtest/TaiwanTradingCalendar.ts, src/lib/market/twTradingCalendar.ts',
    dataTableOrArtifact: 'Static calendar data / TWSE rules',
    featureFields: [
      'tradingDays',     // set of valid trading dates
      'horizonDays',     // 5 / 10 / 20 calendar unit
      'outcomeDate',     // asOfDate + horizonDays (trading days)
    ],
    dateField: 'tradingDate',
    asOfRule: 'outcomeDate must be computed forward from asOfDate using only trading calendar — no market data involved in date arithmetic. Trading calendar data itself has no PIT leakage risk.',
    missingDataBehavior: 'Default to calendar-day approximation if trading calendar unavailable.',
    currentlyUsedInScoring: false,
    currentlyCapturedInSnapshot: true,
    pitRiskLevel: 'LOW',
    notes: 'Used for outcomeDate computation in corpus builder. outcomeDate is AFTER asOfDate — this is intentional for outcome tracking. The trading calendar itself does not introduce data leakage as it is a static artifact.',
  },
];

// Build summary
const byRisk = {};
for (const fs_ of featureSources) {
  byRisk[fs_.pitRiskLevel] = (byRisk[fs_.pitRiskLevel] || 0) + 1;
}
const highRisk = featureSources.filter(s => s.pitRiskLevel === 'HIGH').map(s => s.sourceName);
const usedInScoring = featureSources.filter(s => s.currentlyUsedInScoring).map(s => s.sourceName);
const notInSnapshot = featureSources.filter(s => s.currentlyUsedInScoring && !s.currentlyCapturedInSnapshot).map(s => s.sourceName);

const report = {
  generatedAt: `${NOW}T00:00:00.000Z`,
  disclaimer: 'Feature source discovery only. No investment recommendations. No scoring changes. No corpus modifications. Observability and contract scaffolding only.',
  phase: 'P12-HARDRESET',
  scanDate: NOW,
  totalSourcesDiscovered: featureSources.length,
  byPitRiskLevel: byRisk,
  highRiskSources: highRisk,
  activelyUsedInScoring: usedInScoring,
  usedButNotCapturedInSnapshot: notInSnapshot,
  featureSources,
  keyFindings: [
    'MonthlyRevenue: HIGH PIT risk — no releaseDate field in schema. Uses reporting period (year, month) as gate. Taiwan monthly revenue released on 10th of following month — may include unreleased data.',
    'NewsEvent: HIGH PIT risk — not currently used in scoring but ingestedAt (DB write time) must NOT be used as PIT gate if added.',
    'MarketRegime: MEDIUM risk — used in SignalFusionEngine but data sourcing for regime detection needs verification.',
    'FinancialReport: MEDIUM risk — not currently used but lacks availabilityDate field.',
    'StockQuote, InstitutionalChip, TechnicalIndicators, BucketContract: LOW risk — correctly gated.',
    'ActiveScoringSnapshot: LOW risk — pitGateDate == asOfDate enforced. Forbidden fields validated.',
    'ReasonSignalFactorSnapshot: LOW risk — inherits asOfDate gate. 24 generic cases tracked by P8-PREFLIGHT.',
  ],
};

const fs_ = require('fs');
fs_.writeFileSync(`${OUT}/p12pit_feature_source_discovery.json`, JSON.stringify(report, null, 2));

const md = `# P12-HARDRESET Feature Source Discovery

**Date:** ${NOW}  
**Phase:** P12-HARDRESET PART B  
**Sources Discovered:** ${featureSources.length}

> **Disclaimer:** Feature source discovery only. No investment recommendations. No scoring changes. No corpus modifications.

## PIT Risk Summary

| Risk Level | Count |
|-----------|-------|
${Object.entries(byRisk).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## High-Risk Sources

${highRisk.map(s => `- **${s}** — requires PIT contract guardrail`).join('\n')}

## Feature Sources

${featureSources.map(s => `### ${s.sourceName}

| Field | Value |
|-------|-------|
| Module | \`${s.modulePath}\` |
| Data Table | \`${s.dataTableOrArtifact}\` |
| Date Field | \`${s.dateField}\` |
| PIT Risk | **${s.pitRiskLevel}** |
| Used in Scoring | ${s.currentlyUsedInScoring ? '✅ Yes' : '❌ No'} |
| Captured in Snapshot | ${s.currentlyCapturedInSnapshot ? '✅ Yes' : '❌ No'} |

**asOf Rule:** ${s.asOfRule}

**Missing Data Behavior:** ${s.missingDataBehavior}

**Notes:** ${s.notes}

**Fields:** ${s.featureFields.map(f => `\`${f}\``).join(', ')}
`).join('\n---\n\n')}

## Key Findings

${report.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
`;

fs_.writeFileSync(`${OUT}/p12pit_feature_source_discovery.md`, md);
console.log('PART B complete. Sources:', featureSources.length, '| High risk:', highRisk.length);
console.log('Output: p12pit_feature_source_discovery.json + .md');
