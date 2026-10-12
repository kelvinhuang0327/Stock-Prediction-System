import { NextResponse } from 'next/server';
import { AutonomousAlertService } from '@/lib/jobs/AutonomousAlertService';
import { JobAlertHistoryService } from '@/lib/jobs/JobAlertHistoryService';
import { JobAlertService } from '@/lib/jobs/JobAlertService';
import type { JobAlertSeverity } from '@/lib/jobs/types';

function parseOptionalString(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseSeverity(value: string | null): JobAlertSeverity | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) return undefined;
  return parsed === 'info' || parsed === 'warning' || parsed === 'critical' ? parsed : undefined;
}

function parseStatus(value: string | null): 'active' | 'resolved' | 'suppressed' | 'all' | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) return undefined;
  return parsed === 'active' || parsed === 'resolved' || parsed === 'suppressed' || parsed === 'all' ? parsed : undefined;
}

function parseSortBy(value: string | null): 'latest' | 'occurrenceCount' | 'firstDetectedAt' | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) return undefined;
  return parsed === 'latest' || parsed === 'occurrenceCount' || parsed === 'firstDetectedAt' ? parsed : undefined;
}

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function summarize<T extends { severity: JobAlertSeverity }>(rows: T[]) {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.severity] += 1;
      return acc;
    },
    { total: 0, critical: 0, warning: 0, info: 0 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const computedService = new AutonomousAlertService();
    const persistenceService = new JobAlertService();
    const historyService = new JobAlertHistoryService(persistenceService);
    const filter = {
      jobName: parseOptionalString(url.searchParams.get('jobName')),
      severity: parseSeverity(url.searchParams.get('severity')),
      status: parseStatus(url.searchParams.get('status')),
      onlyActive: parseOptionalBoolean(url.searchParams.get('onlyActive')),
    };
    const limit = parseNumber(url.searchParams.get('limit'), 200);
    const offset = parseNumber(url.searchParams.get('offset'), 0);
    const sortBy = parseSortBy(url.searchParams.get('sort'));
    const sortDir = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
    const includeResolved = parseOptionalBoolean(url.searchParams.get('includeResolved')) ?? (
      filter.status === 'all' || filter.status === 'resolved'
    );

    const computed = await computedService.listAlerts(filter, new Date());
    const persisted = await historyService.listHistory(
      {
        ...filter,
        includeResolved,
        limit,
        offset,
        sortBy,
        sortDir,
      },
    );

    const alerts = persisted.length > 0
      ? persisted
      : computed.alerts.map((alert) => ({
          id: -1,
          jobName: alert.jobName,
          severity: alert.severity,
          message: alert.message,
          alertKey: alert.jobName,
          status: 'active' as const,
          firstDetectedAt: alert.detectedAt,
          lastDetectedAt: alert.detectedAt,
          resolvedAt: null,
          occurrenceCount: 1,
          latestJobRunLogId: null,
          metadata: null,
          createdAt: computed.generatedAt,
          updatedAt: computed.generatedAt,
        }));

    const summary = summarize(alerts);
    const isPersisted = persisted.length > 0;
    const historySummary = await historyService.buildSummary({
      jobName: filter.jobName,
      severity: filter.severity,
    });

    return NextResponse.json({
      alerts,
      summary,
      historySummary,
      pagination: {
        limit,
        offset,
        returned: alerts.length,
      },
      generatedAt: new Date().toISOString(),
      limitations: [
        ...(computed.limitations ?? []),
        ...(isPersisted ? [] : ['No persisted job alerts yet; falling back to computed alerts.']),
      ],
      source: isPersisted ? 'persisted' : 'computed',
      healthSummary: computed.healthSummary,
    });
  } catch (error) {
    console.error('Autonomous alerts failed:', error);
    return NextResponse.json(
      { error: 'Failed to load autonomous alerts' },
      { status: 500 },
    );
  }
}
