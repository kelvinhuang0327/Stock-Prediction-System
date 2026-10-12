import { runWorkerTick } from '../src/lib/agent-orchestrator/workerTick';

function parseCallerContext(): 'background' | 'manual' {
  const raw = process.argv.find((arg) => arg.startsWith('--caller-context='));
  const value = raw?.split('=')[1];
  return value === 'manual' ? 'manual' : 'background';
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const callerContext = parseCallerContext();
  const result = await runWorkerTick({ force, callerContext });
  console.log(JSON.stringify({ ok: true, tick: 'worker', force, result }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, tick: 'worker', error: message }, null, 2));
  process.exitCode = 1;
});
