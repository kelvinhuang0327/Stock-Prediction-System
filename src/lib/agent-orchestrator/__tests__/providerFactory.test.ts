import {
  enforceProviderForRole,
  getEffectiveWorkerAllowlist,
  resolveProviderForRole,
  WORKER_PROVIDER_ALLOWLIST,
  WORKER_PROVIDER_CODEX_GATE,
} from '../providerFactory';

describe('resolveProviderForRole', () => {
  it('forces planner into local-planner mode while preserving requested provider for audit context', () => {
    expect(resolveProviderForRole('planner', 'codex')).toEqual({
      role: 'planner',
      requestedProvider: 'codex',
      effectiveProvider: 'local-planner',
      external: false,
    });
  });

  it('keeps worker providers external', () => {
    expect(resolveProviderForRole('worker', 'copilot-daemon')).toEqual({
      role: 'worker',
      requestedProvider: 'copilot-daemon',
      effectiveProvider: 'copilot-daemon',
      external: true,
    });
  });

  it('forces cto review into local-review mode', () => {
    expect(resolveProviderForRole('cto_review')).toEqual({
      role: 'cto_review',
      requestedProvider: '',
      effectiveProvider: 'local-review',
      external: false,
    });
  });
});

describe('enforceProviderForRole — local roles always allowed', () => {
  it('planner with codex as requested provider is allowed (resolves to local-planner)', () => {
    const result = enforceProviderForRole('planner', 'codex');
    expect(result.allowed).toBe(true);
    expect(result.blockReason).toBeNull();
    expect(result.resolution.effectiveProvider).toBe('local-planner');
  });

  it('cto_review with any provider is allowed (resolves to local-review)', () => {
    const result = enforceProviderForRole('cto_review', 'codex');
    expect(result.allowed).toBe(true);
    expect(result.blockReason).toBeNull();
    expect(result.resolution.effectiveProvider).toBe('local-review');
  });
});

describe('enforceProviderForRole — worker allowlist', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('copilot-daemon is allowed by default', () => {
    const result = enforceProviderForRole('worker', 'copilot-daemon');
    expect(result.allowed).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it('codex is blocked by default (CODEX_WORKER_NOT_ENABLED)', () => {
    const result = enforceProviderForRole('worker', 'codex');
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe('CODEX_WORKER_NOT_ENABLED');
  });

  it('codex is allowed when AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER=1', () => {
    process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER = '1';
    const result = enforceProviderForRole('worker', 'codex');
    expect(result.allowed).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it.each(['true', 'yes', 'on'])('codex is allowed when AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER=%s', (val) => {
    process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER = val;
    expect(enforceProviderForRole('worker', 'codex').allowed).toBe(true);
  });

  it('unknown provider is blocked (PROVIDER_NOT_IN_ALLOWLIST)', () => {
    const result = enforceProviderForRole('worker', 'unknown-provider' as never);
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe('PROVIDER_NOT_IN_ALLOWLIST');
  });
});

describe('enforceProviderForRole — ai_service role mirrors worker rules', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('copilot-daemon passes through ai_service', () => {
    expect(enforceProviderForRole('ai_service', 'copilot-daemon').allowed).toBe(true);
  });

  it('codex blocked for ai_service without opt-in', () => {
    const result = enforceProviderForRole('ai_service', 'codex');
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe('CODEX_WORKER_NOT_ENABLED');
  });
});

describe('getEffectiveWorkerAllowlist', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('default allowlist does not include codex', () => {
    expect(getEffectiveWorkerAllowlist()).toEqual(WORKER_PROVIDER_ALLOWLIST);
    expect(getEffectiveWorkerAllowlist()).not.toContain('codex');
  });

  it('expanded allowlist includes codex when env var enabled', () => {
    process.env.AGENT_ORCHESTRATOR_ALLOW_CODEX_WORKER = '1';
    const list = getEffectiveWorkerAllowlist();
    expect(list).toContain('codex');
    expect(list).toContain('copilot-daemon');
  });

  it('WORKER_PROVIDER_CODEX_GATE contains codex', () => {
    expect(WORKER_PROVIDER_CODEX_GATE).toContain('codex');
  });
});
