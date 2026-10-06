import type {
  InsightCoverage,
  InsightDirectness,
  InsightPersistence,
  InsightTrust,
  RelevanceFactorBreakdown,
  RelevanceFactorKey,
  RelevanceScoringInput,
  RelevanceScoreResult,
  RelevantInsight,
} from './types';

interface FactorScore {
  key: RelevanceFactorKey;
  weight: number;
  points: number;
  available: boolean;
  reason: string;
  caution?: string;
}

const FACTOR_LABELS: Record<RelevanceFactorKey, string> = {
  directness: 'Directness',
  signalQuality: 'Signal quality',
  recency: 'Recency',
  persistence: 'Persistence',
  regime: 'Regime relevance',
  dataQuality: 'Data quality',
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalizeRegime(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'bull') return 'Bull';
  if (normalized === 'bear') return 'Bear';
  if (normalized === 'sideways' || normalized === 'neutral') return 'Neutral';
  return 'Unknown';
}

function scoreDirectness(directness: InsightDirectness, alphaScore?: number): FactorScore {
  let points = 5;
  let reason = '與目前視角僅間接相關';

  if (directness === 'market') {
    points = 12;
    reason = '與目前市場研究脈絡直接相關';
  } else if (directness === 'watchlist') {
    points = 18;
    reason = '與 watchlist 研究脈絡直接相關';
  } else if (directness === 'portfolio') {
    points = 20;
    reason = '直接影響組合/持倉脈絡';
  } else if (directness === 'direct') {
    points = alphaScore != null && alphaScore >= 75 ? 25 : 23;
    reason = alphaScore != null && alphaScore >= 75
      ? '直接對應標的，且位於高 alpha 脈絡'
      : '直接對應目前標的';
  }

  return {
    key: 'directness',
    weight: 25,
    points,
    available: true,
    reason,
  };
}

function scoreSignalQuality(input: RelevanceScoringInput): FactorScore {
  const signal = input.signalContext;
  if (!signal) {
    return {
      key: 'signalQuality',
      weight: 20,
      points: 0,
      available: false,
      reason: '此 insight 無 signal effectiveness 品質因子',
    };
  }

  let points = 4;
  let reason = 'signal 品質資訊有限';
  let caution: string | undefined;

  if (signal.classification === 'STRONG_SIGNAL') {
    points = 20;
    reason = 'STRONG_SIGNAL 歷史品質較佳';
  } else if (signal.classification === 'CONDITIONAL_SIGNAL') {
    points = 14;
    reason = 'CONDITIONAL_SIGNAL，需搭配條件判讀';
  } else if (signal.classification === 'WEAK_SIGNAL') {
    points = 8;
    reason = 'WEAK_SIGNAL，僅適合作為次要研究線索';
  } else {
    points = 2;
    reason = 'NOISE signal 已被降權';
    caution = '歷史 edge 不明顯，優先級需下修';
  }

  if ((signal.sampleSize ?? 0) > 0 && (signal.sampleSize ?? 0) < 10) {
    points = Math.min(points, 4);
    caution = '樣本偏低，signal 品質可信度受限';
  }

  return {
    key: 'signalQuality',
    weight: 20,
    points,
    available: true,
    reason,
    caution,
  };
}

function scoreRecency(recencyDays: number | null | undefined): FactorScore {
  if (recencyDays == null) {
    return {
      key: 'recency',
      weight: 15,
      points: 0,
      available: false,
      reason: '缺少可用的最近性資訊',
    };
  }

  let points = 2;
  let reason = `最近性偏低（約 ${recencyDays} 日前）`;
  if (recencyDays <= 1) {
    points = 15;
    reason = '最近 1 日內仍有明確新訊號/新脈絡';
  } else if (recencyDays <= 3) {
    points = 11;
    reason = '最近 3 日內仍具新鮮度';
  } else if (recencyDays <= 7) {
    points = 7;
    reason = '最近 7 日內仍可作研究參考';
  }

  return {
    key: 'recency',
    weight: 15,
    points,
    available: true,
    reason,
    caution: recencyDays > 7 ? '最近性較低，展示優先級應保守' : undefined,
  };
}

