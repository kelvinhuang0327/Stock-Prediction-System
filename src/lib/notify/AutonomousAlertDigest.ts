import type { JobHealthSummary } from '@/lib/jobs/types';

export interface AutonomousNotifyAlert {
  jobName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detectedAt: string;
  digestKey: string;
}

export interface AutonomousNotifyDigest {
  reportDate: string;
  generatedAt: string;
  summary: string;
  markdown: string;
  structured: {
    reportDate: string;
    summary: string;
    total: number;
    critical: number;
    warning: number;
    info: number;
    suppressed: number;
    alerts: AutonomousNotifyAlert[];
    healthSummary: JobHealthSummary;
    limitations: string[];
  };
  alerts: AutonomousNotifyAlert[];
  summaryStats: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    suppressed: number;
  };
  healthSummary: JobHealthSummary;
  limitations: string[];
  shouldAttach: boolean;
}
