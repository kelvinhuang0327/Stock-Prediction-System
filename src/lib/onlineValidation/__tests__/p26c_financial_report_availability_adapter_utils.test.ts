import {
  normalizeFinancialReport,
  resolveFinancialReportAvailabilityDate,
  isFinancialReportVisibleAsOf,
  filterFinancialReportsVisibleAsOf,
  buildFinancialReportContextSnapshot,
  summarizeFinancialReportContextForReason,
  validateFinancialReportContextIsReadOnly,
  validateNoOutcomeFieldsInFinancialReportContext,
  validateNoPeriodEndDateVisibilityLeak,
  validateNoIngestedAtVisibilityLeak,
  classifyFinancialReportAvailabilityStatus,
} from '../P26CFinancialReportAvailabilityAdapterUtils';

const ASO = '2026-05-13';

function makeReport(overrides = {}) {
  return {
    reportId: 'RPT_TEST_001',
    symbol: '2330',
    fiscalYear: '2025',
    fiscalQuarter: 'Q3',
    reportType: 'quarterly',
    periodEndDate: '2025-09-30',
    filingDate: '2026-05-10T09:00:00Z',
    announcementDate: null,
    publishedAt: null,
    availableAt: null,
    ingestedAt: '2026-05-11T08:00:00Z',
    createdAt: '2026-05-11T08:00:00Z',
    updatedAt: '2026-05-11T08:00:00Z',
    source: 'TWSE',
    sourceHash: 'sha256:test_001',
    metrics: { eps: 28.5 },
    ...overrides,
  };
}

