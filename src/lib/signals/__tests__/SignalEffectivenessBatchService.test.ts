import { ALL_SIGNAL_TYPES, type SignalEffectiveness } from '../types';
import {
  buildDegradedSignalEffectivenessBatch,
  buildSignalEffectivenessBatch,
} from '../SignalEffectivenessBatchService';
import { buildAllSignalHistories } from '../SignalHistoryBuilder';
import { evaluateAllSignals } from '../SignalEffectivenessEngine';

jest.mock('../SignalHistoryBuilder', () => ({
  buildAllSignalHistories: jest.fn(),
}));

jest.mock('../SignalEffectivenessEngine', () => ({
  evaluateAllSignals: jest.fn(),
}));

function makeEffectiveness(
  signalType: (typeof ALL_SIGNAL_TYPES)[number],
  overrides: Partial<SignalEffectiveness> = {},
): SignalEffectiveness {
  return {
    signalType,
    window: 5,
    sampleSize: 12,
    hitRate: 0.58,
    avgReturn: 0.021,
    excessReturn: 0.013,
    volatility: 0.04,
    regimeBreakdown: {},
    persistence: { avgDuration: 1.4, continuationRate: 0.2 },
    stabilityScore: 0.67,
    classification: 'WEAK_SIGNAL',
    limitations: [],
    ...overrides,
  };
}

describe('SignalEffectivenessBatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all supported signals in one batch response', async () => {
    (buildAllSignalHistories as jest.Mock).mockResolvedValue(
      ALL_SIGNAL_TYPES.map((signalType) => ({
        signalType,
        observations: [],
        limitations: [],
      })),
    );
    (evaluateAllSignals as jest.Mock).mockResolvedValue(
      ALL_SIGNAL_TYPES.map((signalType) => makeEffectiveness(signalType, { window: 10 })),
    );

    const result = await buildSignalEffectivenessBatch({ window: 10 });

    expect(result.window).toBe(10);
    expect(result.results).toHaveLength(ALL_SIGNAL_TYPES.length);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        signalType: ALL_SIGNAL_TYPES[0],
        sampleSize: 12,
        hitRate: 0.58,
        avgReturn: 0.021,
        excessReturn: 0.013,
        stabilityScore: 0.67,
        classification: 'WEAK_SIGNAL',
        effectiveness: expect.objectContaining({
          signalType: ALL_SIGNAL_TYPES[0],
          window: 10,
        }),
      }),
    );
  });

  it('adds symbol-level limitations when a signal has no matching observations', async () => {
    (buildAllSignalHistories as jest.Mock).mockResolvedValue(
      ALL_SIGNAL_TYPES.map((signalType) => ({
        signalType,
        observations:
          signalType === 'strong_alpha_candidate'
            ? [
                {
                  signalType,
                  symbol: '2330',
                  date: '2026-03-01',
                  context: {},
                },
              ]
            : [],
        limitations: [],
      })),
    );
    (evaluateAllSignals as jest.Mock).mockImplementation(async (histories) =>
      histories.map((history: { signalType: (typeof ALL_SIGNAL_TYPES)[number]; limitations: string[] }) =>
        makeEffectiveness(history.signalType, {
          sampleSize: history.signalType === 'strong_alpha_candidate' ? 12 : 0,
          classification: history.signalType === 'strong_alpha_candidate' ? 'WEAK_SIGNAL' : 'NOISE',
          limitations: history.limitations,
        }),
      ),
    );

    const result = await buildSignalEffectivenessBatch({ symbol: '1101', window: 5 });

    expect(result.symbol).toBe('1101');
    expect(
      result.results.find((item) => item.signalType === 'strong_alpha_candidate')?.limitations,
    ).toContain('symbol=1101 無對應訊號觀察');
  });

  it('builds a full degraded response when data is unavailable', () => {
    const result = buildDegradedSignalEffectivenessBatch(
      3,
      '2330',
      '訊號有效性批次計算失敗（已降級）',
    );

    expect(result.window).toBe(3);
    expect(result.symbol).toBe('2330');
    expect(result.results).toHaveLength(ALL_SIGNAL_TYPES.length);
    expect(result.results.every((item) => item.classification === 'NOISE')).toBe(true);
    expect(
      result.results.every((item) => item.effectiveness.classification === 'NOISE'),
    ).toBe(true);
    expect(result.limitations).toContain('訊號有效性批次計算失敗（已降級）');
  });
});
