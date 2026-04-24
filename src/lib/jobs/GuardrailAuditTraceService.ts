import { PolicyAuditTrailService, type PolicyAuditTrailResult } from './PolicyAuditTrailService';
import type { PolicyChangeHistoryRecord } from './PolicyChangeHistoryService';
import { PolicyRollbackHintService, type PolicyRollbackHintResult } from './PolicyRollbackHintService';
import type { PolicyGuardrailRow, PolicyGuardrailSeverity } from './PolicyGuardrailService';

export type GuardrailHitAssessment = 'hit' | 'partial_hit' | 'not_confirmed' | 'insufficient';

export interface GuardrailAuditTraceRow {
  change: PolicyChangeHistoryRecord;
  guardrails: PolicyGuardrailRow[];
  auditResult: PolicyAuditTrailResult['audits'][number]['result'] | null;
  rollbackHint: PolicyRollbackHintResult['hints'][number] | null;
  guardrailHitAssessment: GuardrailHitAssessment;
  matchedGuardrailRuleKeys: string[];
  matchedGuardrailCount: number;
  summary: string;
  limitations: string[];
}

export interface GuardrailEffectivenessRow {
  ruleKey: string;
  title: string;
  severity: PolicyGuardrailSeverity;
  count: number;
  hit: number;
  partialHit: number;
  notConfirmed: number;
  insufficient: number;
}

export interface GuardrailAuditTraceSummary {
  total: number;
  hit: number;
  partialHit: number;
  notConfirmed: number;
  insufficient: number;
  topRules: GuardrailEffectivenessRow[];
}

export interface GuardrailAuditTraceResult {
  traces: GuardrailAuditTraceRow[];
  summary: GuardrailAuditTraceSummary;
  limitations: string[];
  generatedAt: string;
}

export interface GuardrailAuditTraceFilter {
  limit?: number;
  changeId?: number;
  windowDays?: 7 | 14 | 30;
  now?: Date;
}

export interface GuardrailAuditTraceDataSource {
  buildAuditTrail(input: GuardrailAuditTraceFilter): Promise<PolicyAuditTrailResult>;
  buildRollbackHints(input: GuardrailAuditTraceFilter): Promise<PolicyRollbackHintResult>;
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(value ?? fallback)));
}

function clampWindowDays(value: 7 | 14 | 30 | undefined): 7 | 14 | 30 {
  if (value === 7 || value === 14 || value === 30) return value;
  return 14;
}

function lowerIsBetter(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  if (before === 0 && after === 0) return false;
  return after < before;
}

function higherIsWorse(before: number | null, after: number | null, tolerance = 0): boolean {
  if (before === null || after === null) return false;
  return after > before + tolerance;
}

function buildMetricSignals(audit: PolicyAuditTrailResult['audits'][number]): {
  alertCountDown: boolean;
  activeAlertsUp: boolean;
  criticalRatioUp: boolean;
  reoccurRateUp: boolean;
  resolveTimeUp: boolean;
  recommendationCountUp: boolean;
  anyWorsening: boolean;
} {
  const before = audit.before;
  const after = audit.after;
  const alertCountDown = lowerIsBetter(before.alertCount, after.alertCount);
  const activeAlertsUp = higherIsWorse(before.activeAlerts, after.activeAlerts);
  const criticalRatioUp = higherIsWorse(before.criticalRatio, after.criticalRatio, 0.05);
  const reoccurRateUp = higherIsWorse(before.reoccurRate, after.reoccurRate, 0.05);
  const resolveTimeUp =
    before.avgResolveTimeHours !== null &&
    after.avgResolveTimeHours !== null &&
    after.avgResolveTimeHours > before.avgResolveTimeHours * 1.1;
  const recommendationCountUp = higherIsWorse(before.recommendationCount, after.recommendationCount);
  const anyWorsening = activeAlertsUp || criticalRatioUp || reoccurRateUp || resolveTimeUp || recommendationCountUp;
  return {
    alertCountDown,
    activeAlertsUp,
    criticalRatioUp,
    reoccurRateUp,
    resolveTimeUp,
    recommendationCountUp,
    anyWorsening,
  };
}

