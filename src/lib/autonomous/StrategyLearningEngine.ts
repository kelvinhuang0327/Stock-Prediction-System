import { prisma } from '../prisma';
import { loadActiveInsights, formatInsightsAsLimitations } from './InsightIntegrationLayer';
import { runTieredGuardrail } from './InsightGuardrailLayer';
import { evaluateGateRecovery, type RecoverySignal } from './GateRecoveryEngine';
import type { StrategyLearningInsight } from './types';

function safeJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function buildStrategyLearningInsight(): Promise<StrategyLearningInsight | null> {
  const reports = await prisma.tradeReviewReport.findMany({
    orderBy: { generatedAt: 'desc' },
    take: 50,
  });
  if (reports.length === 0) return null;

  // ── Contamination filter ──────────────────────────────────────────────────
  // Exclude reports linked to trades flagged as contaminated in marketContext.
  // This prevents synthetic/manually-inserted trades from skewing learning.
  const contaminatedTradeIds = new Set<number>();
  const contaminatedTrades = await prisma.simulatedTrade.findMany({
    where: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    select: { id: true },
  });
  contaminatedTrades.forEach((t) => contaminatedTradeIds.add(t.id));
  const cleanReports = reports.filter((r) => !contaminatedTradeIds.has(r.tradeId));
  const excludedCount = reports.length - cleanReports.length;
  console.log(
    `[LearningEngine] contamination filter active: excluding ${excludedCount} trades` +
    ` (${reports.length} total → ${cleanReports.length} clean)`,
  );
  if (cleanReports.length === 0) return null;
  // ─────────────────────────────────────────────────────────────────────────

  const successPatterns = new Map<string, number>();
  const failurePatterns = new Map<string, number>();
  const suggestions = new Map<string, number>();
  let fullTradeCount = 0;

  for (const report of cleanReports) {
    const preTrade = safeJson(report.preTrade);
    const result = safeJson(report.result);
    const setup = String(preTrade.setupType ?? 'unknown');
    const pnl = Number(result.return ?? result.pnlPct ?? 0);
    const exitReason = String(result.exitReason ?? '');

    // Time-exit trades are neutral outcomes: the holding period expired without
    // the setup being validated or invalidated by price action. Counting them as
    // failures inflates failurePatterns and produces misleading "raise thresholds"
    // suggestions for setups that simply ran out of time. Skip success/failure
    // pattern and suggestion accounting for time-exits; they still increment
    // fullTradeCount so the < 5 guard tracks trade volume correctly.
    const isTimeExit = report.triggerType === 'time' || exitReason === 'time';

    // Down-weight shadow trades to prevent contamination from tighter thresholds.
    // Shadow trades use 0.3× sizing and tighter stops, so their outcomes are
    // structurally biased. Weight = 0.3 aligns with their position risk contribution.
    // Promoted trades (shadow→pending via track record) use 0.5× sizing with shadow
    // thresholds — partially biased but meaningful evidence. Weight = 0.7.
    const tradeMode = String(preTrade.tradeMode ?? 'full');
    const promotionSource = String(preTrade.promotionSource ?? '');
    const isPromoted = promotionSource === 'shadow_track_record';
    const weight = tradeMode === 'shadow' ? 0.3 : isPromoted ? 0.7 : 1.0;
    if (tradeMode !== 'shadow') fullTradeCount++;

    if (isTimeExit) continue; // neutral outcome — does not inform success/failure patterns

    if (pnl >= 0) successPatterns.set(setup, (successPatterns.get(setup) ?? 0) + weight);
    else failurePatterns.set(setup, (failurePatterns.get(setup) ?? 0) + weight);

    if (pnl < 0) {
      suggestions.set(`提高 ${setup} 的失效門檻`, (suggestions.get(`提高 ${setup} 的失效門檻`) ?? 0) + weight);
    } else {
      suggestions.set(`保留 ${setup} 的研究框架`, (suggestions.get(`保留 ${setup} 的研究框架`) ?? 0) + weight);
    }
  }

  const successPatternsArr = [...successPatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([setup, count]) => `${setup}：${Math.round(count)} 筆正報酬檢討`);
  const failurePatternsArr = [...failurePatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([setup, count]) => `${setup}：${Math.round(count)} 筆負報酬檢討`);
  const adjustmentSuggestions = [...suggestions.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text]) => text);

  const shadowOnlyNote = fullTradeCount === 0 && cleanReports.length > 0
    ? ' (全數為 shadow trade，學習信號降權處理)'
    : '';
  const timeExitCount = cleanReports.filter((r) => r.triggerType === 'time').length;
  const signalCount = cleanReports.length - timeExitCount;
  const summary = [
    `累積 ${cleanReports.length} 筆 review（full=${fullTradeCount}, shadow=${cleanReports.length - fullTradeCount}, time-exit中性=${timeExitCount}），有效信號 ${signalCount} 筆。${shadowOnlyNote}`,
    excludedCount > 0 ? `(${excludedCount} 筆污染交易已排除)` : null,
    successPatternsArr[0] ? `目前較常出現的成功 setup 為 ${successPatternsArr[0]}。` : '尚未形成穩定成功 setup。',
    failurePatternsArr[0] ? `較常見的失敗 setup 為 ${failurePatternsArr[0]}。` : '尚未形成穩定失敗 setup。',
  ].filter(Boolean).join(' ');

  const insightLimitations = [
    '學習結果僅基於已生成 review 的模擬交易，仍需持續累積樣本。',
  ];
  if (fullTradeCount < 5) {
    insightLimitations.push('full trade 樣本不足 5 筆，learning adjustment 應保守或停用。');
  }
  if (excludedCount > 0) {
    insightLimitations.push(`${excludedCount} 筆污染交易已從學習計算中排除（day3-synthetic-batch）。`);
  }

  // Append active optimization insights as structured limitations (tiered-guardrail-filtered)
  const activeInsights = await loadActiveInsights();
  const guardrailResult = runTieredGuardrail(activeInsights, { callerLabel: 'StrategyLearning' });
  const insightFlags = formatInsightsAsLimitations(guardrailResult.filtered);
  insightLimitations.push(...insightFlags);

  // Record hard-gate decisions as explicit limitations so they appear in the learning record
  for (const gate of guardrailResult.gatingDecisions) {
    insightLimitations.push(
      `[HARD GATE] ${gate.reason} | Override: ${gate.overrideCondition}`,
    );
  }

  // Detect recovery signals from trade outcomes to evaluate gate downgrade / probe eligibility
  if (guardrailResult.gatingDecisions.length > 0) {
    const recoverySignals: RecoverySignal[] = [];

    // Signal 1: successful probe trades — shadow trades with non-negative PnL
    const successfulProbeCount = cleanReports.filter((r) => {
      const preTrade = safeJson(r.preTrade);
      const result = safeJson(r.result);
      return (
        String(preTrade.tradeMode ?? '') === 'shadow' &&
        String(preTrade.isProbe ?? '') === 'true' &&
        Number(result.return ?? result.pnlPct ?? 0) >= 0
      );
    }).length;
    for (let i = 0; i < Math.min(successfulProbeCount, 3); i++) {
      recoverySignals.push({
        type: 'successful_probe',
        value: 1.0,
        evidence: `Probe trade #${i + 1} closed with non-negative PnL`,
        recordedAt: new Date().toISOString(),
      });
    }

    // Signal 2: reduced time-exit rate in recent 20 trades
    const recentN = Math.min(cleanReports.length, 20);
    const recentReports = cleanReports.slice(0, recentN);
    const timeExitRate =
      recentN > 0
        ? recentReports.filter(
            (r) =>
              r.triggerType === 'time' ||
              String(safeJson(r.result).exitReason ?? '') === 'time',
          ).length / recentN
        : 0;
    if (timeExitRate < 0.4 && recentN >= 5) {
      recoverySignals.push({
        type: 'reduced_time_exit',
        value: Math.min(1.0, 1.0 - timeExitRate / 0.4),
        evidence: `Time-exit rate ${(timeExitRate * 100).toFixed(1)}% < 40% (n=${recentN})`,
        recordedAt: new Date().toISOString(),
      });
    }

    if (recoverySignals.length > 0) {
      const allSetupTypes = [
        ...new Set(
          cleanReports.map((r) => String(safeJson(r.preTrade).setupType ?? '')).filter(Boolean),
        ),
      ];
      const recovery = evaluateGateRecovery(
        guardrailResult.gatingDecisions,
        recoverySignals,
        allSetupTypes,
        { callerLabel: 'StrategyLearning' },
      );
      for (const dg of recovery.downgradedGates) {
        insightLimitations.push(`[GATE RECOVERY] ${dg.reason}`);
      }
      for (const pd of recovery.probeDecisions) {
        insightLimitations.push(`[PROBE ELIGIBLE] setup=${pd.setupType ?? 'global'} ${pd.reason}`);
      }
      if (recovery.diversity.exemptedSetupType) {
        insightLimitations.push(`[DIVERSITY RESCUE] ${recovery.diversity.exemptionReason}`);
      }
    }
  }

  const insight: StrategyLearningInsight = {
    generatedAt: new Date().toISOString(),
    summary,
    successPatterns: successPatternsArr,
    failurePatterns: failurePatternsArr,
    adjustmentSuggestions,
    sourceCount: cleanReports.length,
    limitations: insightLimitations,
  };

  return insight;
}

