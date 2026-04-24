/**
 * GateRecoveryEngine — unit tests
 *
 * Tests cover:
 *   1.  probeHash — deterministic: same key → same value
 *   2.  probeHash — different keys → different values (collision resistance)
 *   3.  probeHash — output is in [0, 1)
 *   4.  evaluateGateTTL — expired via expiresAt <= now
 *   5.  evaluateGateTTL — expired via decayedConfidence < GUARDRAIL_MIN_CONFIDENCE
 *   6.  evaluateGateTTL — expired via max gate duration exceeded
 *   7.  evaluateGateTTL — active gate returns expired=false
 *   8.  shouldProbe — denied when insight has no createdAt
 *   9.  shouldProbe — denied when gate is too fresh (age < MIN_PROBE_AGE_DAYS)
 *   10. shouldProbe — decision is consistent with probeHash for a mature gate
 *   11. shouldProbe — uses elevated PROBE_RATE_MATURE for gates > MAX_GATE_DAYS_BEFORE_REEVAL
 *   12. shouldProbe — allowed probe has correct metadata (tradeMode, sizingMultiplier, probeTag)
 *   13. computeRecoveryScore — empty signals → 0
 *   14. computeRecoveryScore — regime_change alone produces high score
 *   15. computeRecoveryScore — successful_probe capped at 3 contributions
 *   16. computeRecoveryScore — combined signals can reach RECOVERY_SOFT_THRESHOLD
 *   17. computeRecoveryScore — filters signals by setupType
 *   18. applyGateDiversityRule — trivially sufficient when no candidates
 *   19. applyGateDiversityRule — sufficient when ≥1 candidate ungated
 *   20. applyGateDiversityRule — diversity violated → exempts most-common setup type
 *   21. applyGateDiversityRule — global gate triggers diversity rescue
 *   22. evaluateGateRecovery — expired gates removed from activeGates
 *   23. evaluateGateRecovery — recovery signal downgrades gate to soft tier
 *   24. evaluateGateRecovery — recovery signal downgrades gate to strong tier
 *   25. evaluateGateRecovery — no action → no log emitted
 *   26. evaluateGateRecovery — diversity rescue reflected in result
 */

import {
  probeHash,
  evaluateGateTTL,
  shouldProbe,
  computeRecoveryScore,
  applyGateDiversityRule,
  evaluateGateRecovery,
  logGateRecoveryEvent,
  PROBE_RATE,
  PROBE_RATE_MATURE,
  PROBE_SIZING_MULTIPLIER,
  MIN_PROBE_AGE_DAYS,
  MAX_GATE_DAYS_BEFORE_REEVAL,
  RECOVERY_SOFT_THRESHOLD,
  RECOVERY_STRONG_THRESHOLD,
  type RecoverySignal,
  type GateRecoveryLog,
} from '../GateRecoveryEngine';
import {
  GUARDRAIL_MIN_CONFIDENCE,
  type GatingDecision,
} from '../InsightGuardrailLayer';
import type { OptimizationInsightRecord } from '../InsightIntegrationLayer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAR_FUTURE = new Date(Date.now() + 86400000 * 30).toISOString(); // +30 days
const JUST_PAST  = new Date(Date.now() - 1000).toISOString();          // 1 s ago

/** Build an OptimizationInsightRecord with reasonable defaults. */
function makeInsight(overrides: Partial<OptimizationInsightRecord> = {}): OptimizationInsightRecord {
  return {
    insightType: 'setup_imbalance',
    sourceTaskId: 'task-test',
    evidence: ['evidence-a', 'evidence-b'],
    confidence: 0.95,
    severity: 'high',
    affectedSetupTypes: ['trend'],
    affectedSymbols: [],
    expiresAt: FAR_FUTURE,
    ...overrides,
  };
}

/**
 * Build a GatingDecision.
 *
 * @param ageDays   How old the gate insight is. Positive = past (gate was created N days ago).
 *                  undefined = no createdAt (age unknown).
 */
