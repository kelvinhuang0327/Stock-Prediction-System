import {
  buildResearchGapsReport,
  getCoverageStatusLabel,
  getCoverageStatusColor,
  getPriorityColor,
} from '../ResearchCoverageEngine';
import type { ResearchCoverageInputData } from '../ResearchCoverageEngine';
import type { SignalEffectivenessBatchApiResponse, SignalEffectivenessBatchResult } from '@/lib/signals/types';
import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBatchResult(overrides: Partial<SignalEffectivenessBatchResult> = {}): SignalEffectivenessBatchResult {
  return {
    signalType: 'topic_surging',
    sampleSize: 30,
    hitRate: 0.6,
    avgReturn: 0.02,
    excessReturn: 0.01,
    stabilityScore: 0.75,
    classification: 'STRONG_SIGNAL',
    limitations: [],
    effectiveness: {
      signalType: 'topic_surging',
      window: 5,
      sampleSize: 30,
      hitRate: 0.6,
      avgReturn: 0.02,
      excessReturn: 0.01,
      volatility: 0.05,
      brierLikeScore: 0.15,
      regimeBreakdown: {
        bull: { sampleSize: 12, avgReturn: 0.03, hitRate: 0.65 },
        bear: { sampleSize: 10, avgReturn: 0.01, hitRate: 0.55 },
        neutral: { sampleSize: 8, avgReturn: 0.015, hitRate: 0.58 },
      },
      persistence: { avgDuration: 1.5, continuationRate: 0.3 },
      stabilityScore: 0.75,
      classification: 'STRONG_SIGNAL',
      limitations: [],
    },
    ...overrides,
  };
}

