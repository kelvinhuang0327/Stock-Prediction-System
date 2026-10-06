import fs from 'node:fs/promises';
import path from 'node:path';

export type FinalClassification =
  | 'OUTCOME_IMPROVING'
  | 'BEHAVIOR_CHANGED_BUT_OUTCOME_PENDING'
  | 'INSUFFICIENT_DATA'
  | 'NEEDS_FIX';

export type SignalQuality = 'IMPROVING' | 'WORSENING' | 'UNCHANGED' | 'INSUFFICIENT_DATA';
export type WindowStatus = 'READY' | 'INSUFFICIENT_RUNTIME_WINDOW';

export interface SelfOptimizationKpiReport {
  generatedAt: string;
  insightSource: {
    id: number;
    sourceTaskId: string;
    insightType: string;
    createdAt: string;
    expiresAt: string;
    regimeContext: string | null;
    confidence: number;
    severity: string;
    evidence: string[];
  };
  windowStatus: WindowStatus;
  beforeWindow: {
    start: string;
    end: string;
    observedHours: number;
    targetDays: number;
    sufficientForOutcome: boolean;
  };
  afterWindow: {
    start: string;
    end: string;
    observedHours: number;
    targetDays: number;
    sufficientForOutcome: boolean;
  };
  dbQueryResult: {
    after: {
      executionQuality: {
        proposalCount: number;
        tradeCount: number;
      };
      learningQuality: {
        tradeReviewReportCount: number;
      };
    };
  };
  signalQuality: SignalQuality;
  conclusion: string;
  limitations: string[];
  nextRecommendation: string;
  finalClassification: FinalClassification;
}

export type FollowupStatus =
  | 'FOLLOWUP_NOT_READY'
  | 'FOLLOWUP_NEEDS_TRADING_CYCLE_DIAGNOSIS'
  | 'FOLLOWUP_NEEDS_EXECUTION_DIAGNOSIS'
  | 'FOLLOWUP_OUTCOME_PENDING'
  | 'FOLLOWUP_READY';

export interface SelfOptimizationKpiFollowupSummary {
  status: FollowupStatus;
  activeInsightAgeHours: number;
  nextEligibleAt: string;
  afterProposals: number;
  afterTrades: number;
  afterReviews: number;
  kpiClassification: FinalClassification | 'WORSENING' | 'UNCHANGED';
  recommendedNextAction: string;
}

const FOLLOWUP_READY_HOURS = 72;
export const SELF_OPTIMIZATION_KPI_REPORT_PATH = path.join(
  process.cwd(),
  'docs',
  'reports',
  'self_optimization_kpi_report.json',
);

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeKpiClassification(
  report: SelfOptimizationKpiReport,
): SelfOptimizationKpiFollowupSummary['kpiClassification'] {
  if (report.signalQuality === 'WORSENING') return 'WORSENING';
  if (report.signalQuality === 'UNCHANGED') return 'UNCHANGED';
  return report.finalClassification;
}

export function deriveSelfOptimizationKpiFollowup(
  report: SelfOptimizationKpiReport,
  now: Date = new Date(),
): SelfOptimizationKpiFollowupSummary {
  const createdAt = new Date(report.insightSource.createdAt);
  const ageHours = (now.getTime() - createdAt.getTime()) / 3600000;
  const nextEligibleAt = new Date(createdAt.getTime() + FOLLOWUP_READY_HOURS * 3600000).toISOString();
  const afterProposals = report.dbQueryResult.after.executionQuality.proposalCount;
  const afterTrades = report.dbQueryResult.after.executionQuality.tradeCount;
  const afterReviews = report.dbQueryResult.after.learningQuality.tradeReviewReportCount;

  if (ageHours < FOLLOWUP_READY_HOURS) {
    return {
      status: 'FOLLOWUP_NOT_READY',
      activeInsightAgeHours: round(ageHours),
      nextEligibleAt,
      afterProposals,
      afterTrades,
      afterReviews,
      kpiClassification: normalizeKpiClassification(report),
      recommendedNextAction: 'Wait until the active insight reaches 72 hours of age, then rerun the KPI follow-up check.',
    };
  }

  if (afterProposals === 0 && afterTrades === 0) {
    return {
      status: 'FOLLOWUP_NEEDS_TRADING_CYCLE_DIAGNOSIS',
      activeInsightAgeHours: round(ageHours),
      nextEligibleAt,
      afterProposals,
      afterTrades,
      afterReviews,
      kpiClassification: normalizeKpiClassification(report),
      recommendedNextAction: 'Inspect why no post-insight proposals or trades were produced after the 72-hour readiness window.',
    };
  }

  if (afterProposals > 0 && afterTrades === 0) {
    return {
      status: 'FOLLOWUP_NEEDS_EXECUTION_DIAGNOSIS',
      activeInsightAgeHours: round(ageHours),
      nextEligibleAt,
      afterProposals,
      afterTrades,
      afterReviews,
      kpiClassification: normalizeKpiClassification(report),
      recommendedNextAction: 'Inspect execution and risk paths because proposals are being created but no trades are opening.',
    };
  }

  if (afterTrades > 0 && afterReviews === 0) {
    return {
      status: 'FOLLOWUP_OUTCOME_PENDING',
      activeInsightAgeHours: round(ageHours),
      nextEligibleAt,
      afterProposals,
      afterTrades,
      afterReviews,
      kpiClassification: normalizeKpiClassification(report),
      recommendedNextAction: 'Wait for TradeReviewReport generation so outcome quality can be evaluated conservatively.',
    };
  }

  return {
    status: 'FOLLOWUP_READY',
    activeInsightAgeHours: round(ageHours),
    nextEligibleAt,
    afterProposals,
    afterTrades,
    afterReviews,
    kpiClassification: normalizeKpiClassification(report),
    recommendedNextAction: 'Use the KPI classification to decide whether the post-insight behavior is improving, unchanged, worsening, or still insufficiently evidenced.',
  };
}

export async function readSelfOptimizationKpiReport(
  reportPath: string = SELF_OPTIMIZATION_KPI_REPORT_PATH,
): Promise<SelfOptimizationKpiReport> {
  const raw = await fs.readFile(reportPath, 'utf8');
  return JSON.parse(raw) as SelfOptimizationKpiReport;
}

export async function runSelfOptimizationKpiFollowup(options?: {
  now?: Date;
  reportPath?: string;
  regenerateReport?: () => Promise<void> | void;
}): Promise<SelfOptimizationKpiFollowupSummary> {
  const reportPath = options?.reportPath ?? SELF_OPTIMIZATION_KPI_REPORT_PATH;
  const now = options?.now ?? new Date();

  let report = await readSelfOptimizationKpiReport(reportPath);
  let summary = deriveSelfOptimizationKpiFollowup(report, now);

  if (summary.status === 'FOLLOWUP_NOT_READY' || !options?.regenerateReport) {
    return summary;
  }

  await options.regenerateReport();
  report = await readSelfOptimizationKpiReport(reportPath);
  summary = deriveSelfOptimizationKpiFollowup(report, now);
  return summary;
}
