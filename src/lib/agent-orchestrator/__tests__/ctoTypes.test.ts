import * as types from '../ctoTypes';

describe('ctoTypes constants and shapes', () => {
  it('has CTO_DECISION_SEVERITY and URGENCY mappings for known decisions', () => {
    const decisions = ['ACCEPTED_FOR_LEARNING','REJECTED_ADJUST_SIGNAL','DEFERRED_REGIME_MISMATCH','REFLECTED_IN_INSIGHT'];
    for (const d of decisions) {
      expect(types.CTO_DECISION_SEVERITY[d as keyof typeof types.CTO_DECISION_SEVERITY]).toBeDefined();
      expect(types.CTO_DECISION_URGENCY[d as keyof typeof types.CTO_DECISION_URGENCY]).toBeDefined();
    }
  });

  it('exports execution policy constants used elsewhere', () => {
    expect(types.POLICY_HIGH_POOL_RATIO).toBeGreaterThan(0);
    expect(types.CATEGORY_MAX_CONSECUTIVE).toBeGreaterThan(0);
  });
});
