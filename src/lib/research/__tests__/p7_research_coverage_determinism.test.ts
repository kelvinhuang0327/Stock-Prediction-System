/**
 * P7 — Axis A Research Coverage Engine Determinism and Edge-case Extension
 *
 * 25 tests / 5 groups
 *
 * Extends ResearchCoverageEngine coverage with determinism invariants,
 * boundary value paths, summary count invariants, governance/anti-advice
 * invariants, and structural edge cases.
 *
 * Groups:
 *   P7.1 — Determinism and ordering (5)
 *   P7.2 — Boundary values (5)
 *   P7.3 — Summary invariants (5)
 *   P7.4 — Governance / anti-advice invariants (5)
 *   P7.5 — Edge-case paths (5)
 *
 * GOVERNANCE:
 * - entersAlphaScore = false (no alphaScore field in any coverage item)
 * - notInvestmentRecommendation = true (no buy/sell/hold semantics)
 * - paperOnly / dryRunOnly not applicable (coverage engine is a research transparency layer)
 *
 * Authorization:
 *   P7_AXIS_A_RESEARCH_COVERAGE_DETERMINISM_READY
 *   P6_AXIS_B_FIXTURE_RESULT_CONTRACT_READY (gate satisfied)
 *
 * NOT investment advice. No buy/sell/hold. No PnL/ROI/win-rate claims.
 */

import {
  buildResearchGapsReport,
  getCoverageStatusLabel,
} from '../ResearchCoverageEngine';
import type { ResearchCoverageInputData } from '../ResearchCoverageEngine';
import type {
  SignalEffectivenessBatchApiResponse,
  SignalEffectivenessBatchResult,
} from '@/lib/signals/types';
import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function makeBatchResult(
  overrides: Partial<SignalEffectivenessBatchResult> = {}
): SignalEffectivenessBatchResult {
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

function makeSignalBatch(
  overrides: Partial<SignalEffectivenessBatchApiResponse> = {}
): SignalEffectivenessBatchApiResponse {
  const allTypes = [
    'topic_surging',
    'theme_diffusing',
    'strong_alpha_candidate',
    'chip_accumulation_signal',
    'risk_cluster_elevated',
    'regime_shift_signal',
  ] as const;
  return {
    window: 5,
    results: allTypes.map((signalType) => makeBatchResult({ signalType })),
    generatedAt: new Date().toISOString(),
    limitations: [],
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<ResearchCoverageInputData> = {}
): ResearchCoverageInputData {
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

// ─── P7 Group 1: Determinism and ordering (5 tests) ───────────────────────────

describe('P7.1 — Determinism and ordering', () => {
  it('P7.T1.1 — same input twice → identical summary readyCount', () => {
    const input = makeInput();
    const r1 = buildResearchGapsReport(input);
    const r2 = buildResearchGapsReport(input);
    expect(r1.summary.readyCount).toBe(r2.summary.readyCount);
  });

  it('P7.T1.2 — same input twice → identical items.length', () => {
    const input = makeInput();
    const r1 = buildResearchGapsReport(input);
    const r2 = buildResearchGapsReport(input);
    expect(r1.items.length).toBe(r2.items.length);
  });

  it('P7.T1.3 — same input twice → identical topGaps length', () => {
    const input = makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null });
    const r1 = buildResearchGapsReport(input);
    const r2 = buildResearchGapsReport(input);
    expect(r1.topGaps.length).toBe(r2.topGaps.length);
  });

  it('P7.T1.4 — same input twice → identical overallReadiness', () => {
    const input = makeInput();
    const r1 = buildResearchGapsReport(input);
    const r2 = buildResearchGapsReport(input);
    expect(r1.summary.overallReadiness).toBe(r2.summary.overallReadiness);
  });

  it('P7.T1.5 — all signal items appear before the walkforward item in items array', () => {
    const report = buildResearchGapsReport(makeInput());
    const signalIndices = report.items
      .map((item, i) => ({ area: item.area, i }))
      .filter(({ area }) => area === 'signal')
      .map(({ i }) => i);
    const walkForwardIndex = report.items.findIndex(
      (item) => item.key === 'validation:walk_forward'
    );
    expect(signalIndices.length).toBeGreaterThan(0);
    expect(walkForwardIndex).toBeGreaterThan(-1);
    for (const si of signalIndices) {
      expect(si).toBeLessThan(walkForwardIndex);
    }
  });
});

// ─── P7 Group 2: Boundary values (5 tests) ────────────────────────────────────

describe('P7.2 — Boundary values', () => {
  it('P7.T2.1 — sampleSize=9 → signal INSUFFICIENT_DATA (just below degraded floor 10)', () => {
    const batch = makeSignalBatch({
      results: [makeBatchResult({ signalType: 'topic_surging', sampleSize: 9 })],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
    const signal = report.items.find((item) => item.key === 'signal:topic_surging');
    expect(signal?.status).toBe('INSUFFICIENT_DATA');
  });

  it('P7.T2.2 — sampleSize=10 → signal PARTIAL (at degraded floor, TAIEX available)', () => {
    const batch = makeSignalBatch({
      results: [makeBatchResult({ signalType: 'topic_surging', sampleSize: 10 })],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch, taiexRowCount: 100 }));
    const signal = report.items.find((item) => item.key === 'signal:topic_surging');
    expect(signal?.status).toBe('PARTIAL');
  });

  it('P7.T2.3 — sampleSize=29 → signal PARTIAL (just below READY floor 30)', () => {
    const batch = makeSignalBatch({
      results: [makeBatchResult({ signalType: 'topic_surging', sampleSize: 29 })],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch, taiexRowCount: 100 }));
    const signal = report.items.find((item) => item.key === 'signal:topic_surging');
    expect(signal?.status).toBe('PARTIAL');
  });

  it('P7.T2.4 — sampleSize=30 → signal READY (at READY floor, TAIEX available)', () => {
    const batch = makeSignalBatch({
      results: [makeBatchResult({ signalType: 'topic_surging', sampleSize: 30 })],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch, taiexRowCount: 100 }));
    const signal = report.items.find((item) => item.key === 'signal:topic_surging');
    expect(signal?.status).toBe('READY');
  });

  it('P7.T2.5 — taiexRowCount=9 → all signal items UNAVAILABLE (just below MIN_TAIEX_ROWS=10)', () => {
    const report = buildResearchGapsReport(makeInput({ taiexRowCount: 9 }));
    const signalItems = report.items.filter((item) => item.area === 'signal');
    expect(signalItems.length).toBeGreaterThan(0);
    signalItems.forEach((item) => {
      expect(item.status).toBe('UNAVAILABLE');
    });
  });
});

