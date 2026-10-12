import { runAutonomousDailyCycle } from '../src/lib/jobs/autonomousJobRunners';
import { parseAutonomousCliOptions, printJsonResult } from './autonomous-cli-common';

async function main() {
  const options = parseAutonomousCliOptions();
  const result = await runAutonomousDailyCycle({
    triggerSource: 'cli',
    force: options.force,
    scheduledFor: options.scheduledFor,
  });
  printJsonResult('autonomous:daily', result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
