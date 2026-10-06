export interface CliAutonomousOptions {
  force: boolean;
  scheduledFor?: Date;
}

export function parseAutonomousCliOptions(argv = process.argv.slice(2)): CliAutonomousOptions {
  const force = argv.includes('--force');
  const scheduledForArg = argv.find((arg) => arg.startsWith('--scheduled-for=') || arg.startsWith('--scheduledFor='));
  const scheduledForValue = scheduledForArg ? scheduledForArg.split('=')[1] : undefined;
  const scheduledFor = scheduledForValue ? new Date(scheduledForValue) : undefined;
  return {
    force,
    scheduledFor: scheduledFor && !Number.isNaN(scheduledFor.getTime()) ? scheduledFor : undefined,
  };
}

export function printJsonResult(label: string, payload: unknown): void {
  // Keep CLI output machine-readable for cron and shell piping.
  console.log(JSON.stringify({ label, payload }, null, 2));
}