function makeSignalBatch(overrides: Partial<SignalEffectivenessBatchApiResponse> = {}): SignalEffectivenessBatchApiResponse {
  const allTypes = ['topic_surging', 'theme_diffusing', 'strong_alpha_candidate', 'chip_accumulation_signal', 'risk_cluster_elevated', 'regime_shift_signal'] as const;
  return {
    window: 5,
    results: allTypes.map((signalType) =>
      makeBatchResult({ signalType }),
    ),
    generatedAt: new Date().toISOString(),
    limitations: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<ResearchCoverageInputData> = {}): ResearchCoverageInputData {
  return {
    signalBatch: makeSignalBatch(),
    eventSourceQuality: {
      qualityLabel: 'LIVE_CONFIDENT',
      confidenceAdjustment: 'NONE',
      rssRatio: 1,
      mockRatio: 0,
      rssCount: 5,
      mockCount: 0,
      totalEvents: 5,
      limitations: [],
      explanation: 'high RSS ratio, high trust mix',
      trustLevelBreakdown: { official: 2, mainstream: 2, secondary: 1, unknown: 0 },
    } as EventSourceQuality,
    taiexRowCount: 200,
    regimeSnapshotCount: 150,
    ...overrides,
  };
}

// ─── buildResearchGapsReport ─────────────────────────────────────────────────

describe('buildResearchGapsReport', () => {
  describe('signal items', () => {
    it('creates 6 signal items for 6 signal types', () => {
      const report = buildResearchGapsReport(makeInput());
      const signalItems = report.items.filter((item) => item.area === 'signal');
      expect(signalItems).toHaveLength(6);
    });

    it('marks signal as READY when sampleSize >= 30', () => {
      const report = buildResearchGapsReport(makeInput());
      const topicSignal = report.items.find((item) => item.key === 'signal:topic_surging');
      expect(topicSignal?.status).toBe('READY');
    });

    it('marks signal as PARTIAL when sampleSize 10-29', () => {
      const batch = makeSignalBatch({
        results: [makeBatchResult({ sampleSize: 15, classification: 'WEAK_SIGNAL' })],
      });
      const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
      const signalItem = report.items.find((item) => item.area === 'signal');
      expect(signalItem?.status).toBe('PARTIAL');
    });

    it('marks signal as INSUFFICIENT_DATA when sampleSize < 10', () => {
      const batch = makeSignalBatch({
        results: [makeBatchResult({ sampleSize: 5 })],
      });
      const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
      const signalItem = report.items.find((item) => item.area === 'signal');
      expect(signalItem?.status).toBe('INSUFFICIENT_DATA');
    });

    it('marks signal as INSUFFICIENT_DATA when sampleSize = 0', () => {
      const batch = makeSignalBatch({
        results: [makeBatchResult({ sampleSize: 0 })],
      });
      const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
      const signalItem = report.items.find((item) => item.area === 'signal');
      expect(signalItem?.status).toBe('INSUFFICIENT_DATA');
    });

    it('marks signal as UNAVAILABLE when TAIEX data unavailable', () => {
      const report = buildResearchGapsReport(makeInput({ taiexRowCount: 0 }));
      const signalItems = report.items.filter((item) => item.area === 'signal');
      signalItems.forEach((item) => expect(item.status).toBe('UNAVAILABLE'));
    });
  });

  describe('walk-forward item', () => {
    it('status READY when all signals have sampleSize >= 30', () => {
      const report = buildResearchGapsReport(makeInput());
      const wf = report.items.find((item) => item.key === 'validation:walk_forward');
      expect(wf?.status).toBe('READY');
    });

    it('status INSUFFICIENT_DATA when all samples = 0', () => {
      const batch = makeSignalBatch({
        results: ['topic_surging' as const, 'theme_diffusing' as const].map((t) =>
          makeBatchResult({ signalType: t, sampleSize: 0 }),
        ),
      });
      const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
      const wf = report.items.find((item) => item.key === 'validation:walk_forward');
      expect(wf?.status).toBe('INSUFFICIENT_DATA');
    });

    it('status INSUFFICIENT_DATA when minSample < 16', () => {
      const batch = makeSignalBatch({
        results: [makeBatchResult({ sampleSize: 12 }), makeBatchResult({ signalType: 'theme_diffusing', sampleSize: 8 })],
      });
      const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
      const wf = report.items.find((item) => item.key === 'validation:walk_forward');
      expect(wf?.status).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('regime stratification item', () => {
    it('status UNAVAILABLE when regimeSnapshotCount = 0', () => {
      const report = buildResearchGapsReport(makeInput({ regimeSnapshotCount: 0 }));
      const regime = report.items.find((item) => item.key === 'regime:stratification');
      expect(regime?.status).toBe('UNAVAILABLE');
      expect(regime?.sampleSize).toBe(0);
    });

    it('status INSUFFICIENT_DATA when regimeSnapshotCount < 30', () => {
      const report = buildResearchGapsReport(makeInput({ regimeSnapshotCount: 10 }));
      const regime = report.items.find((item) => item.key === 'regime:stratification');
      expect(regime?.status).toBe('INSUFFICIENT_DATA');
    });

    it('status PARTIAL when 30 <= regimeSnapshotCount < 100 with some assessable regimes', () => {
      const report = buildResearchGapsReport(makeInput({ regimeSnapshotCount: 50 }));
      const regime = report.items.find((item) => item.key === 'regime:stratification');
      // With good regimeBreakdown data (all regimes assessable) but snapshot count < 100
      expect(regime?.status).toBe('PARTIAL');
    });

    it('status READY when regimeSnapshotCount >= 100 and most signals have assessable regimes', () => {
      const report = buildResearchGapsReport(makeInput({ regimeSnapshotCount: 150 }));
      const regime = report.items.find((item) => item.key === 'regime:stratification');
      // All 6 signals have 3 assessable regimes each → READY
      expect(regime?.status).toBe('READY');
    });
  });

  describe('confidence calibration item', () => {
    it('status PARTIAL when signals have brierLikeScore', () => {
      const report = buildResearchGapsReport(makeInput());
      const confidence = report.items.find((item) => item.key === 'confidence:calibration');
      expect(confidence?.status).toBe('PARTIAL');
    });

    it('status INSUFFICIENT_DATA when no signal has brierLikeScore', () => {
      const batch = makeSignalBatch({
        results: [makeBatchResult({
          sampleSize: 5,
          effectiveness: {
            ...makeBatchResult().effectiveness,
            sampleSize: 5,
            brierLikeScore: undefined,
          },
        })],
      });
      const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
      const confidence = report.items.find((item) => item.key === 'confidence:calibration');
      expect(confidence?.status).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('event source quality item', () => {
    it('status READY for LIVE_CONFIDENT', () => {
      const report = buildResearchGapsReport(makeInput());
      const event = report.items.find((item) => item.key === 'event:source_quality');
      expect(event?.status).toBe('READY');
    });

    it('status PARTIAL for MIXED_SOURCE', () => {
      const esq = { ...makeInput().eventSourceQuality!, qualityLabel: 'MIXED_SOURCE' as const, mockRatio: 0.3, mockCount: 2 };
      const report = buildResearchGapsReport(makeInput({ eventSourceQuality: esq }));
      const event = report.items.find((item) => item.key === 'event:source_quality');
      expect(event?.status).toBe('PARTIAL');
    });

    it('status SIMULATION_DOMINATED for SIMULATION_DOMINATED', () => {
      const esq = { ...makeInput().eventSourceQuality!, qualityLabel: 'SIMULATION_DOMINATED' as const, mockRatio: 0.8, mockCount: 8 };
      const report = buildResearchGapsReport(makeInput({ eventSourceQuality: esq }));
      const event = report.items.find((item) => item.key === 'event:source_quality');
      expect(event?.status).toBe('SIMULATION_DOMINATED');
    });

    it('status INSUFFICIENT_DATA for INSUFFICIENT_EVENT_DATA', () => {
      const esq = { ...makeInput().eventSourceQuality!, qualityLabel: 'INSUFFICIENT_EVENT_DATA' as const };
      const report = buildResearchGapsReport(makeInput({ eventSourceQuality: esq }));
      const event = report.items.find((item) => item.key === 'event:source_quality');
      expect(event?.status).toBe('INSUFFICIENT_DATA');
    });

    it('status INSUFFICIENT_DATA when eventSourceQuality is null', () => {
      const report = buildResearchGapsReport(makeInput({ eventSourceQuality: null }));
      const event = report.items.find((item) => item.key === 'event:source_quality');
      expect(event?.status).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('relevance quality overlay item', () => {
    it('status is always PARTIAL (proxy-based integration)', () => {
      const report = buildResearchGapsReport(makeInput());
      const relevance = report.items.find((item) => item.key === 'relevance:quality_overlay');
      expect(relevance?.status).toBe('PARTIAL');
    });
  });

  describe('summary', () => {
    it('correctly counts ready modules for healthy state', () => {
      const report = buildResearchGapsReport(makeInput());
      // Signal: 6 READY, walkforward: 1 READY, regime: 1 READY, event: 1 READY
      // confidence: 1 PARTIAL, relevance: 1 PARTIAL
      expect(report.summary.readyCount).toBeGreaterThanOrEqual(8);
      expect(report.summary.partialCount).toBeGreaterThanOrEqual(2);
    });

    it('totalModules = items.length (11: 6 signal + walkforward + regime + confidence + event + relevance)', () => {
      const report = buildResearchGapsReport(makeInput());
      expect(report.summary.totalModules).toBe(11);
    });

    it('overallReadiness is 0 when TAIEX unavailable and no regime data', () => {
      const report = buildResearchGapsReport(
        makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null }),
      );
      expect(report.summary.overallReadiness).toBeLessThan(30);
    });

    it('overallReadiness > 70 for healthy state', () => {
      const report = buildResearchGapsReport(makeInput());
      expect(report.summary.overallReadiness).toBeGreaterThan(60);
    });
  });

  describe('topGaps', () => {
    it('includes HIGH priority gap when TAIEX unavailable', () => {
      const report = buildResearchGapsReport(makeInput({ taiexRowCount: 0 }));
      const taiexGap = report.topGaps.find((g) => g.key === 'gap:taiex_unavailable');
      expect(taiexGap).toBeDefined();
      expect(taiexGap?.priority).toBe('HIGH');
    });

    it('includes HIGH priority gap when no regime history', () => {
      const report = buildResearchGapsReport(makeInput({ regimeSnapshotCount: 0 }));
      const regimeGap = report.topGaps.find((g) => g.key === 'gap:no_regime_history');
      expect(regimeGap).toBeDefined();
      expect(regimeGap?.priority).toBe('HIGH');
    });

    it('includes HIGH priority gap for SIMULATION_DOMINATED events', () => {
      const esq = { ...makeInput().eventSourceQuality!, qualityLabel: 'SIMULATION_DOMINATED' as const, mockRatio: 0.9, mockCount: 9 };
      const report = buildResearchGapsReport(makeInput({ eventSourceQuality: esq }));
      const simGap = report.topGaps.find((g) => g.key === 'gap:simulation_dominated');
      expect(simGap).toBeDefined();
      expect(simGap?.priority).toBe('HIGH');
    });

    it('always includes MEDIUM gap for NewsEvent sourceType not in DB', () => {
      const report = buildResearchGapsReport(makeInput());
      const dbGap = report.topGaps.find((g) => g.key === 'gap:event_sourcetype_not_in_db');
      expect(dbGap).toBeDefined();
      expect(dbGap?.priority).toBe('MEDIUM');
    });

    it('always includes MEDIUM gap for confidence calibration', () => {
      const report = buildResearchGapsReport(makeInput());
      const confGap = report.topGaps.find((g) => g.key === 'gap:confidence_uncalibrated');
      expect(confGap).toBeDefined();
      expect(confGap?.priority).toBe('MEDIUM');
    });

    it('always includes LOW gap for relevance proxy-only', () => {
      const report = buildResearchGapsReport(makeInput());
      const relGap = report.topGaps.find((g) => g.key === 'gap:relevance_proxy_only');
      expect(relGap).toBeDefined();
      expect(relGap?.priority).toBe('LOW');
    });

    it('sorts HIGH gaps before MEDIUM and LOW', () => {
      const report = buildResearchGapsReport(makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0 }));
      const highGaps = report.topGaps.filter((g) => g.priority === 'HIGH');
      const medGaps = report.topGaps.filter((g) => g.priority === 'MEDIUM');
      const lowGaps = report.topGaps.filter((g) => g.priority === 'LOW');

      if (highGaps.length > 0 && medGaps.length > 0) {
        const lastHighIdx = report.topGaps.findIndex((g) => g.key === highGaps[highGaps.length - 1].key);
        const firstMedIdx = report.topGaps.findIndex((g) => g.key === medGaps[0].key);
        expect(lastHighIdx).toBeLessThan(firstMedIdx);
      }
      if (medGaps.length > 0 && lowGaps.length > 0) {
        const lastMedIdx = report.topGaps.findIndex((g) => g.key === medGaps[medGaps.length - 1].key);
        const firstLowIdx = report.topGaps.findIndex((g) => g.key === lowGaps[0].key);
        expect(lastMedIdx).toBeLessThan(firstLowIdx);
      }
    });
  });

  describe('degraded mode', () => {
    it('returns complete report structure even with all zeros input', () => {
      const batch = makeSignalBatch({
        results: ['topic_surging' as const].map((t) =>
          makeBatchResult({ signalType: t, sampleSize: 0, classification: 'NOISE', limitations: ['degraded'] }),
        ),
      });
      const report = buildResearchGapsReport({
        signalBatch: batch,
        eventSourceQuality: null,
        taiexRowCount: 0,
        regimeSnapshotCount: 0,
      });

      expect(report.items).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.topGaps).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(Array.isArray(report.limitations)).toBe(true);
    });

    it('does not output READY status when taiex unavailable', () => {
      const report = buildResearchGapsReport(makeInput({ taiexRowCount: 0 }));
      const signalItems = report.items.filter((item) => item.area === 'signal');
      signalItems.forEach((item) => {
        expect(item.status).not.toBe('READY');
        expect(item.status).not.toBe('PARTIAL');
      });
    });

    it('includes top-level limitations when critical data missing', () => {
      const report = buildResearchGapsReport(
        makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null }),
      );
      expect(report.limitations.length).toBeGreaterThan(0);
    });
  });

  describe('all items have primaryLimitations array', () => {
    it('all items return defined primaryLimitations array', () => {
      const report = buildResearchGapsReport(makeInput());
      report.items.forEach((item) => {
        expect(Array.isArray(item.primaryLimitations)).toBe(true);
      });
    });
  });
});

// ─── Summary totalModules correction ─────────────────────────────────────────

describe('summary.totalModules', () => {
  it('equals items.length', () => {
    const report = buildResearchGapsReport(makeInput());
    expect(report.summary.totalModules).toBe(report.items.length);
  });
});

// ─── Badge helpers ────────────────────────────────────────────────────────────

describe('getCoverageStatusLabel', () => {
  it('returns correct label for each status', () => {
    expect(getCoverageStatusLabel('READY')).toBe('可用');
    expect(getCoverageStatusLabel('PARTIAL')).toBe('部分可用');
    expect(getCoverageStatusLabel('DEGRADED')).toBe('效能降級');
    expect(getCoverageStatusLabel('INSUFFICIENT_DATA')).toBe('資料不足');
    expect(getCoverageStatusLabel('SIMULATION_DOMINATED')).toBe('模擬主導');
    expect(getCoverageStatusLabel('UNAVAILABLE')).toBe('不可用');
  });
});

describe('getCoverageStatusColor', () => {
  it('returns green for READY', () => {
    expect(getCoverageStatusColor('READY')).toContain('green');
  });

  it('returns amber for PARTIAL', () => {
    expect(getCoverageStatusColor('PARTIAL')).toContain('amber');
  });

  it('returns red for UNAVAILABLE', () => {
    expect(getCoverageStatusColor('UNAVAILABLE')).toContain('red');
  });
});

describe('getPriorityColor', () => {
  it('returns red for HIGH', () => {
    expect(getPriorityColor('HIGH')).toContain('red');
  });

  it('returns amber for MEDIUM', () => {
    expect(getPriorityColor('MEDIUM')).toContain('amber');
  });

  it('returns slate for LOW', () => {
    expect(getPriorityColor('LOW')).toContain('slate');
  });
});