describe('P26C FinancialReport Availability Adapter Utils', () => {
  describe('normalizeFinancialReport', () => {
    it('normalizes a raw report', () => {
      const r = normalizeFinancialReport(makeReport());
      expect(r.symbol).toBe('2330');
      expect(r.reportId).toBe('RPT_TEST_001');
    });

    it('does not mutate input', () => {
      const raw = makeReport();
      const orig = JSON.stringify(raw);
      normalizeFinancialReport(raw);
      expect(JSON.stringify(raw)).toBe(orig);
    });

    it('handles missing optional fields with defaults', () => {
      const r = normalizeFinancialReport({});
      expect(r.reportId).toBe('UNKNOWN_REPORT_ID');
      expect(r.symbol).toBe('UNKNOWN_SYMBOL');
      expect(r.metrics).toEqual({});
    });

    it('converts numeric fiscalYear to string', () => {
      const r = normalizeFinancialReport(makeReport({ fiscalYear: 2025 }));
      expect(r.fiscalYear).toBe('2025');
    });
  });

  describe('resolveFinancialReportAvailabilityDate', () => {
    it('uses filingDate as primary gate', () => {
      const r = makeReport({ filingDate: '2026-05-10T09:00:00Z' });
      const result = resolveFinancialReportAvailabilityDate(r);
      expect(result.source).toBe('filingDate');
      expect(result.date).toBe('2026-05-10');
    });

    it('falls back to announcementDate when filingDate missing', () => {
      const r = makeReport({ filingDate: null, announcementDate: '2026-05-08T09:00:00Z' });
      const result = resolveFinancialReportAvailabilityDate(r);
      expect(result.source).toBe('announcementDate');
      expect(result.date).toBe('2026-05-08');
    });

    it('falls back to publishedAt when filingDate and announcementDate missing', () => {
      const r = makeReport({ filingDate: null, announcementDate: null, publishedAt: '2026-05-07T09:00:00Z' });
      const result = resolveFinancialReportAvailabilityDate(r);
      expect(result.source).toBe('publishedAt');
    });

    it('falls back to availableAt as last resort', () => {
      const r = makeReport({ filingDate: null, announcementDate: null, publishedAt: null, availableAt: '2026-05-06T09:00:00Z' });
      const result = resolveFinancialReportAvailabilityDate(r);
      expect(result.source).toBe('availableAt');
    });

    it('returns MISSING when all availability fields null', () => {
      const r = makeReport({ filingDate: null, announcementDate: null, publishedAt: null, availableAt: null });
      const result = resolveFinancialReportAvailabilityDate(r);
      expect(result.source).toBe('MISSING');
      expect(result.date).toBeNull();
    });

    it('converts UTC timestamp to Taiwan date (UTC+8)', () => {
      // UTC 09:00 → Taiwan 17:00 same day
      const r = makeReport({ filingDate: '2026-05-10T09:00:00Z' });
      const result = resolveFinancialReportAvailabilityDate(r);
      expect(result.date).toBe('2026-05-10');
    });
  });

  describe('isFinancialReportVisibleAsOf', () => {
    it('filingDate <= asOf → visible', () => {
      const r = makeReport({ filingDate: '2026-05-10T09:00:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(true);
    });

    it('filingDate > asOf → not visible', () => {
      const r = makeReport({ filingDate: '2026-05-20T09:00:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(false);
    });

    it('periodEndDate before asOf but filingDate after asOf → NOT visible', () => {
      const r = makeReport({ periodEndDate: '2025-12-31', filingDate: '2026-06-15T09:00:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(false);
    });

    it('ingestedAt after asOf does NOT block visibility when filingDate before asOf', () => {
      const r = makeReport({ filingDate: '2026-05-10T09:00:00Z', ingestedAt: '2026-05-20T08:00:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(true);
    });

    it('ingestedAt before asOf does NOT grant visibility when filingDate after asOf', () => {
      const r = makeReport({ filingDate: '2026-06-15T09:00:00Z', ingestedAt: '2026-05-10T08:00:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(false);
    });

    it('missing all availability fields → not visible', () => {
      const r = makeReport({ filingDate: null, announcementDate: null, publishedAt: null, availableAt: null });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(false);
    });

    it('announcementDate fallback works when filingDate missing', () => {
      const r = makeReport({ filingDate: null, announcementDate: '2026-05-08T09:00:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(true);
    });

    it('timezone boundary: UTC 2026-05-13T15:59:00Z = Taiwan 2026-05-13 23:59 → visible', () => {
      const r = makeReport({ filingDate: '2026-05-13T15:59:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(true);
    });

    it('timezone: UTC 2026-05-13T16:01:00Z = Taiwan 2026-05-14 → NOT visible', () => {
      const r = makeReport({ filingDate: '2026-05-13T16:01:00Z' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(false);
    });

    it('exact boundary: filingDate = asOfDate (plain date) → visible', () => {
      const r = makeReport({ filingDate: '2026-05-13' });
      expect(isFinancialReportVisibleAsOf(r, ASO)).toBe(true);
    });
  });

  describe('filterFinancialReportsVisibleAsOf', () => {
    it('returns only visible reports', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:a', filingDate: '2026-05-10T09:00:00Z' }),
        makeReport({ sourceHash: 'sha256:b', filingDate: '2026-06-15T09:00:00Z' }),
      ];
      const result = filterFinancialReportsVisibleAsOf(reports, ASO);
      expect(result).toHaveLength(1);
      expect(isFinancialReportVisibleAsOf(result[0], ASO)).toBe(true);
    });

    it('returns empty array when no reports visible', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:x', filingDate: '2026-06-01T09:00:00Z' }),
      ];
      const result = filterFinancialReportsVisibleAsOf(reports, ASO);
      expect(result).toHaveLength(0);
    });
  });

  describe('buildFinancialReportContextSnapshot', () => {
    it('returns readOnly=true', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      expect(snap.readOnly).toBe(true);
    });

    it('returns entersAlphaScore=false', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      expect(snap.entersAlphaScore).toBe(false);
    });

    it('filters different symbol', () => {
      const reports = [makeReport({ symbol: '0050', sourceHash: 'sha256:diff' })];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      expect(snap.reports.some(r => r.pitVisibility === 'WRONG_SYMBOL')).toBe(true);
    });

    it('deduplicates by sourceHash', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:dup', filingDate: '2026-05-10T09:00:00Z' }),
        makeReport({ reportId: 'RPT_DUP', sourceHash: 'sha256:dup', filingDate: '2026-05-10T09:00:00Z' }),
      ];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      const dupExcluded = snap.reports.some(r => r.pitVisibility === 'DUPLICATE_EXCLUDED');
      expect(dupExcluded).toBe(true);
    });

    it('counts visible reports correctly', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:v1', filingDate: '2026-05-10T09:00:00Z' }),
        makeReport({ sourceHash: 'sha256:v2', reportId: 'RPT_002', filingDate: '2026-06-15T09:00:00Z' }),
      ];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      expect(snap.visibleReportCount).toBe(1);
    });

    it('does not mutate input reports array', () => {
      const reports = [makeReport()];
      const orig = JSON.stringify(reports);
      buildFinancialReportContextSnapshot(reports, ASO, '2330');
      expect(JSON.stringify(reports)).toBe(orig);
    });

    it('marks visibilityGate correctly', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      expect(snap.visibilityGate).toBe('availabilityDate <= asOfDate');
    });

    it('marks INVALID_MISSING_AVAILABILITY_DATE when all availability fields null', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:missing', filingDate: null, announcementDate: null, publishedAt: null, availableAt: null }),
      ];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      expect(snap.reports.some(r => r.pitVisibility === 'INVALID_MISSING_AVAILABILITY_DATE')).toBe(true);
    });

    it('marks FUTURE_AVAILABILITY_DATE_EXCLUDED for future filingDate', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:future', filingDate: '2026-06-15T09:00:00Z' }),
      ];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      expect(snap.reports.some(r => r.pitVisibility === 'FUTURE_AVAILABILITY_DATE_EXCLUDED')).toBe(true);
    });

    it('sets correct asOfDate and symbol in snapshot', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      expect(snap.asOfDate).toBe(ASO);
      expect(snap.symbol).toBe('2330');
    });
  });

  describe('summarizeFinancialReportContextForReason', () => {
    it('produces neutral text for no visible reports', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      const summary = summarizeFinancialReportContextForReason(snap);
      expect(summary).toBeTruthy();
      expect(summary).not.toMatch(/buy|sell|recommend|guaranteed|roi|profit|outperform/i);
    });

    it('produces neutral text with visible reports', () => {
      const reports = [makeReport({ filingDate: '2026-05-10T09:00:00Z' })];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      const summary = summarizeFinancialReportContextForReason(snap);
      expect(summary).not.toMatch(/buy|sell|recommend|guaranteed|roi|profit|outperform/i);
    });

    it('mentions asOfDate and symbol in zero-report case', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      const summary = summarizeFinancialReportContextForReason(snap);
      expect(summary).toContain(ASO);
      expect(summary).toContain('2330');
    });

    it('mentions visible report count in populated case', () => {
      const reports = [makeReport({ filingDate: '2026-05-10T09:00:00Z' })];
      const snap = buildFinancialReportContextSnapshot(reports, ASO, '2330');
      const summary = summarizeFinancialReportContextForReason(snap);
      expect(summary).toContain('1');
    });

    it('mentions read-only metadata disclaimer', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      const summary = summarizeFinancialReportContextForReason(snap);
      expect(summary).toMatch(/read-only metadata/i);
    });
  });

  describe('validation functions', () => {
    it('validateFinancialReportContextIsReadOnly passes for correct snapshot', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      const result = validateFinancialReportContextIsReadOnly(snap);
      expect(result.valid).toBe(true);
    });

    it('validateNoOutcomeFieldsInFinancialReportContext passes for clean context', () => {
      const snap = buildFinancialReportContextSnapshot([], ASO, '2330');
      const result = validateNoOutcomeFieldsInFinancialReportContext(snap);
      expect(result.valid).toBe(true);
    });

    it('validateNoPeriodEndDateVisibilityLeak catches period-end leakage', () => {
      const reports = [makeReport({
        periodEndDate: '2025-12-31',
        filingDate: '2026-06-15T09:00:00Z',
        sourceHash: 'sha256:leak'
      })];
      const result = validateNoPeriodEndDateVisibilityLeak(reports, ASO);
      expect(result.valid).toBe(true); // no leakage because filingDate > asOf correctly excluded
    });

    it('validateNoIngestedAtVisibilityLeak validates correctly', () => {
      const reports = [makeReport({ ingestedAt: '2026-05-20T08:00:00Z' })];
      const result = validateNoIngestedAtVisibilityLeak(reports, ASO);
      expect(result.valid).toBe(true);
    });

    it('validateNoIngestedAtVisibilityLeak: early ingestedAt does not grant future filingDate visibility', () => {
      const reports = [makeReport({
        filingDate: '2026-06-15T09:00:00Z',
        ingestedAt: '2026-05-01T08:00:00Z',
        sourceHash: 'sha256:ingest-early'
      })];
      const result = validateNoIngestedAtVisibilityLeak(reports, ASO);
      expect(result.valid).toBe(true);
    });
  });

  describe('classifyFinancialReportAvailabilityStatus', () => {
    it('returns summary with correct counts', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:c1', filingDate: '2026-05-10T09:00:00Z' }),
        makeReport({ sourceHash: 'sha256:c2', reportId: 'RPT_002', filingDate: '2026-06-15T09:00:00Z' }),
      ];
      const status = classifyFinancialReportAvailabilityStatus(reports, ASO);
      expect(status).toBeDefined();
      expect(status.total).toBe(2);
      expect(status.visibleAsOf).toBe(1);
      expect(status.futureAvailabilityDateExcluded).toBe(1);
    });

    it('counts MISSING availability correctly', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:m1', filingDate: null, announcementDate: null, publishedAt: null, availableAt: null }),
      ];
      const status = classifyFinancialReportAvailabilityStatus(reports, ASO);
      expect(status.invalidMissingAvailabilityDate).toBe(1);
      expect(status.byAvailabilitySource['MISSING']).toBe(1);
    });

    it('tracks byAvailabilitySource correctly', () => {
      const reports = [
        makeReport({ sourceHash: 'sha256:f1', filingDate: '2026-05-10T09:00:00Z' }),
        makeReport({ sourceHash: 'sha256:a1', reportId: 'RPT_A', filingDate: null, announcementDate: '2026-05-08T09:00:00Z' }),
      ];
      const status = classifyFinancialReportAvailabilityStatus(reports, ASO);
      expect(status.byAvailabilitySource['filingDate']).toBe(1);
      expect(status.byAvailabilitySource['announcementDate']).toBe(1);
    });
  });

  describe('no Math.random', () => {
    it('adapter source has no Math.random calls', () => {
      const src = require('fs').readFileSync('src/lib/onlineValidation/P26CFinancialReportAvailabilityAdapterUtils.ts', 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });
  });

  describe('no external imports', () => {
    it('adapter source has no external package imports', () => {
      const src = require('fs').readFileSync('src/lib/onlineValidation/P26CFinancialReportAvailabilityAdapterUtils.ts', 'utf8');
      expect(src).not.toMatch(/^import.*from ['"][^.]/m);
    });
  });
});
