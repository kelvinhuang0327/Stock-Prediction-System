// P26ECorpusExpansionReadinessClassifierUtils.ts
// ZERO external imports — pure functions only.

export function classifyMonthlyRevenueExpansionReadiness(
  sourceMapping: object,
  coverageRatio: number,
  _pitStatus: string
): string {
  const sm = sourceMapping as {
    sourceState: string;
    pitGateField?: string | null;
  };

  if (sm.sourceState === 'MISSING_SOURCE') {
    return 'BLOCKED_BY_MISSING_SOURCE';
  }

  if (sm.sourceState === 'REAL_DATA_READY' && coverageRatio > 0) {
    return 'READY_FOR_EXPANSION_IMPLEMENTATION';
  }

  if (sm.sourceState === 'REAL_DATA_PRESENT_BUT_NOT_MAPPED' && sm.pitGateField) {
    return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
  }

  if (coverageRatio === 0 && sm.sourceState !== 'REAL_DATA_READY') {
    return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
  }

  return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
}

export function classifyNewsEventExpansionReadiness(
  sourceMapping: object,
  _coverageRatio: number,
  _pitStatus: string
): string {
  const sm = sourceMapping as {
    sourceState: string;
    fixtureFileFound?: boolean;
    realSourceCandidates?: string[];
  };

  const isFixtureOnly =
    sm.sourceState === 'FIXTURE_ONLY' ||
    (sm.fixtureFileFound === true && (!sm.realSourceCandidates || sm.realSourceCandidates.length === 0));

  if (isFixtureOnly) return 'FIXTURE_ONLY_NOT_READY';

  if (
    sm.sourceState === 'REAL_DATA_PRESENT_BUT_NOT_MAPPED' ||
    (sm.realSourceCandidates && sm.realSourceCandidates.length > 0)
  ) {
    return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
  }

  return 'FIXTURE_ONLY_NOT_READY';
}

export function classifyFinancialReportExpansionReadiness(
  sourceMapping: object,
  _coverageRatio: number,
  _pitStatus: string
): string {
  const sm = sourceMapping as {
    sourceState: string;
    fixtureFileFound?: boolean;
    realSourceCandidates?: string[];
  };

  const isFixtureOnly =
    sm.sourceState === 'FIXTURE_ONLY' ||
    (sm.fixtureFileFound === true && (!sm.realSourceCandidates || sm.realSourceCandidates.length === 0));

  if (isFixtureOnly) return 'FIXTURE_ONLY_NOT_READY';

  if (
    sm.sourceState === 'REAL_DATA_PRESENT_BUT_NOT_MAPPED' ||
    (sm.realSourceCandidates && sm.realSourceCandidates.length > 0)
  ) {
    return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
  }

  return 'FIXTURE_ONLY_NOT_READY';
}

export function classifyOverallExpansionReadiness(componentResults: object): string {
  const c = componentResults as {
    monthlyRevenue: string;
    newsEvent: string;
    financialReport: string;
  };

  if (
    c.monthlyRevenue === 'READY_FOR_EXPANSION_IMPLEMENTATION' ||
    c.newsEvent === 'READY_FOR_EXPANSION_IMPLEMENTATION' ||
    c.financialReport === 'READY_FOR_EXPANSION_IMPLEMENTATION'
  ) {
    return 'READY_FOR_EXPANSION_IMPLEMENTATION';
  }

  if (c.monthlyRevenue === 'PARTIAL_SOURCE_MAPPING_REQUIRED') {
    return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
  }

  if (
    c.monthlyRevenue === 'FIXTURE_ONLY_NOT_READY' ||
    c.monthlyRevenue === 'BLOCKED_BY_MISSING_SOURCE'
  ) {
    if (
      (c.newsEvent === 'FIXTURE_ONLY_NOT_READY' || c.newsEvent === 'BLOCKED_BY_MISSING_SOURCE') &&
      (c.financialReport === 'FIXTURE_ONLY_NOT_READY' || c.financialReport === 'BLOCKED_BY_MISSING_SOURCE')
    ) {
      return 'BLOCKED_BY_MISSING_SOURCE';
    }
  }

  return 'PARTIAL_SOURCE_MAPPING_REQUIRED';
}

