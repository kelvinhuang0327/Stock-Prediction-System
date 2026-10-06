import { getPolicySkipMessage, type LlmSkipReason } from './llmExecutionPolicy';
import type { WorkerExecutionInput, WorkerExecutionOutput } from './providers';

export function buildPolicyBlockedWorkerOutput(
  input: WorkerExecutionInput,
  skipReason: LlmSkipReason | null,
): WorkerExecutionOutput {
  const message = getPolicySkipMessage(skipReason);
  return {
    completedMarkdown: [
      '# Worker Completion Summary',
      '',
      `- Provider: \`${input.workerProvider}\``,
      `- Task ID: ${input.taskId}`,
      '- Execution mode: execution policy blocked',
      '',
      '## Runtime Failure',
      message,
    ].join('\n'),
    changedFiles: [],
    acceptanceResults: [
      {
        name: 'Worker command completed',
        passed: false,
        evidence: message,
      },
    ],
    workerStdout: message,
    errorMarkersHit: ['execution_policy_block'],
    runtimeFailed: true,
    runtimeErrorMessage: message,
    failureProvider: input.workerProvider,
    failureReason: 'runtime_failure',
    resetHint: null,
    httpStatus: null,
  };
}
