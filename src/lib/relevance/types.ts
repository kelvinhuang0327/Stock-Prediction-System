import type { SignalClassification } from '@/lib/signals/types';

export type RelevanceMode = 'symbol' | 'watchlist' | 'report';
export type RelevantInsightCategory = 'signal' | 'event' | 'topic' | 'risk' | 'portfolio';
export type InsightDirectness = 'direct' | 'watchlist' | 'portfolio' | 'market' | 'indirect';
export type InsightCoverage = 'full' | 'limited' | 'insufficient' | 'unknown';
export type InsightTrust = 'high' | 'medium' | 'low' | 'unknown';
export type InsightPersistence = 'transient' | 'developing' | 'persistent' | 'continuous' | 'unknown';
export type RelevanceFactorKey =
  | 'directness'
  | 'signalQuality'
  | 'recency'
  | 'persistence'
  | 'regime'
  | 'dataQuality';

export interface RelevanceSignalContext {
  classification: SignalClassification;
  sampleSize?: number;
}

export interface RelevanceRegimeContext {
  currentRegime?: string;
  relevantRegimes?: string[];
}

export interface RelevanceDataQuality {
  coverage?: InsightCoverage;
  trust?: InsightTrust;
}

export interface RelevanceAlphaContext {
  alphaScore?: number;
  confidence?: number;
}

export interface RelevanceScoringInput {
  id: string;
  type: string;
  category: RelevantInsightCategory;
  title: string;
  summary: string;
  sourceType: string;
  sourceRef?: string;
  sourceTarget?: string;
  sourceAnchor?: string;
  directness: InsightDirectness;
  signalContext?: RelevanceSignalContext;
  recencyDays?: number | null;
  persistence?: InsightPersistence;
  regimeContext?: RelevanceRegimeContext;
  dataQuality?: RelevanceDataQuality;
  alphaContext?: RelevanceAlphaContext;
  limitations: string[];
}

export interface RelevanceFactorBreakdown {
  key: RelevanceFactorKey;
  label: string;
  score: number;
  maxScore: number;
  contribution: number;
  available: boolean;
  reason: string;
  caution?: string;
}

export interface RelevanceScoreResult {
  type: string;
  relevanceScore: number;
  confidence: number;
  explanation: string;
  breakdown: RelevanceFactorBreakdown[];
  limitations: string[];
}

export type OverlayQualityLabel =
  | 'RESEARCH_CONFIDENT'
  | 'RESEARCH_CAUTION'
  | 'RESEARCH_WEAK'
  | 'RESEARCH_INSUFFICIENT';

export interface InsightQualityOverlaySections {
  disagreement: 'LOW' | 'MODERATE' | 'HIGH' | 'N/A';
  walkForward: 'STABLE' | 'MIXED' | 'UNSTABLE' | 'N/A';
  regimeStability: 'REGIME_STABLE' | 'REGIME_CONDITIONAL' | 'REGIME_FRAGILE' | 'N/A';
  confidenceReadiness: 'CALIBRATED' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'UNCALIBRATED' | 'N/A';
  eventSourceQuality: 'LIVE_CONFIDENT' | 'MIXED_SOURCE' | 'SIMULATION_DOMINATED' | 'INSUFFICIENT_EVENT_DATA' | 'N/A';
}

export interface InsightQualityOverlay {
  qualityLabel: OverlayQualityLabel;
  /** Additive adjustment to relevanceScore (already applied; shown here for transparency). */
  scoreAdjustment: number;
  /** Additive adjustment to confidence (already applied; shown here for transparency). */
  confidenceAdjustment: number;
  /** Human-readable reasons for the label, in Traditional Chinese. */
  reasons: string[];
  sections: InsightQualityOverlaySections;
}

export interface RelevantInsight {
  id: string;
  category: RelevantInsightCategory;
  title: string;
  summary: string;
  relevanceScore: number;
  confidence: number;
  explanation: string;
  breakdown: RelevanceFactorBreakdown[];
  sourceType: string;
  sourceRef?: string;
  sourceTarget?: string;
  sourceAnchor?: string;
  limitations: string[];
  qualityOverlay?: InsightQualityOverlay;
}

export interface RelevanceInsightsApiResponse {
  insights: RelevantInsight[];
  generatedAt: string;
  limitations: string[];
}
