import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAutonomousDashboardSummary } from '@/lib/jobs/AutonomousDashboardService';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bot,
  ClipboardList,
  Clock3,
  Database,
  Layers3,
  Sparkles,
  ShieldAlert,
  TriangleAlert,
  AlertTriangle,
} from 'lucide-react';

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function statusTone(status: string | null | undefined): string {
  if (!status) return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  if (status === 'success') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (status === 'failed') return 'bg-red-500/10 text-red-300 border-red-500/30';
  if (status === 'running') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (status === 'never-ran') return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  if (status === 'skipped') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function stateTone(state: string | null | undefined): string {
  if (!state) return 'text-slate-300';
  const normalized = state.toLowerCase();
  if (normalized.includes('bull') || normalized.includes('trend') || normalized.includes('recovery')) return 'text-emerald-300';
  if (normalized.includes('bear') || normalized.includes('defensive')) return 'text-rose-300';
  return 'text-amber-300';
}

export default async function AutonomousDashboardPage() {
  const dashboard = await getAutonomousDashboardSummary();
  const latestSnapshot = dashboard.latestSnapshot;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
            <Bot size={14} />
            Autonomous Dashboard
          </div>
          <h1 className="text-3xl font-black text-white mt-2">Autonomous Research & Simulation Overview</h1>
          <p className="text-slate-400 mt-2">
            一眼看懂研究快照、提案、模擬交易、review / learning 與 job 健康狀態。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={stateTone(dashboard.marketSummary.marketState)}>
            {dashboard.marketSummary.marketState ?? 'unknown market'}
          </Badge>
          <Badge className={statusTone(dashboard.jobHealth.missedJobs.length > 0 ? 'failed' : 'success')}>
            {dashboard.jobHealth.missedJobs.length > 0 ? `${dashboard.jobHealth.missedJobs.length} missed` : 'all jobs healthy'}
          </Badge>
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
            updated {new Date(dashboard.generatedAt).toLocaleString()}
          </Badge>
          <Link href="/autonomous/alerts" className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white">
            View alert history
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <Database size={16} />
              Latest Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={`text-2xl font-black ${stateTone(dashboard.marketSummary.marketState)}`}>
              {dashboard.marketSummary.marketState ?? 'No snapshot'}
            </div>
            <div className="text-sm text-slate-400">
              Regime: <span className="text-white font-medium">{dashboard.marketSummary.marketRegime ?? 'n/a'}</span>
            </div>
            <div className="text-sm text-slate-400">
              Coverage: <span className="text-white font-medium">{dashboard.marketSummary.dataCoverage ?? 'n/a'}</span>
            </div>
            <div className="text-sm text-slate-400">
              Snapshot Date: <span className="text-white font-medium">{dashboard.marketSummary.snapshotDate ?? 'n/a'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <Layers3 size={16} />
              Proposals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black text-white">{formatCount(dashboard.proposalSummary.total)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
              <span>Approved: <span className="text-white">{formatCount(dashboard.proposalSummary.approved ?? 0)}</span></span>
              <span>Open: <span className="text-white">{formatCount(dashboard.proposalSummary.open ?? 0)}</span></span>
              <span>Triggered: <span className="text-white">{formatCount(dashboard.proposalSummary.triggered ?? 0)}</span></span>
              <span>Rejected: <span className="text-white">{formatCount(dashboard.proposalSummary.rejected ?? 0)}</span></span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <ClipboardList size={16} />
              Trades / Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black text-white">{formatCount(dashboard.tradeSummary.total)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
              <span>Open: <span className="text-white">{formatCount(dashboard.tradeSummary.open ?? 0)}</span></span>
              <span>Closed: <span className="text-white">{formatCount(dashboard.tradeSummary.closed ?? 0)}</span></span>
              <span>Reviews: <span className="text-white">{formatCount(dashboard.reviewSummary.total)}</span></span>
              <span>Learning: <span className="text-white">{dashboard.learningSummary.total > 0 ? 'yes' : 'no'}</span></span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <ShieldAlert size={16} />
              Job Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black text-white">{formatCount(dashboard.jobHealth.jobs.length)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
              <span>Missed: <span className="text-white">{formatCount(dashboard.jobHealth.missedJobs.length)}</span></span>
              <span>Never-run: <span className="text-white">{formatCount(dashboard.jobHealth.neverRanJobs.length)}</span></span>
              <span>Failed: <span className="text-white">{formatCount(dashboard.jobHealth.failedJobs.length)}</span></span>
              <span>Healthy: <span className="text-white">{formatCount(dashboard.jobHealth.jobs.filter((job) => job.status === 'success').length)}</span></span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle size={16} />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black text-white">{formatCount(dashboard.alertSummary.active)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
              <span>Resolved: <span className="text-white">{formatCount(dashboard.alertSummary.resolved)}</span></span>
              <span>Suppressed: <span className="text-white">{formatCount(dashboard.alertSummary.suppressed)}</span></span>
              <span>Critical: <span className="text-white">{formatCount(dashboard.alertSummary.critical)}</span></span>
              <span>Warning: <span className="text-white">{formatCount(dashboard.alertSummary.warning)}</span></span>
            </div>
            {dashboard.alertSummary.topNoisyJobs.length > 0 && (
              <div className="pt-2 text-xs text-slate-400">
                Top noisy:{' '}
                {dashboard.alertSummary.topNoisyJobs.slice(0, 2).map((job, index) => (
                  <span key={job.jobName}>
                    {index > 0 ? ' · ' : ' '}
                    <Link href={`/autonomous/alerts?jobName=${encodeURIComponent(job.jobName)}`} className="hover:text-cyan-300">
                      {job.jobName}({job.occurrenceCount})
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <AlertTriangle size={18} />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">OK</div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">{formatCount(dashboard.jobHealth.healthSummary.ok)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Delayed</div>
                <div className="mt-1 text-lg font-semibold text-amber-300">{formatCount(dashboard.jobHealth.healthSummary.delayed)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Failed</div>
                <div className="mt-1 text-lg font-semibold text-rose-300">{formatCount(dashboard.jobHealth.healthSummary.failed)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Never ran</div>
                <div className="mt-1 text-lg font-semibold text-slate-300">{formatCount(dashboard.jobHealth.healthSummary.neverRan)}</div>
              </div>
            </div>

            <div className="space-y-2">
              {dashboard.jobHealth.alerts.length > 0 ? (
                dashboard.jobHealth.alerts.map((alert, index) => (
                  <div key={`${alert.jobName}-${alert.detectedAt}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-white">{alert.jobName}</div>
                      <Badge className={statusTone(alert.severity === 'critical' ? 'failed' : alert.severity === 'warning' ? 'running' : 'skipped')}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{alert.message}</div>
                    <div className="mt-1 text-xs text-slate-500">{alert.detectedAt}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
                  No active alerts.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <ShieldAlert size={18} />
              Job Health Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.jobHealth.jobs.map((job) => (
              <div key={job.jobName} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-white">{job.jobName}</div>
                    <div className="text-xs text-slate-500">
                      Health {job.healthStatus} · Scheduled {job.scheduledFor}
                    </div>
                  </div>
                  <Badge className={statusTone(job.healthStatus === 'ok' ? 'success' : job.healthStatus === 'delayed' ? 'running' : job.healthStatus === 'failed' ? 'failed' : 'never-ran')}>
                    {job.healthStatus}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-400">{job.healthReason}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Failure streak {job.failureStreak} · Last success {job.lastSuccessfulRunAt ?? 'n/a'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Sparkles size={18} />
              Research Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Market</div>
                <div className={`mt-2 text-lg font-semibold ${stateTone(dashboard.marketSummary.marketState)}`}>
                  {dashboard.marketSummary.marketState ?? 'No data'}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Regime {dashboard.marketSummary.marketRegime ?? 'n/a'} · confidence {dashboard.marketSummary.regimeConfidence ?? 'n/a'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Snapshot</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {latestSnapshot ? latestSnapshot.snapshotDate : 'No autonomous snapshot yet'}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Candidates {latestSnapshot ? formatCount(latestSnapshot.candidateCount) : '0'} · Limitations {latestSnapshot ? formatCount(latestSnapshot.limitationCount) : '0'}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Proposal states</div>
                <div className="mt-2 text-sm text-slate-300 space-y-1">
                  <div>Approved {formatCount(dashboard.proposalSummary.approved ?? 0)}</div>
                  <div>Proposed {formatCount(dashboard.proposalSummary.proposed ?? 0)}</div>
                  <div>Triggered {formatCount(dashboard.proposalSummary.triggered ?? 0)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Trade states</div>
                <div className="mt-2 text-sm text-slate-300 space-y-1">
                  <div>Open {formatCount(dashboard.tradeSummary.open ?? 0)}</div>
                  <div>Closed {formatCount(dashboard.tradeSummary.closed ?? 0)}</div>
                  <div>Triggered {formatCount(dashboard.tradeSummary.triggered ?? 0)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Learning</div>
                <div className="mt-2 text-sm text-slate-300 space-y-1">
                  <div>Source count {dashboard.learningSummary.sourceCount ?? 0}</div>
                  <div>Latest {dashboard.learningSummary.latestGeneratedAt ?? 'n/a'}</div>
                  <div className="text-slate-400">{dashboard.learningSummary.summary ?? 'No insight yet'}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Activity size={18} />
              Job Health Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-400">{dashboard.jobHealth.summary}</div>
            <div className="space-y-2">
              {dashboard.jobHealth.jobs.map((job) => (
                <div key={job.jobName} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-white">{job.jobName}</div>
                      <div className="text-xs text-slate-500">
                        Scheduled {job.scheduledFor} · Mode {job.runMode ?? 'n/a'}
                      </div>
                    </div>
                    <Badge className={statusTone(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {job.summary}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {job.missed ? 'Missed window' : 'Window covered'} · {job.canRerun ? 'rerun allowed' : 'rerun blocked'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <TriangleAlert size={18} />
            Limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dashboard.limitations.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-400">
              {dashboard.limitations.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400">No active limitations recorded.</div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <a href="/api/autonomous/jobs/status" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200">
          Open JSON job status
          <ArrowRight size={14} />
        </a>
        <a href="/api/autonomous/dashboard" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200">
          Open JSON dashboard
          <ArrowRight size={14} />
        </a>
        <span className="inline-flex items-center gap-2">
          <Clock3 size={14} />
          Research-only overview · no direct trading logic
        </span>
      </div>
    </div>
  );
}
