import { runAutonomousReviewCycle } from '../src/lib/jobs/autonomousJobRunners';
import { parseAutonomousCliOptions, printJsonResult } from './autonomous-cli-common';

async function main() {
  const options = parseAutonomousCliOptions();
  const result = await runAutonomousReviewCycle({
    triggerSource: 'cli',
    force: options.force,
    scheduledFor: options.scheduledFor,
  });
  printJsonResult('autonomous:review', result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
