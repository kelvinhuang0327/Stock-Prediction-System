import type { PlannerTaskFingerprint, TaskContract, TaskRecord } from './types';

export type TaskQualityStatus = 'PASS' | 'REJECT';

type WorkloadCategory =
  | 'strategy_generation'
  | 'backtest'
  | 'monte_carlo'
  | 'multi_strategy_comparison'
  | 'structural_analysis'
  | 'parameter_optimization';

export interface RecentTaskReference {
  taskId: number;
  objective: string;
  scope: string[];
  requiredOutputs: string[];
  plannerContext?: PlannerTaskFingerprint | null;
}

export interface PlannerDraftQualityInput {
  objective: string;
  promptMarkdown: string;
  contract: TaskContract;
  plannerContext: PlannerTaskFingerprint | null;
  recentTasks: RecentTaskReference[];
}

export interface PlannerDraftQualityResult {
  quality_status: TaskQualityStatus;
  reasons: string[];
  contract: TaskContract;
  promptMarkdown: string;
}

const BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /SIGNAL_EXHAUSTED/i, reason: '禁止內容：包含 SIGNAL_EXHAUSTED。' },
  { pattern: /NO_SIGNAL/i, reason: '禁止內容：包含 NO_SIGNAL。' },
  { pattern: /停止建議/, reason: '禁止內容：包含 停止建議。' },
  { pattern: /目前沒有方向/, reason: '禁止內容：包含 目前沒有方向。' },
];

const STANDARD_REQUIRED_OUTPUTS = [
  'phase_execution_plan',
  'strategy_candidates_3_plus',
  'backtest_report_150_500_1500',
  'monte_carlo_report_1000_plus',
  'comparison_matrix_vs_existing',
  'final_recommendation',
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
}

function tokenize(value: string): Set<string> {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length >= 2));
}

function jaccardSimilarity(left: string, right: string): number {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function isMeaningfulPhase(value: string): boolean {
  return value.trim().length >= 18;
}

function hasExplicitPhaseLabel(value: string): boolean {
  return /(?:phase|階段)\s*[1-9]/i.test(value);
}

function collectPhaseItems(contract: TaskContract, promptMarkdown: string): { phases: string[]; explicit: boolean } {
  const scopePhases = contract.scope.filter(isMeaningfulPhase);
  const promptPhaseMatches = Array.from(
    promptMarkdown.matchAll(/(?:^|\n)(?:[-*]\s*)?(Phase\s*[1-9][^\n]*|階段\s*[1-9][^\n]*)/gi),
  ).map((match) => match[1].trim());

  const explicit = scopePhases.some(hasExplicitPhaseLabel) || promptPhaseMatches.length >= 5;
  if (scopePhases.length >= 5) {
    return { phases: scopePhases.slice(0, 5), explicit };
  }
  return { phases: promptPhaseMatches.slice(0, 5), explicit };
}

function extractContent(contract: TaskContract, promptMarkdown: string, objective: string): string {
  return [
    objective,
    promptMarkdown,
    contract.scope.join('\n'),
    contract.constraints.join('\n'),
    contract.acceptance_tests.join('\n'),
    contract.required_outputs.join('\n'),
    contract.handoff_questions.join('\n'),
  ].join('\n');
}

function parseLargestQualifiedNumber(text: string): number | null {
  const matches = Array.from(text.matchAll(/(?:>=|至少|at least)?\s*([0-9][0-9,]*)/gi));
  let maxValue: number | null = null;
  for (const match of matches) {
    const parsed = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(parsed) && (maxValue === null || parsed > maxValue)) {
      maxValue = parsed;
    }
  }
  return maxValue;
}

function detectCategories(text: string): Set<WorkloadCategory> {
  const categories = new Set<WorkloadCategory>();
  const normalized = text.toLowerCase();

  if (
    /(?:strategy|strategies|策略)/i.test(text) &&
    /(?:>=\s*3|at least\s*3|至少\s*3|至少三|3\+|三組|多組)/i.test(text)
  ) {
    categories.add('strategy_generation');
  }

  if (/(?:backtest|回測)/i.test(text) && /\b150\b/.test(normalized) && /\b500\b/.test(normalized) && /\b1500\b/.test(normalized)) {
    categories.add('backtest');
  }

  const monteCarloMax = /(monte\s*carlo)/i.test(text) ? parseLargestQualifiedNumber(text) : null;
  if (monteCarloMax !== null && monteCarloMax >= 1000 && /(monte\s*carlo)/i.test(text)) {
    categories.add('monte_carlo');
  }

  if (/(?:multi[-\s]?strategy|strategy comparison|compare.*strategy|vs\.? existing|多策略比較|與現有策略比較|比較現有策略)/i.test(text)) {
    categories.add('multi_strategy_comparison');
  }

  if (/(?:structural analysis|structure analysis|market structure|regime analysis|結構分析|結構審查|regime audit)/i.test(text)) {
    categories.add('structural_analysis');
  }

  if (/(?:parameter optimization|parameter sweep|grid search|hyperparameter|參數優化|參數搜尋|最佳化)/i.test(text)) {
    categories.add('parameter_optimization');
  }

  return categories;
}

