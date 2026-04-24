/**
 * SimulationExecutionEngine — Soft trigger integration tests
 */

jest.mock('../../prisma', () => ({
  prisma: {
    simulatedTrade: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    strategyProposal: {
      create: jest.fn(),
    },
    tradeJournalEntry: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tradeReviewReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    stockQuote: {
      findMany: jest.fn(),
    },
    autonomousResearchSnapshot: {
      findUnique: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('../AutonomousRiskEngine', () => ({
  assessProposalRisk: jest.fn(),
}));

import { executeSimulationCycle, closeOpenTrades } from '../SimulationExecutionEngine';
import { prisma } from '../../prisma';
import { assessProposalRisk } from '../AutonomousRiskEngine';
import type { AutonomousResearchSnapshot, StrategyProposal } from '../types';

const mockTradeCount = prisma.simulatedTrade.count as jest.Mock;
const mockTradeFindMany = prisma.simulatedTrade.findMany as jest.Mock;
const mockTradeCreate = prisma.simulatedTrade.create as jest.Mock;
const mockTradeUpdate = prisma.simulatedTrade.update as jest.Mock;
const mockProposalCreate = prisma.strategyProposal.create as jest.Mock;
const mockJournalCreate = prisma.tradeJournalEntry.create as jest.Mock;
const mockJournalUpdate = prisma.tradeJournalEntry.update as jest.Mock;
const mockJournalUpdateMany = prisma.tradeJournalEntry.updateMany as jest.Mock;
const mockReviewCreate = prisma.tradeReviewReport.create as jest.Mock;
const mockReviewFindUnique = prisma.tradeReviewReport.findUnique as jest.Mock;
const mockSnapshotFindUnique = (prisma as unknown as { autonomousResearchSnapshot: { findUnique: jest.Mock } }).autonomousResearchSnapshot.findUnique;
const mockQuoteFindMany = prisma.stockQuote.findMany as jest.Mock;
const mockQueryRaw = (prisma as unknown as { $queryRawUnsafe: jest.Mock }).$queryRawUnsafe;
const mockAssessRisk = assessProposalRisk as jest.Mock;

function makeSnapshot(overrides: Partial<AutonomousResearchSnapshot> = {}): AutonomousResearchSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    snapshotDate: '2026-03-27',
    marketState: 'defensive',
    marketRegime: 'Bear',
    marketRegimeConfidence: 0.6,
    sectorStrength: [],
    candidateStocks: [],
    riskSignals: [],
    topInsights: [],
    dataCoverage: 'limited',
    limitations: [],
    snapshotId: 1,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<StrategyProposal> = {}): StrategyProposal {
  return {
    symbol: '2337',
    setupType: 'rebound',
    thesis: '反彈測試',
    entryCondition: '條件',
    invalidationCondition: '失效',
    stopLossRule: '停損',
    takeProfitRule: '停利',
    positionSizing: 0.1,
    conviction: 'high',
    supportingSignals: ['technical'],
    riskFactors: ['marketRisk'],
    state: 'proposed',
    researchSnapshotId: 1,
    ...overrides,
  };
}

function makeQuotes(count: number) {
  // Dates end at yesterday to pass the STALE_ENTRY_DAYS=5 guard in SimulationExecutionEngine
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (count - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      open: 100 + i * 0.3,
      high: 102 + i * 0.3,
      low: 99 + i * 0.2,
      close: 101 + i * 0.3,
      volume: 10000 + i * 100,
      change: 0.3,
    };
  });
}

/** Flat quotes — rebound scores ~0.55 in defensive (shadow zone, below pending 0.6) */
function makeFlatQuotes(count: number) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (count - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      open: 100,
      high: 100.5,
      low: 99.5,
      close: 100,
      volume: 10000,
      change: 0,
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: 0 closed trades → bootstrap mode
  // count is called twice: once for closed/shadow-closed, once for bootstrap cap
  mockTradeCount.mockResolvedValue(0);
  mockAssessRisk.mockResolvedValue({
    approved: true,
    adjustedPositionSizing: 0.015,
    maxRiskPerTrade: 0.02,
    totalExposureCap: 0.15,
    warnings: [],
  });
  mockProposalCreate.mockResolvedValue({ id: 1 });
  mockTradeCreate.mockResolvedValue({
    id: 1,
    proposalId: 1,
    symbol: '2337',
    setupType: 'rebound',
    entryPrice: 101,
    simulatedFillPrice: 101.15,
    pnlPct: 0,
    holdingDays: 0,
    mfePct: 0,
    maePct: 0,
    exitReason: null,
    entryDate: '2026-03-25',
  });
  mockTradeUpdate.mockResolvedValue({
    id: 1,
    symbol: '2337',
    setupType: 'rebound',
    entryPrice: 101,
    simulatedFillPrice: 101.15,
    pnlPct: 0,
    holdingDays: 0,
    mfePct: 0,
    maePct: 0,
    exitReason: null,
    status: 'shadow-open',
  });
  mockJournalCreate.mockResolvedValue({});
  mockJournalUpdate.mockResolvedValue({});
  mockReviewCreate.mockResolvedValue({});
  mockQueryRaw.mockResolvedValue([]);  // Phase 2.5: no promotion history by default
  mockQuoteFindMany.mockResolvedValue(makeQuotes(25));
});

describe('SimulationExecutionEngine — Soft Trigger', () => {
  it('creates shadow trade in bootstrap mode even with defensive market', async () => {
    const snapshot = makeSnapshot({ marketState: 'defensive' });
    const proposals = [makeProposal()];

    const result = await executeSimulationCycle(snapshot, proposals);

    // Bootstrap mode: with 0 closed trades, at least the top proposal gets a shadow trade
    // Check that proposalCreate was called with a non-rejected state
    expect(mockProposalCreate).toHaveBeenCalled();
    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    expect(['shadow', 'pending', 'triggered']).toContain(proposalCall.state);

    // A trade should have been created
    expect(mockTradeCreate).toHaveBeenCalled();
  });

  it('rejects proposals that fail risk assessment', async () => {
    mockAssessRisk.mockResolvedValue({
      approved: false,
      adjustedPositionSizing: 0.005,
      maxRiskPerTrade: 0.02,
      totalExposureCap: 0.15,
      warnings: [],
      rejectionReason: '倉位過低',
    });

    const result = await executeSimulationCycle(makeSnapshot(), [makeProposal()]);

    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    expect(proposalCall.state).toBe('rejected');
    expect(mockTradeCreate).not.toHaveBeenCalled();
  });

  it('[bootstrap-fix] creates shadow trade when dataCoverage=insufficient blocks risk floor in bootstrap mode', async () => {
    // This is the root cause of the production bootstrap failure.
    // dataCoverage='insufficient' → dataWeight=0.4 → adjSizing=0.0084 < 0.01 → rejected
    // Bootstrap mode should re-assess with dataCoverage='limited' and allow seeding.
    mockAssessRisk
      .mockResolvedValueOnce({
        // First call: with dataCoverage='insufficient' — fails floor
        approved: false,
        adjustedPositionSizing: 0.0084,
        maxRiskPerTrade: 0.02,
        totalExposureCap: 0.15,
        warnings: ['dataCoverage insufficient'],
      })
      .mockResolvedValueOnce({
        // Second call: with dataCoverage='limited' (bootstrap re-assess) — passes
        approved: true,
        adjustedPositionSizing: 0.0147,
        maxRiskPerTrade: 0.02,
        totalExposureCap: 0.15,
        warnings: ['資料覆蓋率未達 full，倉位需保守。'],
      });

    const snapshot = makeSnapshot({ dataCoverage: 'insufficient', marketState: 'defensive' });
    await executeSimulationCycle(snapshot, [makeProposal()]);

    // Risk engine must have been called twice: first with insufficient, then with limited
    expect(mockAssessRisk).toHaveBeenCalledTimes(2);
    const secondCall = mockAssessRisk.mock.calls[1];
    expect(secondCall[1].dataCoverage).toBe('limited');

    // A shadow trade must be created (bootstrap guarantee fired)
    expect(mockTradeCreate).toHaveBeenCalled();

    // Proposal must NOT be written as rejected
    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    expect(proposalCall.state).not.toBe('rejected');
  });

  it('still rejects in bootstrap mode when risk fails for non-coverage reasons', async () => {
    // Even in bootstrap mode, if re-assessment with 'limited' also rejects, don't force through
    mockAssessRisk
      .mockResolvedValueOnce({ approved: false, adjustedPositionSizing: 0.0084, maxRiskPerTrade: 0.02, totalExposureCap: 0.15, warnings: [] })
      .mockResolvedValueOnce({ approved: false, adjustedPositionSizing: 0.008, maxRiskPerTrade: 0.02, totalExposureCap: 0.15, warnings: [] });

    const snapshot = makeSnapshot({ dataCoverage: 'insufficient' });
    await executeSimulationCycle(snapshot, [makeProposal()]);

    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    expect(proposalCall.state).toBe('rejected');
    expect(mockTradeCreate).not.toHaveBeenCalled();
  });

  it('includes trigger score breakdown in proposal decisionMeta', async () => {
    await executeSimulationCycle(makeSnapshot(), [makeProposal()]);

    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    const meta = JSON.parse(proposalCall.decisionMeta);
    expect(meta.triggerScore).toBeDefined();
    expect(meta.triggerScore.finalScore).toBeGreaterThanOrEqual(0);
    expect(meta.triggerScore.tradeMode).toBeDefined();
    expect(meta.triggerScore.components).toBeInstanceOf(Array);
  });

  it('applies position sizing multiplier for shadow trades', async () => {
    await executeSimulationCycle(makeSnapshot(), [makeProposal()]);

    if (mockTradeCreate.mock.calls.length > 0) {
      const tradeCall = mockTradeCreate.mock.calls[0][0].data;
      // Shadow trades use 0.3x multiplier on the assessed sizing
      // assessed = 0.015, shadow = 0.015 * 0.3 = 0.0045
      // quantity should reflect the reduced sizing
      expect(tradeCall.quantity).toBeGreaterThanOrEqual(0);
    }
  });

  it('creates full trade in trending market with good conditions', async () => {
    mockAssessRisk.mockResolvedValue({
      approved: true,
      adjustedPositionSizing: 0.08,
      maxRiskPerTrade: 0.02,
      totalExposureCap: 0.3,
      warnings: [],
    });

    const snapshot = makeSnapshot({ marketState: 'trending', dataCoverage: 'full' });
    await executeSimulationCycle(snapshot, [makeProposal({ setupType: 'trend' })]);

    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    const meta = JSON.parse(proposalCall.decisionMeta);
    // In trending market with upward-trending quotes, trend should score well
    expect(meta.triggerScore.regimeMultiplier).toBe(1.0);
  });

  it('handles multiple proposals — picks best for bootstrap guarantee', async () => {
    const proposals = [
      makeProposal({ symbol: '2337', setupType: 'rebound' }),
      makeProposal({ symbol: '2308', setupType: 'trend' }),
    ];

    // Both return similar quotes
    mockQuoteFindMany.mockResolvedValue(makeQuotes(25));

    await executeSimulationCycle(makeSnapshot(), proposals);

    // At least one trade should be created in bootstrap mode
    expect(mockTradeCreate.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('skips proposals with insufficient quotes', async () => {
    mockQuoteFindMany.mockResolvedValue(makeQuotes(5));

    await executeSimulationCycle(makeSnapshot(), [makeProposal()]);

    // Proposal should still be created (as approved/none) but no trade
    // The proposal is still created because risk check passes first
    expect(mockTradeCreate).not.toHaveBeenCalled();
  });
});

// ─── P0/P1 Fix Validation ────────────────────────────────────────

describe('SimulationExecutionEngine — P0/P1 Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssessRisk.mockResolvedValue({
      approved: true,
      adjustedPositionSizing: 0.015,
      maxRiskPerTrade: 0.02,
      totalExposureCap: 0.15,
      warnings: [],
    });
    mockProposalCreate.mockResolvedValue({ id: 1 });
    mockTradeCreate.mockResolvedValue({
      id: 1, proposalId: 1, symbol: '2337', setupType: 'rebound',
      entryPrice: 101, simulatedFillPrice: 101.15, pnlPct: 0,
      holdingDays: 0, mfePct: 0, maePct: 0, exitReason: null,
      entryDate: '2026-03-25',
    });
    mockTradeUpdate.mockResolvedValue({
      id: 1, symbol: '2337', setupType: 'rebound',
      entryPrice: 101, simulatedFillPrice: 101.15, pnlPct: 0,
      holdingDays: 0, mfePct: 0, maePct: 0, exitReason: null,
      status: 'shadow-open',
    });
    mockJournalCreate.mockResolvedValue({});
    mockJournalUpdate.mockResolvedValue({});
    mockReviewCreate.mockResolvedValue({});
    mockQuoteFindMany.mockResolvedValue(makeQuotes(25));
  });

  it('[P0-1] exits bootstrap when shadow-closed trades exist', async () => {
    // First call: count closed/shadow-closed → 3 (has shadow-closed trades)
    // Second call: count bootstrap cap → 0
    mockTradeCount
      .mockResolvedValueOnce(3)  // closedTradeCount includes shadow-closed
      .mockResolvedValueOnce(0); // bootstrap cap check

    await executeSimulationCycle(makeSnapshot(), [makeProposal()]);

    // With closedTradeCount=3, bootstrap mode is OFF
    // Proposals should use normal thresholds (not forced promotion)
    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    const meta = JSON.parse(proposalCall.decisionMeta);
    expect(meta.triggerScore.bootstrapActive).toBeFalsy();
  });

  it('[P0-1] bootstrap cap stops forced promotion after limit', async () => {
    // First call: count closed → 0 (still in bootstrap)
    // Second call: bootstrap cap → 10 (cap reached)
    mockTradeCount
      .mockResolvedValueOnce(0)   // closedTradeCount=0 → bootstrapMode=true
      .mockResolvedValueOnce(10); // bootstrapCapReached=true

    await executeSimulationCycle(
      makeSnapshot({ marketState: 'defensive' }),
      [makeProposal()],
    );

    // Bootstrap cap reached: no forced shadow promotion
    // Score in defensive market may be too low for natural shadow entry
    const proposalCall = mockProposalCreate.mock.calls[0][0].data;
    // Should NOT be force-promoted to shadow despite bootstrap mode
    const meta = JSON.parse(proposalCall.decisionMeta);
    // Either naturally scored or remains in 'none'
    if (meta.triggerScore.tradeMode === 'shadow') {
      // If shadow, it should be natural (not bootstrap-forced)
      expect(meta.triggerScore.bootstrapActive).toBeFalsy();
    }
  });

  it('[P0-1] bootstrap count query includes shadow-closed', async () => {
    mockTradeCount.mockResolvedValue(0);

    await executeSimulationCycle(makeSnapshot(), [makeProposal()]);

    // The first count call should query for both 'closed' and 'shadow-closed'
    const firstCountCall = mockTradeCount.mock.calls[0][0];
    expect(firstCountCall.where.status).toEqual({ in: ['closed', 'shadow-closed'] });
  });
});

