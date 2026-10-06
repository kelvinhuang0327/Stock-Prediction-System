/**
 * Run Autonomous Research Cycle — Phase H
 *
 * Executes the research experiment loop independently of the trading cycle.
 * Can be scheduled separately (e.g., 3x/week) via cron/launchd.
 *
 * Usage:
 *   npx ts-node scripts/run-autonomous-research.ts
 *   npx ts-node scripts/run-autonomous-research.ts --force
 */

import { runResearchCycle } from '../src/lib/research/ExperimentRunner';

async function main() {
  console.log('[Research Cycle] Starting...');
  const startTime = Date.now();

  try {
    const result = await runResearchCycle();

    console.log('\n════════════════════════════════════════');
    console.log(' Research Cycle Complete');
    console.log('════════════════════════════════════════');
    console.log(`Parameter Set: ${result.parameterSet.version} (id=${result.parameterSet.id})`);
    console.log(`Coverage Readiness: ${result.gapsReport.summary.overallReadiness}%`);
    console.log(`Duration: ${result.totalDurationMs}ms`);
    console.log('');

    for (const exp of result.experimentResults) {
      const icon = exp.skipped ? '⏭️' : exp.newStatus === 'VALIDATED' ? '✅' : exp.newStatus === 'REJECTED' ? '❌' : exp.newStatus === 'PARTIAL' ? '🔶' : exp.newStatus === 'BLOCKED' ? '🚫' : '🔄';
      console.log(`${icon} ${exp.experimentId}`);
      console.log(`   ${exp.previousStatus} → ${exp.newStatus} (evidence: ${exp.evidenceLevel})`);
      if (exp.skipped) console.log(`   Skip: ${exp.skipReason}`);
      if (exp.runId) console.log(`   Run ID: ${exp.runId}`);
      if (exp.findings.length > 0) {
        console.log(`   Findings (${exp.findings.length}):`);
        for (const f of exp.findings.slice(0, 3)) {
          console.log(`     - ${f}`);
        }
        if (exp.findings.length > 3) console.log(`     ... +${exp.findings.length - 3} more`);
      }
      console.log('');
    }

    const executed = result.experimentResults.filter((r) => !r.skipped);
    const skipped = result.experimentResults.filter((r) => r.skipped);
    console.log(`Summary: ${executed.length} executed, ${skipped.length} skipped`);

    // Output JSON for programmatic consumption
    console.log('\n[JSON_RESULT]');
    console.log(JSON.stringify({
      parameterSetVersion: result.parameterSet.version,
      overallReadiness: result.gapsReport.summary.overallReadiness,
      experiments: result.experimentResults.map((r) => ({
        id: r.experimentId,
        from: r.previousStatus,
        to: r.newStatus,
        evidence: r.evidenceLevel,
        skipped: r.skipped,
        runId: r.runId,
      })),
      durationMs: result.totalDurationMs,
    }, null, 2));
  } catch (error) {
    console.error('[Research Cycle] Fatal error:', error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
