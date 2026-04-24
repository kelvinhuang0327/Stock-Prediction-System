import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { SignalStateResult } from './ctoTypes';
import type {
  AcceptanceResult,
  PlannerTaskFingerprint,
  ProjectProfile,
  ResearchBacklogItem,
  ResearchFocus,
  SystemStateSnapshot,
  TaskContract,
  TaskResult,
  WorkerProvider,
} from './types';

const exec = promisify(execCallback);

export interface PlannerDraftInput {
  profile: ProjectProfile;
  backlogMarkdown: string;
  previousResult: TaskResult | null;
  /** Optional structured research item from backlog_research.json; takes priority over markdown text. */
  researchItem?: ResearchBacklogItem | null;
}

export interface PlannerDraft {
  objective: string;
  promptMarkdown: string;
  contract: TaskContract;
  plannerContext: PlannerTaskFingerprint;
}

export interface WorkerExecutionInput {
  workerProvider: WorkerProvider;
  taskId: number;
  promptPath: string;
  contractPath: string;
  objective: string;
  profile: ProjectProfile;
}

export interface WorkerExecutionOutput {
  completedMarkdown: string;
  changedFiles: string[];
  acceptanceResults: AcceptanceResult[];
  workerStdout: string;
  errorMarkersHit: string[];
  runtimeFailed: boolean;
  runtimeErrorMessage?: string;
  failureProvider?: WorkerProvider | null;
  failureReason?: 'rate_limit' | 'runtime_failure' | null;
  resetHint?: string | null;
  httpStatus?: number | null;
}

const BANNED_OBJECTIVE_PATTERNS = [
  /SIGNAL_EXHAUSTED/i,
  /NO_SIGNAL/i,
  /停止建議/,
  /目前沒有方向/,
];

interface ResearchTaskTemplateInput {
  title: string;
  objective: string;
  contextLines: string[];
  profile: ProjectProfile;
  plannerContext: PlannerTaskFingerprint;
  previousSummary?: string | null;
  focusArea?: string;
  // v2 fields
  background?: string;
  trigger_reason?: string;
  system_state?: SystemStateSnapshot | null;
  focuses?: ResearchFocus[];
  expected_duration_hours?: number;
  target_files?: string[];
  statistical_requirements?: string[];
}

