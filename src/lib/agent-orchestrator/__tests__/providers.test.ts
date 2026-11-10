import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import {
    buildColdRegimePayload,
    buildPlannerDraft,
    buildSaturatedPayload,
    detectProviderRateLimit,
    interpolateCommand,
    parseChangedFiles,
    pickResearchBacklogItem,
    resolveWorkerCommand,
    runWorkerProvider,
} from '../providers';
import type { SignalStateResult } from '../ctoTypes';
import type { ProjectProfile, ResearchBacklogItem, TaskResult } from '../types';
import { executeWorkerProviderCommand } from '../aiService';

jest.mock('../aiService', () => ({
    executeWorkerProviderCommand: jest.fn(),
}));

const mockExecuteWorkerProviderCommand = jest.mocked(executeWorkerProviderCommand);

const originalWorkerCommand = process.env['AGENT_ORCHESTRATOR_WORKER_CMD'];
const originalWorkerModel = process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'];
const originalCwd = process.cwd();

function withLaunchdEnvFile<T>(contents: string | null, action: () => T): T {
    const root = mkdtempSync(joinPath(tmpdir(), 'providers-test-'));
    const envDir = joinPath(root, 'deploy', 'launchd-orchestrator');
    mkdirSync(envDir, { recursive: true });
    if (contents !== null) writeFileSync(joinPath(envDir, 'launchd.env'), contents, 'utf8');
    process.chdir(root);
    try {
        return action();
    } finally {
        process.chdir(originalCwd);
        rmSync(root, { recursive: true, force: true });
    }
}

function makeSignalState(overrides: Partial<SignalStateResult> = {}): SignalStateResult {
    return {
        state: 'COLD_REGIME',
        confidenceScore: 0.6,
        confidenceLabel: 'medium',
        reason: 'test-reason',
        features: {
            organicTradeCount: 10,
            fullTradeCount: 12,
            trendWinRate: 0.12,
            reboundWinRate: 0.15,
            overallWinRate: 0.1,
            winRateDelta: -0.06,
            dataCoverage: 'partial',
            penalizedSetupCount: 2,
            insightCount: 1,
        },
        ...overrides,
    };
}

const profile = {
    project_name: 'Stock System',
    project_slug: 'stock-system',
    orchestrator_root: '/tmp/orchestrator',
    backlog_path: '/tmp/backlog.md',
    task_storage_path: '/tmp/tasks',
    log_storage_path: '/tmp/logs',
    database_path: '/tmp/tasks.db',
    default_schedule_minutes: 15,
    planner_provider: 'codex',
    worker_provider: 'codex',
    planner_rules: {},
    worker_rules: {},
    protected_paths: ['src/generated/**'],
    required_checks: [],
    allowed_reference_paths: ['README.md'],
    required_contract_fields: [],
    required_result_fields: [],
    ui: {},
} as unknown as ProjectProfile;

function backlogItem(overrides: Partial<ResearchBacklogItem> = {}): ResearchBacklogItem {
    return {
        id: 'research-1',
        priority: 10,
        status: 'queued',
        trigger: 'signal_cold',
        title: 'Investigate the cold signal',
        objective: 'analyze BIG_LOTTO COLD_REGIME signal_quality',
        focus_keys: [],
        signal_state: 'COLD_REGIME',
        blocked_by: null,
        target_outputs: ['evidence.json'],
        statistical_requirements: ['p < 0.05'],
        expected_duration_hours: 12,
        replacement_if_failed: null,
        ...overrides,
    };
}

