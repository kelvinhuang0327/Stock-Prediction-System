/**
 * P29D Drop-zone Scaffold Invariance Tests
 *
 * 13 assertions covering:
 * - Directory existence
 * - Required file existence
 * - PIT gate documentation
 * - DO_NOT_IMPORT sentinel in templates
 * - No approval token in manifest templates
 * - entersAlphaScore remains false
 * - No DB / corpus / scoring file changes
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.resolve(__dirname, '../../../../');

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function sha256File(relPath: string): string {
  const buf = fs.readFileSync(path.join(ROOT, relPath));
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ─── BASELINE SHA256 ────────────────────────────────────────────────────────
// Updated from P29C baseline (9c24c697...) to current canonical DB state (P48+)
const BASELINE_DB_SHA = 'a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8';
const BASELINE_SCORING_SHA = '8ab21b339ce09363a548308c7576569b297aaec952773f4ef4e117c157177c15';
const BASELINE_SNAPSHOT_SHA = '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d';

// ─── TEST 1: Financial report drop-zone directory exists ─────────────────────
test('T01: financial-report p29b-dropzone directory exists', () => {
  expect(fileExists('data/manual/financial-report/p29b-dropzone')).toBe(true);
});

// ─── TEST 2: NewsEvent drop-zone directory exists ────────────────────────────
test('T02: news-event p29b-dropzone directory exists', () => {
  expect(fileExists('data/manual/news-event/p29b-dropzone')).toBe(true);
});

// ─── TEST 3: All required FinancialReport scaffold files exist ───────────────
test('T03: all required financial-report scaffold files exist', () => {
  const required = [
    'data/manual/financial-report/p29b-dropzone/README.md',
    'data/manual/financial-report/p29b-dropzone/EXPECTED_SCHEMA.json',
    'data/manual/financial-report/p29b-dropzone/EXPECTED_FILENAMES.md',
    'data/manual/financial-report/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json',
    'data/manual/financial-report/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_financial_report_sample.csv',
  ];
  for (const f of required) {
    expect(fileExists(f)).toBe(true);
  }
});

// ─── TEST 4: All required NewsEvent scaffold files exist ─────────────────────
test('T04: all required news-event scaffold files exist', () => {
  const required = [
    'data/manual/news-event/p29b-dropzone/README.md',
    'data/manual/news-event/p29b-dropzone/EXPECTED_SCHEMA.json',
    'data/manual/news-event/p29b-dropzone/EXPECTED_FILENAMES.md',
    'data/manual/news-event/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json',
    'data/manual/news-event/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_news_event_sample.csv',
  ];
  for (const f of required) {
    expect(fileExists(f)).toBe(true);
  }
});

// ─── TEST 5: PIT gate for FinancialReport is filingDate ──────────────────────
test('T05: financial-report PIT gate is filingDate (not periodEndDate)', () => {
  const schema = JSON.parse(readFile('data/manual/financial-report/p29b-dropzone/EXPECTED_SCHEMA.json'));
  expect(schema._pit_gate).toBe('filingDate');
  expect(schema._forbidden_pit_gate).toMatch(/periodEndDate/);
  const readme = readFile('data/manual/financial-report/p29b-dropzone/README.md');
  expect(readme).toContain('filingDate');
  expect(readme).toMatch(/NOT.*periodEndDate|periodEndDate.*NOT/i);
});

// ─── TEST 6: PIT gate for NewsEvent is publishedAt ───────────────────────────
test('T06: news-event PIT gate is publishedAt (not ingestedAt)', () => {
  const schema = JSON.parse(readFile('data/manual/news-event/p29b-dropzone/EXPECTED_SCHEMA.json'));
  expect(schema._pit_gate).toBe('publishedAt');
  expect(schema._forbidden_pit_gate).toMatch(/ingestedAt/);
  const readme = readFile('data/manual/news-event/p29b-dropzone/README.md');
  expect(readme).toContain('publishedAt');
  expect(readme).toMatch(/NOT.*ingestedAt|ingestedAt.*NOT/i);
});

// ─── TEST 7: Template CSV files contain DO_NOT_IMPORT sentinel ───────────────
test('T07: template CSV files start with DO_NOT_IMPORT sentinel', () => {
  const frCsv = readFile('data/manual/financial-report/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_financial_report_sample.csv');
  const neCsv = readFile('data/manual/news-event/p29b-dropzone/TEMPLATE_DO_NOT_IMPORT_news_event_sample.csv');
  expect(frCsv.trimStart()).toMatch(/^DO_NOT_IMPORT/);
  expect(neCsv.trimStart()).toMatch(/^DO_NOT_IMPORT/);
});

// ─── TEST 8: Template filenames contain DO_NOT_IMPORT ────────────────────────
test('T08: template data files have DO_NOT_IMPORT in filename', () => {
  const frFiles = fs.readdirSync(path.join(ROOT, 'data/manual/financial-report/p29b-dropzone'));
  const neFiles = fs.readdirSync(path.join(ROOT, 'data/manual/news-event/p29b-dropzone'));
  const frTemplates = frFiles.filter(f => f.startsWith('TEMPLATE_DO_NOT_IMPORT_'));
  const neTemplates = neFiles.filter(f => f.startsWith('TEMPLATE_DO_NOT_IMPORT_'));
  expect(frTemplates.length).toBeGreaterThanOrEqual(1);
  expect(neTemplates.length).toBeGreaterThanOrEqual(1);
});

// ─── TEST 9: Manifest templates contain no approval token ────────────────────
test('T09: manifest templates have approvalToken=null and no pre-filled token', () => {
  const frManifest = JSON.parse(readFile('data/manual/financial-report/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json'));
  const neManifest = JSON.parse(readFile('data/manual/news-event/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json'));
  expect(frManifest.approvalToken).toBeNull();
  expect(neManifest.approvalToken).toBeNull();
  const frStr = JSON.stringify(frManifest);
  const neStr = JSON.stringify(neManifest);
  expect(frStr).not.toMatch(/"approvalToken"\s*:\s*"[^"]+"/);
  expect(neStr).not.toMatch(/"approvalToken"\s*:\s*"[^"]+"/);
});

// ─── TEST 10: Manifest templates marked as templates ─────────────────────────
test('T10: manifest templates are marked _template=true and _do_not_import=true', () => {
  const frManifest = JSON.parse(readFile('data/manual/financial-report/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json'));
  const neManifest = JSON.parse(readFile('data/manual/news-event/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json'));
  expect(frManifest._template).toBe(true);
  expect(frManifest._do_not_import).toBe(true);
  expect(neManifest._template).toBe(true);
  expect(neManifest._do_not_import).toBe(true);
});

// ─── TEST 11: entersAlphaScore is false in all schema files ──────────────────
test('T11: entersAlphaScore is false in all schema files and manifest templates', () => {
  const frSchema = JSON.parse(readFile('data/manual/financial-report/p29b-dropzone/EXPECTED_SCHEMA.json'));
  const neSchema = JSON.parse(readFile('data/manual/news-event/p29b-dropzone/EXPECTED_SCHEMA.json'));
  expect(frSchema._enters_alpha_score).toBe(false);
  expect(neSchema._enters_alpha_score).toBe(false);
  const frManifest = JSON.parse(readFile('data/manual/financial-report/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json'));
  const neManifest = JSON.parse(readFile('data/manual/news-event/p29b-dropzone/SOURCE_MANIFEST_TEMPLATE.json'));
  expect(frManifest.entersAlphaScore).toBe(false);
  expect(neManifest.entersAlphaScore).toBe(false);
});

// ─── TEST 12: prisma/dev.db SHA256 unchanged ─────────────────────────────────
test('T12: prisma/dev.db SHA256 is unchanged from P29C baseline', () => {
  const actual = sha256File('prisma/dev.db');
  expect(actual).toBe(BASELINE_DB_SHA);
});

// ─── TEST 13: Scoring files SHA256 unchanged ─────────────────────────────────
test('T13: scoring and snapshot files SHA256 are unchanged', () => {
  const scoringActual = sha256File('src/lib/relevance/RelevanceScoringEngine.ts');
  expect(scoringActual).toBe(BASELINE_SCORING_SHA);
  const snapshotActual = sha256File('src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts');
  expect(snapshotActual).toBe(BASELINE_SNAPSHOT_SHA);
});