/** Build per-focus section blocks for v2 multi-focus prompts. */
function buildFocusSections(focuses: ResearchFocus[]): string[] {
  const lines: string[] = [];
  for (const focus of focuses) {
    lines.push(`### Focus ${focus.key.toUpperCase()}: ${focus.title}`);
    lines.push('');
    lines.push(`**Hypothesis:** ${focus.hypothesis}`);
    lines.push('');
    lines.push('**Required steps:**');
    for (const step of focus.required_steps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
    lines.push('**Target outputs:**');
    for (const output of focus.target_outputs) {
      lines.push(`- \`${output}\``);
    }
    if (focus.statistical_tests && focus.statistical_tests.length > 0) {
      lines.push('');
      lines.push('**Statistical gates:**');
      for (const test of focus.statistical_tests) {
        lines.push(`- ${test}`);
      }
    }
    lines.push('');
  }
  return lines;
}

function buildEightHourResearchTask(input: ResearchTaskTemplateInput): Pick<PlannerDraft, 'contract' | 'promptMarkdown'> {
  const isMultiFocus = (input.focuses?.length ?? 0) >= 2;
  const focusArea = input.focusArea ?? input.objective;

  // ── Phases ──────────────────────────────────────────────────────────────────
  const scope = isMultiFocus
    ? [
        `Phase 1: Read background context, snapshot current strategy state, and document existing edge / sharpe / drawdown for each focus area before proposing any changes.`,
        `Phase 2: For each focus area, generate at least 1 distinct strategy variant with explicit entry, exit, sizing, and risk-control hypothesis. Combined total must be ≥ 3 variants.`,
        `Phase 3: Run backtest batches at 150 / 500 / 1500 observations for every strategy variant. Record edge, sharpe, drawdown, win rate per focus in a comparable table.`,
        `Phase 4: Execute Monte Carlo simulation (≥ 1000 runs per strategy) and perform parameter sensitivity analysis per focus. Identify robust vs fragile settings.`,
        `Phase 5: Cross-focus synthesis — compare all variants (per focus and across focuses) against the existing baseline, rank quantitatively, and issue a final recommendation with rollout conditions.`,
      ]
    : [
        `Phase 1: Perform structural analysis on ${focusArea}, baseline the current production strategy, and document the existing edge / sharpe / drawdown before proposing any changes.`,
        `Phase 2: Generate at least 3 strategy variants for ${focusArea}, each with explicit entry, exit, sizing, and risk-control hypotheses.`,
        `Phase 3: Run backtest batches at 150 / 500 / 1500 observations for every strategy variant and record edge, sharpe, drawdown, win rate, and stability notes in a comparable table.`,
        `Phase 4: Execute Monte Carlo simulation at least 1000 runs per strategy, then perform parameter optimization / sensitivity analysis to identify robust vs fragile settings.`,
        `Phase 5: Compare all variants against the existing strategy baseline, rank them quantitatively, and issue a final recommendation with rollout conditions and follow-up validation steps.`,
      ];

  const constraints = [
    'Do not modify protected paths from project profile.',
    'Do not claim completion without machine-readable quantitative evidence.',
    'Every statistical conclusion must cite the corresponding backtest or Monte Carlo evidence.',
    'If blocked by runtime or permissions, finalize with clear failure evidence rather than narrative-only output.',
    ...(input.statistical_requirements?.map((req) => `Statistical gate required: ${req}.`) ?? []),
  ];

  const acceptanceTests = [
    isMultiFocus
      ? 'Each defined focus produces at least 1 strategy variant; combined total is ≥ 3 variants with explicit rules and assumptions.'
      : 'The task outputs at least 3 strategy variants with explicit rules and assumptions.',
    'The task includes backtest evidence for 150 / 500 / 1500 windows and reports edge / sharpe / drawdown for each strategy.',
    'The task includes Monte Carlo results with at least 1000 runs per strategy plus parameter optimization findings.',
    'The task compares all variants against the existing strategy and ends with a final recommendation.',
    ...(isMultiFocus ? ['Cross-focus synthesis section identifies the best overall recommendation across all focus areas.'] : []),
  ];

  // Collect all required outputs — base set + per-focus artifacts
  const focusOutputs = (input.focuses ?? []).flatMap((f) => f.target_outputs);
  const requiredOutputs = Array.from(new Set([
    'strategy_candidates_3_plus',
    'backtest_report_150_500_1500',
    'monte_carlo_report_1000_plus',
    'comparison_matrix_vs_existing',
    'final_recommendation',
    'completed_markdown',
    'task_result_json',
    'changed_files_list',
    ...focusOutputs,
    ...(input.target_files ?? []),
  ]));

  const contract: TaskContract = {
    version: '2.0',
    objective: input.objective,
    scope,
    constraints,
    acceptance_tests: acceptanceTests,
    required_outputs: requiredOutputs,
    forbidden_changes: input.profile.protected_paths,
    planner_context: input.plannerContext,
    handoff_questions: [
      'Which recommended strategy (and focus) should move to the next validation cycle and why?',
      'Which risk factors or weak assumptions still require a follow-up task?',
      ...(isMultiFocus ? ['Which focus area showed the weakest signal and should be deprioritised?'] : []),
    ],
    // v2 additions
    background: input.background,
    trigger_reason: input.trigger_reason,
    system_state: input.system_state,
    focuses: input.focuses,
    expected_duration_hours: input.expected_duration_hours ?? 8,
    target_files: input.target_files,
    statistical_requirements: input.statistical_requirements,
  };

  // ── Prompt markdown ──────────────────────────────────────────────────────────
  const promptSections: string[] = [
    `# ${input.title}`,
    '',
    '## Objective',
    input.objective,
    '',
  ];

  if (input.background) {
    promptSections.push('## Background', input.background, '');
  }

  if (input.system_state) {
    const s = input.system_state;
    promptSections.push(
      '## System State (at task creation)',
      `- Signal state: **${s.signal_state}**`,
      `- Confidence: ${(s.confidence_score * 100).toFixed(0)}%`,
      s.win_rate !== null ? `- Win rate: ${(s.win_rate * 100).toFixed(1)}%` : '- Win rate: insufficient data',
      s.win_rate_delta !== null ? `- Win-rate delta: ${(s.win_rate_delta * 100).toFixed(1)}%` : '- Win-rate delta: N/A',
      `- Penalized setups: ${s.penalized_setups}`,
      `- Data coverage: ${s.data_coverage}`,
      '',
    );
  }

  promptSections.push('## Context');
  for (const line of input.contextLines) {
    promptSections.push(`- ${line}`);
  }
  promptSections.push('');

  if (isMultiFocus && input.focuses) {
    promptSections.push('## Research Focus Areas', '');
    promptSections.push(...buildFocusSections(input.focuses));
  }

  promptSections.push(
    '## Execution Phases',
    ...scope.map((line) => `- ${line}`),
    '',
    '## Required Quantitative Outputs',
    '- At least 3 strategy variants (across all focus areas if multi-focus).',
    '- Backtest report for 150 / 500 / 1500 windows.',
    '- Monte Carlo report with >= 1000 runs per strategy.',
    '- Comparison matrix versus the existing strategy baseline.',
    '- Final recommendation with rollout conditions.',
    '',
  );

  if ((input.target_files ?? []).length > 0) {
    promptSections.push('## Source / Target Files');
    for (const file of input.target_files!) {
      promptSections.push(`- ${file}`);
    }
    promptSections.push('');
  }

  if ((input.statistical_requirements ?? []).length > 0) {
    promptSections.push('## Statistical Gates');
    for (const req of input.statistical_requirements!) {
      promptSections.push(`- ${req}`);
    }
    promptSections.push('');
  }

  promptSections.push(
    '## Constraints',
    ...constraints.map((item) => `- ${item}`),
    '',
    '## Acceptance Criteria',
    ...acceptanceTests.map((item) => `- ${item}`),
    '',
    '## Handoff Notes',
    `- ${input.previousSummary ?? 'No previous task result found.'}`,
    '- Use quantitative evidence only; avoid narrative-only conclusions.',
    '',
    '## Allowed References',
    ...input.profile.allowed_reference_paths.map((item) => `- ${item}`),
  );

  const promptMarkdown = promptSections.join('\n');
  return { contract, promptMarkdown };
}

function pickBacklogObjective(backlogMarkdown: string): string {
  const lines = backlogMarkdown.split('\n');
  const uncheckedPattern = /^\s*-\s*\[\s\]\s+(.+)\s*$/;
  const bulletPattern = /^\s*-\s+(.+)\s*$/;
  for (const line of lines) {
    const unchecked = uncheckedPattern.exec(line);
    if (unchecked?.[1] && !BANNED_OBJECTIVE_PATTERNS.some((pattern) => pattern.test(unchecked[1]))) {
      return unchecked[1].trim();
    }
  }
  for (const line of lines) {
    const bullet = bulletPattern.exec(line);
    if (bullet?.[1] && !BANNED_OBJECTIVE_PATTERNS.some((pattern) => pattern.test(bullet[1]))) {
      return bullet[1].trim();
    }
  }
  return 'Design and validate three strategy variants with backtest, Monte Carlo, comparison, and a final recommendation.';
}

function extractFirstMatch(pattern: RegExp, value: string): string | null {
  return pattern.exec(value)?.[1] ?? null;
}

function formatPercent(value: number | null, fallback: string): string {
  if (value === null) return fallback;
  return `${(value * 100).toFixed(1)}%`;
}

function inferPlannerContext(objective: string): PlannerTaskFingerprint {
  const normalized = objective.trim();
  const tokenPool = normalized.toUpperCase();

  const game = extractFirstMatch(/\b(BIG_LOTTO|POWER_LOTTO|DAILY_539)\b/, tokenPool);
  const regimeState = extractFirstMatch(/\b(TRUE_EXHAUSTED|COLD_REGIME|SIGNAL_SATURATED|NORMAL)\b/, tokenPool);

  const taskTypeFromToken = extractFirstMatch(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/, normalized);
  const taskTypeFromRegime = regimeState ? `${regimeState.toLowerCase()}_analysis` : null;
  const taskTypeFromObjective = normalized
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, 64);
  const taskTypeFallback = taskTypeFromObjective || `objective_${Buffer.from(normalized).toString('base64url').slice(0, 24)}`;
  const taskType =
    taskTypeFromToken ??
    taskTypeFromRegime ??
    taskTypeFallback;

  const dedupeKey = [taskType, game ?? 'GLOBAL', regimeState ?? 'UNSPECIFIED'].join('|');

  return {
    taskType,
    game,
    regimeState,
    dedupeKey,
  };
}

