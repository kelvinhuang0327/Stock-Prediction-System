export type TopicRole = 'origin' | 'early' | 'follower' | 'late' | 'unclear';

export interface PortfolioImpactTopicContextItem {
  topic: string;
  stage: 'early' | 'spreading' | 'mature' | 'fading' | 'unknown';
  momentumType: string;
  diffusionType: string;
  role: TopicRole;
}

export interface PortfolioImpact {
  symbol: string;
  alphaContext: {
    alphaScore: number;
    bucket: string;
    confidence: number;
  };
  regimeContext: {
    regime: string;
    confidence: number;
    implication: string;
  };
  topicContext: {
    topics: PortfolioImpactTopicContextItem[];
  };
  eventContext: {
    eventCount: number;
    recentAlertTypes: string[];
    trustLevelSummary: string;
  };
  crossMarketContext: {
    spreadPattern: string;
    spreadSpeed: string;
    positionInChain: string;
  };
  riskContext: {
    riskLevel: string;
    warnings: string[];
  };
  narrative: string;
  limitations: string[];
}

export type ConcentrationLevel = 'low' | 'moderate' | 'high' | 'unknown';
export type PortfolioRiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';

export interface PortfolioThemeConcentrationItem {
  theme: string;
  weight: number;
  symbols: string[];
  linkageSignals: string[];
}

export interface PortfolioThemeConcentration {
  topThemes: PortfolioThemeConcentrationItem[];
  concentrationLevel: ConcentrationLevel;
  explanation: string;
}

export interface PortfolioSectorConcentrationItem {
  sector: string;
  weight: number;
  symbols: string[];
}

export interface PortfolioSectorConcentration {
  sectors: PortfolioSectorConcentrationItem[];
  concentrationLevel: ConcentrationLevel;
  chainBias: string;
  explanation: string;
}

export interface PortfolioRiskClusterItem {
  clusterType: string;
  riskLevel: PortfolioRiskLevel;
  symbols: string[];
  reason: string;
}

export interface PortfolioRiskClusters {
  overallRiskLevel: PortfolioRiskLevel;
  clusters: PortfolioRiskClusterItem[];
}

export interface PortfolioRegimeExposure {
  regime: string;
  confidence: number;
  offensiveExposure: number;
  defensiveExposure: number;
  neutralExposure: number;
  sensitivity: 'defensive' | 'balanced' | 'pro-cyclical' | 'unknown';
  note: string;
}

export interface PortfolioDecisionSupport {
  summary: string;
  themeConcentration: PortfolioThemeConcentration;
  sectorConcentration: PortfolioSectorConcentration;
  riskClusters: PortfolioRiskClusters;
  regimeExposure: PortfolioRegimeExposure;
  limitations: string[];
}

export interface PortfolioImpactSnapshotRecord extends PortfolioDecisionSupport {
  snapshotDate: string;
  scope: 'watchlist' | 'candidates';
  symbols: string[];
}

export interface PortfolioImpactSnapshotComparison {
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  compareWindow: '1d' | '7d' | '30d';
  themeChanged: boolean;
  sectorChanged: boolean;
  riskChanged: boolean;
  regimeExposureChanged: boolean;
  summaryNote: string;
  details: {
    themeLevelChange: { from: ConcentrationLevel | 'unknown'; to: ConcentrationLevel | 'unknown' };
    sectorLevelChange: { from: ConcentrationLevel | 'unknown'; to: ConcentrationLevel | 'unknown' };
    riskLevelChange: { from: PortfolioRiskLevel | 'unknown'; to: PortfolioRiskLevel | 'unknown' };
    regimeChange: { from: string; to: string; fromSensitivity: string; toSensitivity: string };
    topThemeChange: { from: string | null; to: string | null };
    topSectorChange: { from: string | null; to: string | null };
  };
}
