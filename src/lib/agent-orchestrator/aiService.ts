import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPolicyBlockedWorkerOutput } from './aiModulesService';
import { evaluateExecutionPolicy, recordLlmExecution, type LlmCallerContext } from './llmExecutionPolicy';
import { enforceProviderForRole } from './providerFactory';
import type { WorkerExecutionInput, WorkerExecutionOutput } from './providers';
import type { WorkerProvider } from './types';

const exec = promisify(execCallback);

interface RateLimitDetection {
  finalMessage: string;
  resetHint: string | null;
  httpStatus: number | null;
}

interface ExecuteWorkerProviderCommandInput {
  input: WorkerExecutionInput;
  externalCommand: string;
  callerContext?: LlmCallerContext;
  interpolateCommand(template: string, input: WorkerExecutionInput): string;
  parseChangedFiles(stdout: string): string[];
  detectProviderRateLimit(message: string, provider: WorkerProvider): RateLimitDetection | null;
}

export async function executeWorkerProviderCommand({
  input,
  externalCommand,
  callerContext = 'background',
  interpolateCommand,
  parseChangedFiles,
  detectProviderRateLimit,
}: ExecuteWorkerProviderCommandInput): Promise<WorkerExecutionOutput> {
  const providerGate = enforceProviderForRole('ai_service', input.workerProvider);
  if (!providerGate.allowed) {
    return buildPolicyBlockedWorkerOutput(input, 'PROVIDER_NOT_IN_ALLOWLIST');
  }

  const policyDecision = await evaluateExecutionPolicy({
    caller: 'ai_service',
    callerContext,
    provider: input.workerProvider,
    model: input.workerCopilotModel ?? '',
    taskId: input.taskId,
  });

  if (!policyDecision.allowed) {
    return buildPolicyBlockedWorkerOutput(input, policyDecision.skip_reason);
  }

  await recordLlmExecution({
    caller: 'ai_service',
    callerContext,
    provider: input.workerProvider,
    model: input.workerCopilotModel ?? '',
    taskId: input.taskId,
  });

  const command = interpolateCommand(externalCommand, input);
  try {
    const { stdout, stderr } = await exec(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15 * 60_000,
    });
    const changedFiles = parseChangedFiles(stdout);
    const workerStdout = [stdout, stderr].filter(Boolean).join('\n');
    const rateLimit = detectProviderRateLimit(workerStdout, input.workerProvider);

    if (rateLimit) {
      return {
        completedMarkdown: [
          '# Worker Completion Summary',
          '',
          `- Provider: \`${input.workerProvider}\``,
          `- Task ID: ${input.taskId}`,
          '- Execution mode: external command',
          '',
          '## Runtime Failure',
          '- Provider returned a rate limit response.',
          `- Reset hint: ${rateLimit.resetHint ?? 'Wait for reset or switch provider.'}`,
          '',
          '## Final Message',
          rateLimit.finalMessage,
        ].join('\n'),
        changedFiles,
        acceptanceResults: [
          {
            name: 'Worker command completed',
            passed: false,
            evidence: rateLimit.finalMessage,
          },
        ],
        workerStdout,
        errorMarkersHit: ['worker_runtime_failed', 'provider_rate_limit'],
        runtimeFailed: true,
        runtimeErrorMessage: rateLimit.finalMessage,
        failureProvider: input.workerProvider,
        failureReason: 'rate_limit',
        resetHint: rateLimit.resetHint,
        httpStatus: rateLimit.httpStatus,
      };
    }

    return {
      completedMarkdown: [
        '# Worker Completion Summary',
        '',
        `- Provider: \`${input.workerProvider}\``,
        `- Task ID: ${input.taskId}`,
        '- Execution mode: external command',
        '',
        '## Notes',
        'Worker command completed successfully.',
      ].join('\n'),
      changedFiles,
      acceptanceResults: [
        {
          name: 'Worker command completed',
          passed: true,
          evidence: 'Process exited with code 0.',
        },
      ],
      workerStdout,
      errorMarkersHit: [],
      runtimeFailed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const rateLimit = detectProviderRateLimit(message, input.workerProvider);
    return {
      completedMarkdown: [
        '# Worker Completion Summary',
        '',
        `- Provider: \`${input.workerProvider}\``,
        `- Task ID: ${input.taskId}`,
        '- Execution mode: external command',
        '',
        '## Runtime Failure',
        rateLimit?.finalMessage ?? message,
      ].join('\n'),
      changedFiles: [],
      acceptanceResults: [
        {
          name: 'Worker command completed',
          passed: false,
          evidence: rateLimit?.finalMessage ?? message,
        },
      ],
      workerStdout: message,
      errorMarkersHit: rateLimit ? ['worker_runtime_failed', 'provider_rate_limit'] : ['worker_runtime_failed'],
      runtimeFailed: true,
      runtimeErrorMessage: rateLimit?.finalMessage ?? message,
      failureProvider: input.workerProvider,
      failureReason: rateLimit ? 'rate_limit' : 'runtime_failure',
      resetHint: rateLimit?.resetHint ?? null,
      httpStatus: rateLimit?.httpStatus ?? null,
    };
  }
}