export async function persistStrategyLearningInsight(insight: StrategyLearningInsight): Promise<StrategyLearningInsight> {
  const row = await prisma.strategyLearningInsight.upsert({
    where: { generatedAt: insight.generatedAt },
    update: {
      summary: insight.summary,
      successPatterns: JSON.stringify(insight.successPatterns),
      failurePatterns: JSON.stringify(insight.failurePatterns),
      adjustmentSuggestions: JSON.stringify(insight.adjustmentSuggestions),
      sourceCount: insight.sourceCount,
      limitations: JSON.stringify(insight.limitations),
    },
    create: {
      generatedAt: insight.generatedAt,
      summary: insight.summary,
      successPatterns: JSON.stringify(insight.successPatterns),
      failurePatterns: JSON.stringify(insight.failurePatterns),
      adjustmentSuggestions: JSON.stringify(insight.adjustmentSuggestions),
      sourceCount: insight.sourceCount,
      limitations: JSON.stringify(insight.limitations),
    },
  });

  return {
    id: row.id,
    generatedAt: row.generatedAt,
    summary: row.summary,
    successPatterns: insight.successPatterns,
    failurePatterns: insight.failurePatterns,
    adjustmentSuggestions: insight.adjustmentSuggestions,
    sourceCount: row.sourceCount,
    limitations: insight.limitations,
  };
}
