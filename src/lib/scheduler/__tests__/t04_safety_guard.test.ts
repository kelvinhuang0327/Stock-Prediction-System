/**
 * T-04 SafetyGuard tests — LLM Hard-Off / Safe-Run / Missing-TaskId Alert
 *
 * Tests: validateTaskId(), evaluateSafetyMode(), assertLlmAllowed()
 * No H001-H012. No strategy validation. No external calls.
 */

import {
  validateTaskId,
  evaluateSafetyMode,
  assertLlmAllowed,
  SafetyDecision,
} from '../SafetyGuard';

// ─── validateTaskId ───────────────────────────────────────────────────────────

describe('validateTaskId()', () => {
  it('1. taskId exists → NONE', () => {
    const alert = validateTaskId({ taskId: 'task-abc-123', dryRun: false, mayMutateState: false, mayCallExternalAi: false });
    expect(alert.level).toBe('NONE');
    expect(alert.requiresAction).toBe(false);
    expect(alert.message).toBeNull();
  });

  it('2. missing taskId + dryRun true + no mutation → WARNING', () => {
    const alert = validateTaskId({ taskId: null, dryRun: true, mayMutateState: false, mayCallExternalAi: false });
    expect(alert.level).toBe('WARNING');
    expect(alert.requiresAction).toBe(true);
    expect(alert.message).toBeTruthy();
  });

  it('3. missing taskId + mayMutateState true → CRITICAL', () => {
    const alert = validateTaskId({ taskId: null, dryRun: false, mayMutateState: true, mayCallExternalAi: false });
    expect(alert.level).toBe('CRITICAL');
    expect(alert.requiresAction).toBe(true);
  });

  it('4. missing taskId + mayCallExternalAi true → CRITICAL', () => {
    const alert = validateTaskId({ taskId: undefined, dryRun: false, mayMutateState: false, mayCallExternalAi: true });
    expect(alert.level).toBe('CRITICAL');
    expect(alert.requiresAction).toBe(true);
  });

  it('empty string taskId treated as missing → WARNING for dry-run', () => {
    const alert = validateTaskId({ taskId: '   ', dryRun: true, mayMutateState: false, mayCallExternalAi: false });
    expect(alert.level).toBe('WARNING');
  });

  it('empty string + mutating → CRITICAL', () => {
    const alert = validateTaskId({ taskId: '', dryRun: false, mayMutateState: true, mayCallExternalAi: false });
    expect(alert.level).toBe('CRITICAL');
  });
});

// ─── evaluateSafetyMode ──────────────────────────────────────────────────────

describe('evaluateSafetyMode()', () => {
  const NORMAL_BASE = {
    dryRun: false,
    mayMutateState: false,
    mayCallExternalAi: false,
    taskId: 'task-123',
  };

  it('5. all clear → mode NORMAL, llmHardOff false', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, opsReportStatus: 'PASS', opsGuardrailOk: true });
    expect(d.mode).toBe('NORMAL');
    expect(d.llmHardOff).toBe(false);
    expect(d.allowExternalAi).toBe(true);
    expect(d.allowDbWrite).toBe(true);
    expect(d.source).toBe('T04_SAFETY_GUARD');
    expect(d.taskIdAlert.level).toBe('NONE');
  });

  it('6. safeRun true → mode SAFE_RUN, llmHardOff true', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, safeRun: true });
    expect(d.mode).toBe('SAFE_RUN');
    expect(d.llmHardOff).toBe(true);
    expect(d.allowExternalAi).toBe(false);
    expect(d.reasons.some(r => r.includes('SAFE_RUN'))).toBe(true);
  });

  it('7. llmHardOffEnv true → mode LLM_HARD_OFF, llmHardOff true', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, llmHardOffEnv: true });
    expect(d.mode).toBe('LLM_HARD_OFF');
    expect(d.llmHardOff).toBe(true);
    expect(d.allowExternalAi).toBe(false);
  });

  it('8. ops status not PASS → DEGRADED, llmHardOff true', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, opsReportStatus: 'STALE_DATA' });
    expect(['DEGRADED', 'SAFE_RUN', 'BLOCKED'].includes(d.mode)).toBe(true);
    expect(d.llmHardOff).toBe(true);
    expect(d.allowExternalAi).toBe(false);
  });

  it('9. ops guardrail false → BLOCKED, llmHardOff true', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, opsReportStatus: 'PASS', opsGuardrailOk: false });
    expect(d.mode).toBe('BLOCKED');
    expect(d.llmHardOff).toBe(true);
    expect(d.allowExternalAi).toBe(false);
  });

  it('10. CRITICAL taskId alert → BLOCKED, llmHardOff true', () => {
    const d = evaluateSafetyMode({
      ...NORMAL_BASE,
      taskId: null,
      mayMutateState: true,
      opsReportStatus: 'PASS',
      opsGuardrailOk: true,
    });
    expect(d.mode).toBe('BLOCKED');
    expect(d.llmHardOff).toBe(true);
    expect(d.taskIdAlert.level).toBe('CRITICAL');
  });

  it('llmHardOff wins over safeRun when both set', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, safeRun: true, llmHardOffEnv: true });
    expect(d.llmHardOff).toBe(true);
    expect(d.mode).toBe('LLM_HARD_OFF');
  });

  it('returns correct source literal', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE });
    expect(d.source).toBe('T04_SAFETY_GUARD');
  });

  it('BLOCKED mode disallows DB write', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, opsGuardrailOk: false });
    expect(d.allowDbWrite).toBe(false);
  });

  it('SAFE_RUN mode still allows DB write (not fully blocked)', () => {
    const d = evaluateSafetyMode({ ...NORMAL_BASE, safeRun: true });
    expect(d.allowDbWrite).toBe(true);
  });
});

