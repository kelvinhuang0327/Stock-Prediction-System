export type JobTriggerSource = 'api' | 'cli' | 'local_scheduler' | 'os_cron';

export type JobRunMode = 'live_run' | 'missed_run' | 'backfill_data_run';

export type JobRunStatus = 'running' | 'success' | 'failed' | 'skipped';
export type JobHealthStatus = 'ok' | 'delayed' | 'failed' | 'never-ran';
export type JobAlertSeverity = 'info' | 'warning' | 'critical';

export interface JobRunLogRecord {
  id?: number;
  jobName: string;
  scheduledFor: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: JobRunStatus;
  runMode: JobRunMode;
  triggerSource: JobTriggerSource;
  idempotencyKey: string;
  summary: string | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface JobRunStartInput {
  jobName: string;
  scheduledFor: Date;
  triggerSource: JobTriggerSource;
  runMode?: JobRunMode;
  idempotencyKey?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  force?: boolean;
}

export interface JobRunStartResult {
  run: JobRunLogRecord;
  shouldRun: boolean;
  reason: 'new' | 'retry' | 'forced' | 'duplicate_success' | 'already_running';
}

export interface JobRunCompletionInput {
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface JobRunFailureInput {
  error: unknown;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface JobRunnerContext {
  jobName: string;
  scheduledFor: Date;
  triggerSource: JobTriggerSource;
  runMode: JobRunMode;
  force: boolean;
}

export interface JobRunnerOutput<T> {
  summary: string;
  metadata?: Record<string, unknown>;
  payload?: T;
}

export interface JobExecutionResult<T> {
  jobRun: JobRunLogRecord;
  skipped: boolean;
  reason?: string;
  outcome?: T | null;
}

export interface JobHealthRow {
  jobName: string;
  scheduledFor: string;
  latestRun: JobRunLogRecord | null;
  missed: boolean;
  canRerun: boolean;
  triggerSource: JobTriggerSource | null;
  runMode: JobRunMode | null;
  lastErrorMessage: string | null;
  status: JobRunStatus | 'never-ran';
  healthStatus: JobHealthStatus;
  healthReason: string;
  lastSuccessfulRunAt: string | null;
  failureStreak: number;
  summary: string;
  limitations: string[];
}

export interface JobAlert {
  jobName: string;
  severity: JobAlertSeverity;
  message: string;
  detectedAt: string;
}

export interface JobAlertRecord extends JobAlert {
  id: number;
  alertKey: string;
  status: 'active' | 'resolved' | 'suppressed';
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  occurrenceCount: number;
  latestJobRunLogId: number | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobHealthSummary {
  total: number;
  ok: number;
  delayed: number;
  failed: number;
  neverRan: number;
}

export type AutonomousJobName =
  | 'autonomous:daily'
  | 'autonomous:monitor'
  | 'autonomous:review'
  | 'autonomous:learning'
  | 'training:intraday_monitor'
  | 'training:daily_cycle'
  | 'training:nightly_opt'
  | 'training:weekly_deep';

export type BackfillTaskType =
  | 'stock_quote'
  | 'market_index'
  | 'news_event'
  | 'financial_report'
  | 'monthly_revenue'
  | 'review_followup_price';

export interface DataBackfillTaskRecord {
  id?: number;
  taskKey: string;
  taskType: BackfillTaskType;
  runMode: JobRunMode;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked';
  scope: 'global' | 'symbol' | 'autonomous';
  symbol: string | null;
  targetDate: string | null;
  sourceJobName: string | null;
  sourceIdempotencyKey: string | null;
  reason: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  summary: string | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
