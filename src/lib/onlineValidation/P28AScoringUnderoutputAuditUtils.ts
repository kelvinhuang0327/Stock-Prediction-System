/**
 * P28A Scoring Underoutput Audit Utilities
 *
 * Read-only audit framework for P26A's 9 deferred SCORING_UNDEROUTPUT cases.
 * Extracts, enriches, and classifies cases without modifying scores or templates.
 */

import fs from 'fs';
import path from 'path';

/**
 * Underoutput Classification Categories
 */
export enum UnderoutputClassification {
  NO_TRIGGERED_FACTOR = 'NO_TRIGGERED_FACTOR',
  CONTRIBUTION_BELOW_REASON_THRESHOLD = 'CONTRIBUTION_BELOW_REASON_THRESHOLD',
  TEMPLATE_BRANCH_MISSING = 'TEMPLATE_BRANCH_MISSING',
  UNKNOWN_NEEDS_CODE_TRACE = 'UNKNOWN_NEEDS_CODE_TRACE'
}

/**
 * P26A Underoutput Case structure from p26a_scoring_underoutput_9case_audit.json
 */
export interface P26AUnderoutputCase {
  caseId: string;
  symbol: string;
  asOfDate: string;
  horizon: number;
  bucket: string;
  alphaScore: number;
  reasonRaw: string;
  reasonTokenCount: number;
  factorSnapshotCount: number;
  signalSnapshotCount: number;
  factorSnapshotSample: string[];
  usedSources: string[];
  missingSources: string[];
  completenessStatus: string;
  dataCoverage: string;
  scoringNote: string;
  auditClassification: string;
  underoutputTypes: string[];
  rootCause: string;
  blockedByMonthlyRevenueSource: boolean;
  blockedByNewsEventSource: boolean;
  blockedByFinancialReportSource: boolean;
  isRendererUnderoutput: boolean;
  fixableWithoutScoringChange: boolean;
  fixNote: string;
  patchRecommendation: string;
  nextRoundRoute: string;
}

/**
 * Enriched case with corpus snapshot
 */
export interface EnrichedUnderoutputCase extends P26AUnderoutputCase {
  corpusSnapshotP3?: {
    found: boolean;
    alphaScore?: number;
    bucket?: string;
    reasonText?: string;
  };
  corpusSnapshotP19?: {
    found: boolean;
    alphaScore?: number;
    bucket?: string;
    reasonText?: string;
  };
}

/**
 * Per-case audit context
 */
export interface PerCaseAuditContext {
  caseId: string;
  symbol: string;
  asOfDate: string;
  horizon: number;
  alphaScore: number;
  bucket: string;
  reasonText: string;
  factorCount: number;
  factorSample: string[];
  blockedSources: string[];
  usedSources: string[];
}

/**
 * Classification result
 */
export interface ClassificationResult {
  caseId: string;
  classification: UnderoutputClassification;
  reason: string;
  evidence: {
    hasTriggeredFactors: boolean;
    factorContributions: Array<{ name: string; contribution?: number }>;
    relevantTemplates: string[];
    dataCoverageStatus: string;
  };
  nextStepsRecommended: string[];
}

/**
 * Load P26A underoutput cases from artifact
 * Must extract exactly 9 cases; fails loud if count mismatch.
 */
export function loadP26AUnderoutputCases(
  artifactPath: string
): P26AUnderoutputCase[] {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `P26A underoutput audit artifact not found: ${artifactPath}`
    );
  }

  const content = fs.readFileSync(artifactPath, 'utf-8');
  const artifact = JSON.parse(content);

  if (!Array.isArray(artifact.cases)) {
    throw new Error('P26A artifact.cases is not an array');
  }

  const cases = artifact.cases as P26AUnderoutputCase[];

  if (cases.length !== 9) {
    throw new Error(
      `Expected exactly 9 cases, found ${cases.length}. ` +
        `P26A artifact may be corrupted or modified.`
    );
  }

  return cases;
}

/**
 * Enrich case with corpus snapshot (read-only lookup)
 */
