export type PriceAnalysisDedupeKey =
  | 'price_analysis_quality__trigger_score_distribution'
  | 'price_analysis_quality__setup_classification_audit'
  | 'price_analysis_quality__mfe_mae_audit'
  | 'price_analysis_quality__data_audit'
  | 'price_analysis_quality__indicator_history_check'
  | 'price_analysis_quality__sector_context_audit';

export type PriceAnalysisInsightType =
  | 'score_bias'
  | 'setup_imbalance'
  | 'time_exit_dominance'
  | 'data_quality_issue'
  | 'indicator_insufficient'
  | 'sector_misalignment';

export type PriceAnalysisScopeField = 'affectedSymbols' | 'affectedSetupTypes';

export interface PriceAnalysisNativeReportSchema {
  dedupeKey: PriceAnalysisDedupeKey;
  reportPath: string;
  insightType: PriceAnalysisInsightType;
  requiredScopeField: PriceAnalysisScopeField;
  requiredTopLevelFields: readonly [
    'generatedAt',
    'insightType',
    'confidence',
    'evidence',
    'severity',
    PriceAnalysisScopeField,
  ];
  noThresholdChanges: true;
}

export const PRICE_ANALYSIS_NATIVE_REPORT_SCHEMAS: Readonly<Record<PriceAnalysisDedupeKey, PriceAnalysisNativeReportSchema>> = {
  price_analysis_quality__trigger_score_distribution: {
    dedupeKey: 'price_analysis_quality__trigger_score_distribution',
    reportPath: 'docs/reports/trigger_score_audit.json',
    insightType: 'score_bias',
    requiredScopeField: 'affectedSetupTypes',
    requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSetupTypes'],
    noThresholdChanges: true,
  },
  price_analysis_quality__setup_classification_audit: {
    dedupeKey: 'price_analysis_quality__setup_classification_audit',
    reportPath: 'docs/reports/setup_audit.json',
    insightType: 'setup_imbalance',
    requiredScopeField: 'affectedSetupTypes',
    requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSetupTypes'],
    noThresholdChanges: true,
  },
  price_analysis_quality__mfe_mae_audit: {
    dedupeKey: 'price_analysis_quality__mfe_mae_audit',
    reportPath: 'docs/reports/mfe_mae_audit.json',
    insightType: 'time_exit_dominance',
    requiredScopeField: 'affectedSymbols',
    requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
    noThresholdChanges: true,
  },
  price_analysis_quality__data_audit: {
    dedupeKey: 'price_analysis_quality__data_audit',
    reportPath: 'docs/reports/price_data_quality.json',
    insightType: 'data_quality_issue',
    requiredScopeField: 'affectedSymbols',
    requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
    noThresholdChanges: true,
  },
  price_analysis_quality__indicator_history_check: {
    dedupeKey: 'price_analysis_quality__indicator_history_check',
    reportPath: 'docs/reports/indicator_readiness.json',
    insightType: 'indicator_insufficient',
    requiredScopeField: 'affectedSymbols',
    requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
    noThresholdChanges: true,
  },
  price_analysis_quality__sector_context_audit: {
    dedupeKey: 'price_analysis_quality__sector_context_audit',
    reportPath: 'docs/reports/sector_alignment.json',
    insightType: 'sector_misalignment',
    requiredScopeField: 'affectedSymbols',
    requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
    noThresholdChanges: true,
  },
} as const;

export function getPriceAnalysisNativeReportSchema(
  dedupeKey: string,
): PriceAnalysisNativeReportSchema | null {
  return PRICE_ANALYSIS_NATIVE_REPORT_SCHEMAS[dedupeKey as PriceAnalysisDedupeKey] ?? null;
}

export function isPriceAnalysisDedupeKey(dedupeKey: string): dedupeKey is PriceAnalysisDedupeKey {
  return getPriceAnalysisNativeReportSchema(dedupeKey) !== null;
}