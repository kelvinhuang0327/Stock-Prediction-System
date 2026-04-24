import { prisma } from '../prisma';
import type { AutonomousResearchSnapshot, StrategyProposal } from './types';

export interface ProposalRiskAssessment {
  approved: boolean;
  adjustedPositionSizing: number;
  maxRiskPerTrade: number;
  totalExposureCap: number;
  warnings: string[];
  rejectionReason?: string;
}

function convictionMultiplier(conviction: StrategyProposal['conviction']): number {
  if (conviction === 'high') return 1;
  if (conviction === 'mid') return 0.7;
  return 0.4;
}

function regimeMultiplier(marketState: AutonomousResearchSnapshot['marketState']): number {
  if (marketState === 'trending') return 1;
  if (marketState === 'recovery') return 0.8;
  if (marketState === '震盪') return 0.6;
  return 0.35;
}

function setupMultiplier(setupType: StrategyProposal['setupType']): number {
  if (setupType === 'trend') return 1;
  if (setupType === 'fundamental') return 0.9;
  if (setupType === 'event') return 0.75;
  return 0.6;
}

export async function assessProposalRisk(
  proposal: StrategyProposal,
  snapshot: AutonomousResearchSnapshot,
  options?: { capital?: number },
): Promise<ProposalRiskAssessment> {
  const capital = options?.capital ?? 1_000_000;
  const maxRiskPerTrade = 0.02;
  const totalExposureCap = snapshot.marketState === 'defensive' ? 0.15 : 0.3;
  const warnings: string[] = [];

  const marketExposurePenalty = regimeMultiplier(snapshot.marketState);
  const convictionWeight = convictionMultiplier(proposal.conviction);
  const setupWeight = setupMultiplier(proposal.setupType);
  const dataWeight = snapshot.dataCoverage === 'full' ? 1 : snapshot.dataCoverage === 'limited' ? 0.7 : 0.4;

  if (snapshot.dataCoverage !== 'full') {
    warnings.push('資料覆蓋率未達 full，倉位需保守。');
  }
  if (snapshot.marketState === 'defensive' && proposal.setupType === 'trend') {
    warnings.push('防守盤不利追強趨勢提案。');
  }

  const existingOpenTrades = await prisma.simulatedTrade.count({
    where: { status: { in: ['open', 'shadow-open'] }, symbol: proposal.symbol },
  });
  if (existingOpenTrades > 0) {
    warnings.push('同標的已有開倉模擬單，重複曝險需降低。');
  }

  const baseSizing = proposal.positionSizing * convictionWeight * setupWeight * marketExposurePenalty * dataWeight;
  const adjustedPositionSizing = Math.max(0, Math.min(totalExposureCap, baseSizing));

  if (adjustedPositionSizing <= 0.01) {
    return {
      approved: false,
      adjustedPositionSizing,
      maxRiskPerTrade,
      totalExposureCap,
      warnings,
      rejectionReason: '綜合風險調整後倉位過低，暫不開倉。',
    };
  }

  const maxRiskAmount = capital * maxRiskPerTrade;
  const estimatedRiskAmount = capital * adjustedPositionSizing;
  if (estimatedRiskAmount > maxRiskAmount) {
    warnings.push('超過單筆最大風險額度，已準備降倉。');
  }

  return {
    approved: true,
    adjustedPositionSizing: Math.min(adjustedPositionSizing, maxRiskPerTrade),
    maxRiskPerTrade,
    totalExposureCap,
    warnings,
  };
}
