import fs from 'node:fs/promises';
import { findForbiddenViolations, evaluateGate } from '../gate';

jest.mock('../common', () => ({ fileExists: jest.fn() }));
jest.mock('node:fs/promises', () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(),
  },
}));

const { fileExists } = jest.requireMock('../common') as { fileExists: jest.Mock };
const mockFsReadFile = fs.readFile as jest.Mock;

describe('gate utilities', () => {
  beforeEach(() => {
    fileExists.mockReset();
    mockFsReadFile.mockReset();
  });

  it('findForbiddenViolations detects prefix and exact matches', () => {
    const changed = ['src/secret/keys.txt', 'docs/README.md', 'src/lib/safe.js'];
    const forbidden = ['src/secret', 'bin/'];
    const violations = findForbiddenViolations(changed, forbidden);
    expect(violations).toContain('src/secret/keys.txt');
    expect(violations).not.toContain('docs/README.md');
  });

  it('evaluateGate returns PASS when outputs present and no violations', async () => {
    fileExists.mockResolvedValue(true);
    const input = {
      taskId: 42,
      durationSeconds: 10,
      contract: { forbidden_changes: ['forbidden/path'] },
      completedPath: '/tmp/completed.md',
      resultPath: '/tmp/result.json',
      changedFiles: ['safe/file.txt'],
      acceptanceResults: [{ name: 'a', passed: true }],
    } as any;

    const res = await evaluateGate(input);
    expect(res).toHaveProperty('status');
    expect(res.gate_verdict).toBe('PASS');
  });

  it('evaluateGate flags INVALID_DELIVERY when outputs missing', async () => {
    fileExists.mockResolvedValue(false);

    const input = {
      taskId: 43,
      durationSeconds: 5,
      contract: { forbidden_changes: [] },
      completedPath: '/tmp/missing.md',
      resultPath: '/tmp/missing.json',
      changedFiles: [],
      acceptanceResults: [{ name: 'a', passed: true }],
    } as any;

    const res = await evaluateGate(input);
    expect(res.gate_verdict).toBe('INVALID_DELIVERY');
    expect(res.missing_required_outputs.length).toBeGreaterThan(0);
  });

  it('marks price-analysis tasks non-ingestable when the native report is missing', async () => {
    fileExists.mockImplementation(async (target: string) => !target.includes('docs/reports/price_data_quality.json'));

    const res = await evaluateGate({
      taskId: 44,
      durationSeconds: 3,
      contract: {
        forbidden_changes: [],
        ingest_contract: {
          kind: 'price_analysis_native_report',
          dedupeKey: 'price_analysis_quality__data_audit',
          reportPath: 'docs/reports/price_data_quality.json',
          insightTypeCandidate: 'data_quality_issue',
          requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
          requiredScopeField: 'affectedSymbols',
          noThresholdChanges: true,
        },
      } as any,
      completedPath: '/tmp/completed.md',
      resultPath: '/tmp/result.json',
      changedFiles: ['docs/reports/notes.md'],
      acceptanceResults: [{ name: 'worker finished', passed: true, evidence: 'ok' }],
    });

    expect(res.gate_verdict).toBe('INVALID_DELIVERY');
    expect(res.ingestability).toEqual(expect.objectContaining({
      required: true,
      status: 'NON_INGESTABLE',
      reportPath: 'docs/reports/price_data_quality.json',
    }));
    expect(res.missing_required_outputs).toContain('native_report:docs/reports/price_data_quality.json');
  });

  it('accepts a valid native price-analysis report as ingestable', async () => {
    fileExists.mockResolvedValue(true);
    mockFsReadFile.mockResolvedValue(JSON.stringify({
      generatedAt: '2026-04-30T14:07:15.623Z',
      insightType: 'data_quality_issue',
      confidence: 1,
      evidence: ['Stale quote age: 152h (threshold 48h)'],
      severity: 'high',
      affectedSymbols: ['2330'],
    }));

    const res = await evaluateGate({
      taskId: 45,
      durationSeconds: 4,
      contract: {
        forbidden_changes: [],
        ingest_contract: {
          kind: 'price_analysis_native_report',
          dedupeKey: 'price_analysis_quality__data_audit',
          reportPath: 'docs/reports/price_data_quality.json',
          insightTypeCandidate: 'data_quality_issue',
          requiredTopLevelFields: ['generatedAt', 'insightType', 'confidence', 'evidence', 'severity', 'affectedSymbols'],
          requiredScopeField: 'affectedSymbols',
          noThresholdChanges: true,
        },
      } as any,
      completedPath: '/tmp/completed.md',
      resultPath: '/tmp/result.json',
      changedFiles: ['docs/reports/price_data_quality.json'],
      acceptanceResults: [{ name: 'worker finished', passed: true, evidence: 'ok' }],
    });

    expect(res.gate_verdict).toBe('PASS');
    expect(res.ingestability).toEqual(expect.objectContaining({
      required: true,
      status: 'INGESTABLE',
    }));
  });

  it('does not require ingestability for non-price-analysis tasks', async () => {
    fileExists.mockResolvedValue(true);

    const res = await evaluateGate({
      taskId: 46,
      durationSeconds: 2,
      contract: { forbidden_changes: [] } as any,
      completedPath: '/tmp/completed.md',
      resultPath: '/tmp/result.json',
      changedFiles: ['docs/reports/system_health.json'],
      acceptanceResults: [{ name: 'worker finished', passed: true, evidence: 'ok' }],
    });

    expect(res.gate_verdict).toBe('PASS');
    expect(res.ingestability).toEqual(expect.objectContaining({
      required: false,
      status: 'NOT_APPLICABLE',
    }));
  });
});
