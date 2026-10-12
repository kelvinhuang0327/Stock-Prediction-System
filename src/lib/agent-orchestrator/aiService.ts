import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPolicyBlockedWorkerOutput } from './aiModulesService';
import { writeAuditAttempt, writeAuditBlocked, writeAuditResult } from './llmAuditGuard';
import { evaluateExecutionPolicy, recordLlmExecution, type LlmCallerContext } from './llmExecutionPolicy';
import {
  logProviderBlocked,
  logProviderExecutionFailure,
  logProviderExecutionStart,
  logProviderExecutionSuccess,
  type ModelPropagationStatus,
} from './llmUsageLogger';
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
  const auditTriggerSource = callerContext === 'manual' ? 'manual_preview' : 'worker_execute';
  const usageTriggerSource = callerContext === 'manual' ? 'manual' : 'worker-cycle';
  const desiredModel = input.workerCopilotModel ?? null;
  const actualModel = desiredModel ? 'provider-managed' : null;
  const modelPropagationStatus: ModelPropagationStatus = desiredModel ? 'provider-managed' : 'not-configured';
  const usageInput = {
    caller: 'ai_service' as const,
    triggerSource: usageTriggerSource as 'manual' | 'worker-cycle',
    provider: input.workerProvider,
    model: desiredModel,
    taskId: input.taskId,
    desiredModel,
    actualModel,
    modelPropagationStatus,
  };

  const providerGate = enforceProviderForRole('ai_service', input.workerProvider);
  if (!providerGate.allowed) {
    const blockReason = providerGate.blockReason ?? 'PROVIDER_NOT_IN_ALLOWLIST';
    writeAuditBlocked({
      provider: input.workerProvider,
      usageRole: 'worker',
      runnerType: 'ai_service',
      taskId: input.taskId,
      triggerSource: auditTriggerSource,
      blockReason,
      callerFile: 'aiService.ts',
      callerFunction: 'executeWorkerProviderCommand',
    });
    logProviderBlocked({ ...usageInput, skipReason: blockReason });
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
    const blockReason = policyDecision.skip_reason ?? 'SCHEDULER_DISABLED';
    writeAuditBlocked({
      provider: input.workerProvider,
      usageRole: 'worker',
      runnerType: 'ai_service',
      taskId: input.taskId,
      triggerSource: auditTriggerSource,
      blockReason,
      callerFile: 'aiService.ts',
      callerFunction: 'executeWorkerProviderCommand',
    });
    logProviderBlocked({ ...usageInput, skipReason: blockReason });
    return buildPolicyBlockedWorkerOutput(input, policyDecision.skip_reason);
  }

  const auditAttempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: input.workerProvider,
    model: desiredModel,
    taskId: input.taskId,
    desiredModel,
    actualModel,
    modelPropagationStatus,
    triggerSource: auditTriggerSource,
    callerFile: 'aiService.ts',
    callerFunction: 'executeWorkerProviderCommand',
  });

  if (!auditAttempt.written) {
    logProviderBlocked({ ...usageInput, skipReason: auditAttempt.blockReason });
    return buildPolicyBlockedWorkerOutput(input, null);
  }

  await recordLlmExecution({
    caller: 'ai_service',
    callerContext,
    provider: input.workerProvider,
    model: input.workerCopilotModel ?? '',
    taskId: input.taskId,
  });

  const command = interpolateCommand(externalCommand, input);
  const startedAt = Date.now();
  logProviderExecutionStart({ ...usageInput, command });
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
      const durationMs = Date.now() - startedAt;
      writeAuditResult({
        correlationId: auditAttempt.correlationId,
        provider: input.workerProvider,
        usageRole: 'worker',
        runnerType: 'ai_service',
        taskId: input.taskId,
        triggerSource: auditTriggerSource,
        success: false,
        actualModel,
        modelPropagationStatus,
        error: rateLimit.finalMessage,
        durationMs,
        rateLimitType: 'provider_rate_limit',
        rateLimitResetRaw: rateLimit.resetHint,
        callerFile: 'aiService.ts',
        callerFunction: 'executeWorkerProviderCommand',
      });
      logProviderExecutionFailure({
        ...usageInput,
        command,
        errorCode: 'provider_rate_limit',
        errorMessage: rateLimit.finalMessage,
        rateLimit: rateLimit.resetHint,
        durationMs,
      });
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

    const durationMs = Date.now() - startedAt;
    writeAuditResult({
      correlationId: auditAttempt.correlationId,
      provider: input.workerProvider,
      usageRole: 'worker',
      runnerType: 'ai_service',
      taskId: input.taskId,
      triggerSource: auditTriggerSource,
      success: true,
      actualModel,
      modelPropagationStatus,
      durationMs,
      callerFile: 'aiService.ts',
      callerFunction: 'executeWorkerProviderCommand',
    });
    logProviderExecutionSuccess({ ...usageInput, command, durationMs });

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
    const errorMessage = rateLimit?.finalMessage ?? message;
    const durationMs = Date.now() - startedAt;
    writeAuditResult({
      correlationId: auditAttempt.correlationId,
      provider: input.workerProvider,
      usageRole: 'worker',
      runnerType: 'ai_service',
      taskId: input.taskId,
      triggerSource: auditTriggerSource,
      success: false,
      actualModel,
      modelPropagationStatus,
      error: errorMessage,
      durationMs,
      rateLimitType: rateLimit ? 'provider_rate_limit' : null,
      rateLimitResetRaw: rateLimit?.resetHint ?? null,
      callerFile: 'aiService.ts',
      callerFunction: 'executeWorkerProviderCommand',
    });
    logProviderExecutionFailure({
      ...usageInput,
      command,
      errorCode: rateLimit ? 'provider_rate_limit' : 'worker_runtime_failed',
      errorMessage,
      rateLimit: rateLimit?.resetHint ?? null,
      durationMs,
    });
    return {
      completedMarkdown: [
        '# Worker Completion Summary',
        '',
        `- Provider: \`${input.workerProvider}\``,
        `- Task ID: ${input.taskId}`,
        '- Execution mode: external command',
        '',
        '## Runtime Failure',
        errorMessage,
      ].join('\n'),
      changedFiles: [],
      acceptanceResults: [
        {
          name: 'Worker command completed',
          passed: false,
          evidence: errorMessage,
        },
      ],
      workerStdout: message,
      errorMarkersHit: rateLimit ? ['worker_runtime_failed', 'provider_rate_limit'] : ['worker_runtime_failed'],
      runtimeFailed: true,
      runtimeErrorMessage: errorMessage,
      failureProvider: input.workerProvider,
      failureReason: rateLimit ? 'rate_limit' : 'runtime_failure',
      resetHint: rateLimit?.resetHint ?? null,
      httpStatus: rateLimit?.httpStatus ?? null,
    };
  }
}
