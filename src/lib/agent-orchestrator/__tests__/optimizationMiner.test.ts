import {
  applyPriorityScores,
  candidateToDraft,
  deduplicateAgainstState,
  enforceQuota,
  validateCandidate,
} from '../optimizationMiner';
import type {
  MinerDailyQuota,
  MinerState,
  OptimizationTaskCandidate,
  ProjectProfile,
  TaskRecord,
} from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<OptimizationTaskCandidate> = {}): OptimizationTaskCandidate {
  return {
    taskId: 'wiki_docs__stale_markdown',
    sourceType: 'wiki_docs',
    title: 'Audit and refresh stale docs/wiki markdown files',
    problem: '7 markdown files have not been updated in > 30 days.',
    evidence: ['docs/agent-orchestrator/README.md (45 days old)', 'wiki/setup.md (38 days old)'],
    impact: 'Stale docs mislead agents and operators.',
    estimatedDurationHours: 6,
    riskLevel: 'LOW',
    prerequisites: [],
    acceptanceCriteria: [
      'Each stale file reviewed and updated or archived',
      'No dead links remaining in docs/ or wiki/',
    ],
    forbiddenActions: ['Do not delete documents without archiving'],
    suggestedFiles: ['docs/', 'wiki/'],
    dedupeKey: 'wiki_docs__stale_markdown',
    priorityScore: 30,
    canRunUnattended: true,
    recommendedRunWindowHours: 6,
    publishStatus: 'READY',
    ...overrides,
  };
}

function makeSystemHealthCandidate(): OptimizationTaskCandidate {
  return makeCandidate({
    taskId: 'system_health__stale_quotes',
    sourceType: 'system_health',
    title: 'Audit and repair stale StockQuote sync pipeline',
    problem: 'Most recent StockQuote was 72h ago.',
    evidence: ['Latest StockQuote: 2026-04-21T12:00:00Z', 'Threshold: must be within 2 trading days'],
    impact: 'All signal generation depends on fresh quote data.',
    estimatedDurationHours: 6,
    dedupeKey: 'system_health__stale_quotes',
    priorityScore: 66,
    suggestedFiles: ['scripts/', 'src/lib/sync/'],
    acceptanceCriteria: [
      'Diagnose root cause of sync gap',
      'Run backfill for all affected dates',
      'Verify StockQuote.createdAt is within 48h after fix',
      'Write gap report to docs/reports/sync_gap_report.md',
    ],
  });
}

function makeMinerState(overrides: Partial<MinerState> = {}): MinerState {
  return {
    version: '1.0',
    publishedDedupeKeys: {},
    dailyQuota: {
      date: new Date().toISOString().slice(0, 10),
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
    },
    lastRunAt: null,
    ...overrides,
  };
}

function makeTaskRecord(dedupeKey: string, status: TaskRecord['status'] = 'QUEUED'): TaskRecord {
  return {
    taskId: 1,
    slug: 'task-1',
    dayKey: '20260424',
    status,
    gateVerdict: null,
    plannerProvider: 'codex',
    workerProvider: 'copilot-daemon',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastOutputAt: null,
    latestProgressSummary: '',
    promptPath: '/tmp/prompt',
    contractPath: '/tmp/contract',
    completedPath: null,
    resultPath: null,
    metaPath: '/tmp/meta',
    workerLogPath: null,
    plannerContext: {
      taskType: 'optimization_wiki_docs',
      game: null,
      regimeState: 'OPTIMIZATION',
      dedupeKey,
      confidenceScore: null,
    },
  };
}

function makeQuota(overrides: Partial<MinerDailyQuota> = {}): MinerDailyQuota {
  return {
    date: new Date().toISOString().slice(0, 10),
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    ...overrides,
  };
}

