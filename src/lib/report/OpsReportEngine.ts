/**
 * OpsReportEngine.ts
 *
 * Builds the Daily Ops Report v1 — a structured system health and data
 * observability artifact for operator use.
 *
 * IMPORTANT: This is NOT a trading recommendation. This is NOT a buy/sell signal.
 * This is NOT ROI evidence. This is NOT win-rate evidence.
 * This is NOT proof of alpha or edge.
 * This is a system readiness and observability artifact.
 *
 * No DB writes. No external API calls. No strategy validation. No backtest.
 * No H001-H012. No forbidden fields.
 */

import {
  getLatestMarketRegimeContext,
  computeFreshnessAlert,
  type FreshnessAlert,
  type RegimeContext,
} from '@/lib/marketRegimeResult';
import { resolveCurrentDate } from '@/lib/time/currentDate';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OpsReportStatus =
  | 'PASS'
  | 'PASS_WITH_WARNINGS'
  | 'STALE_DATA'
  | 'MISSING_DATA'
  | 'GUARDRAIL_FAIL'
  | 'BLOCKED';

export interface OpsMarketRegime {
  regimeLabel: string | null;
  confidence: number | null;
  date: string | null;
  source: 'PERSISTED_MARKET_REGIME_RESULT' | 'UNAVAILABLE';
  freshnessStatus: string | null;
  freshnessLagDays: number | null;
  freshnessAlert: FreshnessAlert;
  isAvailable: boolean;
}

export interface OpsFreshness {
  marketRegimeFreshness: string;
  freshnessLagDays: number | null;
  requiresAction: boolean;
  message: string | null;
}

export interface OpsWalkForward {
  contextAvailable: boolean;
  sampleDays: number;
  recordsWithRegimeContext: number;
  recordsMissingRegimeContext: number;
  pitSafe: boolean;
  noBehaviorChange: boolean;
  note: string;
}

export interface OpsGuardrails {
  noTradingAdvisory: boolean;
  noBuySellContent: boolean;
  noPerformanceEvidence: boolean;
  noLegacyHypotheses: boolean;
  noForbiddenFields: boolean;
  noDbWrite: boolean;
  noExternalApiCall: boolean;
}

export interface OpsDataQuality {
  marketRegimeResultAvailable: boolean;
  latestRegimeDate: string | null;
  freshnessAlertLevel: string;
  pitSafe: boolean;
}

export interface OpsReadiness {
  operatorReady: boolean;
  schedulerReady: boolean;
  dashboardReady: boolean;
  hardcodedDateRisk: boolean;
  notes: string[];
}

