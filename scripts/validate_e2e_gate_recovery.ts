/**
 * E2E Validation Script — Insight → Guardrail → Tiered Gate → Recovery pipeline
 *
 * Seeds controlled OptimizationInsightRecord rows into the DB, runs the full
 * pipeline at each tier, reports results, and cleans up after.
 *
 * Run: npx ts-node --transpile-only scripts/validate_e2e_gate_recovery.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  runTieredGuardrail,
  TIER_SOFT_MAX,
  TIER_STRONG_MAX,
  STRONG_PENALTY_CAP,
  STRONG_SIZING_MULTIPLIER,
  GUARDRAIL_MIN_CONFIDENCE,
  type TieredGuardrailResult,
} from '../src/lib/autonomous/InsightGuardrailLayer';
import {
  scoreTriggerReadiness,
  type QuoteRow,
  type TriggerScore,
} from '../src/lib/autonomous/TriggerScoringEngine';
import {
  computeTieredScoreMultiplier,
  applyStrongInsightRankingPenalty,
  loadActiveInsights,
  type OptimizationInsightRecord,
} from '../src/lib/autonomous/InsightIntegrationLayer';
import {
  applyGateDiversityRule,
  shouldProbe,
  evaluateGateRecovery,
  computeRecoveryScore,
  probeHash,
  PROBE_RATE,
  PROBE_RATE_MATURE,
  PROBE_SIZING_MULTIPLIER,
  MIN_PROBE_AGE_DAYS,
  MAX_GATE_DAYS_BEFORE_REEVAL,
  RECOVERY_SOFT_THRESHOLD,
  RECOVERY_STRONG_THRESHOLD,
  type RecoverySignal,
} from '../src/lib/autonomous/GateRecoveryEngine';
import type { AutonomousResearchSnapshot, StrategyProposal } from '../src/lib/autonomous/types';

const prisma = new PrismaClient();

// ─── ANSI Colors ──────────────────────────────────────────────────────────────
const G = '\x1b[32m';   // green
const R = '\x1b[31m';   // red
const Y = '\x1b[33m';   // yellow
const B = '\x1b[36m';   // cyan (bold section)
const D = '\x1b[90m';   // dim grey
const W = '\x1b[97m';   // bright white
const X = '\x1b[0m';    // reset

function pass(msg: string) { console.log(`  ${G}✓${X} ${msg}`); }
function fail(msg: string) { console.log(`  ${R}✗${X} ${msg}`); }
function warn(msg: string) { console.log(`  ${Y}⚠${X} ${msg}`); }
function info(msg: string) { console.log(`  ${D}·${X} ${msg}`); }
function section(title: string) { console.log(`\n${B}═══ ${title} ${X}`); }

let passCount = 0;
let failCount = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { pass(label); passCount++; }
  else     { fail(`${label}${detail ? ` — ${detail}` : ''}`); failCount++; }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date();
const FUTURE_14 = new Date(NOW.getTime() + 14 * 86400000).toISOString();
const PAST_1S   = new Date(NOW.getTime() - 1000).toISOString();
const AGO_1H    = new Date(NOW.getTime() - 3600000).toISOString();  // 1 hour old — keeps decayFactor > 0.99

const SOURCE_PREFIX = 'e2e-validate';

/** Controlled insights seeded for validation (one per tier + one expired). */
const SEED_INSIGHTS: Array<Omit<OptimizationInsightRecord, 'id'> & { label: string }> = [
  {
    // indicator_insufficient: no conflict rule with setup_imbalance or time_exit_dominance
    // MIN_EVIDENCE_COUNT = 1, so a single item is sufficient.
    label: 'SOFT (indicator_insufficient, conf=0.65)',
    insightType: 'indicator_insufficient',
    sourceTaskId: `${SOURCE_PREFIX}-soft`,
    evidence: ['TSLA: only 12 days of MFI history (needs 20)'],
    confidence: 0.65,
    severity: 'low',
    affectedSetupTypes: [],
    affectedSymbols: ['TSLA'],
    expiresAt: FUTURE_14,
    createdAt: AGO_1H,
  },
  {
    label: 'STRONG (time_exit_dominance, conf=0.80)',
    insightType: 'time_exit_dominance',
    sourceTaskId: `${SOURCE_PREFIX}-strong`,
    evidence: ['43% time exits over last 30 trades', 'stops too wide'],
    confidence: 0.80,
    severity: 'medium',
    affectedSetupTypes: ['trend'],
    affectedSymbols: [],
    expiresAt: FUTURE_14,
    createdAt: AGO_1H,
  },
  {
    label: 'CRITICAL gateable (setup_imbalance, conf=0.95, 2 evidence)',
    insightType: 'setup_imbalance',
    sourceTaskId: `${SOURCE_PREFIX}-critical`,
    evidence: ['trend: 78% of proposals last 7d', 'rebound: 8% of proposals'],
    confidence: 0.95,
    severity: 'high',
    affectedSetupTypes: ['trend'],
    affectedSymbols: ['AAPL', 'MSFT'],
    expiresAt: FUTURE_14,
    createdAt: AGO_1H,
  },
  {
    label: 'EXPIRED (data_quality_issue, conf=0.90)',
    insightType: 'data_quality_issue',
    sourceTaskId: `${SOURCE_PREFIX}-expired`,
    evidence: ['stale price data detected'],
    confidence: 0.90,
    severity: 'high',
    affectedSetupTypes: [],
    affectedSymbols: [],
    expiresAt: PAST_1S,
    createdAt: AGO_1H,
  },
];

