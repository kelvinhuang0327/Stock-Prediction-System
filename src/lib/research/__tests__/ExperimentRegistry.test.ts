/**
 * ExperimentRegistry — Wave 8 tests
 */

import {
  buildExperimentRegistry,
  getExperimentStatusLabel,
  getExperimentStatusColor,
  getEvidenceLevelLabel,
  getEvidenceLevelColor,
  getExperimentPriorityColor,
} from '../ExperimentRegistry';
import type {
  ExperimentStatus,
  EvidenceLevel,
  ExperimentPriority,
  ExperimentRegistry,
} from '../ExperimentRegistry';
import { buildResearchGapsReport } from '../ResearchCoverageEngine';
import type { ResearchCoverageInputData, ResearchGapsReport } from '../ResearchCoverageEngine';
import type { SignalEffectivenessBatchApiResponse } from '@/lib/signals/types';
import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeSignalBatch(
  overrides: Partial<SignalEffectivenessBatchApiResponse> = {},
): SignalEffectivenessBatchApiResponse {
  const signalTypes = [
    'topic_surging',
    'theme_diffusing',
    'strong_alpha_candidate',
    'chip_accumulation_signal',
    'risk_cluster_elevated',
    'regime_shift_signal',
  ] as const;

  return {
    window: 5,
    results: signalTypes.map((t) => ({
      signalType: t,
      sampleSize: 35,
      hitRate: 0.6,
      avgReturn: 0.02,
      excessReturn: 0.01,
      stabilityScore: 0.8,
      classification: 'STRONG_SIGNAL' as const,
      limitations: [],
      effectiveness: {
        signalType: t,
        window: 5,
        sampleSize: 35,
        hitRate: 0.6,
        avgReturn: 0.02,
        excessReturn: 0.01,
        excessHitRate: 0.55,
        volatility: 0.03,
        brierLikeScore: 0.22,
        regimeBreakdown: {
          bull: { sampleSize: 15, hitRate: 0.7, avgReturn: 0.03, excessReturn: 0.015 },
          bear: { sampleSize: 10, hitRate: 0.5, avgReturn: 0.01, excessReturn: 0.005 },
          neutral: { sampleSize: 10, hitRate: 0.6, avgReturn: 0.02, excessReturn: 0.01 },
        },
        persistence: { avgDuration: 3, continuationRate: 0.6 },
        stabilityScore: 0.8,
        classification: 'STRONG_SIGNAL',
        limitations: [],
      },
    })),
    generatedAt: new Date().toISOString(),
    limitations: [],
    ...overrides,
  };
}

function makeEventSourceQuality(): EventSourceQuality {
  return {
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
  };
}

function makeInput(overrides: Partial<ResearchCoverageInputData> = {}): ResearchCoverageInputData {
  return {
    signalBatch: makeSignalBatch(),
    eventSourceQuality: makeEventSourceQuality(),
    taiexRowCount: 200,
    regimeSnapshotCount: 120,
    ...overrides,
  };
}

/** Builds a gaps report from a healthy input (all modules READY / PARTIAL). */
function makeHealthyGapsReport(): ResearchGapsReport {
  return buildResearchGapsReport(makeInput());
}

/** Builds a gaps report from a zero-data input (all modules unavailable). */
function makeZeroDataGapsReport(): ResearchGapsReport {
  return buildResearchGapsReport(
    makeInput({
      taiexRowCount: 0,
      regimeSnapshotCount: 0,
      eventSourceQuality: null,
      signalBatch: makeSignalBatch({
        results: makeSignalBatch().results.map((r) => ({
          ...r,
          sampleSize: 0,
          classification: 'NOISE' as const,
        })),
      }),
    }),
  );
}

// ─── Static mode (no gapsReport) ─────────────────────────────────────────────

