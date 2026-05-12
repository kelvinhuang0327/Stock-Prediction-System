/**
 * P20PitImpactComparisonUtils.ts
 * DISCLAIMER: Does not constitute investment advice. Observability-only impact
 * analysis comparing P3 pre-PIT and P19 post-PIT active scoring corpora.
 * No ROI, win-rate, alpha, edge, profit, outperformance, or investment
 * recommendations are computed or implied.
 *
 * productionApplyAllowed = false
 * No production DB writes
 */

// ─── Change Classification Types ────────────────────────────────────────────

export type PitImpactChangeClassification =
  | 'NO_CHANGE'
  | 'SCORE_CHANGED'
  | 'BUCKET_CHANGED'
  | 'COMPLETENESS_CHANGED'
  | 'REASON_CHANGED'
  | 'SIGNAL_CHANGED'
  | 'FACTOR_CHANGED'
  | 'MONTHLY_REVENUE_EXCLUDED'
  | 'SHAPE_MISMATCH'
  | 'MISSING_PRE_ROW'
  | 'MISSING_POST_ROW';

// ─── Row Interfaces ──────────────────────────────────────────────────────────

export interface ActiveScoringRow {
  symbol: string;
  originalAsOfDate: string;
  duplicateKey: string;
  researchBucket?: string;
  scoringCompletenessStatus?: string;
  scoreSnapshot?: Record<string, number>;
  activeScoringSnapshot?: {
    researchBucket?: string;
    alphaScore?: number;
    scoreSnapshot?: Record<string, number>;
    signalSnapshot?: string[];
    factorSnapshot?: string[];
    reasonSnapshot?: string;
    completenessStatus?: string;
    usedSources?: string[];
    missingSources?: string[];
    monthlyRevenuePitGateApplied?: boolean;
    monthlyRevenuePitGateStatus?: string;
    [key: string]: unknown;
  };
  horizonDays?: number;
  monthlyRevenuePitGateStatus?: string;
  productionApplyAllowed?: boolean;
  productionDbWritten?: boolean;
}

export interface AlignedRowPair {
  key: string;
  preRow: ActiveScoringRow | null;
  postRow: ActiveScoringRow | null;
}

// ─── Score Comparison Result ─────────────────────────────────────────────────

export interface ScoreComparison {
  preAlphaScore: number | null;
  postAlphaScore: number | null;
  delta: number | null;
  changed: boolean;
  preScoreSnapshot: Record<string, number> | null;
  postScoreSnapshot: Record<string, number> | null;
  snapshotChanged: boolean;
}

// ─── Signal Comparison Result ────────────────────────────────────────────────

export interface SignalComparison {
  preSignals: string[];
  postSignals: string[];
  added: string[];
  removed: string[];
  changed: boolean;
}

// ─── Reason Comparison Result ────────────────────────────────────────────────

export interface ReasonComparison {
  preReason: string;
  postReason: string;
  changed: boolean;
}

// ─── Factor Comparison Result ────────────────────────────────────────────────

export interface FactorComparison {
  preFactors: string[];
  postFactors: string[];
  added: string[];
  removed: string[];
  changed: boolean;
}

// ─── Full Row Comparison Result ──────────────────────────────────────────────

export interface RowImpactResult {
  key: string;
  symbol: string | null;
  originalAsOfDate: string | null;
  horizonDays: number | string | null;
  classifications: PitImpactChangeClassification[];
  primaryClassification: PitImpactChangeClassification;
  completenessComparison: {
    pre: string | null;
    post: string | null;
    changed: boolean;
    direction: 'degraded' | 'improved' | 'same' | 'unknown';
  };
  bucketComparison: {
    pre: string | null;
    post: string | null;
    changed: boolean;
  };
  scoreComparison: ScoreComparison;
  signalComparison: SignalComparison;
  reasonComparison: ReasonComparison;
  factorComparison: FactorComparison;
  monthlyRevenuePitGateStatus: string | null;
  monthlyRevenueExcluded: boolean;
}

// ─── Summary Result ──────────────────────────────────────────────────────────

