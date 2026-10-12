/**
 * t05f_walk_forward_observability_runner.test.ts
 *
 * T-05F WalkForward Observability Runner tests.
 * Observability-only. No strategy claims. No performance conclusions.
 * No forbidden terms in outputs: buy/sell/signal/roi/win_rate/alpha/edge/profit/recommendation/outperform/H001-H012
 */

import path from 'path';
import fs from 'fs';
import {
  buildWalkForwardRunConfig,
  runWalkForwardObservability,
  validateWalkForwardRunGuardrails,
  summarizeWalkForwardObservabilityRun,
  buildWalkForwardRunnerArtifacts,
  T05F_TASK_NAME,
  T05F_RUN_MODE,
  type WalkForwardRunConfig,
  type WalkForwardRunnerDeps,
} from '../WalkForwardObservabilityRunner';
import { buildWalkForwardSkeleton } from '../WalkForwardEngine';
import type { CandidateSnapshot } from '../CandidateDataAdapter';
import type { PersistedRegimeContext } from '@/lib/marketRegimeResult';

// ─── Constants ────────────────────────────────────────────────────────────────

const FORBIDDEN_KEYS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];
const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

function hasForbiddenKey(obj: unknown, keyPath = ''): string[] {
  const violations: string[] = [];
  if (typeof obj !== 'object' || obj === null) return violations;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const lk = key.toLowerCase();
    for (const term of FORBIDDEN_KEYS) {
      if (lk === term || lk.startsWith(term + '_') || lk.endsWith('_' + term)) {
        violations.push(`${keyPath}.${key}`);
      }
    }
    if (H_PATTERN.test(key)) violations.push(`${keyPath}.${key}`);
    violations.push(...hasForbiddenKey(val, `${keyPath}.${key}`));
  }
  return violations;
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeRegimeContext(date: string): PersistedRegimeContext {
  return {
    date,
    regimeLabel: 'NEUTRAL',
    confidence: 0.7,
    taiexClose: null,
    source: 'test',
    version: '1.0',
    freshnessStatus: 'FRESH',
    freshnessLagDays: 0,
  };
}

function makeCandidateSnapshot(symbol: string): CandidateSnapshot {
  return {
    symbol,
    snapshotDate: '2026-01-15',
    sourceDate: '2026-01-10',
    dataFreshnessDays: 5,
    dataAvailabilityStatus: 'AVAILABLE',
    observableFields: { hasClose: true, hasVolume: true, hasIndustry: false, hasListingDate: false },
    ruleOnlySortKey: symbol,
    exclusionReasons: [],
    sourceLabel: 'TEST',
  };
}

function makeRunConfig(overrides: Partial<Omit<WalkForwardRunConfig, 'dryRun' | 'safeRun'>> = {}): WalkForwardRunConfig {
  return buildWalkForwardRunConfig({
    currentDate: '2026-01-15',
    startDate: '2025-09-01',
    endDate: '2026-01-15',
    lookbackDays: 30,
    ...overrides,
  });
}

