import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AutonomousAlertsPage from '../page';
import { JobAlertHistoryService } from '@/lib/jobs/JobAlertHistoryService';
import { JobAlertDrilldownService } from '@/lib/jobs/JobAlertDrilldownService';
import { FamilyTrendService } from '@/lib/jobs/FamilyTrendService';
import { NoisySourceBreakdownService } from '@/lib/jobs/NoisySourceBreakdownService';
import { RecommendationLifecycleService } from '@/lib/jobs/RecommendationLifecycleService';
import { RecommendationHistoryService } from '@/lib/jobs/RecommendationHistoryService';
import { RecommendationTrendService } from '@/lib/jobs/RecommendationTrendService';
import { ResolveTimeDistributionService } from '@/lib/jobs/ResolveTimeDistributionService';
import { PolicyRecommendationEngine } from '@/lib/jobs/PolicyRecommendationEngine';
import { JobAlertTrendService } from '@/lib/jobs/JobAlertTrendService';

const alert = {
  id: 1,
  jobName: 'autonomous:daily',
  severity: 'critical' as const,
  message: 'Daily job failed repeatedly',
  detectedAt: '2026-11-09T00:00:00.000Z',
  alertKey: 'daily-failure',
  status: 'resolved' as const,
  firstDetectedAt: '2026-11-08T00:00:00.000Z',
  lastDetectedAt: '2026-11-09T00:00:00.000Z',
  resolvedAt: '2026-11-10T00:00:00.000Z',
  occurrenceCount: 3,
  latestJobRunLogId: null,
  metadata: null,
  createdAt: '2026-11-08T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

describe('AutonomousAlertsPage', () => {
  let listHistory: jest.SpyInstance;
  let historySummary: jest.SpyInstance;
  let recommendationList: jest.SpyInstance;
  let recommendationSummary: jest.SpyInstance;

  beforeEach(() => {
    listHistory = jest.spyOn(JobAlertHistoryService.prototype, 'listHistory').mockResolvedValue([]);
    historySummary = jest.spyOn(JobAlertHistoryService.prototype, 'buildSummary').mockResolvedValue({
      total: 0, active: 0, resolvedRecently: 0, critical: 0, warning: 0, info: 0,
      topNoisyJobs: [], recentReoccurAlerts: [], recentResolvedAlerts: [],
      severityDistribution: { critical: 0, warning: 0, info: 0 },
    });
    jest.spyOn(PolicyRecommendationEngine.prototype, 'build').mockResolvedValue({
      recommendations: [], limitations: [], summary: { total: 0, critical: 0, warning: 0, info: 0 },
    } as never);
    jest.spyOn(RecommendationHistoryService.prototype, 'syncFromRecommendations').mockResolvedValue({ upserted: 0, resolved: 0, totalObserved: 0 });
    recommendationList = jest.spyOn(RecommendationHistoryService.prototype, 'listHistory').mockResolvedValue([]);
    recommendationSummary = jest.spyOn(RecommendationHistoryService.prototype, 'buildSummary').mockResolvedValue({
      total: 0, active: 0, resolved: 0, stale: 0, critical: 0, warning: 0, info: 0,
      topJobs: [], topTypes: [], recurringRecommendations: [], recentResolvedRecommendations: [],
    });
    jest.spyOn(RecommendationTrendService.prototype, 'build').mockResolvedValue(null as never);
    jest.spyOn(RecommendationLifecycleService.prototype, 'build').mockResolvedValue(null as never);
    jest.spyOn(JobAlertDrilldownService.prototype, 'build').mockResolvedValue(null as never);
    jest.spyOn(JobAlertTrendService.prototype, 'build').mockResolvedValue(null as never);
    jest.spyOn(NoisySourceBreakdownService.prototype, 'build').mockResolvedValue(null as never);
    jest.spyOn(FamilyTrendService.prototype, 'build').mockResolvedValue(null as never);
    jest.spyOn(ResolveTimeDistributionService.prototype, 'build').mockResolvedValue(null as never);
  });

  afterEach(() => jest.restoreAllMocks());

  async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
    const page = await AutonomousAlertsPage({ searchParams });
    return render(page);
  }

  it('renders empty history and default filters without triggering job-specific drilldowns', async () => {
    await renderPage();

    expect(screen.getByText('No persisted job alerts yet.')).toBeInTheDocument();
    expect(screen.getByText('No actionable recommendation could be derived from the current signal.')).toBeInTheDocument();
    expect(screen.getByText('No recommendation history yet.')).toBeInTheDocument();
    expect(listHistory).toHaveBeenCalledWith(expect.objectContaining({
      status: undefined,
      severity: undefined,
      jobName: undefined,
      sortBy: 'latest',
      sortDir: 'desc',
      limit: 50,
      offset: 0,
      days: 14,
    }), expect.any(Date));
    expect(historySummary).toHaveBeenCalledWith({ severity: undefined, jobName: undefined, days: 14 }, expect.any(Date));
    expect(recommendationList).toHaveBeenCalledWith(expect.objectContaining({ jobName: undefined, status: 'all', limit: 8 }));
    expect(recommendationSummary).toHaveBeenCalledWith({ jobName: undefined, status: 'all' });
    expect(JobAlertDrilldownService.prototype.build).not.toHaveBeenCalled();
  });

  it('normalizes array filters, bounds pages, and renders a resolved alert row', async () => {
    listHistory.mockResolvedValue([alert]);
    historySummary.mockResolvedValue({
      total: 1, active: 0, resolvedRecently: 1, critical: 1, warning: 0, info: 0,
      topNoisyJobs: [{ jobName: 'autonomous:daily', occurrenceCount: 3 }],
      recentReoccurAlerts: [], recentResolvedAlerts: [alert],
      severityDistribution: { critical: 1, warning: 0, info: 0 },
    });

    await renderPage({
      status: ['resolved', 'active'],
      severity: ['critical', 'warning'],
      recommendationType: 'increase_retry_limit',
      jobName: '  autonomous:daily, ,training:nightly  ',
      sort: 'occurrenceCount',
      direction: 'asc',
      limit: '1',
      offset: '2',
      days: '30',
    });

    expect(screen.queryByText('No alerts matched the current filters.')).not.toBeInTheDocument();
    expect(screen.getByText('Daily job failed repeatedly')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', expect.stringContaining('offset=1'));
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', expect.stringContaining('offset=3'));
    expect(screen.getByText('Active job filters: autonomous:daily, training:nightly')).toBeInTheDocument();
    expect(listHistory).toHaveBeenCalledWith(expect.objectContaining({
      status: 'resolved',
      severity: 'critical',
      jobName: 'autonomous:daily, ,training:nightly',
      includeResolved: true,
      onlyActive: undefined,
      sortBy: 'occurrenceCount',
      sortDir: 'asc',
      limit: 1,
      offset: 2,
      days: 30,
    }), expect.any(Date));
    expect(RecommendationHistoryService.prototype.syncFromRecommendations).toHaveBeenCalledWith([], expect.any(Date), {
      resolveMissing: false,
      scopeJobs: ['autonomous:daily, ,training:nightly'],
    });
    expect(JobAlertDrilldownService.prototype.build).toHaveBeenCalledWith('autonomous:daily, ,training:nightly', 30, expect.any(Date));
  });

  it('falls back for invalid filters and reports empty results when a job filter remains', async () => {
    await renderPage({ status: 'unknown', severity: 'urgent', recommendationType: '   ', jobName: ' , , ', sort: 'invalid', direction: 'asc', limit: '-1', offset: '-2', days: '-1' });

    expect(screen.getByText('No alerts matched the current filters.')).toBeInTheDocument();
    expect(listHistory).toHaveBeenCalledWith(expect.objectContaining({
      status: undefined,
      severity: undefined,
      jobName: ', ,',
      sortBy: 'latest',
      sortDir: 'asc',
      limit: 50,
      offset: 0,
      days: 14,
    }), expect.any(Date));
  });

  it('renders populated alert drilldown, trend, recommendation, and lifecycle cards', async () => {
    const bucket = { date: '2026-11-10', label: 'Nov 10', total: 4, active: 2, resolved: 2, critical: 1, warning: 2, info: 1 };
    const noDataBucket = { date: '2026-11-09', label: 'Nov 09', total: 0, active: 0, resolved: 0, critical: 0, warning: 0, info: 0 };
    const row = {
      id: 2, recommendationKey: 'policy:daily', recommendationType: 'cooldown_increase',
      targetJob: 'autonomous:daily', targetFamily: 'failed_run', severity: 'critical',
      rationale: 'Repeated failures cluster in a short period.', suggestedAction: 'Increase the cooldown.',
      confidence: 0.92, status: 'active', firstDetectedAt: '2026-11-08T00:00:00.000Z',
      lastDetectedAt: '2026-11-10T00:00:00.000Z', resolvedAt: null, occurrenceCount: 4,
      metadata: null, createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z',
    };

    listHistory.mockResolvedValue([alert]);
    historySummary.mockResolvedValue({
      total: 1, active: 1, resolvedRecently: 0, critical: 1, warning: 0, info: 0,
      topNoisyJobs: [{ jobName: 'autonomous:daily', occurrenceCount: 4 }],
      recentReoccurAlerts: [alert], recentResolvedAlerts: [], severityDistribution: { critical: 1, warning: 0, info: 0 },
    });
    recommendationList.mockResolvedValue([row] as never);
    recommendationSummary.mockResolvedValue({
      total: 1, active: 1, resolved: 0, stale: 0, critical: 1, warning: 0, info: 0,
      topJobs: [{ jobName: 'autonomous:daily', recommendationCount: 2 }],
      topTypes: [], recurringRecommendations: [row], recentResolvedRecommendations: [],
    });
    jest.spyOn(PolicyRecommendationEngine.prototype, 'build').mockResolvedValue({
      recommendations: [
        { targetJob: 'autonomous:daily', targetFamily: 'failed_run', severity: 'critical', category: 'scheduler', recommendationType: 'review_scheduler_reliability', confidence: 0.92, rationale: 'Repeated failures.', suggestedAction: 'Review scheduler reliability.', limitations: ['sparse sample', 'short window', 'third note'] },
        { targetJob: 'training:nightly', targetFamily: null, severity: 'warning', category: 'policy', recommendationType: 'cooldown_increase', confidence: 0.7, rationale: 'Failures are recurring.', suggestedAction: 'Increase cooldown.', limitations: [] },
        { targetJob: 'training:weekly', severity: 'info', category: 'monitoring', recommendationType: 'review_monitor_frequency', confidence: 0.5, rationale: 'Low volume.', suggestedAction: 'Review monitor cadence.', limitations: [] },
      ],
      summary: { total: 3, critical: 1, warning: 1, info: 1 },
      limitations: ['Policy uses a short observation window.'],
    } as never);
    jest.spyOn(JobAlertDrilldownService.prototype, 'build').mockResolvedValue({
      jobName: 'autonomous:daily',
      summary: {
        jobName: 'autonomous:daily', activeAlertsCount: 1, resolvedAlertsCount: 1, totalOccurrences: 7,
        latestAlertStatus: 'active', severityDistribution: { critical: 1, warning: 1, info: 0 },
        recentReoccurCount: 1, recentResolvedCount: 1, averageHoursToResolve: 3.5,
        mostCommonAlertMessage: 'Daily job failed repeatedly', summaryNote: 'One active alert remains.',
      },
      timeline: [
        { id: 1, status: 'active', severity: 'critical', message: 'Current failure', detectedAt: '2026-11-10T00:00:00.000Z', firstDetectedAt: '2026-11-08T00:00:00.000Z', lastDetectedAt: '2026-11-10T00:00:00.000Z', resolvedAt: null, occurrenceCount: 4 },
        { id: 2, status: 'resolved', severity: 'warning', message: 'Recovered failure', detectedAt: '2026-11-09T00:00:00.000Z', firstDetectedAt: '2026-11-08T00:00:00.000Z', lastDetectedAt: '2026-11-09T00:00:00.000Z', resolvedAt: '2026-11-09T04:00:00.000Z', occurrenceCount: 3 },
      ],
      recentAlerts: [],
      recentRecoveryEvents: [{ id: 2, resolvedAt: '2026-11-09T04:00:00.000Z', message: 'Recovery completed', occurrenceCount: 3 }],
      limitations: ['Only recent history is available.'], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);
    jest.spyOn(JobAlertTrendService.prototype, 'build').mockResolvedValue({
      jobName: 'autonomous:daily', window: '14d', bucket: 'day', buckets: [bucket, noDataBucket],
      summary: { trendDirection: 'worsening', totalOccurrences: 4, totalResolved: 2, avgPerBucket: 2, peakBucket: 4, bucketCount: 2, windowDays: 14, bucketSizeDays: 1, periodStart: '2026-10-28T00:00:00.000Z', periodEnd: '2026-11-10T00:00:00.000Z' },
      limitations: ['Trend sample is sparse.'], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);
    jest.spyOn(NoisySourceBreakdownService.prototype, 'build').mockResolvedValue({
      jobName: 'autonomous:daily',
      families: [
        { family: 'failed_run', familyLabel: 'Failed run', count: 2, totalOccurrences: 5, reoccurCount: 1, reoccurRate: null, avgResolveTimeHours: null, criticalCount: 1, warningCount: 1, infoCount: 0, criticalRatio: null, activeCount: 1, resolvedCount: 1, noisyScore: 9, summaryNote: 'Main source.', groupingConfidence: 0.8, derivedReason: 'Repeated failures.' },
        { family: 'recovery_event', familyLabel: 'Recovery event', count: 1, totalOccurrences: 2, reoccurCount: 1, reoccurRate: 0.5, avgResolveTimeHours: 2.25, criticalCount: 0, warningCount: 0, infoCount: 1, criticalRatio: 0, activeCount: 0, resolvedCount: 1, noisyScore: 2, summaryNote: 'Recovery followed.', groupingConfidence: 0.6, derivedReason: 'Resolved run.' },
      ],
      topFamily: { family: 'failed_run', familyLabel: 'Failed run' },
      summary: { jobName: 'autonomous:daily', totalAlerts: 3, totalOccurrences: 7, familyCount: 2, activeCount: 1, resolvedCount: 2, topFamily: 'failed_run', topFamilyLabel: 'Failed run', topFamilyShare: 0.67, overallSummary: 'Failed runs are the main source.', source: 'persisted' },
      limitations: ['Family grouping is inferred.'], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);
    jest.spyOn(FamilyTrendService.prototype, 'build').mockResolvedValue({
      jobName: 'autonomous:daily', window: '14d', bucket: 'day', overallSummary: 'Failed run trend is worsening.',
      families: [{ family: 'failed_run', familyLabel: 'Failed run', buckets: [bucket], trendDirection: 'worsening', totalOccurrences: 4, totalResolved: 2, avgPerBucket: 2, limitations: [] }],
      limitations: [], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);
    jest.spyOn(ResolveTimeDistributionService.prototype, 'build').mockResolvedValue({
      jobName: 'autonomous:daily', days: 30, overallSummary: 'Failures take longer to resolve.',
      families: [
        { family: 'failed_run', familyLabel: 'Failed run', resolvedCount: 2, unresolvedCount: 1, avgResolveTimeHours: null, medianResolveTimeHours: null, p90ResolveTimeHours: null, maxResolveTimeHours: null, unresolvedRatio: null, distributionSummary: 'Insufficient samples.', limitations: [] },
        { family: 'recovery_event', familyLabel: 'Recovery event', resolvedCount: 3, unresolvedCount: 0, avgResolveTimeHours: 2, medianResolveTimeHours: 1.5, p90ResolveTimeHours: 3, maxResolveTimeHours: 4, unresolvedRatio: 0, distributionSummary: 'Most recover quickly.', limitations: ['Only resolved rows count.'] },
      ],
      limitations: ['Distribution is historical.'], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);
    jest.spyOn(RecommendationTrendService.prototype, 'build').mockResolvedValue({
      recommendationType: null, targetJob: 'autonomous:daily', status: 'all', window: '14d', bucket: 'day', buckets: [bucket, noDataBucket],
      summary: { trendDirection: 'stable', totalOccurrences: 4, totalResolved: 2, avgPerBucket: 2, peakBucket: 4, bucketCount: 2, windowDays: 14, bucketSizeDays: 1, periodStart: '2026-10-28T00:00:00.000Z', periodEnd: '2026-11-10T00:00:00.000Z' },
      limitations: ['Recommendation sample is sparse.'], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);
    jest.spyOn(RecommendationLifecycleService.prototype, 'build').mockResolvedValue({
      recommendationKey: null, recommendationType: null, targetJob: 'autonomous:daily', status: 'all',
      recommendations: [
        { recommendationKey: 'rec-active', recommendationType: 'cooldown_increase', targetJob: 'autonomous:daily', targetFamily: null, severity: 'warning', firstDetectedAt: '2026-11-08T00:00:00.000Z', lastDetectedAt: '2026-11-10T00:00:00.000Z', resolvedAt: null, occurrenceCount: 3, currentStatus: 'active', resolvedCount: 0, reoccurCount: 2, daysOpen: 2, lifecycleSummary: 'Currently active.', limitations: [] },
        { recommendationKey: 'rec-resolved', recommendationType: 'review_scheduler_reliability', targetJob: 'autonomous:daily', targetFamily: 'failed_run', severity: 'critical', firstDetectedAt: '2026-11-01T00:00:00.000Z', lastDetectedAt: '2026-11-05T00:00:00.000Z', resolvedAt: '2026-11-05T00:00:00.000Z', occurrenceCount: 2, currentStatus: 'resolved', resolvedCount: 1, reoccurCount: 1, daysOpen: 4, lifecycleSummary: 'Resolved after recovery.', limitations: [] },
        { recommendationKey: 'rec-stale', recommendationType: 'review_monitor_frequency', targetJob: 'autonomous:daily', targetFamily: 'recovery_event', severity: 'info', firstDetectedAt: '2026-10-01T00:00:00.000Z', lastDetectedAt: '2026-10-02T00:00:00.000Z', resolvedAt: null, occurrenceCount: 1, currentStatus: 'stale', resolvedCount: 0, reoccurCount: 0, daysOpen: 1, lifecycleSummary: 'Marked stale.', limitations: [] },
      ],
      summary: { total: 3, active: 1, resolved: 1, stale: 1, recurring: 2, resolvedCycles: 1, reoccurCount: 3, avgOccurrences: 2, topRecommendationKey: 'rec-active' },
      limitations: ['Lifecycle is derived from recorded history.'], generatedAt: '2026-11-10T00:00:00.000Z',
    } as never);

    await renderPage({ jobName: 'autonomous:daily', days: '14', offset: '1', limit: '1' });

    expect(screen.getByText('Job Drill-Down')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open filtered view' })).toHaveAttribute('href', expect.stringContaining('jobName=autonomous%3Adaily'));
    expect(screen.getByText('Trend Chart')).toBeInTheDocument();
    expect(screen.getByText('Noisy Source Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Family Trend')).toBeInTheDocument();
    expect(screen.getByText('Resolve Time Distribution')).toBeInTheDocument();
    expect(screen.getByText('Current failure')).toBeInTheDocument();
    expect(screen.getByText('Recovery completed')).toBeInTheDocument();
    expect(screen.getByText('Policy Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Recommendation Trend')).toBeInTheDocument();
    expect(screen.getByText('Recommendation Lifecycle')).toBeInTheDocument();
    expect(screen.getByText('Increase the cooldown.')).toBeInTheDocument();
    expect(screen.getAllByText('Failed run').length).toBeGreaterThan(0);
    expect(screen.queryByText('No timeline events for this job yet.')).not.toBeInTheDocument();
  });
});