// ─── Regime-Aware Task Builders ──────────────────────────────────────────────
// Mirror SOURCE: LotteryNew/orchestrator/planner_tick.py _build_cold_regime_payload
// and _build_saturated_payload, adapted for stock trading domain.

export function buildColdRegimePayload(
  signalState: SignalStateResult,
  profile: ProjectProfile,
): PlannerDraft {
  const { state, confidenceScore, reason, features } = signalState;

  const capturedAt = new Date().toISOString();
  const systemState: SystemStateSnapshot = {
    signal_state: state,
    confidence_score: confidenceScore,
    win_rate: features.overallWinRate,
    win_rate_delta: features.winRateDelta,
    penalized_setups: features.penalizedSetupCount,
    data_coverage: features.dataCoverage,
    captured_at: capturedAt,
  };

  // ── Three structured research focuses (mirrors external system C/D/H pattern) ──
  const focuses: ResearchFocus[] = [
    {
      key: 'cold_phase',
      title: 'Cold-Phase Strategy Analysis',
      hypothesis: 'Existing strategies underperform during cold-phase periods due to setup penalties and declining win rate; targeted cold-phase variants can restore positive edge.',
      required_steps: [
        'Identify all penalized setup types that fired during the cold-phase window.',
        'Baseline the current strategy edge / sharpe / drawdown exclusively within cold-phase observation windows.',
        'Generate ≥ 2 cold-phase-specific variants (e.g. reduced lot size, tighter stop, cold-filter bypass).',
        'Backtest each variant at 150 / 500 / 1500 observations within cold-phase data only.',
        'Run Monte Carlo (≥ 1000 runs) per variant and record confidence intervals.',
      ],
      target_outputs: ['cold_phase_strategy_report.json', 'cold_phase_backtest_table.json'],
      statistical_tests: ['perm_p < 0.05 on cold-phase edge vs baseline', 'Monte Carlo 5th-percentile drawdown < 20%'],
    },
    {
      key: 'hybrid_entry',
      title: 'Hybrid Entry Strategy',
      hypothesis: 'Combining cold-phase signal with secondary momentum or volume indicators can improve entry timing and reduce false positives during signal drought.',
      required_steps: [
        'Survey the available secondary indicator signals (volume ratio, momentum slope, open-interest trend).',
        'Define ≥ 2 hybrid entry rules that gate or weight cold-phase entries with a secondary condition.',
        'Backtest hybrid entries at 150 / 500 / 1500 observations across both cold and transitional periods.',
        'Run Monte Carlo (≥ 1000 runs) and perform parameter sensitivity on the secondary gating threshold.',
        'Compare hybrid variants against pure cold-phase variants and existing baseline.',
      ],
      target_outputs: ['hybrid_entry_strategy_report.json', 'hybrid_backtest_table.json'],
      statistical_tests: ['McNemar test on hybrid vs cold-phase entry classification', 'Sharpe ratio improvement ≥ 0.1 vs baseline'],
    },
    {
      key: 'distribution_bias',
      title: 'Distribution Bias Analysis',
      hypothesis: 'Outcome distribution patterns during cold-phase periods exhibit measurable skew or clustering that can be exploited with distribution-aware position sizing.',
      required_steps: [
        'Compute outcome distribution statistics (skewness, kurtosis, chi-squared vs uniform) across cold-phase windows.',
        'Identify any temporal clustering or run-length bias in winning vs losing streaks during cold phases.',
        'Design ≥ 1 distribution-aware sizing variant (e.g. anti-martingale on identified clusters).',
        'Backtest the distribution-aware strategy at 150 / 500 / 1500 observations.',
        'Validate that chi-squared and permutation tests confirm non-randomness before committing to the variant.',
      ],
      target_outputs: ['distribution_bias_report.json', 'distribution_backtest_table.json'],
      statistical_tests: ['chi-squared p < 0.05 for outcome distribution', 'permutation test run-length p < 0.05'],
    },
  ];

  let subType: string;
  let objective: string;
  const contextLines: string[] = [
    'Trigger: COLD_REGIME classifier fired.',
    `Reason: ${reason}`,
    `Overall win rate: ${formatPercent(features.overallWinRate, 'insufficient data')}`,
    `Win-rate delta: ${formatPercent(features.winRateDelta, 'N/A')}`,
    `Penalized setups: ${features.penalizedSetupCount}`,
    `Trade count: ${features.organicTradeCount} organic / ${features.fullTradeCount} full`,
    `Data coverage: ${features.dataCoverage}`,
    `Confidence score: ${(confidenceScore * 100).toFixed(0)}%`,
  ];

  if (features.penalizedSetupCount >= 2) {
    subType = 'setup_penalty_investigation';
    objective = `Investigate ${features.penalizedSetupCount} penalized setup types in COLD_REGIME and design recovery-ready strategy variants — covering cold-phase recovery, hybrid entry, and distribution bias — with quantified validation.`;
  } else if (features.winRateDelta !== null && features.winRateDelta < -0.05) {
    subType = 'win_rate_decline_analysis';
    objective = 'Analyze win-rate decline in COLD_REGIME across three research dimensions (cold-phase strategy, hybrid entry timing, distribution bias) and validate variants with deep backtest plus Monte Carlo evidence.';
  } else {
    subType = 'cold_phase_analysis';
    objective = 'Analyze COLD_REGIME signal health across three structured focus areas — cold-phase strategy, hybrid entry, and distribution bias — and produce validated recovery strategy variants backed by backtest, Monte Carlo, and baseline comparison.';
  }

  const dedupeKey = [subType, 'GLOBAL', state].join('|');
  const plannerContext: PlannerTaskFingerprint = {
    taskType: subType,
    game: null,
    regimeState: state,
    dedupeKey,
    confidenceScore,
    regimeTaskType: subType,
  };

  const background = [
    `The signal classifier detected COLD_REGIME with ${(confidenceScore * 100).toFixed(0)}% confidence.`,
    features.penalizedSetupCount > 0
      ? `${features.penalizedSetupCount} setup type(s) are currently penalized, which may be suppressing legitimate signals.`
      : 'No setups are currently penalized.',
    features.winRateDelta !== null && features.winRateDelta < 0
      ? `Win rate has declined ${formatPercent(Math.abs(features.winRateDelta), 'N/A')} recently, indicating active signal degradation.`
      : 'Win rate delta is neutral or positive.',
    'This task covers three concurrent research focuses: cold-phase-specific strategy variants, hybrid entry design, and distribution bias exploitation.',
  ].join(' ');

  const { contract, promptMarkdown } = buildEightHourResearchTask({
    title: 'Cold Regime Deep Research Task — 3-Focus Recovery Analysis',
    objective,
    background,
    trigger_reason: `COLD_REGIME@confidence=${confidenceScore.toFixed(2)}@reason=${reason}`,
    system_state: systemState,
    focuses,
    expected_duration_hours: 8,
    target_files: [
      'cold_phase_strategy_report.json',
      'cold_phase_backtest_table.json',
      'hybrid_entry_strategy_report.json',
      'hybrid_backtest_table.json',
      'distribution_bias_report.json',
      'distribution_backtest_table.json',
    ],
    statistical_requirements: [
      'perm_p < 0.05 on cold-phase edge vs baseline',
      'Monte Carlo 5th-percentile drawdown < 20% for accepted variants',
      'McNemar test on hybrid entry classification',
      'chi-squared p < 0.05 for distribution bias claim',
    ],
    contextLines,
    profile,
    plannerContext,
    focusArea: subType,
  });

  return { objective, promptMarkdown, contract, plannerContext };
}

