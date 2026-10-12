// ──────────────────────────────────────────────────────────────────────────────
// Autonomous Optimization Miner
//
// When the signal state is TRUE_EXHAUSTED (not enough trading data), this module
// mines 5 independent improvement sources and returns a valid 8-hour task instead
// of skipping the planner tick.
//
// Sources: system_health | code_quality | ui_ux | wiki_docs | test_coverage
//
// Only returns a task if:
//   - estimatedDurationHours is 4–8
//   - canRunUnattended = true
//   - acceptanceCriteria are non-empty
//   - publishStatus != UNSAFE
//   - dedupeKey not in miner_state.json (TTL = 14 days)
//   - daily quota not exceeded (HIGH: 1/day, MEDIUM: 3/day, LOW: 5/day)
// ──────────────────────────────────────────────────────────────────────────────

import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import type {
  MinerDailyQuota,
  MinerState,
  OptimizationPublishStatus,
  OptimizationRiskLevel,
  OptimizationSourceType,
  OptimizationTaskCandidate,
  PlannerTaskFingerprint,
  ProjectProfile,
  TaskContract,
  TaskResult,
  TaskRecord,
} from './types';
import type { PlannerDraft } from './providers';
import { MINER_STATE_PATH, WORKSPACE_ROOT, fileExists, readJsonFile, writeJsonFile } from './common';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTA = { HIGH: 1, MEDIUM: 3, LOW: 5 } as const;
const MIN_DURATION_H = 4;
const MAX_DURATION_H = 8;
const DEDUPE_TTL_DAYS = 14;

// ─── Miner State ──────────────────────────────────────────────────────────────

async function loadMinerState(): Promise<MinerState> {
  if (await fileExists(MINER_STATE_PATH)) {
    return readJsonFile<MinerState>(MINER_STATE_PATH).catch(() => freshMinerState());
  }
  return freshMinerState();
}

async function saveMinerState(state: MinerState): Promise<void> {
  await writeJsonFile(MINER_STATE_PATH, state);
}