describe('buildExperimentRegistry — static mode (no gapsReport)', () => {
  let registry: ExperimentRegistry;

  beforeAll(() => {
    registry = buildExperimentRegistry();
  });

  it('returns exactly 7 seed experiments', () => {
    expect(registry.experiments).toHaveLength(7);
  });

  it('all experiments have required fields', () => {
    for (const exp of registry.experiments) {
      expect(exp.id).toBeTruthy();
      expect(exp.title).toBeTruthy();
      expect(exp.hypothesis).toBeTruthy();
      expect(exp.status).toBeTruthy();
      expect(exp.evidenceLevel).toBeTruthy();
      expect(exp.priority).toBeTruthy();
      expect(Array.isArray(exp.linkedModules)).toBe(true);
      expect(Array.isArray(exp.blockers)).toBe(true);
      expect(Array.isArray(exp.requiredData)).toBe(true);
      expect(Array.isArray(exp.successCriteria)).toBe(true);
      expect(Array.isArray(exp.currentFindings)).toBe(true);
      expect(exp.lastUpdated).toBeTruthy();
    }
  });

  it('summary total matches experiments.length', () => {
    expect(registry.summary.total).toBe(registry.experiments.length);
  });

  it('summary counts sum to total', () => {
    const { summary } = registry;
    const sum =
      summary.idea +
      summary.ready +
      summary.running +
      summary.blocked +
      summary.partial +
      summary.validated +
      summary.rejected +
      summary.deferred;
    expect(sum).toBe(summary.total);
  });

  it('generatedAt is a valid ISO date string', () => {
    expect(() => new Date(registry.generatedAt)).not.toThrow();
    expect(new Date(registry.generatedAt).toISOString()).toBe(registry.generatedAt);
  });

  it('no experiment is VALIDATED in static mode (no evidence yet)', () => {
    const validated = registry.experiments.filter((e) => e.status === 'VALIDATED');
    expect(validated).toHaveLength(0);
  });
});

// ─── Enriched mode (with healthy gapsReport) ─────────────────────────────────

describe('buildExperimentRegistry — enriched mode (healthy gapsReport)', () => {
  let registry: ExperimentRegistry;

  beforeAll(() => {
    registry = buildExperimentRegistry(makeHealthyGapsReport());
  });

  it('still returns exactly 7 experiments', () => {
    expect(registry.experiments).toHaveLength(7);
  });

  it('generatedAt matches gapsReport.generatedAt', () => {
    const gaps = makeHealthyGapsReport();
    const reg = buildExperimentRegistry(gaps);
    expect(reg.generatedAt).toBe(gaps.generatedAt);
  });

  it('regime-history-coverage has structural blocker in static blockers', () => {
    const exp = registry.experiments.find((e) => e.id === 'regime-history-coverage');
    expect(exp).toBeDefined();
    // The static blocker should always be present
    expect(exp!.blockers.some((b) => b.toLowerCase().includes('dailymarketsnapshot'))).toBe(true);
  });

  it('event-source-persistence always BLOCKED (structural)', () => {
    const exp = registry.experiments.find((e) => e.id === 'event-source-persistence');
    expect(exp).toBeDefined();
    // defaultStatus is BLOCKED regardless of live data
    expect(exp!.status).toBe('BLOCKED');
  });

  it('confidence-outcome-collection always BLOCKED (structural)', () => {
    const exp = registry.experiments.find((e) => e.id === 'confidence-outcome-collection');
    expect(exp).toBeDefined();
    expect(exp!.status).toBe('BLOCKED');
  });
});

// ─── Enriched mode (with zero-data gapsReport — many HIGH gaps) ───────────────

describe('buildExperimentRegistry — enriched mode (zero-data / many gaps)', () => {
  let registry: ExperimentRegistry;
  let zeroGaps: ResearchGapsReport;

  beforeAll(() => {
    zeroGaps = makeZeroDataGapsReport();
    registry = buildExperimentRegistry(zeroGaps);
  });

  it('label-redesign-validation is downgraded IDEA→BLOCKED when signal sample HIGH gap active', () => {
    const exp = registry.experiments.find((e) => e.id === 'label-redesign-validation');
    expect(exp).toBeDefined();
    // gap:taiex_unavailable and gap:signal_insufficient_sample are HIGH when taiexRowCount=0
    expect(exp!.status).toBe('BLOCKED');
  });

  it('walkforward-sample-sufficiency is downgraded IDEA→BLOCKED when signal sample HIGH gap active', () => {
    const exp = registry.experiments.find((e) => e.id === 'walkforward-sample-sufficiency');
    expect(exp).toBeDefined();
    expect(exp!.status).toBe('BLOCKED');
  });

  it('regime-history-coverage has gap findings appended to currentFindings', () => {
    const exp = registry.experiments.find((e) => e.id === 'regime-history-coverage');
    expect(exp).toBeDefined();
    // When gap:no_regime_history is in topGaps, its reason should appear in findings
    const hasGapFinding = exp!.currentFindings.some((f) => f.startsWith('[Wave 7 Gap]'));
    expect(hasGapFinding).toBe(true);
  });

  it('experiments linked to gap:signal_insufficient_sample get gap findings', () => {
    const ids = ['label-redesign-validation', 'walkforward-sample-sufficiency', 'signal-disagreement-effectiveness'];
    for (const id of ids) {
      const exp = registry.experiments.find((e) => e.id === id);
      expect(exp).toBeDefined();
      const hasGapFinding = exp!.currentFindings.some((f) => f.startsWith('[Wave 7 Gap]'));
      expect(hasGapFinding).toBe(true);
    }
  });

  it('no experiment is VALIDATED in zero-data mode', () => {
    const validated = registry.experiments.filter((e) => e.status === 'VALIDATED');
    expect(validated).toHaveLength(0);
  });
});

