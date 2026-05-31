// src/lib/research/fixtures/StockStrategyResearchStaticFixture.ts
// P108 static, deterministic, sample-only, non-production, non-real-data fixture for strategy research page
// Aligned with P107 contract. Do not use in production or for real data.

export const STOCK_STRATEGY_RESEARCH_STATIC_FIXTURE = {
  contractVersion: 'P108-20260531-v1',
  generatedAt: '2026-05-31T00:00:00.000Z',
  dataMode: 'sample',
  strategyResearchSummary: {
    summary: 'Sample strategy research summary for demonstration only.'
  },
  strategyOverview: {
    strategyId: 'SAMPLE-STRAT-001',
    strategyName: 'Sample Mean Reversion',
    strategyVersion: 'v1.0.0',
    strategyLifecycleStatus: 'draft',
    researchOnly: true,
    validationStatus: 'simulation_only',
    simulationWindow: '2018-2023',
    validationMethod: 'Sample backtest (static, not real)',
    artifactHash: 'samplehash123456',
    artifactPath: '/artifacts/sample_strategy_report.json'
  },
  dataSourcePitMetadata: {
    sourceId: 'SAMPLE-SRC-001',
    sourceType: 'static-sample',
    asOf: '2026-05-30T00:00:00.000Z',
    availableAt: '2026-05-30T00:00:00.000Z',
    publishedAt: '2026-05-30T00:00:00.000Z',
    releaseDate: '2026-05-30T00:00:00.000Z',
    pitValidationStatus: 'valid',
    leakageGuardStatus: 'pass'
  },
  featureInputs: {
    technicalFeatures: [
      { name: 'SMA_20', type: 'number', source: 'sample', description: '20-day simple moving average' },
      { name: 'RSI_14', type: 'number', source: 'sample', description: '14-day relative strength index' }
    ],
    fundamentalFeatures: [
      { name: 'PE_Ratio', type: 'number', source: 'sample', description: 'Price to earnings ratio' }
    ],
    newsEventFeatures: [
      { name: 'NewsSentiment', type: 'string', source: 'sample', description: 'Sample news sentiment score' }
    ],
    featureAsOf: '2026-05-30T00:00:00.000Z',
    featureAvailabilityStatus: 'complete',
    excludedFutureFeatures: ['FutureEarnings', 'FutureEvents']
  },
  simulationValidationSummary: {
    samplePeriod: '2018-2023',
    trainPeriod: '2018-2020',
    validationPeriod: '2021-2022',
    outOfSamplePeriod: '2023',
    metricsAllowedForDisplay: ['sampleSharpe', 'sampleMaxDrawdown'],
    metricsForbiddenForDisplay: ['realSharpe', 'realPnL'],
    confidenceNotes: 'Sample only. Not investment advice. No real performance implied.',
    limitations: 'Static sample. Not for production or investment.'
  },
  strategyComparisonStability: {
    strategies: [
      { strategyId: 'SAMPLE-STRAT-001', name: 'Sample Mean Reversion', stabilityScore: 0.7 },
      { strategyId: 'SAMPLE-STRAT-002', name: 'Sample Momentum', stabilityScore: 0.5 }
    ],
    comparisonNotes: 'Sample comparison only. No real performance.'
  },
  riskLimitationDisclosure: {
    riskDisclosure: '本研究樣本僅供驗證與審計，不構成投資建議、操作指令或回報承諾。',
    limitationNotes: 'Static fixture. Not for production.'
  },
  auditTrailReplayTrace: {
    auditTrail: [
      { step: 1, event: '樣本建立', timestamp: '2026-05-31T00:00:00.000Z' }
    ],
    replayLinks: ['/audit/sample_replay_1']
  },
    governanceFlags: {
      researchOnly: true,
      notInvestmentAdvice: true,
      noGuaranteedReturn: true,
      noDirectBuySellHoldInstruction: true,
      noExecution: true,
      noProductionTrading: true,
      pitSafeRequired: true,
      simulationBackedBeforeDisplay: true
    }
} as const;
