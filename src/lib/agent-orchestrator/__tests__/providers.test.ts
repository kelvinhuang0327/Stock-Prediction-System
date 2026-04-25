import { buildColdRegimePayload } from '../providers';

describe('providers helpers', () => {
  it('buildColdRegimePayload returns a planner draft with contract and promptMarkdown', () => {
    const signalState = {
      state: 'COLD_REGIME',
      confidenceScore: 0.6,
      reason: 'test-reason',
      features: {
        overallWinRate: 0.1,
        winRateDelta: -0.06,
        penalizedSetupCount: 2,
        dataCoverage: 'partial',
        organicTradeCount: 10,
        fullTradeCount: 12,
      },
    } as any;

    const profile = { protected_paths: [], allowed_reference_paths: [] } as any;
    const draft = buildColdRegimePayload(signalState, profile);
    expect(draft).toHaveProperty('contract');
    expect(draft).toHaveProperty('promptMarkdown');
    expect(draft.plannerContext).toHaveProperty('dedupeKey');
    expect(draft.plannerContext.taskType).toBeDefined();
  });
});