export function buildSaturatedPayload(
  signalState: SignalStateResult,
  backlogMarkdown: string,
  profile: ProjectProfile,
): PlannerDraft {
  const { state, confidenceScore, reason, features } = signalState;

  const capturedAt = new Date().toISOString();
  const systemState: SystemStateSnapshot = {
    signal_state: state,
    confidence_score: confidenceScore,
    win_rate: features.overallWinRate,
    win_rate_delta: features.winRateDelta,
    penalized_setups: features.penalizedSetupCount,
    data_coverage: features.dataCoverage,
    captured_at: capturedAt,
  };

  const hasShadowMention = backlogMarkdown.toLowerCase().includes('shadow');

  // ── Three structured research focuses for saturated regime ──
  const focuses: ResearchFocus[] = [
    {
      key: 'signal_quality',
      title: 'Signal Quality & Noise Filtering',
      hypothesis: 'SIGNAL_SATURATED state contains extractable high-quality sub-signals that survive noise filtering; isolating them improves per-trade edge.',
      required_steps: [
        'Identify the top 3 setup types by trade frequency in the saturated window.',
        'Apply noise filters (volume gate, spread filter, time-of-day restriction) to each setup type.',
        'Backtest filtered variants at 150 / 500 / 1500 observations and compare against unfiltered.',
        'Run Monte Carlo (≥ 1000 runs) on the best-filtered variant.',
      ],
      target_outputs: ['signal_quality_filter_report.json', 'signal_quality_backtest_table.json'],
      statistical_tests: ['perm_p < 0.05 on filtered vs unfiltered edge', 'Sharpe improvement ≥ 0.1 after filtering'],
    },
    {
      key: 'shadow_strategy',
      title: 'Shadow Strategy Tracking & Promotion',
      hypothesis: 'Running shadow strategies in parallel during saturation allows identification of candidates ready for promotion to production without live capital risk.',
      required_steps: [
        hasShadowMention
          ? 'Review existing shadow strategy results from the backlog and update performance metrics.'
          : 'Design shadow strategy tracking framework: define tracking period, performance gate, and promotion criteria.',
        'Select ≥ 2 candidate strategies for shadow tracking with explicit promotion thresholds.',
        'Backtest each shadow candidate at 150 / 500 / 1500 observations.',
        'Define a promotion decision rule: minimum edge, sharpe, drawdown, and observation count.',
      ],
      target_outputs: ['shadow_strategy_candidates.json', 'shadow_tracking_report.json'],
      statistical_tests: ['Promoted strategy must show perm_p < 0.05 vs random baseline', 'Drawdown at 5th Monte Carlo percentile < 15%'],
    },
    {
      key: 'saturation_meta',
      title: 'Saturation Meta-Review & Policy Update',
      hypothesis: 'Persistent SIGNAL_SATURATED state signals that current execution policy is over-trading; reducing position frequency and tightening quality gates will improve risk-adjusted returns.',
      required_steps: [
        'Compute position frequency per unit time in the current saturated period vs historical normal periods.',
        'Identify which acceptance criteria or execution policy thresholds allowed low-quality entries.',
        'Propose updated quality gate thresholds with quantitative justification.',
        'Backtest a policy-tightened variant at 150 / 500 / 1500 observations.',
      ],
      target_outputs: ['saturation_meta_review.json', 'policy_update_proposal.json'],
      statistical_tests: ['McNemar test on rejected vs accepted entries under new policy', 'chi-squared on position timing distribution'],
    },
  ];

  let subType: string;
  let objective: string;
  const contextLines: string[] = [
    'Trigger: SIGNAL_SATURATED classifier fired.',
    `Reason: ${reason}`,
    `Overall win rate: ${formatPercent(features.overallWinRate, 'N/A')}`,
    `Win-rate delta: ${formatPercent(features.winRateDelta, 'N/A')}`,
    `Organic trades: ${features.organicTradeCount}`,
    `Penalized setups: ${features.penalizedSetupCount}`,
    `Data coverage: ${features.dataCoverage}`,
    `Confidence score: ${(confidenceScore * 100).toFixed(0)}%`,
  ];

  if (features.penalizedSetupCount > 0) {
    subType = 'signal_quality_filter';
    objective = 'Filter noise in SIGNAL_SATURATED state across three research focuses — signal quality isolation, shadow strategy promotion, and saturation meta-review — and validate improvements against the current baseline.';
  } else if (hasShadowMention) {
    subType = 'meta_level_review';
    objective = 'Perform a SIGNAL_SATURATED meta-review across three dimensions: signal quality filtering, shadow strategy tracking, and execution policy tightening. Validate all variants against baseline.';
  } else {
    subType = 'shadow_strategy_tracking';
    objective = 'Build shadow strategy tracking in SIGNAL_SATURATED state, conduct signal quality analysis, and perform saturation meta-review with three validated candidate variants and promotion criteria.';
  }

  const dedupeKey = [subType, 'GLOBAL', state].join('|');
  const plannerContext: PlannerTaskFingerprint = {
    taskType: subType,
    game: null,
    regimeState: state,
    dedupeKey,
    confidenceScore,
    regimeTaskType: subType,
  };

  const background = [
    `The signal classifier detected SIGNAL_SATURATED with ${(confidenceScore * 100).toFixed(0)}% confidence.`,
    features.penalizedSetupCount > 0
      ? `${features.penalizedSetupCount} penalized setup(s) indicate degraded signal quality.`
      : 'No setups are penalized; saturation may be driven by over-trading or market regime shift.',
    'This task covers three concurrent focuses: signal quality filtering, shadow strategy tracking, and saturation meta-review.',
  ].join(' ');

  const { contract, promptMarkdown } = buildEightHourResearchTask({
    title: 'Signal Saturation Deep Research Task — 3-Focus Analysis',
    objective,
    background,
    trigger_reason: `SIGNAL_SATURATED@confidence=${confidenceScore.toFixed(2)}@reason=${reason}`,
    system_state: systemState,
    focuses,
    expected_duration_hours: 8,
    target_files: [
      'signal_quality_filter_report.json',
      'signal_quality_backtest_table.json',
      'shadow_strategy_candidates.json',
      'shadow_tracking_report.json',
      'saturation_meta_review.json',
      'policy_update_proposal.json',
    ],
    statistical_requirements: [
      'perm_p < 0.05 on filtered vs unfiltered signal quality edge',
      'Shadow strategy promotion gate: drawdown at 5th Monte Carlo percentile < 15%',
      'McNemar test on policy-tightened entry classification',
    ],
    contextLines,
    profile,
    plannerContext,
    focusArea: subType,
  });

  return { objective, promptMarkdown, contract, plannerContext };
}

