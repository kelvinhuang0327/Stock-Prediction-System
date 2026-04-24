import nodePath from 'node:path';
import { fileExists } from './common';
import type { AcceptanceResult, GateVerdict, TaskContract, TaskResult } from './types';

export interface GateInput {
  taskId: number;
  durationSeconds: number;
  contract: TaskContract;
  completedPath: string;
  resultPath: string;
  changedFiles: string[];
  acceptanceResults: AcceptanceResult[];
  gateReasonHint?: string;
  errorMarkersHit?: string[];
  runtimeFailed?: boolean;
  failureProvider?: TaskResult['failure_provider'];
  failureReason?: TaskResult['failure_reason'];
  resetHint?: TaskResult['reset_hint'];
  finalMessage?: TaskResult['final_message'];
  httpStatus?: TaskResult['http_status'];
}

function gateVerdictToStatus(verdict: GateVerdict): TaskResult['status'] {
  if (verdict === 'PASS') return 'COMPLETED';
  if (verdict === 'PROVIDER_RATE_LIMITED') return 'FAILED_RATE_LIMIT';
  return 'REPLAN_REQUIRED';
}

export function findForbiddenViolations(changedFiles: string[], forbiddenPrefixes: string[]): string[] {
  return changedFiles.filter((filePath) =>
    forbiddenPrefixes.some((prefix) => {
      const normalizedFile = filePath.replaceAll('\\', '/');
      const normalizedPrefix = prefix.replaceAll('\\', '/');
      return normalizedFile === normalizedPrefix || normalizedFile.startsWith(normalizedPrefix);
    }),
  );
}

export async function evaluateGate(input: GateInput): Promise<TaskResult> {
  const missingOutputs: string[] = [];
  if (!(await fileExists(input.completedPath))) missingOutputs.push('completed_markdown');
  if (!(await fileExists(input.resultPath))) missingOutputs.push('task_result_json');
  if (!Array.isArray(input.changedFiles)) missingOutputs.push('changed_files_list');

  const forbiddenViolations = findForbiddenViolations(
    input.changedFiles.map((target) => nodePath.normalize(target)),
    input.contract.forbidden_changes,
  );

  const acceptanceFailed = input.acceptanceResults.some((item) => !item.passed);

  let verdict: GateVerdict = 'PASS';
  let gateReason = input.gateReasonHint ?? '';

  if (input.runtimeFailed) {
    verdict = input.failureReason === 'rate_limit' ? 'PROVIDER_RATE_LIMITED' : 'WORKER_RUNTIME_FAILED';
    gateReason = gateReason || 'Worker runtime failed before producing valid delivery.';
  } else if (forbiddenViolations.length > 0) {
    verdict = 'POLICY_VIOLATION';
    gateReason = gateReason || 'Worker touched forbidden paths.';
  } else if (missingOutputs.length > 0) {
    verdict = 'INVALID_DELIVERY';
    gateReason = gateReason || 'Worker delivery is missing required outputs.';
  } else if (acceptanceFailed) {
    verdict = 'FAILED_ACCEPTANCE';
    gateReason = gateReason || 'One or more acceptance checks failed.';
  }

  return {
    version: '1.0',
    task_id: input.taskId,
    status: gateVerdictToStatus(verdict),
    gate_verdict: verdict,
    gate_reason: gateReason,
    failure_provider: input.failureProvider ?? null,
    failure_reason: input.failureReason ?? null,
    reset_hint: input.resetHint ?? null,
    final_message: input.finalMessage ?? input.gateReasonHint ?? null,
    http_status: input.httpStatus ?? null,
    duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
    changed_files: input.changedFiles,
    error_markers_hit: input.errorMarkersHit ?? [],
    missing_required_outputs: missingOutputs,
    forbidden_change_violations: forbiddenViolations,
    acceptance_results: input.acceptanceResults,
    next_action:
      verdict === 'PASS'
        ? 'Continue to next planned task.'
        : 'Planner must inspect this result and create a replan task.',
  };
}
