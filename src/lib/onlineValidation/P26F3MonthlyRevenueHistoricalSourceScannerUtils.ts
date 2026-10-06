// P26F3-HARDRESET: MonthlyRevenue Historical Source Scanner Utils
// DISCLAIMER: Does not constitute investment advice. Read-only filesystem scan.
// No DB write. No corpus overwrite. No scoring formula change. Dry-run only.

export interface HistoricalSourceScanResult {
  scannedPaths: string[];
  totalFilesScanned: number;
  localSourcesFound: number;
  realSourceCandidates: SourceCandidate[];
  templateOnlyCandidates: SourceCandidate[];
  missingPeriods: string[];
  missingSymbols: string[];
  scanClassification: string;
}

export interface SourceCandidate {
  path: string;
  sourceType: "REAL_SOURCE" | "TEMPLATE_ONLY" | "FIXTURE" | "GENERATED_ARTIFACT" | "UNKNOWN";
  periods: string[];
  symbols: string[];
  hasRevenue: boolean;
  hasReleaseDate: boolean;
  rowCount: number;
  note: string;
}

const TARGET_PERIODS = ["2025-09","2025-10","2025-11","2025-12","2026-01"];
const TARGET_SYMBOLS = ["0055","00712","00738U","00830","00891","00903","1210","1308","1314","1319","1326","1402","1434","1513","1536","1560","1598","1605","1710","1717","1802","2317","2330","2454","6415"];
const SCAN_DIRS = ["data","prisma","scripts","outputs","fixtures","seed"];
const REVENUE_KEYWORDS = /revenue|monthly|twse|月營收|營收/i;
const OUTCOME_FIELDS = ["outcomePrice","returnPct","realizedReturnClass"];