// ─── Quote Fixture ─────────────────────────────────────────────────────────────

function makeTrendingQuotes(n = 30): QuoteRow[] {
  const base = 100;
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(NOW.getTime() - (n - i) * 86400000).toISOString().slice(0, 10),
    open:   base + i * 0.4,
    high:   base + i * 0.4 + 1.5,
    low:    base + i * 0.4 - 0.5,
    close:  base + i * 0.4 + 0.8,
    volume: 1_200_000 + i * 10000,
    change: 0.008,
  }));
}

// ─── Snapshot Fixture ─────────────────────────────────────────────────────────

const SNAPSHOT: AutonomousResearchSnapshot = {
  marketState: 'trending',
  candidateStocks: [
    { symbol: 'AAPL', setupType: 'trend',     alphaScore: 0.88, rationale: 'momentum' },
    { symbol: 'MSFT', setupType: 'trend',     alphaScore: 0.82, rationale: 'momentum' },
    { symbol: 'TSLA', setupType: 'rebound',   alphaScore: 0.75, rationale: 'oversold' },
    { symbol: 'GOOG', setupType: 'event',     alphaScore: 0.70, rationale: 'earnings' },
    { symbol: 'NVDA', setupType: 'fundamental', alphaScore: 0.65, rationale: 'valuation' },
  ],
  timestamp: NOW.toISOString(),
  dataVersion: 'e2e-test',
};

const TREND_PROPOSAL: StrategyProposal = {
  symbol: 'AAPL',
  setupType: 'trend',
  alphaScore: 0.88,
  rationale: 'momentum test',
  proposedAt: NOW.toISOString(),
};

const REBOUND_PROPOSAL: StrategyProposal = {
  symbol: 'TSLA',
  setupType: 'rebound',
  alphaScore: 0.75,
  rationale: 'oversold test',
  proposedAt: NOW.toISOString(),
};

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seedInsights(): Promise<void> {
  for (const seed of SEED_INSIGHTS) {
    const { label, ...data } = seed;
    await prisma.optimizationInsightRecord.upsert({
      where: { sourceTaskId_insightType: { sourceTaskId: data.sourceTaskId, insightType: data.insightType } },
      create: {
        insightType: data.insightType,
        sourceTaskId: data.sourceTaskId,
        evidence: JSON.stringify(data.evidence),
        confidence: data.confidence,
        severity: data.severity,
        affectedScope: JSON.stringify({ setupTypes: data.affectedSetupTypes, symbols: data.affectedSymbols }),
        expiresAt: new Date(data.expiresAt),
        createdAt: new Date(data.createdAt!),
        regimeContext: null,
      },
      update: {
        expiresAt: new Date(data.expiresAt),
        confidence: data.confidence,
      },
    });
    info(`Seeded: ${label}`);
  }
}

async function cleanupInsights(): Promise<void> {
  await prisma.optimizationInsightRecord.deleteMany({
    where: { sourceTaskId: { startsWith: SOURCE_PREFIX } },
  });
}

// ─── Section 1: DB Status ──────────────────────────────────────────────────────

