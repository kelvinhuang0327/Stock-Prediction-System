import type { AutonomousResearchSnapshot, ReviewReport, SimulatedOrder } from './types';

export function shouldGenerateReview(pnlPct: number | null | undefined): boolean {
  if (pnlPct == null) return false;
  return pnlPct >= 5 || pnlPct <= -5;
}

export function buildReviewReport(
  input: {
    tradeId: number;
    symbol: string;
    setupType: string;
    pnlPct: number | null;
    holdingDays: number | null;
    mfePct: number | null;
    maePct: number | null;
    exitReason: string | null;
    marketState: AutonomousResearchSnapshot['marketState'];
    dataCoverage: AutonomousResearchSnapshot['dataCoverage'];
    thesis: string;
    signalStrength: string;
    fundamentalState: string;
  },
): ReviewReport {
  const triggerType: '+5' | '-5' | 'time' = input.exitReason === 'time'
    ? 'time'
    : (input.pnlPct ?? 0) >= 5 ? '+5' : '-5';
  return {
    tradeId: input.tradeId,
    snapshotId: 0,
    triggerType,
    preTrade: {
      thesis: input.thesis,
      setupType: input.setupType,
      marketState: input.marketState,
      signalStrength: input.signalStrength,
      fundamentalState: input.fundamentalState,
    },
    result: {
      return: input.pnlPct,
      holdingTime: input.holdingDays,
      MFE: input.mfePct,
      MAE: input.maePct,
      exitReason: input.exitReason,
    },
    analysis: {
      technicalEffective: triggerType === '+5',
      fundamentalSupported: input.fundamentalState !== 'insufficient',
      eventDominated: input.signalStrength.includes('event'),
      betaDriven: input.marketState === 'defensive',
    },
    issues: {
      regimeMismatch: input.marketState === 'defensive' && input.setupType === 'trend',
      signalQualityInsufficient: input.dataCoverage !== 'full',
      enteredWithLowData: input.dataCoverage === 'insufficient',
      tooEarlyOrLate: (input.holdingDays ?? 0) < 3,
    },
    recommendations: {
      raiseThresholds: triggerType === '-5',
      removeSetup: input.setupType === 'trend' && input.marketState === 'defensive',
      prioritizeSetup: input.setupType,
    },
  };
}

export function explainExecution(order: SimulatedOrder): string {
  return [
    `symbol=${order.symbol}`,
    `setup=${order.setupType}`,
    `fill=${order.simulatedFillPrice.toFixed(2)}`,
    `qty=${order.quantity}`,
    `market=${order.marketContext.marketState}/${order.marketContext.regime}`,
  ].join(' | ');
}
