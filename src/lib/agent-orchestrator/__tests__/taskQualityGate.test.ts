import { buildRecentTaskReference, evaluatePlannerDraftQuality } from '../taskQualityGate';
import type { PlannerTaskFingerprint, TaskContract, TaskRecord } from '../types';

function makeContract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    version: '1.0',
    objective: 'Deep research task',
    scope: [
      'Explore candidate strategy families for the target regime and define measurable hypotheses.',
      'Generate at least 3 strategy variants and document the decision rules for each variant.',
      'Run backtest windows at 150 / 500 / 1500 trades with a consistent evaluation harness.',
      'Run Monte Carlo at least 1000 times and compare stability across the strategy set.',
      'Compare against the existing strategy baseline, review edge / sharpe / drawdown, and issue a final recommendation.',
    ],
    constraints: ['Do not mutate production data.'],
    acceptance_tests: ['Produce quantified outputs with evidence.'],
    required_outputs: ['comparison_matrix_vs_existing'],
    forbidden_changes: [],
    handoff_questions: ['What should happen next?'],
    ...overrides,
  };
}

function makeRecord(taskId: number, plannerContext: PlannerTaskFingerprint | null = null): TaskRecord {
  return {
    taskId,
    slug: `task-${taskId}`,
    dayKey: '20260423',
    status: 'COMPLETED',
    gateVerdict: 'PASS',
    plannerProvider: 'codex',
    workerProvider: 'copilot-daemon',
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    lastOutputAt: '2026-04-23T00:00:00.000Z',
    latestProgressSummary: 'done',
    promptPath: '/tmp/prompt',
    contractPath: '/tmp/contract',
    completedPath: '/tmp/completed',
    resultPath: '/tmp/result',
    metaPath: '/tmp/meta',
    workerLogPath: '/tmp/log',
    plannerContext,
  };
}

describe('evaluatePlannerDraftQuality', () => {
  it('rejects short tasks that do not include mandatory 8-hour workload types', () => {
    const contract = makeContract({
      objective: 'Investigate one issue quickly',
      scope: [
        'Inspect a single failing data path.',
        'Write a short note.',
        'Share the finding.',
      ],
      required_outputs: ['note'],
    });

    const result = evaluatePlannerDraftQuality({
      objective: contract.objective,
      promptMarkdown: '# Task\n\nQuick investigation only.',
      contract,
      plannerContext: null,
      recentTasks: [],
    });

    expect(result.quality_status).toBe('REJECT');
    expect(result.reasons.some((reason) => reason.includes('Monte Carlo'))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes('150 / 500 / 1500 回測'))).toBe(true);
  });

  it('passes a deep task and normalizes scope into explicit phases', () => {
    const contract = makeContract();

    const result = evaluatePlannerDraftQuality({
      objective: contract.objective,
      promptMarkdown: [
        '# Deep Research Task',
        '',
        'Generate at least 3 strategies for the current regime.',
        'Run backtest 150 / 500 / 1500 and Monte Carlo 1000 times.',
        'Perform multi-strategy comparison, structural analysis, and parameter optimization.',
        'Report edge, sharpe, drawdown, compare with existing strategy, and provide a final recommendation.',
      ].join('\n'),
      contract,
      plannerContext: { taskType: 'deep_research', game: null, regimeState: 'NORMAL', dedupeKey: 'deep_research|GLOBAL|NORMAL' },
      recentTasks: [],
    });

    expect(result.quality_status).toBe('PASS');
    expect(result.contract.scope).toHaveLength(5);
    expect(result.contract.scope[0]).toContain('Phase 1:');
    expect(result.contract.required_outputs).toContain('monte_carlo_report_1000_plus');
  });

  it('rejects duplicate tasks against recent similar work', () => {
    const plannerContext = { taskType: 'deep_research', game: null, regimeState: 'NORMAL', dedupeKey: 'deep_research|GLOBAL|NORMAL' };
    const contract = makeContract({ objective: 'Deep research task for current regime' });
    const recent = buildRecentTaskReference(makeRecord(42, plannerContext), makeContract({ objective: 'Deep research task for current regime' }));

    const result = evaluatePlannerDraftQuality({
      objective: contract.objective,
      promptMarkdown: 'Generate at least 3 strategies, run backtest 150 / 500 / 1500, Monte Carlo 1000, compare edge sharpe drawdown, and provide final recommendation.',
      contract,
      plannerContext,
      recentTasks: [recent],
    });

    expect(result.quality_status).toBe('REJECT');
    expect(result.reasons.some((reason) => reason.includes('最近任務 #42'))).toBe(true);
  });

  it('rejects banned wording even if the task is otherwise long', () => {
    const contract = makeContract({ objective: 'SIGNAL_EXHAUSTED deep review task' });

    const result = evaluatePlannerDraftQuality({
      objective: contract.objective,
      promptMarkdown: 'Generate at least 3 strategies, run backtest 150 / 500 / 1500, Monte Carlo 1000, compare edge sharpe drawdown, and provide final recommendation.',
      contract,
      plannerContext: null,
      recentTasks: [],
    });

    expect(result.quality_status).toBe('REJECT');
    expect(result.reasons.some((reason) => reason.includes('SIGNAL_EXHAUSTED'))).toBe(true);
  });
});