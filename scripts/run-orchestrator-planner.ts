import { runPlannerTick } from '../src/lib/agent-orchestrator/plannerTick';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const result = await runPlannerTick({ force });
  console.log(JSON.stringify({ ok: true, tick: 'planner', force, result }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, tick: 'planner', error: message }, null, 2));
  process.exitCode = 1;
});
