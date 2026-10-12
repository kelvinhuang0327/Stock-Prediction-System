import { spawnSync } from 'node:child_process';
import { WORKSPACE_ROOT } from './common';
import type { TaskRecord, TaskResult } from './types';

// Runtime / build artifacts — never committed
const ARTIFACT_PREFIXES = [
  'runtime/',
  'node_modules/',
  '.next/',
  'coverage/',
  'playwright-report/',
  'test-results/',
  'logs/',
];

// Paths that warrant elevated review priority
const HIGH_CONFLICT_PREFIXES = ['src/', 'orchestrator/', 'prisma/', 'scripts/'];

export interface AutoCommitResult {
  committed: boolean;
  sha: string | null;
  committedFiles: string[];
  /** Non-null only when committed=false, explains why commit was skipped/failed. */
  reason: string | null;
}

function filterCommittablePaths(files: string[]): string[] {
  return files.filter((f) => {
    const norm = f.replaceAll('\\', '/');
    return !ARTIFACT_PREFIXES.some((p) => norm.startsWith(p));
  });
}

function hasHighConflictPath(files: string[]): boolean {
  return files.some((f) => {
    const norm = f.replaceAll('\\', '/');
    return HIGH_CONFLICT_PREFIXES.some((p) => norm.startsWith(p));
  });
}

function git(args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync('git', args, { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
  return {
    ok: r.status === 0,
    out: (r.stdout ?? '').trim(),
    err: (r.stderr ?? '').trim(),
  };
}

/**
 * Attempt to auto-commit changes produced by a completed worker task.
 *
 * Commits to the current branch with a structured commit message
 * (subject + metadata body) matching the inbox-commit format.
 * Only files outside artifact directories are staged.
 * Returns committed=false (non-throwing) on any git failure or when
 * there are no committable files.
 */
export function attemptAutoCommit(
  task: TaskRecord,
  gateResult: TaskResult,
): AutoCommitResult {
  if (gateResult.gate_verdict !== 'PASS') {
    return { committed: false, sha: null, committedFiles: [], reason: 'gate_verdict_not_pass' };
  }

  const committable = filterCommittablePaths(gateResult.changed_files);
  if (committable.length === 0) {
    return { committed: false, sha: null, committedFiles: [], reason: 'no_committable_files' };
  }

  // Stage only the committable files
  const add = git(['add', '--', ...committable]);
  if (!add.ok) {
    return {
      committed: false,
      sha: null,
      committedFiles: [],
      reason: `git_add_failed: ${add.err}`,
    };
  }

  // Bail early if nothing was actually staged (all files already clean)
  const staged = git(['diff', '--cached', '--name-only']);
  if (!staged.ok || staged.out === '') {
    return { committed: false, sha: null, committedFiles: [], reason: 'nothing_staged_after_add' };
  }

  const reviewPriority = hasHighConflictPath(committable) ? 'HIGH' : 'NORMAL';
  const titleWords = task.slug.replaceAll('-', ' ');
  const subject = `auto(task-${task.taskId}): ${titleWords.slice(0, 80)}`;
  const body = [
    `Task-ID: ${task.taskId}`,
    `Day-Key: ${task.dayKey}`,
    `Planner-Provider: ${task.plannerProvider}`,
    `Worker-Provider: ${task.workerProvider}`,
    `Gate-Verdict: ${gateResult.gate_verdict}`,
    `Review-Priority: ${reviewPriority}`,
  ].join('\n');

  const commit = git(['commit', '-m', subject, '-m', body]);
  if (!commit.ok) {
    // Unstage to leave the working tree clean
    git(['reset', 'HEAD', '--', ...committable]);
    return {
      committed: false,
      sha: null,
      committedFiles: [],
      reason: `git_commit_failed: ${commit.err}`,
    };
  }

  const shaResult = git(['rev-parse', '--short', 'HEAD']);
  return {
    committed: true,
    sha: shaResult.ok ? shaResult.out : null,
    committedFiles: committable,
    reason: null,
  };
}