function scorePersistence(level: InsightPersistence | undefined): FactorScore {
  if (!level || level === 'unknown') {
    return {
      key: 'persistence',
      weight: 10,
      points: 0,
      available: false,
      reason: '缺少持續性資料',
    };
  }

  const mapping: Record<Exclude<InsightPersistence, 'unknown'>, { points: number; reason: string }> = {
    transient: { points: 2, reason: '屬一次性/短暫線索' },
    developing: { points: 5, reason: '有延續跡象，但尚未穩定' },
    persistent: { points: 8, reason: '近期呈持續性發展' },
    continuous: { points: 10, reason: '持續性高，適合優先追蹤' },
  };

  const picked = mapping[level as Exclude<InsightPersistence, 'unknown'>];
  return {
    key: 'persistence',
    weight: 10,
    points: picked.points,
    available: true,
    reason: picked.reason,
  };
}

function scoreRegime(input: RelevanceScoringInput): FactorScore {
  const regime = input.regimeContext;
  if (!regime?.currentRegime && !regime?.relevantRegimes?.length) {
    return {
      key: 'regime',
      weight: 10,
      points: 0,
      available: false,
      reason: '缺少 regime 關聯資料',
    };
  }

  const current = normalizeRegime(regime.currentRegime);
  const relevant = (regime.relevantRegimes ?? []).map(normalizeRegime).filter((item) => item !== 'Unknown');

  if (relevant.length === 0) {
    return {
      key: 'regime',
      weight: 10,
      points: current === 'Unknown' ? 2 : 6,
      available: true,
      reason: current === 'Unknown' ? '市場 regime 不明，僅能保守排序' : '沒有明確 regime 依賴，視為中性',
    };
  }

  if (current !== 'Unknown' && relevant.includes(current)) {
    return {
      key: 'regime',
      weight: 10,
      points: 10,
      available: true,
      reason: `與當前 ${current} regime 相符`,
    };
  }

  if (current === 'Unknown') {
    return {
      key: 'regime',
      weight: 10,
      points: 3,
      available: true,
      reason: '存在 regime 依賴，但當前 regime 不明',
      caution: 'regime 資訊不足，排序只能保守解讀',
    };
  }

  return {
    key: 'regime',
    weight: 10,
    points: 1,
    available: true,
    reason: `主要有效 regime 為 ${relevant.join('/')}`,
    caution: `與當前 ${current} regime 不完全相符，已降權`,
  };
}

function coveragePoints(coverage: InsightCoverage | undefined): number {
  if (coverage === 'full') return 10;
  if (coverage === 'limited') return 6;
  if (coverage === 'insufficient') return 2;
  return 4;
}

function trustPoints(trust: InsightTrust | undefined): number {
  if (trust === 'high') return 10;
  if (trust === 'medium') return 7;
  if (trust === 'low') return 3;
  return 5;
}

function scoreDataQuality(input: RelevanceScoringInput): FactorScore {
  const quality = input.dataQuality;
  if (!quality) {
    return {
      key: 'dataQuality',
      weight: 20,
      points: 0,
      available: false,
      reason: '缺少資料品質訊息',
    };
  }

  let points = coveragePoints(quality.coverage) + trustPoints(quality.trust);
  let reason = '資料品質可接受';
  let caution: string | undefined;

  if (quality.coverage === 'full' && quality.trust === 'high') {
    reason = '資料覆蓋與可信度都較完整';
  } else if (quality.coverage === 'insufficient' || quality.trust === 'low') {
    reason = '資料覆蓋或可信度偏弱';
    caution = '資料品質不足，confidence 會下降';
  } else if (quality.coverage === 'limited') {
    reason = '資料覆蓋有限，仍可作保守研究參考';
  }

  if (input.limitations.length >= 3) {
    points = Math.max(2, points - Math.min(6, input.limitations.length));
    caution = 'limitations 較多，排序信心需下修';
  }

  return {
    key: 'dataQuality',
    weight: 20,
    points: clamp(points, 0, 20),
    available: true,
    reason,
    caution,
  };
}

function buildExplanation(factors: FactorScore[]): string {
  const positives = factors
    .filter((factor) => factor.available)
    .sort((left, right) => (right.points / right.weight) - (left.points / left.weight))
    .slice(0, 3)
    .map((factor) => factor.reason);
  const caution = factors.find((factor) => factor.caution)?.caution;
  return [...positives, ...(caution ? [caution] : [])].join('；');
}

