import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AutonomousDashboardPage from '../page';
import { getAutonomousDashboardSummary, type AutonomousDashboardSummary } from '@/lib/jobs/AutonomousDashboardService';
import type { JobAlert, JobHealthRow, JobHealthStatus, JobRunStatus } from '@/lib/jobs/types';

jest.mock('@/lib/jobs/AutonomousDashboardService', () => ({
  getAutonomousDashboardSummary: jest.fn(),
}));

function job(jobName: string, status: JobRunStatus | 'never-ran', healthStatus: JobHealthStatus): JobHealthRow {
  return {
    jobName,
    scheduledFor: '2026-11-10T00:00:00.000Z',
    latestRun: null,
    missed: status === 'failed',
    canRerun: status !== 'running',
    triggerSource: 'local_scheduler',
    runMode: 'live_run',
    lastErrorMessage: status === 'failed' ? 'provider timeout' : null,
    status,
    healthStatus,
    healthReason: `${jobName} health detail`,
    lastSuccessfulRunAt: status === 'success' ? '2026-11-09T00:00:00.000Z' : null,
    failureStreak: status === 'failed' ? 2 : 0,
    summary: `${jobName} run summary`,
    limitations: [],
  };
}

const emptyDashboard: AutonomousDashboardSummary = {
  generatedAt: '2026-11-10T00:00:00.000Z',
  latestSnapshot: null,
  marketSummary: { marketState: null, marketRegime: null, regimeConfidence: null, dataCoverage: null, snapshotDate: null },
  proposalSummary: { total: 0 },
  tradeSummary: { total: 0 },
  reviewSummary: { total: 0, latestGeneratedAt: null },
  learningSummary: { total: 0, latestGeneratedAt: null, summary: null, sourceCount: null, limitationCount: 0 },
  alertSummary: { total: 0, active: 0, resolved: 0, suppressed: 0, critical: 0, warning: 0, info: 0, topNoisyJobs: [] },
  jobHealth: {
    summary: 'No job health data', jobs: [], missedJobs: [], failedJobs: [], neverRanJobs: [], alerts: [],
    healthSummary: { total: 0, ok: 0, delayed: 0, failed: 0, neverRan: 0 },
  },
  limitations: [],
};

const jobAlerts: JobAlert[] = [
  { jobName: 'failed-job', severity: 'critical', message: 'critical alert', detectedAt: '2026-11-10T00:00:00.000Z' },
  { jobName: 'delayed-job', severity: 'warning', message: 'warning alert', detectedAt: '2026-11-10T00:01:00.000Z' },
  { jobName: 'info-job', severity: 'info', message: 'info alert', detectedAt: '2026-11-10T00:02:00.000Z' },
];

const populatedDashboard: AutonomousDashboardSummary = {
  ...emptyDashboard,
  generatedAt: '2026-11-10T03:00:00.000Z',
  latestSnapshot: {
    id: 7, snapshotDate: '2026-11-10', marketState: 'bull-trend', marketRegime: 'bull-trend',
    marketRegimeConfidence: 0.8, dataCoverage: 'complete', candidateCount: 4,
    sectorStrengthCount: 3, riskSignalCount: 1, topInsightCount: 2, limitationCount: 1,
  },
  marketSummary: { marketState: 'bull-trend', marketRegime: 'bull', regimeConfidence: 0.8, dataCoverage: 'complete', snapshotDate: '2026-11-10' },
  proposalSummary: { total: 5, approved: 1, proposed: 2, open: 1, triggered: 1, rejected: 1 },
  tradeSummary: { total: 3, open: 1, closed: 1, triggered: 1 },
  reviewSummary: { total: 2, latestGeneratedAt: '2026-11-10T02:00:00.000Z' },
  learningSummary: { total: 1, latestGeneratedAt: '2026-11-10T02:30:00.000Z', summary: 'learning insight', sourceCount: 4, limitationCount: 1 },
  alertSummary: {
    total: 4, active: 3, resolved: 1, suppressed: 0, critical: 1, warning: 2, info: 1,
    topNoisyJobs: [
      { jobName: 'job/a', occurrenceCount: 8 },
      { jobName: 'job b', occurrenceCount: 5 },
      { jobName: 'job-c', occurrenceCount: 2 },
    ],
  },
  jobHealth: {
    summary: '3 jobs need attention',
    jobs: [
      job('ok-job', 'success', 'ok'),
      job('running-job', 'running', 'delayed'),
      job('failed-job', 'failed', 'failed'),
      job('never-job', 'never-ran', 'never-ran'),
      job('skipped-job', 'skipped', 'ok'),
    ],
    missedJobs: ['failed-job'],
    failedJobs: ['failed-job'],
    neverRanJobs: ['never-job'],
    alerts: jobAlerts,
    healthSummary: { total: 5, ok: 2, delayed: 1, failed: 1, neverRan: 1 },
  },
  limitations: ['stale quote data', 'limited historical coverage'],
};