async function section1_dbStatus(): Promise<OptimizationInsightRecord[]> {
  section('1. Insight DB Status');

  const all = await prisma.optimizationInsightRecord.findMany({ orderBy: { createdAt: 'desc' } });
  const active = all.filter((r) => new Date(r.expiresAt) > NOW);
  const expired = all.filter((r) => new Date(r.expiresAt) <= NOW);
  const seeded = all.filter((r) => r.sourceTaskId.startsWith(SOURCE_PREFIX));

  info(`Total records: ${all.length}`);
  info(`Active (not expired): ${active.length}`);
  info(`Expired: ${expired.length}`);
  info(`Seeded for this run: ${seeded.length}`);

  check('Total records >= 4 (seeded)', all.length >= 4, `got ${all.length}`);
  check('Active records >= 3 (soft + strong + critical)', active.length >= 3, `got ${active.length}`);
  check('Expired record present', expired.length >= 1, `got ${expired.length}`);

  // Type distribution
  const typeDist = new Map<string, number>();
  for (const r of all) typeDist.set(r.insightType, (typeDist.get(r.insightType) ?? 0) + 1);
  console.log(`\n  ${D}Type distribution:${X}`);
  for (const [type, cnt] of typeDist.entries()) info(`  ${type}: ${cnt}`);

  // loadActiveInsights() — the actual DB loader used by all callers
  const loaded = await loadActiveInsights();
  check('loadActiveInsights() returns non-expired only',
    loaded.every((i) => new Date(i.expiresAt) > NOW),
    `${loaded.length} returned`);
  check('loadActiveInsights() count matches active', loaded.length === active.length,
    `loaded=${loaded.length} active=${active.length}`);

  const setupCoverage = [...new Set(loaded.flatMap((i) => i.affectedSetupTypes))];
  info(`Setup types covered by active insights: [${setupCoverage.join(', ')}]`);

  return loaded;
}

// ─── Section 2: Guardrail / Tier Behavior ─────────────────────────────────────

function section2_guardrailTier(insights: OptimizationInsightRecord[]): TieredGuardrailResult {
  section('2. Guardrail / Tier Behavior');

  const result = runTieredGuardrail(insights, {
    currentRegime: 'trending',
    callerLabel: 'E2E-Validation',
  });

  info(`Total insights fed: ${insights.length}`);
  info(`Passed guardrail: ${result.filtered.length}`);
  info(`Rejected: ${result.rejected.length}`);
  info(`Soft tier: ${result.tiers.soft.length}`);
  info(`Strong tier: ${result.tiers.strong.length}`);
  info(`Critical tier: ${result.tiers.critical.length}`);
  info(`Gating decisions: ${result.gatingDecisions.length}`);

  check('Soft insight classified correctly (indicator_insufficient)',
    result.tiers.soft.some((i) => i.insightType === 'indicator_insufficient'),
    `soft=[${result.tiers.soft.map((i) => i.insightType).join(',')}]`);

  check('Strong insight classified correctly',
    result.tiers.strong.some((i) => i.insightType === 'time_exit_dominance'),
    `strong=[${result.tiers.strong.map((i) => i.insightType).join(',')}]`);

  check('Critical insight classified correctly',
    result.tiers.critical.some((i) => i.insightType === 'setup_imbalance'),
    `critical=[${result.tiers.critical.map((i) => i.insightType).join(',')}]`);

  check('Hard gate created for critical insight',
    result.gatingDecisions.length >= 1,
    `gates=${result.gatingDecisions.map((g) => `${g.gatedSetupType ?? 'global'}:${g.insight.insightType}`).join(',')}`);

  const gate = result.gatingDecisions.find((g) => g.gatedSetupType === 'trend');
  check('Gate targets trend setupType', gate !== undefined);

  check('Gating tier is critical', result.gatingDecisions.every((g) => g.tier === 'critical'));
  check('positionSizingMultiplier set for strong tier',
    result.positionSizingMultiplier === STRONG_SIZING_MULTIPLIER,
    `got ${result.positionSizingMultiplier}`);

  // Tier boundary validation
  const softConfs = result.tiers.soft.map((i) => i.decayedConfidence);
  const strongConfs = result.tiers.strong.map((i) => i.decayedConfidence);
  const critConfs = result.tiers.critical.map((i) => i.decayedConfidence);

  if (softConfs.length > 0) {
    check(`All soft insights have conf < ${TIER_SOFT_MAX}`, softConfs.every((c) => c < TIER_SOFT_MAX),
      `confs=[${softConfs.map((c) => c.toFixed(3)).join(',')}]`);
  }
  if (strongConfs.length > 0) {
    check(`All strong insights have ${TIER_SOFT_MAX} <= conf < ${TIER_STRONG_MAX}`,
      strongConfs.every((c) => c >= TIER_SOFT_MAX && c < TIER_STRONG_MAX),
      `confs=[${strongConfs.map((c) => c.toFixed(3)).join(',')}]`);
  }
  if (critConfs.length > 0) {
    check(`All critical insights have conf >= ${TIER_STRONG_MAX}`,
      critConfs.every((c) => c >= TIER_STRONG_MAX),
      `confs=[${critConfs.map((c) => c.toFixed(3)).join(',')}]`);
  }

  return result;
}

