import { AutonomousAlertService, type AutonomousAlertReport } from './AutonomousAlertService';
import { JobAlertHistoryService } from './JobAlertHistoryService';
import { AlertFamilyGroupingService, type AlertFamily, type AlertFamilyGroupingResult } from './AlertFamilyGroupingService';
import type { JobAlertRecord, JobHealthRow } from './types';

export interface NoisySourceFamilyRow extends AlertFamilyGroupingResult {
  count: number;
  totalOccurrences: number;
  reoccurCount: number;
  reoccurRate: number | null;
  avgResolveTimeHours: number | null;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  criticalRatio: number | null;
  activeCount: number;
  resolvedCount: number;
  noisyScore: number;
  summaryNote: string;
}

export interface NoisySourceBreakdownSummary {
  jobName: string;
  totalAlerts: number;
  totalOccurrences: number;
  familyCount: number;
  activeCount: number;
  resolvedCount: number;
  topFamily: AlertFamily | null;
  topFamilyLabel: string | null;
  topFamilyShare: number | null;
  overallSummary: string;
  source: 'persisted' | 'computed' | 'empty';
}

export interface NoisySourceBreakdownResult {
  jobName: string;
  families: NoisySourceFamilyRow[];
  topFamily: NoisySourceFamilyRow | null;
  summary: NoisySourceBreakdownSummary;
  limitations: string[];
  generatedAt: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildCutoff(days: number, now = new Date()): Date {
  return new Date(startOfUtcDay(now).getTime() - Math.max(0, days - 1) * 24 * 60 * 60 * 1000);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function buildSummaryNote(family: NoisySourceFamilyRow, totalAlerts: number): string {
  if (totalAlerts === 0) return 'No alert families were found in the selected window.';
  const share = totalAlerts > 0 ? family.count / totalAlerts : 0;
  const parts = [
    `${family.familyLabel} is the main noisy source`,
    `accounting for ${formatPct(share)} of alerts`,
  ];
  if (family.reoccurRate !== null && family.reoccurRate > 0) {
    parts.push(`with a reoccur rate of ${formatPct(family.reoccurRate)}`);
  }
  if (family.avgResolveTimeHours !== null) {
    parts.push(`and an average resolve time of ${family.avgResolveTimeHours.toFixed(1)}h`);
  }
  return `${parts.join(', ')}.`;
}

function buildOverallSummary(jobName: string, families: NoisySourceFamilyRow[]): string {
  if (families.length === 0) {
    return `No noisy alert families were identified for ${jobName}.`;
  }
  const top = families[0];
  const runnerUp = families[1];
  const parts = [
    `${jobName} is dominated by ${top.familyLabel.toLowerCase()}`,
    `with ${top.count} alert cycle(s) and ${top.totalOccurrences} total occurrences`,
  ];
  if (runnerUp && runnerUp.noisyScore > 0) {
    parts.push(`secondary source: ${runnerUp.familyLabel.toLowerCase()}`);
  }
  return `${parts.join(', ')}.`;
}

type AutonomousAlertRow = AutonomousAlertReport['alerts'][number];

function buildSyntheticRecords(jobName: string, alerts: AutonomousAlertRow[]): JobAlertRecord[] {
  return alerts.map((alert, index) => ({
    id: -(index + 1),
    jobName,
    severity: alert.severity,
    message: alert.message,
    alertKey: jobName,
    status: 'active',
    firstDetectedAt: alert.detectedAt,
    lastDetectedAt: alert.detectedAt,
    resolvedAt: null,
    occurrenceCount: 1,
    latestJobRunLogId: null,
    metadata: null,
    createdAt: alert.detectedAt,
    updatedAt: alert.detectedAt,
    detectedAt: alert.detectedAt,
  }));
}

export class NoisySourceBreakdownService {
  constructor(
    private readonly alertService = new AutonomousAlertService(),
    private readonly historyService = new JobAlertHistoryService(),
    private readonly groupingService = new AlertFamilyGroupingService(),
  ) {}

  async build(jobName: string, days = 30, now = new Date()): Promise<NoisySourceBreakdownResult> {
    const [report, persistedHistory] = await Promise.all([
      this.alertService.listAlerts({ jobName }, now).catch(() => null),
      this.historyService.listHistory(
        {
          jobName,
          includeResolved: true,
          status: 'all',
          days,
          limit: 500,
          offset: 0,
          sortBy: 'latest',
          sortDir: 'desc',
        },
        now,
      ),
    ]);

    const healthRow = report?.jobs.find((job: JobHealthRow) => job.jobName === jobName) ?? null;
    const rows: JobAlertRecord[] = persistedHistory.length > 0
      ? persistedHistory
      : report?.alerts
        ? buildSyntheticRecords(jobName, report.alerts, now)
        : [];
    const source: NoisySourceBreakdownSummary['source'] = persistedHistory.length > 0
      ? 'persisted'
      : rows.length > 0
        ? 'computed'
        : 'empty';

    const cutoff = buildCutoff(days, now);
    const recentRows = rows.filter((row) => {
      const lastDetected = parseDate(row.lastDetectedAt);
      const resolvedAt = parseDate(row.resolvedAt ?? undefined);
      return (lastDetected ? lastDetected >= cutoff : false) || (resolvedAt ? resolvedAt >= cutoff : false);
    });

  const grouped = recentRows.map((row) => ({
      row,
      family: this.groupingService.classify({ alert: row, healthRow }),
    }));

    type FamilyAccumulator = NoisySourceFamilyRow & {
      resolveHoursTotal: number;
      resolveHoursCount: number;
    };

    const aggregate = grouped.reduce<Record<AlertFamily, FamilyAccumulator>>((acc, item) => {
      const key = item.family.family;
      const existing = acc[key] ?? {
        ...item.family,
        count: 0,
        totalOccurrences: 0,
        reoccurCount: 0,
        reoccurRate: null,
        avgResolveTimeHours: null,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        criticalRatio: null,
        activeCount: 0,
        resolvedCount: 0,
        noisyScore: 0,
        summaryNote: '',
        resolveHoursTotal: 0,
        resolveHoursCount: 0,
      };

      existing.count += 1;
      existing.totalOccurrences += item.row.occurrenceCount;
      existing.reoccurCount += item.row.occurrenceCount > 1 ? 1 : 0;
      existing[item.row.severity === 'critical' ? 'criticalCount' : item.row.severity === 'warning' ? 'warningCount' : 'infoCount'] += 1;
      existing.activeCount += item.row.status === 'active' ? 1 : 0;
      existing.resolvedCount += item.row.status === 'resolved' ? 1 : 0;
      existing.groupingConfidence = Math.max(existing.groupingConfidence, item.family.groupingConfidence);
      existing.derivedReason = existing.derivedReason || item.family.derivedReason;

      if (item.row.status === 'resolved' && item.row.resolvedAt) {
        const first = parseDate(item.row.firstDetectedAt);
        const resolvedAt = parseDate(item.row.resolvedAt);
        if (first && resolvedAt) {
          const hours = (resolvedAt.getTime() - first.getTime()) / 3_600_000;
          existing.resolveHoursTotal += hours;
          existing.resolveHoursCount += 1;
        }
      }

      acc[key] = existing;
      return acc;
    }, {} as Record<AlertFamily, NoisySourceFamilyRow>);

    const families = Object.values(aggregate)
      .map((family) => {
        const { resolveHoursTotal, resolveHoursCount, ...familyBase } = family;
        void resolveHoursTotal;
        void resolveHoursCount;
        const avgResolveTimeHours = family.resolveHoursCount > 0 ? family.resolveHoursTotal / family.resolveHoursCount : null;
        const reoccurRate = family.count > 0 ? family.reoccurCount / family.count : null;
        const criticalRatio = family.count > 0 ? family.criticalCount / family.count : null;
        const resolvePenalty = avgResolveTimeHours === null ? 0 : Math.min(avgResolveTimeHours / 12, 2.5);
        const noisyScore =
          family.totalOccurrences +
          family.activeCount * 2 +
          family.reoccurCount * 1.5 +
          family.criticalCount * 1.25 +
          resolvePenalty;
        const summaryNote = buildSummaryNote(
          {
            ...familyBase,
            avgResolveTimeHours,
            reoccurRate,
            criticalRatio,
            noisyScore,
          },
          grouped.length,
        );
        return {
          ...family,
          avgResolveTimeHours,
          reoccurRate,
          criticalRatio,
          noisyScore,
          summaryNote,
        };
      })
      .sort((left, right) => right.noisyScore - left.noisyScore || right.totalOccurrences - left.totalOccurrences || right.count - left.count);

    const topFamily = families[0] ?? null;
    const totalAlerts = families.reduce((sum, family) => sum + family.count, 0);
    const totalOccurrences = families.reduce((sum, family) => sum + family.totalOccurrences, 0);
    const activeCount = families.reduce((sum, family) => sum + family.activeCount, 0);
    const resolvedCount = families.reduce((sum, family) => sum + family.resolvedCount, 0);
    const topFamilyShare = totalAlerts > 0 && topFamily ? topFamily.count / totalAlerts : null;

    const limitations = [
      ...(rows.length === 0 ? ['No alert history was found for this job in the selected window.'] : []),
      ...(recentRows.length < rows.length ? ['Older alerts were excluded by the selected window.'] : []),
      ...(families.length === 0 ? ['No stable family signal could be derived.'] : []),
      'Family grouping is heuristic and uses persisted alert history plus current job health context.',
    ];

    return {
      jobName,
      families,
      topFamily,
      summary: {
        jobName,
        totalAlerts,
        totalOccurrences,
        familyCount: families.length,
        activeCount,
        resolvedCount,
        topFamily: topFamily?.family ?? null,
        topFamilyLabel: topFamily?.familyLabel ?? null,
        topFamilyShare,
        overallSummary: buildOverallSummary(jobName, families),
        source,
      },
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
