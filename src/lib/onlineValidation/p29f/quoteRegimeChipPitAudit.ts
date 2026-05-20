/**
 * P29F: Quote / Regime / Chip PIT Validation Audit (Static / Read-only)
 * paper-only / audit-only / NOT investment recommendation
 *
 * AUDIT ONLY — does not:
 *   - modify production scoring behavior
 *   - modify RuleBasedStockAnalyzer / SignalFusionEngine / ActiveScoringSnapshotBuilder
 *   - write prisma/dev.db
 *   - mutate corpus (*.jsonl)
 *   - execute optimizer or backtest
 *   - produce performance claims
 *
 * Findings are static evidence gathered from source code analysis.
 * Classifications: PIT_SAFE_VERIFIED | PIT_UNVERIFIED_NEEDS_REPAIR |
 *                  PIT_VIOLATION_CONFIRMED | INSUFFICIENT_EVIDENCE
 */

import type {
  P29FAuditSummary,
  PitSourceAuditResult,
  PitAuditFinding,
  PitAuditEvidence,
} from "./pitAuditTypes";

export { P29FAuditSummary, PitSourceAuditResult, PitAuditFinding, PitAuditEvidence };
export type { PitAuditClassification } from "./pitAuditTypes";

// ── PIT Rules ───────────────────────────────────────────────────────────────

/** PIT rule definitions for each source */
export const PIT_RULES = {
  Quote: {
    sourceName: "Quote",
    dbTable: "StockQuote",
    dateField: "date",
    expectedFormat: "YYYYMMDD (per schema comment and DB_DATE_FORMAT constant)",
    actualSyncFormat: "ISO (YYYY-MM-DD) via parseTwseDateToIso in syncDailyQuotes",
    gateImplementation:
      "RuleBasedStockAnalyzer.ts: date: { lte: asOfDb } where asOfDb = asOf.replace(/-/g,'')",
    gateFormatUsed: "YYYYMMDD (asOfDb converted from ISO asOf param)",
    riskIfFormatMismatch:
      "Same-year future ISO dates pass YYYYMMDD filter (ISO '2026-xx-xx' always < YYYYMMDD '2026xxxx' due to '-' < '0')",
    pitRules: [
      "All StockQuote rows must have date <= asOfDate",
      "Technical calculations (MA, RSI, MACD, momentum) use queried data only — no forward references",
      "asOf parameter must be passed from ActiveScoringSnapshotBuilder and SignalFusionEngine",
      "Live API (/api/strategy/analyze) may call without asOf — expected for current-data queries",
    ],
  },
  Regime: {
    sourceName: "Regime",
    dbTable: "MarketIndex",
    dateField: "date",
    expectedFormat: "ISO (YYYY-MM-DD) — inferred from syncMarketIndices using openapiDate",
    actualSyncFormat: "ISO (YYYY-MM-DD) via parseTwseDateToIso → stored as ISO",
    gateImplementation:
      "MarketRegimeEngine.ts detectRegime(asOf): date: { lte: asOf } — ISO asOf directly",
    gateFormatUsed: "ISO (asOf param passed directly, no YYYYMMDD conversion)",
    riskIfFormatMismatch: "If MarketIndex stored YYYYMMDD (not ISO), all rows would fail the filter",
    pitRules: [
      "MarketIndex rows must have date <= asOf for detectRegime(asOf)",
      "MA50/MA200/momentum/volatility calculations are all backward-looking from queried data",
      "detectRegimeForPeriod uses date range [startDate, endDate] — backtest-only function",
      "Live calls without asOf (DailyAlertEngine, RelevanceInsightsService) are correct for current use",
    ],
  },
  Chip: {
    sourceName: "Chip",
    dbTable: "InstitutionalChip",
    dateField: "date",
    expectedFormat: "YYYYMMDD (per schema comment: String // YYYYMMDD)",
    actualSyncFormat: "ISO (YYYY-MM-DD) — confirmed in syncInstitutionalChip: date: isoDate",
    gateImplementation:
      "RuleBasedStockAnalyzer.ts: date: { lte: asOfDb } where asOfDb = asOf.replace(/-/g,'')",
    gateFormatUsed: "YYYYMMDD (asOfDb converted from ISO asOf param)",
    riskIfFormatMismatch:
      "Same-year future ISO chip dates pass YYYYMMDD filter — same issue as Quote",
    pitRules: [
      "InstitutionalChip rows must have date <= asOfDate",
      "Chip strength uses last 10 rows (orderBy date desc) — all backward-looking aggregates",
      "Publication lag: chip data for T published at ~6pm on T — same-day inclusion is industry standard",
      "No forward-looking fields: uses totalBuy, foreignBuy, trustBuy (net flow data)",
    ],
  },
} as const;