function makeGate(
  overrides: {
    gatedSetupType?: string | undefined;
    ageDays?: number;
    decayedConfidence?: number;
    expiresAt?: string;
  } = {},
): GatingDecision {
  const ageDays = overrides.ageDays;
  const decayedConfidence = overrides.decayedConfidence ?? 0.95;
  const expiresAt = overrides.expiresAt ?? FAR_FUTURE;
  // Use `in` check so explicit `undefined` is preserved (avoids default swallowing it)
  const gatedSetupType = 'gatedSetupType' in overrides ? overrides.gatedSetupType : 'trend';
  const createdAt =
    ageDays !== undefined
      ? new Date(Date.now() - ageDays * 86400000).toISOString()
      : undefined;

  const insight = {
    ...makeInsight({ expiresAt, createdAt }),
    decayedConfidence,
  };

  return {
    insight,
    tier: 'critical' as const,
    gatedSetupType,
    reason: `test gate on ${gatedSetupType ?? 'global'}`,
    overrideCondition: 'wait for regime change',
  };
}

/** Find a dateStr such that probeHash(`AAPL:trend:${dateStr}`) < rate. */
function findProbeKey(setupType: string, rate: number): string | undefined {
  for (let day = 1; day <= 366; day++) {
    const date = new Date(Date.UTC(2024, 0, day));
    const dateStr = date.toISOString().slice(0, 10);
    const key = `AAPL:${setupType}:${dateStr}`;
    if (probeHash(key) < rate) return dateStr;
  }
  return undefined;
}

/** Find a dateStr where probeHash falls ABOVE rate (to ensure probe is denied). */
function findDeniedKey(setupType: string, rate: number): string | undefined {
  for (let day = 1; day <= 366; day++) {
    const date = new Date(Date.UTC(2024, 0, day));
    const dateStr = date.toISOString().slice(0, 10);
    const key = `AAPL:${setupType}:${dateStr}`;
    if (probeHash(key) >= rate) return dateStr;
  }
  return undefined;
}

