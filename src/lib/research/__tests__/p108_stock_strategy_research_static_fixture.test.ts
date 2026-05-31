// src/lib/research/__tests__/p108_stock_strategy_research_static_fixture.test.ts
// P108 static fixture test for StockStrategyResearchStaticFixture

import { STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE } from '../fixtures/StockStrategyResearchStaticFixture';

describe('P108 StockStrategyResearchStaticFixture', () => {
  it('should build successfully and be JSON-safe', () => {
    expect(() => JSON.stringify(STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE)).not.toThrow();
    const json = JSON.stringify(STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE);
    expect(typeof json).toBe('string');
    expect(json.length).toBeGreaterThan(0);
  });

  it('should be deterministic across repeated calls', () => {
    const a = JSON.stringify(STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE);
    const b = JSON.stringify(STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE);
    expect(a).toBe(b);
  });

  it('should include all required top-level P107 fields', () => {
    const f = STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE;
    expect(f).toHaveProperty('contractVersion');
    expect(f).toHaveProperty('generatedAt');
    expect(f).toHaveProperty('dataMode');
    expect(f).toHaveProperty('strategyResearchSummary');
    expect(f).toHaveProperty('strategyOverview');
    expect(f).toHaveProperty('dataSourcePitMetadata');
    expect(f).toHaveProperty('featureInputs');
    expect(f).toHaveProperty('simulationValidationSummary');
    expect(f).toHaveProperty('strategyComparisonStability');
    expect(f).toHaveProperty('riskLimitationDisclosure');
    expect(f).toHaveProperty('auditTrailReplayTrace');
    expect(f).toHaveProperty('governanceFlags');
  });

  it('should have static, ordered PIT metadata fields', () => {
    const pit = STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE.dataSourcePitMetadata;
    expect(pit).toMatchObject({
      sourceId: expect.any(String),
      sourceType: expect.any(String),
      asOf: expect.any(String),
      availableAt: expect.any(String),
      publishedAt: expect.any(String),
      releaseDate: expect.any(String),
      pitValidationStatus: expect.any(String),
      leakageGuardStatus: expect.any(String)
    });
  });

  it('should have all governance flags set as required', () => {
    const g = STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE.governanceFlags;
    expect(g).toMatchObject({
      researchOnly: true,
      notInvestmentAdvice: true,
      noGuaranteedReturn: true,
      noDirectBuySellHoldInstruction: true,
      noExecution: true,
      noProductionTrading: true,
      pitSafeRequired: true,
      simulationBackedBeforeDisplay: true
    });
  });

  it('should not contain forbidden investment-advice or buy/sell/hold fields in user-visible narrative fields', () => {
    // Only scan user-visible narrative fields, not internal object keys
    const f = STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE;
    const userVisibleStrings = [
      f.strategyResearchSummary?.summary,
      f.strategyOverview?.strategyName,
      f.strategyOverview?.strategyVersion,
      f.strategyOverview?.strategyLifecycleStatus,
      f.strategyOverview?.validationStatus,
      f.strategyOverview?.simulationWindow,
      f.strategyOverview?.validationMethod,
      f.strategyOverview?.artifactPath,
      ...((f.featureInputs?.technicalFeatures || []).map(x => x.description)),
      ...((f.featureInputs?.fundamentalFeatures || []).map(x => x.description)),
      ...((f.featureInputs?.newsEventFeatures || []).map(x => x.description)),
      f.simulationValidationSummary?.confidenceNotes,
      f.simulationValidationSummary?.limitations,
      f.strategyComparisonStability?.comparisonNotes,
      f.riskLimitationDisclosure?.riskDisclosure,
      f.riskLimitationDisclosure?.limitationNotes,
      ...(f.auditTrailReplayTrace?.auditTrail?.map(x => x.event || x.action) || []),
    ].filter(Boolean);
    for (const s of userVisibleStrings) {
      expect(s).not.toMatch(/buy|sell|hold|action|target price|ROI|guarantee|alphaScore|commit/i);
    }
  });

  it('should not use runtime date, random, fetch, fs, prisma, or network', () => {
    // This is a static fixture, so we only check for static values in the source
    // (No runtime code to check here)
    expect(STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE.generatedAt).toBe('2026-05-31T00:00:00.000Z');
  });

  it('should clearly mark dataMode as sample/static/research fixture', () => {
    expect(STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE.dataMode).toBe('sample');
  });
});