export interface PitImpactSummary {
  phase: string;
  generatedAt: string;
  totalAligned: number;
  missingPreRows: number;
  missingPostRows: number;
  classificationCounts: Record<string, number>;
  completenessImpact: {
    degraded: number;
    improved: number;
    same: number;
    unknown: number;
  };
  bucketChangedCount: number;
  scoreChangedCount: number;
  signalChangedCount: number;
  reasonChangedCount: number;
  factorChangedCount: number;
  monthlyRevenueExcludedCount: number;
  noChangeCount: number;
  productionApplyAllowed: false;
  productionDbWritten: false;
}

// ─── Forbidden Claims ────────────────────────────────────────────────────────

const FORBIDDEN_CLAIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bROI\b/gi, label: 'ROI' },
  { pattern: /win[- ]rate/gi, label: 'win-rate' },
  { pattern: /\boutperform\b/gi, label: 'outperform' },
  { pattern: /beat the market/gi, label: 'beat the market' },
  { pattern: /\bguaranteed?\b/gi, label: 'guaranteed' },
  { pattern: /\bprofit\b/gi, label: 'profit' },
  { pattern: /investment recommendation/gi, label: 'investment recommendation' },
];

const DISCLAIMER_EXEMPT_PHRASES = [
  'does not constitute investment advice',
  'does not compute roi',
  'no roi',
  'no win-rate',
  'no outperform',
  'no guaranteed',
  'no profit',
  'forbidden_claim_patterns',
  'forbidden claim pattern',
  'roi|win-rate',
  'roi / win-rate',
  'roi, win-rate',
];

export interface ForbiddenClaimMatch {
  label: string;
  excerpt: string;
  lineIndex: number;
}

export interface ForbiddenClaimScanResult {
  clean: boolean;
  matches: ForbiddenClaimMatch[];
  scannedLength: number;
}

/**
 * Scan text for forbidden performance/investment claim patterns.
 * Exempts disclaimer lines and scanner definition lines.
 * Does not scan alphaScore field name references.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimScanResult {
  const matches: ForbiddenClaimMatch[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lower = rawLine.toLowerCase();

    // Skip disclaimer or scanner definition lines
    const isExempt = DISCLAIMER_EXEMPT_PHRASES.some(phrase => lower.includes(phrase));
    if (isExempt) continue;

    // Replace alphaScore references before checking for alpha
    const scanLine = rawLine.replace(/alphaScore/g, '__ALPHASCORE__');

    for (const { pattern, label } of FORBIDDEN_CLAIM_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(scanLine)) {
        const excerpt = rawLine.trim().substring(0, 120);
        matches.push({ label, excerpt, lineIndex: i + 1 });
      }
    }
  }

  return {
    clean: matches.length === 0,
    matches,
    scannedLength: text.length,
  };
}

// ─── Key Extraction ──────────────────────────────────────────────────────────

/**
 * Build a deterministic comparison key for a row.
 * Format: symbol|originalAsOfDate|horizonDays
 * Uses duplicateKey for P3 (which encodes horizon), or direct fields for P19.
 */
export function buildComparisonKey(row: ActiveScoringRow): string {
  const symbol = row.symbol || '';
  const asOfDate = row.originalAsOfDate || '';

  // P19 has horizonDays directly
  if (row.horizonDays !== undefined && row.horizonDays !== null) {
    return `${symbol}|${asOfDate}|${row.horizonDays}`;
  }

  // P3 encodes horizon in duplicateKey: "symbol|date|horizon"
  if (row.duplicateKey) {
    const parts = row.duplicateKey.split('|');
    if (parts.length >= 3) {
      return `${parts[0]}|${parts[1]}|${parts[2]}`;
    }
  }

  return `${symbol}|${asOfDate}|unknown`;
}

// ─── Alignment ───────────────────────────────────────────────────────────────

/**
 * Align pre (P3) and post (P19) rows by comparison key.
 * Returns sorted aligned pairs including missing-row cases.
 * Deterministic: sorted by key.
 */
export function alignPrePostRows(
  preRows: ActiveScoringRow[],
  postRows: ActiveScoringRow[]
): AlignedRowPair[] {
  const preMap = new Map<string, ActiveScoringRow>();
  const postMap = new Map<string, ActiveScoringRow>();

  for (const row of preRows) {
    const key = buildComparisonKey(row);
    preMap.set(key, row);
  }

  for (const row of postRows) {
    const key = buildComparisonKey(row);
    postMap.set(key, row);
  }

  const allKeys = new Set([...preMap.keys(), ...postMap.keys()]);
  const sortedKeys = [...allKeys].sort();

  return sortedKeys.map(key => ({
    key,
    preRow: preMap.get(key) ?? null,
    postRow: postMap.get(key) ?? null,
  }));
}

