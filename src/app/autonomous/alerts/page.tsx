import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { PolicyRecommendationType } from '@/lib/jobs/PolicyRecommendationEngine';
import type { JobAlertRecord, JobAlertSeverity } from '@/lib/jobs/types';
import { ArrowLeft, AlertTriangle, Clock3, Database, ShieldAlert, RotateCw, TrendingUp } from 'lucide-react';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

function parseString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStatus(value: string | undefined): 'active' | 'resolved' | 'suppressed' | 'all' | undefined {
  const parsed = parseString(value);
  if (!parsed) return undefined;
  return parsed === 'active' || parsed === 'resolved' || parsed === 'suppressed' || parsed === 'all' ? parsed : undefined;
}

function parseSeverity(value: string | undefined): JobAlertSeverity | undefined {
  const parsed = parseString(value);
  if (!parsed) return undefined;
  return parsed === 'info' || parsed === 'warning' || parsed === 'critical' ? parsed : undefined;
}

function parseRecommendationType(value: string | undefined): PolicyRecommendationType | undefined {
  const parsed = parseString(value);
  if (!parsed) return undefined;
  return parsed as PolicyRecommendationType;
}

function parseSort(value: string | undefined): 'latest' | 'occurrenceCount' | 'firstDetectedAt' | undefined {
  const parsed = parseString(value);
  if (!parsed) return undefined;
  return parsed === 'latest' || parsed === 'occurrenceCount' || parsed === 'firstDetectedAt' ? parsed : undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildQueryString(base: SearchParams, patch: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    const raw = firstValue(value as string | string[] | undefined);
    if (raw && raw.trim().length > 0) params.set(key, raw);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value && value.trim().length > 0) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}