/**
 * Pick the highest-priority queued research item from the structured backlog.
 * Returns null if none found or if all items are blocked/done.
 */
export function pickResearchBacklogItem(items: ResearchBacklogItem[]): ResearchBacklogItem | null {
  return (
    [...items]
      .filter((item) => item.status === 'queued' && !item.blocked_by)
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  );
}

export function buildPlannerDraft(input: PlannerDraftInput): PlannerDraft {
  const previousSummary = input.previousResult
    ? `Previous task #${input.previousResult.task_id} finished with ${input.previousResult.gate_verdict}.`
    : 'No previous task result found.';

  // ── Prefer structured research item over markdown backlog ──────────────────
  if (input.researchItem) {
    const item = input.researchItem;
    const plannerContext = inferPlannerContext(item.objective);
    const { contract, promptMarkdown } = buildEightHourResearchTask({
      title: `${item.title} (backlog_research #${item.id})`,
      objective: item.objective,
      background: item.notes,
      trigger_reason: item.trigger,
      focuses: undefined, // focuses are composed by regime-aware builders; here we pass target info only
      expected_duration_hours: item.expected_duration_hours,
      target_files: item.target_outputs,
      statistical_requirements: item.statistical_requirements,
      contextLines: [
        `Source: backlog_research.json item "${item.id}" (priority ${item.priority}).`,
        `Trigger: ${item.trigger}`,
        item.signal_state ? `Signal state at scheduling: ${item.signal_state}` : 'Signal state: not specified.',
        previousSummary,
        'Task must satisfy the 8-hour quality gate before creation.',
      ],
      profile: input.profile,
      plannerContext,
      previousSummary,
      focusArea: item.objective,
    });
    return { objective: item.objective, promptMarkdown, contract, plannerContext };
  }

  // ── Fallback: markdown backlog ─────────────────────────────────────────────
  const objective = pickBacklogObjective(input.backlogMarkdown);
  const plannerContext = inferPlannerContext(objective);
  const { contract, promptMarkdown } = buildEightHourResearchTask({
    title: 'Planner Research Task',
    objective,
    contextLines: [
      'Source: backlog priority item selected by planner.',
      `Objective fingerprint: ${plannerContext.dedupeKey}`,
      previousSummary,
      'Task must satisfy the 8-hour quality gate before creation.',
    ],
    profile: input.profile,
    plannerContext,
    previousSummary,
    focusArea: objective,
  });

  return {
    objective,
    promptMarkdown,
    contract,
    plannerContext,
  };
}

