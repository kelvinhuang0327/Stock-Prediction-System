// P26F3-3-HARDRESET: Drop-zone Inventory Utils
// DISCLAIMER: Does not constitute investment advice.
// READ-ONLY. No DB write. No corpus write. No external API. No Math.random.

const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
const crypto = require("crypto") as typeof import("crypto");

export type InventoryClassification = "SOURCE_FILES_PRESENT" | "SOURCE_NOT_PROVIDED" | "UNSUPPORTED_FILES_ONLY";

export interface DropzoneFileEntry {
  fileName: string;
  filePath: string;
  format: string;
  isCandidate: boolean;
  isIgnored: boolean;
  fileSizeBytes: number;
  sha256: string;
  mtimeMs: number;
  mtimeISO: string;
  suspectedPeriod: string | null;
}

export interface DropzoneInventory {
  dropzonePath: string;
  inventoriedAt: string;
  totalFiles: number;
  candidateSourceFiles: number;
  ignoredFiles: number;
  unsupportedFiles: number;
  supportedFormatCounts: { csv: number; json: number; jsonl: number };
  classification: InventoryClassification;
  files: DropzoneFileEntry[];
  readOnly: true;
  dbWriteAllowed: false;
  corpusWriteAllowed: false;
}

const IGNORED_NAMES = ["README.md", "EXPECTED_SCHEMA.json", ".gitkeep", ".gitignore", ".DS_Store"];
const CANDIDATE_EXTS = [".csv", ".json", ".jsonl", ".ndjson"];

function detectFormat(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".csv") return "csv";
  if (ext === ".json") return "json";
  if (ext === ".jsonl" || ext === ".ndjson") return "jsonl";
  return "unknown";
}

function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function suspectPeriodFromFilename(fileName: string): string | null {
  const m = fileName.match(/(\d{4})[_\-]?(0[1-9]|1[0-2])/);
  if (m) return `${m[1]}-${m[2]}`;
  return null;
}

export function inventoryDropzone(dropzonePath: string): DropzoneInventory {
  const inventoriedAt = new Date().toISOString();
  const result: DropzoneInventory = {
    dropzonePath,
    inventoriedAt,
    totalFiles: 0,
    candidateSourceFiles: 0,
    ignoredFiles: 0,
    unsupportedFiles: 0,
    supportedFormatCounts: { csv: 0, json: 0, jsonl: 0 },
    classification: "SOURCE_NOT_PROVIDED",
    files: [],
    readOnly: true,
    dbWriteAllowed: false,
    corpusWriteAllowed: false,
  };

  if (!fs.existsSync(dropzonePath)) return result;

  const allNames = fs.readdirSync(dropzonePath);
  result.totalFiles = allNames.length;

  for (const name of allNames) {
    const fp = path.join(dropzonePath, name);
    let stat: ReturnType<typeof fs.statSync>;
    try { stat = fs.statSync(fp); } catch { continue; }
    const ignored = name.startsWith(".") || IGNORED_NAMES.includes(name);
    const ext = path.extname(name).toLowerCase();
    const isCandidate = !ignored && CANDIDATE_EXTS.includes(ext);
    const format = detectFormat(name);
    let fileSha = "";
    try { fileSha = sha256File(fp); } catch { fileSha = "UNREADABLE"; }
    const entry: DropzoneFileEntry = {
      fileName: name,
      filePath: fp,
      format,
      isCandidate,
      isIgnored: ignored,
      fileSizeBytes: stat.size,
      sha256: fileSha,
      mtimeMs: stat.mtimeMs,
      mtimeISO: new Date(stat.mtimeMs).toISOString(),
      suspectedPeriod: suspectPeriodFromFilename(name),
    };
    result.files.push(entry);
    if (ignored) {
      result.ignoredFiles++;
    } else if (isCandidate) {
      result.candidateSourceFiles++;
      if (format === "csv") result.supportedFormatCounts.csv++;
      else if (format === "json") result.supportedFormatCounts.json++;
      else if (format === "jsonl") result.supportedFormatCounts.jsonl++;
    } else {
      result.unsupportedFiles++;
    }
  }

  if (result.candidateSourceFiles > 0) {
    result.classification = "SOURCE_FILES_PRESENT";
  } else if (result.unsupportedFiles > 0) {
    result.classification = "UNSUPPORTED_FILES_ONLY";
  } else {
    result.classification = "SOURCE_NOT_PROVIDED";
  }

  return result;
}

export function summarizeInventory(inv: DropzoneInventory): string {
  const lines = [
    `# P26F3-3 Drop-zone Inventory`,
    `Inventoried: ${inv.inventoriedAt}`,
    `Total files: ${inv.totalFiles}`,
    `Candidate source files: ${inv.candidateSourceFiles}`,
    `Ignored files: ${inv.ignoredFiles}`,
    `Unsupported files: ${inv.unsupportedFiles}`,
    `Format counts: CSV=${inv.supportedFormatCounts.csv} JSON=${inv.supportedFormatCounts.json} JSONL=${inv.supportedFormatCounts.jsonl}`,
    `Classification: ${inv.classification}`,
  ];
  return lines.join("\n");
}