function badgeTone(status: string | null | undefined): string {
  if (!status) return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  if (status === 'active') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (status === 'resolved') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (status === 'suppressed') return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function severityTone(severity: JobAlertSeverity): string {
  if (severity === 'critical') return 'bg-red-500/10 text-red-300 border-red-500/30';
  if (severity === 'warning') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(1)}h`;
}

function emptyMessage(filters: { status?: string; severity?: string; jobName?: string }): string {
  if (filters.status || filters.severity || filters.jobName) {
    return 'No alerts matched the current filters.';
  }
  return 'No persisted job alerts yet.';
}

function splitJobNames(text: string | undefined): string[] {
  if (text == null) return [];
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function pickTrendWindow(days: number): '7d' | '14d' | '30d' {
  if (days <= 7) return '7d';
  if (days <= 14) return '14d';
  return '30d';
}

function pickTrendBucket(window: '7d' | '14d' | '30d'): 'day' | 'week' {
  return window === '30d' ? 'week' : 'day';
}

function trendTone(direction: 'improving' | 'worsening' | 'stable' | 'insufficient'): string {
  if (direction === 'improving') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (direction === 'worsening') return 'bg-red-500/10 text-red-300 border-red-500/30';
  if (direction === 'stable') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function familyTone(family: string): string {
  if (family === 'never_ran') return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  if (family === 'missed_run') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (family === 'failed_run' || family === 'consecutive_failure') return 'bg-red-500/10 text-red-300 border-red-500/30';
  if (family === 'delayed_run') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
  if (family === 'recovery_event') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function recommendationStatusTone(status: 'active' | 'resolved' | 'stale'): string {
  if (status === 'active') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (status === 'resolved') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function TrendChart({ trend }: { trend: Awaited<ReturnType<JobAlertTrendService['build']>> | null }) {
  if (trend == null) return null;

  const maxTotal = Math.max(1, ...trend.buckets.map((bucket) => bucket.total));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Trend Chart</div>
          <div className="text-xs text-slate-500">{trend.summary.windowDays}d · {trend.bucket === 'week' ? 'weekly' : 'daily'} buckets</div>
        </div>
        <Badge className={trendTone(trend.summary.trendDirection)}>{trend.summary.trendDirection}</Badge>
      </div>

      {trend.buckets.some((bucket) => bucket.total > 0) ? (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2 md:grid-cols-14 xl:grid-cols-14">
            {trend.buckets.map((bucketPoint) => {
              const barHeight = Math.max(6, Math.round((bucketPoint.total / maxTotal) * 120));
              const resolvedHeight = bucketPoint.total > 0 ? Math.max(4, Math.round((bucketPoint.resolved / Math.max(1, bucketPoint.total)) * barHeight)) : 0;
              const activeHeight = bucketPoint.total > 0 ? Math.max(4, barHeight - resolvedHeight) : 0;
              return (
                <div key={bucketPoint.date} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-[130px] w-full items-end justify-center rounded-lg border border-slate-800 bg-slate-900/40 px-1 py-2">
                    <div className="flex w-full max-w-[18px] flex-col justify-end overflow-hidden rounded-md bg-slate-800/80" style={{ height: `${barHeight}px` }}>
                      {resolvedHeight > 0 ? (
                        <div className="w-full bg-emerald-500/80" style={{ height: `${resolvedHeight}px` }} />
                      ) : null}
                      {activeHeight > 0 ? <div className="w-full bg-slate-400/80" style={{ height: `${activeHeight}px` }} /> : null}
                    </div>
                  </div>
                  <div className="w-full text-[10px] leading-tight text-slate-500">{bucketPoint.label}</div>
                  <div className="w-full text-[10px] text-slate-400">T {bucketPoint.total}</div>
                  <div className="w-full text-[10px] text-slate-400">R {bucketPoint.resolved}</div>
                  <div className="w-full text-[10px] text-slate-400">C {bucketPoint.critical} · W {bucketPoint.warning}</div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-4">
            <div>Total occurrences: <span className="text-white">{trend.summary.totalOccurrences}</span></div>
            <div>Resolved: <span className="text-white">{trend.summary.totalResolved}</span></div>
            <div>Avg per bucket: <span className="text-white">{trend.summary.avgPerBucket.toFixed(1)}</span></div>
            <div>Peak bucket: <span className="text-white">{trend.summary.peakBucket}</span></div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No trend data in the selected window.
        </div>
      )}

      {trend.limitations.length > 0 ? (
        <div className="space-y-2 text-xs text-slate-500">
          {trend.limitations.map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoisySourceBreakdownCard({
  breakdown,
}: {
  breakdown: Awaited<ReturnType<NoisySourceBreakdownService['build']>> | null;
}) {
  if (!breakdown) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Noisy Source Breakdown</div>
          <div className="text-xs text-slate-500">{breakdown.summary.overallSummary}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
            source: {breakdown.summary.source}
          </Badge>
          {breakdown.topFamily ? (
            <Badge className={familyTone(breakdown.topFamily.family)}>
              top: {breakdown.topFamily.familyLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      {breakdown.families.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-3 pl-3 pr-4">Family</th>
                <th className="py-3 pr-4">Count</th>
                <th className="py-3 pr-4">Occurrences</th>
                <th className="py-3 pr-4">Reoccur</th>
                <th className="py-3 pr-4">Avg Resolve</th>
                <th className="py-3 pr-4">Critical</th>
                <th className="py-3 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.families.map((family) => {
                const isTop = breakdown.topFamily?.family === family.family;
                return (
                  <tr
                    key={family.family}
                    className={`border-b border-slate-900/80 align-top ${isTop ? 'bg-cyan-500/5' : ''}`}
                  >
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={familyTone(family.family)}>{family.familyLabel}</Badge>
                        {isTop ? <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30">Top</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{family.derivedReason}</div>
                    </td>
                    <td className="py-3 pr-4 text-white">{formatCount(family.count)}</td>
                    <td className="py-3 pr-4 text-white">{formatCount(family.totalOccurrences)}</td>
                    <td className="py-3 pr-4 text-slate-300">{family.reoccurRate === null ? 'n/a' : `${(family.reoccurRate * 100).toFixed(1)}%`}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatHours(family.avgResolveTimeHours)}</td>
                    <td className="py-3 pr-4 text-slate-300">
                      {family.criticalRatio === null ? 'n/a' : `${(family.criticalRatio * 100).toFixed(1)}%`}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      <div>{family.summaryNote}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Active {formatCount(family.activeCount)} · Resolved {formatCount(family.resolvedCount)} · Confidence {(family.groupingConfidence * 100).toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No noisy source families available for this job in the selected window.
        </div>
      )}

      {breakdown.limitations.length > 0 ? (
        <div className="space-y-2 text-xs text-slate-500">
          {breakdown.limitations.map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FamilyTrendCard({
  familyTrend,
}: {
  familyTrend: Awaited<ReturnType<FamilyTrendService['build']>> | null;
}) {
  if (!familyTrend) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Family Trend</div>
          <div className="text-xs text-slate-500">{familyTrend.overallSummary}</div>
        </div>
        <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
          {familyTrend.window} · {familyTrend.bucket}
        </Badge>
      </div>

      {familyTrend.families.length > 0 ? (
        <div className="space-y-3">
          {familyTrend.families.map((family) => (
            <div key={family.family} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={familyTone(family.family)}>{family.familyLabel}</Badge>
                  <Badge className={trendTone(family.trendDirection)}>{family.trendDirection}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {formatCount(family.totalOccurrences)} occ · {formatCount(family.totalResolved)} resolved · {family.avgPerBucket.toFixed(1)}/bucket
                </div>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 md:grid-cols-14">
                {family.buckets.map((bucket) => (
                  <div key={`${family.family}-${bucket.date}`} className="rounded-md border border-slate-800 bg-slate-950/60 p-1 text-center">
                    <div className="h-12 flex items-end justify-center">
                      <div className="w-full rounded bg-slate-800" style={{ height: `${Math.max(6, Math.min(48, bucket.total * 8))}px` }} />
                    </div>
                    <div className="mt-1 text-[9px] text-slate-500">{bucket.label.slice(-5)}</div>
                    <div className="text-[10px] text-slate-300">{bucket.total}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-slate-300">{family.limitations[0] ?? 'Trend available.'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No family trend data available.
        </div>
      )}
    </div>
  );
}

function ResolveDistributionCard({
  resolveDistribution,
}: {
  resolveDistribution: Awaited<ReturnType<ResolveTimeDistributionService['build']>> | null;
}) {
  if (!resolveDistribution) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Resolve Time Distribution</div>
          <div className="text-xs text-slate-500">{resolveDistribution.overallSummary}</div>
        </div>
        <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">{resolveDistribution.days}d</Badge>
      </div>

      {resolveDistribution.families.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-3 pl-3 pr-4">Family</th>
                <th className="py-3 pr-4">Resolved</th>
                <th className="py-3 pr-4">Unresolved</th>
                <th className="py-3 pr-4">Avg</th>
                <th className="py-3 pr-4">Median</th>
                <th className="py-3 pr-4">P90</th>
                <th className="py-3 pr-4">Max</th>
                <th className="py-3 pr-4">Unresolved %</th>
                <th className="py-3 pr-4">Summary</th>
              </tr>
            </thead>
            <tbody>
              {resolveDistribution.families.map((family) => (
                <tr key={family.family} className="border-b border-slate-900/80 align-top">
                  <td className="py-3 pl-3 pr-4">
                    <Badge className={familyTone(family.family)}>{family.familyLabel}</Badge>
                    <div className="mt-1 text-xs text-slate-500">{family.limitations[0] ?? 'Resolved samples available.'}</div>
                  </td>
                  <td className="py-3 pr-4 text-white">{formatCount(family.resolvedCount)}</td>
                  <td className="py-3 pr-4 text-white">{formatCount(family.unresolvedCount)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatHours(family.avgResolveTimeHours)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatHours(family.medianResolveTimeHours)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatHours(family.p90ResolveTimeHours)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatHours(family.maxResolveTimeHours)}</td>
                  <td className="py-3 pr-4 text-slate-300">
                    {family.unresolvedRatio === null ? 'n/a' : `${(family.unresolvedRatio * 100).toFixed(1)}%`}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{family.distributionSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No resolve-time distribution data available.
        </div>
      )}

      {resolveDistribution.limitations.length > 0 ? (
        <div className="space-y-2 text-xs text-slate-500">
          {resolveDistribution.limitations.map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecommendationsCard({
  recommendations,
  limitations,
}: {
  recommendations: Awaited<ReturnType<PolicyRecommendationEngine['build']>> | null;
  limitations: string[];
}) {
  if (!recommendations) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Policy Recommendations</div>
          <div className="text-xs text-slate-500">
            Advisory only. Suggestions are derived from alert history, family trends, and current policy settings.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
            total {formatCount(recommendations.summary.total)}
          </Badge>
          <Badge className="bg-red-500/10 text-red-300 border-red-500/30">
            critical {formatCount(recommendations.summary.critical)}
          </Badge>
          <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30">
            warning {formatCount(recommendations.summary.warning)}
          </Badge>
          <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
            info {formatCount(recommendations.summary.info)}
          </Badge>
        </div>
      </div>

      {recommendations.recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.recommendations.map((item, index) => (
            <div key={`${item.targetJob}-${item.targetFamily ?? 'all'}-${item.recommendationType}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={severityTone(item.severity)}>{item.severity}</Badge>
                  <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">{item.recommendationType}</Badge>
                  <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30">{item.category}</Badge>
                </div>
                <div className="text-xs text-slate-500">confidence {(item.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="mt-2 text-sm font-medium text-white">
                {item.targetJob}
                {item.targetFamily ? <span className="text-slate-400"> · {item.targetFamily}</span> : null}
              </div>
              <div className="mt-1 text-sm text-slate-300">{item.rationale}</div>
              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                {item.suggestedAction}
              </div>
              {item.limitations.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {item.limitations.slice(0, 2).map((limitation) => (
                    <div key={limitation} className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1">
                      {limitation}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No actionable recommendation could be derived from the current signal.
        </div>
      )}

      {limitations.length > 0 ? (
        <div className="space-y-2 text-xs text-slate-500">
          {limitations.map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecommendationHistoryCard({
  history,
  summary,
  currentSearchParams,
}: {
  history: Awaited<ReturnType<RecommendationHistoryService['listHistory']>>;
  summary: Awaited<ReturnType<RecommendationHistoryService['buildSummary']>>;
  currentSearchParams: SearchParams;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Recommendation History</div>
          <div className="text-xs text-slate-500">Recurring policy suggestions and their lifecycle over time.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30">active {formatCount(summary.active)}</Badge>
          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">resolved {formatCount(summary.resolved)}</Badge>
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">stale {formatCount(summary.stale)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(summary.total)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Critical</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(summary.critical)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Top Jobs</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(summary.topJobs.length)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Recurring</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(summary.recurringRecommendations.length)}</div>
          </CardContent>
        </Card>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-3 pl-3 pr-4">Type</th>
                <th className="py-3 pr-4">Job</th>
                <th className="py-3 pr-4">Family</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Count</th>
                <th className="py-3 pr-4">First</th>
                <th className="py-3 pr-4">Last</th>
                <th className="py-3 pr-4">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => {
                const jobQuery = buildQueryString(currentSearchParams, { jobName: row.targetJob, offset: '0' });
                return (
                  <tr key={row.recommendationKey} className="border-b border-slate-900/80 align-top">
                    <td className="py-3 pl-3 pr-4">
                      <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30">{row.recommendationType}</Badge>
                      <div className="mt-1 text-xs text-slate-500">{row.suggestedAction}</div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-white">
                      <Link href={`/autonomous/alerts?${jobQuery}`} className="hover:text-cyan-300">
                        {row.targetJob}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{row.targetFamily ?? 'n/a'}</td>
                    <td className="py-3 pr-4">
                      <Badge className={recommendationStatusTone(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-white">{formatCount(row.occurrenceCount)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatDate(row.firstDetectedAt)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatDate(row.lastDetectedAt)}</td>
                    <td className="py-3 pr-4 text-slate-300">{row.rationale}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No recommendation history yet.
        </div>
      )}

      {summary.topJobs.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">Top Jobs</div>
          <div className="flex flex-wrap gap-2">
            {summary.topJobs.slice(0, 5).map((job) => (
              <Badge key={job.jobName} className="bg-slate-500/10 text-slate-300 border-slate-500/30">
                {job.jobName}: {formatCount(job.recommendationCount)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecommendationTrendCard({
  trend,
}: {
  trend: Awaited<ReturnType<RecommendationTrendService['build']>> | null;
}) {
  if (!trend) return null;

  const maxTotal = Math.max(1, ...trend.buckets.map((bucket) => bucket.total));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Recommendation Trend</div>
          <div className="text-xs text-slate-500">
            {trend.recommendationType ?? 'all types'} · {trend.targetJob ?? 'all jobs'} · {trend.status}
          </div>
        </div>
        <Badge className={trendTone(trend.summary.trendDirection)}>{trend.summary.trendDirection}</Badge>
      </div>

      {trend.buckets.some((bucket) => bucket.total > 0 || bucket.active > 0 || bucket.resolved > 0) ? (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2 md:grid-cols-14 xl:grid-cols-14">
            {trend.buckets.map((bucketPoint) => {
              const barHeight = Math.max(6, Math.round((bucketPoint.total / maxTotal) * 120));
              const resolvedHeight = bucketPoint.total > 0 ? Math.max(4, Math.round((bucketPoint.resolved / Math.max(1, bucketPoint.total)) * barHeight)) : 0;
              const activeHeight = bucketPoint.total > 0 ? Math.max(4, barHeight - resolvedHeight) : 0;
              return (
                <div key={bucketPoint.date} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-[130px] w-full items-end justify-center rounded-lg border border-slate-800 bg-slate-900/40 px-1 py-2">
                    <div className="flex w-full max-w-[18px] flex-col justify-end overflow-hidden rounded-md bg-slate-800/80" style={{ height: `${barHeight}px` }}>
                      {resolvedHeight > 0 ? (
                        <div className="w-full bg-emerald-500/80" style={{ height: `${resolvedHeight}px` }} />
                      ) : null}
                      {activeHeight > 0 ? <div className="w-full bg-cyan-400/80" style={{ height: `${activeHeight}px` }} /> : null}
                    </div>
                  </div>
                  <div className="w-full text-[10px] leading-tight text-slate-500">{bucketPoint.label}</div>
                  <div className="w-full text-[10px] text-slate-400">T {bucketPoint.total}</div>
                  <div className="w-full text-[10px] text-slate-400">A {bucketPoint.active}</div>
                  <div className="w-full text-[10px] text-slate-400">R {bucketPoint.resolved}</div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-4">
            <div>Total occurrences: <span className="text-white">{formatCount(trend.summary.totalOccurrences)}</span></div>
            <div>Resolved: <span className="text-white">{formatCount(trend.summary.totalResolved)}</span></div>
            <div>Avg per bucket: <span className="text-white">{trend.summary.avgPerBucket.toFixed(1)}</span></div>
            <div>Peak bucket: <span className="text-white">{trend.summary.peakBucket}</span></div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No recommendation trend data in the selected window.
        </div>
      )}

      {trend.limitations.length > 0 ? (
        <div className="space-y-2 text-xs text-slate-500">
          {trend.limitations.map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecommendationLifecycleCard({
  lifecycle,
  currentSearchParams,
}: {
  lifecycle: Awaited<ReturnType<RecommendationLifecycleService['build']>> | null;
  currentSearchParams: SearchParams;
}) {
  if (!lifecycle) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Recommendation Lifecycle</div>
          <div className="text-xs text-slate-500">
            {lifecycle.recommendationType ?? 'all types'} · {lifecycle.targetJob ?? 'all jobs'} · {lifecycle.status}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30">active {formatCount(lifecycle.summary.active)}</Badge>
          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">resolved {formatCount(lifecycle.summary.resolved)}</Badge>
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">recurring {formatCount(lifecycle.summary.recurring)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(lifecycle.summary.total)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Resolved Cycles</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(lifecycle.summary.resolvedCycles)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Reoccurs</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(lifecycle.summary.reoccurCount)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg Observations</div>
            <div className="mt-1 text-2xl font-black text-white">{lifecycle.summary.avgOccurrences.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {lifecycle.recommendations.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-3 pl-3 pr-4">Type</th>
                <th className="py-3 pr-4">Job</th>
                <th className="py-3 pr-4">Family</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Count</th>
                <th className="py-3 pr-4">Resolved Cycles</th>
                <th className="py-3 pr-4">Reoccurs</th>
                <th className="py-3 pr-4">First</th>
                <th className="py-3 pr-4">Last</th>
                <th className="py-3 pr-4">Summary</th>
              </tr>
            </thead>
            <tbody>
              {lifecycle.recommendations.map((row) => {
                const jobQuery = buildQueryString(currentSearchParams, { jobName: row.targetJob, offset: '0' });
                return (
                  <tr key={row.recommendationKey} className="border-b border-slate-900/80 align-top">
                    <td className="py-3 pl-3 pr-4">
                      <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30">{row.recommendationType}</Badge>
                      <div className="mt-1 text-xs text-slate-500">{row.severity}</div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-white">
                      <Link href={`/autonomous/alerts?${jobQuery}`} className="hover:text-cyan-300">
                        {row.targetJob}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{row.targetFamily ?? 'n/a'}</td>
                    <td className="py-3 pr-4">
                      <Badge className={recommendationStatusTone(row.currentStatus)}>{row.currentStatus}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-white">{formatCount(row.occurrenceCount)}</td>
                    <td className="py-3 pr-4 text-white">{formatCount(row.resolvedCount)}</td>
                    <td className="py-3 pr-4 text-white">{formatCount(row.reoccurCount)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatDate(row.firstDetectedAt)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatDate(row.lastDetectedAt)}</td>
                    <td className="py-3 pr-4 text-slate-300">{row.lifecycleSummary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No recommendation lifecycle data available.
        </div>
      )}

      {lifecycle.limitations.length > 0 ? (
        <div className="space-y-2 text-xs text-slate-500">
          {lifecycle.limitations.map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DrilldownPanel({
  drilldown,
  trend,
  breakdown,
  familyTrend,
  resolveDistribution,
  currentSearchParams,
}: {
  drilldown: Awaited<ReturnType<JobAlertDrilldownService['build']>> | null;
  trend: Awaited<ReturnType<JobAlertTrendService['build']>> | null;
  breakdown: Awaited<ReturnType<NoisySourceBreakdownService['build']>> | null;
  familyTrend: Awaited<ReturnType<FamilyTrendService['build']>> | null;
  resolveDistribution: Awaited<ReturnType<ResolveTimeDistributionService['build']>> | null;
  currentSearchParams: SearchParams;
}) {
  if (!drilldown) return null;

  const jobQuery = buildQueryString(currentSearchParams, { jobName: drilldown.jobName, offset: '0' });

  return (
    <Card className="border-slate-800 bg-slate-950/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-slate-100">Job Drill-Down</CardTitle>
            <div className="mt-1 text-sm text-slate-400">
              {drilldown.jobName ? (
                <>
                  Current job: <span className="font-medium text-white">{drilldown.jobName}</span>
                </>
              ) : (
                'No job selected.'
              )}
            </div>
          </div>
          {drilldown.jobName ? (
            <Link href={`/autonomous/alerts?${jobQuery}`} className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white">
              Open filtered view
            </Link>
          ) : null}
        </div>
        <div className="text-sm text-slate-400">{drilldown.summary.summaryNote}</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(drilldown.summary.activeAlertsCount)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Resolved</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(drilldown.summary.resolvedAlertsCount)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Occurrences</div>
            <div className="mt-1 text-2xl font-black text-white">{formatCount(drilldown.summary.totalOccurrences)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg resolve</div>
            <div className="mt-1 text-2xl font-black text-white">{formatHours(drilldown.summary.averageHoursToResolve)}</div>
          </div>
        </div>

        <TrendChart trend={trend} />

        <NoisySourceBreakdownCard breakdown={breakdown} />

        <div className="grid gap-4 xl:grid-cols-2">
          <FamilyTrendCard familyTrend={familyTrend} />
          <ResolveDistributionCard resolveDistribution={resolveDistribution} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <div className="text-sm font-semibold text-white">Severity Breakdown</div>
            <div className="flex flex-wrap gap-2">
              {(['critical', 'warning', 'info'] as const).map((severity) => (
                <Badge key={severity} className={severityTone(severity)}>
                  {severity}: {formatCount(drilldown.summary.severityDistribution[severity])}
                </Badge>
              ))}
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              <div>Latest status: <span className="text-white">{drilldown.summary.latestAlertStatus}</span></div>
              <div>Recent reoccurs: <span className="text-white">{formatCount(drilldown.summary.recentReoccurCount)}</span></div>
              <div>Recent resolved: <span className="text-white">{formatCount(drilldown.summary.recentResolvedCount)}</span></div>
              <div>Most common message: <span className="text-white">{drilldown.summary.mostCommonAlertMessage ?? 'n/a'}</span></div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
              {drilldown.summary.summaryNote}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <div className="text-sm font-semibold text-white">Recent Timeline</div>
            {drilldown.timeline.length > 0 ? (
              <div className="space-y-3">
                {drilldown.timeline.slice(0, 8).map((item) => (
                  <div key={`${item.id}-${item.detectedAt}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={severityTone(item.severity)}>{item.severity}</Badge>
                        <Badge className={badgeTone(item.status)}>{item.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">{formatDate(item.detectedAt)}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-200">{item.message}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Count {formatCount(item.occurrenceCount)} · First {formatDate(item.firstDetectedAt)} · Last {formatDate(item.lastDetectedAt)}
                      {item.resolvedAt ? ` · Resolved ${formatDate(item.resolvedAt)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
                No timeline events for this job yet.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <RotateCw size={16} />
              Recent Recovery Events
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              {drilldown.recentRecoveryEvents.length > 0 ? (
                drilldown.recentRecoveryEvents.slice(0, 4).map((item) => (
                  <div key={`${item.id}-${item.resolvedAt}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="font-medium text-white">{item.message}</div>
                    <div className="text-xs text-slate-500">
                      Resolved {formatDate(item.resolvedAt)} · Count {formatCount(item.occurrenceCount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">No resolved cycles in the current window.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <TrendingUp size={16} />
              Limitations
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              {drilldown.limitations.length > 0 ? (
                drilldown.limitations.map((item) => (
                  <div key={item} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    {item}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">No limitations recorded.</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertTable({ alerts, currentSearchParams }: { alerts: JobAlertRecord[]; currentSearchParams: SearchParams }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-400">
            <th className="py-3 pr-4">Job</th>
            <th className="py-3 pr-4">Severity</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">First Detected</th>
            <th className="py-3 pr-4">Last Detected</th>
            <th className="py-3 pr-4">Resolved</th>
            <th className="py-3 pr-4 text-right">Count</th>
            <th className="py-3 pr-4">Message</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const jobQuery = buildQueryString(currentSearchParams, { jobName: alert.jobName, offset: '0' });
            return (
              <tr key={`${alert.alertKey}-${alert.id}`} className="border-b border-slate-900/80 align-top">
                <td className="py-3 pr-4 font-medium text-white">
                  <Link href={`/autonomous/alerts?${jobQuery}`} className="hover:text-cyan-300">
                    {alert.jobName}
                  </Link>
                  <div className="text-xs text-slate-500">{alert.alertKey}</div>
                </td>
                <td className="py-3 pr-4">
                  <Badge className={severityTone(alert.severity)}>{alert.severity}</Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge className={badgeTone(alert.status)}>{alert.status}</Badge>
                </td>
                <td className="py-3 pr-4 text-slate-400">{formatDate(alert.firstDetectedAt)}</td>
                <td className="py-3 pr-4 text-slate-400">{formatDate(alert.lastDetectedAt)}</td>
                <td className="py-3 pr-4 text-slate-400">{formatDate(alert.resolvedAt)}</td>
                <td className="py-3 pr-4 text-right font-mono text-white">{formatCount(alert.occurrenceCount)}</td>
                <td className="py-3 pr-4 text-slate-300">{alert.message}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AutonomousAlertsPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const historyService = new JobAlertHistoryService();
  const drilldownService = new JobAlertDrilldownService();
  const breakdownService = new NoisySourceBreakdownService();
  const familyTrendService = new FamilyTrendService();
  const resolveDistributionService = new ResolveTimeDistributionService();
  const recommendationHistoryService = new RecommendationHistoryService();
  const recommendationTrendService = new RecommendationTrendService();
  const recommendationLifecycleService = new RecommendationLifecycleService();
  const recommendationEngine = new PolicyRecommendationEngine();
  const status = parseStatus(firstValue(searchParams.status));
  const severity = parseSeverity(firstValue(searchParams.severity));
  const recommendationType = parseRecommendationType(firstValue(searchParams.recommendationType));
  const jobName = parseString(firstValue(searchParams.jobName));
  const sortBy = parseSort(firstValue(searchParams.sort)) ?? 'latest';
  const sortDir = firstValue(searchParams.direction) === 'asc' ? 'asc' : 'desc';
  const limit = parseNumber(firstValue(searchParams.limit), 50);
  const offset = parseNumber(firstValue(searchParams.offset), 0);
  const days = parseNumber(firstValue(searchParams.days), 14);

  const alerts = await historyService.listHistory(
    {
      status,
      severity,
      jobName,
      includeResolved: status === 'resolved' || status === 'all' ? true : undefined,
      onlyActive: status === 'active' ? true : undefined,
      sortBy,
      sortDir,
      limit,
      offset,
      days,
    },
    new Date(),
  );
  const summary = await historyService.buildSummary({ severity, jobName, days }, new Date());
  const drilldown = jobName ? await drilldownService.build(jobName, days, new Date()) : null;
  const trendService = new JobAlertTrendService();
  const trendWindow = pickTrendWindow(days);
  const trendBucket = pickTrendBucket(trendWindow);
  const trend = jobName ? await trendService.build(jobName, trendWindow, trendBucket, new Date()) : null;
  const breakdown = jobName ? await breakdownService.build(jobName, days, new Date()) : null;
  const familyTrend = jobName ? await familyTrendService.build(jobName, trendWindow, trendBucket, new Date()) : null;
  const resolveDistribution = jobName ? await resolveDistributionService.build(jobName, days, new Date()) : null;
  const recommendations = await recommendationEngine.build({
    jobName,
    severity,
    limit: jobName ? 3 : 5,
    now: new Date(),
  });
  await recommendationHistoryService.syncFromRecommendations(recommendations.recommendations, new Date(), {
    resolveMissing: !jobName,
    scopeJobs: jobName ? [jobName] : Array.from(new Set(recommendations.recommendations.map((item) => item.targetJob))),
  });
  const recommendationHistory = await recommendationHistoryService.listHistory({
    jobName,
    status: 'all',
    limit: jobName ? 20 : 8,
    sortBy: 'latest',
    sortDir: 'desc',
  });
  const recommendationHistorySummary = await recommendationHistoryService.buildSummary({
    jobName,
    status: 'all',
  });
  const recommendationTrend = await recommendationTrendService.build(
    {
      recommendationType,
      targetJob: jobName ?? undefined,
      status,
    },
    pickTrendWindow(days),
    pickTrendBucket(pickTrendWindow(days)),
    new Date(),
  );
  const recommendationLifecycle = await recommendationLifecycleService.build(
    {
      recommendationKey: firstValue(searchParams.recommendationKey) ?? undefined,
      recommendationType,
      targetJob: jobName ?? undefined,
      status,
      limit: jobName ? 12 : 8,
    },
    new Date(),
  );
  const jobNames = splitJobNames(jobName);
  const hasPrevious = offset > 0;
  const hasNext = alerts.length >= limit;
  const previousOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
            <Database size={14} />
            Autonomous Alerts
          </div>
          <h1 className="text-3xl font-black text-white mt-2">JobAlert History View</h1>
          <p className="text-slate-400 mt-2">
            觀察 autonomous jobs 的 alert lifecycle、resolved/reoccur 趨勢與 noisy jobs。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/autonomous/dashboard" className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white">
            <ArrowLeft size={14} />
            返回 dashboard
          </Link>
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
            updated {new Date().toLocaleString()}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle size={16} />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{formatCount(summary.active)}</div>
            <div className="text-sm text-slate-400">Currently open alerts.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <Clock3 size={16} />
              Resolved Recently
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{formatCount(summary.resolvedRecently)}</div>
            <div className="text-sm text-slate-400">Resolved within the selected window.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <ShieldAlert size={16} />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{formatCount(summary.critical)}</div>
            <div className="text-sm text-slate-400">High-priority system alerts.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <Database size={16} />
              Top Noisy Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{formatCount(summary.topNoisyJobs.length)}</div>
            <div className="space-y-1 text-sm text-slate-400">
              {summary.topNoisyJobs[0] ? (
                summary.topNoisyJobs.slice(0, 3).map((job) => (
                  <div key={job.jobName}>
                    <Link href={`/autonomous/alerts?${buildQueryString(searchParams, { jobName: job.jobName, offset: '0' })}`} className="hover:text-cyan-300">
                      {job.jobName} ({formatCount(job.occurrenceCount)})
                    </Link>
                  </div>
                ))
              ) : (
                <div>No noisy jobs yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <RecommendationsCard
        recommendations={recommendations}
        limitations={recommendations.limitations}
      />

      <RecommendationHistoryCard
        history={recommendationHistory}
        summary={recommendationHistorySummary}
        currentSearchParams={searchParams}
      />

      <RecommendationTrendCard trend={recommendationTrend} />

      <RecommendationLifecycleCard
        lifecycle={recommendationLifecycle}
        currentSearchParams={searchParams}
      />

      {jobName ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          Filtered job drill-down: <span className="font-medium text-white">{jobName}</span>
          <Link href={`/autonomous/alerts?${buildQueryString(searchParams, { jobName: undefined, offset: '0' })}`} className="ml-3 text-cyan-300 hover:text-cyan-200">
            Clear job filter
          </Link>
        </div>
      ) : null}

      <DrilldownPanel
        drilldown={drilldown}
        trend={trend}
        breakdown={breakdown}
        familyTrend={familyTrend}
        resolveDistribution={resolveDistribution}
        currentSearchParams={searchParams}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-100">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" method="get">
            <label className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div>
              <select name="status" defaultValue={status ?? 'all'} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="suppressed">Suppressed</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Severity</div>
              <select name="severity" defaultValue={severity ?? 'all'} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white">
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Job Name</div>
              <input
                name="jobName"
                defaultValue={jobName ?? ''}
                placeholder="autonomous:daily"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sort</div>
              <select name="sort" defaultValue={sortBy} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white">
                <option value="latest">Latest</option>
                <option value="occurrenceCount">Occurrence Count</option>
                <option value="firstDetectedAt">First Detected</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Limit</div>
              <input
                name="limit"
                type="number"
                min={1}
                max={200}
                defaultValue={limit}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
              />
            </label>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-5">
              <input type="hidden" name="offset" value="0" />
              <input type="hidden" name="days" value={String(days)} />
              <button className="rounded-full border border-slate-700 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white" type="submit">
                Apply Filters
              </button>
              <Link href="/autonomous/alerts" className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white">
                Reset
              </Link>
            </div>
          </form>
          {jobNames.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              Active job filters: {jobNames.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-slate-100">Alert History</CardTitle>
          <div className="text-sm text-slate-400">
            Showing {formatCount(alerts.length)} alert{alerts.length === 1 ? '' : 's'}
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <>
              <AlertTable alerts={alerts} currentSearchParams={searchParams} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                <div>
                  Offset {offset} · Limit {limit}
                </div>
                <div className="flex gap-2">
                  {hasPrevious ? (
                    <Link
                      href={`/autonomous/alerts?${buildQueryString(searchParams, { offset: String(previousOffset) })}`}
                      className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-600">Previous</span>
                  )}
                  {hasNext ? (
                    <Link
                      href={`/autonomous/alerts?${buildQueryString(searchParams, { offset: String(nextOffset) })}`}
                      className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-600">Next</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
              {emptyMessage({ status, severity, jobName })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