// ─── Completeness Comparison ─────────────────────────────────────────────────

const COMPLETENESS_RANK: Record<string, number> = {
  COMPLETE: 2,
  PARTIAL: 1,
  EMPTY: 0,
};

/**
 * Compare scoringCompletenessStatus between pre and post rows.
 * Direction: degraded = rank decreased, improved = rank increased, same = equal.
 */
export function compareScoringCompleteness(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): RowImpactResult['completenessComparison'] {
  const pre = preRow?.scoringCompletenessStatus ??
    preRow?.activeScoringSnapshot?.completenessStatus ?? null;
  const post = postRow?.scoringCompletenessStatus ??
    postRow?.activeScoringSnapshot?.completenessStatus ?? null;

  const preRank = pre !== null ? (COMPLETENESS_RANK[pre] ?? -1) : -1;
  const postRank = post !== null ? (COMPLETENESS_RANK[post] ?? -1) : -1;
  const changed = pre !== post;

  let direction: 'degraded' | 'improved' | 'same' | 'unknown' = 'unknown';
  if (!changed) direction = 'same';
  else if (preRank >= 0 && postRank >= 0) {
    direction = postRank < preRank ? 'degraded' : 'improved';
  }

  return { pre, post, changed, direction };
}

// ─── Bucket Comparison ────────────────────────────────────────────────────────

/**
 * Compare top-level researchBucket between pre and post rows.
 */
export function compareBucket(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): RowImpactResult['bucketComparison'] {
  const pre = preRow?.researchBucket ?? null;
  const post = postRow?.researchBucket ?? null;
  return { pre, post, changed: pre !== post };
}

// ─── Score Comparison ─────────────────────────────────────────────────────────

/**
 * Compare alphaScore and scoreSnapshot between pre and post rows.
 * Uses activeScoringSnapshot.alphaScore if available.
 * Does NOT use returnPct or outcomeSnapshot.
 */
export function compareScoreSnapshot(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): ScoreComparison {
  const preAlpha = preRow?.activeScoringSnapshot?.alphaScore ?? null;
  const postAlpha = postRow?.activeScoringSnapshot?.alphaScore ?? null;
  const delta = preAlpha !== null && postAlpha !== null ? postAlpha - preAlpha : null;

  const preSnap = preRow?.activeScoringSnapshot?.scoreSnapshot ??
    preRow?.scoreSnapshot ?? null;
  const postSnap = postRow?.activeScoringSnapshot?.scoreSnapshot ??
    postRow?.scoreSnapshot ?? null;

  const snapshotChanged = JSON.stringify(preSnap) !== JSON.stringify(postSnap);
  const alphaChanged = preAlpha !== postAlpha;

  return {
    preAlphaScore: preAlpha,
    postAlphaScore: postAlpha,
    delta,
    changed: alphaChanged || snapshotChanged,
    preScoreSnapshot: preSnap as Record<string, number> | null,
    postScoreSnapshot: postSnap as Record<string, number> | null,
    snapshotChanged,
  };
}

// ─── Signal Comparison ────────────────────────────────────────────────────────

/**
 * Compare signalSnapshot arrays between pre and post rows.
 * Does NOT use returnPct or outcomeSnapshot.
 */
export function compareSignalSnapshot(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): SignalComparison {
  const preSignals: string[] = (preRow?.activeScoringSnapshot?.signalSnapshot ?? []) as string[];
  const postSignals: string[] = (postRow?.activeScoringSnapshot?.signalSnapshot ?? []) as string[];

  const preSet = new Set(preSignals);
  const postSet = new Set(postSignals);

  const added = postSignals.filter(s => !preSet.has(s));
  const removed = preSignals.filter(s => !postSet.has(s));
  const changed = added.length > 0 || removed.length > 0 ||
    JSON.stringify(preSignals) !== JSON.stringify(postSignals);

  return { preSignals, postSignals, added, removed, changed };
}