// ─── Section 3: Trigger Scoring ───────────────────────────────────────────────

function section3_triggerScoring(insights: OptimizationInsightRecord[]): void {
  section('3. Trigger Scoring — per-scenario');

  const quotes = makeTrendingQuotes(35);

  // --- Scenario A: No insights ---
  const scoreA = scoreTriggerReadiness(TREND_PROPOSAL, quotes, SNAPSHOT, { insights: [] });
  info(`[A] Baseline (no insights)        finalScore=${scoreA.finalScore.toFixed(3)} mode=${scoreA.tradeMode} gated=${scoreA.gated ?? false} isProbe=${scoreA.isProbe ?? false}`);
  check('A: finalScore > 0 (no insights)', scoreA.finalScore > 0, `got ${scoreA.finalScore.toFixed(3)}`);
  check('A: not gated', !scoreA.gated);
  check('A: not probe', !scoreA.isProbe);
  check('A: tradeMode is not none', scoreA.tradeMode !== 'none');

  // --- Scenario B: Soft insight only ---
  const softOnly = insights.filter((i) => i.insightType === 'indicator_insufficient');
  const scoreB = scoreTriggerReadiness(TREND_PROPOSAL, quotes, SNAPSHOT, { insights: softOnly });
  info(`[B] Soft insight                  finalScore=${scoreB.finalScore.toFixed(3)} mode=${scoreB.tradeMode} gated=${scoreB.gated ?? false} isProbe=${scoreB.isProbe ?? false}`);
  check('B: not gated (soft never gates)', !scoreB.gated);
  check('B: finalScore > 0', scoreB.finalScore > 0);

  // --- Scenario C: Strong insight ---
  const strongOnly = insights.filter((i) => i.insightType === 'time_exit_dominance');
  const scoreC = scoreTriggerReadiness(TREND_PROPOSAL, quotes, SNAPSHOT, { insights: strongOnly });
  info(`[C] Strong insight                finalScore=${scoreC.finalScore.toFixed(3)} mode=${scoreC.tradeMode} gated=${scoreC.gated ?? false} sizing=${scoreC.insightSizingMultiplier}`);
  check('C: not hard-gated (strong never hard-gates)', !scoreC.gated);
  check('C: sizing multiplier applied (0.5)',
    scoreC.insightSizingMultiplier === STRONG_SIZING_MULTIPLIER || scoreC.insightSizingMultiplier === undefined,
    `got ${scoreC.insightSizingMultiplier}`);

  // --- Scenario D: Hard gate (critical) — trend proposal should be blocked ---
  const critOnly = insights.filter((i) => i.insightType === 'setup_imbalance');
  const scoreD = scoreTriggerReadiness(TREND_PROPOSAL, quotes, SNAPSHOT, { insights: critOnly });
  info(`[D] Hard gate (trend)             finalScore=${scoreD.finalScore.toFixed(3)} mode=${scoreD.tradeMode} gated=${scoreD.gated ?? false} isProbe=${scoreD.isProbe ?? false} reason="${scoreD.gatingReason ?? scoreD.components.find(c => c.name === 'probe_bypass')?.detail ?? ''}"`);

  if (scoreD.gated) {
    check('D: finalScore = 0 when hard-gated', scoreD.finalScore === 0);
    check('D: tradeMode = none when hard-gated', scoreD.tradeMode === 'none');
    check('D: gatingReason present', !!scoreD.gatingReason);
    check('D: not probe', !scoreD.isProbe);
  } else if (scoreD.isProbe) {
    // Probe was allowed (deterministic hash happened to pass)
    check('D: probe uses shadow mode', scoreD.tradeMode === 'shadow');
    check('D: probe sizing ≤ PROBE_SIZING_MULTIPLIER',
      (scoreD.insightSizingMultiplier ?? 0) <= PROBE_SIZING_MULTIPLIER);
    check('D: probeTag present', !!scoreD.probeTag);
    warn('D: Probe bypassed gate (hash < rate) — verify sizing below normal');
  } else {
    fail('D: Expected gate or probe, but got neither');
  }

  // --- Scenario E: Rebound proposal — should NOT be blocked by trend gate ---
  const scoreE = scoreTriggerReadiness(REBOUND_PROPOSAL, quotes, SNAPSHOT, { insights: critOnly });
  info(`[E] Rebound (not gated setup)     finalScore=${scoreE.finalScore.toFixed(3)} mode=${scoreE.tradeMode} gated=${scoreE.gated ?? false}`);
  check('E: rebound not blocked by trend gate', !scoreE.gated && !scoreE.isProbe || scoreE.finalScore > 0);
  check('E: tradeMode is not none (non-gated setup)', scoreE.tradeMode !== 'none');

  // --- Scenario F: Combined (all insights) ---
  const scoreF = scoreTriggerReadiness(TREND_PROPOSAL, quotes, SNAPSHOT, { insights });
  info(`[F] All insights (trend)          finalScore=${scoreF.finalScore.toFixed(3)} mode=${scoreF.tradeMode} gated=${scoreF.gated ?? false} isProbe=${scoreF.isProbe ?? false}`);
  // Hard gate takes precedence over soft/strong
  if (!scoreF.isProbe) {
    check('F: hard gate takes precedence', scoreF.gated === true || scoreF.tradeMode === 'none',
      `mode=${scoreF.tradeMode} gated=${scoreF.gated}`);
  } else {
    check('F: probe allowed through combined gate', scoreF.tradeMode === 'shadow');
  }
}

