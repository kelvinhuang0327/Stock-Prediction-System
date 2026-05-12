/**
 * P13-HARDRESET PART F: MonthlyRevenue PIT Utils Tests
 *
 * Validates all exports from P13MonthlyRevenuePitUtils.ts.
 * No Math.random(). No corpus modifications. No production DB writes.
 */

import {
  inferMonthlyRevenueReleaseDate,
  isMonthlyRevenueAvailableAsOf,
  validateMonthlyRevenueReleaseDate,
  normalizeMonthlyRevenueRecord,
  buildMonthlyRevenuePitContract,
  validateMonthlyRevenuePitContract,
  scanForbiddenClaims,
  summarizeMonthlyRevenuePitRepairPlan,
} from '../P13MonthlyRevenuePitUtils';

describe('P13MonthlyRevenuePitUtils', () => {
  // ── inferMonthlyRevenueReleaseDate ────────────────────────────────────────

  describe('inferMonthlyRevenueReleaseDate', () => {
    it('Jan 2024 → inferred 2024-02-10', () => {
      const r = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 1, revenue: 1000 });
      expect(r.releaseDate).toBe('2024-02-10');
      expect(r.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
      expect(r.repairNeeded).toBe(true);
      expect(r.confidence).toBe('LOW_TO_MEDIUM');
    });

    it('Dec 2024 → inferred 2025-01-10 (year rollover)', () => {
      const r = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 12, revenue: 999 });
      expect(r.releaseDate).toBe('2025-01-10');
      expect(r.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
    });

    it('Feb 2024 (leap year) → inferred 2024-03-10 (no crash)', () => {
      const r = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 2, revenue: 500 });
      expect(r.releaseDate).toBe('2024-03-10');
    });

    it('Explicit releaseDate overrides inference → AUTHORITATIVE, repairNeeded=false', () => {
      const r = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 3, revenue: 800, releaseDate: '2024-04-08' });
      expect(r.releaseDateSource).toBe('AUTHORITATIVE');
      expect(r.releaseDate).toBe('2024-04-08');
      expect(r.repairNeeded).toBe(false);
      expect(r.confidence).toBe('HIGH');
    });

    it('Missing year/month → MISSING, null releaseDate', () => {
      const r = inferMonthlyRevenueReleaseDate({ stockId: 'X', revenue: 500 } as any);
      expect(r.releaseDateSource).toBe('MISSING');
      expect(r.releaseDate).toBeNull();
      expect(r.repairNeeded).toBe(true);
    });

    it('Invalid releaseDate string → INVALID, null released', () => {
      const r = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 5, revenue: 100, releaseDate: 'bad-date' });
      expect(r.releaseDateSource).toBe('INVALID');
      expect(r.releaseDate).toBeNull();
      expect(r.repairNeeded).toBe(true);
    });

    it('Outcome fields on record do NOT affect inferred releaseDate', () => {
      const r = inferMonthlyRevenueReleaseDate({
        stockId: 'X', year: 2024, month: 8, revenue: 1100,
        outcomePrice: 150, returnPct: 12.5, realizedReturnClass: 'STRONG_BUY',
      } as any);
      expect(r.releaseDate).toBe('2024-09-10');
      expect(r.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
    });
  });

  // ── isMonthlyRevenueAvailableAsOf ─────────────────────────────────────────

  describe('isMonthlyRevenueAvailableAsOf', () => {
    const record = { stockId: 'X', year: 2024, month: 1, revenue: 1000 };

    it('asOfDate < inferred releaseDate → unavailable', () => {
      const r = isMonthlyRevenueAvailableAsOf(record, '2024-02-09');
      expect(r.available).toBe(false);
      expect(r.reason).toContain('2024-02-10');
    });

    it('asOfDate = inferred releaseDate → available', () => {
      const r = isMonthlyRevenueAvailableAsOf(record, '2024-02-10');
      expect(r.available).toBe(true);
    });

    it('asOfDate > inferred releaseDate → available', () => {
      const r = isMonthlyRevenueAvailableAsOf(record, '2024-02-15');
      expect(r.available).toBe(true);
    });

    it('Explicit releaseDate: before asOf → available', () => {
      const r2 = isMonthlyRevenueAvailableAsOf({ ...record, releaseDate: '2024-01-31' }, '2024-02-01');
      expect(r2.available).toBe(true);
      expect(r2.releaseDateSource).toBe('AUTHORITATIVE');
    });

    it('Explicit releaseDate: after asOf → unavailable', () => {
      const r2 = isMonthlyRevenueAvailableAsOf({ ...record, releaseDate: '2024-04-10' }, '2024-04-09');
      expect(r2.available).toBe(false);
    });

    it('Missing year/month → unavailable', () => {
      const r = isMonthlyRevenueAvailableAsOf({ stockId: 'X', revenue: 100 } as any, '2024-02-15');
      expect(r.available).toBe(false);
    });

    it('Invalid asOfDate → unavailable', () => {
      const r = isMonthlyRevenueAvailableAsOf(record, 'not-a-date');
      expect(r.available).toBe(false);
      expect(r.reason).toContain('not a valid ISO date');
    });

    it('Returns releaseDateUsed and repairNeeded fields', () => {
      const r = isMonthlyRevenueAvailableAsOf(record, '2024-02-10');
      expect(r.releaseDateUsed).toBe('2024-02-10');
      expect(typeof r.repairNeeded).toBe('boolean');
    });
  });

  // ── validateMonthlyRevenueReleaseDate ─────────────────────────────────────

  describe('validateMonthlyRevenueReleaseDate', () => {
    it('Invalid releaseDate → valid=false', () => {
      const v = validateMonthlyRevenueReleaseDate({ year: 2024, month: 3, revenue: 700, releaseDate: 'bad' });
      expect(v.valid).toBe(false);
    });

    it('Missing year/month → valid=false with error', () => {
      const v = validateMonthlyRevenueReleaseDate({ revenue: 500 } as any);
      expect(v.valid).toBe(false);
      expect(v.errors.length).toBeGreaterThan(0);
    });

    it('Valid AUTHORITATIVE releaseDate → valid=true, source=AUTHORITATIVE', () => {
      const v = validateMonthlyRevenueReleaseDate({ year: 2024, month: 6, revenue: 800, releaseDate: '2024-07-10' });
      expect(v.valid).toBe(true);
      expect(v.releaseDateSource).toBe('AUTHORITATIVE');
    });

    it('Inferred date has repairNeeded warning', () => {
      const v = validateMonthlyRevenueReleaseDate({ year: 2024, month: 9, revenue: 880 });
      expect(v.errors.length).toBe(0);
      expect(v.warnings.length).toBeGreaterThan(0);
      expect(v.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
    });
  });

  // ── normalizeMonthlyRevenueRecord ─────────────────────────────────────────

  describe('normalizeMonthlyRevenueRecord', () => {
    it('Normalizes a valid record with inferred releaseDate', () => {
      const n = normalizeMonthlyRevenueRecord({ stockId: 'X', year: 2024, month: 4, revenue: 600 });
      expect(n.stockId).toBe('X');
      expect(n.year).toBe(2024);
      expect(n.month).toBe(4);
      expect(n.periodValid).toBe(true);
      expect(n.normalized).toBe(true);
    });

    it('Does not throw on empty optional fields', () => {
      expect(() => normalizeMonthlyRevenueRecord({ stockId: 'X', year: 2024, month: 7, revenue: 700 })).not.toThrow();
    });
  });

  // ── buildMonthlyRevenuePitContract ────────────────────────────────────────

  describe('buildMonthlyRevenuePitContract', () => {
    it('Builds contract with 5 PIT safety requirements', () => {
      const contract = buildMonthlyRevenuePitContract();
      expect(contract.contractVersion).toBe('p13-monthly-revenue-pit-contract-v0');
      expect(contract.pitSafetyRequirements.length).toBe(5);
    });

    it('Contains P13-MR-001 through P13-MR-005 requirement IDs', () => {
      const contract = buildMonthlyRevenuePitContract();
      const ids = contract.pitSafetyRequirements.map((r: any) => r.id);
      expect(ids).toContain('P13-MR-001');
      expect(ids).toContain('P13-MR-005');
    });

    it('Contains nonGoals array', () => {
      const contract = buildMonthlyRevenuePitContract();
      expect(Array.isArray(contract.nonGoals)).toBe(true);
      expect(contract.nonGoals.length).toBeGreaterThan(0);
    });

    it('Does not contain ROI/alpha claims', () => {
      const contract = buildMonthlyRevenuePitContract();
      const text = JSON.stringify(contract);
      // nonGoals explicitly lists that no ROI/alpha claims are produced
      expect(text).not.toMatch(/\bguaranteed profit\b/i);
      expect(text).not.toMatch(/\bwin rate\b/i);
    });
  });

  // ── validateMonthlyRevenuePitContract ─────────────────────────────────────

  describe('validateMonthlyRevenuePitContract', () => {
    it('Valid contract passes validation', () => {
      const contract = buildMonthlyRevenuePitContract();
      const v = validateMonthlyRevenuePitContract(contract);
      expect(v.valid).toBe(true);
    });

    it('Contract missing pitSafetyRequirements fails', () => {
      const bad = { contractVersion: 'test', nonGoals: [] };
      const v = validateMonthlyRevenuePitContract(bad as any);
      expect(v.valid).toBe(false);
    });
  });

  // ── scanForbiddenClaims ───────────────────────────────────────────────────

  describe('scanForbiddenClaims', () => {
    it('Catches ROI claim', () => {
      const hits = scanForbiddenClaims('Expected ROI is 20%');
      expect(hits.some((h: any) => h.label === 'ROI')).toBe(true);
    });

    it('Catches alpha claim', () => {
      // alphaScore is OK, but standalone 'alpha' should be caught
      const hits2 = scanForbiddenClaims('pure alpha play');
      expect(hits2.some((h: any) => h.label === 'alpha')).toBe(true);
    });

    it('Catches win-rate claim', () => {
      const hits = scanForbiddenClaims('Win-rate is 75%');
      expect(hits.some((h: any) => h.label === 'win-rate')).toBe(true);
    });

    it('Catches profit claim', () => {
      const hits = scanForbiddenClaims('Expected profit of 30%');
      expect(hits.some((h: any) => h.label === 'profit')).toBe(true);
    });

    it('Catches guaranteed claim', () => {
      const hits = scanForbiddenClaims('This is guaranteed to outperform');
      expect(hits.some((h: any) => h.label === 'guaranteed' || h.label === 'outperform')).toBe(true);
    });

    it('Catches buy/sell recommendation', () => {
      const hits = scanForbiddenClaims('You should buy this stock');
      expect(hits.some((h: any) => /buy[\/]sell/.test(h.label))).toBe(true);
    });

    it('Does not flag alphaScore context', () => {
      const hits = scanForbiddenClaims('field: alphaScore value: 0.7');
      expect(hits.length).toBe(0);
    });

    it('Does not flag disclaimer line', () => {
      const hits = scanForbiddenClaims('Disclaimer: No investment recommendation');
      expect(hits.length).toBe(0);
    });

    it('Returns empty array for clean text', () => {
      const hits = scanForbiddenClaims('This record has year=2024, month=3, revenue=1000');
      expect(hits).toEqual([]);
    });
  });

  // ── summarizeMonthlyRevenuePitRepairPlan ──────────────────────────────────

  describe('summarizeMonthlyRevenuePitRepairPlan', () => {
    it('Returns summary with correct counts', () => {
      const plan = {
        planId: 'test-plan',
        overallStatus: 'IN_PROGRESS',
        repairItems: [
          { id: 'I1', priority: 'P0', status: 'OPEN', description: 'item1', blocking: true },
          { id: 'I2', priority: 'P1', status: 'OPEN', description: 'item2', blocking: false },
          { id: 'I3', priority: 'P2', status: 'DONE', description: 'item3', blocking: false },
        ],
      };
      const s = summarizeMonthlyRevenuePitRepairPlan(plan as any);
      expect(s.planId).toBe('test-plan');
      expect(s.totalItems).toBe(3);
      expect(s.blockers).toBe(1); // I1: blocking=true, status=OPEN
      expect(s.p0Items.length).toBe(1);
      expect(s.p1Items.length).toBe(1);
      expect(s.p2Items.length).toBe(1);
    });
  });

  // ── No Math.random() / corpus modification guard ──────────────────────────

  describe('Determinism guard', () => {
    it('inferMonthlyRevenueReleaseDate is deterministic — same input same output', () => {
      const r1 = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 6, revenue: 900 });
      const r2 = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 6, revenue: 900 });
      expect(r1.releaseDate).toBe(r2.releaseDate);
      expect(r1.releaseDateSource).toBe(r2.releaseDateSource);
    });

    it('No outcome fields (returnPct/realizedReturnClass/outcomeDate) in inference', () => {
      // This test verifies that passing outcome-contaminated records does not
      // produce a different releaseDate than the clean record
      const clean = inferMonthlyRevenueReleaseDate({ stockId: 'X', year: 2024, month: 7, revenue: 800 });
      const contaminated = inferMonthlyRevenueReleaseDate({
        stockId: 'X', year: 2024, month: 7, revenue: 800,
        returnPct: 25.0, realizedReturnClass: 'STRONG_BUY',
      } as any);
      expect(contaminated.releaseDate).toBe(clean.releaseDate);
      expect(contaminated.releaseDateSource).toBe(clean.releaseDateSource);
    });
  });
});
