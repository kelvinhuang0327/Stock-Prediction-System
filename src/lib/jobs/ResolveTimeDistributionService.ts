import { JobAlertHistoryService } from './JobAlertHistoryService';
import { AlertFamilyGroupingService, type AlertFamily } from './AlertFamilyGroupingService';
import type { JobAlertRecord } from './types';

export interface ResolveTimeDistributionFamilyRow {
  family: AlertFamily;
  familyLabel: string;
  resolvedCount: number;
  unresolvedCount: number;
  avgResolveTimeHours: number | null;
  medianResolveTimeHours: number | null;
  p90ResolveTimeHours: number | null;
  maxResolveTimeHours: number | null;
  unresolvedRatio: number | null;
  distributionSummary: string;
  limitations: string[];
}

export interface ResolveTimeDistributionResult {
  jobName: string;
  days: number;
  families: ResolveTimeDistributionFamilyRow[];
  overallSummary: string;
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

function familyLabelFor(family: AlertFamily): string {
  const labels: Record<AlertFamily, string> = {
    never_ran: 'Never ran',
    missed_run: 'Missed run',
    failed_run: 'Failed run',
    consecutive_failure: 'Consecutive failure',
    delayed_run: 'Delayed run',
    recovery_event: 'Recovery event',
    unknown_family: 'Unknown family',
  };
  return labels[family];
}

function calculateQuantile(sortedValues: number[], quantile: number): number | null {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * quantile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function buildSummary(row: ResolveTimeDistributionFamilyRow): string {
  const parts = [
    `${row.familyLabel} has ${row.resolvedCount} resolved cycle(s)`,
    row.avgResolveTimeHours === null ? 'with insufficient resolve-time samples' : `avg resolve ${row.avgResolveTimeHours.toFixed(1)}h`,
  ];
  if (row.unresolvedRatio !== null) {
    parts.push(`unresolved ratio ${Math.round(row.unresolvedRatio * 100)}%`);
  }
  return `${parts.join(', ')}.`;
}

function buildOverallSummary(jobName: string, families: ResolveTimeDistributionFamilyRow[]): string {
  if (families.length === 0) return `No resolve-time samples were found for ${jobName}.`;
  const sorted = [...families].sort((left, right) => {
    const leftScore = (left.avgResolveTimeHours ?? 0) + (left.unresolvedRatio ?? 0) * 12;
    const rightScore = (right.avgResolveTimeHours ?? 0) + (right.unresolvedRatio ?? 0) * 12;
    return rightScore - leftScore;
  });
  const top = sorted[0];
  return `${jobName} is hardest to resolve in ${top.familyLabel.toLowerCase()}, where avg resolve time is ${top.avgResolveTimeHours?.toFixed(1) ?? 'n/a'}h.`;
}

export class ResolveTimeDistributionService {
  constructor(
    private readonly historyService = new JobAlertHistoryService(),
    private readonly groupingService = new AlertFamilyGroupingService(),
  ) {}

  async build(jobName: string, days = 30, now = new Date()): Promise<ResolveTimeDistributionResult> {
    const cutoff = buildCutoff(days, now);
    const rows = await this.historyService.listHistory(
      {
        jobName,
        status: 'all',
        includeResolved: true,
        sortBy: 'latest',
        sortDir: 'desc',
        limit: 500,
        offset: 0,
      },
      now,
    );

    const filtered = rows.filter((row) => {
      const anchor = parseDate(row.resolvedAt ?? row.lastDetectedAt ?? row.firstDetectedAt ?? row.detectedAt);
      return anchor ? anchor >= cutoff : false;
    });

    const map = new Map<
      AlertFamily,
      {
        rows: JobAlertRecord[];
        resolvedTimes: number[];
        unresolvedCount: number;
      }
    >();

    for (const row of filtered) {
      const family = this.groupingService.classify({ alert: row });
      const entry =
        map.get(family.family) ??
        {
          rows: [],
          resolvedTimes: [],
          unresolvedCount: 0,
        };

      entry.rows.push(row);
      if (row.status === 'resolved' && row.resolvedAt) {
        const first = parseDate(row.firstDetectedAt);
        const resolved = parseDate(row.resolvedAt);
        if (first && resolved) {
          entry.resolvedTimes.push((resolved.getTime() - first.getTime()) / 3_600_000);
        }
      } else {
        entry.unresolvedCount += 1;
      }
      map.set(family.family, entry);
    }

    const families = Array.from(map.entries()).map(([family, entry]) => {
      const resolvedCount = entry.resolvedTimes.length;
      const unresolvedCount = entry.unresolvedCount;
      const totalCount = resolvedCount + unresolvedCount;
      const avgResolveTimeHours = resolvedCount > 0 ? entry.resolvedTimes.reduce((sum, value) => sum + value, 0) / resolvedCount : null;
      const sortedTimes = [...entry.resolvedTimes].sort((left, right) => left - right);
      const medianResolveTimeHours = calculateQuantile(sortedTimes, 0.5);
      const p90ResolveTimeHours = calculateQuantile(sortedTimes, 0.9);
      const maxResolveTimeHours = sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : null;
      const unresolvedRatio = totalCount > 0 ? unresolvedCount / totalCount : null;
      const familyLabel = familyLabelFor(family);
      const distributionSummary = buildSummary({
        family,
        familyLabel,
        resolvedCount,
        unresolvedCount,
        avgResolveTimeHours,
        medianResolveTimeHours,
        p90ResolveTimeHours,
        maxResolveTimeHours,
        unresolvedRatio,
        distributionSummary: '',
        limitations: [],
      });

      const limitations = [
        ...(resolvedCount === 0 ? ['No resolved samples available for this family.'] : []),
        ...(resolvedCount < 3 ? ['Resolved sample size is small, so percentile estimates are conservative.'] : []),
        ...(unresolvedCount > 0 ? ['Some alerts are still active, so the unresolved ratio matters more than percentiles alone.'] : []),
      ];

      return {
        family,
        familyLabel,
        resolvedCount,
        unresolvedCount,
        avgResolveTimeHours,
        medianResolveTimeHours,
        p90ResolveTimeHours,
        maxResolveTimeHours,
        unresolvedRatio,
        distributionSummary,
        limitations,
      };
    });

    const sortedFamilies = families.sort((left, right) => {
      const leftScore = (left.avgResolveTimeHours ?? 0) + (left.unresolvedRatio ?? 0) * 12;
      const rightScore = (right.avgResolveTimeHours ?? 0) + (right.unresolvedRatio ?? 0) * 12;
      return rightScore - leftScore;
    });

    const overallSummary = buildOverallSummary(jobName, sortedFamilies);
    const limitations = [
      ...(filtered.length === 0 ? ['No resolve-time samples were found in the selected window.'] : []),
      ...(sortedFamilies.every((family) => family.resolvedCount < 2) ? ['Resolved sample sizes are sparse, so percentiles are conservative.'] : []),
      'Resolve-time distribution is derived from persisted JobAlert rows in the selected window.',
    ];

    return {
      jobName,
      days,
      families: sortedFamilies,
      overallSummary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