const MOCK_PROFILE: ProjectProfile = {
  project_name: 'Test',
  project_slug: 'test',
  orchestrator_root: '/tmp',
  backlog_path: '/tmp/backlog.md',
  task_storage_path: '/tmp/tasks',
  log_storage_path: '/tmp/logs',
  database_path: '/tmp/db',
  default_schedule_minutes: 30,
  planner_provider: 'codex',
  worker_provider: 'copilot-daemon',
  planner_rules: {
    must_read_previous_result: false,
    skip_if_latest_running: true,
    retry_replan_required_first: false,
  },
  worker_rules: {
    single_active_task: true,
    finalize_on_permission_block: true,
    finalize_on_stale_output_minutes: 120,
  },
  protected_paths: [],
  required_checks: [],
  allowed_reference_paths: [],
  required_contract_fields: [],
  required_result_fields: [],
  ui: {
    show_contract: true,
    show_result: true,
    show_gate_verdict: true,
    show_last_output_time: true,
    show_latest_progress_summary: true,
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Autonomous Optimization Miner — pure function tests', () => {

  // ── Test 1: Learning exhausted but wiki task generated ──────────────────────
  describe('applyPriorityScores', () => {
    it('assigns a positive priorityScore to a wiki_docs candidate even when trading learning is exhausted', () => {
      const wikiCandidate = makeCandidate({ sourceType: 'wiki_docs', priorityScore: 0 });
      const [scored] = applyPriorityScores([wikiCandidate]);

      expect(scored).toBeDefined();
      expect(scored!.priorityScore).toBeGreaterThan(0);
      expect(scored!.sourceType).toBe('wiki_docs');
    });

    it('scores system_health higher than wiki_docs (stale data is higher impact)', () => {
      const systemCandidate = makeCandidate({ sourceType: 'system_health', priorityScore: 0 });
      const wikiCandidate = makeCandidate({ sourceType: 'wiki_docs', priorityScore: 0, dedupeKey: 'other' });
      const [s, w] = applyPriorityScores([systemCandidate, wikiCandidate]);

      expect(s!.priorityScore).toBeGreaterThan(w!.priorityScore);
    });

    it('penalizes HIGH risk candidates (lower net score than equivalent LOW risk)', () => {
      const lowRisk = makeCandidate({ sourceType: 'system_health', riskLevel: 'LOW', priorityScore: 0 });
      const highRisk = makeCandidate({ sourceType: 'system_health', riskLevel: 'HIGH', priorityScore: 0, dedupeKey: 'other' });
      const scored = applyPriorityScores([lowRisk, highRisk]);

      expect(scored[0]!.priorityScore).toBeGreaterThan(scored[1]!.priorityScore);
    });
  });

  // ── Test 2: Duplicate task suppressed ────────────────────────────────────────
  describe('deduplicateAgainstState', () => {
    it('suppresses a candidate whose dedupeKey was recently published in miner_state', () => {
      const candidate = makeCandidate();
      const state = makeMinerState({
        publishedDedupeKeys: {
          'wiki_docs__stale_markdown': new Date().toISOString(), // published just now
        },
      });

      const result = deduplicateAgainstState([candidate], state, []);
      expect(result).toHaveLength(0);
    });

    it('allows a candidate whose dedupeKey was published > 14 days ago (TTL expired)', () => {
      const candidate = makeCandidate();
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const state = makeMinerState({
        publishedDedupeKeys: { 'wiki_docs__stale_markdown': fifteenDaysAgo },
      });

      const result = deduplicateAgainstState([candidate], state, []);
      expect(result).toHaveLength(1);
    });

    it('suppresses a candidate that is already in-flight in the task index', () => {
      const candidate = makeCandidate();
      const state = makeMinerState();
      const inFlightTask = makeTaskRecord('wiki_docs__stale_markdown', 'QUEUED');

      const result = deduplicateAgainstState([candidate], state, [inFlightTask]);
      expect(result).toHaveLength(0);
    });

    it('allows a candidate when the matching task is COMPLETED (not in-flight)', () => {
      const candidate = makeCandidate();
      const state = makeMinerState();
      const completedTask = makeTaskRecord('wiki_docs__stale_markdown', 'COMPLETED');

      const result = deduplicateAgainstState([candidate], state, [completedTask]);
      expect(result).toHaveLength(1);
    });
  });

  // ── Test 3: Unsafe strategy tuning blocked ───────────────────────────────────
  describe('validateCandidate', () => {
    it('rejects a candidate with publishStatus UNSAFE', () => {
      const unsafeCandidate = makeCandidate({ publishStatus: 'UNSAFE' });
      expect(validateCandidate(unsafeCandidate)).toBe(false);
    });

    it('rejects a candidate that cannot run unattended', () => {
      const manualCandidate = makeCandidate({ canRunUnattended: false });
      expect(validateCandidate(manualCandidate)).toBe(false);
    });

    it('rejects a candidate with no acceptance criteria (vague task)', () => {
      const vagueCandidate = makeCandidate({ acceptanceCriteria: [] });
      expect(validateCandidate(vagueCandidate)).toBe(false);
    });

    it('rejects a candidate with estimated duration < 4h (too short for 8h slot)', () => {
      const shortCandidate = makeCandidate({ estimatedDurationHours: 2 });
      expect(validateCandidate(shortCandidate)).toBe(false);
    });

    it('rejects a candidate with estimated duration > 8h (too long)', () => {
      const tooLong = makeCandidate({ estimatedDurationHours: 10 });
      expect(validateCandidate(tooLong)).toBe(false);
    });

    it('accepts a well-formed READY candidate', () => {
      const good = makeCandidate();
      expect(validateCandidate(good)).toBe(true);
    });
  });

  // ── Test 4: High-priority stale data task published ───────────────────────────
  describe('enforceQuota', () => {
    it('publishes a high-priority system_health task when quota is not exhausted', () => {
      const quota = makeQuota({ lowRisk: 0 });
      const systemCandidate = makeSystemHealthCandidate();
      const result = enforceQuota([systemCandidate], quota);

      expect(result).toHaveLength(1);
      expect(result[0]!.sourceType).toBe('system_health');
    });

    it('blocks a LOW risk candidate when lowRisk quota is exhausted (5/day)', () => {
      const quota = makeQuota({ lowRisk: 5 });
      const candidate = makeCandidate();
      const result = enforceQuota([candidate], quota);

      expect(result).toHaveLength(0);
    });

    it('blocks a HIGH risk candidate when highRisk quota is exhausted (1/day)', () => {
      const quota = makeQuota({ highRisk: 1 });
      const highRiskCandidate = makeCandidate({ riskLevel: 'HIGH', dedupeKey: 'high-risk-task' });
      const result = enforceQuota([highRiskCandidate], quota);

      expect(result).toHaveLength(0);
    });

    it('selects from mixed pool respecting per-risk quota caps', () => {
      // lowRisk=4 already used (4/5), highRisk=0 (0/1)
      // → low1 fits (→ 5/5 full), high1 fits (→ 1/1 full), low2 is BLOCKED (quota full)
      const quota = makeQuota({ lowRisk: 4, highRisk: 0 });
      const low1 = makeCandidate({ dedupeKey: 'low-1' });
      const high1 = makeCandidate({ riskLevel: 'HIGH', dedupeKey: 'high-1' });
      const low2 = makeCandidate({ dedupeKey: 'low-2', taskId: 'low-2' });
      const result = enforceQuota([low1, high1, low2], quota);

      expect(result).toHaveLength(2); // low1 + high1 — low2 blocked after quota exhausted
      expect(result.some((c) => c.dedupeKey === 'low-1')).toBe(true);
      expect(result.some((c) => c.dedupeKey === 'high-1')).toBe(true);
      expect(result.some((c) => c.dedupeKey === 'low-2')).toBe(false);
    });
  });

  // ── Test 5: UI usability task generated and converts to valid PlannerDraft ───
  describe('candidateToDraft', () => {
    it('converts a ui_ux candidate to a PlannerDraft with v2 contract', () => {
      const uiCandidate = makeCandidate({
        taskId: 'ui_ux__missing_loading_error_states',
        sourceType: 'ui_ux',
        title: 'Add loading.tsx and error.tsx to pages missing async feedback',
        dedupeKey: 'ui_ux__missing_loading_error_states',
        evidence: ['Missing loading/error in src/app/orchestrator'],
        suggestedFiles: ['src/app/orchestrator/'],
        acceptanceCriteria: [
          'loading.tsx added to all identified directories',
          'error.tsx added to all identified directories',
          'TypeScript compiles with zero errors',
        ],
      });

      const draft = candidateToDraft(uiCandidate, MOCK_PROFILE);

      // Prompt contains key sections
      expect(draft.promptMarkdown).toContain('8-Hour Optimization Task');
      expect(draft.promptMarkdown).toContain('Acceptance Criteria');
      expect(draft.promptMarkdown).toContain('Forbidden Actions');
      expect(draft.promptMarkdown).toContain('loading.tsx added');

      // Contract is v2 with correct fields
      expect(draft.contract.version).toBe('2.0');
      expect(draft.contract.trigger_reason).toContain('OPTIMIZATION_MINER@source=ui_ux');
      expect(draft.contract.acceptance_tests).toHaveLength(3);
      expect(draft.contract.expected_duration_hours).toBe(6);
      expect(draft.contract.target_files).toContain('src/app/orchestrator/');

      // PlannerContext is regime-tagged
      expect(draft.plannerContext.taskType).toBe('optimization_ui_ux');
      expect(draft.plannerContext.regimeState).toBe('OPTIMIZATION');
      expect(draft.plannerContext.dedupeKey).toBe('ui_ux__missing_loading_error_states');
    });

    it('sets objective equal to candidate title', () => {
      const candidate = makeCandidate();
      const draft = candidateToDraft(candidate, MOCK_PROFILE);
      expect(draft.objective).toBe(candidate.title);
    });

    it('includes forbidden_changes in contract from forbiddenActions', () => {
      const candidate = makeCandidate({
        forbiddenActions: ['Do not delete documents without archiving', 'Do not change routing'],
      });
      const draft = candidateToDraft(candidate, MOCK_PROFILE);
      expect(draft.contract.forbidden_changes).toContain('Do not delete documents without archiving');
    });
  });

  // ── Test 6: price_analysis_quality candidate behaviour ────────────────────
  describe('price_analysis_quality candidates', () => {
    // Helper: a price_analysis_quality candidate with all required fields
    function makePriceAnalysisCandidate(overrides: Partial<OptimizationTaskCandidate> = {}): OptimizationTaskCandidate {
      return makeCandidate({
        taskId: 'price_analysis_quality__data_audit',
        sourceType: 'price_analysis_quality',
        title: 'Audit price data quality for active simulated trades and current candidates',
        problem: 'Latest quote: 2026-04-21T00:00:00.000Z (stale > 48h).',
        evidence: ['Latest quote: 2026-04-21T00:00:00.000Z (stale > 48h)', '3 active simulated-trade symbols need fresh price data'],
        acceptanceCriteria: [
          'Produce JSON report of latest quote date per active symbol (docs/reports/price_data_quality.json)',
          'Report count of missing trading days per symbol for last 30 days',
          'Verify pipeline sync covers all open-trade symbols within 48h',
        ],
        forbiddenActions: [
          'Do not change live trading thresholds',
          'Do not modify position sizing or risk floor',
          'Diagnostics and reports only — no automated strategy changes',
        ],
        riskLevel: 'LOW',
        dedupeKey: 'price_analysis_quality__data_audit',
        priorityScore: 65,
        suggestedFiles: ['scripts/', 'src/lib/sync/', 'docs/reports/'],
        ...overrides,
      });
    }

    it('passes validateCandidate — all required fields present', () => {
      const c = makePriceAnalysisCandidate();
      expect(validateCandidate(c)).toBe(true);
    });

    it('applyPriorityScores assigns a score >= 55 for price_analysis_quality', () => {
      // Simulate raw candidate with priorityScore 0 (pre-scoring)
      const raw = makePriceAnalysisCandidate({ priorityScore: 0 });
      const [scored] = applyPriorityScores([raw]);
      expect(scored!.priorityScore).toBeGreaterThanOrEqual(55);
    });

    it('deduplicates price_analysis_quality when key already published within TTL', () => {
      const state = makeMinerState({
        publishedDedupeKeys: {
          'price_analysis_quality__data_audit': new Date().toISOString(), // published just now → within TTL
        },
      });
      const candidate = makePriceAnalysisCandidate();
      const result = deduplicateAgainstState([candidate], state, []);
      expect(result).toHaveLength(0);
    });

    it('does NOT deduplicate when key was published beyond 14-day TTL', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const state = makeMinerState({
        publishedDedupeKeys: { 'price_analysis_quality__data_audit': fifteenDaysAgo },
      });
      const candidate = makePriceAnalysisCandidate();
      const result = deduplicateAgainstState([candidate], state, []);
      expect(result).toHaveLength(1);
    });

    it('forbids threshold tuning — forbidden_changes in candidateToDraft output', () => {
      const candidate = makePriceAnalysisCandidate();
      const draft = candidateToDraft(candidate, MOCK_PROFILE);
      const forbidden = draft.contract.forbidden_changes.join(' ');
      expect(forbidden).toContain('threshold');
      expect(forbidden).not.toContain('change live trading thresholds\nAllowed'); // no accidental allow
    });

    it('acceptance criteria contain measurable output (report / JSON)', () => {
      const candidate = makePriceAnalysisCandidate();
      const criteriaText = candidate.acceptanceCriteria.join(' ').toLowerCase();
      const hasMeasurableOutput = criteriaText.includes('json') || criteriaText.includes('report') || criteriaText.includes('csv');
      expect(hasMeasurableOutput).toBe(true);
    });

    it('candidateToDraft adds native ingest contract metadata for price_analysis_quality', () => {
      const candidate = makePriceAnalysisCandidate();
      const draft = candidateToDraft(candidate, MOCK_PROFILE);

      expect(draft.contract.ingest_contract).toEqual(expect.objectContaining({
        kind: 'price_analysis_native_report',
        dedupeKey: 'price_analysis_quality__data_audit',
        reportPath: 'docs/reports/price_data_quality.json',
        insightTypeCandidate: 'data_quality_issue',
        requiredScopeField: 'affectedSymbols',
        noThresholdChanges: true,
      }));
      expect(draft.contract.acceptance_tests).toEqual(expect.arrayContaining([
        'Write native insight report JSON to docs/reports/price_data_quality.json',
        'No threshold changes — diagnostics only, using existing thresholds',
      ]));
    });
  });

});