// ─── assertLlmAllowed ────────────────────────────────────────────────────────

describe('assertLlmAllowed()', () => {
  const NORMAL_DECISION: SafetyDecision = {
    mode: 'NORMAL',
    llmHardOff: false,
    allowExternalAi: true,
    allowExternalApi: true,
    allowDbWrite: true,
    taskIdAlert: { level: 'NONE', message: null, requiresAction: false },
    reasons: [],
    source: 'T04_SAFETY_GUARD',
  };

  const HARD_OFF_DECISION: SafetyDecision = {
    mode: 'LLM_HARD_OFF',
    llmHardOff: true,
    allowExternalAi: false,
    allowExternalApi: false,
    allowDbWrite: true,
    taskIdAlert: { level: 'NONE', message: null, requiresAction: false },
    reasons: ['LLM_HARD_OFF env var is set.'],
    source: 'T04_SAFETY_GUARD',
  };

  it('11. normal decision allows (no throw)', () => {
    expect(() => assertLlmAllowed(NORMAL_DECISION)).not.toThrow();
  });

  it('12. hard-off decision throws', () => {
    expect(() => assertLlmAllowed(HARD_OFF_DECISION)).toThrow('[SafetyGuard] LLM call blocked');
  });

  it('throws when llmHardOff=false but allowExternalAi=false', () => {
    const d: SafetyDecision = { ...NORMAL_DECISION, llmHardOff: false, allowExternalAi: false };
    expect(() => assertLlmAllowed(d)).toThrow('[SafetyGuard] LLM call blocked');
  });

  it('throw message includes mode', () => {
    try {
      assertLlmAllowed(HARD_OFF_DECISION);
      fail('should have thrown');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('mode=LLM_HARD_OFF');
    }
  });
});

// ─── Forbidden field checks ───────────────────────────────────────────────────

describe('SafetyDecision forbidden fields', () => {
  const FORBIDDEN = ['buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha', 'edge', 'profit', 'recommendation', 'outperform'];
  const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

  it('SafetyDecision has no forbidden field keys', () => {
    const d = evaluateSafetyMode({
      dryRun: false,
      mayMutateState: false,
      mayCallExternalAi: false,
      taskId: 'task-123',
      opsReportStatus: 'PASS',
      opsGuardrailOk: true,
    });
    const keys = Object.keys(d);
    FORBIDDEN.forEach(f => {
      expect(keys).not.toContain(f);
    });
  });

  it('SafetyDecision serialized JSON has no H001-H012 pattern', () => {
    const d = evaluateSafetyMode({
      dryRun: false,
      mayMutateState: false,
      mayCallExternalAi: false,
      taskId: 'task-123',
    });
    const json = JSON.stringify(d);
    expect(H_PATTERN.test(json)).toBe(false);
  });
});

// ─── Integration-style tests (simulating cron route behavior) ────────────────

describe('Scheduler integration (simulated)', () => {
  it('13. missing critical taskId blocks mutating task', () => {
    const d = evaluateSafetyMode({
      taskId: null,
      dryRun: false,
      mayMutateState: true,
      mayCallExternalAi: false,
    });
    expect(d.mode).toBe('BLOCKED');
    expect(d.llmHardOff).toBe(true);
    expect(d.taskIdAlert.level).toBe('CRITICAL');
    expect(() => assertLlmAllowed(d)).toThrow();
  });

  it('14. safeRun response includes expected safety fields', () => {
    const d = evaluateSafetyMode({
      taskId: 'task-cron-1',
      dryRun: false,
      mayMutateState: false,
      mayCallExternalAi: false,
      safeRun: true,
    });
    expect(d).toHaveProperty('mode');
    expect(d).toHaveProperty('llmHardOff');
    expect(d).toHaveProperty('taskIdAlert');
    expect(d).toHaveProperty('source', 'T04_SAFETY_GUARD');
    expect(d.llmHardOff).toBe(true);
  });

  it('15. route does not call LLM in safe-run (assertLlmAllowed throws)', () => {
    const d = evaluateSafetyMode({
      taskId: 'task-cron-2',
      dryRun: false,
      mayMutateState: false,
      mayCallExternalAi: true,
      safeRun: true,
    });
    // Simulate route checking before LLM call
    expect(() => assertLlmAllowed(d)).toThrow('[SafetyGuard] LLM call blocked');
  });
});