describe('providers helpers', () => {
  it('buildColdRegimePayload returns a planner draft with contract and promptMarkdown', () => {
    const signalState = {
      state: 'COLD_REGIME',
      confidenceScore: 0.6,
      reason: 'test-reason',
      features: {
        overallWinRate: 0.1,
        winRateDelta: -0.06,
        penalizedSetupCount: 2,
        dataCoverage: 'partial',
        organicTradeCount: 10,
        fullTradeCount: 12,
      },
    } as unknown as Parameters<typeof buildColdRegimePayload>[0];

    const draft = buildColdRegimePayload(signalState, profile);
    expect(draft).toHaveProperty('contract');
    expect(draft).toHaveProperty('promptMarkdown');
    expect(draft.plannerContext).toHaveProperty('dedupeKey');
    expect(draft.plannerContext.taskType).toBeDefined();
  });

    afterEach(() => {
        jest.restoreAllMocks();
        process.chdir(originalCwd);
        if (originalWorkerCommand === undefined) delete process.env['AGENT_ORCHESTRATOR_WORKER_CMD'];
        else process.env['AGENT_ORCHESTRATOR_WORKER_CMD'] = originalWorkerCommand;
        if (originalWorkerModel === undefined) delete process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'];
        else process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'] = originalWorkerModel;
        mockExecuteWorkerProviderCommand.mockReset();
    });

    it.each([
        [2, -0.2, 'setup_penalty_investigation'],
        [1, -0.06, 'win_rate_decline_analysis'],
        [0, -0.05, 'cold_phase_analysis'],
    ] as const)('selects cold-regime subtype %s/%s', (penalizedSetupCount, winRateDelta, expectedSubtype) => {
        const state = makeSignalState({
            features: { ...makeSignalState().features, penalizedSetupCount, winRateDelta },
        });
        const draft = buildColdRegimePayload(state, profile);

        expect(draft.plannerContext.taskType).toBe(expectedSubtype);
        expect(draft.contract.focuses).toHaveLength(3);
        expect(draft.contract.version).toBe('2.0');
        expect(draft.contract.forbidden_changes).toEqual(profile.protected_paths);
        expect(draft.promptMarkdown).toContain('## Statistical Gates');
    });

    it.each([
        [1, '', 'signal_quality_filter'],
        [0, 'shadow candidate notes', 'meta_level_review'],
        [0, 'backlog item without the keyword', 'shadow_strategy_tracking'],
    ] as const)('selects saturated-regime subtype for penalized=%s and backlog=%s', (penalizedSetupCount, backlogMarkdown, expectedSubtype) => {
        const state = makeSignalState({
            state: 'SIGNAL_SATURATED',
            features: { ...makeSignalState().features, penalizedSetupCount },
        });
        const draft = buildSaturatedPayload(state, backlogMarkdown, profile);

        expect(draft.plannerContext.taskType).toBe(expectedSubtype);
        expect(draft.contract.focuses).toHaveLength(3);
        expect(draft.contract.handoff_questions).toEqual(expect.arrayContaining([
            expect.stringContaining('focus area'),
        ]));
        expect(draft.promptMarkdown).toContain('## Research Focus Areas');
    });

    it('picks the earliest queued unblocked research item without mutating input order', () => {
        const queuedLowPriority = backlogItem({ id: 'low', priority: 20 });
        const blocked = backlogItem({ id: 'blocked', priority: 1, blocked_by: 'research-0' });
        const active = backlogItem({ id: 'active', priority: 0, status: 'active' });
        const queuedHighPriority = backlogItem({ id: 'high', priority: 3 });
        const items = [queuedLowPriority, blocked, active, queuedHighPriority];

        expect(pickResearchBacklogItem(items)).toBe(queuedHighPriority);
        expect(items[0]).toBe(queuedLowPriority);
        expect(pickResearchBacklogItem([blocked, active])).toBeNull();
    });

    it('builds a draft from a structured backlog item and carries its constraints', () => {
        const draft = buildPlannerDraft({
            profile,
            backlogMarkdown: '- [ ] ignored markdown item',
            previousResult: {
                version: '1.0', task_id: 8, status: 'COMPLETED', gate_verdict: 'PASS', gate_reason: 'passed',
                duration_seconds: 12, changed_files: [], error_markers_hit: [], missing_required_outputs: [],
                forbidden_change_violations: [], acceptance_results: [], next_action: 'continue',
            } satisfies TaskResult,
            researchItem: backlogItem({
                objective: 'review BIG_LOTTO COLD_REGIME signal_quality',
                notes: 'Use observed trades only.',
            }),
        });

        expect(draft.objective).toContain('BIG_LOTTO');
        expect(draft.plannerContext).toMatchObject({ game: 'BIG_LOTTO', regimeState: 'COLD_REGIME' });
        expect(draft.contract.required_outputs).toContain('evidence.json');
        expect(draft.contract.expected_duration_hours).toBe(12);
        expect(draft.promptMarkdown).toContain('Previous task #8 finished with PASS.');
        expect(draft.promptMarkdown).toContain('Use observed trades only.');
    });

    it.each([
        ['- [ ] SIGNAL_EXHAUSTED should not be selected\n- [ ] Find a cold regime issue', 'Find a cold regime issue'],
        ['- NO_SIGNAL is prohibited\n- ordinary bullet', 'ordinary bullet'],
        ['- [ ] SIGNAL_EXHAUSTED\n- NO_SIGNAL\n- 停止建議\n- 目前沒有方向', 'Design and validate three strategy variants with backtest, Monte Carlo, comparison, and a final recommendation.'],
    ])('selects a safe fallback objective from markdown backlog', (backlogMarkdown, expectedObjective) => {
        const draft = buildPlannerDraft({ profile, backlogMarkdown, previousResult: null });

        expect(draft.objective).toBe(expectedObjective);
        expect(draft.contract.version).toBe('2.0');
        expect(draft.promptMarkdown).toContain('No previous task result found.');
    });

    it.each([
        ['prefix CHANGED_FILES_JSON: ["src/a.ts", 4, "src/b.ts"] suffix', ['src/a.ts', 'src/b.ts']],
        ['CHANGED_FILES_JSON: {"file":"src/a.ts"}', []],
        ['CHANGED_FILES_JSON: [broken]', []],
        ['no marker', []],
    ])('parses changed-file metadata safely', (stdout, expected) => {
        expect(parseChangedFiles(stdout)).toEqual(expected);
    });

    it.each([
        ['plain compiler output', 'codex', null],
        ['rate limit', 'claude', null],
        ['Rate limit detected. Limit to reset in one hour.', 'copilot', 'Rate limit detected.'],
        ["You've hit your rate limit. Please wait 30 minutes for reset.", 'claude', "You've hit your rate limit."],
        ['HTTP status 429 from upstream', 'codex', 'HTTP status 429 from upstream'],
        ['Requests 12 Premium (0 used)\nRequests 4 Premium (0 used)', 'copilot', null],
    ] as const)('classifies provider output %s for %s', (message, provider, expectedHint) => {
        const result = detectProviderRateLimit(message, provider);
        if (expectedHint === null) {
            expect(result).toBeNull();
        } else {
            expect(result).not.toBeNull();
            expect(result?.resetHint).toBe(expectedHint);
            expect(result?.finalMessage).toBe(message.trim());
        }
    });

    it('prefers an explicit worker command from the process environment', () => {
        process.env['AGENT_ORCHESTRATOR_WORKER_CMD'] = '  custom-worker --task {task_id}  ';

        expect(resolveWorkerCommand()).toBe('  custom-worker --task {task_id}  ');
    });

    it.each([
        ["AGENT_ORCHESTRATOR_WORKER_CMD='worker --prompt {prompt_path}'", 'worker --prompt {prompt_path}'],
        ['AGENT_ORCHESTRATOR_WORKER_CMD="worker --task {task_id}"', 'worker --task {task_id}'],
        ['AGENT_ORCHESTRATOR_WORKER_CMD=worker --model {model}', 'worker --model {model}'],
        ['OTHER_SETTING=yes\nAGENT_ORCHESTRATOR_WORKER_CMD=\n', undefined],
    ])('reads an optional worker command from launchd env', (contents, expected) => {
        delete process.env['AGENT_ORCHESTRATOR_WORKER_CMD'];

        expect(withLaunchdEnvFile(contents, () => resolveWorkerCommand())).toBe(expected);
    });

    it('returns undefined when the launchd env file cannot be read or has no worker command', () => {
        delete process.env['AGENT_ORCHESTRATOR_WORKER_CMD'];
        expect(withLaunchdEnvFile(null, () => resolveWorkerCommand())).toBeUndefined();
    });

    it('interpolates every worker command token and uses the configured model fallback', () => {
        delete process.env['AGENT_ORCHESTRATOR_WORKER_CMD'];
        process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'] = 'gpt-test';
        const input = {
            workerProvider: 'copilot', workerCopilotModel: undefined,
            taskId: 42, promptPath: '/tmp/prompt.md', contractPath: '/tmp/contract.json',
            objective: 'inspect the worker', profile,
        } as const;

        expect(interpolateCommand('{provider} {task_id} {prompt_path} {contract_path} {objective} {model} {task_id}', input))
            .toBe('copilot 42 /tmp/prompt.md /tmp/contract.json inspect the worker gpt-test 42');
    });

    it('returns a clear simulated result when no external worker is configured', async () => {
        delete process.env['AGENT_ORCHESTRATOR_WORKER_CMD'];

        const result = await withLaunchdEnvFile(null, () => runWorkerProvider({
            workerProvider: 'codex', taskId: 7, promptPath: 'prompt.md', contractPath: 'contract.json',
            objective: 'inspect worker setup', profile,
        }));

        expect(result.runtimeFailed).toBe(true);
        expect(result.failureReason).toBe('runtime_failure');
        expect(result.errorMarkersHit).toContain('worker_not_configured');
        expect(result.acceptanceResults[0].passed).toBe(false);
        expect(mockExecuteWorkerProviderCommand).not.toHaveBeenCalled();
    });

    it('delegates configured worker execution with caller context and parser helpers', async () => {
        process.env['AGENT_ORCHESTRATOR_WORKER_CMD'] = 'worker --task {task_id}';
        const delegated = {
            completedMarkdown: 'done', changedFiles: ['src/a.ts'], acceptanceResults: [], workerStdout: 'ok',
            errorMarkersHit: [], runtimeFailed: false,
        };
        mockExecuteWorkerProviderCommand.mockResolvedValue(delegated);
        const input = {
            workerProvider: 'copilot', callerContext: 'manual', taskId: 9,
            promptPath: 'prompt.md', contractPath: 'contract.json', objective: 'run worker', profile,
        } as const;

        await expect(runWorkerProvider(input)).resolves.toBe(delegated);
        expect(mockExecuteWorkerProviderCommand).toHaveBeenCalledWith(expect.objectContaining({
            input, externalCommand: 'worker --task {task_id}', callerContext: 'manual',
            interpolateCommand, parseChangedFiles, detectProviderRateLimit,
        }));
    });
});