export function buildNextActionPlan(componentResults: object): object {
  const c = componentResults as {
    monthlyRevenue: string;
    newsEvent: string;
    financialReport: string;
  };

  function monthlyRevenueNext(r: string): string {
    if (r === 'READY_FOR_EXPANSION_IMPLEMENTATION') return 'P26F_MONTHLY_REVENUE_CORPUS_EXPANSION';
    if (r === 'PARTIAL_SOURCE_MAPPING_REQUIRED') return 'P26F_MONTHLY_REVENUE_CORPUS_EXPANSION_IMPLEMENTATION';
    if (r === 'BLOCKED_BY_MISSING_SOURCE') return 'P26E_2_SOURCE_ACQUISITION_PLAN';
    return 'P26E_2_SOURCE_MAPPING_REPAIR';
  }

  function newsEventNext(r: string): string {
    if (r === 'FIXTURE_ONLY_NOT_READY') return 'P26E_2_SOURCE_ACQUISITION_PLAN';
    if (r === 'PARTIAL_SOURCE_MAPPING_REQUIRED') return 'P26E_2_SOURCE_MAPPING_REPAIR';
    return 'P26E_2_SOURCE_ACQUISITION_PLAN';
  }

  function financialReportNext(r: string): string {
    if (r === 'FIXTURE_ONLY_NOT_READY') return 'P26E_2_SOURCE_ACQUISITION_PLAN';
    if (r === 'PARTIAL_SOURCE_MAPPING_REQUIRED') return 'P26E_2_SOURCE_MAPPING_REPAIR';
    return 'P26E_2_SOURCE_ACQUISITION_PLAN';
  }

  const overallReadiness = classifyOverallExpansionReadiness(componentResults);

  let overallRecommendedNext: string;
  if (overallReadiness === 'READY_FOR_EXPANSION_IMPLEMENTATION') {
    overallRecommendedNext = 'P26F_MONTHLY_REVENUE_CORPUS_EXPANSION_IMPLEMENTATION';
  } else if (overallReadiness === 'PARTIAL_SOURCE_MAPPING_REQUIRED') {
    overallRecommendedNext = 'P26F_MONTHLY_REVENUE_CORPUS_EXPANSION_IMPLEMENTATION';
  } else {
    overallRecommendedNext = 'P26E_2_SOURCE_ACQUISITION_PLAN';
  }

  const corpusExpansionAllowed =
    c.monthlyRevenue === 'READY_FOR_EXPANSION_IMPLEMENTATION' ||
    c.newsEvent === 'READY_FOR_EXPANSION_IMPLEMENTATION' ||
    c.financialReport === 'READY_FOR_EXPANSION_IMPLEMENTATION';

  return {
    monthlyRevenue: {
      readiness: c.monthlyRevenue,
      recommendedNext: monthlyRevenueNext(c.monthlyRevenue),
    },
    newsEvent: {
      readiness: c.newsEvent,
      recommendedNext: newsEventNext(c.newsEvent),
    },
    financialReport: {
      readiness: c.financialReport,
      recommendedNext: financialReportNext(c.financialReport),
    },
    overallRecommendedNext,
    corpusExpansionAllowed,
    scoringChangeAllowed: false,
    optimizerAllowed: false,
  };
}

export function validateReadinessDoesNotAuthorizeScoring(
  readiness: object
): { valid: boolean; violations: string[] } {
  const r = readiness as Record<string, unknown>;
  const violations: string[] = [];

  if (r['scoringChangeAllowed'] !== false) {
    violations.push('scoringChangeAllowed must be false — scoring is frozen');
  }
  if (r['optimizerAllowed'] !== false) {
    violations.push('optimizerAllowed must be false — optimizer is excluded from scope');
  }

  return { valid: violations.length === 0, violations };
}
