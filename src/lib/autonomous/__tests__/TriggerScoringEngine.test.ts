/**
 * TriggerScoringEngine — Soft trigger scoring tests
 */

import {
  scoreTriggerReadiness,
  shadowSetupThresholds,
  tradeModePositionMultiplier,
} from '../TriggerScoringEngine';
import type { QuoteRow } from '../TriggerScoringEngine';
import type { AutonomousResearchSnapshot, StrategyProposal } from '../types';
import type { OptimizationInsightRecord } from '../InsightIntegrationLayer';

function makeQuotes(count: number, overrides?: Partial<QuoteRow>[]): QuoteRow[] {
  const base: QuoteRow[] = [];
  for (let i = 0; i < count; i++) {
    base.push({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      open: 100 + i * 0.5,
      high: 102 + i * 0.5,
      low: 99 + i * 0.3,
      close: 101 + i * 0.5,
      volume: 10000 + i * 100,
      change: 0.5,
      ...(overrides?.[i] ?? {}),
    });
  }
  return base;
}

function makeSnapshot(overrides: Partial<AutonomousResearchSnapshot> = {}): AutonomousResearchSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    snapshotDate: '2026-03-27',
    marketState: 'trending',
    marketRegime: 'Bull',
    marketRegimeConfidence: 0.8,
    sectorStrength: [],
    candidateStocks: [],
    riskSignals: [],
    topInsights: [],
    dataCoverage: 'full',
    limitations: [],
    ...overrides,
  };
}

function makeProposal(overrides: Partial<StrategyProposal> = {}): StrategyProposal {
  return {
    symbol: '2330',
    setupType: 'trend',
    thesis: '測試提案',
    entryCondition: '條件',
    invalidationCondition: '失效',
    stopLossRule: '停損',
    takeProfitRule: '停利',
    positionSizing: 0.08,
    conviction: 'high',
    supportingSignals: ['technical'],
    riskFactors: ['volatility'],
    state: 'proposed',
    ...overrides,
  };
}

