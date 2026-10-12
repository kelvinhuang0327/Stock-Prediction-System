/**
 * MultiAgentResearchEngine
 *
 * ⚠️  L3 研究層 — 僅供解釋、情境推演、風險辯論、敘事補充。
 *
 * 禁止：取代 SignalFusionEngine / StrategyScreenEngine / backtest。
 * 禁止：輸出買賣指令、精準價位。
 * 禁止：影響 alphaScore 計算。
 *
 * 6 個固定 Agent：Technical / Market / Chip / Fundamental / Catalyst / Risk
 * 每個 Agent 以已計算的分數推導觀點，不重算核心指標。
 */

// ─── Types ───────────────────────────────────────────────────────

export type AgentStance = 'Bullish' | 'Neutral' | 'Bearish' | 'Insufficient';
export type Consensus = 'Positive' | 'Mixed' | 'Negative' | 'Insufficient';
export type MarketRegime = 'Bull' | 'Bear' | 'Sideways' | 'Unknown';
export type DataCoverage = 'full' | 'limited' | 'insufficient';
export type RecommendationBucket =
  | 'Strong Candidate'
  | 'Watch'
  | 'Neutral'
  | 'Avoid'
  | 'Insufficient Data';

export interface AgentView {
  name: string;
  stance: AgentStance;
  confidence: number; // 0-100
  rationale: string;
  limitations: string[];
  missingSources: string[];
}

export interface ResearchInput {
  symbol?: string;
  marketRegime: MarketRegime;
  regimeConfidence?: number;
  alphaScore: number;
  bucket: RecommendationBucket | string;
  confidence: number;
  dataCoverage: DataCoverage;
  technicalScore: number;
  chipScore: number;
  fundamentalScore: number;
  marketAdjustment: number;
  /** Sources used for scoring, e.g. ['technical', 'chip', 'fundamental'] */
  usedSources?: string[];
  /** Missing source names that caused score degradation */
  missingSources?: string[];
  /** Event layer MVP summary count */
  eventCount?: number;
  eventTrustLevelSummary?: {
    official: number;
    mainstream: number;
    secondary: number;
    unknown: number;
  };
  recentThemes?: string[];
  catalystSummary?: string;
  limitations?: string[];
}

export interface ResearchResult {
  consensus: Consensus;
  consensusConfidence: number;
  viewpoints: AgentView[];
  disagreementPoints: string[];
  keyRisks: string[];
  scenarioNotes: string[];
  limitations: string[];
  disclaimer: string;
}

// ─── Coverage multiplier ─────────────────────────────────────────

