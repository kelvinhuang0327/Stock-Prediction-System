/**
 * p001_mvp_universe_lock.test.ts
 *
 * P0-01 MVP Universe Lock tests.
 * No strategy claims. No performance conclusions. No forbidden terms.
 */

import path from 'path';
import fs from 'fs';
import {
  buildMvpUniverseCriteria,
  classifyMvpUniverseTier,
  filterUniverseByMvpTier,
  validateMvpUniverseCoverage,
  MVP_TIER_A_QUOTE_MIN,
  MVP_WALK_FORWARD_QUOTE_MIN,
  MVP_LIMITED_QUOTE_MIN,
  type StockUniverseRecord,
  type ClassifiedUniverseEntry,
} from '../MvpUniverseLock';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeRecord(
  symbol: string,
  quoteCount: number,
  hasInstitutionalChip: boolean,
  hasFutureDate = false,
  hasAbnormalDate = false,
  latestQuoteDate: string | null = '20260507',
): StockUniverseRecord {
  return {
    symbol,
    quoteCount,
    hasInstitutionalChip,
    latestQuoteDate,
    hasAbnormalDate,
    hasFutureDate,
  };
}

const AS_OF_DATE = '2026-05-07';

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('P0-01: MvpUniverseLock', () => {

  // --- 1. buildMvpUniverseCriteria defines Tier A quote >=250 + chip ---
  describe('buildMvpUniverseCriteria', () => {

    it('1a. Tier A requires quoteCount >= 250', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const tierA = criteria.tiers.find(t => t.tier === 'TierA')!;
      expect(tierA).toBeDefined();
      expect(tierA.minQuoteCount).toBe(250);
    });

    it('1b. Tier A requires hasInstitutionalChip = true', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const tierA = criteria.tiers.find(t => t.tier === 'TierA')!;
      expect(tierA.requiresInstitutionalChip).toBe(true);
    });

    it('1c. Tier A excludes future dates', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const tierA = criteria.tiers.find(t => t.tier === 'TierA')!;
      expect(tierA.excludeFutureDates).toBe(true);
    });

    // --- 2. buildMvpUniverseCriteria defines WalkForward quote >=500 ---
    it('2a. WalkForward requires quoteCount >= 500', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const wf = criteria.tiers.find(t => t.tier === 'WalkForward')!;
      expect(wf).toBeDefined();
      expect(wf.minQuoteCount).toBe(500);
    });

    it('2b. WalkForward does not require chip', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const wf = criteria.tiers.find(t => t.tier === 'WalkForward')!;
      expect(wf.requiresInstitutionalChip).toBe(false);
    });

    it('2c. WalkForward excludes future dates', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const wf = criteria.tiers.find(t => t.tier === 'WalkForward')!;
      expect(wf.excludeFutureDates).toBe(true);
    });

    it('2d. all 4 tiers defined', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const tierNames = criteria.tiers.map(t => t.tier);
      expect(tierNames).toContain('TierA');
      expect(tierNames).toContain('WalkForward');
      expect(tierNames).toContain('Limited');
      expect(tierNames).toContain('Insufficient');
    });

    it('2e. asOfDate set on criteria', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      expect(criteria.asOfDate).toBe(AS_OF_DATE);
    });

    it('2f. uses resolveCurrentDate when no asOfDate provided', () => {
      const criteria = buildMvpUniverseCriteria();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(criteria.asOfDate)).toBe(true);
    });
  });

  // --- 3. classifyMvpUniverseTier returns WalkForward ---
  describe('classifyMvpUniverseTier', () => {

    it('3a. returns WalkForward for quoteCount >= 500 (no chip required)', () => {
      const record = makeRecord('2330', 520, false);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('WalkForward');
    });

    it('3b. returns WalkForward for quoteCount >= 500 WITH chip (WalkForward wins)', () => {
      const record = makeRecord('2330', 600, true);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('WalkForward');
    });

    it('3c. returns WalkForward for quoteCount exactly 500', () => {
      const record = makeRecord('2330', 500, true);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('WalkForward');
    });

    // --- 4. classifyMvpUniverseTier returns TierA ---
    it('4a. returns TierA for quoteCount 250-499 WITH chip', () => {
      const record = makeRecord('2317', 300, true);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('TierA');
    });

    it('4b. does NOT return TierA if no chip (should fall to Limited/Insufficient)', () => {
      const record = makeRecord('2317', 300, false);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).not.toBe('TierA');
    });

    it('4c. returns TierA for quoteCount exactly 250 WITH chip', () => {
      const record = makeRecord('1234', 250, true);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('TierA');
    });

    // --- 5. classifyMvpUniverseTier returns Limited ---
    it('5a. returns Limited for quoteCount 60-249 without chip', () => {
      const record = makeRecord('5678', 150, false);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('Limited');
    });

    it('5b. returns Limited for quoteCount 60-249 with chip (but < 250)', () => {
      // 200 quotes with chip -> not Tier A (250 needed), so Limited
      const record = makeRecord('9999', 200, true);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('Limited');
    });

    it('5c. returns Limited for quoteCount exactly 60', () => {
      const record = makeRecord('X000', 60, false);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('Limited');
    });

    // --- 6. classifyMvpUniverseTier returns Insufficient ---
    it('6a. returns Insufficient for quoteCount < 60', () => {
      const record = makeRecord('Y111', 30, false);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('Insufficient');
    });

    it('6b. returns Insufficient for quoteCount = 0', () => {
      const record = makeRecord('Z999', 0, false);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(entry.tier).toBe('Insufficient');
    });

    it('6c. includes tierReason in every result', () => {
      const record = makeRecord('2330', 600, true);
      const entry = classifyMvpUniverseTier(record, AS_OF_DATE);
      expect(typeof entry.tierReason).toBe('string');
      expect(entry.tierReason.length).toBeGreaterThan(0);
    });
  });

  // --- 7. filterUniverseByMvpTier excludes insufficient records ---
  describe('filterUniverseByMvpTier', () => {

    const records: StockUniverseRecord[] = [
      makeRecord('WF-001', 600, true),      // WalkForward
      makeRecord('TA-001', 300, true),      // TierA
      makeRecord('LT-001', 150, false),     // Limited
      makeRecord('IN-001', 20, false),      // Insufficient
    ];

    it('7a. TierA filter includes WalkForward and TierA, excludes Limited and Insufficient', () => {
      const result = filterUniverseByMvpTier(records, 'TierA', AS_OF_DATE);
      const tiers = result.map(r => r.tier);
      expect(tiers).toContain('WalkForward');
      expect(tiers).toContain('TierA');
      expect(tiers).not.toContain('Limited');
      expect(tiers).not.toContain('Insufficient');
    });

    it('7b. WalkForward filter only includes WalkForward', () => {
      const result = filterUniverseByMvpTier(records, 'WalkForward', AS_OF_DATE);
      const tiers = result.map(r => r.tier);
      expect(tiers.every(t => t === 'WalkForward')).toBe(true);
    });

    it('7c. Limited filter includes WalkForward, TierA, and Limited', () => {
      const result = filterUniverseByMvpTier(records, 'Limited', AS_OF_DATE);
      const tiers = result.map(r => r.tier);
      expect(tiers).toContain('WalkForward');
      expect(tiers).toContain('TierA');
      expect(tiers).toContain('Limited');
      expect(tiers).not.toContain('Insufficient');
    });

    // --- 8. filterUniverseByMvpTier excludes future-dated records ---
    it('8a. excludes records that are only future-dated (quoteCount=0 + hasFutureDate)', () => {
      const withFuture: StockUniverseRecord[] = [
        makeRecord('FUTURE-01', 0, false, true),  // only future dates, quoteCount=0
        makeRecord('VALID-001', 600, true, false),
      ];
      // Insufficient filter: includes everything except pure-future records
      const result = filterUniverseByMvpTier(withFuture, 'Insufficient', AS_OF_DATE);
      const symbols = result.map(r => r.symbol);
      expect(symbols).toContain('VALID-001');
    });

    it('8b. returns empty array for empty input', () => {
      const result = filterUniverseByMvpTier([], 'TierA', AS_OF_DATE);
      expect(result).toHaveLength(0);
    });
  });

  // --- 9. validateMvpUniverseCoverage returns summary ---
  describe('validateMvpUniverseCoverage', () => {

    it('9a. PASS when sufficient coverage', () => {
      // Generate enough entries: 150 TierA, 80 WalkForward
      const entries: ClassifiedUniverseEntry[] = [
        ...Array.from({ length: 80 }, (_, i) =>
          ({ ...makeRecord(`WF-${i}`, 600, true), tier: 'WalkForward' as const,
             asOfDate: AS_OF_DATE, tierReason: 'test' })),
        ...Array.from({ length: 150 }, (_, i) =>
          ({ ...makeRecord(`TA-${i}`, 300, true), tier: 'TierA' as const,
             asOfDate: AS_OF_DATE, tierReason: 'test' })),
      ];
      const result = validateMvpUniverseCoverage(entries, AS_OF_DATE);
      expect(result.status).toBe('PASS');
      expect(result.tierACount).toBe(150);
      expect(result.walkForwardCount).toBe(80);
    });

    it('9b. WARN when Tier A < 100', () => {
      const entries: ClassifiedUniverseEntry[] = [
        ...Array.from({ length: 60 }, (_, i) =>
          ({ ...makeRecord(`WF-${i}`, 600, true), tier: 'WalkForward' as const,
             asOfDate: AS_OF_DATE, tierReason: 'test' })),
        ...Array.from({ length: 50 }, (_, i) =>
          ({ ...makeRecord(`TA-${i}`, 300, true), tier: 'TierA' as const,
             asOfDate: AS_OF_DATE, tierReason: 'test' })),
      ];
      const result = validateMvpUniverseCoverage(entries, AS_OF_DATE);
      expect(result.status).toBe('WARN');
    });

    it('9c. FAIL when no TierA and no WalkForward', () => {
      const entries: ClassifiedUniverseEntry[] = [
        { ...makeRecord('LT-001', 150, false), tier: 'Limited',
          asOfDate: AS_OF_DATE, tierReason: 'test' },
      ];
      const result = validateMvpUniverseCoverage(entries, AS_OF_DATE);
      expect(result.status).toBe('FAIL');
    });

    it('9d. counts are correct for mixed tiers', () => {
      const entries: ClassifiedUniverseEntry[] = [
        { ...makeRecord('WF-001', 600, true), tier: 'WalkForward',
          asOfDate: AS_OF_DATE, tierReason: 'test' },
        { ...makeRecord('TA-001', 300, true), tier: 'TierA',
          asOfDate: AS_OF_DATE, tierReason: 'test' },
        { ...makeRecord('LT-001', 150, false), tier: 'Limited',
          asOfDate: AS_OF_DATE, tierReason: 'test' },
        { ...makeRecord('IN-001', 20, false), tier: 'Insufficient',
          asOfDate: AS_OF_DATE, tierReason: 'test' },
      ];
      const result = validateMvpUniverseCoverage(entries, AS_OF_DATE);
      expect(result.totalStocks).toBe(4);
      expect(result.walkForwardCount).toBe(1);
      expect(result.tierACount).toBe(1);
      expect(result.limitedCount).toBe(1);
      expect(result.insufficientCount).toBe(1);
    });

    it('9e. asOfDate preserved in result', () => {
      const result = validateMvpUniverseCoverage([], AS_OF_DATE);
      expect(result.asOfDate).toBe(AS_OF_DATE);
    });

    // --- 10. output contains no forbidden performance claims ---
    it('10a. output does not contain forbidden performance terms', () => {
      const entries: ClassifiedUniverseEntry[] = [];
      const result = validateMvpUniverseCoverage(entries, AS_OF_DATE);
      const resultStr = JSON.stringify(result).toLowerCase();

      const forbidden = [
        'buy', 'sell', 'roi', 'win_rate', 'alpha', 'edge',
        'profit', 'recommendation', 'outperform', 'guaranteed',
      ];
      for (const term of forbidden) {
        expect(resultStr).not.toContain(term);
      }
    });

    it('10b. buildMvpUniverseCriteria does not contain forbidden performance terms', () => {
      const criteria = buildMvpUniverseCriteria(AS_OF_DATE);
      const str = JSON.stringify(criteria).toLowerCase();
      const forbidden = ['buy', 'sell', 'roi', 'win_rate', 'edge', 'profit'];
      for (const term of forbidden) {
        expect(str).not.toContain(term);
      }
    });
  });

  // --- Source code safety inspection ---
  describe('Source code safety inspection', () => {

    const src = fs.readFileSync(
      path.join(__dirname, '..', 'MvpUniverseLock.ts'),
      'utf8',
    );

    it('no DB write operations', () => {
      const codeLines = src.split('\n').filter(
        l => !l.trim().startsWith('//') && !l.trim().startsWith('*'),
      );
      const code = codeLines.join('\n');
      expect(code).not.toMatch(/\.create\s*\(/);
      expect(code).not.toMatch(/\.upsert\s*\(/);
      expect(code).not.toMatch(/\.delete\s*\(/);
    });

    it('no external API calls', () => {
      expect(src).not.toMatch(/fetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
    });

    it('no LLM imports', () => {
      expect(src).not.toMatch(/openai/i);
      expect(src).not.toMatch(/anthropic/i);
    });
  });

  // --- Constants validation ---
  describe('Constants', () => {

    it('MVP_TIER_A_QUOTE_MIN is 250', () => {
      expect(MVP_TIER_A_QUOTE_MIN).toBe(250);
    });

    it('MVP_WALK_FORWARD_QUOTE_MIN is 500', () => {
      expect(MVP_WALK_FORWARD_QUOTE_MIN).toBe(500);
    });

    it('MVP_LIMITED_QUOTE_MIN is 60', () => {
      expect(MVP_LIMITED_QUOTE_MIN).toBe(60);
    });
  });
});