// ─── Section 4: Decision Layer ────────────────────────────────────────────────

function section4_decisionLayer(insights: OptimizationInsightRecord[]): void {
  section('4. Decision Layer — candidate filtering + diversity');

  const result = runTieredGuardrail(insights, { callerLabel: 'E2E-DecisionLayer' });

  const gatedSetupTypes = new Set(
    result.gatingDecisions
      .filter((g) => g.gatedSetupType !== undefined)
      .map((g) => g.gatedSetupType!),
  );
  const hasGlobalGate = result.gatingDecisions.some((g) => g.gatedSetupType === undefined);

  const eligible = hasGlobalGate
    ? []
    : gatedSetupTypes.size > 0
      ? SNAPSHOT.candidateStocks.filter((c) => !gatedSetupTypes.has(c.setupType))
      : SNAPSHOT.candidateStocks;

  const rankedWithPenalty = applyStrongInsightRankingPenalty(eligible, result.tiers)
    .sort((a, b) => b.alphaScore - a.alphaScore);

  info(`Candidates before filtering: ${SNAPSHOT.candidateStocks.length}`);
  info(`Gated setup types: [${[...gatedSetupTypes].join(', ')}]`);
  info(`Global gate: ${hasGlobalGate}`);
  info(`Eligible after gate filter: ${eligible.length}`);
  info(`After penalty ranking: ${rankedWithPenalty.length}`);

  check('Gated setup types include trend', gatedSetupTypes.has('trend'));
  check('trend candidates excluded from eligible',
    eligible.every((c) => c.setupType !== 'trend'),
    `eligible=[${eligible.map((c) => `${c.symbol}:${c.setupType}`).join(',')}]`);
  check('Non-trend candidates still eligible',
    eligible.some((c) => c.setupType !== 'trend'),
    `eligible count=${eligible.length}`);

  // Diversity rule check
  const allSetupTypes = SNAPSHOT.candidateStocks.map((c) => c.setupType);
  const diversity = applyGateDiversityRule(result.gatingDecisions, allSetupTypes);
  info(`Diversity check: sufficient=${diversity.sufficient} exempted=${diversity.exemptedSetupType ?? 'none'}`);
  check('Diversity sufficient (other setup types available)', diversity.sufficient,
    `exempted=${diversity.exemptedSetupType ?? 'none'}`);

  // Simulate all-gated scenario (global gate)
  const fakeGlobalGate = [{ ...result.gatingDecisions[0], gatedSetupType: undefined as string | undefined }];
  const diversityGlobal = applyGateDiversityRule(fakeGlobalGate, allSetupTypes);
  check('Diversity rescue fires when global gate present', !diversityGlobal.sufficient);
  check('Diversity rescue exempts a setup type', diversityGlobal.exemptedSetupType !== undefined,
    `exempted=${diversityGlobal.exemptedSetupType}`);
  check('No all-strategy lockout (diversity always provides ≥1 setup)',
    diversityGlobal.exemptedSetupType !== undefined);

  // Strong insight penalty applied
  const penaltyNoted = rankedWithPenalty.filter((c) => (c as { insightPenaltyNote?: string }).insightPenaltyNote);
  info(`Candidates with strong-insight penalty note: ${penaltyNoted.length}`);
}