// ─── P7 Group 3: Summary invariants (5 tests) ─────────────────────────────────

describe('P7.3 — Summary invariants', () => {
  it('P7.T3.1 — status count sum equals totalModules', () => {
    const report = buildResearchGapsReport(makeInput());
    const { readyCount, partialCount, degradedCount, insufficientCount,
      simulationDominatedCount, unavailableCount, totalModules } = report.summary;
    expect(
      readyCount + partialCount + degradedCount + insufficientCount +
      simulationDominatedCount + unavailableCount
    ).toBe(totalModules);
  });

  it('P7.T3.2 — overallReadiness is always in range [0, 100]', () => {
    const healthy = buildResearchGapsReport(makeInput());
    const degraded = buildResearchGapsReport(
      makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null })
    );
    expect(healthy.summary.overallReadiness).toBeGreaterThanOrEqual(0);
    expect(healthy.summary.overallReadiness).toBeLessThanOrEqual(100);
    expect(degraded.summary.overallReadiness).toBeGreaterThanOrEqual(0);
    expect(degraded.summary.overallReadiness).toBeLessThanOrEqual(100);
  });

  it('P7.T3.3 — empty signalBatch results → totalModules = 5 (non-signal modules only)', () => {
    const batch = makeSignalBatch({ results: [] });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
    // 0 signal + walkForward + regime + confidence + event + relevance = 5
    expect(report.summary.totalModules).toBe(5);
  });

  it('P7.T3.4 — all items with defined coverageRatio have value in [0, 1]', () => {
    const report = buildResearchGapsReport(makeInput());
    for (const item of report.items) {
      if (item.coverageRatio !== undefined) {
        expect(item.coverageRatio).toBeGreaterThanOrEqual(0);
        expect(item.coverageRatio).toBeLessThanOrEqual(1);
      }
    }
  });

  it('P7.T3.5 — all items have a non-empty key string', () => {
    const report = buildResearchGapsReport(
      makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null })
    );
    for (const item of report.items) {
      expect(typeof item.key).toBe('string');
      expect(item.key.length).toBeGreaterThan(0);
    }
  });
});

// ─── P7 Group 4: Governance / anti-advice invariants (5 tests) ────────────────

describe('P7.4 — Governance and anti-advice invariants', () => {
  it('P7.T4.1 — no coverage item has an alphaScore field', () => {
    const report = buildResearchGapsReport(makeInput());
    for (const item of report.items) {
      expect((item as Record<string, unknown>)['alphaScore']).toBeUndefined();
    }
  });

  it('P7.T4.2 — primaryLimitations per item never exceeds 3 entries', () => {
    // Degrade inputs to maximize limitation generation
    const batch = makeSignalBatch({
      results: [
        makeBatchResult({ signalType: 'topic_surging', sampleSize: 5, classification: 'NOISE', limitations: ['l1', 'l2', 'l3'] }),
      ],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
    for (const item of report.items) {
      expect(item.primaryLimitations.length).toBeLessThanOrEqual(3);
    }
  });

  it('P7.T4.3 — generatedAt is a non-empty ISO-shaped string', () => {
    const report = buildResearchGapsReport(makeInput());
    expect(typeof report.generatedAt).toBe('string');
    expect(report.generatedAt.length).toBeGreaterThan(0);
    expect(report.generatedAt).toMatch(/T/); // ISO 8601 contains 'T'
  });

  it('P7.T4.4 — all signal items have key starting with "signal:"', () => {
    const report = buildResearchGapsReport(makeInput());
    const signalItems = report.items.filter((item) => item.area === 'signal');
    expect(signalItems.length).toBeGreaterThan(0);
    for (const item of signalItems) {
      expect(item.key).toMatch(/^signal:/);
    }
  });

  it('P7.T4.5 — all topGaps have a non-empty affectedAreas array', () => {
    const report = buildResearchGapsReport(
      makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null })
    );
    expect(report.topGaps.length).toBeGreaterThan(0);
    for (const gap of report.topGaps) {
      expect(Array.isArray(gap.affectedAreas)).toBe(true);
      expect(gap.affectedAreas.length).toBeGreaterThan(0);
    }
  });
});

