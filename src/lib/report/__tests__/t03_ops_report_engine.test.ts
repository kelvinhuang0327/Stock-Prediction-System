/**
 * T-03 Ops Report Engine Unit Tests
 *
 * Tests for OpsReportEngine.ts buildDailyOpsReport() function.
 *
 * No DB writes. No external API calls. No forbidden fields. No H001-H012.
 */

import { buildDailyOpsReport, type DailyOpsReport } from '@/lib/report/OpsReportEngine';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/marketRegimeResult', () => ({
  DEFAULT_CURRENT_DATE: '2026-05-06',
  getLatestMarketRegimeContext: jest.fn().mockResolvedValue({
    isAvailable: true,
    date: '2026-05-06',
    regimeLabel: 'BULL',
    confidence: 1.0,
    taiexClose: 41138.85,
    source: 'P4_03_MARKET_REGIME_CLASSIFIER',
    version: 'p4_03b_v1',
    freshnessStatus: 'FRESH',
    freshnessLagDays: 0,
    warning: null,
  }),
  computeFreshnessAlert: jest.fn().mockReturnValue({
    alertLevel: 'FRESH',
    freshnessLagDays: 0,
    lastRegimeDate: '2026-05-06',
    currentDate: '2026-05-06',
    message: null,
    requiresAction: false,
  }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

const FORBIDDEN_KEYS = ['buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha', 'edge', 'profit', 'recommendation', 'outperform'];
const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

function containsForbiddenKey(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key)) return true;
    if (containsForbiddenKey((obj as Record<string, unknown>)[key])) return true;
  }
  return false;
}

function containsH001H012(str: string): boolean {
  return H_PATTERN.test(str);
}

