import { prisma } from '../prisma';
import { loadActiveInsights, applyInsightRankingPenalty, applyStrongInsightRankingPenalty } from './InsightIntegrationLayer';
import { runTieredGuardrail } from './InsightGuardrailLayer';
import { applyGateDiversityRule } from './GateRecoveryEngine';
import type {
  AutonomousResearchSnapshot,
  AutonomousResearchCandidate,
  StrategyProposal,
  StrategyLearningInsight,
} from './types';

// ─── Learning Feedback ───────────────────────────────────────────

interface LearningAdjustment {
  /** Setup types with consistently negative outcomes → reduce sizing */
  penalizedSetups: Set<string>;
  /** Setup types with consistently positive outcomes → maintain or boost sizing */
  rewardedSetups: Set<string>;
  /** Suggestions from the learning engine */
  activeSuggestions: string[];
  /** Whether learning data was available */
  hasLearningData: boolean;
  /** Whether enough full (non-shadow) trades exist to trust penalties */
  hasEnoughFullTrades: boolean;
}

async function loadLatestLearningInsight(): Promise<LearningAdjustment> {
  const noAdjustment: LearningAdjustment = {
    penalizedSetups: new Set(),
    rewardedSetups: new Set(),
    activeSuggestions: [],
    hasLearningData: false,
    hasEnoughFullTrades: false,
  };

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: number;
      successPatterns: string | null;
      failurePatterns: string | null;
      adjustmentSuggestions: string | null;
      sourceCount: number;
    }>>(
      `SELECT id, successPatterns, failurePatterns, adjustmentSuggestions, sourceCount
       FROM StrategyLearningInsight
       ORDER BY createdAt DESC
       LIMIT 1`,
    );

    if (rows.length === 0 || rows[0].sourceCount < 5) return noAdjustment;

    const row = rows[0];
    const successPatterns: string[] = JSON.parse(row.successPatterns || '[]');
    const failurePatterns: string[] = JSON.parse(row.failurePatterns || '[]');
    const suggestions: string[] = JSON.parse(row.adjustmentSuggestions || '[]');

    // Check if learning has enough full trades via limitations field
    const limitationsStr = String((row as Record<string, unknown>).limitations ?? '[]');
    const hasInsufficientFullTrades = limitationsStr.includes('full trade 樣本不足');

    const penalized = new Set<string>();
    const rewarded = new Set<string>();

    // Parse patterns like "trend：12 筆正報酬檢討" → extract setup type
    for (const pattern of failurePatterns) {
      const match = pattern.match(/^(\w+)：(\d+)/);
      if (match && Number(match[2]) >= 3) {
        penalized.add(match[1]);
      }
    }

    for (const pattern of successPatterns) {
      const match = pattern.match(/^(\w+)：(\d+)/);
      if (match && Number(match[2]) >= 3) {
        rewarded.add(match[1]);
      }
    }

    return {
      penalizedSetups: penalized,
      rewardedSetups: rewarded,
      activeSuggestions: suggestions.slice(0, 5),
      hasLearningData: true,
      hasEnoughFullTrades: !hasInsufficientFullTrades,
    };
  } catch {
    return noAdjustment;
  }
}

function applyLearningAdjustment(
  baseSizing: number,
  setupType: string,
  conviction: StrategyProposal['conviction'],
  learning: LearningAdjustment,
): { adjustedSizing: number; adjustmentNote: string } {
  if (!learning.hasLearningData) {
    return { adjustedSizing: baseSizing, adjustmentNote: '無學習資料，使用預設倉位。' };
  }

  let adjustedSizing = baseSizing;
  let adjustmentNote = '';

  if (learning.penalizedSetups.has(setupType)) {
    // Only apply negative adjustment if we have enough full trade evidence.
    // Shadow-only data is structurally biased toward stops; penalizing based on it
    // creates a death spiral.
    if (!learning.hasEnoughFullTrades) {
      adjustmentNote = `${setupType} 有負面 pattern 但 full trade 樣本不足，暫不下調倉位。`;
    } else {
      // Reduce sizing by 30% for setups with repeated failures
      adjustedSizing = Math.round(baseSizing * 0.7 * 1000) / 1000;
      adjustmentNote = `${setupType} 有重複失敗 pattern，倉位下調 30%。`;
    }
  } else if (learning.rewardedSetups.has(setupType) && conviction === 'high') {
    // Slightly boost sizing for proven setups with high conviction
    adjustedSizing = Math.min(0.15, Math.round(baseSizing * 1.15 * 1000) / 1000);
    adjustmentNote = `${setupType} 有穩定成功 pattern 且 conviction=high，倉位微調 +15%（上限 15%）。`;
  } else {
    adjustmentNote = '學習資料已載入，此 setup 無需調整。';
  }

  return { adjustedSizing, adjustmentNote };
}

function baseSizingForConviction(conviction: StrategyProposal['conviction']): number {
  if (conviction === 'high') return 0.1;
  if (conviction === 'mid') return 0.06;
  return 0.03;
}

function buildEntryCondition(setupType: StrategyProposal['setupType']): string {
  switch (setupType) {
    case 'trend':
      return '收盤站穩 20 日均線且近 5 日報酬為正，視為趨勢延續條件成立。';
    case 'rebound':
      return '跌幅收斂後重新站回 20 日均線，且當日不再創短線新低，視為反彈條件成立。';
    case 'event':
      return '高可信事件持續更新且相關族群未轉弱，視為事件延續條件成立。';
    case 'fundamental':
      return '月營收與財報脈絡維持正向，且估值壓力未再擴大，視為基本面條件成立。';
  }
}

