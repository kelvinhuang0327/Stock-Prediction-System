import { prisma } from '../prisma';
import { buildAutonomousDataSnapshot } from './AutonomousDataLayer';
import { buildAutonomousResearchSnapshot } from './AutonomousResearchEngine';
import { buildStrategyProposals } from './DecisionLayerEngine';
import { executeSimulationCycle, closeOpenTrades, promoteShadowTrades } from './SimulationExecutionEngine';
import { buildStrategyLearningInsight, persistStrategyLearningInsight } from './StrategyLearningEngine';
import { runResearchCycle } from '../research/ExperimentRunner';
import type { ResearchCycleResult } from '../research/ExperimentRunner';
import type { AutonomousDailyRunResult, AutonomousResearchSnapshot } from './types';

function mergeCoverage(
  research: AutonomousResearchSnapshot['dataCoverage'],
  dataCoverage: 'full' | 'limited' | 'insufficient',
): AutonomousResearchSnapshot['dataCoverage'] {
  if (research === 'insufficient' || dataCoverage === 'insufficient') return 'insufficient';
  if (research === 'limited' || dataCoverage === 'limited') return 'limited';
  return 'full';
}

export async function runAutonomousCycle(options?: {
  /** Override wall-clock time. Used by the daily job runner (passes scheduledFor)
   *  and by the fast-forward simulation script. */
  simulationDate?: Date;
  /** Pass-through for closeOpenTrades — disable freshness guard in simulation. */
  bypassFreshnessGuard?: boolean;
}): Promise<AutonomousDailyRunResult> {
  // Step 0a: Promote eligible shadow trades to pending (Fix 2).
  // Must run before closeOpenTrades so promoted trades close with correct 0.7× weight.
  const promotionResult = await promoteShadowTrades();
  if (promotionResult.promoted > 0) {
    console.log(`[AutonomousOrchestrator] Promoted ${promotionResult.promoted} shadow→pending:`, promotionResult.details);
  }

  // Step 0b: Close any open trades that have hit their stop/target/time exit.
  // Must run before research/decision so risk engine sees correct open exposure.
  const closeResult = await closeOpenTrades({
    simulationDate: options?.simulationDate,
    bypassFreshnessGuard: options?.bypassFreshnessGuard,
  });
  if (closeResult.evaluated > 0) {
    console.log(
      `[AutonomousOrchestrator] TradeCloser: evaluated=${closeResult.evaluated} closed=${closeResult.closed} reviews=${closeResult.reviewsGenerated}`,
    );
  }

  const dataSnapshot = await buildAutonomousDataSnapshot();
  // Pass simulationDate as asOf so research engine caps data queries to simulation date,
  // preventing future real-world data from polluting the simulation's stock universe.
  const simAsOf = options?.simulationDate
    ? options.simulationDate.toISOString().slice(0, 10)
    : undefined;
  const researchSnapshot = await buildAutonomousResearchSnapshot({ asOf: simAsOf });
  researchSnapshot.dataCoverage = mergeCoverage(researchSnapshot.dataCoverage, dataSnapshot.overallCoverage);
  researchSnapshot.limitations = [...new Set([...researchSnapshot.limitations, ...dataSnapshot.limitations])];

  const snapshotRow = await prisma.autonomousResearchSnapshot.upsert({
    where: { snapshotDate: researchSnapshot.snapshotDate },
    update: {
      marketState: researchSnapshot.marketState,
      sectorStrength: JSON.stringify(researchSnapshot.sectorStrength),
      candidateStocks: JSON.stringify(researchSnapshot.candidateStocks),
      riskSignals: JSON.stringify(researchSnapshot.riskSignals),
      topInsights: JSON.stringify(researchSnapshot.topInsights),
      dataCoverage: researchSnapshot.dataCoverage,
      limitations: JSON.stringify(researchSnapshot.limitations),
    },
    create: {
      snapshotDate: researchSnapshot.snapshotDate,
      marketState: researchSnapshot.marketState,
      sectorStrength: JSON.stringify(researchSnapshot.sectorStrength),
      candidateStocks: JSON.stringify(researchSnapshot.candidateStocks),
      riskSignals: JSON.stringify(researchSnapshot.riskSignals),
      topInsights: JSON.stringify(researchSnapshot.topInsights),
      dataCoverage: researchSnapshot.dataCoverage,
      limitations: JSON.stringify(researchSnapshot.limitations),
    },
  });
  researchSnapshot.snapshotId = snapshotRow.id;

  const proposals = await buildStrategyProposals(researchSnapshot);
  const execution = await executeSimulationCycle(researchSnapshot, proposals);
  const learning = await buildStrategyLearningInsight();
  const learningInsight = learning ? await persistStrategyLearningInsight(learning) : null;

  // Run the research experiment cycle (signal validation, walk-forward, regime analysis)
  let researchCycleResult: ResearchCycleResult | null = null;
  try {
    researchCycleResult = await runResearchCycle();
  } catch (err) {
    // Research cycle failure should not block the autonomous trading cycle
    console.error('[AutonomousOrchestrator] Research cycle error (non-blocking):', err);
  }

  return {
    dataSnapshot,
    snapshot: researchSnapshot,
    proposals,
    orders: execution.orders,
    journalEntries: execution.journalEntries,
    reviewReports: execution.reviewReports,
    learningInsight,
    researchCycleResult,
  };
}
