// P26ECoverageRatioScannerUtils.ts
// ZERO external imports — pure functions only.

export function computeCoverageRatio(sourceRowCount: number, targetCorpusRowCount: number): number {
  if (targetCorpusRowCount === 0) return 0;
  const ratio = sourceRowCount / targetCorpusRowCount;
  return Math.min(ratio, 1.0);
}

export function classifyCoverageRatio(ratio: number, thresholds?: object): string {
  // thresholds param reserved for future override — not used
  void thresholds;
  if (ratio === 0) return 'NONE';
  if (ratio < 0.05) return 'VERY_LOW';
  if (ratio < 0.20) return 'LOW';
  if (ratio < 0.60) return 'PARTIAL';
  if (ratio < 0.90) return 'GOOD';
  return 'HIGH';
}

export function scanCoverageForP3P19(
  sourceMappingResults: object[],
  corpusRows: object[]
): object {
  const mappings = sourceMappingResults as Array<{
    sourceCategory: string;
    sourceState: string;
    fixtureFileFound: boolean;
    realSourceCandidates: string[];
  }>;

  const totalRows = corpusRows.length;

  const results: Record<string, object> = {};

  for (const mapping of mappings) {
    const category = mapping.sourceCategory;
    const isFixtureOnly = mapping.sourceState === 'FIXTURE_ONLY';
    const isRealDataPresent =
      mapping.sourceState === 'REAL_DATA_PRESENT_BUT_NOT_MAPPED' ||
      mapping.sourceState === 'REAL_DATA_READY';

    if (isFixtureOnly) {
      results[category] = {
        sourceCategory: category,
        sourceState: mapping.sourceState,
        fixtureCoverageOnly: true,
        coverageCount: 0,
        coverageRatio: 0,
        coverageClassification: 'NONE',
        notes: 'Fixture-only source — not counted as real corpus coverage',
      };
      continue;
    }

    let coverageCount = 0;
    for (const row of corpusRows) {
      const r = row as Record<string, unknown>;
      if (category === 'MonthlyRevenue') {
        if (r['monthlyRevenueContext'] !== undefined || r['revenueContext'] !== undefined) {
          coverageCount++;
        }
      } else if (category === 'NewsEvent') {
        if (r['newsEventContext'] !== undefined) {
          coverageCount++;
        }
      } else if (category === 'FinancialReport') {
        if (r['financialReportContext'] !== undefined) {
          coverageCount++;
        }
      }
    }

    const coverageRatio = computeCoverageRatio(coverageCount, totalRows);
    results[category] = {
      sourceCategory: category,
      sourceState: mapping.sourceState,
      fixtureCoverageOnly: false,
      coverageCount,
      totalRows,
      coverageRatio,
      coverageClassification: classifyCoverageRatio(coverageRatio),
      isRealDataPresent,
    };
  }

  return {
    totalCorpusRows: totalRows,
    perSource: results,
  };
}

export function summarizeCoverageRatios(coverageResults: object): object {
  const c = coverageResults as {
    totalCorpusRows: number;
    perSource: Record<string, {
      sourceCategory: string;
      fixtureCoverageOnly: boolean;
      coverageRatio: number;
      coverageClassification: string;
    }>;
  };

  const perSource = c.perSource || {};
  const summaries: Record<string, object> = {};
  let anyRealCoverage = false;
  let allFixtureOnly = true;

  for (const [key, val] of Object.entries(perSource)) {
    summaries[key] = {
      sourceCategory: val.sourceCategory,
      fixtureCoverageOnly: val.fixtureCoverageOnly,
      coverageRatio: val.coverageRatio,
      coverageClassification: val.coverageClassification,
    };
    if (!val.fixtureCoverageOnly && val.coverageRatio > 0) anyRealCoverage = true;
    if (!val.fixtureCoverageOnly) allFixtureOnly = false;
  }

  return {
    totalCorpusRows: c.totalCorpusRows,
    perSource: summaries,
    anyRealCoverage,
    allFixtureOnly,
    outcomeFieldsInSummary: false,
  };
}

export function validateCoverageRatioNoOutcomeFields(
  summary: object
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const s = JSON.stringify(summary);

  if (s.includes('outcomePrice')) violations.push('outcomePrice found in summary — forbidden');
  if (s.includes('returnPct')) violations.push('returnPct found in summary — forbidden');
  if (s.includes('realizedReturnClass')) violations.push('realizedReturnClass found in summary — forbidden');

  return { valid: violations.length === 0, violations };
}