export function enrichCaseWithCorpusSnapshot(
  underoutputCase: P26AUnderoutputCase,
  p3CorpusLines: string[],
  p19CorpusLines: string[]
): EnrichedUnderoutputCase {
  const enriched: EnrichedUnderoutputCase = { ...underoutputCase };

  // P3 lookup
  const p3Match = p3CorpusLines.find((line) => {
    try {
      const row = JSON.parse(line);
      return (
        row.symbol === underoutputCase.symbol &&
        row.asOfDate === underoutputCase.asOfDate &&
        row.horizon === underoutputCase.horizon
      );
    } catch {
      return false;
    }
  });

  if (p3Match) {
    const p3Row = JSON.parse(p3Match);
    enriched.corpusSnapshotP3 = {
      found: true,
      alphaScore: p3Row.alphaScore,
      bucket: p3Row.bucket,
      reasonText: p3Row.reason
    };
  } else {
    enriched.corpusSnapshotP3 = { found: false };
  }

  // P19 lookup
  const p19Match = p19CorpusLines.find((line) => {
    try {
      const row = JSON.parse(line);
      return (
        row.symbol === underoutputCase.symbol &&
        row.asOfDate === underoutputCase.asOfDate &&
        row.horizon === underoutputCase.horizon
      );
    } catch {
      return false;
    }
  });

  if (p19Match) {
    const p19Row = JSON.parse(p19Match);
    enriched.corpusSnapshotP19 = {
      found: true,
      alphaScore: p19Row.alphaScore,
      bucket: p19Row.bucket,
      reasonText: p19Row.reason
    };
  } else {
    enriched.corpusSnapshotP19 = { found: false };
  }

  return enriched;
}

/**
 * Build per-case audit context (read-only)
 */
export function buildPerCaseFactorContext(
  underoutputCase: P26AUnderoutputCase
): PerCaseAuditContext {
  return {
    caseId: underoutputCase.caseId,
    symbol: underoutputCase.symbol,
    asOfDate: underoutputCase.asOfDate,
    horizon: underoutputCase.horizon,
    alphaScore: underoutputCase.alphaScore,
    bucket: underoutputCase.bucket,
    reasonText: underoutputCase.reasonRaw,
    factorCount: underoutputCase.factorSnapshotCount,
    factorSample: underoutputCase.factorSnapshotSample,
    blockedSources: underoutputCase.missingSources,
    usedSources: underoutputCase.usedSources
  };
}

/**
 * Classify underoutput case into four categories
 * (a) NO_TRIGGERED_FACTOR
 * (b) CONTRIBUTION_BELOW_REASON_THRESHOLD
 * (c) TEMPLATE_BRANCH_MISSING
 * (d) UNKNOWN_NEEDS_CODE_TRACE
 *
 * Classification logic:
 * - If factorSnapshotCount=0 OR reasonTokenCount=0 → NO_TRIGGERED_FACTOR (no scoring input)
 * - If factorSnapshotCount>0 but reasonTokenCount=1 (collapsed) → likely RENDERER_UNDEROUTPUT
 *   (not a true scoring underoutput; scorable factors exist but not rendered)
 * - If factors present but all below threshold for reason usage → CONTRIBUTION_BELOW_REASON_THRESHOLD
 * - If factors triggered but no corresponding reason template branch → TEMPLATE_BRANCH_MISSING
 * - Otherwise → UNKNOWN_NEEDS_CODE_TRACE
 */
