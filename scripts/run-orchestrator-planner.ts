import { runPlannerTick } from '../src/lib/agent-orchestrator/plannerTick';

function parseCallerContext(): 'background' | 'manual' {
  const raw = process.argv.find((arg) => arg.startsWith('--caller-context='));
  const value = raw?.split('=')[1];
  return value === 'manual' ? 'manual' : 'background';
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const callerContext = parseCallerContext();
  const result = await runPlannerTick({ force, callerContext });
  console.log(JSON.stringify({ ok: true, tick: 'planner', force, result }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, tick: 'planner', error: message }, null, 2));
  process.exitCode = 1;
});