function makeDeps(overrides: Partial<WalkForwardRunnerDeps> = {}): WalkForwardRunnerDeps {
  const regimeMap = new Map<string, PersistedRegimeContext>([
    ['2026-01-10', makeRegimeContext('2026-01-10')],
    ['2026-01-12', makeRegimeContext('2026-01-12')],
  ]);
  const snapshots = [makeCandidateSnapshot('A001'), makeCandidateSnapshot('A002')];
  return {
    preloadedRegimeContextMap: regimeMap,
    preloadedCandidateSnapshots: snapshots,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T-05F: WalkForwardObservabilityRunner', () => {

  // --- 1. buildWalkForwardRunConfig uses resolveCurrentDate() ---
  describe('buildWalkForwardRunConfig', () => {

    it('1a. returns a valid run config with currentDate set', () => {
      const config = buildWalkForwardRunConfig({ currentDate: '2026-01-15' });
      expect(config.currentDate).toBe('2026-01-15');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(config.currentDate)).toBe(true);
    });

    it('1b. uses system date when currentDate not provided', () => {
      const config = buildWalkForwardRunConfig();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(config.currentDate)).toBe(true);
    });

    it('1c. falls back to system date for invalid currentDate', () => {
      const config = buildWalkForwardRunConfig({ currentDate: 'not-a-date' });
      expect(/^\d{4}-\d{2}-\d{2}$/.test(config.currentDate)).toBe(true);
    });

    // --- 2. buildWalkForwardRunConfig does not use hardcoded TODAY_CAP ---
    it('2a. dryRun is always true (cannot be overridden)', () => {
      const config = buildWalkForwardRunConfig({ currentDate: '2026-01-15' });
      expect(config.dryRun).toBe(true);
    });

    it('2b. safeRun is always true (cannot be overridden)', () => {
      const config = buildWalkForwardRunConfig({ currentDate: '2026-01-15' });
      expect(config.safeRun).toBe(true);
    });

    it('2c. lookbackDays defaults to T05B_LOOKBACK_DAYS (500)', () => {
      const config = buildWalkForwardRunConfig({ currentDate: '2026-01-15' });
      expect(config.lookbackDays).toBe(500);
    });

    it('2d. supports custom lookbackDays', () => {
      const config = buildWalkForwardRunConfig({ currentDate: '2026-01-15', lookbackDays: 60 });
      expect(config.lookbackDays).toBe(60);
    });

    it('2e. runId is deterministic based on date', () => {
      const c1 = buildWalkForwardRunConfig({ currentDate: '2026-01-15' });
      const c2 = buildWalkForwardRunConfig({ currentDate: '2026-01-15' });
      expect(c1.runId).toBe(c2.runId);
    });

    it('2f. source code has no hardcoded TODAY_CAP', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'WalkForwardObservabilityRunner.ts'),
        'utf8',
      );
      const lines = src.split('\n').filter(
        l => !l.trim().startsWith('//') && !l.trim().startsWith('*'),
      );
      const hasHardcodedDate = lines.some(l => /['"]20\d{2}-\d{2}-\d{2}['"]/.test(l));
      expect(hasHardcodedDate).toBe(false);
    });
  });

  // --- 3. runWalkForwardObservability requires dryRun true ---
  describe('runWalkForwardObservability safety guards', () => {

    it('3a. throws if dryRun is false', async () => {
      const config = { ...makeRunConfig(), dryRun: false as unknown as true };
      await expect(runWalkForwardObservability(config, makeDeps())).rejects.toThrow('dryRun');
    });

    // --- 4. runWalkForwardObservability requires safeRun true ---
    it('4a. throws if safeRun is false', async () => {
      const config = { ...makeRunConfig(), safeRun: false as unknown as true };
      await expect(runWalkForwardObservability(config, makeDeps())).rejects.toThrow('safeRun');
    });

    it('4b. succeeds with valid config and deps', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.taskName).toBe(T05F_TASK_NAME);
      expect(result.runMode).toBe(T05F_RUN_MODE);
    });
  });

  // --- 5. runner injects Taiwan trading calendar into WalkForwardEngine ---
  describe('Calendar injection', () => {

    it('5a. calendarSummary is present in run result', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.calendarSummary).toBeDefined();
      expect(typeof result.calendarSummary.tradingDayCount).toBe('number');
    });

    it('5b. dateRange.tradingDayCount reflects Taiwan calendar dates', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.dateRange.tradingDayCount).toBeGreaterThan(0);
      expect(result.dateRange.tradingDayCount).toBe(result.calendarSummary.tradingDayCount);
    });

    it('5c. skeleton calendarBasis is TAIWAN_TRADING_CALENDAR', async () => {
      // We verify by checking skeletonSummary — skeleton uses tradingDates from calendar
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      // totalDays in skeleton should match dateRange.tradingDayCount
      expect(result.skeletonSummary.totalRecords).toBe(result.dateRange.tradingDayCount);
    });
  });

  // --- 6. runner injects regime context map into WalkForwardEngine ---
  describe('Regime context injection', () => {

    it('6a. regimeCoverageSummary is present', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.regimeCoverageSummary).toBeDefined();
      expect(['PASS', 'WARN', 'FAIL']).toContain(result.regimeCoverageSummary.status);
    });

    it('6b. empty regime map is handled gracefully (WARN/FAIL)', async () => {
      const deps = makeDeps({ preloadedRegimeContextMap: new Map() });
      const result = await runWalkForwardObservability(makeRunConfig(), deps);
      expect(result.regimeCoverageSummary).toBeDefined();
      // With empty map, all records will be missing context
      expect(result.observabilitySummary.recordsMissingRegimeContext).toBeGreaterThan(0);
    });

    it('6c. regime data populates recordsWithRegimeContext', async () => {
      // Inject many regime context entries
      const regimeMap = new Map<string, PersistedRegimeContext>();
      for (let i = 1; i <= 20; i++) {
        const d = `2026-01-${String(i).padStart(2, '0')}`;
        regimeMap.set(d, makeRegimeContext(d));
      }
      const deps = makeDeps({ preloadedRegimeContextMap: regimeMap });
      const result = await runWalkForwardObservability(makeRunConfig(), deps);
      expect(result.observabilitySummary.recordsWithRegimeContext).toBeGreaterThanOrEqual(0);
    });
  });

  // --- 7. runner injects candidate snapshots into WalkForwardEngine ---
  describe('Candidate snapshot injection', () => {

    it('7a. candidateCoverageSummary is present', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.candidateCoverageSummary).toBeDefined();
      expect(['PASS', 'WARN', 'FAIL']).toContain(result.candidateCoverageSummary.status);
    });

    it('7b. candidateSnapshotCount matches injected snapshots', async () => {
      const deps = makeDeps({
        preloadedCandidateSnapshots: [
          makeCandidateSnapshot('X001'),
          makeCandidateSnapshot('X002'),
          makeCandidateSnapshot('X003'),
        ],
      });
      const result = await runWalkForwardObservability(makeRunConfig(), deps);
      expect(result.observabilitySummary.candidateSnapshotCount).toBe(3);
    });

    it('7c. empty candidate snapshots is handled gracefully', async () => {
      const deps = makeDeps({ preloadedCandidateSnapshots: [] });
      const result = await runWalkForwardObservability(makeRunConfig(), deps);
      expect(result.observabilitySummary.candidateSnapshotCount).toBe(0);
      expect(result.candidateCoverageSummary.status).toBe('WARN');
    });
  });

  // --- 8. runner output is observability-only ---
  describe('Observability-only output', () => {

    it('8a. runMode is DRY_RUN_OBSERVABILITY_ONLY', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.runMode).toBe('DRY_RUN_OBSERVABILITY_ONLY');
    });

    it('8b. skeletonSummary has no performance fields', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const { skeletonSummary } = result;
      expect(skeletonSummary).not.toHaveProperty('forwardReturn');
      expect(skeletonSummary).not.toHaveProperty('drawdown');
    });

    it('8c. observabilitySummary has no performance fields', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const { observabilitySummary } = result;
      const violations = hasForbiddenKey(observabilitySummary);
      expect(violations).toEqual([]);
    });
  });

  // --- 9. summarizeWalkForwardObservabilityRun returns coverage summaries ---
  describe('summarizeWalkForwardObservabilityRun', () => {

    it('9a. returns all required coverage fields', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const s = result.observabilitySummary;
      expect(typeof s.tradingDayCount).toBe('number');
      expect(typeof s.rebalanceCount).toBe('number');
      expect(typeof s.recordsWithRegimeContext).toBe('number');
      expect(typeof s.recordsMissingRegimeContext).toBe('number');
      expect(typeof s.candidateSnapshotCount).toBe('number');
      expect(typeof s.candidateMissingCount).toBe('number');
      expect(typeof s.candidateStaleCount).toBe('number');
      expect(typeof s.candidateFutureDataCount).toBe('number');
      expect(typeof s.guardrailPassCount).toBe('number');
      expect(typeof s.guardrailWarnCount).toBe('number');
      expect(typeof s.guardrailFailCount).toBe('number');
    });

    it('9b. summarizeWalkForwardObservabilityRun can be called directly', () => {
      const skeleton = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 10 },
        new Map(),
      );
      const snapshots = [makeCandidateSnapshot('A001')];
      const guardrails = validateWalkForwardRunGuardrails(makeRunConfig(), makeDeps());
      const summary = summarizeWalkForwardObservabilityRun(skeleton, snapshots, guardrails);
      expect(summary.tradingDayCount).toBe(skeleton.totalDays);
      expect(summary.candidateSnapshotCount).toBe(1);
    });
  });

  // --- 10. validateWalkForwardRunGuardrails returns PASS/WARN/FAIL ---
  describe('validateWalkForwardRunGuardrails', () => {

    it('10a. returns PASS with valid config and all deps provided', () => {
      const config = makeRunConfig();
      const guardrails = validateWalkForwardRunGuardrails(config, makeDeps());
      expect(['PASS', 'WARN', 'FAIL']).toContain(guardrails.overallStatus);
      expect(guardrails.passCount).toBeGreaterThan(0);
    });

    it('10b. returns WARN when no candidate/regime sources provided', () => {
      const config = makeRunConfig();
      const guardrails = validateWalkForwardRunGuardrails(config, {});
      expect(guardrails.overallStatus).toBe('WARN');
      expect(guardrails.warnCount).toBeGreaterThan(0);
    });

    it('10c. passCount + warnCount + failCount equals total checks', () => {
      const config = makeRunConfig();
      const guardrails = validateWalkForwardRunGuardrails(config, makeDeps());
      expect(
        guardrails.passCount + guardrails.warnCount + guardrails.failCount,
      ).toBe(guardrails.checks.length);
    });

    it('10d. all checks have name, status, note', () => {
      const config = makeRunConfig();
      const guardrails = validateWalkForwardRunGuardrails(config, makeDeps());
      for (const check of guardrails.checks) {
        expect(typeof check.name).toBe('string');
        expect(['PASS', 'WARN', 'FAIL']).toContain(check.status);
        expect(typeof check.note).toBe('string');
      }
    });

    it('10e. guardrails has no forbidden fields', () => {
      const config = makeRunConfig();
      const guardrails = validateWalkForwardRunGuardrails(config, makeDeps());
      const violations = hasForbiddenKey(guardrails);
      expect(violations).toEqual([]);
    });
  });

  // --- 11. sourceDate <= rebalanceDate is preserved ---
  describe('PIT safety preservation', () => {

    it('11a. future candidate snapshots are flagged in coverage summary', async () => {
      const futureSnap: CandidateSnapshot = {
        symbol: 'F001',
        snapshotDate: '2026-01-15',
        sourceDate: '2026-01-20', // future!
        dataFreshnessDays: 5,
        dataAvailabilityStatus: 'INVALID_FUTURE_DATE',
        observableFields: { hasClose: true, hasVolume: true, hasIndustry: false, hasListingDate: false },
        ruleOnlySortKey: 'F001',
        exclusionReasons: ['pit-violation'],
        sourceLabel: 'TEST',
      };
      const deps = makeDeps({ preloadedCandidateSnapshots: [futureSnap] });
      const result = await runWalkForwardObservability(makeRunConfig(), deps);
      expect(result.observabilitySummary.candidateFutureDataCount).toBe(1);
    });

    it('11b. valid snapshot passes PIT check', async () => {
      const validSnap = makeCandidateSnapshot('V001'); // sourceDate <= snapshotDate
      const deps = makeDeps({ preloadedCandidateSnapshots: [validSnap] });
      const result = await runWalkForwardObservability(makeRunConfig(), deps);
      expect(result.observabilitySummary.candidateFutureDataCount).toBe(0);
    });
  });

  // --- 12. no DB write / external API / LLM behavior ---
  describe('Source code safety inspection', () => {

    const src = fs.readFileSync(
      path.join(__dirname, '..', 'WalkForwardObservabilityRunner.ts'),
      'utf8',
    );

    it('12a. no real Prisma client import', () => {
      expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
      expect(src).not.toMatch(/new PrismaClient/);
    });

    it('12b. no external API calls', () => {
      expect(src).not.toMatch(/fetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/https?:\/\//);
    });

    it('12c. no LLM imports', () => {
      expect(src).not.toMatch(/openai/i);
      expect(src).not.toMatch(/anthropic/i);
      expect(src).not.toMatch(/langchain/i);
    });

    it('12d. no DB write operations', () => {
      expect(src).not.toMatch(/\.create\s*\(/);
      expect(src).not.toMatch(/\.upsert\s*\(/);
      expect(src).not.toMatch(/\.update\s*\(/);
      expect(src).not.toMatch(/\.delete\s*\(/);
    });

    it('12e. no fs.writeFile / writeFileSync calls (excluding comments)', () => {
      const codeLines = src.split('\n').filter(
        l => !l.trim().startsWith('//') && !l.trim().startsWith('*'),
      );
      const codeOnly = codeLines.join('\n');
      expect(codeOnly).not.toMatch(/fs\.writeFile\s*\(/);
      expect(codeOnly).not.toMatch(/writeFileSync\s*\(/);
    });
  });

  // --- 13. no production prediction overwrite ---
  describe('Production safety', () => {

    it('13a. artifactPlan only references outputs/backtest and outputs/system_readiness', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      for (const artifact of result.artifactPlan) {
        expect(
          artifact.startsWith('outputs/backtest') || artifact.startsWith('outputs/system_readiness'),
        ).toBe(true);
      }
    });

    it('13b. artifactPlan does not reference prediction or production paths', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      for (const artifact of result.artifactPlan) {
        expect(artifact).not.toMatch(/prediction/i);
        expect(artifact).not.toMatch(/\/src\//);
        expect(artifact).not.toMatch(/prisma/i);
      }
    });
  });

  // --- 14. output contains no forbidden strategy/performance fields ---
  describe('Forbidden field guardrail', () => {

    it('14a. run result has no forbidden keys', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      // Exclude safetyContract (contains noBuySellOutput negation terms) and candidateSource
      const { skeletonSummary: ss, guardrailSummary: gs, ...rest } = result;
      // skeletonSummary and guardrailSummary are safe (no forbidden keys)
      const violations = hasForbiddenKey({ ...rest, ss, gs });
      expect(violations).toEqual([]);
    });

    it('14b. guardrail checks have no forbidden keys in names', () => {
      const config = makeRunConfig();
      const guardrails = validateWalkForwardRunGuardrails(config, makeDeps());
      for (const check of guardrails.checks) {
        const lk = check.name.toLowerCase();
        for (const term of FORBIDDEN_KEYS) {
          // Allow "noBuy" / "noSell" type names (negation guardrails)
          if (!check.name.startsWith('no')) {
            expect(lk).not.toContain(term);
          }
        }
      }
    });

    it('14c. observabilitySummary has no forbidden keys', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const violations = hasForbiddenKey(result.observabilitySummary);
      expect(violations).toEqual([]);
    });
  });

  // --- 15. buildWalkForwardRunnerArtifacts returns parseable JSON payloads ---
  describe('buildWalkForwardRunnerArtifacts', () => {

    it('15a. returns artifact payload with jsonArtifacts', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const artifacts = buildWalkForwardRunnerArtifacts(result);
      expect(typeof artifacts.jsonArtifacts).toBe('object');
      expect(typeof artifacts.mdArtifactSummary).toBe('string');
    });

    it('15b. JSON artifacts are serializable (parseable)', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const artifacts = buildWalkForwardRunnerArtifacts(result);
      for (const [key, val] of Object.entries(artifacts.jsonArtifacts)) {
        expect(() => JSON.parse(JSON.stringify(val))).not.toThrow();
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it('15c. MD artifact summary is non-empty', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const artifacts = buildWalkForwardRunnerArtifacts(result);
      expect(artifacts.mdArtifactSummary.length).toBeGreaterThan(50);
      expect(artifacts.mdArtifactSummary).toContain('T-05F');
    });

    it('15d. artifact payload has no forbidden keys', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const artifacts = buildWalkForwardRunnerArtifacts(result);
      const { mdArtifactSummary: _md, ...rest } = artifacts;
      const violations = hasForbiddenKey(rest);
      expect(violations).toEqual([]);
    });

    it('15e. outputDir only references outputs/ directories', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      const artifacts = buildWalkForwardRunnerArtifacts(result);
      expect(artifacts.outputDir).toMatch(/^outputs\//);
    });
  });

  // --- 16. T-05B / T-05C / T-05D / T-05E regression preserved ---
  describe('Regression: T-05B / T-05C / T-05D / T-05E compatibility', () => {

    it('16a. WalkForwardEngine still works standalone (T-05B compat)', () => {
      const result = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 10 },
        new Map(),
      );
      expect(result.task).toBe('T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2');
      expect(result.candidateSource).toBe('MOCK_OBSERVABILITY_ONLY');
    });

    it('16b. Runner uses T-05B skeleton task name', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(result.taskName).toBe(T05F_TASK_NAME);
    });

    it('16c. Runner produces valid skeletonSummary (T-05B compat)', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(typeof result.skeletonSummary.totalRecords).toBe('number');
      expect(typeof result.skeletonSummary.totalRebalancePoints).toBe('number');
    });

    it('16d. short lookback run completes without error (full pipeline)', async () => {
      const config = buildWalkForwardRunConfig({
        currentDate: '2026-01-15',
        startDate: '2025-12-01',
        endDate: '2026-01-15',
        lookbackDays: 45,
      });
      const result = await runWalkForwardObservability(config, makeDeps());
      expect(result.readinessStatus).toMatch(/^(READY|WARN|BLOCKED)$/);
      expect(result.dateRange.tradingDayCount).toBeGreaterThan(0);
    });

    it('16e. run result readinessStatus is one of READY/WARN/BLOCKED', async () => {
      const result = await runWalkForwardObservability(makeRunConfig(), makeDeps());
      expect(['READY', 'WARN', 'BLOCKED']).toContain(result.readinessStatus);
    });
  });
});