function buildBreakdown(factors: FactorScore[]): RelevanceFactorBreakdown[] {
  return factors.map((factor) => ({
    key: factor.key,
    label: FACTOR_LABELS[factor.key],
    score: factor.points,
    maxScore: factor.weight,
    contribution: round1((factor.points / factor.weight) * 100),
    available: factor.available,
    reason: factor.reason,
    caution: factor.caution,
  }));
}

function computeConfidence(input: RelevanceScoringInput, factors: FactorScore[]): number {
  const applicable = factors.filter((factor) => factor.available).length;
  const quality = input.dataQuality;
  const sampleSize = input.signalContext?.sampleSize ?? 0;
  let confidence = 20 + applicable * 6;

  if (quality?.coverage === 'full') confidence += 10;
  else if (quality?.coverage === 'limited') confidence += 5;
  else if (quality?.coverage === 'insufficient') confidence -= 10;

  if (quality?.trust === 'high') confidence += 8;
  else if (quality?.trust === 'medium') confidence += 2;
  else if (quality?.trust === 'low') confidence -= 10;

  if (sampleSize >= 30) confidence += 12;
  else if (sampleSize >= 10) confidence += 6;
  else if (sampleSize > 0) confidence -= 8;

  if ((input.recencyDays ?? 99) <= 3) confidence += 4;
  if (input.recencyDays == null) confidence -= 6;
  if (input.limitations.length > 0) confidence -= Math.min(24, input.limitations.length * 4);
  if (input.signalContext?.classification === 'NOISE') confidence -= 12;

  return clamp(round1(confidence), 10, 100);
}

function applyRelevanceGuardrails(input: RelevanceScoringInput, rawScore: number): number {
  let adjusted = rawScore;

  if (input.signalContext?.classification === 'NOISE') {
    adjusted = Math.min(adjusted, 38);
  }

  if (
    input.regimeContext?.currentRegime &&
    input.regimeContext?.relevantRegimes?.length &&
    !input.regimeContext.relevantRegimes.includes(input.regimeContext.currentRegime)
  ) {
    adjusted = Math.min(adjusted, 62);
  }

  if (input.dataQuality?.coverage === 'insufficient' && input.dataQuality?.trust === 'low') {
    adjusted = Math.min(adjusted, input.signalContext ? 42 : 50);
  }

  return adjusted;
}

export function scoreRelevance(input: RelevanceScoringInput): RelevanceScoreResult {
  const factors = [
    scoreDirectness(input.directness, input.alphaContext?.alphaScore),
    scoreSignalQuality(input),
    scoreRecency(input.recencyDays),
    scorePersistence(input.persistence),
    scoreRegime(input),
    scoreDataQuality(input),
  ];

  const applicable = factors.filter((factor) => factor.available);
  const possible = applicable.reduce((sum, factor) => sum + factor.weight, 0);
  const earned = applicable.reduce((sum, factor) => sum + factor.points, 0);
  const rawScore = possible > 0 ? (earned / possible) * 100 : 0;
  const guardedScore = applyRelevanceGuardrails(input, rawScore);
  const explanation = buildExplanation(factors);
  const breakdown = buildBreakdown(factors);
  const confidence = computeConfidence(input, factors);

  return {
    type: input.type,
    relevanceScore: clamp(round1(guardedScore), 0, 100),
    confidence,
    explanation,
    breakdown,
    limitations: [...new Set(input.limitations)],
  };
}

export function buildRelevantInsight(input: RelevanceScoringInput): RelevantInsight {
  const score = scoreRelevance(input);
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    summary: input.summary,
    relevanceScore: score.relevanceScore,
    confidence: score.confidence,
    explanation: score.explanation,
    breakdown: score.breakdown,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef,
    sourceTarget: input.sourceTarget,
    sourceAnchor: input.sourceAnchor,
    limitations: score.limitations,
  };
}

export function rankRelevantInsights(insights: RelevantInsight[]): RelevantInsight[] {
  return [...insights].sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) {
      return right.relevanceScore - left.relevanceScore;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.title.localeCompare(right.title, 'zh-Hant');
  });
}