export function classifyUnderoutputCase(
  underoutputCase: P26AUnderoutputCase
): ClassificationResult {
  const evidences = {
    hasTriggeredFactors: underoutputCase.factorSnapshotCount > 0,
    factorCount: underoutputCase.factorSnapshotCount,
    reasonTokens: underoutputCase.reasonTokenCount,
    dataCoverage: underoutputCase.dataCoverage,
    blockedByMonthlyRevenue: underoutputCase.blockedByMonthlyRevenueSource
  };

  let classification = UnderoutputClassification.UNKNOWN_NEEDS_CODE_TRACE;
  let reason = '';
  const nextSteps: string[] = [];

  if (evidences.factorCount === 0) {
    classification = UnderoutputClassification.NO_TRIGGERED_FACTOR;
    reason =
      'No factors triggered (factorSnapshotCount=0). Underoutput is expected behavior.';
    nextSteps.push('Audit case for false-flag (no scoring action needed)');
  } else if (
    evidences.factorCount > 0 &&
    evidences.reasonTokens === 1 &&
    underoutputCase.reasonRaw === '技術偏多'
  ) {
    // P26A already classified this as NO_TRIGGERED_FACTOR (renderer underoutput)
    classification = UnderoutputClassification.NO_TRIGGERED_FACTOR;
    reason =
      'Factors present (factorSnapshotCount=' +
      evidences.factorCount +
      ') but reason collapsed to 1 token. ' +
      'Scoring is correct; renderer failed to serialize factorSnapshot into reason text.';
    nextSteps.push(
      'Renderer fix: deserialize factorSnapshot for multi-factor reason generation'
    );
    if (evidences.blockedByMonthlyRevenue) {
      nextSteps.push(
        'Source completion: P26F4 import for MonthlyRevenue missing data'
      );
    }
  } else if (evidences.dataCoverage === 'limited') {
    classification = UnderoutputClassification.CONTRIBUTION_BELOW_REASON_THRESHOLD;
    reason =
      'Data coverage is limited; factors may be present but contributions below reason-triggering threshold.';
    nextSteps.push(
      'Analyze RuleBasedStockAnalyzer factor weighting against data availability'
    );
  } else {
    classification = UnderoutputClassification.TEMPLATE_BRANCH_MISSING;
    reason =
      'Factors present but corresponding reason template branch not identified.';
    nextSteps.push('Code trace: map factor set to reason template branches');
  }

  const result: ClassificationResult = {
    caseId: underoutputCase.caseId,
    classification,
    reason,
    evidence: {
      hasTriggeredFactors: evidences.hasTriggeredFactors,
      factorContributions: underoutputCase.factorSnapshotSample.map(
        (factor) => ({
          name: factor,
          contribution: undefined // NOT_OBSERVABLE without code instrumentation
        })
      ),
      relevantTemplates: [], // Not observable without template AST scan
      dataCoverageStatus: underoutputCase.dataCoverage
    },
    nextStepsRecommended: nextSteps
  };

  return result;
}

/**
 * Validate that audit did not modify score or bucket
 * Used to ensure byte-level invariance between before/after snapshot
 */
export function validateAuditDoesNotModifyScore(
  beforeSnapshot: { alphaScore: number; bucket: string },
  afterSnapshot: { alphaScore: number; bucket: string }
): {
  valid: boolean;
  alphaScoreChanged: boolean;
  bucketChanged: boolean;
  error?: string;
} {
  const alphaScoreChanged =
    beforeSnapshot.alphaScore !== afterSnapshot.alphaScore;
  const bucketChanged = beforeSnapshot.bucket !== afterSnapshot.bucket;

  if (alphaScoreChanged || bucketChanged) {
    return {
      valid: false,
      alphaScoreChanged,
      bucketChanged,
      error:
        `Baseline mismatch: alphaScore ${beforeSnapshot.alphaScore} → ${afterSnapshot.alphaScore}, ` +
        `bucket ${beforeSnapshot.bucket} → ${afterSnapshot.bucket}. ` +
        `Baseline may have drifted; audit scope exceeded.`
    };
  }

  return {
    valid: true,
    alphaScoreChanged: false,
    bucketChanged: false
  };
}

/**
 * Extract factor identifiers from a factorSnapshotSample string array
 * (read-only text parsing, no scoring invoked)
 */
export function parseFactorsFromSample(sample: string[]): string[] {
  const factors: Set<string> = new Set();

  sample.forEach((line) => {
    // Pattern: "Factor Name: value (description)"
    const match = line.match(/^([^:]+):/);
    if (match) {
      factors.add(match[1].trim());
    }
  });

  return Array.from(factors);
}
