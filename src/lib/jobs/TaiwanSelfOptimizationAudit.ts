import nodeFs from 'node:fs/promises';
import nodePath from 'node:path';

import { prisma } from '../prisma';
import { getOrchestratorSummary } from '../agent-orchestrator/service';
import { loadProjectProfile } from '../agent-orchestrator/profile';
import { loadSchedulerState, loadTaskIndex } from '../agent-orchestrator/storage';
import { getAutonomousJobsStatus } from './autonomousJobStatus';
import { getTrainingSchedulerStatus } from '../training/TrainingScheduler';

export interface TaiwanSelfAuditRecommendation {
  severity: 'P0' | 'P1' | 'P2';
  title: string;
  detail: string;
}

export interface TaiwanSelfAuditInput {
  schedulerEnabled: boolean;
  queuedOptimizationTasks: number;
  runningOptimizationTasks: number;
  missedCriticalJobs: string[];
  activeInsights: number;
  failedJobs: string[];
  delayedJobs: string[];
}

export interface TaiwanSelfAuditReport {
  generatedAt: string;
  schedulerEnabled: boolean;
  thresholdsChanged: false;
  queuedOptimizationTasks: number;
  runningOptimizationTasks: number;
  activeInsights: number;
  failedJobs: string[];
  delayedJobs: string[];
  missedCriticalJobs: string[];
  orchestrator: Awaited<ReturnType<typeof getOrchestratorSummary>>;
  training: Awaited<ReturnType<typeof getTrainingSchedulerStatus>>;
  recommendations: TaiwanSelfAuditRecommendation[];
  reportPath: string;
}

export function buildTaiwanSelfAuditRecommendations(
  input: TaiwanSelfAuditInput,
): TaiwanSelfAuditRecommendation[] {
  const recommendations: TaiwanSelfAuditRecommendation[] = [];

  if (!input.schedulerEnabled) {
    recommendations.push({
      severity: 'P0',
      title: 'Scheduler hard-off active',
      detail: 'Global orchestrator scheduler is disabled; optimisation miner and worker automation will remain skipped until re-enabled.',
    });
  }

  if (input.missedCriticalJobs.length > 0) {
    recommendations.push({
      severity: 'P0',
      title: 'Critical scheduler windows missed',
      detail: `Missed critical jobs: ${input.missedCriticalJobs.join(', ')}. Restore scheduler execution before backlog ages out.`,
    });
  }

  if (input.failedJobs.length > 0) {
    recommendations.push({
      severity: 'P1',
      title: 'Failed optimisation jobs need diagnosis',
      detail: `Recent failed jobs: ${input.failedJobs.join(', ')}. Review job logs and failure streaks before adding more workload.`,
    });
  }

  if (input.queuedOptimizationTasks >= 3 || input.runningOptimizationTasks > 0) {
    recommendations.push({
      severity: 'P1',
      title: 'Optimisation backlog is accumulating',
      detail: `Queued=${input.queuedOptimizationTasks}, running=${input.runningOptimizationTasks}. Prioritise worker throughput before publishing more candidates.`,
    });
  }

  if (input.activeInsights >= 10 || input.delayedJobs.length > 0) {
    recommendations.push({
      severity: 'P2',
      title: 'Review insight and observability hygiene',
      detail: `Active insights=${input.activeInsights}; delayed jobs=${input.delayedJobs.join(', ') || 'none'}. Prune stale insights and keep dashboard metrics current.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'P2',
      title: 'Autonomous optimisation lane is healthy',
      detail: 'No critical or warning conditions were detected. Continue routine monitoring and weekly deep-research cadence.',
    });
  }

  return recommendations;
}

export async function generateTaiwanSelfAuditReport(now = new Date()): Promise<TaiwanSelfAuditReport> {
  const [profile, autonomousStatus, orchestrator, training] = await Promise.all([
    loadProjectProfile(),
    getAutonomousJobsStatus(now),
    getOrchestratorSummary(),
    getTrainingSchedulerStatus(),
  ]);
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);

  const optimizationTasks = index.tasks.filter((task) => task.plannerContext?.regimeState === 'OPTIMIZATION');
  const queuedOptimizationTasks = optimizationTasks.filter((task) => task.status === 'QUEUED').length;
  const runningOptimizationTasks = optimizationTasks.filter((task) => task.status === 'RUNNING').length;
  const activeInsights = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: now } },
  }).catch(() => 0);

  const failedJobs = autonomousStatus.jobs
    .filter((job) => job.status === 'failed')
    .map((job) => job.jobName)
    .filter((jobName) => jobName.startsWith('training:tw-'));
  const delayedJobs = autonomousStatus.jobs
    .filter((job) => job.healthStatus === 'delayed')
    .map((job) => job.jobName)
    .filter((jobName) => jobName.startsWith('training:tw-'));
  const missedCriticalJobs = autonomousStatus.missedJobs.filter((jobName) =>
    [
      'training:tw-optimization-miner',
      'training:tw-worker-cycle',
      'training:tw-insight-ingest',
    ].includes(jobName),
  );

  const recommendations = buildTaiwanSelfAuditRecommendations({
    schedulerEnabled: state.schedulerEnabled,
    queuedOptimizationTasks,
    runningOptimizationTasks,
    missedCriticalJobs,
    activeInsights,
    failedJobs,
    delayedJobs,
  });

  const reportPath = 'runtime/training_reports/tw_self_audit.json';
  const absoluteReportPath = nodePath.join(process.cwd(), reportPath);

  const report: TaiwanSelfAuditReport = {
    generatedAt: now.toISOString(),
    schedulerEnabled: state.schedulerEnabled,
    thresholdsChanged: false,
    queuedOptimizationTasks,
    runningOptimizationTasks,
    activeInsights,
    failedJobs,
    delayedJobs,
    missedCriticalJobs,
    orchestrator,
    training,
    recommendations,
    reportPath,
  };

  await nodeFs.mkdir(nodePath.dirname(absoluteReportPath), { recursive: true });
  await nodeFs.writeFile(absoluteReportPath, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}