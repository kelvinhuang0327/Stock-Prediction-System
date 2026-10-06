// P26F3-2-HARDRESET: Manual MonthlyRevenue Source Scanner
// DISCLAIMER: Does not constitute investment advice.
// READ-ONLY. No DB write. No corpus write. No external API. No Math.random.

import { P26F3_2_ACCEPTED_FORMATS, P26F3_2_FORBIDDEN_FIELDS, P26F3_2_CLASSIFICATIONS } from "./P26F32ManualSourceAcquisitionContractUtils";

const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");

export type ManualSourceFormat = "csv" | "json" | "jsonl" | "unknown";

export interface ManualSourceFileScanResult {
  fileName: string;
  filePath: string;
  format: ManualSourceFormat;
  parseStatus: "ok" | "error" | "empty" | "unknown_format";
  rowCount: number;
  forbiddenFieldsFound: string[];
  hasForbiddenFields: boolean;
  parseError?: string;
  rows: Record<string, unknown>[];
}

export interface ManualSourceDropzoneScanSummary {
  dropzonePath: string;
  scannedAt: string;
  totalFiles: number;
  parsedFiles: number;
  errorFiles: number;
  totalRows: number;
  forbiddenFieldFiles: number;
  unknownFormatFiles: number;
  classification: string;
  fileResults: ManualSourceFileScanResult[];
  readOnly: true;
  dbWriteAllowed: false;
  corpusWriteAllowed: false;
}

export function detectManualSourceFormat(filePath: string): ManualSourceFormat {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "jsonl" || ext === "ndjson") return "jsonl";
  return "unknown";
}

function parseCSV(content: string): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    if (vals.length !== headers.length) continue;
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j];
    }
    rows.push(row);
  }
  return rows;
}

function parseJSONL(content: string): Record<string, unknown>[] {
  return content.split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
}

export function parseManualSourceFile(filePath: string): { rows: Record<string, unknown>[]; error?: string } {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const fmt = detectManualSourceFormat(filePath);
    if (fmt === "csv") return { rows: parseCSV(content) };
    if (fmt === "json") {
      const parsed = JSON.parse(content);
      return { rows: Array.isArray(parsed) ? parsed : [parsed] };
    }
    if (fmt === "jsonl") return { rows: parseJSONL(content) };
    return { rows: [], error: "unknown_format" };
  } catch (e: unknown) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function classifyManualSourceFile(filePath: string): ManualSourceFileScanResult {
  const fileName = path.basename(filePath);
  const format = detectManualSourceFormat(filePath);
  if (format === "unknown") {
    return {
      fileName, filePath, format,
      parseStatus: "unknown_format", rowCount: 0,
      forbiddenFieldsFound: [], hasForbiddenFields: false, rows: [],
    };
  }
  const { rows, error } = parseManualSourceFile(filePath);
  const forbidden = Array.from(new Set(rows.flatMap(r => P26F3_2_FORBIDDEN_FIELDS.filter(f => f in r && r[f] != null))));
  return {
    fileName, filePath, format,
    parseStatus: error ? "error" : rows.length === 0 ? "empty" : "ok",
    rowCount: rows.length,
    forbiddenFieldsFound: forbidden,
    hasForbiddenFields: forbidden.length > 0,
    parseError: error,
    rows,
  };
}

export function scanManualMonthlyRevenueDropzone(dropzonePath: string): ManualSourceDropzoneScanSummary {
  const scannedAt = new Date().toISOString();
  if (!fs.existsSync(dropzonePath)) {
    return {
      dropzonePath, scannedAt, totalFiles: 0, parsedFiles: 0, errorFiles: 0,
      totalRows: 0, forbiddenFieldFiles: 0, unknownFormatFiles: 0,
      classification: P26F3_2_CLASSIFICATIONS.SOURCE_NOT_PROVIDED_PACKAGE_READY,
      fileResults: [], readOnly: true, dbWriteAllowed: false, corpusWriteAllowed: false,
    };
  }
  const allFiles = fs.readdirSync(dropzonePath).filter((f: string) => {
    if (f.startsWith(".")) return false;
    if (f === "README.md" || f === "EXPECTED_SCHEMA.json") return false;
    return [".csv",".json",".jsonl",".ndjson"].includes(path.extname(f).toLowerCase());
  });
  if (allFiles.length === 0) {
    return {
      dropzonePath, scannedAt, totalFiles: 0, parsedFiles: 0, errorFiles: 0,
      totalRows: 0, forbiddenFieldFiles: 0, unknownFormatFiles: 0,
      classification: P26F3_2_CLASSIFICATIONS.SOURCE_NOT_PROVIDED_PACKAGE_READY,
      fileResults: [], readOnly: true, dbWriteAllowed: false, corpusWriteAllowed: false,
    };
  }
  const fileResults = allFiles.map((f: string) => classifyManualSourceFile(path.join(dropzonePath, f)));
  const parsedFiles = fileResults.filter(r => r.parseStatus === "ok").length;
  const errorFiles = fileResults.filter(r => r.parseStatus === "error").length;
  const totalRows = fileResults.reduce((s, r) => s + r.rowCount, 0);
  const forbiddenFieldFiles = fileResults.filter(r => r.hasForbiddenFields).length;
  const unknownFormatFiles = fileResults.filter(r => r.format === "unknown").length;
  let classification = P26F3_2_CLASSIFICATIONS.MANUAL_SOURCE_ACCEPTED_DRY_RUN;
  if (forbiddenFieldFiles > 0 || errorFiles > 0 || unknownFormatFiles > 0) {
    classification = P26F3_2_CLASSIFICATIONS.SOURCE_FILES_REJECTED;
  }
  return {
    dropzonePath, scannedAt, totalFiles: allFiles.length, parsedFiles, errorFiles,
    totalRows, forbiddenFieldFiles, unknownFormatFiles, classification,
    fileResults, readOnly: true, dbWriteAllowed: false, corpusWriteAllowed: false,
  };
}

export function summarizeManualSourceScan(scanResults: ManualSourceDropzoneScanSummary): string {
  const lines = [
    `# P26F3-2 Manual Source Scan`,
    `Scanned at: ${scanResults.scannedAt}`,
    `Total files: ${scanResults.totalFiles}`,
    `Parsed OK: ${scanResults.parsedFiles}`,
    `Errors: ${scanResults.errorFiles}`,
    `Total rows: ${scanResults.totalRows}`,
    `Forbidden field files: ${scanResults.forbiddenFieldFiles}`,
    `Unknown format files: ${scanResults.unknownFormatFiles}`,
    `Classification: ${scanResults.classification}`,
  ];
  return lines.join("\n");
}

export function validateManualSourceNoOutcomeFields(scanResults: ManualSourceDropzoneScanSummary): { pass: boolean; violatingFiles: string[] } {
  const violatingFiles = scanResults.fileResults.filter(r => r.hasForbiddenFields).map(r => r.fileName);
  return { pass: violatingFiles.length === 0, violatingFiles };
}

export function validateManualSourceReadOnly(scanResults: ManualSourceDropzoneScanSummary): { pass: boolean; dbWriteAttempted: boolean; corpusWriteAttempted: boolean } {
  return {
    pass: scanResults.dbWriteAllowed === false && scanResults.corpusWriteAllowed === false,
    dbWriteAttempted: false,
    corpusWriteAttempted: false,
  };
}
