import { attemptAutoCommit } from '../autoCommit';
import { spawnSync } from 'node:child_process';

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn(),
}));

const mockSpawnSync = spawnSync as jest.Mock;


describe('autoCommit', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns not committed when gate verdict is not PASS', () => {
    const input = { taskId: 1, slug: 'task-1', dayKey: '20260101', plannerProvider: 'codex', workerProvider: 'codex' };
    const verification = { gate_verdict: 'FAIL', changed_files: [] };
    const res = attemptAutoCommit(
      input as unknown as Parameters<typeof attemptAutoCommit>[0],
      verification as unknown as Parameters<typeof attemptAutoCommit>[1]
    );
    expect(res.committed).toBe(false);
    expect(res.reason).toBe('gate_verdict_not_pass');
  });

  it('returns no_committable_files when only artifact files changed', () => {
    const input = { taskId: 2, slug: 'task-2', dayKey: '20260101', plannerProvider: 'codex', workerProvider: 'codex' };
    const verification = { gate_verdict: 'PASS', changed_files: ['runtime/logs/x.log', 'node_modules/pkg/index.js'] };
    const res = attemptAutoCommit(
      input as unknown as Parameters<typeof attemptAutoCommit>[0],
      verification as unknown as Parameters<typeof attemptAutoCommit>[1]
    );
    expect(res.committed).toBe(false);
    expect(res.reason).toBe('no_committable_files');
  });

  it('commits files when git commands succeed', () => {
    // Simulate spawnSync behavior based on args
    mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
      const sub = args[0];
      if (sub === 'add') return { status: 0, stdout: '', stderr: '' };
      if (args.includes('diff') && args.includes('--cached')) return { status: 0, stdout: 'src/foo.ts', stderr: '' };
      if (sub === 'commit') return { status: 0, stdout: '', stderr: '' };
      if (args.includes('rev-parse')) return { status: 0, stdout: 'abc123', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    });

    const input = { taskId: 3, slug: 'make-change', dayKey: '20260101', plannerProvider: 'codex', workerProvider: 'codex' };
    const verification = { gate_verdict: 'PASS', changed_files: ['src/foo.ts'] };
    const res = attemptAutoCommit(
      input as unknown as Parameters<typeof attemptAutoCommit>[0],
      verification as unknown as Parameters<typeof attemptAutoCommit>[1]
    );
    expect(res.committed).toBe(true);
    expect(res.sha).toBe('abc123');
    expect(res.committedFiles).toContain('src/foo.ts');
  });
});
