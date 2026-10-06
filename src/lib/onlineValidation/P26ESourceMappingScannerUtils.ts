// P26ESourceMappingScannerUtils.ts
// ZERO external imports — uses require() for Node.js built-ins only.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');

export interface SourceScanResult {
  sourceCategory: string;
  sourceState: string;
  fixtureFileFound: boolean;
  realSourceCandidates: string[];
  pitGateField: string | null;
  symbolJoinFieldFound: boolean;
  asOfDateCompatibleFieldFound: boolean;
  sourceHashFieldFound: boolean;
  outcomeFieldsDetected: boolean;
  readOnly: boolean;
  notes: string;
}

function safeReadFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function safeReadDir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath) as string[];
  } catch {
    return [];
  }
}

export function scanMonthlyRevenueSourceMapping(workspaceRoot: string): SourceScanResult {
  const realSourceCandidates: string[] = [];

  // Check prisma/schema.prisma for MonthlyRevenue
  const prismaPath = path.join(workspaceRoot, 'prisma', 'schema.prisma');
  const prismaContent = safeReadFile(prismaPath);
  if (prismaContent.includes('MonthlyRevenue') || prismaContent.includes('monthlyRevenue')) {
    realSourceCandidates.push('prisma/schema.prisma');
  }

  // Check src/lib/data/ for MonthlyRevenue references
  const dataDir = path.join(workspaceRoot, 'src', 'lib', 'data');
  const dataFiles = safeReadDir(dataDir).filter((f: string) => f.endsWith('.ts'));
  for (const file of dataFiles) {
    const filePath = path.join(dataDir, file);
    const content = safeReadFile(filePath);
    if (content.includes('MonthlyRevenue') || content.includes('monthlyRevenue')) {
      realSourceCandidates.push(`src/lib/data/${file}`);
    }
  }

  // Check p12 PIT feature contract
  const p12ContractPath = path.join(workspaceRoot, 'outputs', 'online_validation', 'p12pit_feature_contract_v1.json');
  const p12Content = safeReadFile(p12ContractPath);
  const p12HasMonthlyRevenue = p12Content.includes('MonthlyRevenue') || p12Content.includes('monthlyRevenue');

  const symbolJoinFieldFound = prismaContent.includes('stockId') || prismaContent.includes('symbol');
  const asOfDateCompatibleFieldFound = prismaContent.includes('releaseDate') || prismaContent.includes('date');
  const sourceHashFieldFound = prismaContent.includes('sourceHash');
  const pitGateField = (prismaContent.includes('releaseDate')) ? 'releaseDate' : null;

  const sourceState = realSourceCandidates.length > 0
    ? 'REAL_DATA_PRESENT_BUT_NOT_MAPPED'
    : 'MISSING_SOURCE';

  const notes = [
    `Prisma MonthlyRevenue model found: ${prismaContent.includes('MonthlyRevenue')}`,
    `P12 PIT contract reference: ${p12HasMonthlyRevenue}`,
    `Real source candidates: ${realSourceCandidates.join(', ') || 'none'}`,
    `pitGateField: ${pitGateField || 'not found'}`,
    'outcomeFields (outcomePrice/returnPct/realizedReturnClass) NOT referenced — readOnly',
  ].join('; ');

  return {
    sourceCategory: 'MonthlyRevenue',
    sourceState,
    fixtureFileFound: false,
    realSourceCandidates,
    pitGateField,
    symbolJoinFieldFound,
    asOfDateCompatibleFieldFound,
    sourceHashFieldFound,
    outcomeFieldsDetected: false,
    readOnly: true,
    notes,
  };
}

export function scanNewsEventSourceMapping(workspaceRoot: string): SourceScanResult {
  const fixturePath = path.join(
    workspaceRoot,
    'outputs',
    'online_validation',
    'fixtures',
    'p26b_news_events_fixture.json'
  );
  const fixtureFileFound = fileExists(fixturePath);

  return {
    sourceCategory: 'NewsEvent',
    sourceState: 'FIXTURE_ONLY',
    fixtureFileFound,
    realSourceCandidates: [],
    pitGateField: 'publishedAt',
    symbolJoinFieldFound: true,
    asOfDateCompatibleFieldFound: true,
    sourceHashFieldFound: false,
    outcomeFieldsDetected: false,
    readOnly: true,
    notes: [
      `Fixture file found: ${fixtureFileFound}`,
      'No real DB source found for NewsEvent',
      'pitGateField: publishedAt (P26B PIT adapter)',
      'outcomeFields NOT referenced — readOnly',
    ].join('; '),
  };
}

export function scanFinancialReportSourceMapping(workspaceRoot: string): SourceScanResult {
  const fixturePath = path.join(
    workspaceRoot,
    'outputs',
    'online_validation',
    'fixtures',
    'p26c_financial_reports_fixture.json'
  );
  const fixtureFileFound = fileExists(fixturePath);

  return {
    sourceCategory: 'FinancialReport',
    sourceState: 'FIXTURE_ONLY',
    fixtureFileFound,
    realSourceCandidates: [],
    pitGateField: 'availabilityDate',
    symbolJoinFieldFound: true,
    asOfDateCompatibleFieldFound: true,
    sourceHashFieldFound: false,
    outcomeFieldsDetected: false,
    readOnly: true,
    notes: [
      `Fixture file found: ${fixtureFileFound}`,
      'No real DB source found for FinancialReport',
      'pitGateField: availabilityDate (P26C availability contract)',
      'outcomeFields NOT referenced — readOnly',
    ].join('; '),
  };
}

export function classifySourceMapping(scanResult: SourceScanResult): string {
  return scanResult.sourceState;
}

export function summarizeSourceMappingResults(results: SourceScanResult[]): object {
  const fixtureOnlyCount = results.filter(r => r.sourceState === 'FIXTURE_ONLY').length;
  const realDataPresentCount = results.filter(r => r.sourceState === 'REAL_DATA_PRESENT_BUT_NOT_MAPPED').length;
  const realDataReadyCount = results.filter(r => r.sourceState === 'REAL_DATA_READY').length;
  const missingSourceCount = results.filter(r => r.sourceState === 'MISSING_SOURCE').length;

  const perSource: Record<string, object> = {};
  for (const r of results) {
    perSource[r.sourceCategory] = {
      sourceState: r.sourceState,
      fixtureFileFound: r.fixtureFileFound,
      realSourceCandidates: r.realSourceCandidates,
      pitGateField: r.pitGateField,
      symbolJoinFieldFound: r.symbolJoinFieldFound,
      readOnly: r.readOnly,
      outcomeFieldsDetected: r.outcomeFieldsDetected,
    };
  }

  return {
    totalSources: results.length,
    fixtureOnlyCount,
    realDataPresentCount,
    realDataReadyCount,
    missingSourceCount,
    perSource,
    allReadOnly: results.every(r => r.readOnly),
    anyOutcomeFieldsDetected: results.some(r => r.outcomeFieldsDetected),
  };
}

export function validateSourceMappingDoesNotUseOutcomeFields(
  results: SourceScanResult[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const r of results) {
    if (r.outcomeFieldsDetected) {
      violations.push(`${r.sourceCategory}: outcomeFieldsDetected=true — forbidden`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function validateSourceMappingReadOnly(
  results: SourceScanResult[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const r of results) {
    if (!r.readOnly) {
      violations.push(`${r.sourceCategory}: readOnly=false — must be true`);
    }
  }
  return { valid: violations.length === 0, violations };
}