// ─── Evidence level enrichment ────────────────────────────────────────────────

describe('buildExperimentRegistry — evidence level enrichment', () => {
  it('returns NEEDS_DATA for regime experiment when regimeSnapshotCount=0', () => {
    const reg = buildExperimentRegistry(makeZeroDataGapsReport());
    const exp = reg.experiments.find((e) => e.id === 'regime-history-coverage');
    expect(exp).toBeDefined();
    expect(exp!.evidenceLevel).toBe('NEEDS_DATA');
  });

  it('returns VERIFIED for label-redesign when all signal items are READY', () => {
    // Healthy gaps report has all signal items READY (sampleSize=35)
    const reg = buildExperimentRegistry(makeHealthyGapsReport());
    const exp = reg.experiments.find((e) => e.id === 'label-redesign-validation');
    expect(exp).toBeDefined();
    // defaultEvidenceLevel is NEEDS_DATA, but READY coverage items should upgrade it
    expect(exp!.evidenceLevel).toBe('VERIFIED');
  });

  it('uses defaultEvidenceLevel when gapsReport is null', () => {
    const reg = buildExperimentRegistry(null);
    const exp = reg.experiments.find((e) => e.id === 'signal-disagreement-effectiveness');
    expect(exp).toBeDefined();
    // defaultEvidenceLevel for signal-disagreement is UNVERIFIED
    expect(exp!.evidenceLevel).toBe('UNVERIFIED');
  });

  it('UNVERIFIED seed can be upgraded to INFERRED (not VERIFIED) by coverage data', () => {
    const reg = buildExperimentRegistry(makeHealthyGapsReport());
    const exp = reg.experiments.find((e) => e.id === 'signal-disagreement-effectiveness');
    expect(exp).toBeDefined();
    // UNVERIFIED + READY coverage → INFERRED (not VERIFIED, as per deriveEvidenceLevel)
    expect(exp!.evidenceLevel).toBe('INFERRED');
  });
});

// ─── Degraded mode (null gapsReport) ─────────────────────────────────────────

describe('buildExperimentRegistry — degraded mode (null)', () => {
  let registry: ExperimentRegistry;

  beforeAll(() => {
    registry = buildExperimentRegistry(null);
  });

  it('returns a complete registry with 7 experiments', () => {
    expect(registry.experiments).toHaveLength(7);
  });

  it('summary total equals 7', () => {
    expect(registry.summary.total).toBe(7);
  });

  it('no experiment is VALIDATED (no evidence without live data)', () => {
    const validated = registry.experiments.filter((e) => e.status === 'VALIDATED');
    expect(validated).toHaveLength(0);
  });

  it('no currentFindings contain [Wave 7 Gap] prefix (no enrichment)', () => {
    for (const exp of registry.experiments) {
      const hasGapFinding = exp.currentFindings.some((f) => f.startsWith('[Wave 7 Gap]'));
      expect(hasGapFinding).toBe(false);
    }
  });

  it('structurally BLOCKED experiments remain BLOCKED', () => {
    const alwaysBlocked = ['event-source-persistence', 'confidence-outcome-collection', 'regime-history-coverage'];
    for (const id of alwaysBlocked) {
      const exp = registry.experiments.find((e) => e.id === id);
      expect(exp).toBeDefined();
      expect(exp!.status).toBe('BLOCKED');
    }
  });
});

// ─── Seed completeness ────────────────────────────────────────────────────────

