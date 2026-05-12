/**
 * p12pit_feature_contract_utils.test.ts
 * P12-HARDRESET — Unit tests for P12PitFeatureContractUtils
 *
 * Tests:
 *  - normalizeFeatureSourceName — deterministic canonical mapping
 *  - classifyPitRisk — all 5 source type groups
 *  - validateAsOfRule — rejects missing releaseDate for MonthlyRevenue, availabilityDate for FinancialReport
 *  - validateFeatureContractEntry — catches missing date field, missing repairDescription
 *  - validatePitFeatureSnapshot — catches outcomePrice/returnPct/realizedReturnClass leakage, pitGateDate mismatch
 *  - buildPitFeatureContract — produces valid contract structure
 *  - summarizePitFeatureContract — deterministic summary
 *  - scanForbiddenClaims — finds forbidden patterns, skips disclaimer lines, skips alphaScore context
 *
 * NO Math.random(). NO corpus modifications. NO investment claims.
 */

import {
  normalizeFeatureSourceName,
  classifyPitRisk,
  validateAsOfRule,
  validateFeatureContractEntry,
  validatePitFeatureSnapshot,
  buildPitFeatureContract,
  summarizePitFeatureContract,
  scanForbiddenClaims,
  FORBIDDEN_SNAPSHOT_FIELDS,
  FeatureContractEntry,
} from '../P12PitFeatureContractUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<FeatureContractEntry> = {}): FeatureContractEntry {
  return {
    sourceName: 'StockQuote',
    dateField: 'date',
    asOfRule: 'WHERE date <= asOfDate (YYYYMMDD lexicographic)',
    pitRiskLevel: 'LOW',
    repairNeeded: false,
    ...overrides,
  };
}

// ─── normalizeFeatureSourceName ───────────────────────────────────────────

describe('normalizeFeatureSourceName', () => {
  it('returns canonical name for known sources', () => {
    expect(normalizeFeatureSourceName('StockQuote')).toBe('StockQuote');
    expect(normalizeFeatureSourceName('InstitutionalChip')).toBe('InstitutionalChip');
    expect(normalizeFeatureSourceName('MonthlyRevenue')).toBe('MonthlyRevenue');
    expect(normalizeFeatureSourceName('FinancialReport')).toBe('FinancialReport');
    expect(normalizeFeatureSourceName('NewsEvent')).toBe('NewsEvent');
  });

  it('normalizes lowercase aliases', () => {
    expect(normalizeFeatureSourceName('stockquote')).toBe('StockQuote');
    expect(normalizeFeatureSourceName('stock_quote')).toBe('StockQuote');
    expect(normalizeFeatureSourceName('chip')).toBe('InstitutionalChip');
    expect(normalizeFeatureSourceName('revenue')).toBe('MonthlyRevenue');
    expect(normalizeFeatureSourceName('eps')).toBe('FinancialReport');
    expect(normalizeFeatureSourceName('news')).toBe('NewsEvent');
    expect(normalizeFeatureSourceName('regime')).toBe('MarketRegime');
    expect(normalizeFeatureSourceName('calendar')).toBe('TwseTradingCalendar');
    expect(normalizeFeatureSourceName('technical')).toBe('TechnicalIndicators');
  });

  it('returns trimmed unknown source as-is', () => {
    expect(normalizeFeatureSourceName('ExoticSource')).toBe('ExoticSource');
    expect(normalizeFeatureSourceName('  CustomData  ')).toBe('CustomData');
  });

  it('handles empty/invalid input', () => {
    expect(normalizeFeatureSourceName('')).toBe('UnknownSource');
    // @ts-expect-error testing runtime behavior
    expect(normalizeFeatureSourceName(null)).toBe('UnknownSource');
  });

  it('is deterministic for same input', () => {
    const first = normalizeFeatureSourceName('MonthlyRevenue');
    const second = normalizeFeatureSourceName('MonthlyRevenue');
    expect(first).toBe(second);
  });
});

// ─── classifyPitRisk ──────────────────────────────────────────────────────

