import type { JobAlertRecord, JobHealthRow } from './types';

export type AlertFamily =
  | 'never_ran'
  | 'missed_run'
  | 'failed_run'
  | 'consecutive_failure'
  | 'delayed_run'
  | 'recovery_event'
  | 'unknown_family';

export interface AlertFamilyGroupingInput {
  alert: JobAlertRecord;
  healthRow?: JobHealthRow | null;
}

export interface AlertFamilyGroupingResult {
  family: AlertFamily;
  familyLabel: string;
  groupingConfidence: number;
  derivedReason: string;
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase();
}

function containsAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function familyLabelFor(family: AlertFamily): string {
  switch (family) {
    case 'never_ran':
      return 'Never ran';
    case 'missed_run':
      return 'Missed run';
    case 'failed_run':
      return 'Failed run';
    case 'consecutive_failure':
      return 'Consecutive failure';
    case 'delayed_run':
      return 'Delayed run';
    case 'recovery_event':
      return 'Recovery event';
    default:
      return 'Unknown family';
  }
}

export class AlertFamilyGroupingService {
  classify(input: AlertFamilyGroupingInput): AlertFamilyGroupingResult {
    const message = normalize(input.alert.message);
    const health = input.healthRow ?? null;
    const latestRunStatus = health?.latestRun?.status ?? null;
    const failureStreak = health?.failureStreak ?? 0;

    if (health?.healthStatus === 'never-ran' || containsAny(message, ['never run', 'never-ran'])) {
      return {
        family: 'never_ran',
        familyLabel: familyLabelFor('never_ran'),
        groupingConfidence: 1,
        derivedReason: health?.healthReason ?? 'No successful run has been recorded yet.',
      };
    }

    if (containsAny(message, ['consecutive failed runs']) || failureStreak >= 2) {
      return {
        family: 'consecutive_failure',
        familyLabel: familyLabelFor('consecutive_failure'),
        groupingConfidence: 1,
        derivedReason: `failureStreak=${failureStreak} or alert text indicates repeated failures.`,
      };
    }

    if (
      containsAny(message, ['failing or has repeated failures', 'latest run failed', 'run failed']) ||
      health?.healthStatus === 'failed'
    ) {
      return {
        family: 'failed_run',
        familyLabel: familyLabelFor('failed_run'),
        groupingConfidence: 0.95,
        derivedReason: health?.healthReason ?? 'Latest run failed or the job is currently failing.',
      };
    }

    if (
      input.alert.status === 'resolved' &&
      (containsAny(message, ['recovered', 'resolved']) || containsAny(health?.healthReason ?? '', ['resolved', 'recovered']))
    ) {
      return {
        family: 'recovery_event',
        familyLabel: familyLabelFor('recovery_event'),
        groupingConfidence: 0.8,
        derivedReason: 'Resolved cycle indicates a recovery event.',
      };
    }

    if (health?.healthStatus === 'delayed' && latestRunStatus === 'running' && !containsAny(message, ['missing a successful run', 'missing successful run'])) {
      return {
        family: 'delayed_run',
        familyLabel: familyLabelFor('delayed_run'),
        groupingConfidence: 0.9,
        derivedReason: 'Latest run is still running, so the job is delayed rather than failed.',
      };
    }

    if (health?.healthStatus === 'delayed' || containsAny(message, ['missing a successful run', 'missing successful run'])) {
      return {
        family: 'missed_run',
        familyLabel: familyLabelFor('missed_run'),
        groupingConfidence: 0.9,
        derivedReason: health?.healthReason ?? 'No successful run was found in the expected window.',
      };
    }

    return {
      family: 'unknown_family',
      familyLabel: familyLabelFor('unknown_family'),
      groupingConfidence: 0.25,
      derivedReason: health?.healthReason ?? 'No reliable family signal was available.',
    };
  }
}