function parseChangedFiles(stdout: string): string[] {
  const marker = /CHANGED_FILES_JSON:\s*(\[[\s\S]*?\])/.exec(stdout);
  if (!marker?.[1]) return [];
  try {
    const parsed = JSON.parse(marker[1]) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

const RATE_LIMIT_PATTERNS = [
  /you['’]ve hit your rate limit/i,
  /github\.com\/en\/copilot\/concepts\/rate-limits/i,
  /limit to reset/i,
  /\brate limit(?:ed|ing)?\b/i,
  /\bpremium\b/i,
  /(?:status|code)?\s*429\b/i,
];

function detectProviderRateLimit(message: string, provider: WorkerProvider): {
  finalMessage: string;
  resetHint: string | null;
  httpStatus: number | null;
} | null {
  const normalized = message.trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  const matchCount = RATE_LIMIT_PATTERNS.reduce((count, pattern) => count + (pattern.test(normalized) ? 1 : 0), 0);
  const providerIsCopilot = provider === 'copilot' || provider === 'copilot-daemon';
  const hasStrongSignal =
    /you['’]ve hit your rate limit/i.test(normalized) ||
    /github\.com\/en\/copilot\/concepts\/rate-limits/i.test(normalized) ||
    /(?:status|code)?\s*429\b/i.test(normalized);

  if (!hasStrongSignal && !(providerIsCopilot && matchCount >= 1) && matchCount < 2) {
    return null;
  }

  const sentenceMatches = normalized.match(/[^.!?\n]+[.!?]?/g) ?? [normalized];
  const resetSentence = sentenceMatches.find((sentence) => /reset|wait|premium/i.test(sentence))?.trim() ?? null;
  const httpStatus = /(?:status|code)?\s*(429)\b/i.exec(normalized)?.[1];
  const resetHint = resetSentence || (lower.includes('rate limit') ? 'Wait for the provider limit to reset or switch to another provider.' : null);

  return {
    finalMessage: normalized,
    resetHint,
    httpStatus: httpStatus ? Number(httpStatus) : null,
  };
}

function interpolateCommand(template: string, input: WorkerExecutionInput): string {
  const replace = (source: string, token: string, value: string): string => source.split(token).join(value);
  let output = template;
  output = replace(output, '{task_id}', String(input.taskId));
  output = replace(output, '{prompt_path}', input.promptPath);
  output = replace(output, '{contract_path}', input.contractPath);
  output = replace(output, '{provider}', input.workerProvider);
  output = replace(output, '{objective}', input.objective);
  return output;
}

export async function runWorkerProvider(input: WorkerExecutionInput): Promise<WorkerExecutionOutput> {
  const externalCommand = process.env.AGENT_ORCHESTRATOR_WORKER_CMD;

  if (externalCommand) {
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
        failureProvider: rateLimit ? input.workerProvider : null,
        failureReason: rateLimit ? 'rate_limit' : 'runtime_failure',
        resetHint: rateLimit?.resetHint ?? null,
        httpStatus: rateLimit?.httpStatus ?? null,
      };
    }
  }

  return {
    completedMarkdown: [
      '# Worker Completion Summary',
      '',
      `- Provider: \`${input.workerProvider}\``,
      `- Task ID: ${input.taskId}`,
      '- Execution mode: simulated fallback',
      '',
      '## Notes',
      '- No `AGENT_ORCHESTRATOR_WORKER_CMD` was configured.',
      '- Worker execution was skipped because no external worker command is configured.',
      '- Configure `AGENT_ORCHESTRATOR_WORKER_CMD` to enable real task execution.',
    ].join('\n'),
    changedFiles: [],
    acceptanceResults: [
      {
        name: 'External worker command is configured',
        passed: false,
        evidence: 'AGENT_ORCHESTRATOR_WORKER_CMD is missing.',
      },
    ],
    workerStdout: 'Simulated worker fallback blocked: AGENT_ORCHESTRATOR_WORKER_CMD is not configured.',
    errorMarkersHit: ['worker_not_configured'],
    runtimeFailed: true,
    runtimeErrorMessage: 'AGENT_ORCHESTRATOR_WORKER_CMD is not configured.',
    failureReason: 'runtime_failure',
  };
}