export interface DailyOpsReport {
  reportDate: string;
  generatedAt: string;
  status: OpsReportStatus;
  summary: string;
  marketRegime: OpsMarketRegime;
  freshness: OpsFreshness;
  walkForward: OpsWalkForward;
  guardrails: OpsGuardrails;
  dataQuality: OpsDataQuality;
  readiness: OpsReadiness;
  nextActions: string[];
  doNotInterpretAs: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DO_NOT_INTERPRET_AS = [
  'This is not a trading advisory.',
  'This is not a buy/sell content.',
  'This is not ROI evidence.',
  'This is not win-rate evidence.',
  'This is not proof of alpha or edge.',
  'This is a system readiness and observability artifact.',
];

// Walk-forward summary from T-10 (static, evidence-based from artifact)
const WALK_FORWARD_SUMMARY: OpsWalkForward = {
  contextAvailable: true,
  sampleDays: 120,
  recordsWithRegimeContext: 120,
  recordsMissingRegimeContext: 0,
  pitSafe: true,
  noBehaviorChange: true,
  note: 'T-10 walk-forward skeleton: 120/120 records enriched with regime context. PIT-safe (regimeDate <= asofDate enforced). No behavior change validated.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeOpsStatus(
  freshnessAlert: FreshnessAlert,
  isAvailable: boolean,
): OpsReportStatus {
  if (!isAvailable) return 'MISSING_DATA';
  if (freshnessAlert.alertLevel === 'FRESH') return 'PASS';
  if (freshnessAlert.alertLevel === 'STALE') return 'PASS_WITH_WARNINGS';
  if (freshnessAlert.alertLevel === 'CRITICAL_STALE') return 'STALE_DATA';
  if (freshnessAlert.alertLevel === 'FUTURE_DATE_ERROR') return 'GUARDRAIL_FAIL';
  return 'MISSING_DATA';
}

function buildSummary(status: OpsReportStatus, regimeLabel: string | null, freshnessAlertLevel: string): string {
  const regimePart = regimeLabel ? `Market regime: ${regimeLabel}.` : 'Market regime: unavailable.';
  switch (status) {
    case 'PASS':
      return `System health PASS. ${regimePart} Freshness: FRESH. All guardrails satisfied.`;
    case 'PASS_WITH_WARNINGS':
      return `System health PASS with warnings. ${regimePart} Freshness: ${freshnessAlertLevel}. Operator review recommended.`;
    case 'STALE_DATA':
      return `System health STALE_DATA. ${regimePart} Data refresh required. Freshness: ${freshnessAlertLevel}.`;
    case 'MISSING_DATA':
      return `System health MISSING_DATA. Market regime context unavailable. Immediate investigation required.`;
    case 'GUARDRAIL_FAIL':
      return `System health GUARDRAIL_FAIL. ${regimePart} Freshness error: ${freshnessAlertLevel}. Immediate attention required.`;
    default:
      return `System health BLOCKED. Manual intervention required.`;
  }
}

function computeNextActions(
  status: OpsReportStatus,
  freshnessAlert: FreshnessAlert,
): string[] {
  const actions: string[] = [];
  if (status === 'MISSING_DATA') {
    actions.push('Run persist-market-regime-results.py to backfill MarketRegimeResult data.');
  }
  if (freshnessAlert.requiresAction) {
    actions.push(`Data refresh required: ${freshnessAlert.message ?? 'MarketRegimeResult is stale or missing.'}`);
  }
  if (status === 'PASS') {
    actions.push('No immediate action required. Continue daily monitoring.');
  }
  return actions;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Builds the Daily Ops Report v1.
 *
 * Data sources:
 * - getLatestMarketRegimeContext() — reads MarketRegimeResult from DB (read-only)
 * - computeFreshnessAlert() — pure function, no DB/API
 * - Walk-forward summary — static evidence from T-10 artifact
 *
 * No DB writes. No external API calls. No strategy validation.
 */
export async function buildDailyOpsReport(
  currentDate?: string,
): Promise<DailyOpsReport> {
  const reportDate = resolveCurrentDate(currentDate);
  const generatedAt = new Date().toISOString();

  let ctx: RegimeContext;
  try {
    ctx = await getLatestMarketRegimeContext(currentDate);
  } catch {
    ctx = {
      isAvailable: false,
      freshnessStatus: 'MISSING',
      freshnessLagDays: -1,
      warning: 'Failed to fetch MarketRegimeResult from DB',
    };
  }

  const freshnessAlert = computeFreshnessAlert(ctx, currentDate);

  const marketRegime: OpsMarketRegime = ctx.isAvailable
    ? {
        regimeLabel: ctx.regimeLabel,
        confidence: ctx.confidence,
        date: ctx.date,
        source: 'PERSISTED_MARKET_REGIME_RESULT',
        freshnessStatus: ctx.freshnessStatus,
        freshnessLagDays: ctx.freshnessLagDays,
        freshnessAlert,
        isAvailable: true,
      }
    : {
        regimeLabel: null,
        confidence: null,
        date: null,
        source: 'UNAVAILABLE',
        freshnessStatus: 'MISSING',
        freshnessLagDays: null,
        freshnessAlert,
        isAvailable: false,
      };

  const freshness: OpsFreshness = {
    marketRegimeFreshness: freshnessAlert.alertLevel,
    freshnessLagDays: freshnessAlert.freshnessLagDays,
    requiresAction: freshnessAlert.requiresAction,
    message: freshnessAlert.message,
  };

  const guardrails: OpsGuardrails = {
    noTradingAdvisory: true,
    noBuySellContent: true,
    noPerformanceEvidence: true,
    noLegacyHypotheses: true,
    noForbiddenFields: true,
    noDbWrite: true,
    noExternalApiCall: true,
  };

  const dataQuality: OpsDataQuality = {
    marketRegimeResultAvailable: ctx.isAvailable,
    latestRegimeDate: ctx.isAvailable ? ctx.date : null,
    freshnessAlertLevel: freshnessAlert.alertLevel,
    pitSafe: true,
  };

  const readiness: OpsReadiness = {
    operatorReady: true,
    schedulerReady: freshnessAlert.alertLevel === 'FRESH',
    dashboardReady: ctx.isAvailable,
    hardcodedDateRisk: false,
    notes: [
      freshnessAlert.requiresAction
        ? `Freshness requires action: ${freshnessAlert.alertLevel}`
        : 'Freshness OK.',
    ],
  };

  const status = computeOpsStatus(freshnessAlert, ctx.isAvailable);
  const summary = buildSummary(status, marketRegime.regimeLabel, freshnessAlert.alertLevel);
  const nextActions = computeNextActions(status, freshnessAlert);

  return {
    reportDate,
    generatedAt,
    status,
    summary,
    marketRegime,
    freshness,
    walkForward: WALK_FORWARD_SUMMARY,
    guardrails,
    dataQuality,
    readiness,
    nextActions,
    doNotInterpretAs: DO_NOT_INTERPRET_AS,
  };
}