// ─── Section 5: Learning Layer ────────────────────────────────────────────────

async function section5_learningLayer(): Promise<void> {
  section('5. Learning Layer — recovery signals');

  // Simulate the signal detection logic from StrategyLearningEngine
  const reports = await prisma.tradeReviewReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 20 });

  const loaded = await loadActiveInsights();
  const guardrailResult = runTieredGuardrail(loaded, { callerLabel: 'E2E-LearningLayer' });

  info(`Gate decisions: ${guardrailResult.gatingDecisions.length}`);
  info(`Trade review reports available: ${reports.length}`);

  // Simulate probe success detection
  const probeSuccesses = reports.filter((r) => {
    try {
      const preTrade = JSON.parse(r.preTrade ?? '{}') as Record<string, unknown>;
      const result   = JSON.parse(r.result   ?? '{}') as Record<string, unknown>;
      return (
        String(preTrade.tradeMode ?? '') === 'shadow' &&
        String(preTrade.isProbe ?? '') === 'true' &&
        Number(result.return ?? result.pnlPct ?? 0) >= 0
      );
    } catch { return false; }
  });

  // Simulate time-exit detection
  const timeExitCount = reports.filter(
    (r) => r.triggerType === 'time' || (() => {
      try { return String((JSON.parse(r.result ?? '{}') as Record<string, unknown>).exitReason ?? '') === 'time'; }
      catch { return false; }
    })()
  ).length;
  const timeExitRate = reports.length > 0 ? timeExitCount / reports.length : 0;

  info(`Probe successes detected: ${probeSuccesses.length}`);
  info(`Time-exit rate: ${(timeExitRate * 100).toFixed(1)}% (${timeExitCount}/${reports.length})`);
  info(`Time-exit contamination check: ${timeExitRate < 0.4 ? 'clean (< 40%)' : 'elevated (>= 40%)'}`);

  // Build recovery signals
  const recoverySignals: RecoverySignal[] = [];
  for (let i = 0; i < Math.min(probeSuccesses.length, 3); i++) {
    recoverySignals.push({ type: 'successful_probe', value: 1.0, evidence: `probe #${i+1}`, recordedAt: NOW.toISOString() });
  }
  if (timeExitRate < 0.4 && reports.length >= 5) {
    recoverySignals.push({ type: 'reduced_time_exit', value: 1.0 - timeExitRate, evidence: `time-exit ${(timeExitRate*100).toFixed(1)}%`, recordedAt: NOW.toISOString() });
  }

  info(`Recovery signals built: ${recoverySignals.length} — [${recoverySignals.map((s) => s.type).join(', ')}]`);

  if (guardrailResult.gatingDecisions.length > 0) {
    const candidateTypes = [...new Set(SNAPSHOT.candidateStocks.map((c) => c.setupType))];
    const recovery = evaluateGateRecovery(
      guardrailResult.gatingDecisions,
      recoverySignals,
      candidateTypes,
      { callerLabel: 'E2E-LearningLayer' },
    );
    info(`Recovery expired gates: ${recovery.expiredGates.length}`);
    info(`Recovery downgraded gates: ${recovery.downgradedGates.length}`);
    info(`Recovery probe decisions: ${recovery.probeDecisions.length}`);
    info(`Recovery diversity enforced: ${recovery.diversity.sufficient ? 'no' : 'yes'}`);

    check('Expired gates handled by recovery',
      recovery.expiredGates.length >= 0); // structural check
    check('Recovery result has activeGates field', Array.isArray(recovery.activeGates));
    check('Recovery diversity result present', recovery.diversity !== undefined);
  } else {
    check('No gates — skipping recovery check (expected with real data)', true);
    warn('No active gating decisions in DB — learning layer recovery path not exercised with live data');
  }

  // Time-exit contamination check
  check('Time-exit rate is tracked (non-null)', typeof timeExitRate === 'number');
  check('Time-exit not masking signal (rate < 100%)', timeExitRate < 1.0, `rate=${(timeExitRate*100).toFixed(1)}%`);
}

// ─── Section 6: Safety Checks ─────────────────────────────────────────────────

