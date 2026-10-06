/**
 * P26C-HARDRESET: FinancialReport Availability PIT Contract v0
 *
 * Defines the PIT-safe contract for FinancialReport source.
 * FinancialReport is read-only metadata ONLY — it does NOT enter alphaScore or recommendationBucket.
 * Visibility gate: availabilityDate <= asOfDate
 * availabilityDate priority: filingDate → announcementDate → publishedAt → availableAt
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

export type FinancialReportFieldStatus =
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'OBSERVABILITY_ONLY'
  | 'FORBIDDEN_AS_PIT_GATE';

export interface FinancialReportFieldSpec {
  fieldName: string;
  type: string;
  status: 'REQUIRED' | 'OPTIONAL' | 'OBSERVABILITY_ONLY' | 'FORBIDDEN_AS_PIT_GATE';
  description: string;
}

export interface FinancialReportPitContractV0 {
  version: string;
  generatedAt: string;
  phase: string;
  pitStatus: string;
  pitVisibilityRule: string;
  availabilityDatePriority: string[];
  forbiddenVisibilityGates: string[];
  timezoneRule: string;
  entersAlphaScore: false;
  entersRecommendationBucket: false;
  entersReasonContext: true;
  entersFactorSnapshot: false;
  readOnly: true;
  fields: FinancialReportFieldSpec[];
  forbiddenFields: string[];
  nonGoals: string[];
  disclaimer: string;
}

export function buildFinancialReportPitContractV0(): FinancialReportPitContractV0 {
  const fields: FinancialReportFieldSpec[] = [
    {
      fieldName: 'reportId',
      type: 'string',
      status: 'REQUIRED',
      description: 'Unique identifier for the financial report record.',
    },
    {
      fieldName: 'symbol',
      type: 'string',
      status: 'REQUIRED',
      description: 'Stock symbol/ticker associated with this financial report.',
    },
    {
      fieldName: 'fiscalYear',
      type: 'string | number',
      status: 'OPTIONAL',
      description:
        'Fiscal year of the reporting period. FORBIDDEN_AS_PIT_GATE — must never be used as a PIT visibility gate.',
    },
    {
      fieldName: 'fiscalQuarter',
      type: 'string',
      status: 'OPTIONAL',
      description:
        'Fiscal quarter of the reporting period (e.g., Q1, Q2). FORBIDDEN_AS_PIT_GATE — must never be used as a PIT visibility gate.',
    },
    {
      fieldName: 'reportType',
      type: 'string',
      status: 'OPTIONAL',
      description: 'Type of financial report (e.g., annual, quarterly).',
    },
    {
      fieldName: 'periodStartDate',
      type: 'string | null',
      status: 'OPTIONAL',
      description:
        'Start date of the fiscal reporting period. FORBIDDEN_AS_PIT_GATE — must never be used as a PIT visibility gate.',
    },
    {
      fieldName: 'periodEndDate',
      type: 'string | null',
      status: 'OPTIONAL',
      description:
        'End date of the fiscal reporting period. FORBIDDEN_AS_PIT_GATE — must never be used as a PIT visibility gate. A report with periodEndDate before asOfDate may still be invisible if filingDate has not yet passed.',
    },
    {
      fieldName: 'filingDate',
      type: 'string | null',
      status: 'OPTIONAL',
      description:
        'Primary availability gate (priority 1). The date the report was officially filed. availabilityDate = filingDate if present.',
    },
    {
      fieldName: 'announcementDate',
      type: 'string | null',
      status: 'OPTIONAL',
      description:
        'Secondary availability gate (priority 2). Used when filingDate is absent.',
    },
    {
      fieldName: 'publishedAt',
      type: 'string | null',
      status: 'OPTIONAL',
      description:
        'Tertiary availability gate (priority 3). Used when filingDate and announcementDate are absent.',
    },
    {
      fieldName: 'availableAt',
      type: 'string | null',
      status: 'OPTIONAL',
      description:
        'Quaternary availability gate (priority 4). Last resort when all higher-priority gates are absent.',
    },
    {
      fieldName: 'source',
      type: 'string',
      status: 'OPTIONAL',
      description: 'Source of the financial report data (e.g., TWSE, Bloomberg).',
    },
    {
      fieldName: 'sourceHash',
      type: 'string',
      status: 'OPTIONAL',
      description: 'Deterministic hash for deduplication of financial report records.',
    },
    {
      fieldName: 'ingestedAt',
      type: 'string | null',
      status: 'OBSERVABILITY_ONLY',
      description:
        'Timestamp when this record was ingested into the system. FORBIDDEN_AS_PIT_GATE — observability only, must never influence PIT visibility.',
    },
    {
      fieldName: 'createdAt',
      type: 'string | null',
      status: 'OBSERVABILITY_ONLY',
      description:
        'Record creation timestamp. FORBIDDEN_AS_PIT_GATE — observability only, must never influence PIT visibility.',
    },
    {
      fieldName: 'updatedAt',
      type: 'string | null',
      status: 'OBSERVABILITY_ONLY',
      description:
        'Record last-updated timestamp. FORBIDDEN_AS_PIT_GATE — observability only, must never influence PIT visibility.',
    },
    {
      fieldName: 'eps',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Earnings per share. Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'grossMargin',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Gross margin ratio. Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'operatingMargin',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Operating margin ratio. Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'netMargin',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Net profit margin ratio. Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'debtRatio',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Debt ratio (total liabilities / total assets). Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'currentRatio',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Current ratio (current assets / current liabilities). Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'roe',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Return on equity. Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
    {
      fieldName: 'roa',
      type: 'number | null',
      status: 'OPTIONAL',
      description:
        'Return on assets. Fixture-only metric, no scoring impact. Read-only metadata for context enrichment.',
    },
  ];

  return {
    version: 'p26c-financial-report-availability-contract-v0',
    generatedAt: '2026-05-13',
    phase: 'P26C-HARDRESET',
    pitStatus: 'READ_ONLY_METADATA_ONLY',
    pitVisibilityRule:
      'FinancialReport is visible iff availabilityDate <= asOfDate. availabilityDate is resolved via priority: filingDate → announcementDate → publishedAt → availableAt.',
    availabilityDatePriority: ['filingDate', 'announcementDate', 'publishedAt', 'availableAt'],
    forbiddenVisibilityGates: [
      'periodEndDate',
      'fiscalYear',
      'fiscalQuarter',
      'periodStartDate',
      'ingestedAt',
      'createdAt',
      'updatedAt',
    ],
    timezoneRule: 'UTC+8 (Taiwan, no DST). All UTC ISO timestamps are converted to Taiwan YYYY-MM-DD for PIT comparison.',
    entersAlphaScore: false,
    entersRecommendationBucket: false,
    entersReasonContext: true,
    entersFactorSnapshot: false,
    readOnly: true,
    fields,
    forbiddenFields: [
      'outcomePrice',
      'returnPct',
      'realizedReturnClass',
      'futurePriceMovement',
      'postAsOfReport',
    ],
    nonGoals: [
      'FinancialReport metrics do NOT enter alphaScore or scoring formulas.',
      'FinancialReport context does NOT enter recommendationBucket.',
      'FinancialReport does NOT enter factorSnapshot.',
      'No investment recommendations are derived from FinancialReport context.',
      'No ROI, win-rate, profit, outperform, buy, or sell signals are generated from this data.',
      'periodEndDate, fiscalYear, fiscalQuarter, periodStartDate, ingestedAt, createdAt, updatedAt are NEVER PIT visibility gates.',
    ],
    disclaimer:
      'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. FinancialReport context is strictly read-only metadata for observability and reason enrichment only.',
  };
}

export function validateFinancialReportContractV0(
  contract: FinancialReportPitContractV0
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (contract.entersAlphaScore !== false) {
    errors.push('entersAlphaScore must be false');
  }
  if (contract.entersRecommendationBucket !== false) {
    errors.push('entersRecommendationBucket must be false');
  }
  if (contract.readOnly !== true) {
    errors.push('readOnly must be true');
  }
  if (contract.entersReasonContext !== true) {
    errors.push('entersReasonContext must be true');
  }
  if (contract.entersFactorSnapshot !== false) {
    errors.push('entersFactorSnapshot must be false');
  }

  const requiredGates = [
    'periodEndDate',
    'fiscalYear',
    'fiscalQuarter',
    'ingestedAt',
    'createdAt',
    'updatedAt',
  ];
  for (const gate of requiredGates) {
    if (!contract.forbiddenVisibilityGates.includes(gate)) {
      errors.push(`forbiddenVisibilityGates must include '${gate}'`);
    }
  }

  if (
    !contract.availabilityDatePriority ||
    contract.availabilityDatePriority.length === 0
  ) {
    errors.push('availabilityDatePriority must be a non-empty array');
  }

  const requiredForbiddenFields = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
  for (const f of requiredForbiddenFields) {
    if (!contract.forbiddenFields.includes(f)) {
      errors.push(`forbiddenFields must include '${f}'`);
    }
  }

  if (!contract.version || !contract.version.startsWith('p26c-')) {
    errors.push('version must start with p26c-');
  }

  if (!contract.fields || contract.fields.length === 0) {
    errors.push('fields must be a non-empty array');
  }

  if (!contract.nonGoals || !contract.nonGoals.some(g => /alphaScore|scoring/.test(g))) {
    errors.push('nonGoals must include a statement about alphaScore/scoring');
  }

  return { valid: errors.length === 0, errors };
}
