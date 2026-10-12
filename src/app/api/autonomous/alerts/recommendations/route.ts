import { NextResponse } from 'next/server';
import { PolicyRecommendationEngine } from '@/lib/jobs/PolicyRecommendationEngine';
import { RecommendationHistoryService } from '@/lib/jobs/RecommendationHistoryService';
import type { JobAlertSeverity } from '@/lib/jobs/types';

function parseOptionalString(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseSeverity(value: string | null): JobAlertSeverity | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) return undefined;
  return parsed === 'info' || parsed === 'warning' || parsed === 'critical' ? parsed : undefined;
}

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobName = parseOptionalString(url.searchParams.get('jobName'));
    const severity = parseSeverity(url.searchParams.get('severity'));
    const limit = parseNumber(url.searchParams.get('limit'), 5);
    const engine = new PolicyRecommendationEngine();
    const result = await engine.build({ jobName, severity, limit, now: new Date() });
    await new RecommendationHistoryService().syncFromRecommendations(result.recommendations, new Date(), {
      resolveMissing: !jobName,
      scopeJobs: jobName ? [jobName] : Array.from(new Set(result.recommendations.map((item) => item.targetJob))),
    });

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Policy recommendations failed:', error);
    return NextResponse.json(
      {
        recommendations: [],
        summary: {
          total: 0,
          critical: 0,
          warning: 0,
          info: 0,
          byType: {
            cooldown_increase: 0,
            cooldown_decrease: 0,
            review_monitor_frequency: 0,
            review_scheduler_reliability: 0,
            consider_severity_escalation: 0,
            consider_severity_downgrade: 0,
            no_change_recommended: 0,
          },
          byCategory: {
            policy: 0,
            scheduler: 0,
            severity: 0,
            monitoring: 0,
          },
          jobCount: 0,
          topJobs: [],
        },
        limitations: ['Failed to load policy recommendations.'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