describe('T-03 OpsReportEngine', () => {
  let report: DailyOpsReport;

  beforeAll(async () => {
    report = await buildDailyOpsReport('2026-05-06');
  });

  // 1. Ops report builds successfully
  test('1. buildDailyOpsReport() resolves without error', () => {
    expect(report).toBeDefined();
    expect(typeof report).toBe('object');
  });

  // 2. Report includes marketRegime
  test('2. report includes marketRegime', () => {
    expect(report.marketRegime).toBeDefined();
    expect(report.marketRegime.regimeLabel).toBe('BULL');
    expect(report.marketRegime.source).toBe('PERSISTED_MARKET_REGIME_RESULT');
    expect(report.marketRegime.isAvailable).toBe(true);
  });

  // 3. Report includes freshness
  test('3. report includes freshness', () => {
    expect(report.freshness).toBeDefined();
    expect(report.freshness.marketRegimeFreshness).toBeDefined();
    expect(typeof report.freshness.requiresAction).toBe('boolean');
  });

  // 4. Report includes walkForward
  test('4. report includes walkForward', () => {
    expect(report.walkForward).toBeDefined();
    expect(report.walkForward.contextAvailable).toBe(true);
    expect(report.walkForward.sampleDays).toBe(120);
    expect(report.walkForward.recordsWithRegimeContext).toBe(120);
    expect(report.walkForward.pitSafe).toBe(true);
    expect(report.walkForward.noBehaviorChange).toBe(true);
  });

  // 5. Report includes guardrails
  test('5. report includes guardrails with all checks true', () => {
    expect(report.guardrails).toBeDefined();
    expect(report.guardrails.noTradingAdvisory).toBe(true);
    expect(report.guardrails.noBuySellContent).toBe(true);
    expect(report.guardrails.noPerformanceEvidence).toBe(true);
    expect(report.guardrails.noLegacyHypotheses).toBe(true);
    expect(report.guardrails.noForbiddenFields).toBe(true);
    expect(report.guardrails.noDbWrite).toBe(true);
    expect(report.guardrails.noExternalApiCall).toBe(true);
  });

  // 6. Report includes doNotInterpretAs
  test('6. report includes doNotInterpretAs array', () => {
    expect(Array.isArray(report.doNotInterpretAs)).toBe(true);
    expect(report.doNotInterpretAs.length).toBeGreaterThan(0);
    const joined = report.doNotInterpretAs.join(' ');
    expect(joined).toContain('not a trading');
    expect(joined).toContain('not a buy/sell');
    expect(joined).toContain('observability artifact');
  });

  // 7. marketRegime.freshnessAlert.alertLevel = FRESH
  test('7. marketRegime.freshnessAlert.alertLevel is FRESH', () => {
    expect(report.marketRegime.freshnessAlert).toBeDefined();
    expect(report.marketRegime.freshnessAlert.alertLevel).toBe('FRESH');
    expect(report.marketRegime.freshnessAlert.requiresAction).toBe(false);
  });

  // 8. No forbidden field keys
  test('8. no forbidden field keys in report', () => {
    expect(containsForbiddenKey(report)).toBe(false);
  });

  // 9. No H001-H012
  test('9. no H001-H012 in serialized report', () => {
    const serialized = JSON.stringify(report);
    expect(containsH001H012(serialized)).toBe(false);
  });

  // 10. No DB write (verified by mock: getLatestMarketRegimeContext is mocked read-only)
  test('10. no DB write (getLatestMarketRegimeContext is read-only mock)', () => {
    const { getLatestMarketRegimeContext } = jest.requireMock('@/lib/marketRegimeResult');
    expect(getLatestMarketRegimeContext).toHaveBeenCalled();
    // Mocked: no actual DB write possible in test env
    expect(report.guardrails.noDbWrite).toBe(true);
  });

  // 11. No external API call
  test('11. no external API call (guardrail confirms)', () => {
    expect(report.guardrails.noExternalApiCall).toBe(true);
  });

  // 12. Report has required top-level fields
  test('12. report has all required top-level fields', () => {
    expect(report.reportDate).toBe('2026-05-06');
    expect(report.generatedAt).toBeDefined();
    expect(report.status).toMatch(/^(PASS|PASS_WITH_WARNINGS|STALE_DATA|MISSING_DATA|GUARDRAIL_FAIL|BLOCKED)$/);
    expect(report.summary).toBeDefined();
    expect(report.nextActions).toBeDefined();
    expect(report.dataQuality).toBeDefined();
    expect(report.readiness).toBeDefined();
  });

  // 13. Status is PASS for FRESH regime
  test('13. status is PASS when freshnessAlert is FRESH', () => {
    expect(report.status).toBe('PASS');
  });

  // 14. Fallback behavior: MISSING regime produces MISSING_DATA status
  test('14. fallback behavior when persisted regime missing', async () => {
    const { getLatestMarketRegimeContext, computeFreshnessAlert } = jest.requireMock('@/lib/marketRegimeResult');
    getLatestMarketRegimeContext.mockResolvedValueOnce({
      isAvailable: false,
      freshnessStatus: 'MISSING',
      freshnessLagDays: -1,
      warning: 'No MarketRegimeResult in DB',
    });
    computeFreshnessAlert.mockReturnValueOnce({
      alertLevel: 'MISSING',
      freshnessLagDays: null,
      lastRegimeDate: null,
      currentDate: '2026-05-06',
      message: 'No MarketRegimeResult found.',
      requiresAction: true,
    });
    const missingReport = await buildDailyOpsReport('2026-05-06');
    expect(missingReport.status).toBe('MISSING_DATA');
    expect(missingReport.marketRegime.isAvailable).toBe(false);
    expect(missingReport.marketRegime.source).toBe('UNAVAILABLE');
    expect(missingReport.freshness.requiresAction).toBe(true);
  });

  // 15. STALE regime produces PASS_WITH_WARNINGS
  test('15. STALE regime produces PASS_WITH_WARNINGS status', async () => {
    const { getLatestMarketRegimeContext, computeFreshnessAlert } = jest.requireMock('@/lib/marketRegimeResult');
    getLatestMarketRegimeContext.mockResolvedValueOnce({
      isAvailable: true,
      date: '2026-04-30',
      regimeLabel: 'SIDEWAYS',
      confidence: 0.8,
      taiexClose: 40000,
      source: 'P4_03_MARKET_REGIME_CLASSIFIER',
      version: 'p4_03b_v1',
      freshnessStatus: 'STALE',
      freshnessLagDays: 6,
      warning: 'Stale data',
    });
    computeFreshnessAlert.mockReturnValueOnce({
      alertLevel: 'STALE',
      freshnessLagDays: 6,
      lastRegimeDate: '2026-04-30',
      currentDate: '2026-05-06',
      message: 'MarketRegimeResult is stale by 6 calendar days.',
      requiresAction: true,
    });
    const staleReport = await buildDailyOpsReport('2026-05-06');
    expect(staleReport.status).toBe('PASS_WITH_WARNINGS');
    expect(staleReport.freshness.requiresAction).toBe(true);
  });
});