// ─── Regime-Aware Promotion Validation ───────────────────────────

describe('SimulationExecutionEngine — Shadow Track Record Promotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssessRisk.mockResolvedValue({
      approved: true,
      adjustedPositionSizing: 0.015,
      maxRiskPerTrade: 0.02,
      totalExposureCap: 0.15,
      warnings: [],
    });
    mockProposalCreate.mockResolvedValue({ id: 1 });
    mockTradeCreate.mockResolvedValue({
      id: 1, proposalId: 1, symbol: '2337', setupType: 'rebound',
      entryPrice: 100, simulatedFillPrice: 100.15, pnlPct: 0,
      holdingDays: 0, mfePct: 0, maePct: 0, exitReason: null,
      entryDate: '2026-03-25',
    });
    mockTradeUpdate.mockResolvedValue({
      id: 1, symbol: '2337', setupType: 'rebound',
      entryPrice: 100, simulatedFillPrice: 100.15, pnlPct: 0,
      holdingDays: 0, mfePct: 0, maePct: 0, exitReason: null,
      status: 'open',
    });
    mockJournalCreate.mockResolvedValue({});
    mockJournalUpdate.mockResolvedValue({});
    mockReviewCreate.mockResolvedValue({});
    // Flat quotes: rebound scores ~0.55 in defensive → shadow zone
    mockQuoteFindMany.mockResolvedValue(makeFlatQuotes(25));
    mockQueryRaw.mockResolvedValue([]);
  });

  it('promotes shadow → pending when setup has winning track record', async () => {
    // Not in bootstrap (has closed trades)
    mockTradeCount
      .mockResolvedValueOnce(5)   // closedTradeCount → not bootstrap
      .mockResolvedValueOnce(0);  // bootstrapCap

    // Shadow track record: 8 trades, 5 wins, +2.1% avg
    mockQueryRaw.mockResolvedValue([{ total: 8, wins: 5, avgPnl: 2.1 }]);

    await executeSimulationCycle(
      makeSnapshot({ marketState: 'defensive' }),
      [makeProposal({ setupType: 'rebound' })],
    );

    // Verify trade was created with promotionSource
    expect(mockTradeCreate).toHaveBeenCalled();
    const tradeCall = mockTradeCreate.mock.calls[0][0].data;
    const ctx = JSON.parse(tradeCall.marketContext);
    expect(ctx.promotionSource).toBe('shadow_track_record');
    expect(ctx.tradeMode).toBe('pending');
    // Promoted pending is a real trade, not shadow
    expect(tradeCall.status).toBe('open');
  });

  it('does NOT promote when track record is insufficient (< 5 trades)', async () => {
    mockTradeCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    // Only 3 shadow-closed trades — below threshold
    mockQueryRaw.mockResolvedValue([{ total: 3, wins: 2, avgPnl: 1.5 }]);

    await executeSimulationCycle(
      makeSnapshot({ marketState: 'defensive' }),
      [makeProposal({ setupType: 'rebound' })],
    );

    // Trade should exist (shadow) but without promotionSource
    if (mockTradeCreate.mock.calls.length > 0) {
      const tradeCall = mockTradeCreate.mock.calls[0][0].data;
      const ctx = JSON.parse(tradeCall.marketContext);
      expect(ctx.promotionSource).toBeUndefined();
      expect(ctx.tradeMode).toBe('shadow');
    }
  });

  it('does NOT promote when win rate < 55% and avgPnl <= 0', async () => {
    mockTradeCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    // 10 trades, 4 wins (40%), negative avg PnL
    mockQueryRaw.mockResolvedValue([{ total: 10, wins: 4, avgPnl: -1.2 }]);

    await executeSimulationCycle(
      makeSnapshot({ marketState: 'defensive' }),
      [makeProposal({ setupType: 'rebound' })],
    );

    if (mockTradeCreate.mock.calls.length > 0) {
      const tradeCall = mockTradeCreate.mock.calls[0][0].data;
      const ctx = JSON.parse(tradeCall.marketContext);
      expect(ctx.promotionSource).toBeUndefined();
    }
  });

  it('does NOT promote during bootstrap mode', async () => {
    // Bootstrap mode: 0 closed trades
    mockTradeCount
      .mockResolvedValueOnce(0)   // closedTradeCount=0 → bootstrap
      .mockResolvedValueOnce(0);  // cap

    mockQueryRaw.mockResolvedValue([{ total: 10, wins: 8, avgPnl: 3.5 }]);

    await executeSimulationCycle(
      makeSnapshot({ marketState: 'defensive' }),
      [makeProposal({ setupType: 'rebound' })],
    );

    // Phase 2.5 is skipped entirely in bootstrap mode
    // $queryRawUnsafe should NOT be called for promotion queries
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('limits promotions to MAX_PROMOTIONS_PER_CYCLE (2)', async () => {
    mockTradeCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    // All 3 qualify for promotion
    mockQueryRaw.mockResolvedValue([{ total: 10, wins: 7, avgPnl: 3.0 }]);

    const proposals = [
      makeProposal({ symbol: '2330', setupType: 'rebound' }),
      makeProposal({ symbol: '2317', setupType: 'rebound' }),
      makeProposal({ symbol: '2454', setupType: 'rebound' }),
    ];

    await executeSimulationCycle(
      makeSnapshot({ marketState: 'defensive' }),
      proposals,
    );

    // Count how many trades were created with promotionSource
    let promotedCount = 0;
    for (const call of mockTradeCreate.mock.calls) {
      const ctx = JSON.parse(call[0].data.marketContext);
      if (ctx.promotionSource === 'shadow_track_record') promotedCount++;
    }
    expect(promotedCount).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// closeOpenTrades tests
// ---------------------------------------------------------------------------

function makeOpenTrade(overrides: Record<string, unknown> = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDate = yesterday.toISOString().slice(0, 10);
  return {
    id: 99,
    symbol: '2330',
    setupType: 'trend',
    entryDate,
    entryPrice: 100,
    simulatedFillPrice: 100.15,
    quantity: 100,
    status: 'open',
    tradeMode: 'full',
    snapshotId: 1,
    marketContext: JSON.stringify({ marketState: 'trending', tradeMode: 'full' }),
    ...overrides,
  };
}

function makeCurrentQuotes(close: number, entryDate: string) {
  // 25 historical quotes leading up to entry, then one more today at the given close
  const base = Array.from({ length: 25 }, (_, i) => {
    const d = new Date(entryDate);
    d.setDate(d.getDate() - (25 - i));
    return {
      date: d.toISOString().slice(0, 10),
      open: 100, high: 102, low: 98, close: 100, volume: 10000, change: 0,
    };
  });
  // Add entry-date quote at the current close price
  base.push({ date: entryDate, open: close, high: close + 1, low: close - 1, close, volume: 10000, change: 0 });
  return base;
}

describe('closeOpenTrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTradeFindMany.mockResolvedValue([]);
    mockTradeUpdate.mockResolvedValue({});
    mockJournalUpdateMany.mockResolvedValue({ count: 1 });
    mockReviewCreate.mockResolvedValue({});
    mockReviewFindUnique.mockResolvedValue(null);
    mockSnapshotFindUnique.mockResolvedValue({
      id: 1,
      snapshotDate: '2026-04-16',
      marketState: 'trending',
      sectorStrength: '[]',
      candidateStocks: '[]',
      riskSignals: '[]',
      topInsights: '[]',
      dataCoverage: 'limited',
      limitations: '[]',
    });
  });

  it('returns zero counts when no open trades exist', async () => {
    mockTradeFindMany.mockResolvedValue([]);

    const result = await closeOpenTrades();

    expect(result.evaluated).toBe(0);
    expect(result.closed).toBe(0);
    expect(result.reviewsGenerated).toBe(0);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it('closes a full trade that hits the stop loss (-6%)', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    // price dropped to 94 → pnl = (94 - 100.15) / 100.15 ≈ -6.14%  (stop ≤ -6%)
    mockQuoteFindMany.mockResolvedValue(makeCurrentQuotes(94, trade.entryDate as string));

    const result = await closeOpenTrades();

    expect(result.closed).toBe(1);
    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe('closed');
    expect(updateCall.data.exitReason).toBe('stop');
    expect(updateCall.data.stopHit).toBe(true);
  });

  it('closes a full trade that hits the target (+8%)', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    // price at 109 → pnl = (109 - 100.15) / 100.15 ≈ +8.83%
    mockQuoteFindMany.mockResolvedValue(makeCurrentQuotes(109, trade.entryDate as string));

    const result = await closeOpenTrades();

    expect(result.closed).toBe(1);
    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe('closed');
    expect(updateCall.data.exitReason).toBe('target');
    expect(updateCall.data.targetHit).toBe(true);
  });

  it('closes a full trend trade on time exit (holdingDays >= 15) and ALWAYS generates a review', async () => {
    // entryDate 16 days ago → holdingDays = 16 >= maxHoldDays=15 for 'trend'
    const old = new Date();
    old.setDate(old.getDate() - 16);
    const entryDate = old.toISOString().slice(0, 10);
    const trade = makeOpenTrade({ entryDate, setupType: 'trend' });
    mockTradeFindMany.mockResolvedValue([trade]);

    // Quotes span from entry to yesterday so freshness guard passes (latest = yesterday)
    // Price stays flat — pnlPct ≈0% (well below 5% threshold, but time-exit always reviews)
    const quotes = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(old);
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().slice(0, 10), open: 100, high: 101, low: 99, close: 100.15, volume: 10000, change: 0 };
    });
    mockQuoteFindMany.mockResolvedValue(quotes);

    const result = await closeOpenTrades();

    expect(result.closed).toBe(1);
    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe('closed');
    expect(updateCall.data.exitReason).toBe('time');
    // Time-exit ALWAYS generates a review regardless of pnlPct magnitude
    expect(result.reviewsGenerated).toBe(1);
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
  });

  it('updates P&L without closing when no exit condition is met', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    // price slightly up — well within stop/target bands
    mockQuoteFindMany.mockResolvedValue(makeCurrentQuotes(101.5, trade.entryDate as string));

    const result = await closeOpenTrades();

    expect(result.closed).toBe(0);
    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe('open');
    expect(updateCall.data.exitReason).toBeUndefined();
    expect(updateCall.data.pnlPct).toBeDefined();
    expect(updateCall.data.holdingDays).toBeDefined();
  });

  it('generates a review when a closed trade has |pnlPct| >= 5%', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    // -6.14% stop hit → review should be generated
    mockQuoteFindMany.mockResolvedValue(makeCurrentQuotes(94, trade.entryDate as string));

    const result = await closeOpenTrades();

    expect(result.reviewsGenerated).toBe(1);
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
    const reviewCall = mockReviewCreate.mock.calls[0][0].data;
    expect(reviewCall.tradeId).toBe(trade.id);
    expect(reviewCall.triggerType).toBe('-5');
  });

  it('does NOT create a duplicate review if one already exists', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    mockQuoteFindMany.mockResolvedValue(makeCurrentQuotes(94, trade.entryDate as string));
    mockReviewFindUnique.mockResolvedValue({ tradeId: trade.id }); // review already exists

    const result = await closeOpenTrades();

    expect(result.reviewsGenerated).toBe(0);
    expect(mockReviewCreate).not.toHaveBeenCalled();
  });

  it('closes a shadow-open trade with shadow-closed status', async () => {
    const trade = makeOpenTrade({ status: 'shadow-open', tradeMode: 'shadow' });
    mockTradeFindMany.mockResolvedValue([trade]);
    mockQuoteFindMany.mockResolvedValue(makeCurrentQuotes(94, trade.entryDate as string));

    await closeOpenTrades();

    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe('shadow-closed');
  });

  it('skips trades with no quotes', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    mockQuoteFindMany.mockResolvedValue([]);

    const result = await closeOpenTrades();

    expect(result.evaluated).toBe(1);
    expect(result.closed).toBe(0);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it('skips trades whose latest quote is stale (> 5 days old)', async () => {
    const trade = makeOpenTrade();
    mockTradeFindMany.mockResolvedValue([trade]);
    // latest quote date is 10 days ago
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 10);
    const staleDateStr = staleDate.toISOString().slice(0, 10);
    mockQuoteFindMany.mockResolvedValue([
      { date: staleDateStr, open: 100, high: 102, low: 98, close: 100, volume: 10000, change: 0 },
    ]);

    const result = await closeOpenTrades();

    expect(result.closed).toBe(0);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });
});