// ─── Reason Comparison ────────────────────────────────────────────────────────

/**
 * Compare reasonSnapshot string between pre and post rows.
 */
export function compareReasonSnapshot(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): ReasonComparison {
  const preReason = (preRow?.activeScoringSnapshot?.reasonSnapshot as string) ?? '';
  const postReason = (postRow?.activeScoringSnapshot?.reasonSnapshot as string) ?? '';
  return { preReason, postReason, changed: preReason !== postReason };
}

// ─── Factor Comparison ────────────────────────────────────────────────────────

/**
 * Compare factorSnapshot arrays between pre and post rows.
 */
export function compareFactorSnapshot(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): FactorComparison {
  const preFactors: string[] = (preRow?.activeScoringSnapshot?.factorSnapshot ?? []) as string[];
  const postFactors: string[] = (postRow?.activeScoringSnapshot?.factorSnapshot ?? []) as string[];

  const preSet = new Set(preFactors);
  const postSet = new Set(postFactors);

  const added = postFactors.filter(f => !preSet.has(f));
  const removed = preFactors.filter(f => !postSet.has(f));
  const changed = added.length > 0 || removed.length > 0 ||
    JSON.stringify(preFactors) !== JSON.stringify(postFactors);

  return { preFactors, postFactors, added, removed, changed };
}

// ─── Impact Classification ────────────────────────────────────────────────────

/**
 * Classify impact between a pre and post row pair.
 * Does NOT use returnPct or outcomeSnapshot.
 * MonthlyRevenue exclusion is detected from missingSources / pitGateStatus.
 */
export function classifyPitImpactChange(
  preRow: ActiveScoringRow | null,
  postRow: ActiveScoringRow | null
): PitImpactChangeClassification[] {
  if (!preRow && !postRow) return ['SHAPE_MISMATCH'];
  if (!preRow) return ['MISSING_PRE_ROW'];
  if (!postRow) return ['MISSING_POST_ROW'];

  const classifications: PitImpactChangeClassification[] = [];

  const completeness = compareScoringCompleteness(preRow, postRow);
  const bucket = compareBucket(preRow, postRow);
  const score = compareScoreSnapshot(preRow, postRow);
  const signal = compareSignalSnapshot(preRow, postRow);
  const reason = compareReasonSnapshot(preRow, postRow);
  const factor = compareFactorSnapshot(preRow, postRow);

  if (completeness.changed) classifications.push('COMPLETENESS_CHANGED');
  if (bucket.changed) classifications.push('BUCKET_CHANGED');
  if (score.changed) classifications.push('SCORE_CHANGED');
  if (signal.changed) classifications.push('SIGNAL_CHANGED');
  if (reason.changed) classifications.push('REASON_CHANGED');
  if (factor.changed) classifications.push('FACTOR_CHANGED');

  // MonthlyRevenue exclusion: present in missingSources in both pre and post
  const postMissing = postRow?.activeScoringSnapshot?.missingSources ?? [];
  const pitStatus = postRow?.monthlyRevenuePitGateStatus ??
    postRow?.activeScoringSnapshot?.monthlyRevenuePitGateStatus ?? null;

  const monthlyRevenueInMissing = Array.isArray(postMissing) &&
    postMissing.some(s => typeof s === 'string' && s.toLowerCase().includes('monthlyrevenue'));

  const pitExcluded = pitStatus === 'GATE_REJECTED_UNRELEASED' ||
    pitStatus === 'NOT_APPLICABLE_NO_DATA' && monthlyRevenueInMissing;

  if (pitExcluded) classifications.push('MONTHLY_REVENUE_EXCLUDED');

  if (classifications.length === 0) classifications.push('NO_CHANGE');

  return classifications;
}

// ─── Full Row Impact ──────────────────────────────────────────────────────────

function getPrimaryClassification(
  classes: PitImpactChangeClassification[]
): PitImpactChangeClassification {
  const priority: PitImpactChangeClassification[] = [
    'MISSING_PRE_ROW',
    'MISSING_POST_ROW',
    'SHAPE_MISMATCH',
    'COMPLETENESS_CHANGED',
    'BUCKET_CHANGED',
    'SCORE_CHANGED',
    'REASON_CHANGED',
    'SIGNAL_CHANGED',
    'FACTOR_CHANGED',
    'MONTHLY_REVENUE_EXCLUDED',
    'NO_CHANGE',
  ];
  for (const p of priority) {
    if (classes.includes(p)) return p;
  }
  return classes[0] ?? 'NO_CHANGE';
}