describe('classifyPitRisk', () => {
  it('classifies LOW risk sources', () => {
    expect(classifyPitRisk('StockQuote')).toBe('LOW');
    expect(classifyPitRisk('InstitutionalChip')).toBe('LOW');
    expect(classifyPitRisk('TechnicalIndicators')).toBe('LOW');
    expect(classifyPitRisk('BucketContract')).toBe('LOW');
    expect(classifyPitRisk('TwseTradingCalendar')).toBe('LOW');
    expect(classifyPitRisk('ActiveScoringSnapshot')).toBe('LOW');
    expect(classifyPitRisk('ReasonSignalFactorSnapshot')).toBe('LOW');
  });

  it('classifies MEDIUM risk sources', () => {
    expect(classifyPitRisk('MarketRegime')).toBe('MEDIUM');
    expect(classifyPitRisk('FinancialReport')).toBe('MEDIUM');
  });

  it('classifies HIGH risk sources', () => {
    expect(classifyPitRisk('MonthlyRevenue')).toBe('HIGH');
    expect(classifyPitRisk('NewsEvent')).toBe('HIGH');
  });

  it('classifies unknown sources as HIGH', () => {
    expect(classifyPitRisk('UnknownSource')).toBe('HIGH');
    expect(classifyPitRisk('ExoticData')).toBe('HIGH');
  });
});

// ─── validateAsOfRule ─────────────────────────────────────────────────────