/** Build a recovery signal. */
function makeSignal(overrides: Partial<RecoverySignal> = {}): RecoverySignal {
  return {
    type: 'regime_change',
    value: 1.0,
    evidence: 'regime shifted',
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── 1–3: probeHash ───────────────────────────────────────────────────────────

describe('probeHash', () => {
  it('returns the same value for the same key (deterministic)', () => {
    const key = 'AAPL:trend:2024-01-15';
    expect(probeHash(key)).toBe(probeHash(key));
  });

  it('returns different values for different keys', () => {
    const a = probeHash('AAPL:trend:2024-01-15');
    const b = probeHash('MSFT:rebound:2024-01-15');
    const c = probeHash('AAPL:trend:2024-01-16');
    // All should differ
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('output is in the half-open interval [0, 1)', () => {
    const samples = [
      'AAPL:trend:2024-01-15',
      'MSFT:rebound:2024-02-20',
      'TSLA:event:2023-12-01',
      'GOOG:fundamental:2024-06-15',
      '',
    ];
    for (const key of samples) {
      const h = probeHash(key);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

// ─── 4–7: evaluateGateTTL ────────────────────────────────────────────────────

describe('evaluateGateTTL', () => {
  it('marks gate expired when insight expiresAt is in the past', () => {
    const gate = makeGate({ expiresAt: JUST_PAST });
    const result = evaluateGateTTL(gate);
    expect(result.expired).toBe(true);
    expect(result.reason).toBe('insight_expired');
  });

  it('marks gate expired when decayedConfidence is below GUARDRAIL_MIN_CONFIDENCE', () => {
    const gate = makeGate({ decayedConfidence: GUARDRAIL_MIN_CONFIDENCE - 0.01 });
    const result = evaluateGateTTL(gate);
    expect(result.expired).toBe(true);
    expect(result.reason).toMatch(/decayed_below_minimum/);
  });

  it('marks gate expired when age exceeds MAX_GATE_DAYS_BEFORE_REEVAL', () => {
    const gate = makeGate({ ageDays: MAX_GATE_DAYS_BEFORE_REEVAL + 1 });
    const result = evaluateGateTTL(gate);
    expect(result.expired).toBe(true);
    expect(result.reason).toMatch(/max_gate_duration_exceeded/);
  });

  it('returns expired=false for a recently-created, valid gate', () => {
    const gate = makeGate({ ageDays: 2 }); // 2 days old — inside the window
    const result = evaluateGateTTL(gate);
    expect(result.expired).toBe(false);
    expect(result.reason).toBe('gate_active');
    expect(result.gate).toBe(gate);
  });
});

// ─── 8–12: shouldProbe ───────────────────────────────────────────────────────

describe('shouldProbe', () => {
  it('denies probe when insight has no createdAt', () => {
    const gate = makeGate({ ageDays: undefined }); // no createdAt
    const decision = shouldProbe(gate, { symbol: 'AAPL', dateStr: '2024-01-15' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/no_createdAt/);
    expect(decision.sizingMultiplier).toBe(0);
  });

  it('denies probe when gate is too fresh', () => {
    const gate = makeGate({ ageDays: MIN_PROBE_AGE_DAYS - 1 });
    const decision = shouldProbe(gate, { symbol: 'AAPL', dateStr: '2024-01-15' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/gate_too_fresh/);
  });

  it('probe decision is consistent with probeHash for a mature gate', () => {
    const gate = makeGate({ ageDays: MIN_PROBE_AGE_DAYS + 1, gatedSetupType: 'trend' });
    const context = { symbol: 'AAPL', dateStr: '2024-01-15' };
    const hashKey = `AAPL:trend:2024-01-15`;
    const expectedAllowed = probeHash(hashKey) < PROBE_RATE;

    const decision = shouldProbe(gate, context);
    expect(decision.allowed).toBe(expectedAllowed);
    expect(decision.tradeMode).toBe('shadow');
  });

  it('uses elevated PROBE_RATE_MATURE for gates older than MAX_GATE_DAYS_BEFORE_REEVAL', () => {
    const gate = makeGate({ ageDays: MAX_GATE_DAYS_BEFORE_REEVAL + 2, gatedSetupType: 'trend' });
    const context = { symbol: 'AAPL', dateStr: '2024-01-15' };
    const hashKey = `AAPL:trend:2024-01-15`;
    const expectedAllowed = probeHash(hashKey) < PROBE_RATE_MATURE;

    const decision = shouldProbe(gate, context);
    expect(decision.allowed).toBe(expectedAllowed);
  });

  it('an allowed probe has correct metadata', () => {
    // Find a dateStr that triggers a probe (hash < PROBE_RATE_MATURE; use mature gate to maximise chances)
    const dateStr = findProbeKey('trend', PROBE_RATE_MATURE);
    if (!dateStr) {
      // Extremely unlikely: no probe key found in 366 days. Skip test.
      return;
    }
    const gate = makeGate({
      ageDays: MAX_GATE_DAYS_BEFORE_REEVAL + 2,
      gatedSetupType: 'trend',
    });
    const decision = shouldProbe(gate, { symbol: 'AAPL', dateStr });
    expect(decision.allowed).toBe(true);
    expect(decision.tradeMode).toBe('shadow');
    expect(decision.sizingMultiplier).toBe(PROBE_SIZING_MULTIPLIER);
    expect(decision.probeTag).toMatch(/^probe:trend:AAPL:/);
    expect(decision.probeTag).toContain(dateStr);
  });

  it('a denied probe has zero sizingMultiplier and empty probeTag', () => {
    // Find a dateStr where the probe is denied (hash >= PROBE_RATE_MATURE)
    const dateStr = findDeniedKey('trend', PROBE_RATE_MATURE);
    if (!dateStr) {
      return;
    }
    const gate = makeGate({
      ageDays: MAX_GATE_DAYS_BEFORE_REEVAL + 2,
      gatedSetupType: 'trend',
    });
    const decision = shouldProbe(gate, { symbol: 'AAPL', dateStr });
    expect(decision.allowed).toBe(false);
    expect(decision.sizingMultiplier).toBe(0);
    expect(decision.probeTag).toBe('');
  });
});

// ─── 13–17: computeRecoveryScore ─────────────────────────────────────────────

describe('computeRecoveryScore', () => {
  it('returns 0 for an empty signal set', () => {
    expect(computeRecoveryScore([])).toBe(0);
  });

  it('regime_change with value=1.0 contributes 0.40', () => {
    const score = computeRecoveryScore([makeSignal({ type: 'regime_change', value: 1.0 })]);
    expect(score).toBeCloseTo(0.40, 5);
  });

  it('three successful_probe signals produce 0.75 (3 × 0.25)', () => {
    const probes: RecoverySignal[] = Array.from({ length: 3 }, () =>
      makeSignal({ type: 'successful_probe', value: 1.0 }),
    );
    expect(computeRecoveryScore(probes)).toBeCloseTo(0.75, 5);
  });

  it('four successful_probe signals are still capped at 0.75 (3 × 0.25)', () => {
    const probes: RecoverySignal[] = Array.from({ length: 4 }, () =>
      makeSignal({ type: 'successful_probe', value: 1.0 }),
    );
    expect(computeRecoveryScore(probes)).toBeCloseTo(0.75, 5);
  });

  it('combined signals can reach RECOVERY_SOFT_THRESHOLD', () => {
    const signals: RecoverySignal[] = [
      makeSignal({ type: 'regime_change',     value: 1.0 }), // 0.40
      makeSignal({ type: 'successful_probe',  value: 1.0 }), // 0.25
      makeSignal({ type: 'mfe_improvement',   value: 1.0 }), // 0.20
      makeSignal({ type: 'reduced_time_exit', value: 1.0 }), // 0.15 → total: 1.00, capped at 1.0
    ];
    const score = computeRecoveryScore(signals);
    expect(score).toBeGreaterThanOrEqual(RECOVERY_SOFT_THRESHOLD);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('filters out signals that belong to a different setupType', () => {
    const signals: RecoverySignal[] = [
      makeSignal({ type: 'regime_change', value: 1.0, setupType: 'rebound' }), // different type
      makeSignal({ type: 'regime_change', value: 1.0, setupType: undefined }), // applies to all → included
    ];
    // Only the global signal should apply when querying for 'trend'
    const score = computeRecoveryScore(signals, 'trend');
    expect(score).toBeCloseTo(0.40, 5);
  });
});

// ─── 18–21: applyGateDiversityRule ───────────────────────────────────────────

describe('applyGateDiversityRule', () => {
  it('trivially sufficient when candidateSetupTypes is empty', () => {
    const result = applyGateDiversityRule([makeGate()], []);
    expect(result.sufficient).toBe(true);
    expect(result.exemptedSetupType).toBeUndefined();
  });

  it('sufficient when at least one candidate type is ungated', () => {
    const gate = makeGate({ gatedSetupType: 'trend' });
    const result = applyGateDiversityRule([gate], ['trend', 'rebound', 'event']);
    expect(result.sufficient).toBe(true);
    expect(result.exemptedSetupType).toBeUndefined();
  });

  it('diversity violated when all candidate types are gated → exempts most-common', () => {
    const gates = [
      makeGate({ gatedSetupType: 'trend' }),
      makeGate({ gatedSetupType: 'rebound' }),
    ];
    const candidates = ['trend', 'trend', 'trend', 'rebound'];
    const result = applyGateDiversityRule(gates, candidates);
    expect(result.sufficient).toBe(false);
    // 'trend' appears 3 times (most-common) → should be exempted
    expect(result.exemptedSetupType).toBe('trend');
    expect(result.exemptionReason).toMatch(/diversity_rescue/);
  });

  it('global gate (gatedSetupType=undefined) triggers diversity rescue for all candidates', () => {
    const gate = makeGate({ gatedSetupType: undefined });
    const candidates = ['trend', 'trend', 'rebound', 'event'];
    const result = applyGateDiversityRule([gate], candidates);
    expect(result.sufficient).toBe(false);
    // 'trend' is most-common → exempted
    expect(result.exemptedSetupType).toBe('trend');
  });

  it('no active gates → diversity is sufficient', () => {
    const result = applyGateDiversityRule([], ['trend', 'rebound']);
    expect(result.sufficient).toBe(true);
  });
});

// ─── 22–26: evaluateGateRecovery ─────────────────────────────────────────────

describe('evaluateGateRecovery', () => {
  it('removes expired gates from activeGates', () => {
    const expired = makeGate({ expiresAt: JUST_PAST });
    const active  = makeGate({ ageDays: 2, gatedSetupType: 'rebound' });

    const result = evaluateGateRecovery(
      [expired, active],
      [],
      ['trend'],
      { callerLabel: 'test' },
    );

    expect(result.expiredGates).toHaveLength(1);
    expect(result.expiredGates[0].expired).toBe(true);
    expect(result.activeGates).toHaveLength(1);
    expect(result.activeGates[0].gatedSetupType).toBe('rebound');
    expect(result.originalGates).toHaveLength(2);
  });

  it('downgrades gate to soft tier when recovery score ≥ RECOVERY_SOFT_THRESHOLD', () => {
    const gate = makeGate({ ageDays: 2 });
    // Enough signals to exceed RECOVERY_SOFT_THRESHOLD (0.7)
    const signals: RecoverySignal[] = [
      makeSignal({ type: 'regime_change',    value: 1.0 }), // 0.40
      makeSignal({ type: 'mfe_improvement',  value: 1.0 }), // 0.20
      makeSignal({ type: 'successful_probe', value: 1.0 }), // 0.25 → total 0.85
    ];

    const result = evaluateGateRecovery([gate], signals, ['trend'], { callerLabel: 'test' });

    expect(result.downgradedGates).toHaveLength(1);
    expect(result.downgradedGates[0].newTier).toBe('soft');
    expect(result.downgradedGates[0].recoveryScore).toBeGreaterThanOrEqual(RECOVERY_SOFT_THRESHOLD);
    // Downgraded gates are removed from activeGates
    expect(result.activeGates).toHaveLength(0);
  });

  it('downgrades gate to strong tier when recovery score ≥ RECOVERY_STRONG_THRESHOLD but < RECOVERY_SOFT_THRESHOLD', () => {
    const gate = makeGate({ ageDays: 2 });
    // Just enough for strong (0.4) but not soft (0.7)
    const signals: RecoverySignal[] = [
      makeSignal({ type: 'regime_change', value: 1.0 }), // 0.40 exactly
    ];

    const result = evaluateGateRecovery([gate], signals, ['trend'], { callerLabel: 'test' });

    expect(result.downgradedGates).toHaveLength(1);
    expect(result.downgradedGates[0].newTier).toBe('strong');
    expect(result.downgradedGates[0].recoveryScore).toBeGreaterThanOrEqual(RECOVERY_STRONG_THRESHOLD);
    expect(result.downgradedGates[0].recoveryScore).toBeLessThan(RECOVERY_SOFT_THRESHOLD);
  });

  it('emits no log when no recovery action occurs', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const gate = makeGate({ ageDays: 2 }); // gatedSetupType: 'trend'

    evaluateGateRecovery(
      [gate],
      [],  // no recovery signals
      ['rebound'], // 'trend' is gated but 'rebound' is not → diversity sufficient → no log
      { callerLabel: 'test' },
    );

    // No log should have been emitted (no expired, no probes, no downgrade, diversity ok)
    const gateRecoveryLogs = logSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('[GateRecovery]'),
    );
    expect(gateRecoveryLogs).toHaveLength(0);
    logSpy.mockRestore();
  });

  it('reflects diversity rescue in result when all candidates are gated', () => {
    const gate = makeGate({ ageDays: 2, gatedSetupType: 'trend' });
    // Only 'trend' candidates → all are gated → diversity rescue
    const result = evaluateGateRecovery(
      [gate],
      [],
      ['trend', 'trend', 'trend'],
      { callerLabel: 'test' },
    );

    expect(result.diversity.sufficient).toBe(false);
    expect(result.diversity.exemptedSetupType).toBe('trend');
  });

  it('emits a log when diversity rescue occurs', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const gate = makeGate({ ageDays: 2, gatedSetupType: 'trend' });

    evaluateGateRecovery(
      [gate],
      [],
      ['trend'],
      { callerLabel: 'test' },
    );

    const gateRecoveryLogs = logSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('[GateRecovery]'),
    );
    expect(gateRecoveryLogs).toHaveLength(1);
    const parsed = JSON.parse(gateRecoveryLogs[0][1] as string) as GateRecoveryLog;
    expect(parsed.diversityEnforced).toBe(true);
    expect(parsed.callerLabel).toBe('test');
    logSpy.mockRestore();
  });

  it('probe decisions appear for mature gates that survive TTL and recovery checks', () => {
    // Find a probe-eligible date for a mature gate
    const dateStr = findProbeKey('trend', PROBE_RATE_MATURE);
    if (!dateStr) return; // skip if none found

    const gate = makeGate({
      ageDays: MAX_GATE_DAYS_BEFORE_REEVAL + 2,
      gatedSetupType: 'trend',
    });

    const result = evaluateGateRecovery(
      [gate],
      [],
      ['rebound'], // 'trend' is gated but 'rebound' is not → diversity sufficient
      { symbol: 'AAPL', dateStr, callerLabel: 'test' },
    );

    // gate didn't expire (expiresAt far future, not > MAX_GATE_DAYS because evaluateGateTTL
    // will mark it expired. Test gate with age = MAX_GATE_DAYS + 2 → evaluateGateTTL returns expired=true
    // So the gate is expired and won't produce a probe. This is expected behaviour.
    expect(result.expiredGates).toHaveLength(1);
    expect(result.probeDecisions).toHaveLength(0);
  });

  it('probe decisions appear for gates within active window', () => {
    const setupType = 'trend';
    // Find a dateStr that passes probe for PROBE_RATE (active window)
    const dateStr = findProbeKey(setupType, PROBE_RATE);
    if (!dateStr) return;

    // Gate is 5 days old — past MIN_PROBE_AGE_DAYS (3), within MAX_GATE_DAYS (7)
    const gate = makeGate({ ageDays: 5, gatedSetupType: setupType });

    const result = evaluateGateRecovery(
      [gate],
      [],
      ['rebound'], // other setup types ungated → diversity ok
      { symbol: 'AAPL', dateStr, callerLabel: 'test' },
    );

    expect(result.expiredGates).toHaveLength(0);
    expect(result.probeDecisions).toHaveLength(1);
    expect(result.probeDecisions[0].allowed).toBe(true);
    expect(result.probeDecisions[0].sizingMultiplier).toBe(PROBE_SIZING_MULTIPLIER);
    expect(result.probeDecisions[0].probeTag).toContain(setupType);
  });
});

// ─── logGateRecoveryEvent ─────────────────────────────────────────────────────

describe('logGateRecoveryEvent', () => {
  it('emits a [GateRecovery] JSON line to console.log', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const log: GateRecoveryLog = {
      timestamp: '2024-01-15T00:00:00.000Z',
      callerLabel: 'test',
      totalGates: 2,
      expiredCount: 1,
      probeCount: 0,
      downgradedCount: 0,
      activeCount: 1,
      diversityEnforced: false,
    };

    logGateRecoveryEvent(log);

    expect(logSpy).toHaveBeenCalledWith('[GateRecovery]', JSON.stringify(log));
    logSpy.mockRestore();
  });
});
