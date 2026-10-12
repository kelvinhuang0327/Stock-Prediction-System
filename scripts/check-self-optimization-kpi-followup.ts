import { execSync } from 'node:child_process';
import {
  runSelfOptimizationKpiFollowup,
} from '@/lib/autonomous/selfOptimizationKpiFollowup';

async function main() {
  const summary = await runSelfOptimizationKpiFollowup({
    regenerateReport: () => {
      execSync('npm run report:self-optimization-kpi', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
    },
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[check-self-optimization-kpi-followup] failed:', error);
  process.exitCode = 1;
});