function isMatchedGuardrail(
  guardrail: PolicyGuardrailRow,
  audit: PolicyAuditTrailResult['audits'][number],
  signals: ReturnType<typeof buildMetricSignals>,
): boolean {
  if (audit.result === 'insufficient') return false;
  if (guardrail.ruleKey.includes('info_notify')) {
    return signals.recommendationCountUp || (!signals.alertCountDown && signals.anyWorsening);
  }

  if (
    guardrail.ruleKey.includes('cooldown') ||
    guardrail.ruleKey.includes('monitor') ||
    guardrail.ruleKey.includes('scheduler') ||
    guardrail.ruleKey.includes('rollback_hint') ||
    guardrail.ruleKey.includes('escalation') ||
    guardrail.ruleKey.includes('recovery_reset') ||
    guardrail.ruleKey.includes('conflict')
  ) {
    return signals.anyWorsening;
  }

  return signals.anyWorsening;
}

function buildAssessment(
  guardrails: PolicyGuardrailRow[],
  audit: PolicyAuditTrailResult['audits'][number] | null,
): {
  assessment: GuardrailHitAssessment;
  matchedGuardrailRuleKeys: string[];
  summary: string;
  limitations: string[];
} {
  if (!guardrails.length || !audit) {
    return {
      assessment: 'insufficient',
      matchedGuardrailRuleKeys: [],
      summary: 'No guardrail trace can be confirmed for this change.',
      limitations: ['The trace does not contain enough guardrail or audit evidence for a confident assessment.'],
    };
  }

  if (audit.result === 'insufficient') {
    return {
      assessment: 'insufficient',
      matchedGuardrailRuleKeys: [],
      summary: 'Audit data is too sparse to validate the guardrail outcome.',
      limitations: ['The audit window is too sparse or too recent for guardrail validation.'],
    };
  }

  const signals = buildMetricSignals(audit);
  const matchedGuardrailRuleKeys = guardrails.filter((guardrail) => isMatchedGuardrail(guardrail, audit, signals)).map((row) => row.ruleKey);
  const matchRatio = guardrails.length > 0 ? matchedGuardrailRuleKeys.length / guardrails.length : 0;

  if (matchedGuardrailRuleKeys.length === 0) {
    if (audit.result === 'worsened') {
      return {
        assessment: 'not_confirmed',
        matchedGuardrailRuleKeys,
        summary: 'The audit window worsened, but it does not clearly match the guardrails that were raised before the change.',
        limitations: ['The observed deterioration does not map cleanly to the guardrail snapshot.'],
      };
    }

    return {
      assessment: 'not_confirmed',
      matchedGuardrailRuleKeys,
      summary: 'The guardrails were not clearly confirmed by the post-change audit window.',
      limitations: ['The audit window did not show a strong match for the guardrail snapshot.'],
    };
  }

  if (matchRatio >= 0.8 && audit.result === 'worsened') {
    return {
      assessment: 'hit',
      matchedGuardrailRuleKeys,
      summary: 'The guardrails were confirmed by a post-change worsening pattern.',
      limitations: [],
    };
  }

  if (matchRatio >= 0.5) {
    return {
      assessment: 'partial_hit',
      matchedGuardrailRuleKeys,
      summary: 'Some guardrails were confirmed, but the audit window is still mixed.',
      limitations: ['The audit result is only a partial match to the guardrail snapshot.'],
    };
  }

  return {
    assessment: 'not_confirmed',
    matchedGuardrailRuleKeys,
    summary: 'The guardrails were not strongly confirmed by the observed audit window.',
    limitations: ['The guardrail snapshot does not line up strongly enough with the audit window.'],
  };
}