// ── Suspicious field patterns ────────────────────────────────────────────────

/** Field name patterns that would indicate PIT contamination */
export const SUSPICIOUS_FUTURE_PATTERNS = [
  "future",
  "next",
  "forward",
  "outcome",
  "realized",
  "after",
  "post",
  "target",
  "label",
  "returnPct",
  "horizonReturn",
  "outcomePrice",
  "outcomeClose",
  "forecastReturn",
] as const;

/** Checks a field name against suspicious patterns (case-insensitive) */
export function hasSuspiciousFuturePattern(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return SUSPICIOUS_FUTURE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

// ── Static Audit Results ─────────────────────────────────────────────────────

/**
 * Static audit result for Quote (StockQuote).
 * Based on source code analysis of:
 * - src/lib/analysis/RuleBasedStockAnalyzer.ts
 * - src/lib/services/syncService.ts (syncDailyQuotes)
 * - src/lib/api/twseApi.ts (getDailyStocks → parseTwseDateToIso)
 * - src/lib/data/AsOfDataGate.ts (DB_DATE_FORMAT = 'YYYYMMDD')
 * - prisma/schema.prisma (StockQuote.date: String // 交易日期 (YYYYMMDD or string format))
 */
export const QUOTE_AUDIT_RESULT: PitSourceAuditResult = {
  sourceName: "Quote",
  classification: "PIT_UNVERIFIED_NEEDS_REPAIR",
  riskLevel: "MEDIUM_HIGH",
  findings: [
    {
      id: "Q-F01",
      category: "GATE_EXISTS",
      severity: "INFO",
      description: "PIT gate exists in RuleBasedStockAnalyzer.ts",
      evidence: [
        {
          fileRef: "src/lib/analysis/RuleBasedStockAnalyzer.ts",
          lineRef: "L59-79",
          snippet:
            "const asOfDb = asOf ? asOf.replace(/-/g, '') : null;\n" +
            "prisma.stockQuote.findMany({ where: { stockId: symbol, ...(asOfDb ? { date: { lte: asOfDb } } : {}) } })",
          interpretation:
            "Gate exists and is applied when asOf is provided. asOf converts YYYY-MM-DD to YYYYMMDD.",
        },
      ],
    },
    {
      id: "Q-F02",
      category: "DATE_FORMAT_MISMATCH",
      severity: "ERROR",
      description:
        "Date format inconsistency between storage (ISO from sync) and gate (YYYYMMDD from asOfDb). " +
        "Schema comment says YYYYMMDD but syncDailyQuotes stores ISO via parseTwseDateToIso.",
      evidence: [
        {
          fileRef: "src/lib/services/syncService.ts",
          lineRef: "L159,L174",
          snippet: "date: quote.date,  // quote.date from getDailyStocks → parseTwseDateToIso → ISO",
          interpretation:
            "Sync stores ISO format (YYYY-MM-DD) via parseTwseDateToIso which converts YYYYMMDD→ISO.",
        },
        {
          fileRef: "src/lib/data/AsOfDataGate.ts",
          lineRef: "L26,L151",
          snippet: "export const DB_DATE_FORMAT = 'YYYYMMDD';\n// DB stores as YYYYMMDD — convert for consistent comparison\nconst dbAsOf = toDbFormat(resolvedAsOf);",
          interpretation:
            "AsOfDataGate declares DB_DATE_FORMAT = 'YYYYMMDD' but sync code contradicts this.",
        },
        {
          fileRef: "src/lib/analysis/RuleBasedStockAnalyzer.ts",
          lineRef: "L59-61",
          snippet:
            "// DB stores dates as YYYYMMDD strings; string lexicographic comparison works correctly.\n" +
            "const asOfDb = asOf ? asOf.replace(/-/g, '') : null;",
          interpretation:
            "Code comment says YYYYMMDD but if storage is ISO, the gate lte: YYYYMMDD would pass ALL ISO dates " +
            "(ISO '2026-xx-xx' always < YYYYMMDD '2026xxxx' because '-' ASCII 45 < '0' ASCII 48). " +
            "Same-year future records would NOT be filtered out.",
        },
      ],
    },
    {
      id: "Q-F03",
      category: "GATE_INEFFECTIVE",
      severity: "ERROR",
      description:
        "If StockQuote.date is stored as ISO (confirmed by sync code): " +
        "filter 'date <= YYYYMMDD' would pass ALL ISO dates from same year or prior years. " +
        "Same-year future dates (e.g., '2026-06-01') would pass filter for asOf='2026-01-15' (asOfDb='20260115').",
      evidence: [
        {
          fileRef: "ANALYSIS",
          snippet:
            "ISO '2026-06-01' <= YYYYMMDD '20260115'? ASCII comparison: '2026-06-01'[4]='-'(45) < '20260115'[4]='0'(48) → TRUE → future record included",
          interpretation:
            "Same-year future ISO records pass the YYYYMMDD gate. Cross-year filtering works correctly " +
            "because '2027-...'[3]='7' > '2026...'[3]='6'. Only same-year future dates are at risk.",
        },
      ],
    },
    {
      id: "Q-F04",
      category: "GATE_EXISTS",
      severity: "INFO",
      description:
        "asOf is correctly propagated through the call chain: " +
        "ActiveScoringSnapshotBuilder → analyzeStock(asOf) → stockQuote.findMany(lte: asOfDb). " +
        "SignalFusionEngine also passes asOf through fuseSignals.",
      evidence: [
        {
          fileRef: "src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts",
          lineRef: "L280-287",
          snippet: "result = await analyzerFn(symbol, asOfDate);",
          interpretation: "asOfDate correctly passed from builder to analyzer.",
        },
        {
          fileRef: "src/lib/alpha/SignalFusionEngine.ts",
          lineRef: "L228",
          snippet: "const analysis = await analyzeStock(symbol, asOf);",
          interpretation: "asOf correctly passed in SignalFusionEngine.",
        },
      ],
    },
    {
      id: "Q-F05",
      category: "LIVE_API_NO_ASOF",
      severity: "INFO",
      description:
        "Live analyze API (POST /api/strategy/analyze) calls analyzeStock(symbol) without asOf. " +
        "This is expected behavior for current-data live scoring.",
      evidence: [
        {
          fileRef: "src/app/api/strategy/analyze/route.ts",
          lineRef: "L22",
          snippet: "const result = await analyzeStock(symbol);",
          interpretation:
            "Live API does not use asOf gate — correct for current scoring, not for historical simulation.",
        },
      ],
    },
    {
      id: "Q-F06",
      category: "ADVISORY",
      severity: "WARNING",
      description:
        "No confirmed future-data contamination in current DB state (sync only ingests current/past data). " +
        "Risk is latent: would manifest if future records entered DB or if historical simulation " +
        "runs with same-year future records present.",
      evidence: [
        {
          fileRef: "ANALYSIS",
          snippet: "syncDailyQuotes only ingests current trading day data. No future records expected in normal operation.",
          interpretation: "Practical risk is low currently but gate must be repaired before simulation use.",
        },
      ],
    },
  ],
  recommendedNextAction:
    "Verify actual StockQuote.date storage format (ISO or YYYYMMDD) by querying DB. " +
    "If ISO: change RuleBasedStockAnalyzer to use ISO asOf directly (remove replace(/-/g,'')). " +
    "If YYYYMMDD: update sync code to store YYYYMMDD. " +
    "Add integration test that confirms gate excludes same-year future records.",
  mayRemainInAlphaScore: true,
  mustBlockBeforeSimulation: true,
  simulationInputTag: "UNVERIFIED",
  auditedAt: "2026-05-20T00:00:00Z",
};

/**
 * Static audit result for Regime (MarketRegime / MarketIndex).
 * Based on source code analysis of:
 * - src/lib/market/MarketRegimeEngine.ts
 * - src/lib/alpha/SignalFusionEngine.ts
 * - src/lib/services/syncService.ts (syncMarketIndices)
 * - src/lib/api/twseApi.ts (getLatestMarketSnapshot → openapiDate)
 */
export const REGIME_AUDIT_RESULT: PitSourceAuditResult = {
  sourceName: "Regime",
  classification: "PIT_SAFE_VERIFIED",
  riskLevel: "LOW",
  findings: [
    {
      id: "R-F01",
      category: "GATE_EXISTS",
      severity: "INFO",
      description:
        "detectRegime(asOf) applies PIT gate: date: { lte: asOf } on MarketIndex.date. " +
        "Format is ISO on both sides (stored ISO, queried ISO) → correct lexicographic comparison.",
      evidence: [
        {
          fileRef: "src/lib/market/MarketRegimeEngine.ts",
          lineRef: "L65-73",
          snippet:
            "const rows = await prisma.marketIndex.findMany({\n" +
            "  where: { name: 'TAIEX', ...(asOf ? { date: { lte: asOf } } : {}) },\n" +
            "  orderBy: { date: 'asc' }\n" +
            "});",
          interpretation:
            "Gate applies ISO asOf directly. MarketIndex.date stored as ISO (from parseTwseDateToIso via syncMarketIndices). ISO ≤ ISO comparison is correct.",
        },
        {
          fileRef: "src/lib/services/syncService.ts",
          lineRef: "L260-290",
          snippet:
            "const marketDate = snapshot.date; // from getLatestMarketSnapshot → openapiDate → ISO\n" +
            "date: marketDate, // stored as ISO",
          interpretation: "MarketIndex.date stored in ISO format confirming correct comparison.",
        },
      ],
    },
    {
      id: "R-F02",
      category: "GATE_EXISTS",
      severity: "INFO",
      description:
        "All regime calculations are backward-looking: MA50, MA200, 20d momentum, 60d momentum, " +
        "20d volatility — all computed from data returned by the PIT-gated query.",
      evidence: [
        {
          fileRef: "src/lib/market/MarketRegimeEngine.ts",
          lineRef: "L100-220",
          snippet:
            "const prices = rows.map(r => r.value);\n" +
            "const ma50 = sma(prices, 50);\n" +
            "const ma200 = sma(prices, 200);\n" +
            "const ret20 = ((currentPrice - prices[prices.length - 21]) / ...) * 100;",
          interpretation:
            "All calculations use rows (PIT-gated data). No forward references. currentPrice = prices[last] which is the latest record ≤ asOf.",
        },
      ],
    },
    {
      id: "R-F03",
      category: "BACKTEST_ONLY",
      severity: "INFO",
      description:
        "detectRegimeForPeriod(startDate, endDate) uses full period return including endDate. " +
        "This is ONLY called from /api/stocks/backtest/route.ts — not in production scoring path.",
      evidence: [
        {
          fileRef: "src/app/api/stocks/backtest/route.ts",
          lineRef: "L138",
          snippet: "marketRegime = await detectRegimeForPeriod(periodDates[0], periodDates[1]);",
          interpretation:
            "detectRegimeForPeriod is backtest-only. Not called from analyzeStock, fuseSignals, " +
            "ActiveScoringSnapshotBuilder, or any simulation path. Intentional full-period analysis.",
        },
      ],
    },
    {
      id: "R-F04",
      category: "LIVE_API_NO_ASOF",
      severity: "INFO",
      description:
        "DailyAlertEngine and RelevanceInsightsService call detectRegime() without asOf. " +
        "This is correct — they need current regime, not historical.",
      evidence: [
        {
          fileRef: "src/lib/notify/DailyAlertEngine.ts",
          lineRef: "L121",
          snippet: "const regime = await detectRegime().catch(() => null);",
          interpretation: "Live use without asOf is correct. Historical simulation would pass asOf.",
        },
      ],
    },
    {
      id: "R-F05",
      category: "GATE_EXISTS",
      severity: "INFO",
      description:
        "SignalFusionEngine passes asOf through to detectRegime, and passes regimeOverride for batch efficiency.",
      evidence: [
        {
          fileRef: "src/lib/alpha/SignalFusionEngine.ts",
          lineRef: "L236",
          snippet: "regime = await detectRegime(asOf);",
          interpretation: "asOf correctly passed in single-stock mode. Batch uses regimeOverride (also gated with asOf at batch level).",
        },
      ],
    },
  ],
  recommendedNextAction:
    "No immediate repair required. Document the ISO format assumption for MarketIndex.date in the PIT registry. " +
    "Add one integration test confirming detectRegime(pastDate) excludes records after pastDate.",
  mayRemainInAlphaScore: true,
  mustBlockBeforeSimulation: false,
  simulationInputTag: "VERIFIED",
  auditedAt: "2026-05-20T00:00:00Z",
};

/**
 * Static audit result for Chip (InstitutionalChip).
 * Based on source code analysis of:
 * - src/lib/analysis/RuleBasedStockAnalyzer.ts (calculateChipStrength)
 * - src/lib/services/syncService.ts (syncInstitutionalChip)
 * - prisma/schema.prisma (InstitutionalChip.date: String // YYYYMMDD — comment inconsistent with sync)
 */
export const CHIP_AUDIT_RESULT: PitSourceAuditResult = {
  sourceName: "Chip",
  classification: "PIT_UNVERIFIED_NEEDS_REPAIR",
  riskLevel: "MEDIUM",
  findings: [
    {
      id: "C-F01",
      category: "GATE_EXISTS",
      severity: "INFO",
      description:
        "PIT gate exists: institutionalChip.findMany with date: { lte: asOfDb }. " +
        "Same mechanism as Quote — same date format risk applies.",
      evidence: [
        {
          fileRef: "src/lib/analysis/RuleBasedStockAnalyzer.ts",
          lineRef: "L84-86",
          snippet:
            "prisma.institutionalChip.findMany({\n" +
            "  where: { stockId: symbol, ...(asOfDb ? { date: { lte: asOfDb } } : {}) },\n" +
            "  orderBy: { date: 'desc' }, take: 60\n})",
          interpretation: "Gate exists. Uses YYYYMMDD asOfDb. Same format issue as Quote applies.",
        },
      ],
    },
    {
      id: "C-F02",
      category: "DATE_FORMAT_MISMATCH",
      severity: "ERROR",
      description:
        "Schema comment says 'YYYYMMDD' but syncInstitutionalChip confirmed to store ISO format. " +
        "Schema comment is wrong/stale.",
      evidence: [
        {
          fileRef: "prisma/schema.prisma",
          snippet: "date String // YYYYMMDD",
          interpretation: "Schema comment says YYYYMMDD but sync code contradicts this.",
        },
        {
          fileRef: "src/lib/services/syncService.ts",
          lineRef: "L393-395",
          snippet:
            "const targetDate = dateStr ?? new Date().toISOString().replace(/-/g,'').slice(0, 8); // YYYYMMDD\n" +
            "const isoDate = `${targetDate.slice(0,4)}-${targetDate.slice(4,6)}-${targetDate.slice(6,8)}`;\n" +
            "// ...\n" +
            "prisma.institutionalChip.upsert({ ..., create: { stockId, date: isoDate, ... } })",
          interpretation:
            "Chip sync converts to ISO and stores isoDate. Schema comment 'YYYYMMDD' is incorrect. " +
            "Actual storage is ISO (YYYY-MM-DD), creating the same PIT gate format mismatch as Quote.",
        },
      ],
    },
    {
      id: "C-F03",
      category: "GATE_INEFFECTIVE",
      severity: "ERROR",
      description:
        "Same gate ineffectiveness as Quote: YYYYMMDD asOfDb filter does not exclude same-year future ISO chip records.",
      evidence: [
        {
          fileRef: "ANALYSIS",
          snippet:
            "ISO chip date '2026-06-01' <= YYYYMMDD '20260115'? Same analysis as Quote → TRUE → future chip included",
          interpretation:
            "Same-year future chip data passes the YYYYMMDD gate if dates are stored as ISO.",
        },
      ],
    },
    {
      id: "C-F04",
      category: "ADVISORY",
      severity: "INFO",
      description:
        "calculateChipStrength uses chips.slice(0, 10) from orderBy date desc — last 10 records up to asOf. " +
        "Fields used: totalBuy, foreignBuy, trustBuy. All are backward-looking aggregates. No forward fields.",
      evidence: [
        {
          fileRef: "src/lib/analysis/RuleBasedStockAnalyzer.ts",
          lineRef: "L395-420",
          snippet:
            "function calculateChipStrength(chips: any[], factors: AnalysisFactor[]): number {\n" +
            "  const recentChips = chips.slice(0, 10);\n" +
            "  const totalNetBuy = recentChips.reduce((s, c) => s + (c.totalBuy || 0), 0);\n" +
            "  ...\n}",
          interpretation:
            "No forward-looking fields. Chip strength is backward aggregation of net institutional flow.",
        },
      ],
    },
    {
      id: "C-F05",
      category: "PUBLICATION_LAG",
      severity: "WARNING",
      description:
        "InstitutionalChip data for day T is published by TWSE at ~6pm on T (after market close). " +
        "Gate date: { lte: asOf } with asOf=T includes same-day chip data. " +
        "This is industry-standard for end-of-day scoring but creates an intraday information gap " +
        "if scoring is intended for pre-market on T.",
      evidence: [
        {
          fileRef: "DOMAIN_KNOWLEDGE",
          snippet: "TWSE T86 chip data published: ~6pm on trading day T.",
          interpretation:
            "For post-close scoring on T (standard use case), same-day chip is correctly available. " +
            "For pre-market on T, chip data for T should not be included. Current gate allows both.",
        },
      ],
    },
    {
      id: "C-F06",
      category: "ADVISORY",
      severity: "INFO",
      description:
        "No confirmed future chip contamination in current DB. Sync only ingests current-day chip data. " +
        "Risk is latent.",
      evidence: [
        {
          fileRef: "ANALYSIS",
          snippet: "syncInstitutionalChip only runs for current or specified past date.",
          interpretation: "No future chip records expected in normal operation.",
        },
      ],
    },
  ],
  recommendedNextAction:
    "1. Update schema comment from 'YYYYMMDD' to 'ISO (YYYY-MM-DD)' to match actual storage. " +
    "2. Fix RuleBasedStockAnalyzer chip query to use ISO asOf directly (same fix as Quote). " +
    "3. Document end-of-day publication assumption for chip data. " +
    "4. Add integration test confirming gate excludes same-year future chip records.",
  mayRemainInAlphaScore: true,
  mustBlockBeforeSimulation: true,
  simulationInputTag: "UNVERIFIED",
  auditedAt: "2026-05-20T00:00:00Z",
};

// ── Full Audit Summary ────────────────────────────────────────────────────────

/** Build the complete P29F audit summary */
export function buildP29FAuditSummary(): P29FAuditSummary {
  const trustRootBlockerRemains =
    QUOTE_AUDIT_RESULT.mustBlockBeforeSimulation ||
    CHIP_AUDIT_RESULT.mustBlockBeforeSimulation ||
    REGIME_AUDIT_RESULT.mustBlockBeforeSimulation;

  const anyViolation =
    QUOTE_AUDIT_RESULT.classification === "PIT_VIOLATION_CONFIRMED" ||
    CHIP_AUDIT_RESULT.classification === "PIT_VIOLATION_CONFIRMED" ||
    REGIME_AUDIT_RESULT.classification === "PIT_VIOLATION_CONFIRMED";

  const anyUnverified =
    QUOTE_AUDIT_RESULT.classification === "PIT_UNVERIFIED_NEEDS_REPAIR" ||
    CHIP_AUDIT_RESULT.classification === "PIT_UNVERIFIED_NEEDS_REPAIR" ||
    REGIME_AUDIT_RESULT.classification === "PIT_UNVERIFIED_NEEDS_REPAIR";

  const allSafe =
    QUOTE_AUDIT_RESULT.classification === "PIT_SAFE_VERIFIED" &&
    CHIP_AUDIT_RESULT.classification === "PIT_SAFE_VERIFIED" &&
    REGIME_AUDIT_RESULT.classification === "PIT_SAFE_VERIFIED";

  const simulationTrustRootStatus = anyViolation
    ? "VIOLATION_CONFIRMED"
    : anyUnverified
    ? "UNVERIFIED_NEEDS_REPAIR"
    : allSafe
    ? "VERIFIED_SAFE"
    : "INSUFFICIENT_EVIDENCE";

  const overallClassification = anyViolation
    ? "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_VIOLATION_CONFIRMED"
    : anyUnverified
    ? "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_RISK_FOUND_NEEDS_REPAIR"
    : "P29F_QUOTE_REGIME_CHIP_PIT_AUDIT_READY_ALL_SAFE";

  const nextRoundDecision = anyViolation
    ? "P0: PIT Violation Containment Patch Plan — simulation expansion BLOCKED"
    : anyUnverified
    ? "P0: Quote / Chip PIT Date Format Repair Plan — simulation expansion BLOCKED until repaired"
    : "P0: P29-G Paper Simulation Runner Dry-run Expansion may proceed";

  return {
    auditId: "p29f-quote-regime-chip-pit-audit-v1",
    auditedAt: "2026-05-20T00:00:00Z",
    sources: {
      Quote: QUOTE_AUDIT_RESULT,
      Regime: REGIME_AUDIT_RESULT,
      Chip: CHIP_AUDIT_RESULT,
    },
    trustRootBlockerRemains,
    simulationTrustRootStatus,
    overallClassification,
    nextRoundDecision,
  };
}