function freshMinerState(): MinerState {
  return {
    version: '1.0',
    publishedDedupeKeys: {},
    dailyQuota: { date: todayIso(), highRisk: 0, mediumRisk: 0, lowRisk: 0 },
    lastRunAt: null,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetQuotaIfStale(state: MinerState): MinerState {
  const today = todayIso();
  if (state.dailyQuota.date !== today) {
    return { ...state, dailyQuota: { date: today, highRisk: 0, mediumRisk: 0, lowRisk: 0 } };
  }
  return state;
}

function isDedupeExpired(publishedAt: string): boolean {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return true;
  return (Date.now() - published) / (1000 * 60 * 60 * 24) > DEDUPE_TTL_DAYS;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ScoringInputs {
  impactScore: number;      // 0–40
  blockerScore: number;     // 0–20
  userValueScore: number;   // 0–20
  confidenceScore: number;  // 0–10
  riskLevel: OptimizationRiskLevel;
  prerequisiteCount: number;
}

function computePriorityScore(inputs: ScoringInputs): number {
  const riskPenalty = inputs.riskLevel === 'HIGH' ? 20 : inputs.riskLevel === 'MEDIUM' ? 10 : 5;
  const depPenalty = Math.min(inputs.prerequisiteCount * 3, 10);
  return Math.max(
    0,
    Math.round(
      inputs.impactScore +
        inputs.blockerScore +
        inputs.userValueScore +
        inputs.confidenceScore -
        riskPenalty -
        depPenalty,
    ),
  );
}

// Base scoring inputs per source type — tuned so system_health beats code quality
// when evidence is strong (stale data directly blocks operation).
const SOURCE_BASE_SCORE: Record<OptimizationSourceType, ScoringInputs> = {
  system_health:          { impactScore: 38, blockerScore: 18, userValueScore: 16, confidenceScore: 9,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  execution_layer:        { impactScore: 34, blockerScore: 16, userValueScore: 14, confidenceScore: 9,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  lifecycle:              { impactScore: 30, blockerScore: 14, userValueScore: 14, confidenceScore: 9,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  learning_layer:         { impactScore: 36, blockerScore: 18, userValueScore: 18, confidenceScore: 9,  riskLevel: 'MEDIUM', prerequisiteCount: 1 },
  price_analysis_quality: { impactScore: 36, blockerScore: 16, userValueScore: 16, confidenceScore: 9,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  code_quality:           { impactScore: 22, blockerScore: 8,  userValueScore: 14, confidenceScore: 8,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  ui_ux:                  { impactScore: 18, blockerScore: 6,  userValueScore: 18, confidenceScore: 7,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  wiki_docs:              { impactScore: 14, blockerScore: 4,  userValueScore: 12, confidenceScore: 9,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  test_coverage:          { impactScore: 20, blockerScore: 10, userValueScore: 16, confidenceScore: 7,  riskLevel: 'LOW',    prerequisiteCount: 0 },
  trading_learning:       { impactScore: 40, blockerScore: 20, userValueScore: 20, confidenceScore: 10, riskLevel: 'MEDIUM', prerequisiteCount: 1 },
};

// ─── Source: System Health ─────────────────────────────────────────────────────

async function mineSystemHealth(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // A1: StockQuote freshness
  try {
    const latestQuote = await prisma.stockQuote.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, stockId: true },
    });
    if (!latestQuote || latestQuote.createdAt < twoDaysAgo) {
      const age = latestQuote
        ? `${Math.round((now.getTime() - latestQuote.createdAt.getTime()) / 3_600_000)}h ago`
        : 'never';
      candidates.push(makeCandidate({
        taskId: 'system_health__stale_quotes',
        sourceType: 'system_health',
        title: 'Audit and repair stale StockQuote sync pipeline',
        problem: `Most recent StockQuote was ${age}. Market data sync may be broken or incomplete, silently degrading all downstream signal quality.`,
        evidence: [
          `Latest StockQuote: ${latestQuote?.createdAt.toISOString() ?? 'NONE'}`,
          `Threshold: must be within 2 trading days`,
          `Affected stock: ${latestQuote?.stockId ?? 'unknown'}`,
        ],
        impact: 'All signal generation, candidate scoring, and strategy learning depend on fresh quote data. Stale data causes silent degradation.',
        estimatedDurationHours: 6,
        acceptanceCriteria: [
          'Diagnose root cause of sync gap and document in report',
          'Run manual backfill or trigger resync for all affected date ranges',
          'Verify StockQuote.createdAt is within 48h for all tracked stocks after fix',
          'Write gap summary to docs/reports/sync_gap_report.md',
        ],
        forbiddenActions: ['Do not delete existing quote records', 'Do not modify strategy thresholds'],
        suggestedFiles: ['scripts/', 'src/lib/sync/', 'docs/DATA_SYNC_GUIDE.md'],
      }));
    }
  } catch { /* non-blocking */ }

  // A2: InstitutionalChip freshness
  try {
    const latestChip = await prisma.institutionalChip.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, stockId: true },
    });
    if (!latestChip || latestChip.createdAt < twoDaysAgo) {
      const age = latestChip
        ? `${Math.round((now.getTime() - latestChip.createdAt.getTime()) / 3_600_000)}h ago`
        : 'never';
      candidates.push(makeCandidate({
        taskId: 'system_health__stale_chips',
        sourceType: 'system_health',
        title: 'Audit and repair stale InstitutionalChip sync',
        problem: `Most recent InstitutionalChip was ${age}. Foreign/trust/dealer flow data drives chip-concentration signals.`,
        evidence: [
          `Latest chip record: ${latestChip?.createdAt.toISOString() ?? 'NONE'}`,
          'Threshold: must be within 2 trading days',
        ],
        impact: 'Chip-based signals (外資/投信/自營) are central to the doubling detector and candidate scoring.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Diagnose the chip sync pipeline and document failures',
          'Trigger backfill for last 5 trading days',
          'Confirm chip records for at least 50 tracked stocks are up to date',
          'Write gap report to docs/reports/chip_sync_gap_report.md',
        ],
        forbiddenActions: ['Do not delete existing chip records'],
        suggestedFiles: ['scripts/', 'logs/chip_backfill_state.json', 'docs/DATA_SYNC_GUIDE.md'],
      }));
    }
  } catch { /* non-blocking */ }

  // A3: JobRunLog failures in last 24h
  try {
    const failures = await prisma.jobRunLog.findMany({
      where: { status: 'failed', createdAt: { gte: oneDayAgo } },
      select: { jobName: true, errorMessage: true, scheduledFor: true },
      orderBy: { scheduledFor: 'desc' },
      take: 20,
    });
    if (failures.length >= 2) {
      const failedJobs = [...new Set(failures.map((f) => f.jobName))].join(', ');
      candidates.push(makeCandidate({
        taskId: 'system_health__job_failures',
        sourceType: 'system_health',
        title: 'Investigate and resolve recurring scheduler job failures',
        problem: `${failures.length} JobRunLog entries with status=failed in the last 24h across: ${failedJobs}. Silent failures leave the pipeline in an unknown state.`,
        evidence: failures.slice(0, 5).map(
          (f) => `${f.jobName} @ ${f.scheduledFor.toISOString()}: ${(f.errorMessage ?? '(no message)').slice(0, 80)}`,
        ),
        impact: 'Job failures prevent data sync, signal generation, and report delivery. Every failure is a silent data gap.',
        estimatedDurationHours: 6,
        acceptanceCriteria: [
          `Root cause identified and documented for each failed job: ${failedJobs}`,
          'Fix applied or retry mechanism improved',
          'JobRunLog shows 0 failures for the same jobs in the next 24h window',
          'Write incident report to docs/reports/scheduler_incident.md',
        ],
        forbiddenActions: [
          'Do not disable jobs without operator approval',
          'Do not clear JobRunLog history',
        ],
        suggestedFiles: ['src/lib/scheduler/', 'scripts/', 'logs/'],
      }));
    }
  } catch { /* non-blocking */ }

  // A4: Stuck SimulatedTrades (open/pending > 24h)
  try {
    const stuckWhere = { status: { in: ['open', 'pending'] }, createdAt: { lte: oneDayAgo } };
    const [stuckCount, stuckSample] = await Promise.all([
      prisma.simulatedTrade.count({ where: stuckWhere }),
      prisma.simulatedTrade.findMany({
        where: stuckWhere,
        select: { id: true, symbol: true, setupType: true, createdAt: true },
        take: 5,
      }),
    ]);
    if (stuckCount >= 3) {
      candidates.push(makeCandidate({
        taskId: 'system_health__stuck_trades',
        sourceType: 'system_health',
        title: 'Audit and close stuck SimulatedTrade lifecycle',
        problem: `${stuckCount} SimulatedTrades in open/pending status for > 24h — indicates broken lifecycle or missing exit trigger.`,
        evidence: stuckSample.map(
          (t) => `Trade #${t.id} ${t.symbol} (${t.setupType}) open since ${t.createdAt.toISOString()}`,
        ),
        impact: 'Stuck trades pollute win rate statistics, skew learning data, and prevent accurate signal evaluation.',
        estimatedDurationHours: 4,
        acceptanceCriteria: [
          `All ${stuckCount} stuck trades resolved (cancelled or closed with documented reason)`,
          'Exit trigger logic reviewed and hardened for the identified edge case',
          'Zero trades in open/pending state > 24h after fix',
          'Write lifecycle audit report to docs/reports/lifecycle_audit.md',
        ],
        forbiddenActions: [
          'Do not modify pnlPct values arbitrarily',
          'Do not delete trade records',
        ],
        suggestedFiles: ['src/lib/lifecycle/', 'src/lib/trading/', 'scripts/'],
      }));
    }
  } catch { /* non-blocking */ }

  // A5: StrategyLearningInsight freshness
  try {
    const latestInsight = await prisma.strategyLearningInsight.findFirst({
      orderBy: { id: 'desc' },
      select: { createdAt: true },
    });
    if (!latestInsight || latestInsight.createdAt < sevenDaysAgo) {
      const age = latestInsight
        ? `${Math.round((now.getTime() - latestInsight.createdAt.getTime()) / (24 * 3_600_000))} days ago`
        : 'never';
      candidates.push(makeCandidate({
        taskId: 'system_health__no_learning_insight',
        sourceType: 'system_health',
        title: 'Diagnose why StrategyLearningInsight generation has stalled',
        problem: `Last StrategyLearningInsight was ${age}. The learning pipeline appears stalled, preventing strategy adaptation.`,
        evidence: [
          `Last insight: ${latestInsight?.createdAt.toISOString() ?? 'NONE'}`,
          'Expected frequency: at least once every 7 days when trades exist',
        ],
        impact: 'Without fresh insights, the trading system cannot adapt. Insights are the primary input to strategy refinement.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Root cause of insight generation failure identified and documented',
          'Learning pipeline health verified end-to-end',
          'At least 1 new StrategyLearningInsight generated after fix (or confirmed blocked by data)',
          'Write diagnosis report to docs/reports/learning_pipeline_health.md',
        ],
        forbiddenActions: [
          'Do not manually insert fake insight records',
          'Do not change learning thresholds without approval',
        ],
        suggestedFiles: ['src/lib/learning/', 'scripts/', 'src/lib/agent-orchestrator/signalStateClassifier.ts'],
      }));
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Execution Layer ─────────────────────────────────────────────────

async function mineExecutionLayer(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // F1: Trigger distribution skew — one triggerType dominates > 80%
  try {
    const trades = await prisma.simulatedTrade.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { setupType: true, triggerScore: true },
    });
    if (trades.length >= 10) {
      const freq: Record<string, number> = {};
      for (const t of trades) { freq[t.setupType] = (freq[t.setupType] ?? 0) + 1; }
      const total = trades.length;
      const dominant = Object.entries(freq).find(([, n]) => n / total > 0.80);
      if (dominant) {
        candidates.push(makeCandidate({
          taskId: 'execution_layer__trigger_skew',
          sourceType: 'execution_layer',
          title: 'Diagnose and rebalance trigger distribution skew in execution layer',
          problem: `setupType "${dominant[0]}" accounts for ${Math.round(dominant[1] / total * 100)}% of all simulated trades in the last 7 days (${dominant[1]}/${total}). Skew indicates the scoring engine is over-fitting to one setup pattern.`,
          evidence: Object.entries(freq).map(([k, v]) => `${k}: ${v} trades (${Math.round(v / total * 100)}%)`),
          impact: 'Monoculture in trigger type kills diversification. A single bad signal floods the portfolio.',
          estimatedDurationHours: 6,
          acceptanceCriteria: [
            'Root cause of trigger skew identified (scoring weight, signal density, or filtering bias)',
            'Scoring weights reviewed and documented with rationale',
            'Trigger distribution rebalanced so no single setupType > 60% of weekly trades',
            'Write analysis report to docs/reports/trigger_distribution_audit.md',
          ],
          forbiddenActions: [
            'Do not delete any SimulatedTrade records',
            'Do not lower scoring thresholds arbitrarily',
            'Do not modify live position sizing without approval',
          ],
          suggestedFiles: ['src/lib/scoring/', 'src/lib/strategy/', 'scripts/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  // F2: Shadow trade saturation — > 70% of recent trades are shadow mode
  try {
    const modes = await prisma.simulatedTrade.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { tradeMode: true },
    });
    if (modes.length >= 5) {
      const shadowCount = modes.filter((t) => t.tradeMode === 'shadow').length;
      const shadowPct = shadowCount / modes.length;
      if (shadowPct > 0.70) {
        candidates.push(makeCandidate({
          taskId: 'execution_layer__shadow_saturation',
          sourceType: 'execution_layer',
          title: 'Investigate shadow trade saturation blocking full execution mode',
          problem: `${Math.round(shadowPct * 100)}% of recent simulated trades are in shadow mode (${shadowCount}/${modes.length}). If full-mode promotion criteria are blocked, the system never learns real execution quality.`,
          evidence: [
            `Shadow trades (7d): ${shadowCount}/${modes.length} = ${Math.round(shadowPct * 100)}%`,
            'Expected: shadow fraction < 70% once system is stable',
          ],
          impact: 'Shadow mode trades never enter the learning dataset for execution quality. System stays in perpetual dry-run.',
          estimatedDurationHours: 5,
          acceptanceCriteria: [
            'Shadow-to-full promotion criteria reviewed and documented',
            'At least 3 trades promoted to full mode or promotion blockers explicitly documented',
            'Promotion gate thresholds verified to be reachable with current data volume',
            'Write shadow audit report to docs/reports/shadow_promotion_audit.md',
          ],
          forbiddenActions: [
            'Do not force-promote trades without meeting criteria',
            'Do not modify trade records directly',
          ],
          suggestedFiles: ['src/lib/trading/', 'src/lib/lifecycle/', 'scripts/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  // F3: Score clustering — all recent trigger scores in a narrow band (< 0.15 range)
  try {
    const recentScores = await prisma.simulatedTrade.findMany({
      where: { createdAt: { gte: oneDayAgo }, triggerScore: { not: null } },
      select: { triggerScore: true, symbol: true },
      take: 50,
    });
    if (recentScores.length >= 8) {
      const scores = recentScores.map((t) => t.triggerScore as number);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = max - min;
      if (range < 0.15) {
        candidates.push(makeCandidate({
          taskId: 'execution_layer__score_clustering',
          sourceType: 'execution_layer',
          title: 'Audit trigger score clustering — scoring engine lacks discriminatory power',
          problem: `Last ${recentScores.length} trigger scores cluster in a ${range.toFixed(3)} range (min=${min.toFixed(3)}, max=${max.toFixed(3)}). The scoring engine cannot distinguish strong from weak signals.`,
          evidence: [
            `Score range (24h): ${min.toFixed(3)} – ${max.toFixed(3)} (range = ${range.toFixed(3)})`,
            `Expected range: > 0.30 for meaningful signal discrimination`,
            `Samples: ${recentScores.length} trades`,
          ],
          impact: 'Score clustering forces the system to use an arbitrary cutoff rather than genuine conviction ranking. Every entry looks equally valid.',
          estimatedDurationHours: 6,
          acceptanceCriteria: [
            'Score distribution analyzed and root cause of clustering identified',
            'At least one scoring factor recalibrated to expand discriminatory range',
            'Score range after fix > 0.25 on a fresh 24h sample',
            'Write scoring audit report to docs/reports/score_clustering_audit.md',
          ],
          forbiddenActions: [
            'Do not artificially stretch scores with min-max normalization without understanding root cause',
            'Do not change position sizing based on this analysis alone',
          ],
          suggestedFiles: ['src/lib/scoring/', 'src/lib/signals/', 'scripts/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Lifecycle ────────────────────────────────────────────────────────

async function mineLifecycle(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // G1: No trade closes in last 7 days
  try {
    const recentCloses = await prisma.simulatedTrade.count({
      where: { status: 'closed', updatedAt: { gte: sevenDaysAgo } },
    });
    const totalOpen = await prisma.simulatedTrade.count({ where: { status: { in: ['open', 'pending'] } } });
    if (recentCloses === 0 && totalOpen > 0) {
      candidates.push(makeCandidate({
        taskId: 'lifecycle__no_closes',
        sourceType: 'lifecycle',
        title: 'Diagnose stalled lifecycle — no SimulatedTrade closes in 7 days',
        problem: `Zero SimulatedTrade closes in the last 7 days despite ${totalOpen} open/pending trades. Exit criteria may be broken or signal thresholds are unreachable.`,
        evidence: [
          `Closed in last 7 days: 0`,
          `Currently open/pending: ${totalOpen}`,
          'Expected: at least some trades closing weekly via stop-loss or target',
        ],
        impact: 'No closes means no completed learning samples. Win rate, PnL, and strategy adaptation are all frozen.',
        estimatedDurationHours: 6,
        acceptanceCriteria: [
          'Exit trigger logic traced end-to-end and breakage point identified',
          'At least 1 trade manually reviewed for why it has not closed',
          'Exit criteria verified to be reachable with current price data',
          'Write lifecycle health report to docs/reports/lifecycle_health.md',
        ],
        forbiddenActions: [
          'Do not force-close trades with arbitrary PnL values',
          'Do not delete trade records',
        ],
        suggestedFiles: ['src/lib/lifecycle/', 'src/lib/trading/', 'scripts/'],
      }));
    }
  } catch { /* non-blocking */ }

  // G2: No trade reviews generated recently
  try {
    const recentReviews = await prisma.tradeReviewReport.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    if (recentReviews === 0) {
      candidates.push(makeCandidate({
        taskId: 'lifecycle__no_reviews',
        sourceType: 'lifecycle',
        title: 'Diagnose missing TradeReviewReport generation pipeline',
        problem: 'Zero TradeReviewReport records created in the last 7 days. Post-trade reviews feed the learning pipeline and without them strategy adaptation halts.',
        evidence: [
          'TradeReviewReport count (7d): 0',
          'Expected: at least 1 review per closed trade',
        ],
        impact: 'The learning pipeline ingests TradeReviewReport records. No reviews → no learning data → strategy cannot adapt.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Review generation pipeline traced and failure point identified',
          'At least 1 TradeReviewReport generated for a recent closed trade (or confirmed blocked by missing closed trades)',
          'Review trigger verified to be wired to the trade close event',
          'Write pipeline health report to docs/reports/review_pipeline_health.md',
        ],
        forbiddenActions: [
          'Do not manually insert fake review records',
          'Do not modify existing review content',
        ],
        suggestedFiles: ['src/lib/lifecycle/', 'src/lib/learning/', 'scripts/'],
      }));
    }
  } catch { /* non-blocking */ }

  // G3: Extreme holdingDays anomaly — trades held > 30 days
  try {
    const longHolders = await prisma.simulatedTrade.findMany({
      where: { status: { in: ['open', 'pending'] }, holdingDays: { gte: 30 } },
      select: { id: true, symbol: true, setupType: true, holdingDays: true, entryDate: true },
      take: 20,
    });
    if (longHolders.length >= 2) {
      candidates.push(makeCandidate({
        taskId: 'lifecycle__extreme_holding_days',
        sourceType: 'lifecycle',
        title: 'Review and resolve trades with anomalous holding durations (> 30 days)',
        problem: `${longHolders.length} SimulatedTrades have been open for > 30 days. This suggests exit logic is not triggering or the system is holding losers indefinitely.`,
        evidence: longHolders.slice(0, 5).map(
          (t) => `Trade #${t.id} ${t.symbol} (${t.setupType}) — ${t.holdingDays ?? '?'} days, entry ${t.entryDate}`,
        ),
        impact: 'Indefinite holding distorts win rate, ties up simulated capital, and prevents the learning system from observing outcomes.',
        estimatedDurationHours: 4,
        acceptanceCriteria: [
          `All ${longHolders.length} long-hold trades reviewed with documented rationale`,
          'Exit logic for max-holding-days enforced or force-close policy documented',
          'Zero trades > 30 days old after fix (or all exceptions documented)',
          'Write holdingDays audit report to docs/reports/holding_days_audit.md',
        ],
        forbiddenActions: [
          'Do not close trades with fake exit prices',
          'Do not modify holdingDays fields directly',
        ],
        suggestedFiles: ['src/lib/lifecycle/', 'src/lib/trading/'],
      }));
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Learning Layer ────────────────────────────────────────────────────

async function mineLearningLayer(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // H1: Signal imbalance — only one setupType in closed trades
  try {
    const closedTrades = await prisma.simulatedTrade.findMany({
      where: { status: 'closed', createdAt: { gte: thirtyDaysAgo } },
      select: { setupType: true, pnlPct: true },
      take: 200,
    });
    if (closedTrades.length >= 10) {
      const typeSet = new Set(closedTrades.map((t) => t.setupType));
      if (typeSet.size <= 1) {
        const onlyType = [...typeSet][0] ?? 'unknown';
        candidates.push(makeCandidate({
          taskId: 'learning_layer__signal_imbalance',
          sourceType: 'learning_layer',
          title: 'Diagnose learning signal imbalance — only one setup type in closed trades',
          problem: `All ${closedTrades.length} closed trades in the last 30 days are of setupType "${onlyType}". Signal imbalance means insights are only relevant to one pattern — the learning system cannot generalize.`,
          evidence: [
            `Closed trade setupTypes (30d): ${[...typeSet].join(', ')}`,
            `Total closed: ${closedTrades.length}`,
            'Expected: at least 2–3 distinct setup types for generalizable learning',
          ],
          impact: 'Monoculture in learning data produces overfit insights. Strategy adaptations will only work for one pattern and fail on others.',
          estimatedDurationHours: 6,
          riskLevel: 'MEDIUM',
          acceptanceCriteria: [
            'Root cause of setup type imbalance identified (proposal generator, scoring filter, or market conditions)',
            'Proposal diversity verified — at least 2 setup types active in signal pipeline',
            'If market conditions are the cause, that is documented clearly in insights',
            'Write signal diversity report to docs/reports/signal_diversity_audit.md',
          ],
          forbiddenActions: [
            'Do not artificially inject fake trades to balance the dataset',
            'Do not lower scoring thresholds without analysis',
          ],
          suggestedFiles: ['src/lib/learning/', 'src/lib/strategy/', 'src/lib/signals/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  // H2: Insufficient learning signals — < 5 closed trades in last 30 days
  try {
    const closedCount = await prisma.simulatedTrade.count({
      where: { status: 'closed', createdAt: { gte: thirtyDaysAgo } },
    });
    const insightCount = await prisma.strategyLearningInsight.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    if (closedCount < 5 && insightCount === 0) {
      candidates.push(makeCandidate({
        taskId: 'learning_layer__insufficient_signals',
        sourceType: 'learning_layer',
        title: 'Bootstrap learning dataset — insufficient closed trade signals for insight generation',
        problem: `Only ${closedCount} closed trades in the last 30 days and 0 new insights generated in the last 7 days. The learning pipeline needs a minimum data density to produce useful insights.`,
        evidence: [
          `Closed trades (30d): ${closedCount} (minimum needed: 5)`,
          `New insights (7d): ${insightCount}`,
          'Learning pipeline threshold: 5+ closed trades required for insight generation',
        ],
        impact: 'Without enough closed trade data, the learning pipeline generates no insights and the system cannot self-improve.',
        estimatedDurationHours: 7,
        riskLevel: 'MEDIUM',
        acceptanceCriteria: [
          'Root cause of low trade closure rate identified and documented',
          'Proposal pipeline verified — at least 3 new proposals generated and entering trade lifecycle',
          'Learning pipeline threshold configuration reviewed and adjusted if too conservative',
          'Write learning gap report to docs/reports/learning_gap_analysis.md',
        ],
        forbiddenActions: [
          'Do not insert synthetic trade records to meet thresholds',
          'Do not modify historical pnlPct values',
        ],
        suggestedFiles: ['src/lib/learning/', 'src/lib/lifecycle/', 'src/lib/agent-orchestrator/signalStateClassifier.ts'],
      }));
    }
  } catch { /* non-blocking */ }

  // H3: No TradeJournalEntry records — learning narrative is missing
  try {
    const journalCount = await prisma.tradeJournalEntry.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    if (journalCount === 0) {
      candidates.push(makeCandidate({
        taskId: 'learning_layer__no_journal_entries',
        sourceType: 'learning_layer',
        title: 'Diagnose missing TradeJournalEntry pipeline — learning narrative unavailable',
        problem: 'Zero TradeJournalEntry records in the last 30 days. Journal entries capture decision reasoning and execution detail which enrich StrategyLearningInsight generation.',
        evidence: [
          'TradeJournalEntry count (30d): 0',
          'Expected: 1 journal entry per closed trade with reasoning and lifecycle narrative',
        ],
        impact: 'Without journal entries, insights lack narrative context. The learning system cannot explain WHY a trade succeeded or failed — only that it did.',
        estimatedDurationHours: 5,
        riskLevel: 'MEDIUM',
        acceptanceCriteria: [
          'Journal entry creation pipeline traced end-to-end',
          'At least 1 TradeJournalEntry generated for a recent closed trade (or confirmed blocked by upstream failure)',
          'Journal entry fields verified: decisionReasoning, executionDetail, lifecycle all non-empty',
          'Write pipeline audit to docs/reports/journal_pipeline_audit.md',
        ],
        forbiddenActions: [
          'Do not insert fake journal entries with placeholder text',
          'Do not modify existing journal records',
        ],
        suggestedFiles: ['src/lib/lifecycle/', 'src/lib/learning/', 'scripts/'],
      }));
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Code Quality ──────────────────────────────────────────────────────

async function mineCodeQuality(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];

  // B1: Large TypeScript files (> 500 lines)
  try {
    const largeFiles = await findLargeFiles(path.resolve(WORKSPACE_ROOT, 'src/lib'), '.ts', 500, 30);
    if (largeFiles.length >= 2) {
      candidates.push(makeCandidate({
        taskId: 'code_quality__large_files',
        sourceType: 'code_quality',
        title: 'Decompose large TypeScript modules to reduce cognitive load',
        problem: `${largeFiles.length} TypeScript files in src/lib/ exceed 500 lines. Large files increase maintenance burden, reduce testability, and obscure coupling.`,
        evidence: largeFiles.slice(0, 6).map((f) => `${f.rel} (${f.lines} lines)`),
        impact: 'Large files slow down agent comprehension, increase bug density, and make incremental fixes risky.',
        estimatedDurationHours: 6,
        acceptanceCriteria: [
          'Each identified file decomposed into focused sub-modules (< 400 lines each)',
          'All imports updated and TypeScript compiles with zero errors after decomposition',
          'Test coverage maintained or improved',
          'New file boundaries documented with a header comment explaining the split rationale',
        ],
        forbiddenActions: [
          'Do not change public API signatures',
          'Do not remove existing test coverage',
          'Do not refactor files not in the identified list',
        ],
        suggestedFiles: largeFiles.slice(0, 6).map((f) => f.rel),
      }));
    }
  } catch { /* non-blocking */ }

  // B2: TODO/FIXME density
  try {
    const todoCount = await countTodoComments(path.resolve(WORKSPACE_ROOT, 'src'));
    if (todoCount >= 10) {
      candidates.push(makeCandidate({
        taskId: 'code_quality__todo_debt',
        sourceType: 'code_quality',
        title: 'Triage and resolve accumulated TODO/FIXME technical debt',
        problem: `Found ${todoCount} TODO/FIXME comments in src/. Each unresolved comment is deferred intent that may become a latent bug.`,
        evidence: [`${todoCount} TODO/FIXME comments across src/`],
        impact: 'Unresolved TODOs accumulate into silent technical debt. Triaging reveals hidden risks and quick wins.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Every TODO/FIXME categorized as: resolved, converted to backlog item, or documented as intentional',
          'At least 50% of identified TODOs either fixed or converted to tracked issues',
          'Remaining TODOs annotated with owner and tracking reference',
          'Write triage report to docs/reports/todo_triage.md',
        ],
        forbiddenActions: ['Do not delete TODO comments without addressing the underlying issue'],
        suggestedFiles: ['src/'],
      }));
    }
  } catch { /* non-blocking */ }

  // B4: Duplicated module detection — multiple files with highly similar names suggesting copy-paste
  try {
    const srcDir = path.resolve(WORKSPACE_ROOT, 'src/lib');
    const allTs = await listTypescriptFiles(srcDir, 4);
    // Group by base name without numeric suffix — e.g., signalClassifier vs signalClassifierV2
    const baseNames: Record<string, string[]> = {};
    for (const f of allTs) {
      const base = path.basename(f).replace(/\.tsx?$/, '').replace(/[Vv]?\d+$/, '').toLowerCase();
      if (!baseNames[base]) baseNames[base] = [];
      baseNames[base]!.push(f.replace(WORKSPACE_ROOT + '/', ''));
    }
    const duplicated = Object.entries(baseNames).filter(([, files]) => files.length >= 2);
    if (duplicated.length >= 3) {
      const evidence = duplicated.slice(0, 6).map(([base, files]) => `"${base}": ${files.join(', ')}`);
      candidates.push(makeCandidate({
        taskId: 'code_quality__duplicate_modules',
        sourceType: 'code_quality',
        title: 'Audit and consolidate duplicated module versions in src/lib',
        problem: `${duplicated.length} module name groups have multiple versions or apparent duplicates in src/lib. This suggests copy-paste versioning instead of proper abstraction.`,
        evidence,
        impact: 'Duplicated modules split maintenance burden — bug fixes must be applied to multiple files. Agents may use the wrong version.',
        estimatedDurationHours: 6,
        acceptanceCriteria: [
          'Each duplicated group analyzed: one version designated canonical, others deprecated or merged',
          'All call sites updated to use the canonical version',
          'Deprecated versions moved to archive/ or deleted after operator confirmation',
          'TypeScript compiles with zero errors after consolidation',
        ],
        forbiddenActions: [
          'Do not delete files without first verifying zero import references remain',
          'Do not change public API signatures during consolidation',
        ],
        suggestedFiles: duplicated.slice(0, 6).flatMap(([, files]) => files),
      }));
    }
  } catch { /* non-blocking */ }

  // B3: Root-level Python scripts (likely legacy)
  try {
    const pyFiles = await listRootPythonScripts();
    if (pyFiles.length >= 3) {
      candidates.push(makeCandidate({
        taskId: 'code_quality__legacy_python_scripts',
        sourceType: 'code_quality',
        title: 'Audit and archive legacy root-level Python scripts',
        problem: `${pyFiles.length} Python scripts at workspace root (${pyFiles.slice(0, 5).join(', ')}). These appear to be legacy research scripts not integrated into the main pipeline.`,
        evidence: pyFiles.slice(0, 8),
        impact: 'Legacy scripts confuse the agent about what is active vs. dead code, and add maintenance surface without benefit.',
        estimatedDurationHours: 4,
        acceptanceCriteria: [
          'Each Python script classified as: active (document usage), archiveable, or delete-candidate',
          'Archiveable scripts moved to archive/ with an INVENTORY.md entry',
          'Delete-candidates listed in report for operator approval',
          'Write classification report to docs/reports/python_script_audit.md',
        ],
        forbiddenActions: [
          'Do not delete any Python script without explicit approval in report',
          'Do not modify scripts still referenced by cron or launchd',
        ],
        suggestedFiles: pyFiles,
      }));
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: UI/UX ────────────────────────────────────────────────────────────

async function mineUiUx(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];

  // C1: Pages missing loading.tsx or error.tsx
  try {
    const appDir = path.resolve(WORKSPACE_ROOT, 'src/app');
    const pageFiles = await findPageFiles(appDir, 20);
    const missingLoading: string[] = [];
    for (const pageFile of pageFiles) {
      const dir = path.dirname(pageFile);
      const [hasLoading, hasError] = await Promise.all([
        fileExists(path.join(dir, 'loading.tsx')),
        fileExists(path.join(dir, 'error.tsx')),
      ]);
      if (!hasLoading || !hasError) {
        missingLoading.push(dir.replace(WORKSPACE_ROOT + '/', ''));
      }
    }
    if (missingLoading.length >= 3) {
      candidates.push(makeCandidate({
        taskId: 'ui_ux__missing_loading_error_states',
        sourceType: 'ui_ux',
        title: 'Add loading.tsx and error.tsx to pages missing async feedback',
        problem: `${missingLoading.length} page directories lack loading.tsx or error.tsx. Operators see blank screens or crashes during slow fetches or API errors.`,
        evidence: missingLoading.slice(0, 6).map((d) => `Missing loading/error in ${d}`),
        impact: 'Operator usability degrades when pages load silently or crash without explanation during market data fetches.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'loading.tsx added to all identified page directories',
          'error.tsx added to all identified page directories',
          'Each loading state shows a meaningful skeleton or spinner (not a blank screen)',
          'Each error state shows the error message and a retry action',
          'TypeScript compiles with zero errors',
        ],
        forbiddenActions: [
          'Do not modify page business logic',
          'Do not change routing structure',
        ],
        suggestedFiles: missingLoading.slice(0, 6),
      }));
    }
  } catch { /* non-blocking */ }

  // C3: Pages with no actionable output — dashboard pages with no interactive controls
  try {
    const appDir = path.resolve(WORKSPACE_ROOT, 'src/app');
    const pageFiles2 = await findPageFiles(appDir, 30);
    const poorPurposePages: string[] = [];
    for (const pageFile of pageFiles2) {
      try {
        const content = await fs.readFile(pageFile, 'utf8');
        const rel = pageFile.replace(WORKSPACE_ROOT + '/', '');
        // Heuristic: page > 50 lines but has no button/form/action-style interactive element
        const lineCount = content.split('\n').length;
        const hasInteractive = /button|form|onClick|onSubmit|<Button|<Form|<Link|href=/i.test(content);
        if (lineCount > 50 && !hasInteractive) poorPurposePages.push(rel);
      } catch { /* skip */ }
    }
    if (poorPurposePages.length >= 2) {
      candidates.push(makeCandidate({
        taskId: 'ui_ux__no_actionable_output',
        sourceType: 'ui_ux',
        title: 'Add actionable controls to read-only pages missing operator interactions',
        problem: `${poorPurposePages.length} pages appear to display data without any interactive controls (no buttons, links, or forms). Operators cannot act on what they see.`,
        evidence: poorPurposePages.slice(0, 5).map((p) => `${p} — no interactive elements detected`),
        impact: 'Operator pages with no actions are dead ends. The system should surface at least one useful action (refresh, export, drill-down) per view.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Each identified page reviewed for intended audience and purpose',
          'At least one actionable control added per page (refresh, export CSV, view detail, or clear filter)',
          'New controls documented in USER_GUIDE.md',
          'TypeScript compiles with zero errors',
        ],
        forbiddenActions: [
          'Do not add controls that trigger irreversible actions without confirmation',
          'Do not remove read-only data display',
        ],
        suggestedFiles: poorPurposePages.slice(0, 5),
      }));
    }
  } catch { /* non-blocking */ }

  // C2: Orchestrator page complexity
  try {
    const orchestratorPage = path.resolve(WORKSPACE_ROOT, 'src/app/orchestrator/page.tsx');
    if (await fileExists(orchestratorPage)) {
      const content = await fs.readFile(orchestratorPage, 'utf8');
      const lineCount = content.split('\n').length;
      if (lineCount > 300) {
        candidates.push(makeCandidate({
          taskId: 'ui_ux__orchestrator_page_complexity',
          sourceType: 'ui_ux',
          title: 'Decompose orchestrator page into focused operator-facing components',
          problem: `src/app/orchestrator/page.tsx is ${lineCount} lines. It mixes data fetching, task display, control actions, and status — making it hard to reason about state.`,
          evidence: [
            `orchestrator/page.tsx: ${lineCount} lines`,
            'Multiple responsibilities in a single component',
          ],
          impact: 'Operators cannot quickly understand system state. A large monolithic component makes targeted fixes risky.',
          estimatedDurationHours: 6,
          acceptanceCriteria: [
            'Page decomposed into focused components (TaskList, ControlPanel, StatusBar)',
            'Each component < 150 lines',
            'Operator-facing status summary visible without scrolling',
            'TypeScript compiles and all existing behavior is preserved',
          ],
          forbiddenActions: [
            'Do not change API calls or routing',
            'Do not remove existing operator controls',
          ],
          suggestedFiles: ['src/app/orchestrator/page.tsx', 'src/components/orchestrator/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Wiki/Docs ────────────────────────────────────────────────────────

async function mineWikiDocs(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];

  // D1: Stale markdown files (> 30 days unchanged)
  try {
    const [wikiFiles, docsFiles] = await Promise.all([
      listMarkdownFiles(path.resolve(WORKSPACE_ROOT, 'wiki'), 30).catch(() => [] as string[]),
      listMarkdownFiles(path.resolve(WORKSPACE_ROOT, 'docs'), 30).catch(() => [] as string[]),
    ]);
    const staleFiles: string[] = [];
    for (const f of [...wikiFiles, ...docsFiles]) {
      try {
        const stat = await fs.stat(f);
        const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays > 30) staleFiles.push(f.replace(WORKSPACE_ROOT + '/', ''));
      } catch { /* skip */ }
    }
    if (staleFiles.length >= 5) {
      candidates.push(makeCandidate({
        taskId: 'wiki_docs__stale_markdown',
        sourceType: 'wiki_docs',
        title: 'Audit and refresh stale docs/wiki markdown files',
        problem: `${staleFiles.length} markdown files in docs/ or wiki/ have not been updated in > 30 days. They may reference outdated APIs, file paths, or procedures.`,
        evidence: staleFiles.slice(0, 6),
        impact: 'Stale docs mislead operators and agents. The agent-orchestrator reads docs as context — drift causes incorrect assumptions.',
        estimatedDurationHours: 6,
        acceptanceCriteria: [
          'Each stale file reviewed and updated or marked as archived',
          'File paths and API references verified against current codebase',
          'CHANGELOG.md updated with a doc-refresh entry',
          'No dead links remaining in docs/ or wiki/',
        ],
        forbiddenActions: ['Do not delete documents without archiving to archive/'],
        suggestedFiles: staleFiles.slice(0, 8),
      }));
    }
  } catch { /* non-blocking */ }

  // D2: USER_GUIDE.md drift
  try {
    const userGuide = path.resolve(WORKSPACE_ROOT, 'USER_GUIDE.md');
    if (await fileExists(userGuide)) {
      const stat = await fs.stat(userGuide);
      const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageDays > 14) {
        candidates.push(makeCandidate({
          taskId: 'wiki_docs__user_guide_drift',
          sourceType: 'wiki_docs',
          title: 'Update USER_GUIDE.md to reflect current orchestrator and scheduler features',
          problem: `USER_GUIDE.md was last modified ${Math.round(ageDays)} days ago. Recent orchestrator, CTO review, and daemon autostart changes are undocumented.`,
          evidence: [
            `USER_GUIDE.md mtime: ${new Date(stat.mtimeMs).toISOString()}`,
            `Age: ${Math.round(ageDays)} days since last update`,
          ],
          impact: 'Operators follow an outdated guide. New autonomous features go unused because they are not documented.',
          estimatedDurationHours: 4,
          acceptanceCriteria: [
            'USER_GUIDE.md updated with orchestrator dual-view (main + CTO)',
            'Daemon autostart procedure documented (launchd)',
            'Rate-limit recovery procedure documented',
            'Structured backlog_research.json workflow explained with example',
          ],
          forbiddenActions: ['Do not remove existing operator procedures'],
          suggestedFiles: ['USER_GUIDE.md', 'docs/autonomous-scheduler.md', 'deploy/launchd-orchestrator/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Test Coverage ─────────────────────────────────────────────────────

async function mineTestCoverage(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];

  // E1: Untested orchestrator modules
  try {
    const orchestratorDir = path.resolve(WORKSPACE_ROOT, 'src/lib/agent-orchestrator');
    const testsDir = path.resolve(orchestratorDir, '__tests__');
    const [sourceFiles, testFiles] = await Promise.all([
      listTypescriptFiles(orchestratorDir, 1),
      listTypescriptFiles(testsDir, 1).catch(() => [] as string[]),
    ]);
    const testedBases = new Set(testFiles.map((f) => path.basename(f).replace(/\.test\.ts$/, '')));
    const untestedFiles = sourceFiles
      .map((f) => path.basename(f).replace(/\.ts$/, ''))
      .filter((base) => !base.startsWith('index') && !testedBases.has(base));

    if (untestedFiles.length >= 3) {
      candidates.push(makeCandidate({
        taskId: 'test_coverage__orchestrator_gaps',
        sourceType: 'test_coverage',
        title: 'Expand unit test coverage for untested orchestrator modules',
        problem: `${untestedFiles.length} orchestrator modules have no test file: ${untestedFiles.slice(0, 5).join(', ')}. Critical planner/worker/gate logic runs without regression protection.`,
        evidence: untestedFiles.slice(0, 8).map((f) => `src/lib/agent-orchestrator/${f}.ts — no test file`),
        impact: 'A silent regression in planner tick, rate-limit cooldown, or backlog selection would only be caught in production.',
        estimatedDurationHours: 7,
        acceptanceCriteria: [
          `Test files created for: ${untestedFiles.slice(0, 4).join(', ')}`,
          'Each test covers: happy path, error path, and at least one edge case',
          'All tests pass: jest --testPathPattern=agent-orchestrator',
          'Coverage report shows improvement in orchestrator module line coverage',
        ],
        forbiddenActions: [
          'Do not add tests that require a live DB or network connection',
          'Use mocks for prisma and filesystem calls',
        ],
        suggestedFiles: untestedFiles.slice(0, 6).map((f) => `src/lib/agent-orchestrator/${f}.ts`),
      }));
    }
  } catch { /* non-blocking */ }

  // E2: Missing E2E tests for critical flows
  try {
    const e2eDir = path.resolve(WORKSPACE_ROOT, 'e2e');
    const e2eFiles = await listTypescriptFiles(e2eDir, 1).catch(() => [] as string[]);
    const criticalFlows = ['scheduler', 'lifecycle', 'learning', 'signal', 'sync'];
    const missingFlows = criticalFlows.filter(
      (flow) => !e2eFiles.some((f) => f.toLowerCase().includes(flow)),
    );
    if (missingFlows.length >= 3) {
      candidates.push(makeCandidate({
        taskId: 'test_coverage__missing_e2e_flows',
        sourceType: 'test_coverage',
        title: 'Add integration tests for critical scheduler and lifecycle flows',
        problem: `E2E tests missing for critical flows: ${missingFlows.join(', ')}. These paths have no automated regression protection.`,
        evidence: [
          `e2e/ contains: ${e2eFiles.map((f) => path.basename(f)).join(', ') || '(minimal)'}`,
          `Missing coverage for: ${missingFlows.join(', ')}`,
        ],
        impact: 'A regression in scheduler or lifecycle would only be caught manually. Integration tests enable safe continuous deployment.',
        estimatedDurationHours: 7,
        acceptanceCriteria: [
          `Integration tests written for: ${missingFlows.slice(0, 3).join(', ')}`,
          'Tests use a test DB or mocks — no production data dependency',
          'All new tests pass in CI',
          'Tests documented in README with run instructions',
        ],
        forbiddenActions: [
          'Do not make tests depend on live market data',
          'Do not require a running broker or live trading session',
        ],
        suggestedFiles: ['e2e/', 'tests/', 'jest.config.js'],
      }));
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Source: Price Analysis Quality ───────────────────────────────────────────
// Mines DB and code for issues that degrade TW stock price-analysis accuracy.
// Covers: data quality, indicator accuracy, trigger scoring, entry/exit quality,
// and sector/market context alignment.
// FORBIDDEN: no threshold changes, no position sizing edits.

async function minePriceAnalysisQuality(): Promise<OptimizationTaskCandidate[]> {
  const candidates: OptimizationTaskCandidate[] = [];
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const PRICE_FORBIDDEN = [
    'Do not change live trading thresholds',
    'Do not modify position sizing or risk floor',
    'Do not auto-tune strategy parameters',
    'Do not modify alphaScore or triggerScore weighting without evidence',
    'Do not bypass learning gates',
    'Diagnostics and reports only — no automated strategy changes',
  ];

  // ── P1: Price Data Quality ────────────────────────────────────────────────
  // Detect: stale quotes, zero-volume rows, OHLC anomalies
  try {
    const [latestQuote, activeSymbols, zeroVolumeCount, ohlcAnomalyCount] = await Promise.all([
      prisma.stockQuote.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, stockId: true } }),
      prisma.simulatedTrade.groupBy({ by: ['symbol'], where: { status: { in: ['open', 'pending'] } } }),
      prisma.stockQuote.count({ where: { volume: { lte: 0 } } }),
      // OHLC integrity: close < low or close > high
      prisma.stockQuote.count({ where: { OR: [{ close: { lt: prisma.stockQuote.fields.low } }, { close: { gt: prisma.stockQuote.fields.high } }] } }).catch(() => 0),
    ]);
    const quoteStale = !latestQuote || latestQuote.createdAt < twoDaysAgo;
    const hasZeroVolume = zeroVolumeCount > 0;
    const hasActiveSymbols = activeSymbols.length > 0;

    if (quoteStale || hasZeroVolume || hasActiveSymbols) {
      const evidence: string[] = [];
      if (quoteStale) evidence.push(`Latest quote: ${latestQuote?.createdAt.toISOString() ?? 'NONE'} (stale > 48h)`);
      if (hasZeroVolume) evidence.push(`${zeroVolumeCount} StockQuote rows with volume ≤ 0`);
      if (hasActiveSymbols) evidence.push(`${activeSymbols.length} active simulated-trade symbols need fresh price data`);
      if (ohlcAnomalyCount) evidence.push(`${ohlcAnomalyCount} rows where close is outside [low, high]`);

      candidates.push(makeCandidate({
        taskId: 'price_analysis_quality__data_audit',
        sourceType: 'price_analysis_quality',
        title: 'Audit price data quality for active simulated trades and current candidates',
        problem: `Price data quality issues detected: ${evidence.join('; ')}.`,
        evidence,
        impact: 'Stale or corrupted price data silently degrades all indicator calculations, trigger scoring, and strategy learning.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Produce JSON report of latest quote date per active symbol (docs/reports/price_data_quality.json)',
          'Report count of missing trading days per symbol for last 30 days',
          'Report all zero-volume and OHLC-anomaly rows with symbol/date',
          'Verify pipeline sync covers all open-trade symbols within 48h',
          'Add DB query assertions for OHLC integrity to data sync pipeline tests',
        ],
        forbiddenActions: PRICE_FORBIDDEN,
        suggestedFiles: ['scripts/', 'src/lib/sync/', 'prisma/schema.prisma', 'docs/reports/'],
      }));
    }
  } catch { /* non-blocking */ }

  // ── P2: Trigger Score Distribution ───────────────────────────────────────
  // Detect: tight clustering, no variance, imbalance in setupType
  try {
    const recentTrades = await prisma.simulatedTrade.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, triggerScore: { not: null } },
      select: { triggerScore: true, setupType: true, symbol: true },
      take: 200,
    });
    if (recentTrades.length >= 10) {
      const scores = recentTrades.map((t) => t.triggerScore as number);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const scoreRange = maxScore - minScore;

      const setupCounts: Record<string, number> = {};
      for (const t of recentTrades) {
        setupCounts[t.setupType] = (setupCounts[t.setupType] ?? 0) + 1;
      }
      const dominantSetup = Object.entries(setupCounts).sort((a, b) => b[1] - a[1])[0];
      const dominantPct = dominantSetup ? dominantSetup[1] / recentTrades.length : 0;

      const isClustered = scoreRange < 0.20;
      const isImbalanced = dominantPct > 0.85;

      if (isClustered || isImbalanced) {
        const evidence: string[] = [
          `Score range (7d): ${minScore.toFixed(3)} – ${maxScore.toFixed(3)} (range = ${scoreRange.toFixed(3)})`,
          `Sample size: ${recentTrades.length} trades`,
        ];
        if (isClustered) evidence.push(`Score range < 0.20 — insufficient discrimination between candidates`);
        if (isImbalanced) evidence.push(`${dominantSetup![0]} dominates ${(dominantPct * 100).toFixed(0)}% of setups — imbalance`);

        candidates.push(makeCandidate({
          taskId: 'price_analysis_quality__trigger_score_distribution',
          sourceType: 'price_analysis_quality',
          title: 'Build triggerScore distribution and forward-return validation report',
          problem: `TriggerScore may not discriminate effectively: ${evidence.join('; ')}.`,
          evidence,
          impact: 'A poorly calibrated trigger score causes the system to enter low-quality trades and miss high-quality ones, degrading all learning signal.',
          estimatedDurationHours: 7,
          acceptanceCriteria: [
            'Group all proposals by triggerScore bucket (0.1 intervals) and compute count per bucket',
            'Compute 3/5/10-day forward return for closed trades by score bucket (where available)',
            'Report Spearman correlation between triggerScore and 5-day forward return',
            'Report setupType distribution across score buckets',
            'Produce score histogram JSON to docs/reports/trigger_score_audit.json',
            'Document findings in wiki/v1/price-analysis-quality.md',
            'No threshold changes — diagnostics only',
          ],
          forbiddenActions: PRICE_FORBIDDEN,
          suggestedFiles: ['src/lib/scoring/', 'src/lib/agent-orchestrator/', 'docs/reports/', 'wiki/v1/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  // ── P3: Exit / Risk Quality (MFE/MAE + time-exit dominance) ──────────────
  try {
    const closedTrades = await prisma.simulatedTrade.findMany({
      where: { status: 'closed', exitReason: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { exitReason: true, mfePct: true, maePct: true, pnlPct: true, holdingDays: true },
      take: 200,
    });
    if (closedTrades.length >= 5) {
      const timeExitCount = closedTrades.filter((t) => t.exitReason?.toLowerCase().includes('time')).length;
      const timeExitPct = timeExitCount / closedTrades.length;

      const tradesWithMfe = closedTrades.filter((t) => t.mfePct != null && t.maePct != null);
      const avgMfe = tradesWithMfe.length > 0 ? tradesWithMfe.reduce((s, t) => s + (t.mfePct ?? 0), 0) / tradesWithMfe.length : null;
      const avgMae = tradesWithMfe.length > 0 ? tradesWithMfe.reduce((s, t) => s + (t.maePct ?? 0), 0) / tradesWithMfe.length : null;

      const isTimeExitDominant = timeExitPct > 0.4;
      const hasMfeData = tradesWithMfe.length >= 3;

      if (isTimeExitDominant || hasMfeData) {
        const evidence: string[] = [];
        if (isTimeExitDominant) evidence.push(`Time-exit accounts for ${(timeExitPct * 100).toFixed(0)}% of all exits (threshold: 40%)`);
        if (hasMfeData && avgMfe !== null) evidence.push(`Avg MFE: ${avgMfe.toFixed(2)}%, Avg MAE: ${avgMae?.toFixed(2)}% across ${tradesWithMfe.length} trades`);
        evidence.push(`Sample: ${closedTrades.length} closed trades (last 30d)`);

        candidates.push(makeCandidate({
          taskId: 'price_analysis_quality__mfe_mae_audit',
          sourceType: 'price_analysis_quality',
          title: 'Audit MFE/MAE and stop/target suitability for TW stock volatility',
          problem: `Exit quality issues: ${evidence.join('; ')}.`,
          evidence,
          impact: 'If stops/targets are misaligned with actual volatility, profitable moves are frequently cut short or losses allowed to extend.',
          estimatedDurationHours: 7,
          acceptanceCriteria: [
            'Compute MFE/MAE distribution (percentiles: p25, p50, p75, p90) for last 30d closed trades',
            'Report time-exit, stop-hit, and target-hit breakdown as percentages',
            'Compare fixed stop/target distances vs ATR-proxy (high-low range / close) per symbol',
            'Identify trades where MFE > 2× stop distance but trade still exited at loss or time',
            'Produce analysis JSON to docs/reports/mfe_mae_audit.json',
            'Recommend diagnostics only — no threshold changes',
          ],
          forbiddenActions: PRICE_FORBIDDEN,
          suggestedFiles: ['src/lib/trading/', 'src/lib/learning/', 'prisma/schema.prisma', 'docs/reports/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  // ── P4: Setup Classification Validation (trend/rebound vs raw structure) ──
  try {
    const recentClosedBySetup = await prisma.simulatedTrade.groupBy({
      by: ['setupType'],
      where: { status: 'closed', createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });
    const totalClosed = recentClosedBySetup.reduce((s, r) => s + r._count.id, 0);
    const onlyOneSetup = recentClosedBySetup.length === 1 && totalClosed >= 5;
    const [openTrades] = await Promise.all([
      prisma.simulatedTrade.count({ where: { status: { in: ['open', 'pending'] } } }),
    ]);

    if (onlyOneSetup || openTrades >= 10) {
      const evidence: string[] = [];
      if (onlyOneSetup) evidence.push(`Only 1 setup type in last 30d closed trades: ${recentClosedBySetup[0]?.setupType ?? 'unknown'} (${totalClosed} trades)`);
      if (openTrades >= 10) evidence.push(`${openTrades} currently open/pending trades — setup classification should be validated`);

      candidates.push(makeCandidate({
        taskId: 'price_analysis_quality__setup_classification_audit',
        sourceType: 'price_analysis_quality',
        title: 'Validate trend/rebound setup classification against raw price structure',
        problem: `Setup classification may not reflect actual price behavior: ${evidence.join('; ')}.`,
        evidence,
        impact: 'Misclassified setups cause the learning layer to draw incorrect conclusions about what drives profits vs losses.',
        estimatedDurationHours: 7,
        acceptanceCriteria: [
          'Sample 20 recent trend and 20 recent rebound closed trades',
          'For each: compute MA5/MA20 alignment, 5-day return before entry, volume confirmation ratio',
          'Report trades where MA structure contradicts the assigned setupType',
          'Add confusion-matrix table (setupType vs MA-regime) to docs/reports/setup_audit.json',
          'Document findings in wiki/v1/price-analysis-quality.md',
          'No automatic reclassification of existing trades',
        ],
        forbiddenActions: PRICE_FORBIDDEN,
        suggestedFiles: ['src/lib/scoring/', 'src/lib/learning/', 'docs/reports/', 'wiki/v1/'],
      }));
    }
  } catch { /* non-blocking */ }

  // ── P5: Sector / Market Context Alignment ────────────────────────────────
  try {
    const [latestMarketIndex, proposalCount] = await Promise.all([
      prisma.marketIndex.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, name: true, changePercent: true } }),
      prisma.strategyProposal.count({ where: { createdAt: { gte: sevenDaysAgo }, state: 'approved' } }),
    ]);
    const marketIndexStale = !latestMarketIndex || latestMarketIndex.createdAt < twoDaysAgo;

    if (marketIndexStale || proposalCount >= 5) {
      const evidence: string[] = [];
      if (marketIndexStale) evidence.push(`Latest MarketIndex: ${latestMarketIndex?.createdAt.toISOString() ?? 'NONE'} — cannot validate sector alignment`);
      if (proposalCount >= 5) evidence.push(`${proposalCount} approved proposals in last 7d — sector concentration not validated`);

      candidates.push(makeCandidate({
        taskId: 'price_analysis_quality__sector_context_audit',
        sourceType: 'price_analysis_quality',
        title: 'Audit sector and market context alignment for active proposals',
        problem: `Proposals may be generated without sufficient market/sector confirmation: ${evidence.join('; ')}.`,
        evidence,
        impact: 'Bullish proposals during weak sector or broad market downtrend increase false-positive rate and degrade learning signal.',
        estimatedDurationHours: 5,
        acceptanceCriteria: [
          'Report TAIEX direction (5d return) for each approved proposal date',
          'Report sector distribution of active open trades (semiconductor / finance / etc.)',
          'Identify proposals where stock setup contradicts broad market direction',
          'Produce sector alignment summary in docs/reports/sector_alignment.json',
          'Document findings in wiki/v1/price-analysis-quality.md',
          'No automatic proposal rejection — report only',
        ],
        forbiddenActions: PRICE_FORBIDDEN,
        suggestedFiles: ['src/lib/scoring/', 'prisma/schema.prisma', 'docs/reports/', 'wiki/v1/'],
      }));
    }
  } catch { /* non-blocking */ }

  // ── P6: Technical Indicator Insufficient History ──────────────────────────
  try {
    const recentProposals = await prisma.strategyProposal.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { symbol: true, setupType: true },
      distinct: ['symbol'],
      take: 50,
    });
    if (recentProposals.length >= 3) {
      // Check how many symbols have fewer than 250 days of quote history
      const symbolCounts = await Promise.all(
        recentProposals.slice(0, 20).map((p) =>
          prisma.stockQuote.count({ where: { stockId: p.symbol } }).then((c) => ({ symbol: p.symbol, count: c })),
        ),
      );
      const thinHistory = symbolCounts.filter((s) => s.count < 250);

      if (thinHistory.length >= 2) {
        const evidence = [
          `${thinHistory.length} recently-proposed symbols have < 250 days of quote history`,
          `Examples: ${thinHistory.slice(0, 3).map((s) => `${s.symbol} (${s.count}d)`).join(', ')}`,
          'MA60 requires 60 bars; RSI requires 14+; full-signal requires 250+ for reliable statistics',
        ];
        candidates.push(makeCandidate({
          taskId: 'price_analysis_quality__indicator_history_check',
          sourceType: 'price_analysis_quality',
          title: 'Validate technical indicator minimum-bar requirements for scored symbols',
          problem: `${thinHistory.length} symbols scored with insufficient quote history for reliable MA/RSI/volatility computation.`,
          evidence,
          impact: 'Indicators computed on < 60 bars produce unreliable MA60; < 14 bars produce invalid RSI. Scores from these symbols pollute the learning set.',
          estimatedDurationHours: 5,
          acceptanceCriteria: [
            'Produce per-symbol report: symbol, quote_count, MA5_ready, MA20_ready, MA60_ready, RSI14_ready',
            'Flag symbols with < 60 bars as MA60_not_ready; < 14 bars as RSI_not_ready',
            'Add readiness labels to candidate scoring pipeline output (not to DB — report only)',
            'Write indicator readiness report to docs/reports/indicator_readiness.json',
            'Add unit test: scoring function rejects symbol with < 60 bars for MA60',
          ],
          forbiddenActions: PRICE_FORBIDDEN,
          suggestedFiles: ['src/lib/scoring/', 'src/lib/indicators/', 'docs/reports/'],
        }));
      }
    }
  } catch { /* non-blocking */ }

  return candidates;
}

// ─── Candidate Builder Helper ──────────────────────────────────────────────────

interface MakeCandidateInput {
  taskId: string;
  sourceType: OptimizationSourceType;
  title: string;
  problem: string;
  evidence: string[];
  impact: string;
  estimatedDurationHours: number;
  acceptanceCriteria: string[];
  forbiddenActions: string[];
  suggestedFiles: string[];
  riskLevel?: OptimizationRiskLevel;
  prerequisites?: string[];
  publishStatus?: OptimizationPublishStatus;
  /** Defaults to taskId when omitted — taskId is designed to be a stable dedupe key */
  dedupeKey?: string;
}

function makeCandidate(input: MakeCandidateInput): OptimizationTaskCandidate {
  return {
    riskLevel: 'LOW',
    prerequisites: [],
    priorityScore: 0,
    canRunUnattended: true,
    recommendedRunWindowHours: input.estimatedDurationHours,
    publishStatus: 'READY',
    dedupeKey: input.taskId,
    ...input,
  };
}

// ─── Filesystem Helpers ────────────────────────────────────────────────────────

interface FileInfo {
  rel: string;
  abs: string;
  lines: number;
}

async function findLargeFiles(dir: string, ext: string, minLines: number, maxFiles: number): Promise<FileInfo[]> {
  const result: FileInfo[] = [];
  await walkDir(dir, async (abs) => {
    if (!abs.endsWith(ext) || result.length >= maxFiles) return;
    try {
      const content = await fs.readFile(abs, 'utf8');
      const lines = content.split('\n').length;
      if (lines >= minLines) result.push({ rel: abs.replace(WORKSPACE_ROOT + '/', ''), abs, lines });
    } catch { /* skip */ }
  }, 3);
  return result.sort((a, b) => b.lines - a.lines);
}

async function countTodoComments(dir: string): Promise<number> {
  let count = 0;
  await walkDir(dir, async (abs) => {
    if (!abs.endsWith('.ts') && !abs.endsWith('.tsx')) return;
    try {
      const content = await fs.readFile(abs, 'utf8');
      count += (content.match(/\/\/\s*(TODO|FIXME)/gi) ?? []).length;
    } catch { /* skip */ }
  }, 4);
  return count;
}

async function listRootPythonScripts(): Promise<string[]> {
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.py')).map((e) => e.name);
}

async function findPageFiles(dir: string, maxPages: number): Promise<string[]> {
  const pages: string[] = [];
  await walkDir(dir, async (abs) => {
    if (abs.endsWith('/page.tsx') || abs.endsWith('/page.ts')) pages.push(abs);
  }, 4);
  return pages.slice(0, maxPages);
}

async function listMarkdownFiles(dir: string, max: number): Promise<string[]> {
  const files: string[] = [];
  await walkDir(dir, async (abs) => { if (abs.endsWith('.md')) files.push(abs); }, 3);
  return files.slice(0, max);
}

async function listTypescriptFiles(dir: string, maxDepth: number): Promise<string[]> {
  const files: string[] = [];
  await walkDir(dir, async (abs) => {
    if (abs.endsWith('.ts') || abs.endsWith('.tsx')) files.push(abs);
  }, maxDepth);
  return files;
}

async function walkDir(
  dir: string,
  visitor: (abs: string) => Promise<void>,
  maxDepth: number,
  depth = 0,
): Promise<void> {
  if (depth > maxDepth) return;
  let entries: import('fs').Dirent[];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }
  await Promise.all(
    entries.map(async (entry) => {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walkDir(abs, visitor, maxDepth, depth + 1);
      } else if (entry.isFile()) {
        await visitor(abs);
      }
    }),
  );
}

// ─── Scoring + Dedup + Quota ───────────────────────────────────────────────────

export function applyPriorityScores(candidates: OptimizationTaskCandidate[]): OptimizationTaskCandidate[] {
  return candidates.map((c) => {
    const base = SOURCE_BASE_SCORE[c.sourceType];
    return {
      ...c,
      priorityScore: computePriorityScore({
        ...base,
        riskLevel: c.riskLevel,
        prerequisiteCount: c.prerequisites.length,
      }),
    };
  });
}

export function deduplicateAgainstState(
  candidates: OptimizationTaskCandidate[],
  state: MinerState,
  recentTasks: TaskRecord[],
): OptimizationTaskCandidate[] {
  // Prune expired dedupe keys in-place
  for (const key of Object.keys(state.publishedDedupeKeys)) {
    if (isDedupeExpired(state.publishedDedupeKeys[key]!)) {
      delete state.publishedDedupeKeys[key];
    }
  }
  const inFlightKeys = new Set(
    recentTasks
      .filter((t) => ['QUEUED', 'RUNNING'].includes(t.status))
      .map((t) => t.plannerContext?.dedupeKey)
      .filter(Boolean) as string[],
  );
  return candidates.filter(
    (c) => !state.publishedDedupeKeys[c.dedupeKey] && !inFlightKeys.has(c.dedupeKey),
  );
}

export function validateCandidate(c: OptimizationTaskCandidate): boolean {
  if (c.estimatedDurationHours < MIN_DURATION_H || c.estimatedDurationHours > MAX_DURATION_H) return false;
  if (c.acceptanceCriteria.length === 0) return false;
  if (c.publishStatus === 'UNSAFE') return false;
  if (!c.canRunUnattended) return false;
  return true;
}

export function enforceQuota(
  candidates: OptimizationTaskCandidate[],
  quota: MinerDailyQuota,
): OptimizationTaskCandidate[] {
  let highCount = quota.highRisk;
  let medCount = quota.mediumRisk;
  let lowCount = quota.lowRisk;
  const allowed: OptimizationTaskCandidate[] = [];
  for (const c of candidates) {
    if (c.riskLevel === 'HIGH' && highCount < QUOTA.HIGH) { allowed.push(c); highCount++; }
    else if (c.riskLevel === 'MEDIUM' && medCount < QUOTA.MEDIUM) { allowed.push(c); medCount++; }
    else if (c.riskLevel === 'LOW' && lowCount < QUOTA.LOW) { allowed.push(c); lowCount++; }
  }
  return allowed;
}

// ─── Candidate → PlannerDraft ─────────────────────────────────────────────────

export function candidateToDraft(candidate: OptimizationTaskCandidate, profile: ProjectProfile): PlannerDraft {
  const filesBlock =
    candidate.suggestedFiles.length > 0
      ? candidate.suggestedFiles.map((f) => `- \`${f}\``).join('\n')
      : '- (see problem statement)';

  const promptMarkdown = [
    `# 8-Hour Optimization Task: ${candidate.title}`,
    ``,
    `**Source:** ${candidate.sourceType} | **Risk:** ${candidate.riskLevel} | **Est:** ${candidate.estimatedDurationHours}h | **Priority:** ${candidate.priorityScore}`,
    ``,
    `## Problem Statement`,
    candidate.problem,
    ``,
    `## Evidence`,
    candidate.evidence.map((e) => `- ${e}`).join('\n'),
    ``,
    `## Impact`,
    candidate.impact,
    ``,
    `## Suggested Files`,
    filesBlock,
    ``,
    `## Acceptance Criteria`,
    candidate.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n'),
    ``,
    `## Forbidden Actions`,
    candidate.forbiddenActions.map((f) => `- ⛔ ${f}`).join('\n'),
    ``,
    `## System Constraints`,
    `- Do not modify trading thresholds or strategy parameters`,
    `- Do not require live trading decisions or broker connection`,
    `- All acceptance criteria must be testable and verifiable`,
    `- Document every significant change with rationale`,
  ].join('\n');

  const contract: TaskContract = {
    version: '2.0',
    objective: candidate.title,
    background: candidate.problem,
    trigger_reason: `OPTIMIZATION_MINER@source=${candidate.sourceType}&score=${candidate.priorityScore}`,
    scope: candidate.suggestedFiles.length > 0 ? candidate.suggestedFiles : ['(see problem statement)'],
    constraints: [
      ...candidate.forbiddenActions,
      'Do not modify trading thresholds or strategy parameters',
      'Do not require live broker connection',
    ],
    acceptance_tests: candidate.acceptanceCriteria,
    required_outputs: candidate.acceptanceCriteria,
    forbidden_changes: candidate.forbiddenActions,
    handoff_questions: [
      'Did you verify each acceptance criterion with evidence?',
      'Were any forbidden actions performed?',
      'What artifacts were produced?',
    ],
    expected_duration_hours: candidate.estimatedDurationHours,
    target_files: candidate.suggestedFiles,
  };

  // Special-case: price analysis candidates should include a native ingest contract
  if (candidate.sourceType === 'price_analysis_quality') {
    // Attach ingest_contract metadata so downstream gate can validate report ingestability
    // and workers know where to write the native JSON report.
    // Note: TaskContract type is extended dynamically here for practical testing and gate checks.
    (contract as any).ingest_contract = {
      kind: 'price_analysis_native_report',
      dedupeKey: candidate.dedupeKey,
      reportPath: 'docs/reports/price_data_quality.json',
      insightTypeCandidate: 'data_quality_issue',
      requiredScopeField: 'affectedSymbols',
      requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
      noThresholdChanges: true,
    };

    // Ensure contract acceptance_tests include native-report and no-threshold-change reminders
    contract.acceptance_tests = Array.from(new Set([...
      contract.acceptance_tests,
      'Write native insight report JSON to docs/reports/price_data_quality.json',
      'No threshold changes — diagnostics only, using existing thresholds',
    ].flat()));

    // Also mark required_outputs to include the native report path
    contract.required_outputs = Array.from(new Set([...
      contract.required_outputs,
      'docs/reports/price_data_quality.json',
    ].flat()));
  }

  const plannerContext: PlannerTaskFingerprint = {
    taskType: `optimization_${candidate.sourceType}`,
    game: null,
    regimeState: 'OPTIMIZATION',
    dedupeKey: candidate.dedupeKey,
    confidenceScore: null,
    regimeTaskType: candidate.sourceType,
  };

  void profile; // profile is available for future personalization

  return { objective: candidate.title, promptMarkdown, contract, plannerContext };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export interface OptimizationMinerResult {
  draft: PlannerDraft;
  candidate: OptimizationTaskCandidate;
  totalMined: number;
  sourcesActive: OptimizationSourceType[];
}

/**
 * Run all optimization sources in parallel and return a PlannerDraft for the
 * highest-priority valid candidate that has not been published recently.
 *
 * Returns null if:
 * - All sources produce zero candidates (nothing actionable found)
 * - All candidates are deduplicated or blocked by quota
 */
export async function runOptimizationMiner(
  recentTasks: TaskRecord[],
  profile: ProjectProfile,
): Promise<OptimizationMinerResult | null> {
  let state = await loadMinerState();
  state = resetQuotaIfStale(state);

  const [systemHealth, executionLayer, lifecycle, learningLayer, priceAnalysis, codeQuality, uiUx, wikiDocs, testCoverage] = await Promise.all([
    mineSystemHealth().catch(() => [] as OptimizationTaskCandidate[]),
    mineExecutionLayer().catch(() => [] as OptimizationTaskCandidate[]),
    mineLifecycle().catch(() => [] as OptimizationTaskCandidate[]),
    mineLearningLayer().catch(() => [] as OptimizationTaskCandidate[]),
    minePriceAnalysisQuality().catch(() => [] as OptimizationTaskCandidate[]),
    mineCodeQuality().catch(() => [] as OptimizationTaskCandidate[]),
    mineUiUx().catch(() => [] as OptimizationTaskCandidate[]),
    mineWikiDocs().catch(() => [] as OptimizationTaskCandidate[]),
    mineTestCoverage().catch(() => [] as OptimizationTaskCandidate[]),
  ]);

  const allRaw = [...systemHealth, ...executionLayer, ...lifecycle, ...learningLayer, ...priceAnalysis, ...codeQuality, ...uiUx, ...wikiDocs, ...testCoverage];
  const totalMined = allRaw.length;
  if (totalMined === 0) return null;

  const scored = applyPriorityScores(allRaw);
  const deduped = deduplicateAgainstState(scored, state, recentTasks);
  const valid = deduped.filter(validateCandidate);
  const withinQuota = enforceQuota(valid, state.dailyQuota);

  if (withinQuota.length === 0) return null;

  const winner = [...withinQuota].sort((a, b) => b.priorityScore - a.priorityScore)[0]!;

  // Persist publication record
  state.publishedDedupeKeys[winner.dedupeKey] = new Date().toISOString();
  state.lastRunAt = new Date().toISOString();
  if (winner.riskLevel === 'HIGH') state.dailyQuota.highRisk++;
  else if (winner.riskLevel === 'MEDIUM') state.dailyQuota.mediumRisk++;
  else state.dailyQuota.lowRisk++;
  await saveMinerState(state).catch(() => { /* non-blocking */ });

  const sourcesActive = [...new Set(allRaw.map((c) => c.sourceType))];
  return {
    draft: candidateToDraft(winner, profile),
    candidate: winner,
    totalMined,
    sourcesActive,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Composite 8-Hour Multi-Domain Optimization Plan
//
// User request: Planner should emit one 8-hour task that spans five domains:
//   1. 系統優化       (system)         → system_health + code_quality + test_coverage
//   2. 功能優化       (feature)        → ui_ux + wiki_docs
//   3. 模擬優化       (simulation)     → lifecycle + price_analysis_quality
//   4. 實戰操作優化   (real_trading)   → execution_layer + trading_learning
//   5. 自我學習優化   (self_learning)  → learning_layer
//
// The composite pulls the strongest real miner candidate from each bucket. When
// a bucket is empty, a synthetic audit fallback is injected so every phase has
// concrete acceptance criteria. The composite is date-stamped so it publishes
// at most once per day, and it is attempted BEFORE the single-task path — which
// also fixes the "empty scheduler" problem when daily LOW-risk quota is already
// exhausted (composite uses its own dedupe namespace, not the per-source quota).
// ──────────────────────────────────────────────────────────────────────────────

export type CompositeDomainKey =
  | 'system'
  | 'feature'
  | 'simulation'
  | 'real_trading'
  | 'self_learning';

interface CompositeDomainSpec {
  key: CompositeDomainKey;
  labelZh: string;
  labelEn: string;
  sources: OptimizationSourceType[];
  fallback: {
    title: string;
    problem: string;
    acceptanceCriteria: string[];
    suggestedFiles: string[];
    forbiddenActions: string[];
  };
}

const COMPOSITE_DOMAINS: CompositeDomainSpec[] = [
  {
    key: 'system',
    labelZh: '系統優化',
    labelEn: 'System Optimization',
    sources: ['system_health', 'code_quality', 'test_coverage'],
    fallback: {
      title: 'System health & codebase hygiene audit',
      problem: 'Baseline pass over data-sync freshness, scheduler job failures, and codebase hotspots to keep the pipeline healthy.',
      acceptanceCriteria: [
        'Verify StockQuote / InstitutionalChip freshness within the last 2 trading days and document gaps',
        'Scan JobRunLog for the last 24h; list failing jobs and triage each with an owner note',
        'Identify top 5 files > 400 lines or with outstanding TODO/FIXME density and summarize refactor risk',
        'Write system_audit_report.md under docs/reports/ summarizing findings and recommended follow-ups',
      ],
      suggestedFiles: ['src/lib/sync/', 'src/lib/scheduler/', 'scripts/', 'docs/reports/'],
      forbiddenActions: [
        'Do not delete historical quote or chip records',
        'Do not disable scheduled jobs without operator approval',
      ],
    },
  },
  {
    key: 'feature',
    labelZh: '功能優化',
    labelEn: 'Feature & UX Optimization',
    sources: ['ui_ux', 'wiki_docs'],
    fallback: {
      title: 'Feature surface & documentation polish',
      problem: 'Walk the user-facing pages + wiki/docs to close obvious UX dead-ends and documentation rot.',
      acceptanceCriteria: [
        'List every src/app route with a page.tsx and rate it for loading/empty/error state completeness',
        'Pick the 3 weakest surfaces and file specific improvement tickets in docs/reports/feature_ux_audit.md',
        'Confirm README.md and USER_GUIDE.md reflect the current feature set; flag stale sections',
        'Produce a feature polish plan with concrete before/after acceptance tests for the top 3 surfaces',
      ],
      suggestedFiles: ['src/app/', 'src/components/', 'README.md', 'USER_GUIDE.md', 'docs/'],
      forbiddenActions: [
        'Do not ship breaking UI changes without a rollout note',
        'Do not remove docs — mark stale sections instead',
      ],
    },
  },
  {
    key: 'simulation',
    labelZh: '模擬優化',
    labelEn: 'Simulation Pipeline Optimization',
    sources: ['lifecycle', 'price_analysis_quality'],
    fallback: {
      title: 'Simulated-trade lifecycle & indicator-quality review',
      problem: 'Audit the simulated-trade pipeline — lifecycle correctness and indicator data quality underpin every backtest.',
      acceptanceCriteria: [
        'Audit open/pending SimulatedTrade records > 24h old and document each with a disposition plan',
        'Verify MA / RSI / volatility inputs use sufficient history (MA60 ≥ 60 bars, RSI14 ≥ 14 bars) across tracked symbols',
        'Run a sample backtest on the top 3 strategies and capture edge / sharpe / drawdown into a comparison table',
        'Write simulation_quality_report.md under docs/reports/ with any found defects and remediation steps',
      ],
      suggestedFiles: ['src/lib/lifecycle/', 'src/lib/backtest/', 'src/lib/indicators/', 'docs/reports/'],
      forbiddenActions: [
        'Do not mutate historical SimulatedTrade pnlPct values',
        'Do not tune strategy parameters inside this phase',
      ],
    },
  },
  {
    key: 'real_trading',
    labelZh: '實戰操作優化',
    labelEn: 'Real-Trading Execution Optimization',
    sources: ['execution_layer', 'trading_learning'],
    fallback: {
      title: 'Execution-layer & live-trading readiness review',
      problem: 'Check the bridge between simulation and real execution — trigger distribution, shadow/full promotion, and live trade feedback.',
      acceptanceCriteria: [
        'Summarize trigger distribution for the last 7 days and flag any setupType > 60% of trades',
        'Review shadow-to-full promotion criteria; list blockers preventing at least 3 promotions this week',
        'Audit live-trade feedback loop (pnl confirmation, position reconciliation) end-to-end and document gaps',
        'Write execution_readiness_report.md under docs/reports/ with a concrete action list',
      ],
      suggestedFiles: ['src/lib/trading/', 'src/lib/scoring/', 'src/lib/execution/', 'docs/reports/'],
      forbiddenActions: [
        'Do not place or cancel real orders during this phase',
        'Do not modify live position sizing without explicit operator approval',
      ],
    },
  },
  {
    key: 'self_learning',
    labelZh: '系統自我學習優化',
    labelEn: 'Self-Learning Loop Optimization',
    sources: ['learning_layer'],
    fallback: {
      title: 'Learning-loop health check & insight regeneration',
      problem: 'Without fresh StrategyLearningInsight records the system cannot adapt. Validate the learning pipeline and regenerate if stalled.',
      acceptanceCriteria: [
        'Report the age of the most recent StrategyLearningInsight and flag as stale if > 7 days',
        'Trace the insight-generation pipeline end-to-end and document each stage (inputs → outputs)',
        'Attempt to regenerate at least one insight on current data OR document the exact data block preventing it',
        'Write learning_loop_health.md under docs/reports/ capturing recommendations for the next iteration',
      ],
      suggestedFiles: ['src/lib/learning/', 'src/lib/agent-orchestrator/signalStateClassifier.ts', 'docs/reports/'],
      forbiddenActions: [
        'Do not insert synthetic StrategyLearningInsight rows to mask a pipeline failure',
        'Do not change learning thresholds without an explicit experiment plan',
      ],
    },
  },
];

interface DomainBucket {
  domain: CompositeDomainSpec;
  /** Real miner candidates picked for this bucket (highest priorityScore first). */
  picks: OptimizationTaskCandidate[];
  /** True when fallback synthetic criteria had to be used. */
  usedFallback: boolean;
}

export function bucketCandidatesByDomain(scored: OptimizationTaskCandidate[]): DomainBucket[] {
  const perSource = new Map<OptimizationSourceType, OptimizationTaskCandidate[]>();
  for (const c of scored) {
    const arr = perSource.get(c.sourceType) ?? [];
    arr.push(c);
    perSource.set(c.sourceType, arr);
  }
  for (const arr of perSource.values()) {
    arr.sort((a, b) => b.priorityScore - a.priorityScore);
  }
  return COMPOSITE_DOMAINS.map((domain) => {
    const pool: OptimizationTaskCandidate[] = [];
    for (const source of domain.sources) {
      const top = perSource.get(source)?.[0];
      if (top) pool.push(top);
    }
    pool.sort((a, b) => b.priorityScore - a.priorityScore);
    const picks = pool.slice(0, 2);
    return { domain, picks, usedFallback: picks.length === 0 };
  });
}

export function compositeDedupeKey(date: Date = new Date()): string {
  return `composite_8h_plan__${date.toISOString().slice(0, 10)}`;
}

export function buildCompositeDraft(
  buckets: DomainBucket[],
  profile: ProjectProfile,
  dedupeKey: string,
): PlannerDraft {
  const title = '8-Hour Multi-Domain Optimization Sprint (系統 / 功能 / 模擬 / 實戰 / 自我學習)';

  const phaseSections: string[] = [];
  const acceptanceTests: string[] = [];
  const requiredOutputs: string[] = [];
  const forbidden = new Set<string>([
    'Do not modify trading thresholds or strategy parameters outside of the designated phase',
    'Do not require live broker connection',
    'Do not skip a phase silently — if blocked, document the blocker as acceptance evidence',
  ]);
  const scopeFiles = new Set<string>();

  buckets.forEach((bucket, idx) => {
    const phaseNum = idx + 1;
    const { domain, picks, usedFallback } = bucket;
    const phaseTitle = `Phase ${phaseNum}: ${domain.labelZh} (${domain.labelEn})`;

    const problemLines: string[] = [];
    const criteriaLines: string[] = [];
    const fileLines = new Set<string>();
    const forbiddenLines: string[] = [];

    if (usedFallback) {
      problemLines.push(`**Problem.** ${domain.fallback.problem}`);
      problemLines.push('_(No miner candidate found for this domain today — the fallback audit is used instead.)_');
      domain.fallback.acceptanceCriteria.forEach((c) => {
        const tagged = `[${domain.key}] ${c}`;
        criteriaLines.push(`- [ ] ${tagged}`);
        acceptanceTests.push(tagged);
        requiredOutputs.push(tagged);
      });
      domain.fallback.suggestedFiles.forEach((f) => { fileLines.add(f); scopeFiles.add(f); });
      domain.fallback.forbiddenActions.forEach((f) => { forbiddenLines.push(f); forbidden.add(f); });
    } else {
      picks.forEach((pick, pickIdx) => {
        problemLines.push(`**Problem ${pickIdx + 1} — ${pick.sourceType}.** ${pick.problem}`);
        if (pick.evidence.length > 0) {
          problemLines.push(`Evidence: ${pick.evidence.slice(0, 3).map((e) => `\`${e}\``).join('; ')}`);
        }
        pick.acceptanceCriteria.forEach((c) => {
          const tagged = `[${domain.key}] ${c}`;
          criteriaLines.push(`- [ ] ${tagged}`);
          acceptanceTests.push(tagged);
          requiredOutputs.push(tagged);
        });
        pick.suggestedFiles.forEach((f) => { fileLines.add(f); scopeFiles.add(f); });
        pick.forbiddenActions.forEach((f) => { forbiddenLines.push(f); forbidden.add(f); });
      });
    }

    const filesBlock = fileLines.size
      ? [...fileLines].map((f) => `- \`${f}\``).join('\n')
      : '- (see problem statement)';
    const forbiddenBlock = forbiddenLines.length
      ? [...new Set(forbiddenLines)].map((f) => `- ⛔ ${f}`).join('\n')
      : '- ⛔ (none specific — general constraints below)';

    phaseSections.push(
      [
        `### ${phaseTitle}`,
        '',
        problemLines.join('\n\n'),
        '',
        '**Suggested Files:**',
        filesBlock,
        '',
        '**Acceptance Criteria:**',
        criteriaLines.join('\n') || '- [ ] (see fallback spec)',
        '',
        '**Forbidden Actions:**',
        forbiddenBlock,
      ].join('\n'),
    );
  });

  const realBuckets = buckets.filter((b) => !b.usedFallback).length;
  const fallbackBuckets = buckets.length - realBuckets;

  const promptMarkdown = [
    `# ${title}`,
    '',
    `**Est Duration:** 8h | **Risk:** MEDIUM | **Composite:** 5 domains (${realBuckets} miner-sourced, ${fallbackBuckets} fallback)`,
    '',
    '## Objective',
    '在 8 小時內完成橫跨 5 個優化面向的整合性 sprint，確保系統健康、功能體驗、模擬品質、實戰執行、以及自我學習迴路皆有可驗證的推進。',
    '',
    '## How to Execute',
    '1. 按照 Phase 1 → Phase 5 的順序逐段實作；每段都要留下 artifact（report / log / diff）作為驗收憑據。',
    '2. 每個 phase 完成後，在 `completed.md` 內以對應的 `[domain] criterion` tag 更新進度。',
    '3. 若某一 phase 受到資料或權限阻擋，**不要跳過**，而是在該 phase 的驗收條件下記錄具體 blocker 作為 evidence。',
    '4. 所有 reports 統一落在 `docs/reports/` 下，檔名需包含日期與 domain key。',
    '',
    '## Phases',
    phaseSections.join('\n\n'),
    '',
    '## Global Constraints',
    [...forbidden].map((f) => `- ${f}`).join('\n'),
    '',
    '## System Constraints',
    '- Do not modify protected paths from the project profile',
    '- Every acceptance criterion must be testable and verifiable with an artifact path',
    '- Each phase must produce at least one file/diff/log as evidence',
    '- If time runs short, deliver fewer phases **completely** rather than all phases partially',
  ].join('\n');

  const contract: TaskContract = {
    version: '2.0',
    objective: title,
    background:
      'Composite 8-hour optimization sprint covering system health, feature/UX, simulation pipeline, real-trading execution, and self-learning loop. Generated by the optimization miner when multiple domains have actionable findings or when the single-task quota is saturated.',
    trigger_reason: `OPTIMIZATION_MINER@composite_8h&domains=${buckets.map((b) => b.domain.key).join(',')}&mined=${realBuckets}`,
    scope: scopeFiles.size > 0 ? [...scopeFiles] : ['(see phase-specific files)'],
    constraints: [...forbidden],
    acceptance_tests: acceptanceTests,
    required_outputs: requiredOutputs,
    forbidden_changes: [...forbidden],
    handoff_questions: [
      'Which phases completed fully, which partially, which blocked?',
      'What artifact path proves each passing acceptance criterion?',
      'Were any forbidden actions triggered? If so, how were they reverted?',
      'What is the recommended follow-up task for any partial/blocked phase?',
    ],
    expected_duration_hours: 8,
    target_files: [...scopeFiles],
  };

  const plannerContext: PlannerTaskFingerprint = {
    taskType: 'optimization_composite_8h',
    game: null,
    regimeState: 'OPTIMIZATION',
    dedupeKey,
    confidenceScore: null,
    regimeTaskType: 'composite_8h_plan',
  };

  void profile;

  return { objective: title, promptMarkdown, contract, plannerContext };
}

export interface CompositeMinerResult {
  draft: PlannerDraft;
  buckets: DomainBucket[];
  realBuckets: number;
  fallbackBuckets: number;
  dedupeKey: string;
}

const RETRYABLE_TASK_STATUSES = new Set(['FAILED', 'FAILED_RATE_LIMIT', 'REPLAN_REQUIRED', 'CANCELLED']);

async function shouldAllowCompositeRepublishFromLatestTask(task: TaskRecord | null): Promise<boolean> {
  if (!task) return false;

  if (RETRYABLE_TASK_STATUSES.has(task.status)) {
    return true;
  }

  if (task.status !== 'COMPLETED') {
    return false;
  }

  // If the latest same-day composite was only a simulated fallback run,
  // allow planner to republish a real composite task after configuration fixes.
  if (task.completedPath && await fileExists(task.completedPath)) {
    const completed = await fs.readFile(task.completedPath, 'utf8').catch(() => '');
    if (/execution mode:\s*simulated fallback/i.test(completed)) {
      return true;
    }
  }

  if (task.resultPath && await fileExists(task.resultPath)) {
    const result = await readJsonFile<TaskResult>(task.resultPath).catch(() => null);
    if (!result) return false;

    if (result.gate_verdict !== 'PASS') {
      return true;
    }

    if (
      result.acceptance_results?.some((a) => /fallback delivery/i.test(a.name))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Build a composite 8-hour multi-domain plan. Returns null only when the
 * composite dedupeKey for today is already published (so we don't double-emit).
 * Unlike the single-task miner this is NOT gated by per-risk daily quota —
 * it has its own daily slot via the date-stamped dedupeKey.
 */
export async function runCompositeOptimizationMiner(
  recentTasks: TaskRecord[],
  profile: ProjectProfile,
): Promise<CompositeMinerResult | null> {
  let state = await loadMinerState();
  state = resetQuotaIfStale(state);

  const dedupeKey = compositeDedupeKey();

  const latestSameDedupeTask = [...recentTasks]
    .filter((t) => t.plannerContext?.dedupeKey === dedupeKey)
    .sort((a, b) => b.taskId - a.taskId)[0] ?? null;

  // Already published today?
  const publishedAt = state.publishedDedupeKeys[dedupeKey];
  if (publishedAt && !isDedupeExpired(publishedAt)) {
    const canRepublish = await shouldAllowCompositeRepublishFromLatestTask(latestSameDedupeTask);
    if (!canRepublish) return null;
    delete state.publishedDedupeKeys[dedupeKey];
  }

  // In-flight guard (composite key currently QUEUED or RUNNING)
  const inFlight = recentTasks.find(
    (t) => t.plannerContext?.dedupeKey === dedupeKey && ['QUEUED', 'RUNNING'].includes(t.status),
  );
  if (inFlight) return null;

  const [systemHealth, executionLayer, lifecycle, learningLayer, priceAnalysis, codeQuality, uiUx, wikiDocs, testCoverage] = await Promise.all([
    mineSystemHealth().catch(() => [] as OptimizationTaskCandidate[]),
    mineExecutionLayer().catch(() => [] as OptimizationTaskCandidate[]),
    mineLifecycle().catch(() => [] as OptimizationTaskCandidate[]),
    mineLearningLayer().catch(() => [] as OptimizationTaskCandidate[]),
    minePriceAnalysisQuality().catch(() => [] as OptimizationTaskCandidate[]),
    mineCodeQuality().catch(() => [] as OptimizationTaskCandidate[]),
    mineUiUx().catch(() => [] as OptimizationTaskCandidate[]),
    mineWikiDocs().catch(() => [] as OptimizationTaskCandidate[]),
    mineTestCoverage().catch(() => [] as OptimizationTaskCandidate[]),
  ]);

  const allRaw = [
    ...systemHealth, ...executionLayer, ...lifecycle, ...learningLayer, ...priceAnalysis,
    ...codeQuality, ...uiUx, ...wikiDocs, ...testCoverage,
  ];
  const scored = applyPriorityScores(allRaw);
  const buckets = bucketCandidatesByDomain(scored);

  const draft = buildCompositeDraft(buckets, profile, dedupeKey);

  // Persist composite publication so we don't re-emit today.
  state.publishedDedupeKeys[dedupeKey] = new Date().toISOString();
  state.lastRunAt = new Date().toISOString();
  await saveMinerState(state).catch(() => { /* non-blocking */ });

  const realBuckets = buckets.filter((b) => !b.usedFallback).length;
  const fallbackBuckets = buckets.length - realBuckets;

  return { draft, buckets, realBuckets, fallbackBuckets, dedupeKey };
}