function summarizeTopRules(traces: GuardrailAuditTraceRow[]): GuardrailEffectivenessRow[] {
  const map = new Map<string, GuardrailEffectivenessRow>();

  for (const trace of traces) {
    for (const guardrail of trace.guardrails) {
      const existing =
        map.get(guardrail.ruleKey) ??
        ({
          ruleKey: guardrail.ruleKey,
          title: guardrail.title,
          severity: guardrail.severity,
          count: 0,
          hit: 0,
          partialHit: 0,
          notConfirmed: 0,
          insufficient: 0,
        } satisfies GuardrailEffectivenessRow);

      existing.count += 1;
      if (trace.guardrailHitAssessment === 'hit') existing.hit += 1;
      else if (trace.guardrailHitAssessment === 'partial_hit') existing.partialHit += 1;
      else if (trace.guardrailHitAssessment === 'not_confirmed') existing.notConfirmed += 1;
      else existing.insufficient += 1;
      map.set(guardrail.ruleKey, existing);
    }
  }

  return [...map.values()].sort((left, right) => right.count - left.count).slice(0, 8);
}

function summarizeResult(traces: GuardrailAuditTraceRow[]): GuardrailAuditTraceSummary {
  return {
    total: traces.length,
    hit: traces.filter((row) => row.guardrailHitAssessment === 'hit').length,
    partialHit: traces.filter((row) => row.guardrailHitAssessment === 'partial_hit').length,
    notConfirmed: traces.filter((row) => row.guardrailHitAssessment === 'not_confirmed').length,
    insufficient: traces.filter((row) => row.guardrailHitAssessment === 'insufficient').length,
    topRules: summarizeTopRules(traces),
  };
}

function defaultLimitations(hasChanges: boolean): string[] {
  return [
    ...(hasChanges ? [] : ['No policy changes have been recorded yet.']),
    'Guardrail tracing is advisory only and never blocks or rolls back a save.',
    'Trace assessment depends on the quality of the post-change audit window.',
  ];
}

export class GuardrailAuditTraceService {
  constructor(
    private readonly deps: GuardrailAuditTraceDataSource = {
      buildAuditTrail: (input) => new PolicyAuditTrailService().build(input),
      buildRollbackHints: (input) => new PolicyRollbackHintService().build(input),
    },
  ) {}

  async build(filter: GuardrailAuditTraceFilter = {}): Promise<GuardrailAuditTraceResult> {
    const now = filter.now ?? new Date();
    const limit = clampLimit(filter.limit, 5);
    const windowDays = clampWindowDays(filter.windowDays);

    const [auditTrail, rollbackHints] = await Promise.all([
      this.deps.buildAuditTrail({
        limit: filter.changeId ? 100 : limit,
        changeId: filter.changeId,
        windowDays,
        now,
      }),
      this.deps.buildRollbackHints({
        limit: filter.changeId ? 100 : limit,
        changeId: filter.changeId,
        windowDays,
        now,
      }),
    ]);

    const selectedChanges = filter.changeId ? auditTrail.changes.filter((change) => change.id === filter.changeId) : auditTrail.changes.slice(0, limit);
    const traces: GuardrailAuditTraceRow[] = [];

    for (const change of selectedChanges) {
      const audit = auditTrail.audits.find((row) => row.change.id === change.id) ?? null;
      const hint = rollbackHints.hints.find((row) => row.change.id === change.id) ?? null;
      const guardrails = change.guardrailDetails ?? [];
      const assessment = buildAssessment(guardrails, audit);

      traces.push({
        change,
        guardrails,
        auditResult: audit?.result ?? null,
        rollbackHint: hint,
        guardrailHitAssessment: assessment.assessment,
        matchedGuardrailRuleKeys: assessment.matchedGuardrailRuleKeys,
        matchedGuardrailCount: assessment.matchedGuardrailRuleKeys.length,
        summary: assessment.summary,
        limitations: [
          ...assessment.limitations,
          ...(hint?.limitations ?? []).slice(0, 2),
          ...(guardrails.length === 0 ? ['This change did not capture any guardrail snapshot.'] : []),
        ],
      });
    }

    const summary = summarizeResult(traces);
    const limitations = [
      ...defaultLimitations(auditTrail.changes.length > 0),
      ...(traces.some((row) => row.guardrailHitAssessment === 'insufficient') ? ['At least one trace cannot be validated with high confidence.'] : []),
    ];

    return {
      traces,
      summary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
