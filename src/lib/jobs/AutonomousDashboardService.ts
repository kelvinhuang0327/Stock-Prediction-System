import { prisma } from '../prisma';
import { AutonomousAlertService } from './AutonomousAlertService';
import { JobAlertService } from './JobAlertService';
import { getAutonomousJobsStatus } from './autonomousJobStatus';
import type { JobAlert, JobHealthRow, JobHealthSummary } from './types';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface AutonomousSnapshotSummary {
  id: number;
  snapshotDate: string;
  marketState: string;
  marketRegime: string;
  marketRegimeConfidence: number | null;
  dataCoverage: string;
  candidateCount: number;
  sectorStrengthCount: number;
  riskSignalCount: number;
  topInsightCount: number;
  limitationCount: number;
}

export interface AutonomousCountSummary {
  total: number;
  proposed?: number;
  approved?: number;
  rejected?: number;
  triggered?: number;
  open?: number;
  closed?: number;
  expired?: number;
}

export interface AutonomousLearningSummary {
  total: number;
  latestGeneratedAt: string | null;
  summary: string | null;
  sourceCount: number | null;
  limitationCount: number;
}

export interface AutonomousAlertSummarySnapshot {
  total: number;
  active: number;
  resolved: number;
  suppressed: number;
  critical: number;
  warning: number;
  info: number;
  topNoisyJobs: Array<{ jobName: string; occurrenceCount: number }>;
}

export interface AutonomousDashboardSummary {
  generatedAt: string;
  latestSnapshot: AutonomousSnapshotSummary | null;
  marketSummary: {
    marketState: string | null;
    marketRegime: string | null;
    regimeConfidence: number | null;
    dataCoverage: string | null;
    snapshotDate: string | null;
  };
  proposalSummary: AutonomousCountSummary;
  tradeSummary: AutonomousCountSummary;
  reviewSummary: {
    total: number;
    latestGeneratedAt: string | null;
  };
  learningSummary: AutonomousLearningSummary;
  alertSummary: AutonomousAlertSummarySnapshot;
  jobHealth: {
    summary: string;
    jobs: JobHealthRow[];
    missedJobs: string[];
    failedJobs: string[];
    neverRanJobs: string[];
    alerts: JobAlert[];
    healthSummary: JobHealthSummary;
  };
  limitations: string[];
}

function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function countArray(value: JsonValue): number {
  return Array.isArray(value) ? value.length : 0;
}

function countByField<T extends Record<string, string>>(rows: T[], field: keyof T): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row[field] ?? 'unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function parseLearningSummary(row: {
  generatedAt: string;
  summary: string;
  sourceCount: number;
  limitations: string | null;
} | null): AutonomousLearningSummary {
  return {
    total: row ? 1 : 0,
    latestGeneratedAt: row?.generatedAt ?? null,
    summary: row?.summary ?? null,
    sourceCount: row?.sourceCount ?? null,
    limitationCount: countArray(safeParse(row?.limitations, [] as string[])),
  };
}

function buildLimitations(parts: Array<string | null | undefined>): string[] {
  return parts.filter((value): value is string => Boolean(value));
}

export async function getAutonomousDashboardSummary(now = new Date()): Promise<AutonomousDashboardSummary> {
  const alertService = new AutonomousAlertService();
  const alertHistoryService = new JobAlertService();
  const [snapshot, proposals, trades, reviews, learningInsight, jobHealth, alertReport] = await Promise.all([
    prisma.autonomousResearchSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.strategyProposal.findMany({
      select: { state: true },
    }),
    prisma.simulatedTrade.findMany({
      select: { status: true },
    }),
    prisma.tradeReviewReport.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 50,
      select: { generatedAt: true },
    }),
    prisma.strategyLearningInsight.findFirst({ orderBy: { createdAt: 'desc' } }),
    getAutonomousJobsStatus(now),
    alertService.listAlerts({}, now),
  ]);
  const alertSummary = await alertHistoryService.summarizeAlerts(14).catch(() => ({
    total: 0,
    active: 0,
    resolved: 0,
    suppressed: 0,
    critical: 0,
    warning: 0,
    info: 0,
    topNoisyJobs: [],
  }));

  const parsedSnapshot = snapshot
    ? {
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
        marketState: snapshot.marketState,
        marketRegime: snapshot.marketState,
        marketRegimeConfidence: null,
        dataCoverage: snapshot.dataCoverage,
        candidateCount: countArray(safeParse<JsonValue[]>(snapshot.candidateStocks, [])),
        sectorStrengthCount: countArray(safeParse<JsonValue[]>(snapshot.sectorStrength, [])),
        riskSignalCount: countArray(safeParse<JsonValue[]>(snapshot.riskSignals, [])),
        topInsightCount: countArray(safeParse<JsonValue[]>(snapshot.topInsights, [])),
        limitationCount: countArray(safeParse<string[]>(snapshot.limitations, [])),
      }
    : null;

  const proposalCounts = countByField(proposals, 'state');
  const tradeCounts = countByField(trades, 'status');

  const proposalSummary: AutonomousCountSummary = {
    total: proposals.length,
    proposed: proposalCounts.proposed ?? 0,
    approved: proposalCounts.approved ?? 0,
    rejected: proposalCounts.rejected ?? 0,
    triggered: proposalCounts.triggered ?? 0,
    open: proposalCounts.open ?? 0,
    closed: proposalCounts.closed ?? 0,
    expired: proposalCounts.expired ?? 0,
  };

  const tradeSummary: AutonomousCountSummary = {
    total: trades.length,
    open: tradeCounts.open ?? 0,
    closed: tradeCounts.closed ?? 0,
    triggered: tradeCounts.triggered ?? 0,
  };

  const reviewSummary = {
    total: reviews.length,
    latestGeneratedAt: reviews[0]?.generatedAt.toISOString() ?? null,
  };

  const learningSummary = parseLearningSummary(learningInsight);

  const failedJobs = jobHealth.jobs.filter((job) => job.status === 'failed').map((job) => job.jobName);

  const limitations = buildLimitations([
    snapshot ? null : 'No autonomous research snapshot yet.',
    proposals.length === 0 ? 'No strategy proposals have been recorded yet.' : null,
    trades.length === 0 ? 'No simulated trades have been recorded yet.' : null,
    reviews.length === 0 ? 'No review reports have been recorded yet.' : null,
    !learningInsight ? 'No strategy learning insight has been recorded yet.' : null,
    ...jobHealth.limitations,
  ]);

  return {
    generatedAt: now.toISOString(),
    latestSnapshot: parsedSnapshot,
    marketSummary: {
      marketState: snapshot?.marketState ?? null,
      marketRegime: snapshot?.marketState ?? null,
      regimeConfidence: null,
      dataCoverage: snapshot?.dataCoverage ?? null,
      snapshotDate: snapshot?.snapshotDate ?? null,
    },
    proposalSummary,
    tradeSummary,
    reviewSummary,
    learningSummary,
    alertSummary,
    jobHealth: {
      summary: jobHealth.summary,
      jobs: jobHealth.jobs,
      missedJobs: jobHealth.missedJobs,
      failedJobs,
      neverRanJobs: jobHealth.neverRanJobs,
      alerts: alertReport.alerts,
      healthSummary: jobHealth.healthSummary,
    },
    limitations,
  };
}