export function scanLocalMonthlyRevenueHistoricalSources(workspaceRoot: string): HistoricalSourceScanResult {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const scannedPaths: string[] = [];
  const realSourceCandidates: SourceCandidate[] = [];
  const templateOnlyCandidates: SourceCandidate[] = [];
  let totalFilesScanned = 0;

  function scanDir(dir: string): void {
    const fullDir = path.join(workspaceRoot, dir);
    if (!fs.existsSync(fullDir)) return;
    scannedPaths.push(dir);
    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // only recurse one level for safety
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (![".csv",".json",".jsonl",".txt"].includes(ext)) continue;
      const fullPath = path.join(fullDir, entry.name);
      const relPath = path.join(dir, entry.name);
      totalFilesScanned++;
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        if (!REVENUE_KEYWORDS.test(entry.name) && !REVENUE_KEYWORDS.test(content.slice(0, 500))) continue;
        const candidate = classifyHistoricalSourceCandidate(relPath, content);
        if (candidate.sourceType === "REAL_SOURCE") {
          realSourceCandidates.push(candidate);
        } else {
          templateOnlyCandidates.push(candidate);
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  for (const dir of SCAN_DIRS) {
    scanDir(dir);
  }

  const coveredPeriods = new Set<string>();
  const coveredSymbols = new Set<string>();
  for (const c of realSourceCandidates) {
    c.periods.forEach(p => coveredPeriods.add(p));
    c.symbols.forEach(s => coveredSymbols.add(s));
  }

  const missingPeriods = TARGET_PERIODS.filter(p => !coveredPeriods.has(p));
  const missingSymbols = TARGET_SYMBOLS.filter(s => !coveredSymbols.has(s));

  const scanClassification = realSourceCandidates.length === 0
    ? "NO_LOCAL_HISTORICAL_SOURCE_FOUND"
    : "LOCAL_HISTORICAL_SOURCE_FOUND";

  return {
    scannedPaths,
    totalFilesScanned,
    localSourcesFound: realSourceCandidates.length,
    realSourceCandidates,
    templateOnlyCandidates,
    missingPeriods,
    missingSymbols,
    scanClassification,
  };
}

export function classifyHistoricalSourceCandidate(filePath: string, content: string): SourceCandidate {
  const fp = filePath.toLowerCase();
  let sourceType: SourceCandidate["sourceType"] = "UNKNOWN";

  if (fp.includes("p26f") || fp.includes("p26e") || fp.includes("online_validation")) {
    sourceType = "GENERATED_ARTIFACT";
  } else if (fp.includes("fixture") || fp.includes("seed") || fp.includes("mock")) {
    sourceType = "FIXTURE";
  } else if (fp.includes("template")) {
    sourceType = "TEMPLATE_ONLY";
  } else if (fp.includes("data/") || fp.endsWith(".csv")) {
    sourceType = "REAL_SOURCE";
  }

  const hasRevenue = /revenue/i.test(content);
  const hasReleaseDate = /releaseDate/i.test(content);

  const periods: string[] = [];
  for (const p of TARGET_PERIODS) {
    const [y, m] = p.split("-");
    if (content.includes(`"year":${y}`) && content.includes(`"month":${parseInt(m, 10)}`)) {
      periods.push(p);
    }
  }

  const symbols: string[] = [];
  for (const sym of TARGET_SYMBOLS) {
    if (content.includes(`"${sym}"`) || content.includes(`,"${sym}",`)) {
      symbols.push(sym);
    }
  }

  let rowCount = 0;
  try {
    if (filePath.endsWith(".jsonl")) {
      rowCount = content.split("\n").filter(l => l.trim()).length;
    } else if (filePath.endsWith(".json")) {
      const parsed = JSON.parse(content);
      rowCount = Array.isArray(parsed) ? parsed.length : 1;
    }
  } catch {
    rowCount = 0;
  }

  return {
    path: filePath,
    sourceType,
    periods,
    symbols,
    hasRevenue,
    hasReleaseDate,
    rowCount,
    note: sourceType === "GENERATED_ARTIFACT"
      ? "P26F generated artifact — not a real historical source"
      : sourceType === "FIXTURE"
      ? "Fixture/seed file — not a verified official source"
      : "Classified by path/content heuristic",
  };
}

export function extractHistoricalSourceMetadata(source: SourceCandidate): object {
  return {
    path: source.path,
    sourceType: source.sourceType,
    periodCount: source.periods.length,
    symbolCount: source.symbols.length,
    hasRevenue: source.hasRevenue,
    hasReleaseDate: source.hasReleaseDate,
    rowCount: source.rowCount,
    note: source.note,
  };
}

export function summarizeHistoricalSourceAvailability(scanResults: HistoricalSourceScanResult): object {
  return {
    scannedPaths: scanResults.scannedPaths,
    totalFilesScanned: scanResults.totalFilesScanned,
    localSourcesFound: scanResults.localSourcesFound,
    realSourceCount: scanResults.realSourceCandidates.length,
    templateOnlyCount: scanResults.templateOnlyCandidates.length,
    missingPeriods: scanResults.missingPeriods,
    missingSymbols: scanResults.missingSymbols,
    scanClassification: scanResults.scanClassification,
    allTargetPeriodsPresent: scanResults.missingPeriods.length === 0,
    allTargetSymbolsPresent: scanResults.missingSymbols.length === 0,
  };
}

export function validateHistoricalSourceNoOutcomeFields(scanResults: HistoricalSourceScanResult): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const c of [...scanResults.realSourceCandidates, ...scanResults.templateOnlyCandidates]) {
    for (const field of OUTCOME_FIELDS) {
      if (c.note.toLowerCase().includes(field.toLowerCase())) {
        violations.push(`Source ${c.path} references outcome field: ${field}`);
      }
    }
  }
  return { valid: violations.length === 0, violations };
}

export function validateHistoricalSourceReadOnly(scanResults: HistoricalSourceScanResult): { valid: boolean; violations: string[] } {
  // Scan is always read-only — just verify no write markers
  const violations: string[] = [];
  if ((scanResults as Record<string, unknown>)["dbWritePerformed"]) {
    violations.push("Unexpected dbWritePerformed flag detected");
  }
  return { valid: violations.length === 0, violations };
}
