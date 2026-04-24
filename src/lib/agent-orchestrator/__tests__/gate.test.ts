import { findForbiddenViolations, evaluateGate } from '../gate';

jest.mock('../common', () => ({ fileExists: jest.fn().mockResolvedValue(true) }));

describe('gate utilities', () => {
  it('findForbiddenViolations detects prefix and exact matches', () => {
    const changed = ['src/secret/keys.txt', 'docs/README.md', 'src/lib/safe.js'];
    const forbidden = ['src/secret', 'bin/'];
    const violations = findForbiddenViolations(changed, forbidden);
    expect(violations).toContain('src/secret/keys.txt');
    expect(violations).not.toContain('docs/README.md');
  });

  it('evaluateGate returns PASS when outputs present and no violations', async () => {
    const input = {
      taskId: 42,
      durationSeconds: 10,
      contract: { forbidden_changes: ['forbidden/path'] },
      completedPath: '/tmp/completed.md',
      resultPath: '/tmp/result.json',
      changedFiles: ['safe/file.txt'],
      acceptanceResults: [{ name: 'a', passed: true }],
    } as any;

    const res = await evaluateGate(input);
    expect(res).toHaveProperty('status');
    expect(res.gate_verdict).toBe('PASS');
  });

  it('evaluateGate flags INVALID_DELIVERY when outputs missing', async () => {
    // reset module registry and mock fileExists to return false for this test
    jest.resetModules();
    jest.doMock('../common', () => ({ fileExists: jest.fn().mockResolvedValue(false) }));
    const { evaluateGate: evaluateGate2 } = await import('../gate');

    const input = {
      taskId: 43,
      durationSeconds: 5,
      contract: { forbidden_changes: [] },
      completedPath: '/tmp/missing.md',
      resultPath: '/tmp/missing.json',
      changedFiles: [],
      acceptanceResults: [{ name: 'a', passed: true }],
    } as any;

    const res = await evaluateGate2(input);
    expect(res.gate_verdict).toBe('INVALID_DELIVERY');
    expect(res.missing_required_outputs.length).toBeGreaterThan(0);
  });
});
