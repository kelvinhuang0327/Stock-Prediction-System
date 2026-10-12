/**
 * P26B-HARDRESET: Event/News PIT Contract v0
 *
 * Defines the PIT-safe contract for NewsEvent source.
 * NewsEvent is read-only metadata ONLY — it does NOT enter alphaScore or recommendationBucket.
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

export const P26B_CONTRACT_VERSION = 'p26b-event-news-pit-contract-v0';
export const P26B_CONTRACT_DATE = '2026-05-13';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PitStatus =
  | 'ALREADY_PIT_GATED'
  | 'REPAIRED_2026_05_12'
  | 'STILL_HIGH_RISK_NOT_PIT_GATED'
  | 'READ_ONLY_METADATA_ONLY';

export type EventNewsFieldStatus = 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN' | 'OBSERVABILITY_ONLY';

export interface EventNewsFieldSpec {
  fieldName: string;
  type: string;
  status: EventNewsFieldStatus;
  description: string;
}

export interface EventNewsPitContractV0 {
  version: string;
  generatedAt: string;
  pitStatus: PitStatus;
  pitVisibilityRule: string;
  ingestedAtRule: string;
  timezoneRule: string;
  entersAlphaScore: false;
  entersRecommendationBucket: false;
  entersReasonContext: true;
  entersFactorSnapshot: false;
  readOnly: true;
  fields: EventNewsFieldSpec[];
  forbiddenFields: string[];
  nonGoals: string[];
  supersedes: null;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Contract definition
// ---------------------------------------------------------------------------

export const EVENT_NEWS_FIELD_SPECS: EventNewsFieldSpec[] = [
  {
    fieldName: 'eventId',
    type: 'string',
    status: 'REQUIRED',
    description: 'Unique identifier for the event',
  },
  {
    fieldName: 'symbol',
    type: 'string',
    status: 'REQUIRED',
    description: 'Stock symbol this event relates to',
  },
  {
    fieldName: 'title',
    type: 'string',
    status: 'OPTIONAL',
    description: 'Event title or headline (not used for scoring)',
  },
  {
    fieldName: 'category',
    type: 'string',
    status: 'OPTIONAL',
    description: 'Event category (e.g. EARNINGS, REGULATORY, MARKET)',
  },
  {
    fieldName: 'publishedAt',
    type: 'string (ISO-8601)',
    status: 'REQUIRED',
    description: 'Publication timestamp — THE PIT gate field. visible iff publishedAt <= asOfDate',
  },
  {
    fieldName: 'ingestedAt',
    type: 'string (ISO-8601)',
    status: 'OBSERVABILITY_ONLY',
    description: 'System ingestion timestamp — must NOT be used as PIT gate. Used only for ingestion lag measurement.',
  },
  {
    fieldName: 'source',
    type: 'string',
    status: 'OPTIONAL',
    description: 'News source name',
  },
  {
    fieldName: 'sourceHash',
    type: 'string',
    status: 'OPTIONAL',
    description: 'Hash of the source URL for deduplication — use instead of raw URL',
  },
  {
    fieldName: 'severity',
    type: 'string',
    status: 'OPTIONAL',
    description: 'Event severity classification (e.g. HIGH, MEDIUM, LOW) — fixture-level only',
  },
  {
    fieldName: 'relevanceScore',
    type: 'number',
    status: 'OPTIONAL',
    description: 'Relevance score 0-1 — fixture-level only, does not enter scoring',
  },
];

export const FORBIDDEN_FIELDS: string[] = [
  'outcomePrice',
  'returnPct',
  'realizedReturnClass',
  'futurePriceMovement',
  'postAsOfEvent',
];

export function buildEventNewsPitContractV0(): EventNewsPitContractV0 {
  return {
    version: P26B_CONTRACT_VERSION,
    generatedAt: P26B_CONTRACT_DATE,
    pitStatus: 'READ_ONLY_METADATA_ONLY',
    pitVisibilityRule: 'visible iff publishedAt <= asOfDate (Asia/Taipei end-of-day)',
    ingestedAtRule: 'ingestedAt must NOT determine PIT visibility; used only as ingestion lag observability',
    timezoneRule: 'asOfDate uses Asia/Taipei day boundary (UTC+8). publishedAt UTC timestamps are compared after normalizing to Taiwan date.',
    entersAlphaScore: false,
    entersRecommendationBucket: false,
    entersReasonContext: true,
    entersFactorSnapshot: false,
    readOnly: true,
    fields: EVENT_NEWS_FIELD_SPECS.map(f => ({ ...f })),
    forbiddenFields: [...FORBIDDEN_FIELDS],
    nonGoals: [
      'NewsEvent does not enter alphaScore calculation',
      'NewsEvent does not enter recommendationBucket determination',
      'No production integration with external news API in this sprint',
      'No activation date committed for NewsEvent entering scoring',
      'No performance improvement claimed from NewsEvent context',
    ],
    supersedes: null,
    disclaimer:
      'Read-only metadata contract only. No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.',
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateContractV0(contract: EventNewsPitContractV0): {
  valid: boolean;
  errors: string[];
} {
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
  if (!contract.pitVisibilityRule.includes('publishedAt')) {
    errors.push('pitVisibilityRule must reference publishedAt');
  }
  if (!contract.ingestedAtRule.includes('must NOT')) {
    errors.push('ingestedAtRule must state ingestedAt must NOT determine visibility');
  }

  for (const forbidden of FORBIDDEN_FIELDS) {
    if (contract.forbiddenFields.includes(forbidden) === false) {
      errors.push(`forbiddenFields must include ${forbidden}`);
    }
  }

  const publishedAtField = contract.fields.find(f => f.fieldName === 'publishedAt');
  if (!publishedAtField || publishedAtField.status !== 'REQUIRED') {
    errors.push('publishedAt field must be REQUIRED');
  }

  const ingestedAtField = contract.fields.find(f => f.fieldName === 'ingestedAt');
  if (!ingestedAtField || ingestedAtField.status !== 'OBSERVABILITY_ONLY') {
    errors.push('ingestedAt field must be OBSERVABILITY_ONLY');
  }

  const containsOutcomeRef = contract.fields.some(f =>
    FORBIDDEN_FIELDS.includes(f.fieldName)
  );
  if (containsOutcomeRef) {
    errors.push('Contract fields must not include any forbidden outcome fields');
  }

  return { valid: errors.length === 0, errors };
}

export function getContractV0NonScoringSourceNames(contract: EventNewsPitContractV0): string[] {
  // NewsEvent is always non-scoring in v0
  return ['NewsEvent'];
}