describe('AutonomousDashboardPage', () => {
  const loadSummary = getAutonomousDashboardSummary as jest.MockedFunction<typeof getAutonomousDashboardSummary>;

  afterEach(() => jest.clearAllMocks());

  async function renderPage(data: AutonomousDashboardSummary) {
    loadSummary.mockResolvedValue(data);
    return render(await AutonomousDashboardPage());
  }

  it('shows explicit empty-state copy when no snapshot or job data exists', async () => {
    await renderPage(emptyDashboard);

    expect(screen.getByText('unknown market')).toBeInTheDocument();
    expect(screen.getByText('No snapshot')).toBeInTheDocument();
    expect(screen.getByText('all jobs healthy')).toBeInTheDocument();
    expect(screen.getByText('No active alerts.')).toBeInTheDocument();
    expect(screen.getByText('No autonomous snapshot yet')).toBeInTheDocument();
    expect(screen.getByText('No insight yet')).toBeInTheDocument();
    expect(screen.getByText('No active limitations recorded.')).toBeInTheDocument();
    expect(screen.getByText('Learning:')).toHaveTextContent('no');
  });

  it('renders populated snapshot, alert, learning, and job-health states', async () => {
    await renderPage(populatedDashboard);

    expect(screen.getAllByText('bull-trend').length).toBeGreaterThan(0);
    expect(screen.getByText('1 missed')).toBeInTheDocument();
    expect(screen.getByText('View alert history')).toHaveAttribute('href', '/autonomous/alerts');
    expect(screen.getAllByText('2026-11-10').length).toBeGreaterThan(0);
    expect(screen.getByText('job/a(8)')).toHaveAttribute('href', '/autonomous/alerts?jobName=job%2Fa');
    expect(screen.getByText('job b(5)')).toBeInTheDocument();
    expect(screen.queryByText('job-c(2)')).not.toBeInTheDocument();
    expect(screen.getByText('critical alert')).toBeInTheDocument();
    expect(screen.getByText('warning alert')).toBeInTheDocument();
    expect(screen.getByText('info alert')).toBeInTheDocument();
    expect(screen.getByText('learning insight')).toBeInTheDocument();
    expect(screen.getByText('stale quote data')).toBeInTheDocument();
    expect(screen.getAllByText(/Window covered/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Missed window/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rerun allowed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rerun blocked/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Health /).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('uses defensive coloring for bearish and unknown market states', async () => {
    const bearish = { ...emptyDashboard, marketSummary: { ...emptyDashboard.marketSummary, marketState: 'defensive-bear' } };
    const { container, rerender } = await renderPage(bearish);
    expect(container.querySelector('.text-rose-300')).toBeInTheDocument();

    loadSummary.mockResolvedValue({ ...emptyDashboard, marketSummary: { ...emptyDashboard.marketSummary, marketState: 'sideways' } });
    rerender(await AutonomousDashboardPage());
    expect(container.querySelector('.text-amber-300')).toBeInTheDocument();
  });
});