function buildInvalidationCondition(setupType: StrategyProposal['setupType']): string {
  switch (setupType) {
    case 'trend':
      return '跌破 20 日均線且前低未守住，趨勢假設失效。';
    case 'rebound':
      return '反彈後再度跌破前低，修復假設失效。';
    case 'event':
      return '事件來源可信度下降或事件熱度消退，事件假設失效。';
    case 'fundamental':
      return '營收或 EPS 轉弱，或估值壓力持續擴大，基本面假設失效。';
  }
}

function buildStopLossRule(setupType: StrategyProposal['setupType']): string {
  switch (setupType) {
    case 'trend':
      return '以近 10 日低點下方 2% 作為防守停損。';
    case 'rebound':
      return '以前低下方 1.5% 作為防守停損。';
    case 'event':
      return '以事件高點回落 6% 作為風險停損。';
    case 'fundamental':
      return '以研究失效條件作為停損，並以 6% 為初始防守區。';
  }
}

function buildTakeProfitRule(setupType: StrategyProposal['setupType']): string {
  switch (setupType) {
    case 'trend':
      return '若浮盈達 8% 且動能轉弱，分批收斂。';
    case 'rebound':
      return '若反彈延續至 6% 以上且量能轉弱，分批收斂。';
    case 'event':
      return '若事件已充分反應且漲幅達 10% 左右，降低持有比重。';
    case 'fundamental':
      return '若估值重評完成且報酬達 8% 以上，分批檢討。';
  }
}

function buildDecisionMeta(candidate: AutonomousResearchCandidate, snapshot: AutonomousResearchSnapshot) {
  return {
    marketState: snapshot.marketState,
    marketRegime: snapshot.marketRegime,
    marketRegimeConfidence: snapshot.marketRegimeConfidence,
    candidateScreenBucket: candidate.screenBucket,
    dataCoverage: snapshot.dataCoverage,
    reason: '純規則化決策，不修改 alpha/backtest/regime/scoring。',
  };
}

export async function buildStrategyProposals(
  snapshot: AutonomousResearchSnapshot,
): Promise<StrategyProposal[]> {
  const proposals: StrategyProposal[] = [];

  // Load learning feedback from past trade reviews + active optimization insights
  const [learning, activeInsights] = await Promise.all([
    loadLatestLearningInsight(),
    loadActiveInsights(),
  ]);

  const rankedCandidates = (() => {
    const tieredResult = runTieredGuardrail(activeInsights, {
      currentRegime: snapshot.marketState,
      callerLabel: 'DecisionLayer',
    });

    // Hard-gated setup types are excluded from candidate consideration
    const gatedSetupTypes = new Set(
      tieredResult.gatingDecisions
        .filter((g) => g.gatedSetupType !== undefined)
        .map((g) => g.gatedSetupType!),
    );
    const hasGlobalGate = tieredResult.gatingDecisions.some(
      (g) => g.gatedSetupType === undefined,
    );

    const eligible = hasGlobalGate
      ? []
      : gatedSetupTypes.size > 0
        ? snapshot.candidateStocks.filter((c) => !gatedSetupTypes.has(c.setupType))
        : snapshot.candidateStocks;

    // Diversity rescue: if all candidates are gated, exempt the most-common setup type
    const allSetupTypes = snapshot.candidateStocks.map((c) => c.setupType);
    const diversityResult = applyGateDiversityRule(tieredResult.gatingDecisions, allSetupTypes);
    const finalEligible =
      eligible.length === 0 && diversityResult.exemptedSetupType !== undefined
        ? snapshot.candidateStocks
            .filter((c) => c.setupType === diversityResult.exemptedSetupType)
        : eligible;

    return applyStrongInsightRankingPenalty(finalEligible, tieredResult.tiers).sort(
      (a, b) => b.alphaScore - a.alphaScore,
    );
  })();

  for (const candidate of rankedCandidates.slice(0, 5)) {
    const stock = await prisma.stock.findUnique({
      where: { id: candidate.symbol },
      select: { id: true, name: true, industry: true },
    });

    if (!stock) continue;

    const setupType = candidate.setupType;
    const conviction = candidate.conviction;
    const baseSizing = baseSizingForConviction(conviction);
    const { adjustedSizing, adjustmentNote } = applyLearningAdjustment(
      baseSizing,
      setupType,
      conviction,
      learning,
    );

    const meta = buildDecisionMeta(candidate, snapshot);

    const proposal: StrategyProposal = {
      snapshotId: snapshot.snapshotId,
      symbol: stock.id,
      setupType,
      thesis: candidate.thesis,
      entryCondition: buildEntryCondition(setupType),
      invalidationCondition: buildInvalidationCondition(setupType),
      stopLossRule: buildStopLossRule(setupType),
      takeProfitRule: buildTakeProfitRule(setupType),
      positionSizing: adjustedSizing,
      conviction,
      supportingSignals: candidate.supportingSignals,
      riskFactors: candidate.riskFactors,
      researchSnapshotId: snapshot.snapshotId ?? null,
      state: 'proposed',
      decisionMeta: {
        ...meta,
        learningFeedback: {
          hasLearningData: learning.hasLearningData,
          adjustmentNote,
          baseSizing,
          adjustedSizing,
          activeSuggestions: learning.activeSuggestions,
          insightRankingNote: candidate.insightPenaltyNote ?? null,
        },
      },
    };

    proposals.push(proposal);
  }

  return proposals;
}