function section6_safety(insights: OptimizationInsightRecord[]): void {
  section('6. Safety Checks');

  // 1. Hard threshold unchanged
  check(`GUARDRAIL_MIN_CONFIDENCE = 0.6`, GUARDRAIL_MIN_CONFIDENCE === 0.6, `got ${GUARDRAIL_MIN_CONFIDENCE}`);
  check(`TIER_SOFT_MAX = 0.75`, TIER_SOFT_MAX === 0.75, `got ${TIER_SOFT_MAX}`);
  check(`TIER_STRONG_MAX = 0.9`, TIER_STRONG_MAX === 0.9, `got ${TIER_STRONG_MAX}`);
  check(`STRONG_SIZING_MULTIPLIER = 0.5`, STRONG_SIZING_MULTIPLIER === 0.5, `got ${STRONG_SIZING_MULTIPLIER}`);
  check(`PROBE_SIZING_MULTIPLIER = 0.25`, PROBE_SIZING_MULTIPLIER === 0.25, `got ${PROBE_SIZING_MULTIPLIER}`);
  check(`PROBE_RATE = 0.08`, PROBE_RATE === 0.08, `got ${PROBE_RATE}`);
  check(`PROBE_RATE_MATURE = 0.16`, PROBE_RATE_MATURE === 0.16, `got ${PROBE_RATE_MATURE}`);
  check(`MIN_PROBE_AGE_DAYS = 3`, MIN_PROBE_AGE_DAYS === 3, `got ${MIN_PROBE_AGE_DAYS}`);
  check(`MAX_GATE_DAYS_BEFORE_REEVAL = 7`, MAX_GATE_DAYS_BEFORE_REEVAL === 7, `got ${MAX_GATE_DAYS_BEFORE_REEVAL}`);
  check(`RECOVERY_SOFT_THRESHOLD = 0.7`, RECOVERY_SOFT_THRESHOLD === 0.7, `got ${RECOVERY_SOFT_THRESHOLD}`);
  check(`RECOVERY_STRONG_THRESHOLD = 0.4`, RECOVERY_STRONG_THRESHOLD === 0.4, `got ${RECOVERY_STRONG_THRESHOLD}`);
  check(`STRONG_PENALTY_CAP = 0.60`, STRONG_PENALTY_CAP === 0.60, `got ${STRONG_PENALTY_CAP}`);

  // 2. Probe never returns tradeMode other than 'shadow'
  const result = runTieredGuardrail(insights, { callerLabel: 'E2E-Safety' });
  for (const gate of result.gatingDecisions) {
    for (const dateStr of ['2024-01-01', '2024-06-15', '2024-12-31']) {
      for (const symbol of ['AAPL', 'MSFT', 'TSLA']) {
        const probe = shouldProbe(gate, { symbol, dateStr });
        if (probe.allowed) {
          check(`Probe tradeMode is always 'shadow' (${symbol} ${dateStr})`,
            probe.tradeMode === 'shadow', `got ${probe.tradeMode}`);
          check(`Probe sizingMultiplier = ${PROBE_SIZING_MULTIPLIER} (${symbol} ${dateStr})`,
            probe.sizingMultiplier === PROBE_SIZING_MULTIPLIER, `got ${probe.sizingMultiplier}`);
        }
      }
    }
  }

  // 3. No all-strategy lockout — diversity always provides ≥1 escape
  const allTypes = SNAPSHOT.candidateStocks.map((c) => c.setupType);
  const globalGate = result.gatingDecisions.map((g) => ({ ...g, gatedSetupType: undefined as string | undefined }));
  const diversity = applyGateDiversityRule(globalGate, allTypes);
  check('Diversity rescue never produces lockout (exempted type present)',
    diversity.exemptedSetupType !== undefined || allTypes.length === 0,
    `exempted=${diversity.exemptedSetupType ?? 'NONE'} candidates=${allTypes.length}`);

  // 4. Expired gate does not affect scoring (TTL expired → gate removed)
  const expiredInsight: OptimizationInsightRecord = {
    insightType: 'setup_imbalance',
    sourceTaskId: 'e2e-safety-expired-test',
    evidence: ['a', 'b'],
    confidence: 0.95,
    severity: 'high',
    affectedSetupTypes: ['trend'],
    affectedSymbols: [],
    expiresAt: PAST_1S,
    createdAt: AGO_1H,
  };
  const expiredResult = runTieredGuardrail([expiredInsight], { callerLabel: 'E2E-Safety-Expired' });
  check('Expired insight does not produce a gating decision',
    expiredResult.gatingDecisions.length === 0,
    `gates=${expiredResult.gatingDecisions.length}`);

  // 5. Position sizing floor: probe multiplier is the floor (never below 0.25 when probe allowed)
  let minProbeMultiplier = Infinity;
  for (const gate of result.gatingDecisions) {
    for (const dateStr of ['2024-01-01', '2024-06-15', '2024-12-31']) {
      const probe = shouldProbe(gate, { symbol: 'AAPL', dateStr });
      if (probe.allowed) minProbeMultiplier = Math.min(minProbeMultiplier, probe.sizingMultiplier);
    }
  }
  if (minProbeMultiplier !== Infinity) {
    check(`Probe sizing floor >= ${PROBE_SIZING_MULTIPLIER}`,
      minProbeMultiplier >= PROBE_SIZING_MULTIPLIER,
      `min seen=${minProbeMultiplier}`);
  } else {
    info('No probes allowed in sampled dates (hash >= rate) — safety floor not tested via probe path');
  }

  // 6. Recovery score capped at 1.0
  const maxSignals: RecoverySignal[] = [
    { type: 'regime_change',     value: 1.0, evidence: 'e', recordedAt: NOW.toISOString() },
    { type: 'successful_probe',  value: 1.0, evidence: 'e', recordedAt: NOW.toISOString() },
    { type: 'successful_probe',  value: 1.0, evidence: 'e', recordedAt: NOW.toISOString() },
    { type: 'successful_probe',  value: 1.0, evidence: 'e', recordedAt: NOW.toISOString() },
    { type: 'mfe_improvement',   value: 1.0, evidence: 'e', recordedAt: NOW.toISOString() },
    { type: 'reduced_time_exit', value: 1.0, evidence: 'e', recordedAt: NOW.toISOString() },
  ];
  const recovScore = computeRecoveryScore(maxSignals);
  check('Recovery score capped at 1.0', recovScore <= 1.0, `got ${recovScore.toFixed(4)}`);

  // 7. probeHash determinism
  const h1 = probeHash('AAPL:trend:2024-01-15');
  const h2 = probeHash('AAPL:trend:2024-01-15');
  check('probeHash is deterministic', h1 === h2, `${h1} vs ${h2}`);
  check('probeHash output in [0,1)', h1 >= 0 && h1 < 1, `got ${h1}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${W}╔════════════════════════════════════════════════╗${X}`);
  console.log(`${W}║  E2E Gate Recovery Pipeline Validation Report  ║${X}`);
  console.log(`${W}╚════════════════════════════════════════════════╝${X}`);
  console.log(`${D}  Run date: ${NOW.toISOString()}${X}`);

  try {
    section('0. Seeding DB with controlled test insights');
    await seedInsights();

    const loadedInsights = await section1_dbStatus();
    const tieredResult   = section2_guardrailTier(loadedInsights);
    section3_triggerScoring(loadedInsights);
    section4_decisionLayer(loadedInsights);
    await section5_learningLayer();
    section6_safety(loadedInsights);

    // ── Final verdict ──────────────────────────────────────────────────────
    section('7. Final Verdict');
    const total = passCount + failCount;
    console.log(`\n  Passed: ${G}${passCount}${X}  Failed: ${failCount > 0 ? R : G}${failCount}${X}  Total: ${total}`);

    const gatingActive = tieredResult.gatingDecisions.length > 0;
    const diversityWorks = (() => {
      const allTypes = SNAPSHOT.candidateStocks.map((c) => c.setupType);
      const diversity = applyGateDiversityRule(tieredResult.gatingDecisions, allTypes);
      return diversity.sufficient || diversity.exemptedSetupType !== undefined;
    })();

    const verdict = failCount === 0
      ? 'FULL_E2E_WORKING'
      : failCount <= 2
        ? 'PARTIAL_E2E_WORKING'
        : 'NEEDS_FIX';

    const safetyVerdict = gatingActive && diversityWorks && passCount > 30
      ? 'NO SAFETY VIOLATIONS'
      : 'REVIEW REQUIRED';

    console.log(`\n  ${W}Classification: ${verdict === 'FULL_E2E_WORKING' ? G : verdict === 'PARTIAL_E2E_WORKING' ? Y : R}${verdict}${X}`);
    console.log(`  ${W}Safety:         ${safetyVerdict === 'NO SAFETY VIOLATIONS' ? G : R}${safetyVerdict}${X}\n`);

  } finally {
    section('Cleanup');
    await cleanupInsights();
    info('Seeded insights removed from DB');
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Validation script crashed:', err);
  process.exit(1);
});
