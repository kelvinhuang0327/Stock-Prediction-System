export type DataFreshnessState = 'fresh' | 'stale' | 'missing' | 'degraded';

export interface DataLayerStatus {
  key: 'technical' | 'fundamental' | 'events';
  source: string;
  latestTimestamp: string | null;
  freshnessDays: number | null;
  coverage: number;
  rowCount: number;
  freshnessState: DataFreshnessState;
  limitations: string[];
}

export interface AutonomousDataSnapshot {
  generatedAt: string;
  statuses: DataLayerStatus[];
  overallCoverage: 'full' | 'limited' | 'insufficient';
  limitations: string[];
}

export type AutonomousMarketState = 'defensive' | '震盪' | 'recovery' | 'trending';

export interface SectorStrengthItem {
  name: string;
  averageChangePercent: number;
  stockCount: number;
  direction: 'strong' | 'neutral' | 'weak';
}

export interface AutonomousResearchCandidate {
  symbol: string;
  name: string;
  screenBucket: string;
  setupType: 'trend' | 'rebound' | 'event' | 'fundamental';
  alphaScore: number;
  recommendationBucket: string;
  confidence: number;
  priceChangePercent: number;
  conviction: 'low' | 'mid' | 'high';
  thesis: string;
  supportingSignals: string[];
  riskFactors: string[];
}

export interface AutonomousResearchSnapshot {
  generatedAt: string;
  snapshotDate: string;
  marketState: AutonomousMarketState;
  marketRegime: string;
  marketRegimeConfidence: number;
  sectorStrength: SectorStrengthItem[];
  candidateStocks: AutonomousResearchCandidate[];
  riskSignals: string[];
  topInsights: string[];
  dataCoverage: 'full' | 'limited' | 'insufficient';
  limitations: string[];
  snapshotId?: number;
}

export interface StrategyProposal {
  id?: number;
  snapshotId?: number;
  symbol: string;
  setupType: 'trend' | 'rebound' | 'event' | 'fundamental';
  thesis: string;
  entryCondition: string;
  invalidationCondition: string;
  stopLossRule: string;
  takeProfitRule: string;
  positionSizing: number;
  conviction: 'low' | 'mid' | 'high';
  supportingSignals: string[];
  riskFactors: string[];
  researchSnapshotId?: number | null;
  state: 'proposed' | 'approved' | 'rejected' | 'triggered' | 'open' | 'closed' | 'expired' | 'shadow' | 'pending';
  decisionMeta?: Record<string, unknown>;
}

export interface SimulatedOrder {
  id?: number;
  proposalId?: number;
  snapshotId?: number;
  symbol: string;
  setupType: string;
  triggerTime: string | null;
  simulatedFillPrice: number;
  slippageModel: string;
  quantity: number;
  marketContext: {
    marketState: AutonomousMarketState;
    regime: string;
    regimeConfidence: number;
    note: string;
  };
}

export interface TradeJournalEntry {
  id?: number;
  tradeId?: number;
  snapshotId?: number;
  decisionReasoning: string;
  executionDetail: string;
  lifecycle: string;
  researchSnapshot: Record<string, unknown>;
  pnlPct?: number | null;
}

export interface ReviewReport {
  id?: number;
  tradeId?: number;
  snapshotId?: number;
  triggerType: '+5' | '-5' | 'time';
  preTrade: Record<string, unknown>;
  result: Record<string, unknown>;
  analysis: Record<string, unknown>;
  issues: Record<string, unknown>;
  recommendations: Record<string, unknown>;
}

export interface StrategyLearningInsight {
  id?: number;
  generatedAt: string;
  summary: string;
  successPatterns: string[];
  failurePatterns: string[];
  adjustmentSuggestions: string[];
  sourceCount: number;
  limitations: string[];
}

export interface AutonomousDailyRunResult {
  dataSnapshot?: AutonomousDataSnapshot;
  snapshot: AutonomousResearchSnapshot;
  proposals: StrategyProposal[];
  orders: SimulatedOrder[];
  journalEntries: TradeJournalEntry[];
  reviewReports: ReviewReport[];
  learningInsight: StrategyLearningInsight | null;
  researchCycleResult?: {
    parameterSet: { id: number; version: string };
    experimentResults: Array<{
      experimentId: string;
      previousStatus: string;
      newStatus: string;
      evidenceLevel: string;
      runId: number | null;
      skipped: boolean;
      skipReason?: string;
    }>;
    executedAt: string;
    totalDurationMs: number;
  } | null;
}