function makeInsight(confidence: number, overrides: Partial<OptimizationInsightRecord> = {}): OptimizationInsightRecord {
  return {
    insightType: 'score_bias',
    sourceTaskId: 'task-1',
    evidence: ['narrow score range', 'small sample'],
    confidence,
    severity: 'high',
    affectedSetupTypes: ['trend'],
    affectedSymbols: ['2330'],
    expiresAt: '2099-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TriggerScoringEngine', () => {
  describe('scoreTriggerReadiness', () => {
    it('returns 0 score when quotes < 20', () => {
      const result = scoreTriggerReadiness(
        makeProposal(),
        makeQuotes(10),
        makeSnapshot(),
      );
      expect(result.finalScore).toBe(0);
      expect(result.tradeMode).toBe('none');
    });

    it('scores trend setup with favorable conditions to full', () => {
      // Trending market, close above MA20, positive returns
      const quotes = makeQuotes(25);
      const result = scoreTriggerReadiness(
        makeProposal({ setupType: 'trend' }),
        quotes,
        makeSnapshot({ marketState: 'trending' }),
      );

      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.regimeMultiplier).toBe(1.0);
      expect(result.components.length).toBe(5);
      // With trending market and upward quotes, should score high
      expect(result.tradeMode).not.toBe('none');
    });

    it('scores trend setup in defensive market — reduced but not zero', () => {
      const quotes = makeQuotes(25);
      const result = scoreTriggerReadiness(
        makeProposal({ setupType: 'trend' }),
        quotes,
        makeSnapshot({ marketState: 'defensive' }),
      );

      expect(result.regimeMultiplier).toBe(0.65);
      // Should still have a non-zero score (defensive is no longer a hard block)
      expect(result.finalScore).toBeGreaterThan(0);
      // But score is reduced enough to not be 'full'
      expect(result.finalScore).toBeLessThan(result.rawScore);
    });

    it('scores rebound setup with partial conditions — produces shadow', () => {
      // Quotes with a recent dip and partial recovery
      const quotes = makeQuotes(25);
      // Make a dip in the last 5 days
      quotes[20] = { ...quotes[20], low: 95, close: 96 };
      quotes[21] = { ...quotes[21], low: 94, close: 95 };
      quotes[22] = { ...quotes[22], low: 93, close: 94 };
      quotes[23] = { ...quotes[23], low: 93.5, close: 95 };
      quotes[24] = { ...quotes[24], low: 94, close: 96, volume: 15000 };

      const result = scoreTriggerReadiness(
        makeProposal({ setupType: 'rebound' }),
        quotes,
        makeSnapshot({ marketState: 'defensive' }),
      );

      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.components.some((c) => c.name === 'bounce_from_low')).toBe(true);
    });

    it('bootstrap mode lowers thresholds', () => {
      const quotes = makeQuotes(25);
      const snapshot = makeSnapshot({ marketState: 'defensive' });
      const proposal = makeProposal({ setupType: 'rebound' });

      const normalResult = scoreTriggerReadiness(proposal, quotes, snapshot, { bootstrapMode: false });
      const bootstrapResult = scoreTriggerReadiness(proposal, quotes, snapshot, { bootstrapMode: true });

      // Same final score, but different trade mode due to lower thresholds
      expect(bootstrapResult.finalScore).toBe(normalResult.finalScore);
      expect(bootstrapResult.bootstrapActive).toBe(true);

      // Bootstrap should be more likely to produce a trade mode
      if (normalResult.tradeMode === 'none' && normalResult.finalScore >= 0.1) {
        expect(bootstrapResult.tradeMode).not.toBe('none');
      }
    });

    it('event setup scores with risk signals', () => {
      const quotes = makeQuotes(25);
      const result = scoreTriggerReadiness(
        makeProposal({ setupType: 'event' }),
        quotes,
        makeSnapshot({ riskSignals: ['法人大量賣超事件', '外資連續減碼'] }),
      );

      const signalComponent = result.components.find((c) => c.name === 'risk_signals_present');
      expect(signalComponent).toBeDefined();
      expect(signalComponent!.met).toBe(true);
      expect(signalComponent!.score).toBe(0.35);
    });

    it('fundamental setup scores conviction', () => {
      const quotes = makeQuotes(25);

      const highResult = scoreTriggerReadiness(
        makeProposal({ setupType: 'fundamental', conviction: 'high' }),
        quotes,
        makeSnapshot(),
      );
      const lowResult = scoreTriggerReadiness(
        makeProposal({ setupType: 'fundamental', conviction: 'low' }),
        quotes,
        makeSnapshot(),
      );

      const highConv = highResult.components.find((c) => c.name === 'high_conviction');
      const lowConv = lowResult.components.find((c) => c.name === 'high_conviction');
      expect(highConv!.score).toBeGreaterThan(lowConv!.score);
    });

    it('finalScore never exceeds 1.0', () => {
      const quotes = makeQuotes(30);
      const result = scoreTriggerReadiness(
        makeProposal({ setupType: 'trend' }),
        quotes,
        makeSnapshot({ marketState: 'trending' }),
      );
      expect(result.finalScore).toBeLessThanOrEqual(1.0);
      expect(result.rawScore).toBeLessThanOrEqual(1.0);
    });

    it('covers recovery and range-bound regime multipliers and defaults unknown setups to fundamental scoring', () => {
      const quotes = makeQuotes(25);
      const proposal = makeProposal({ setupType: 'trend' });
      const recovery = scoreTriggerReadiness(proposal, quotes, makeSnapshot({ marketState: 'recovery' }));
      const rangeBound = scoreTriggerReadiness(proposal, quotes, makeSnapshot({ marketState: '震盪' }));
      expect(recovery.regimeMultiplier).toBe(0.9);
      expect(rangeBound.regimeMultiplier).toBe(0.8);

      const unknownSetup = scoreTriggerReadiness(
        makeProposal({ setupType: 'unknown' as StrategyProposal['setupType'], conviction: 'mid' }),
        quotes,
        makeSnapshot({ dataCoverage: 'limited' }),
      );
      expect(unknownSetup.components.map((component) => component.name)).toContain('high_conviction');
      expect(unknownSetup.components.find((component) => component.name === 'data_coverage_full')?.score).toBe(0.1);
    });

    it('scores marginal and declining trend inputs with and without volume confirmation', () => {
      const positive = makeQuotes(25);
      positive[24] = { ...positive[24], volume: 40_000 };
      const confirmed = scoreTriggerReadiness(makeProposal(), positive, makeSnapshot());
      expect(confirmed.components.find((component) => component.name === 'volume_confirmation')?.met).toBe(true);

      const declining = makeQuotes(25);
      declining[24] = { ...declining[24], close: 108, volume: 1 };
      const weak = scoreTriggerReadiness(makeProposal(), declining, makeSnapshot({ marketState: 'defensive' }));
      expect(weak.components.find((component) => component.name === 'price_above_ma20')?.score).toBeGreaterThanOrEqual(0);
      expect(weak.components.find((component) => component.name === 'ret5_positive')?.met).toBe(false);
      expect(weak.components.find((component) => component.name === 'volume_confirmation')?.met).toBe(false);
    });

    it('covers rebound strict, relaxed, and failed thresholds', () => {
      const relaxedQuotes = makeQuotes(25);
      for (let index = 20; index < 25; index++) relaxedQuotes[index] = { ...relaxedQuotes[index], low: 100 };
      relaxedQuotes[24] = { ...relaxedQuotes[24], close: 100.6 };
      const relaxed = scoreTriggerReadiness(makeProposal({ setupType: 'rebound' }), relaxedQuotes, makeSnapshot());
      expect(relaxed.components.find((component) => component.name === 'bounce_from_low')?.score).toBe(0.15);

      const extendedQuotes = makeQuotes(25);
      for (let index = 20; index < 25; index++) {
        extendedQuotes[index] = { ...extendedQuotes[index], close: 120, low: 120, volume: 0 };
      }
      const extended = scoreTriggerReadiness(makeProposal({ setupType: 'rebound' }), extendedQuotes, makeSnapshot());
      expect(extended.components.find((component) => component.name === 'bounce_from_low')?.score).toBe(0);
      expect(extended.components.find((component) => component.name === 'drawdown_contained')?.met).toBe(false);
      expect(extended.components.find((component) => component.name === 'volume_recovery')?.met).toBe(false);
    });

    it('scores missing event/fundamental evidence conservatively', () => {
      const declining = makeQuotes(25);
      declining[24] = { ...declining[24], close: 90, volume: 0 };
      const event = scoreTriggerReadiness(
        makeProposal({ setupType: 'event' }), declining,
        makeSnapshot({ marketState: 'defensive', dataCoverage: 'none', riskSignals: [] }),
      );
      expect(event.components.find((component) => component.name === 'risk_signals_present')?.met).toBe(false);
      expect(event.components.find((component) => component.name === 'not_deeply_negative')?.met).toBe(false);
      expect(event.components.find((component) => component.name === 'data_coverage')?.met).toBe(false);

      const fundamental = scoreTriggerReadiness(
        makeProposal({ setupType: 'fundamental', conviction: 'low' }), declining,
        makeSnapshot({ dataCoverage: 'none' }),
      );
      expect(fundamental.components.find((component) => component.name === 'high_conviction')?.score).toBe(0);
      expect(fundamental.components.find((component) => component.name === 'data_coverage_full')?.score).toBe(0);
    });

    it('applies strong insight sizing and gates matching critical setups', () => {
      const proposal = makeProposal({ setupType: 'trend' });
      const quotes = makeQuotes(25);
      const snapshot = makeSnapshot();
      const adjusted = scoreTriggerReadiness(proposal, quotes, snapshot, { insights: [makeInsight(0.8)] });
      expect(adjusted.gated).toBe(false);
      expect(adjusted.insightSizingMultiplier).toBe(0.5);
      expect(adjusted.components.some((component) => component.name === 'insight_adjustment')).toBe(true);

      const gated = scoreTriggerReadiness(proposal, quotes, snapshot, { insights: [makeInsight(0.99)] });
      expect(gated.gated).toBe(true);
      expect(gated.tradeMode).toBe('none');
      expect(gated.gatingReason).toContain('[HARD GATE] score_bias');

      const otherSetup = scoreTriggerReadiness(
        makeProposal({ setupType: 'event' }), quotes, snapshot,
        { insights: [makeInsight(0.99)] },
      );
      expect(otherSetup.gated).toBe(false);
    });
  });

  describe('shadowSetupThresholds', () => {
    it('returns tighter thresholds than normal', () => {
      const shadow = shadowSetupThresholds('trend');
      expect(shadow.target).toBeLessThan(0.08);
      expect(shadow.stop).toBeGreaterThan(-0.06);
      expect(shadow.maxHoldDays).toBeLessThan(15);
      expect(shadow.reviewThreshold).toBe(3);
    });

    it('covers all setup types', () => {
      for (const setup of ['trend', 'rebound', 'event', 'fundamental'] as const) {
        const t = shadowSetupThresholds(setup);
        expect(t.target).toBeGreaterThan(0);
        expect(t.stop).toBeLessThan(0);
        expect(t.maxHoldDays).toBeGreaterThan(0);
      }
    });
  });

  describe('tradeModePositionMultiplier', () => {
    it('full = 1.0, pending = 0.5, shadow = 0.3, none = 0', () => {
      expect(tradeModePositionMultiplier('full')).toBe(1.0);
      expect(tradeModePositionMultiplier('pending')).toBe(0.5);
      expect(tradeModePositionMultiplier('shadow')).toBe(0.3);
      expect(tradeModePositionMultiplier('none')).toBe(0);
    });
  });
});
