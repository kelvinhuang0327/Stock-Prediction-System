/**
 * TrainingSchedulerTypes.ts
 *
 * Shared type definitions for the Autonomous Training Scheduler.
 *
 * Scheduling layers:
 *   Layer 1 — INTRADAY_MONITOR  every 30 minutes
 *   Layer 2 — DAILY_CYCLE       end-of-day (TWSE close)
 *   Layer 3 — NIGHTLY_OPT       after-market optimisation
 *   Layer 4 — WEEKLY_DEEP       Saturday deep-training run
 */

// ─── Layer identity ───────────────────────────────────────────────────────────

export type TrainingLayer = 'intraday_monitor' | 'daily_cycle' | 'nightly_opt' | 'weekly_deep';

export type TrainingJobName =
  | 'training:intraday_monitor'
  | 'training:daily_cycle'
  | 'training:nightly_opt'
  | 'training:weekly_deep';

// ─── Training axes ────────────────────────────────────────────────────────────

/** Which improvement axis a task belongs to. */
export type TrainingAxis = 'data' | 'strategy' | 'system';

// ─── Source types mined by the TrainingMiner ─────────────────────────────────

export type TrainingSourceType =
  | 'trigger_score_vs_return'     // Layer 4: score predictiveness
  | 'mfe_mae_distribution'        // Layer 4: stop/target fit
  | 'setup_performance_breakdown' // Layer 4: per-setup P&L analysis
  | 'time_exit_dominance'         // Layer 2/4: exit-reason analysis
  | 'sector_alignment'            // Layer 4: regime vs sector fit
  | 'volatility_stop_validation'  // Layer 4: volatility-adjusted stop fit
  | 'data_freshness_audit'        // Layer 1/3: quote freshness scan
  | 'indicator_coverage_check'    // Layer 3: indicator history depth
  | 'lifecycle_stuck_detection'   // Layer 1: open-trade lifecycle
  | 'execution_layer_audit'       // Layer 3: execution engine review
  | 'learning_layer_audit'        // Layer 3: learning pipeline review
  | 'price_analysis_quality'      // Layer 3: price-analysis quality
  | 'system_health'               // Layer 3: system health
  | 'code_quality'                // Layer 3: code quality
  | 'ui_ux'                       // Layer 3: UI/UX review
  | 'wiki_docs';                  // Layer 3: documentation coverage

// ─── Task risk level (mirrors agent-orchestrator) ────────────────────────────

export type TrainingRiskLevel = 'low' | 'medium' | 'high';

// ─── TrainingTask ─────────────────────────────────────────────────────────────

export interface TrainingTask {
  /** Globally unique key for deduplication (TTL = 14 days). */
  dedupeKey: string;
  /** Human-readable task title. */
  title: string;
  /** Which improvement axis this task drives. */
  axis: TrainingAxis;
  /** Source that generated this task. */
  source: TrainingSourceType;
  /** Which scheduling layer this belongs to. */
  layer: TrainingLayer;
  /** Expected clock time in hours (must be 4–8). */
  estimatedDurationHours: number;
  risk: TrainingRiskLevel;
  /** What the task must produce — measurable. */
  acceptanceCriteria: string[];
  /** Output file paths relative to workspace root. */
  outputPaths: string[];
  /**
   * SAFETY — what the task MUST NOT change.
   * Always includes stop-loss, targets, risk floor, position sizing.
   */
  forbiddenChanges: string[];
  /** ISO timestamp when this was created. */
  createdAt: string;
  /** The day string used for quota accounting (YYYY-MM-DD). */
  quotaDate: string;
}

// ─── Task output → insight bridge ────────────────────────────────────────────

export interface TrainingInsightCandidate {
  /** Maps to OptimizationInsightRecord.insightType */
  insightType:
    | 'score_bias'
    | 'setup_imbalance'
    | 'time_exit_dominance'
    | 'data_quality_issue'
    | 'indicator_insufficient'
    | 'sector_misalignment';
  sourceTaskDedupeKey: string;
  evidence: string[];         // ≥ 2 for critical tier
  confidence: number;         // 0.0–1.0; must be ≥ 0.6 to pass guardrail
  severity: 'low' | 'medium' | 'high';
  affectedSetupTypes: string[];
  affectedSymbols: string[];
  /** TTL in days; set by TTL_DAYS from InsightIntegrationLayer. */
  ttlDays: number;
  regimeContext?: string;
}

// ─── Scheduler status (observability) ────────────────────────────────────────

export interface TrainingSchedulerStatus {
  schedulerPid: number | null;
  startedAt: string | null;
  uptimeSeconds: number | null;
  // Per-layer last-run tracking
  layers: Record<TrainingLayer, LayerStatus>;
  // Insight state
  insightCounts: {
    active: number;
    expired: number;
    byType: Record<string, number>;
  };
  // Gate state
  gatedSetupTypes: string[];
  probeActivity: ProbeActivitySummary;
  recoveryEvents: RecoveryEventSummary;
  // Task execution
  taskLog: TaskLogEntry[];
  // Quota remaining today
  quotaRemaining: { low: number; medium: number; high: number };
}

export interface LayerStatus {
  layer: TrainingLayer;
  lastRunAt: string | null;
  lastStatus: 'success' | 'failed' | 'skipped' | 'never_ran';
  nextDueAt: string | null;
  runCount: number;
  lastSummary: string | null;
}

export interface ProbeActivitySummary {
  totalProbeAttempts: number;
  allowedProbes: number;
  deniedProbes: number;
  lastProbeAt: string | null;
}

export interface RecoveryEventSummary {
  totalExpiredGates: number;
  totalDowngrades: number;
  totalDiversityRescues: number;
  lastRecoveryAt: string | null;
}

export interface TaskLogEntry {
  dedupeKey: string;
  title: string;
  source: TrainingSourceType;
  layer: TrainingLayer;
  risk: TrainingRiskLevel;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'skipped';
  summary: string | null;
  insightsCandidates: number;
}

// ─── Miner quota ─────────────────────────────────────────────────────────────

export interface TrainingMinerQuota {
  date: string;           // YYYY-MM-DD
  low: number;
  medium: number;
  high: number;
}

export const TRAINING_QUOTA_MAX: Readonly<Record<TrainingRiskLevel, number>> = {
  low: 5,
  medium: 3,
  high: 1,
};

// ─── Miner state (persisted to disk) ─────────────────────────────────────────

export interface TrainingMinerState {
  version: '1.0';
  publishedDedupeKeys: Record<string, string>; // dedupeKey → ISO publishedAt
  dailyQuota: TrainingMinerQuota;
  lastRunAt: string | null;
  probeActivity: ProbeActivitySummary;
  recoveryEvents: RecoveryEventSummary;
}

// ─── Layer runner I/O ─────────────────────────────────────────────────────────

export interface LayerRunResult {
  layer: TrainingLayer;
  ranAt: string;
  summary: string;
  tasksCreated: number;
  insightsCandidates: number;
  metadata: Record<string, unknown>;
}