// ─── P7 Group 5: Edge-case paths (5 tests) ────────────────────────────────────

describe('P7.5 — Edge-case paths', () => {
  it('P7.T5.1 — walk-forward PARTIAL: one READY signal + one walk-forward-eligible signal', () => {
    // signal1: sampleSize=30 (READY), signal2: sampleSize=20 (>= 16, < 30)
    // minSample=20 >= 16 → not INSUFFICIENT_DATA
    // readyCount=1, partialCount=1 → readyCount+partialCount = batch.length → not DEGRADED
    // readyCount !== batch.length → PARTIAL
    const batch = makeSignalBatch({
      results: [
        makeBatchResult({ signalType: 'topic_surging', sampleSize: 30 }),
        makeBatchResult({ signalType: 'theme_diffusing', sampleSize: 20 }),
      ],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch }));
    const wf = report.items.find((item) => item.key === 'validation:walk_forward');
    expect(wf?.status).toBe('PARTIAL');
  });

  it('P7.T5.2 — regime DEGRADED: snapshots >= 30 but all regime breakdown counts < 5 per bucket', () => {
    // assessableSignals = 0 → DEGRADED (snapshots=50 >= 30, so not INSUFFICIENT_DATA)
    const sparseRegimeBreakdown = {
      bull: { sampleSize: 3, avgReturn: 0.02, hitRate: 0.5 },
      bear: { sampleSize: 2, avgReturn: 0.01, hitRate: 0.4 },
      neutral: { sampleSize: 1, avgReturn: 0.015, hitRate: 0.45 },
    };
    const allTypes = [
      'topic_surging', 'theme_diffusing', 'strong_alpha_candidate',
      'chip_accumulation_signal', 'risk_cluster_elevated', 'regime_shift_signal',
    ] as const;
    const batch = makeSignalBatch({
      results: allTypes.map((signalType) =>
        makeBatchResult({
          signalType,
          effectiveness: {
            signalType,
            window: 5,
            sampleSize: 30,
            hitRate: 0.6,
            avgReturn: 0.02,
            excessReturn: 0.01,
            volatility: 0.05,
            brierLikeScore: 0.15,
            regimeBreakdown: sparseRegimeBreakdown,
            persistence: { avgDuration: 1.5, continuationRate: 0.3 },
            stabilityScore: 0.75,
            classification: 'STRONG_SIGNAL',
            limitations: [],
          },
        })
      ),
    });
    const report = buildResearchGapsReport(
      makeInput({ signalBatch: batch, regimeSnapshotCount: 50 })
    );
    const regime = report.items.find((item) => item.key === 'regime:stratification');
    expect(regime?.status).toBe('DEGRADED');
  });

  it('P7.T5.3 — NOISE classification on signal with sampleSize >= 10 adds NOISE limitation text', () => {
    const batch = makeSignalBatch({
      results: [
        makeBatchResult({
          signalType: 'topic_surging',
          sampleSize: 15,
          classification: 'NOISE',
        }),
      ],
    });
    const report = buildResearchGapsReport(makeInput({ signalBatch: batch, taiexRowCount: 100 }));
    const signal = report.items.find((item) => item.key === 'signal:topic_surging');
    expect(signal).toBeDefined();
    const hasNoiseLimitation = signal!.primaryLimitations.some((l) =>
      l.includes('NOISE')
    );
    expect(hasNoiseLimitation).toBe(true);
  });

  it('P7.T5.4 — topGaps within same priority level are sorted alphabetically by key', () => {
    const report = buildResearchGapsReport(
      makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null })
    );
    const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
    for (const priority of priorities) {
      const gapsAtPriority = report.topGaps.filter((g) => g.priority === priority);
      for (let i = 1; i < gapsAtPriority.length; i++) {
        expect(gapsAtPriority[i - 1].key.localeCompare(gapsAtPriority[i].key)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('P7.T5.5 — both TAIEX gap and regime gap present in topGaps when both sources unavailable', () => {
    const report = buildResearchGapsReport(
      makeInput({ taiexRowCount: 0, regimeSnapshotCount: 0, eventSourceQuality: null })
    );
    const highGapKeys = report.topGaps
      .filter((g) => g.priority === 'HIGH')
      .map((g) => g.key);
    expect(highGapKeys).toContain('gap:taiex_unavailable');
    expect(highGapKeys).toContain('gap:no_regime_history');
  });
});