describe('validateAsOfRule', () => {
  it('passes for LOW risk source with any asOf rule', () => {
    const entry = makeEntry({ sourceName: 'StockQuote', asOfRule: 'WHERE date <= asOfDate' });
    expect(validateAsOfRule(entry)).toHaveLength(0);
  });

  it('returns error for empty asOfRule', () => {
    const entry = makeEntry({ sourceName: 'StockQuote', asOfRule: '' });
    const errors = validateAsOfRule(entry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('asOfRule');
  });

  it('MonthlyRevenue HIGH risk: requires repairNeeded=true (no releaseDate)', () => {
    const entry = makeEntry({
      sourceName: 'MonthlyRevenue',
      pitRiskLevel: 'HIGH',
      asOfRule: 'WHERE (year < asOfYear) OR (year == asOfYear AND month <= asOfMonth). No releaseDate.',
      repairNeeded: false, // <-- missing required flag
    });
    const errors = validateAsOfRule(entry);
    expect(errors.some(e => e.field === 'repairNeeded')).toBe(true);
  });

  it('MonthlyRevenue HIGH risk: passes when repairNeeded=true and asOfRule mentions year+month', () => {
    const entry = makeEntry({
      sourceName: 'MonthlyRevenue',
      pitRiskLevel: 'HIGH',
      asOfRule: 'WHERE (year < asOfYear) OR (year == asOfYear AND month <= asOfMonth). No releaseDate field.',
      repairNeeded: true,
    });
    const errors = validateAsOfRule(entry);
    expect(errors).toHaveLength(0);
  });

  it('FinancialReport: does not require availabilityDate mention when dateField is null (inactive)', () => {
    const entry = makeEntry({
      sourceName: 'FinancialReport',
      pitRiskLevel: 'MEDIUM',
      dateField: null, // not active
      asOfRule: 'Not currently used in scoring. No date gate needed.',
      repairNeeded: false,
    });
    const errors = validateAsOfRule(entry);
    expect(errors).toHaveLength(0);
  });

  it('FinancialReport: active with dateField but missing availabilityDate mention returns error', () => {
    const entry = makeEntry({
      sourceName: 'FinancialReport',
      pitRiskLevel: 'HIGH',
      dateField: 'year + quarter',
      asOfRule: 'WHERE quarter <= asOfQuarter', // no availabilityDate mention
      repairNeeded: false, // active but no availability mention
    });
    const errors = validateAsOfRule(entry);
    expect(errors.some(e => e.field === 'asOfRule')).toBe(true);
  });
});

// ─── validateFeatureContractEntry ─────────────────────────────────────────

describe('validateFeatureContractEntry', () => {
  it('passes for a valid LOW risk entry', () => {
    const entry = makeEntry();
    expect(validateFeatureContractEntry(entry)).toHaveLength(0);
  });

  it('catches invalid pitRiskLevel', () => {
    const entry = makeEntry({ pitRiskLevel: 'UNKNOWN' as any });
    const errors = validateFeatureContractEntry(entry);
    expect(errors.some(e => e.field === 'pitRiskLevel')).toBe(true);
  });

  it('catches missing sourceName', () => {
    const entry = makeEntry({ sourceName: '' });
    const errors = validateFeatureContractEntry(entry);
    expect(errors.some(e => e.field === 'sourceName')).toBe(true);
  });

  it('catches repairNeeded=true with missing repairDescription', () => {
    const entry = makeEntry({
      sourceName: 'MonthlyRevenue',
      pitRiskLevel: 'HIGH',
      asOfRule: 'WHERE year+month <= asOfDate. No releaseDate.',
      repairNeeded: true,
      repairDescription: '', // missing
    });
    const errors = validateFeatureContractEntry(entry);
    expect(errors.some(e => e.field === 'repairDescription')).toBe(true);
  });

  it('passes when repairNeeded=true with repairDescription provided', () => {
    const entry = makeEntry({
      sourceName: 'MonthlyRevenue',
      pitRiskLevel: 'HIGH',
      asOfRule: 'WHERE (year < asOfYear) OR (year == asOfYear AND month <= asOfMonth). No releaseDate field.',
      repairNeeded: true,
      repairDescription: 'Add releaseDate field to schema.',
    });
    const errors = validateFeatureContractEntry(entry);
    expect(errors).toHaveLength(0);
  });
});

// ─── validatePitFeatureSnapshot ───────────────────────────────────────────

describe('validatePitFeatureSnapshot', () => {
  it('passes for a clean snapshot', () => {
    const snap = {
      asOfDate: '2026-02-11',
      pitGateDate: '2026-02-11',
      scoringMode: 'RULE_BASED_ANALYZER',
      scoringEngineSource: 'RuleBasedStockAnalyzer',
      researchBucket: 'Watch',
      alphaScore: 55,
      signalSnapshot: ['技術偏多'],
      factorSnapshot: ['Momentum: 60 (strong)'],
      reasonSnapshot: '技術偏多',
      scoringCompletenessStatus: 'COMPLETE',
    };
    const result = validatePitFeatureSnapshot(snap);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('catches outcomePrice in activeScoringSnapshot (PIT leakage)', () => {
    const snap = {
      asOfDate: '2026-02-11',
      pitGateDate: '2026-02-11',
      researchBucket: 'Watch',
      outcomePrice: 120.5, // FORBIDDEN
    };
    const result = validatePitFeatureSnapshot(snap);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'outcomePrice')).toBe(true);
  });

  it('catches returnPct in activeScoringSnapshot (PIT leakage)', () => {
    const snap = {
      asOfDate: '2026-02-11',
      pitGateDate: '2026-02-11',
      returnPct: 4.28, // FORBIDDEN
    };
    const result = validatePitFeatureSnapshot(snap);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'returnPct')).toBe(true);
  });

  it('catches realizedReturnClass in activeScoringSnapshot (PIT leakage)', () => {
    const snap = {
      asOfDate: '2026-02-11',
      pitGateDate: '2026-02-11',
      realizedReturnClass: 'POSITIVE', // FORBIDDEN
    };
    const result = validatePitFeatureSnapshot(snap);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'realizedReturnClass')).toBe(true);
  });

  it('catches pitGateDate != asOfDate divergence', () => {
    const snap = {
      asOfDate: '2026-02-11',
      pitGateDate: '2026-02-15', // WRONG — must equal asOfDate
      researchBucket: 'Watch',
    };
    const result = validatePitFeatureSnapshot(snap);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'pitGateDate')).toBe(true);
  });

  it('catches invalid asOfDate format', () => {
    const snap = {
      asOfDate: '20260211', // wrong format — must be YYYY-MM-DD
      pitGateDate: '20260211',
    };
    const result = validatePitFeatureSnapshot(snap);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'asOfDate')).toBe(true);
  });

  it('returns error for null snapshot', () => {
    // @ts-expect-error testing runtime behavior
    const result = validatePitFeatureSnapshot(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('FORBIDDEN_SNAPSHOT_FIELDS exports correctly', () => {
    expect(FORBIDDEN_SNAPSHOT_FIELDS).toContain('outcomePrice');
    expect(FORBIDDEN_SNAPSHOT_FIELDS).toContain('returnPct');
    expect(FORBIDDEN_SNAPSHOT_FIELDS).toContain('realizedReturnClass');
    expect(FORBIDDEN_SNAPSHOT_FIELDS).toContain('outcomeClose');
    expect(FORBIDDEN_SNAPSHOT_FIELDS).toContain('futurePrice');
  });
});

// ─── buildPitFeatureContract ──────────────────────────────────────────────

describe('buildPitFeatureContract', () => {
  it('produces a valid contract structure', () => {
    const entries: FeatureContractEntry[] = [
      makeEntry({ sourceName: 'StockQuote', pitRiskLevel: 'LOW' }),
      makeEntry({
        sourceName: 'MonthlyRevenue',
        pitRiskLevel: 'HIGH',
        asOfRule: 'WHERE year+month <= asOfDate. No releaseDate.',
        repairNeeded: true,
        repairDescription: 'Add releaseDate field.',
      }),
    ];
    const contract = buildPitFeatureContract(entries, '2026-05-12T00:00:00.000Z');

    expect(contract.contractVersion).toBe('p12-pit-feature-contract-v0');
    expect(contract.featureSourceContracts).toHaveLength(2);
    expect(contract.pitSafetyRequirements.length).toBeGreaterThan(0);
    expect(contract.snapshotCaptureRequirements.length).toBeGreaterThan(0);
    expect(contract.repairPriorities.length).toBeGreaterThan(0);
    expect(contract.nonGoals.length).toBeGreaterThan(0);
    expect(contract.disclaimer).toContain('No investment recommendations');
  });

  it('contains PIT-001 hard requirement', () => {
    const contract = buildPitFeatureContract([makeEntry()], '2026-05-12T00:00:00.000Z');
    const pit001 = contract.pitSafetyRequirements.find(r => r.requirementId === 'PIT-001');
    expect(pit001).toBeDefined();
    expect(pit001!.enforcement).toBe('HARD');
  });

  it('contains PIT-004 forbidden snapshot fields requirement', () => {
    const contract = buildPitFeatureContract([makeEntry()], '2026-05-12T00:00:00.000Z');
    const pit004 = contract.pitSafetyRequirements.find(r => r.requirementId === 'PIT-004');
    expect(pit004).toBeDefined();
    expect(pit004!.enforcement).toBe('HARD');
    expect(pit004!.description).toMatch(/outcomePrice|returnPct|realizedReturnClass/);
  });
});

// ─── summarizePitFeatureContract ──────────────────────────────────────────

describe('summarizePitFeatureContract', () => {
  it('produces deterministic summary', () => {
    const entries: FeatureContractEntry[] = [
      makeEntry({ sourceName: 'StockQuote', pitRiskLevel: 'LOW' }),
      makeEntry({ sourceName: 'MarketRegime', pitRiskLevel: 'MEDIUM', asOfRule: 'detectRegime(asOf)', repairNeeded: false }),
      makeEntry({
        sourceName: 'MonthlyRevenue',
        pitRiskLevel: 'HIGH',
        asOfRule: 'WHERE year+month <= asOfDate. No releaseDate.',
        repairNeeded: true,
        repairDescription: 'Add releaseDate field.',
      }),
    ];
    const contract = buildPitFeatureContract(entries, '2026-05-12T00:00:00.000Z');

    const summary = summarizePitFeatureContract(contract);

    expect(summary.totalSources).toBe(3);
    expect(summary.byRiskLevel.LOW).toBe(1);
    expect(summary.byRiskLevel.MEDIUM).toBe(1);
    expect(summary.byRiskLevel.HIGH).toBe(1);
    expect(summary.highRiskSources).toContain('MonthlyRevenue');
    expect(summary.repairNeededSources).toContain('MonthlyRevenue');
    expect(summary.requirementCount).toBeGreaterThan(0);
    expect(summary.snapshotCaptureRuleCount).toBeGreaterThan(0);
  });

  it('verdict is CONTRACT_COMPLETE when no repairs needed', () => {
    const entries: FeatureContractEntry[] = [
      makeEntry({ sourceName: 'StockQuote', pitRiskLevel: 'LOW', repairNeeded: false }),
    ];
    const contract = buildPitFeatureContract(entries, '2026-05-12T00:00:00.000Z');
    const summary = summarizePitFeatureContract(contract);
    expect(summary.verdict).toBe('CONTRACT_COMPLETE');
  });

  it('verdict is CONTRACT_PARTIAL when repair is documented', () => {
    const entries: FeatureContractEntry[] = [
      makeEntry({
        sourceName: 'MonthlyRevenue',
        pitRiskLevel: 'HIGH',
        asOfRule: 'WHERE year+month <= asOfDate. No releaseDate.',
        repairNeeded: true,
        repairDescription: 'Add releaseDate field.',
      }),
    ];
    const contract = buildPitFeatureContract(entries, '2026-05-12T00:00:00.000Z');
    const summary = summarizePitFeatureContract(contract);
    // repairNeeded=true with description => PARTIAL, not BLOCKED
    expect(summary.verdict).toBe('CONTRACT_PARTIAL');
  });

  it('is deterministic for same input', () => {
    const entries: FeatureContractEntry[] = [makeEntry()];
    const contract = buildPitFeatureContract(entries, '2026-05-12T00:00:00.000Z');
    const s1 = summarizePitFeatureContract(contract);
    const s2 = summarizePitFeatureContract(contract);
    expect(s1.totalSources).toBe(s2.totalSources);
    expect(s1.verdict).toBe(s2.verdict);
    expect(s1.byRiskLevel.LOW).toBe(s2.byRiskLevel.LOW);
  });
});

// ─── scanForbiddenClaims ──────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  it('returns empty for clean text', () => {
    const text = 'This is a PIT feature contract. Technical scoring only.';
    expect(scanForbiddenClaims(text)).toHaveLength(0);
  });

  it('detects ROI', () => {
    const hits = scanForbiddenClaims('Expected ROI is 15%');
    expect(hits.some(h => h.matchedLabel === 'ROI')).toBe(true);
  });

  it('detects win-rate', () => {
    const hits = scanForbiddenClaims('The strategy has a win-rate of 70%');
    expect(hits.some(h => h.matchedLabel === 'win-rate')).toBe(true);
  });

  it('detects alpha (standalone)', () => {
    const hits = scanForbiddenClaims('This strategy generates alpha over the market');
    expect(hits.some(h => h.matchedLabel === 'alpha')).toBe(true);
  });

  it('does NOT flag alphaScore context as alpha', () => {
    const hits = scanForbiddenClaims('alphaScore: 55, researchBucket: Watch');
    const alphaHits = hits.filter(h => h.matchedLabel === 'alpha');
    expect(alphaHits).toHaveLength(0);
  });

  it('detects profit', () => {
    const hits = scanForbiddenClaims('Expected profit from this trade is 12%');
    expect(hits.some(h => h.matchedLabel === 'profit')).toBe(true);
  });

  it('detects outperform', () => {
    const hits = scanForbiddenClaims('Strategy will outperform the index');
    expect(hits.some(h => h.matchedLabel === 'outperform')).toBe(true);
  });

  it('detects investment recommendation', () => {
    const hits = scanForbiddenClaims('This is an investment recommendation for 2330');
    expect(hits.some(h => h.matchedLabel === 'investment recommendation')).toBe(true);
  });

  it('skips disclaimer lines', () => {
    const text = 'DISCLAIMER: No investment recommendation. Not ROI advice. Not a buy or sell signal.';
    const hits = scanForbiddenClaims(text);
    expect(hits).toHaveLength(0);
  });

  it('returns hit lineIndex 1-based', () => {
    const text = 'Line one is clean\nROI of 20%\nLine three clean';
    const hits = scanForbiddenClaims(text);
    expect(hits[0].lineIndex).toBe(2);
  });

  it('detects buy', () => {
    const hits = scanForbiddenClaims('Strong buy signal for 2330');
    expect(hits.some(h => h.matchedLabel === 'buy')).toBe(true);
  });

  it('detects sell', () => {
    const hits = scanForbiddenClaims('sell when momentum drops');
    expect(hits.some(h => h.matchedLabel === 'sell')).toBe(true);
  });

  it('detects guaranteed', () => {
    const hits = scanForbiddenClaims('Guaranteed returns from this strategy');
    expect(hits.some(h => h.matchedLabel === 'guaranteed')).toBe(true);
  });

  it('detects edge', () => {
    const hits = scanForbiddenClaims('This system has a significant edge over the market');
    expect(hits.some(h => h.matchedLabel === 'edge')).toBe(true);
  });

  it('returns empty for empty text', () => {
    expect(scanForbiddenClaims('')).toHaveLength(0);
  });
});