function hasQuantitativeOutputDepth(text: string): boolean {
  const hasStrategies = /(?:>=\s*3|at least\s*3|至少\s*3|至少三|3\+|三組|多組).*(?:strategy|strategies|策略)|(?:strategy|strategies|策略).*(?:>=\s*3|at least\s*3|至少\s*3|至少三|3\+|三組|多組)/i.test(text);
  const hasMetrics = /edge/i.test(text) && /sharpe/i.test(text) && /(drawdown|回撤)/i.test(text);
  const hasComparison = /(?:existing strategy|現有策略|baseline|benchmark|對照組|比較)/i.test(text);
  const hasRecommendation = /(?:final recommendation|recommended plan|最終推薦|推薦方案)/i.test(text);
  return hasStrategies && hasMetrics && hasComparison && hasRecommendation;
}

function buildPhaseScope(phases: string[]): string[] {
  return phases.slice(0, 5).map((phase, index) => {
    const stripped = phase.replace(/^(?:phase|階段)\s*[1-9]\s*[:：-]?\s*/i, '').trim();
    return `Phase ${index + 1}: ${stripped}`;
  });
}

function ensurePromptSection(promptMarkdown: string, title: string, items: string[]): string {
  if (items.length === 0 || promptMarkdown.includes(title)) return promptMarkdown;
  return [
    promptMarkdown.trimEnd(),
    '',
    title,
    ...items.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function normalizePassDraft(contract: TaskContract, promptMarkdown: string, phases: string[], explicit: boolean): {
  contract: TaskContract;
  promptMarkdown: string;
} {
  const normalizedScope = explicit ? contract.scope : buildPhaseScope(phases);
  const normalizedOutputs = Array.from(new Set([...contract.required_outputs, ...STANDARD_REQUIRED_OUTPUTS]));
  let nextPrompt = promptMarkdown;
  if (!explicit) {
    nextPrompt = ensurePromptSection(nextPrompt, '## Execution Phases', buildPhaseScope(phases));
  }
  nextPrompt = ensurePromptSection(nextPrompt, '## Required Quantitative Outputs', STANDARD_REQUIRED_OUTPUTS);
  return {
    contract: {
      ...contract,
      scope: normalizedScope,
      required_outputs: normalizedOutputs,
    },
    promptMarkdown: nextPrompt,
  };
}

function isDuplicateTask(
  objective: string,
  phases: string[],
  requiredOutputs: string[],
  plannerContext: PlannerTaskFingerprint | null,
  recentTask: RecentTaskReference,
): boolean {
  const objectiveSimilarity = jaccardSimilarity(objective, recentTask.objective);
  const phaseSimilarity = jaccardSimilarity(phases.join(' '), recentTask.scope.join(' '));
  const outputSimilarity = jaccardSimilarity(requiredOutputs.join(' '), recentTask.requiredOutputs.join(' '));
  const sameDedupeKey = Boolean(
    plannerContext?.dedupeKey &&
      recentTask.plannerContext?.dedupeKey &&
      plannerContext.dedupeKey === recentTask.plannerContext.dedupeKey,
  );
  return sameDedupeKey || (objectiveSimilarity >= 0.75 && phaseSimilarity >= 0.7 && outputSimilarity >= 0.6);
}

export function evaluatePlannerDraftQuality(input: PlannerDraftQualityInput): PlannerDraftQualityResult {
  const reasons: string[] = [];
  const content = extractContent(input.contract, input.promptMarkdown, input.objective);
  const { phases, explicit } = collectPhaseItems(input.contract, input.promptMarkdown);
  const hasDepth = hasQuantitativeOutputDepth(content);

  for (const banned of BANNED_PATTERNS) {
    if (banned.pattern.test(content)) {
      reasons.push(banned.reason);
    }
  }

  if (phases.length < 5) {
    reasons.push('規則 1 失敗：任務缺少至少 5 個明確階段（Phase 1～5）。');
  }

  const categories = detectCategories(content);
  if (!categories.has('strategy_generation')) {
    reasons.push('規則 2 失敗：未包含多策略生成（至少 3 組策略）。');
  }
  if (!categories.has('backtest')) {
    reasons.push('規則 2 失敗：未包含 150 / 500 / 1500 回測。');
  }
  if (!categories.has('monte_carlo')) {
    reasons.push('規則 2 失敗：未包含 Monte Carlo（至少 1000 次）。');
  }
  if (categories.size < 3) {
    reasons.push('規則 2 失敗：工作類型少於 3 種。');
  }

  if (!hasDepth) {
    reasons.push('規則 4 失敗：未要求 3 組以上策略、edge/sharpe/drawdown、現有策略比較與最終推薦方案。');
  }

  if (phases.length < 5 || categories.size < 3 || !hasDepth) {
    reasons.push('規則 3 失敗：此任務可在 30 分鐘內完成，未達 4～8 小時深度。');
  }

  const currentPhases = phases.length >= 5 ? phases.slice(0, 5) : input.contract.scope;
  for (const recentTask of input.recentTasks.slice(0, 8)) {
    if (isDuplicateTask(input.objective, currentPhases, input.contract.required_outputs, input.plannerContext, recentTask)) {
      reasons.push(`規則 5 失敗：與最近任務 #${recentTask.taskId} focus / 結構 / 輸出高度重複。`);
      break;
    }
  }

  const compressedContent = normalizeText(content);
  if (compressedContent.length > 0 && compressedContent.length < 280) {
    reasons.push('規則 6 失敗：任務內容過短，屬於可疑偽長或空洞任務。');
  }

  if (reasons.length > 0) {
    return {
      quality_status: 'REJECT',
      reasons,
      contract: input.contract,
      promptMarkdown: input.promptMarkdown,
    };
  }

  // ── v2 focus-aware checks (soft — only run if focuses are declared) ─────────
  const focusReasons: string[] = [];
  if (input.contract.focuses && input.contract.focuses.length > 0) {
    for (const focus of input.contract.focuses) {
      const focusContent = [
        focus.hypothesis,
        focus.required_steps.join(' '),
        focus.target_outputs.join(' '),
        ...(focus.statistical_tests ?? []),
      ].join(' ');

      if (focus.required_steps.length < 2) {
        focusReasons.push(`Focus "${focus.key}": 缺少足夠的 required_steps（至少 2 步）。`);
      }
      if (focus.target_outputs.length === 0) {
        focusReasons.push(`Focus "${focus.key}": 未定義 target_outputs。`);
      }
      // Ensure at least one focus step appears somewhere in the main content
      const focusKeywords = normalizeText(focusContent).split(' ').filter((t) => t.length >= 4).slice(0, 5);
      const focusAppearsInPrompt = focusKeywords.some((kw) => normalizeText(input.promptMarkdown).includes(kw));
      if (!focusAppearsInPrompt) {
        focusReasons.push(`Focus "${focus.key}": prompt 中找不到此 focus 的關鍵字，可能漏寫。`);
      }
    }

    // Verify target_files are referenced if provided
    if (input.contract.target_files && input.contract.target_files.length > 0) {
      const missingFiles = input.contract.target_files.filter(
        (file) => !normalizeText(input.promptMarkdown).includes(normalizeText(file)),
      );
      if (missingFiles.length > 0) {
        focusReasons.push(`v2 規則：以下 target_files 未出現在 prompt 中：${missingFiles.join(', ')}`);
      }
    }

    // Verify statistical requirements are mentioned
    if (input.contract.statistical_requirements && input.contract.statistical_requirements.length > 0) {
      const missingStats = input.contract.statistical_requirements.filter(
        (req) => !normalizeText(input.promptMarkdown + content).includes(normalizeText(req.slice(0, 20))),
      );
      if (missingStats.length > 0) {
        focusReasons.push(`v2 規則：以下 statistical_requirements 未出現在 prompt 中：${missingStats.join('; ')}`);
      }
    }
  }

  if (focusReasons.length > 0) {
    return {
      quality_status: 'REJECT',
      reasons: focusReasons,
      contract: input.contract,
      promptMarkdown: input.promptMarkdown,
    };
  }

  const normalized = normalizePassDraft(input.contract, input.promptMarkdown, phases, explicit);
  return {
    quality_status: 'PASS',
    reasons: ['確認任務符合 8 小時標準。'],
    contract: normalized.contract,
    promptMarkdown: normalized.promptMarkdown,
  };
}

export function buildRecentTaskReference(task: TaskRecord, contract: TaskContract): RecentTaskReference {
  return {
    taskId: task.taskId,
    objective: contract.objective,
    scope: contract.scope,
    requiredOutputs: contract.required_outputs,
    plannerContext: task.plannerContext,
  };
}