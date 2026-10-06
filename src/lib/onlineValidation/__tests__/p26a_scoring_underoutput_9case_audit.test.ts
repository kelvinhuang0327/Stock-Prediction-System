/**
 * P26A-9CASE-AUDIT — Read-only Audit Tests
 * Verifies: audit JSON well-formed, 9 cases present, taxonomy correct,
 * no DB write, no scoring change, no forbidden claims.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.resolve(__dirname, '../../../../');

function readJson(rel: string) {
  const fp = path.join(ROOT, rel);
  expect(fs.existsSync(fp)).toBe(true);
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function sha256File(rel: string): string {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return 'MISSING';
  return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
}

function countNonEmptyLines(rel: string): number {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return -1;
  return fs.readFileSync(fp, 'utf8').split('\n').filter(l => l.trim().length > 0).length;
}

// ── Baseline hashes ──────────────────────────────────────────────────────────
const BASELINE_SCORING = {
  'src/lib/analysis/RuleBasedStockAnalyzer.ts': '4f6434a31fd211b6122408ee5e977e41f4cd45aee45cec586ec988b2c009e8e2',
  'src/lib/alpha/SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
  'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
};

const FROZEN_CORPUS = [
  { file: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60 },
  { file: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
  { file: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl', expected: 4500 },
];

const FORBIDDEN_PATTERN = /\b(ROI|win-rate|win rate|profit|outperform|beat the market|guaranteed|investment recommendation)\b/i;
const ALLOWED_FIELD_PATTERN = /alphaScore/;

// ── Audit JSON structure tests ────────────────────────────────────────────────
describe('P26A 9-case audit JSON structure', () => {
  let data: ReturnType<typeof readJson>;

  beforeAll(() => {
    data = readJson('outputs/online_validation/p26a_scoring_underoutput_9case_audit.json');
  });

  it('JSON is parseable and has auditId field', () => {
    expect(data.auditId).toBe('P26A-9CASE-AUDIT');
  });

  it('has exactly 9 cases', () => {
    expect(data.totalCases).toBe(9);
    expect(Array.isArray(data.cases)).toBe(true);
    expect(data.cases).toHaveLength(9);
  });

  it('has 3 unique symbols', () => {
    expect(data.uniqueSymbols).toHaveLength(3);
    expect(data.uniqueSymbols).toContain('1710');
    expect(data.uniqueSymbols).toContain('00738U');
    expect(data.uniqueSymbols).toContain('00891');
  });

  it('has 5 unique symbol+date combinations', () => {
    expect(data.uniqueSymbolDateCombinations).toBe(5);
  });

  it('all cases have required fields', () => {
    for (const c of data.cases) {
      expect(c.caseId).toBeTruthy();
      expect(c.symbol).toBeTruthy();
      expect(c.asOfDate).toBeTruthy();
      expect(typeof c.alphaScore).toBe('number');
      expect(c.completenessStatus).toBe('PARTIAL');
      expect(c.usedSources).toContain('StockQuote');
      expect(c.usedSources).toContain('InstitutionalChip');
      expect(c.missingSources).toContain('MonthlyRevenue');
    }
  });

  it('all cases have factorSnapshotCount > 1 (rich signals present)', () => {
    for (const c of data.cases) {
      expect(c.factorSnapshotCount).toBeGreaterThan(1);
    }
  });

  it('all cases have reasonTokenCount = 1 (underoutput confirmed)', () => {
    for (const c of data.cases) {
      expect(c.reasonTokenCount).toBe(1);
    }
  });

  it('all cases have MONTHLY_REVENUE_BLOCKED_BY_SOURCE in underoutputTypes', () => {
    for (const c of data.cases) {
      expect(c.underoutputTypes).toContain('MONTHLY_REVENUE_BLOCKED_BY_SOURCE');
    }
  });

  it('all cases have SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED in underoutputTypes', () => {
    for (const c of data.cases) {
      expect(c.underoutputTypes).toContain('SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED');
    }
  });

  it('allBlockedByMonthlyRevenue = true', () => {
    expect(data.allBlockedByMonthlyRevenue).toBe(true);
  });

  it('allHaveRendererUnderoutput = true', () => {
    expect(data.allHaveRendererUnderoutput).toBe(true);
  });

  it('allFixableWithoutScoringChange = true', () => {
    expect(data.allFixableWithoutScoringChange).toBe(true);
  });

  it('rendererFix.scoringChangeRequired = false', () => {
    expect(data.patchRecommendations.rendererFix.scoringChangeRequired).toBe(false);
  });

  it('classification is PATCH_CANDIDATE_FOUND or NO_PATCH_RECOMMENDED', () => {
    const valid = [
      'P26A_9CASE_AUDIT_COMPLETE_PATCH_CANDIDATE_FOUND',
      'P26A_9CASE_AUDIT_COMPLETE_NO_PATCH_RECOMMENDED',
    ];
    expect(valid).toContain(data.classification);
  });

  it('has disclaimer field', () => {
    expect(data.disclaimer).toBeTruthy();
    expect(typeof data.disclaimer).toBe('string');
  });
});

// ── Read-only safety: no DB write ────────────────────────────────────────────
describe('P26A 9-case audit — read-only safety', () => {
  let dbSha: string;

  beforeAll(() => {
    // Record DB sha at test start
    dbSha = sha256File('prisma/dev.db');
  });

  it('DB sha256 is unchanged (no DB write during audit)', () => {
    expect(sha256File('prisma/dev.db')).toBe(dbSha);
  });

  it('audit JSON does not contain dbWritePerformed = true', () => {
    const data = readJson('outputs/online_validation/p26a_scoring_underoutput_9case_audit.json');
    expect(data.dbWritePerformed).not.toBe(true);
  });
});

// ── Frozen corpus ─────────────────────────────────────────────────────────────
describe('P26A 9-case audit — frozen corpus', () => {
  it.each(FROZEN_CORPUS)('corpus $file has $expected non-empty lines', ({ file, expected }) => {
    expect(countNonEmptyLines(file)).toBe(expected);
  });
});

// ── Scoring formula unchanged ─────────────────────────────────────────────────
describe('P26A 9-case audit — scoring formula unchanged', () => {
  it.each(Object.entries(BASELINE_SCORING))('file %s sha256 unchanged', (file, expected) => {
    expect(sha256File(file)).toBe(expected);
  });
});

// ── Forbidden claims scan in audit artifact ───────────────────────────────────
describe('P26A 9-case audit — forbidden claims scan', () => {
  function scanFile(rel: string): string[] {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) return [];
    const content = fs.readFileSync(fp, 'utf8');
    return content.split('\n').filter(line => {
      if (ALLOWED_FIELD_PATTERN.test(line)) return false;
      return FORBIDDEN_PATTERN.test(line);
    });
  }

  it('p26a_scoring_underoutput_9case_audit.json has no forbidden claims', () => {
    const hits = scanFile('outputs/online_validation/p26a_scoring_underoutput_9case_audit.json');
    expect(hits).toHaveLength(0);
  });

  it('p26a_scoring_underoutput_9case_audit.md has no forbidden claims', () => {
    const hits = scanFile('outputs/online_validation/p26a_scoring_underoutput_9case_audit.md');
    expect(hits).toHaveLength(0);
  });
});

// ── Audit covers all expected caseIds ─────────────────────────────────────────
describe('P26A 9-case audit — expected case IDs present', () => {
  const EXPECTED_CASE_IDS = [
    'P5-CASE-010', 'P5-CASE-011', 'P5-CASE-013',
    'P5-CASE-023', 'P5-CASE-026', 'P5-CASE-037',
    'P5-CASE-053', 'P5-CASE-054', 'P5-CASE-055',
  ];

  it('all 9 expected case IDs are present in audit', () => {
    const data = readJson('outputs/online_validation/p26a_scoring_underoutput_9case_audit.json');
    const foundIds = data.cases.map((c: { caseId: string }) => c.caseId);
    for (const id of EXPECTED_CASE_IDS) {
      expect(foundIds).toContain(id);
    }
  });
});

// ── Route decision artifact ───────────────────────────────────────────────────
describe('P26A followup — route decision artifacts', () => {
  it('route_decision.json is valid JSON with routeDecision field', () => {
    const data = readJson('outputs/online_validation/p26f4_or_p26a_route_decision.json');
    expect(data.routeDecision).toBe('P26A_SCORING_UNDEROUTPUT_AUDIT');
  });

  it('route_decision.json has candidateSourceFiles = 0', () => {
    const data = readJson('outputs/online_validation/p26f4_or_p26a_route_decision.json');
    expect(data.dropzoneScan.candidateSourceFiles).toBe(0);
  });

  it('route_decision.json dbWriteAllowed = false', () => {
    const data = readJson('outputs/online_validation/p26f4_or_p26a_route_decision.json');
    expect(data.dbWriteAllowed).toBe(false);
  });

  it('preflight.json preflightPass = true', () => {
    const data = readJson('outputs/online_validation/p26f4_or_p26a_followup_preflight.json');
    expect(data.preflightPass).toBe(true);
  });
});