function getHorizonDays(row: ActiveScoringRow | null): number | string | null {
  if (!row) return null;
  if (row.horizonDays !== undefined && row.horizonDays !== null) return row.horizonDays;
  if (row.duplicateKey) {
    const parts = row.duplicateKey.split('|');
    if (parts.length >= 3) return parts[2];
  }
  return null;
}

export function buildRowImpactResult(pair: AlignedRowPair): RowImpactResult {
  const { key, preRow, postRow } = pair;
  const refRow = preRow ?? postRow;

  const classifications = classifyPitImpactChange(preRow, postRow);
  const primaryClassification = getPrimaryClassification(classifications);

  const pitStatus = postRow?.monthlyRevenuePitGateStatus ??
    postRow?.activeScoringSnapshot?.monthlyRevenuePitGateStatus ?? null;

  const postMissing = postRow?.activeScoringSnapshot?.missingSources ?? [];
  const monthlyRevenueInMissing = Array.isArray(postMissing) &&
    postMissing.some(s => typeof s === 'string' && s.toLowerCase().includes('monthlyrevenue'));

  return {
    key,
    symbol: refRow?.symbol ?? null,
    originalAsOfDate: refRow?.originalAsOfDate ?? null,
    horizonDays: getHorizonDays(refRow ?? null),
    classifications,
    primaryClassification,
    completenessComparison: compareScoringCompleteness(preRow, postRow),
    bucketComparison: compareBucket(preRow, postRow),
    scoreComparison: compareScoreSnapshot(preRow, postRow),
    signalComparison: compareSignalSnapshot(preRow, postRow),
    reasonComparison: compareReasonSnapshot(preRow, postRow),
    factorComparison: compareFactorSnapshot(preRow, postRow),
    monthlyRevenuePitGateStatus: pitStatus as string | null,
    monthlyRevenueExcluded: monthlyRevenueInMissing,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * Summarize impact across all aligned row pairs.
 * Deterministic: order does not affect summary counts.
 */
export function summarizePitImpactComparison(
  alignedRows: AlignedRowPair[]
): PitImpactSummary {
  const results = alignedRows.map(pair => buildRowImpactResult(pair));

  const missingPre = results.filter(r => r.classifications.includes('MISSING_PRE_ROW')).length;
  const missingPost = results.filter(r => r.classifications.includes('MISSING_POST_ROW')).length;

  const classificationCounts: Record<string, number> = {};
  for (const r of results) {
    for (const c of r.classifications) {
      classificationCounts[c] = (classificationCounts[c] || 0) + 1;
    }
  }

  const completenessImpact = { degraded: 0, improved: 0, same: 0, unknown: 0 };
  for (const r of results) {
    const dir = r.completenessComparison.direction;
    if (dir === 'degraded') completenessImpact.degraded++;
    else if (dir === 'improved') completenessImpact.improved++;
    else if (dir === 'same') completenessImpact.same++;
    else completenessImpact.unknown++;
  }

  return {
    phase: 'P20-HARDRESET',
    generatedAt: new Date().toISOString(),
    totalAligned: results.length,
    missingPreRows: missingPre,
    missingPostRows: missingPost,
    classificationCounts,
    completenessImpact,
    bucketChangedCount: results.filter(r => r.bucketComparison.changed).length,
    scoreChangedCount: results.filter(r => r.scoreComparison.changed).length,
    signalChangedCount: results.filter(r => r.signalComparison.changed).length,
    reasonChangedCount: results.filter(r => r.reasonComparison.changed).length,
    factorChangedCount: results.filter(r => r.factorComparison.changed).length,
    monthlyRevenueExcludedCount: results.filter(r => r.monthlyRevenueExcluded).length,
    noChangeCount: results.filter(r => r.primaryClassification === 'NO_CHANGE').length,
    productionApplyAllowed: false,
    productionDbWritten: false,
  };
}