function coverageMultiplier(dc: DataCoverage): number {
  if (dc === 'full') return 1.0;
  if (dc === 'limited') return 0.65;
  return 0.35;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Agent factories ─────────────────────────────────────────────

function technicalAgent(input: ResearchInput): AgentView {
  const missSrc = input.missingSources ?? [];
  const isMissing = missSrc.some((s) => s.toLowerCase().includes('技術') || s.toLowerCase().includes('technical'));

  if (isMissing || input.dataCoverage === 'insufficient') {
    return {
      name: 'TechnicalAgent',
      stance: 'Insufficient',
      confidence: 0,
      rationale: '歷史行情資料不足，無法評估技術面。',
      limitations: ['需要 ≥20 天行情資料', '目前資料覆蓋不足'],
      missingSources: ['technical_data'],
    };
  }

  const score = input.technicalScore;
  let stance: AgentStance;
  let rationale: string;

  if (score >= 70) {
    stance = 'Bullish';
    rationale = `技術面評分 ${score.toFixed(0)}，多項技術指標顯示正向動能。此為歷史規律推演，非未來保證。`;
  } else if (score >= 40) {
    stance = 'Neutral';
    rationale = `技術面評分 ${score.toFixed(0)}，技術訊號呈中性，缺乏明確方向性。`;
  } else {
    stance = 'Bearish';
    rationale = `技術面評分 ${score.toFixed(0)}，多項技術指標偏弱，需留意下行壓力。`;
  }

  const conf = clamp(Math.round((score / 100) * 80 * coverageMultiplier(input.dataCoverage)));
  const lims: string[] = [];
  if (input.dataCoverage === 'limited') lims.push('資料天數有限，指標可靠度下降');

  return { name: 'TechnicalAgent', stance, confidence: conf, rationale, limitations: lims, missingSources: [] };
}

function marketAgent(input: ResearchInput): AgentView {
  const regime = input.marketRegime;
  const regConf = input.regimeConfidence ?? 50;
  const adj = input.marketAdjustment;

  let stance: AgentStance;
  let rationale: string;

  if (regime === 'Unknown') {
    return {
      name: 'MarketAgent',
      stance: 'Insufficient',
      confidence: 0,
      rationale: '市場環境資料不足，無法判斷總體方向。',
      limitations: ['需要 ≥50 天指數歷史資料'],
      missingSources: ['market_index'],
    };
  }

  if (regime === 'Bull') {
    stance = adj >= 0 ? 'Bullish' : 'Neutral';
    rationale = `目前處於多頭環境（置信度 ${regConf.toFixed(0)}%），總體市場偏向有利。市場調整 ${adj >= 0 ? '+' : ''}${adj.toFixed(1)} 分。`;
  } else if (regime === 'Bear') {
    stance = adj <= 0 ? 'Bearish' : 'Neutral';
    rationale = `目前處於空頭環境（置信度 ${regConf.toFixed(0)}%），整體市場壓力較大。市場調整 ${adj.toFixed(1)} 分。`;
  } else {
    stance = 'Neutral';
    rationale = `市場處於盤整格局（置信度 ${regConf.toFixed(0)}%），方向不明確，建議保守解讀。`;
  }

  const conf = clamp(Math.round(regConf * 0.75 * coverageMultiplier(input.dataCoverage)));
  return { name: 'MarketAgent', stance, confidence: conf, rationale, limitations: [], missingSources: [] };
}

function chipAgent(input: ResearchInput): AgentView {
  const missSrc = input.missingSources ?? [];
  const chipMissing = missSrc.some((s) => s.toLowerCase().includes('chip') || s.toLowerCase().includes('籌碼'));

  if (chipMissing) {
    return {
      name: 'ChipAgent',
      stance: 'Insufficient',
      confidence: 0,
      rationale: '法人、大戶籌碼資料目前不可用，無法進行籌碼分析。',
      limitations: ['需要法人買賣超資料', '需要融資融券資料'],
      missingSources: ['chip_data', 'institutional_flow'],
    };
  }

  const score = input.chipScore;
  let stance: AgentStance;
  let rationale: string;

  if (score >= 65) {
    stance = 'Bullish';
    rationale = `籌碼面評分 ${score.toFixed(0)}，籌碼結構偏向集中，法人動向積極。此為規則推估，非實際籌碼揭露。`;
  } else if (score >= 40) {
    stance = 'Neutral';
    rationale = `籌碼面評分 ${score.toFixed(0)}，籌碼結構中性，無明顯集中或分散跡象。`;
  } else {
    stance = 'Bearish';
    rationale = `籌碼面評分 ${score.toFixed(0)}，籌碼結構偏分散或法人動向偏弱。`;
  }

  const conf = clamp(Math.round((score / 100) * 70 * coverageMultiplier(input.dataCoverage)));
  return { name: 'ChipAgent', stance, confidence: conf, rationale, limitations: [], missingSources: [] };
}

function fundamentalAgent(input: ResearchInput): AgentView {
  const missSrc = input.missingSources ?? [];
  const fundMissing = missSrc.some((s) =>
    s.toLowerCase().includes('fundamental') ||
    s.toLowerCase().includes('revenue') ||
    s.toLowerCase().includes('基本') ||
    s.toLowerCase().includes('財務')
  );

  if (fundMissing) {
    return {
      name: 'FundamentalAgent',
      stance: 'Insufficient',
      confidence: 0,
      rationale: '財報與基本面資料目前不可用，無法進行基本面評估。',
      limitations: ['需要營收/EPS 資料', '需要 YoY 成長率資料'],
      missingSources: ['revenue_data', 'earnings_data'],
    };
  }

  const score = input.fundamentalScore;
  let stance: AgentStance;
  let rationale: string;

  if (score >= 60) {
    stance = 'Bullish';
    rationale = `基本面評分 ${score.toFixed(0)}，財務指標相對穩健，成長動能尚在。此為規則式評估，非財報正式解讀。`;
  } else if (score >= 35) {
    stance = 'Neutral';
    rationale = `基本面評分 ${score.toFixed(0)}，財務表現中等，無明顯優勢或劣勢。`;
  } else {
    stance = 'Bearish';
    rationale = `基本面評分 ${score.toFixed(0)}，財務指標偏弱，需關注成長持續性。`;
  }

  const conf = clamp(Math.round((score / 100) * 65 * coverageMultiplier(input.dataCoverage)));
  return { name: 'FundamentalAgent', stance, confidence: conf, rationale, limitations: [], missingSources: [] };
}

function catalystAgent(input: ResearchInput): AgentView {
  if (typeof input.eventCount !== 'number') {
    return {
      name: 'CatalystAgent',
      stance: 'Insufficient',
      confidence: 0,
      rationale: '事件/催化劑資料尚未提供，無法評估催化因子強度。',
      limitations: ['CatalystAgent 需要 eventCount / trustLevelSummary / catalystSummary'],
      missingSources: ['event_data'],
    };
  }

  if (input.eventCount <= 0) {
    return {
      name: 'CatalystAgent',
      stance: 'Insufficient',
      confidence: 0,
      rationale: '近期無明確事件資料，催化劑面不足。',
      limitations: ['事件層目前為 MVP，來源覆蓋有限'],
      missingSources: ['event_data'],
    };
  }

  if (input.eventCount <= 2) {
    const themeHint = (input.recentThemes ?? []).slice(0, 2).join('、');
    return {
      name: 'CatalystAgent',
      stance: 'Neutral',
      confidence: 22,
      rationale: `近期僅有零星事件，催化強度有限，暫不形成明確方向${themeHint ? `（主題：${themeHint}）` : ''}。`,
      limitations: ['事件數量偏少，僅可作輔助解讀', '此判讀不構成投資建議'],
      missingSources: [],
    };
  }

  const trust = input.eventTrustLevelSummary;
  const highTrust = (trust?.official ?? 0) + (trust?.mainstream ?? 0);
  const lowTrust = (trust?.secondary ?? 0) + (trust?.unknown ?? 0);
  const themeHint = (input.recentThemes ?? []).slice(0, 3).join('、');
  const summaryHint = input.catalystSummary ? `摘要：${input.catalystSummary}` : '';

  if (highTrust === 0 && lowTrust > 0) {
    return {
      name: 'CatalystAgent',
      stance: 'Neutral',
      confidence: 20,
      rationale: `近期事件雖較集中，但來源多為次級/未分類，訊號可信度受限。${summaryHint}`,
      limitations: ['事件來源可信度偏低，僅可作為研究補充', 'CatalystAgent 不可單獨作為決策依據'],
      missingSources: [],
    };
  }

  return {
    name: 'CatalystAgent',
    stance: 'Bullish',
    confidence: 32,
    rationale: `近期事件較集中，且包含較高可信度來源，可能形成短期題材關注${themeHint ? `（主題：${themeHint}）` : ''}。${summaryHint}`,
    limitations: ['事件層僅供研究解釋，不直接影響 alphaScore 或 screen', '事件摘要不代表漲跌保證，僅為低信心觀點'],
    missingSources: [],
  };
}

function riskAgent(input: ResearchInput, otherAgents: AgentView[]): AgentView {
  // RiskAgent MUST provide counterpoint — never fully agree with consensus
  const bullishCount = otherAgents.filter((a) => a.stance === 'Bullish').length;
  const bearishCount = otherAgents.filter((a) => a.stance === 'Bearish').length;
  const insuffCount = otherAgents.filter((a) => a.stance === 'Insufficient').length;

  const risks: string[] = [];

  // Identify risks from data
  if (input.dataCoverage !== 'full') risks.push(`資料覆蓋率${input.dataCoverage === 'limited' ? '有限' : '不足'}，分析可靠性下降`);
  if (input.confidence < 40) risks.push(`整體評分置信度偏低（${input.confidence.toFixed(0)}%），結論需保守解讀`);
  if (input.marketRegime === 'Bear') risks.push('空頭市場環境下個股風險普遍上升');
  if (input.marketRegime === 'Unknown') risks.push('市場環境不明確，總體風險難以量化');
  if (input.fundamentalScore < 35) risks.push('基本面偏弱，需關注財務持續性');
  if (insuffCount >= 2) risks.push(`${insuffCount} 個分析維度資料不足，研究存在盲點`);

  // Always add a general structural risk
  risks.push('歷史表現不代表未來，市場存在不可預測性');

  let stance: AgentStance;
  let rationale: string;

  if (bullishCount >= 3) {
    // Counter optimism
    stance = 'Bearish';
    rationale = `雖然多數觀點偏多，但風險代理人必須指出：${risks.slice(0, 2).join('；')}。市場情緒趨於樂觀時，需特別警惕反轉風險。`;
  } else if (bearishCount >= 3) {
    // Provide balance
    stance = 'Neutral';
    rationale = `多數觀點偏空，但風險代理人注意：過度悲觀也可能錯過修復機會。${risks[0]}。需持續觀察是否有資料改善。`;
  } else if (insuffCount >= 3) {
    stance = 'Insufficient';
    rationale = '資料嚴重不足，任何方向性觀點都缺乏依據。建議等待更完整資料後再行判斷。';
  } else {
    // Mixed/neutral consensus — add friction
    stance = 'Bearish';
    rationale = `觀點分歧時，風險代理人傾向謹慎：${risks.slice(0, 2).join('；')}。分歧本身即是不確定性的訊號。`;
  }

  const conf = clamp(Math.round(50 * coverageMultiplier(input.dataCoverage)));

  return {
    name: 'RiskAgent',
    stance,
    confidence: conf,
    rationale,
    limitations: ['風險評估基於規則推演，非全面風控系統', '無法預測黑天鵝事件'],
    missingSources: [],
  };
}

// ─── Consensus calculation ────────────────────────────────────────

function computeConsensus(views: AgentView[], dc: DataCoverage): { consensus: Consensus; confidence: number } {
  const counts = { Bullish: 0, Neutral: 0, Bearish: 0, Insufficient: 0 };
  for (const v of views) counts[v.stance]++;

  const total = views.length;
  const insufRatio = counts.Insufficient / total;

  if (insufRatio > 0.5) {
    return { consensus: 'Insufficient', confidence: Math.round(20 * coverageMultiplier(dc)) };
  }

  const deciding = views.filter((v) => v.stance !== 'Insufficient');
  const bull = deciding.filter((v) => v.stance === 'Bullish').length;
  const bear = deciding.filter((v) => v.stance === 'Bearish').length;

  let consensus: Consensus;
  if (deciding.length === 0) {
    consensus = 'Insufficient';
  } else if (bull > bear + 1) {
    consensus = 'Positive';
  } else if (bear > bull + 1) {
    consensus = 'Negative';
  } else {
    consensus = 'Mixed';
  }

  const avgConf = deciding.length > 0
    ? deciding.reduce((s, v) => s + v.confidence, 0) / deciding.length
    : 0;
  const confidence = clamp(Math.round(avgConf * coverageMultiplier(dc)));

  return { consensus, confidence };
}

// ─── Disagreement + scenario notes ───────────────────────────────

function extractDisagreements(views: AgentView[]): string[] {
  const deciding = views.filter((v) => v.stance !== 'Insufficient');
  if (deciding.length < 2) return [];

  const bull = deciding.filter((v) => v.stance === 'Bullish').map((v) => v.name);
  const bear = deciding.filter((v) => v.stance === 'Bearish').map((v) => v.name);

  const points: string[] = [];
  if (bull.length > 0 && bear.length > 0) {
    points.push(`${bull.join('、')} 觀點偏多，而 ${bear.join('、')} 持保守立場，觀點存在分歧`);
  }
  if (views.find((v) => v.name === 'RiskAgent' && v.stance !== views.find(x => x.name === 'TechnicalAgent')?.stance)) {
    points.push('風險代理人立場與技術面觀點不一致，建議審慎');
  }
  return points;
}

function buildScenarioNotes(input: ResearchInput, consensus: Consensus): string[] {
  const notes: string[] = [];

  if (consensus === 'Positive') {
    notes.push('若市場延續現狀，技術面動能或可持續，但需持續確認成交量配合。');
    if (input.marketRegime === 'Bull') notes.push('多頭環境下強勢股有機會繼續強勢，但追高風險仍存。');
    notes.push('若市場突然轉弱或流動性收縮，評估結果可能迅速失效。');
  } else if (consensus === 'Negative') {
    notes.push('若基本面持續惡化或市場轉為空頭，下行壓力可能加劇。');
    notes.push('若有利多消息或資金回流，技術面有機會出現反彈，但需進一步確認。');
  } else if (consensus === 'Mixed') {
    notes.push('觀點分歧時，建議等待更明確訊號再行評估，不宜倉促下結論。');
    notes.push('分歧的觀點反映現有資料的不確定性，謹慎解讀為宜。');
  } else {
    notes.push('資料不足時，任何情境推演均缺乏依據，建議優先補齊資料覆蓋。');
  }

  return notes;
}

function collectKeyRisks(views: AgentView[], input: ResearchInput): string[] {
  const riskView = views.find((v) => v.name === 'RiskAgent');
  const risks: string[] = [];

  if (riskView && riskView.stance !== 'Insufficient') {
    // Extract first sentence of rationale as key risk
    const firstSentence = riskView.rationale.split('：')[1]?.split('。')[0];
    if (firstSentence) risks.push(firstSentence.trim());
  }

  if (input.dataCoverage !== 'full') {
    risks.push(`資料覆蓋${input.dataCoverage === 'limited' ? '有限' : '不足'}，分析存在盲點`);
  }
  if (input.marketRegime === 'Bear') risks.push('空頭市場下個股風險偏高');
  if (input.confidence < 30) risks.push('整體置信度低，結論可靠性存疑');

  // Dedup
  return [...new Set(risks)].slice(0, 5);
}

// ─── Main engine function ─────────────────────────────────────────

export function runMultiAgentResearch(input: ResearchInput): ResearchResult {
  // Build first 5 agents
  const tech = technicalAgent(input);
  const market = marketAgent(input);
  const chip = chipAgent(input);
  const fund = fundamentalAgent(input);
  const catalyst = catalystAgent(input);

  const firstFive = [tech, market, chip, fund, catalyst];

  // Risk agent must see others first
  const risk = riskAgent(input, firstFive);

  const viewpoints = [...firstFive, risk];

  const { consensus, confidence } = computeConsensus(viewpoints, input.dataCoverage);
  const disagreementPoints = extractDisagreements(viewpoints);
  const keyRisks = collectKeyRisks(viewpoints, input);
  const scenarioNotes = buildScenarioNotes(input, consensus);

  // Collect all limitations
  const allLimitations: string[] = [...(input.limitations ?? [])];
  for (const v of viewpoints) {
    for (const l of v.limitations) {
      if (!allLimitations.includes(l)) allLimitations.push(l);
    }
  }

  return {
    consensus,
    consensusConfidence: confidence,
    viewpoints,
    disagreementPoints,
    keyRisks,
    scenarioNotes,
    limitations: allLimitations,
    disclaimer:
      '本研究委員會觀點由規則式引擎基於已計算分數自動推導，僅供研究參考，非交易建議，不構成任何投資意見。所有觀點均為模型推估，不保證準確性。',
  };
}
