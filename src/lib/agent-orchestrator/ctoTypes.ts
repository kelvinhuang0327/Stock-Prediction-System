// CTO Review System — TypeScript type definitions
// Transplanted from LotteryNew orchestrator, adapted for stock trading domain

// ─── Decision Types ──────────────────────────────────────────────────────────

export type CtoDecision =
  | 'PENDING_REVIEW'
  | 'ACCEPTED_FOR_LEARNING'   // SOURCE: APPROVED_FOR_MERGE
  | 'REFLECTED_IN_INSIGHT'    // SOURCE: MERGED — already in StrategyLearningInsight
  | 'REJECTED_ADJUST_SIGNAL'  // SOURCE: REJECTED_NEEDS_REPLAN
  | 'DEFERRED_REGIME_MISMATCH'// SOURCE: DEFERRED_CONFLICT — regime not suitable
  | 'DUPLICATE'
  | 'SUPERSEDED';

export const CTO_DECISION_SEVERITY: Record<CtoDecision, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
  PENDING_REVIEW:            'LOW',
  ACCEPTED_FOR_LEARNING:     'LOW',
  REFLECTED_IN_INSIGHT:      'LOW',
  REJECTED_ADJUST_SIGNAL:    'HIGH',
  DEFERRED_REGIME_MISMATCH:  'HIGH',
  DUPLICATE:                 'MEDIUM',
  SUPERSEDED:                'MEDIUM',
};

export const CTO_DECISION_URGENCY: Record<CtoDecision, 'ROUTINE' | 'SOON' | 'IMMEDIATE'> = {
  PENDING_REVIEW:            'ROUTINE',
  ACCEPTED_FOR_LEARNING:     'ROUTINE',
  REFLECTED_IN_INSIGHT:      'ROUTINE',
  REJECTED_ADJUST_SIGNAL:    'IMMEDIATE',
  DEFERRED_REGIME_MISMATCH:  'SOON',
  DUPLICATE:                 'ROUTINE',
  SUPERSEDED:                'ROUTINE',
};

// ─── Signal State ─────────────────────────────────────────────────────────────

export type SignalState =
  | 'TRUE_EXHAUSTED'     // No usable learning data — stop and wait
  | 'COLD_REGIME'        // Win rate below threshold — generate diagnostic tasks
  | 'SIGNAL_SATURATED'   // Win rate plateau — generate meta/review tasks
  | 'NORMAL';            // Healthy learning signal — run standard cycle

export interface SignalStateResult {
  state: SignalState;
  confidenceScore: number;  // 0–1
  confidenceLabel: 'low' | 'medium' | 'high';
  reason: string;
  features: SignalStateFeatures;
}

export interface SignalStateFeatures {
  organicTradeCount: number;
  fullTradeCount: number;
  trendWinRate: number | null;
  reboundWinRate: number | null;
  overallWinRate: number | null;
  winRateDelta: number | null;    // vs. previous window
  dataCoverage: string;           // full | limited | insufficient
  penalizedSetupCount: number;
  insightCount: number;
}

// ─── Run Intent ───────────────────────────────────────────────────────────────

export type CtoRunIntent =
  | 'resubmit_proposal'   // SOURCE: retry — re-examine previously rejected proposals
  | 'compare_regimes'     // SOURCE: compare — compare performance across regimes
  | 'force_learning';     // SOURCE: override — force insight generation despite low sample

// ─── Backlog ──────────────────────────────────────────────────────────────────

export type BacklogSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BacklogUrgency  = 'ROUTINE' | 'SOON' | 'IMMEDIATE';
export type BacklogCategory = 'signal' | 'data' | 'regime' | 'execution';
export type BacklogStatus   = 'open' | 'selected' | 'resolved' | 'dismissed';
export type BacklogPriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';

export interface BacklogItemInput {
  findingId: string;
  ctoRunId?: string;
  source: 'review' | 'learning' | 'data_gap' | 'regime';
  severity: BacklogSeverity;
  impactScore: number;        // 0–100
  urgency: BacklogUrgency;
  category: BacklogCategory;
  suggestedAction?: string;
  proposalId?: number;
}

export interface BacklogItemRecord {
  id: number;
  findingId: string;
  ctoRunId: string | null;
  source: string;
  severity: BacklogSeverity;
  impactScore: number;
  urgency: BacklogUrgency;
  category: BacklogCategory;
  suggestedAction: string | null;
  proposalId: number | null;
  status: BacklogStatus;
  priorityScore: number;
  priorityLevel: BacklogPriorityLevel;
  rank: number | null;
  lastSelectedAt: Date | null;
  selectionCount: number;
  agingBonus: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Adaptive Policy ──────────────────────────────────────────────────────────

export interface AdaptivePolicySuggestion {
  level: 'info' | 'recommend' | 'warn';
  text: string;
}

export interface AdaptivePolicyResult {
  resubmitMergeRate: number;
  compareApproveRate: number;
  forceLearningRate: number;
  overallAcceptRate: number;
  categoryPriorityBoosts: Record<BacklogCategory, number>;
  suggestions: AdaptivePolicySuggestion[];
  policyConfidence: 'low' | 'medium' | 'high';
  runsAnalyzed: number;
  computedAt: Date;
}

// ─── Execution Policy ─────────────────────────────────────────────────────────

export type ExecutionPolicyMode = 'strict_priority' | 'balanced' | 'fairness';

export const POLICY_HIGH_POOL_RATIO = 0.70;     // balanced: 70% P0/P1
export const CATEGORY_MAX_CONSECUTIVE = 5;
export const AGING_INTERVAL_HOURS = 6;
export const AGING_PTS_PER_INTERVAL = 3.0;
export const AGING_PTS_MAX = 30.0;

// ─── CTO Review Run ───────────────────────────────────────────────────────────

export interface CtoReviewRunInput {
  isManual: boolean;
  runIntent?: CtoRunIntent;
  parentRunId?: string;
}

export interface CtoReviewCandidate {
  proposalId: number;
  symbol: string;
  setupType: string;
  conviction: string;
  pnlPct: number | null;
  exitReason: string | null;
  tradeMode: string;
  reviewTriggerType: string | null;
  decision?: CtoDecision;
  decisionReason?: string;
}

export interface CtoReviewRunResult {
  runId: string;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  deferredCount: number;
  reflectedCount: number;
  summary: string;
  candidates: CtoReviewCandidate[];
  backlogItemsCreated: number;
}

// ─── Classifier Calibration ───────────────────────────────────────────────────

export interface ClassifierThresholdsConfig {
  coldWinRateMin: number;
  saturationDeltaMax: number;
  coldMinTrades: number;
  weightWinRate: number;
  weightTrendDelta: number;
  weightDataCoverage: number;
}

export interface ClassifierAccuracyReport {
  totalClassifications: number;
  correctClassifications: number;
  accuracyPct: number;
  recentAccuracyPct: number;   // last 20
  falsePositiveCount: number;
  falseNegativeCount: number;
  lastCalibratedAt: Date;
}