describe('seed experiment completeness', () => {
  let registry: ExperimentRegistry;

  beforeAll(() => {
    registry = buildExperimentRegistry();
  });

  it('all IDs are unique', () => {
    const ids = registry.experiments.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every experiment has a non-empty hypothesis', () => {
    for (const exp of registry.experiments) {
      expect(exp.hypothesis.length).toBeGreaterThan(0);
    }
  });

  it('every experiment has at least one successCriteria', () => {
    for (const exp of registry.experiments) {
      expect(exp.successCriteria.length).toBeGreaterThan(0);
    }
  });

  it('every experiment has at least one requiredData entry', () => {
    for (const exp of registry.experiments) {
      expect(exp.requiredData.length).toBeGreaterThan(0);
    }
  });

  it('every experiment has at least one linkedModule', () => {
    for (const exp of registry.experiments) {
      expect(exp.linkedModules.length).toBeGreaterThan(0);
    }
  });

  it('every experiment has at least one static finding', () => {
    for (const exp of registry.experiments) {
      // Static findings come from staticFindings in the seed; should never be empty
      expect(exp.currentFindings.length).toBeGreaterThan(0);
    }
  });

  it('IDs follow kebab-case convention', () => {
    for (const exp of registry.experiments) {
      expect(exp.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

// ─── Badge helpers ────────────────────────────────────────────────────────────

describe('getExperimentStatusLabel', () => {
  const cases: [ExperimentStatus, string][] = [
    ['IDEA', '構想'],
    ['READY', '可執行'],
    ['RUNNING', '進行中'],
    ['BLOCKED', '受阻'],
    ['PARTIAL', '部分完成'],
    ['VALIDATED', '已驗證'],
    ['REJECTED', '已否決'],
    ['DEFERRED', '延後'],
  ];

  it.each(cases)('%s → %s', (status, expected) => {
    expect(getExperimentStatusLabel(status)).toBe(expected);
  });
});

describe('getExperimentStatusColor', () => {
  it('returns a string for every status', () => {
    const statuses: ExperimentStatus[] = [
      'IDEA', 'READY', 'RUNNING', 'BLOCKED', 'PARTIAL', 'VALIDATED', 'REJECTED', 'DEFERRED',
    ];
    for (const s of statuses) {
      expect(typeof getExperimentStatusColor(s)).toBe('string');
      expect(getExperimentStatusColor(s).length).toBeGreaterThan(0);
    }
  });

  it('BLOCKED returns red class', () => {
    expect(getExperimentStatusColor('BLOCKED')).toContain('red');
  });

  it('VALIDATED returns emerald class', () => {
    expect(getExperimentStatusColor('VALIDATED')).toContain('emerald');
  });

  it('READY returns green class', () => {
    expect(getExperimentStatusColor('READY')).toContain('green');
  });
});

describe('getEvidenceLevelLabel', () => {
  const cases: [EvidenceLevel, string][] = [
    ['VERIFIED', '已驗證'],
    ['INFERRED', '推斷'],
    ['NEEDS_DATA', '待資料'],
    ['UNVERIFIED', '未驗證'],
  ];

  it.each(cases)('%s → %s', (level, expected) => {
    expect(getEvidenceLevelLabel(level)).toBe(expected);
  });
});

describe('getEvidenceLevelColor', () => {
  it('returns a string for every evidence level', () => {
    const levels: EvidenceLevel[] = ['VERIFIED', 'INFERRED', 'NEEDS_DATA', 'UNVERIFIED'];
    for (const l of levels) {
      expect(typeof getEvidenceLevelColor(l)).toBe('string');
      expect(getEvidenceLevelColor(l).length).toBeGreaterThan(0);
    }
  });

  it('VERIFIED returns emerald', () => {
    expect(getEvidenceLevelColor('VERIFIED')).toContain('emerald');
  });

  it('NEEDS_DATA returns orange', () => {
    expect(getEvidenceLevelColor('NEEDS_DATA')).toContain('orange');
  });
});

describe('getExperimentPriorityColor', () => {
  const cases: [ExperimentPriority, string][] = [
    ['HIGH', 'red'],
    ['MEDIUM', 'amber'],
    ['LOW', 'slate'],
  ];

  it.each(cases)('%s → contains %s', (priority, colorFragment) => {
    expect(getExperimentPriorityColor(priority)).toContain(colorFragment);
  });
});
