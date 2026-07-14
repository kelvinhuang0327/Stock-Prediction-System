import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { runReproducibleRefitCheck } from "../src/lib/research/RealOhlcvRefit";

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, "outputs/retraining/p194_twstock_ohlcv_export.csv");
const METRICS_PATH = path.join(ROOT, "outputs/retraining/p193_real_ohlcv_metrics.json");

async function walkFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "UNKNOWN";
    if (code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function protectedFilePaths(): Promise<string[]> {
  const recursiveRoots = [
    path.join(ROOT, "outputs/retraining"),
    path.join(ROOT, ".ai"),
    path.join(ROOT, ".github/workflows"),
  ];
  const recursiveFiles = (await Promise.all(recursiveRoots.map(walkFiles))).flat();
  const explicitFiles = [
    "dev.db",
    "prisma/dev.db",
    "prisma/dev.db-wal",
    "prisma/dev.db-shm",
    "prisma/dev.p24_premigration_backup_2026-05-12_0716.db",
    "runtime/agent_orchestrator/orchestrator.db",
    "runtime/orchestrator.db",
    "runtime/agent_orchestrator/llm_audit.jsonl",
    "runtime/agent_orchestrator/llm_usage.jsonl",
    "package.json",
    "package-lock.json",
  ].map((relativePath) => path.join(ROOT, relativePath));
  return [...new Set([...recursiveFiles, ...explicitFiles])].sort();
}

async function captureProtectedHashes(): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const filePath of await protectedFilePaths()) {
    try {
      const content = await readFile(filePath);
      hashes[path.relative(ROOT, filePath)] = createHash("sha256").update(content).digest("hex");
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "UNKNOWN";
      if (code !== "ENOENT") throw error;
      hashes[path.relative(ROOT, filePath)] = "ABSENT";
    }
  }
  return hashes;
}

async function main(): Promise<void> {
  const before = await captureProtectedHashes();
  const [csvRaw, committedMetricsRaw] = await Promise.all([
    readFile(INPUT_PATH, "utf8"),
    readFile(METRICS_PATH, "utf8"),
  ]);
  const result = runReproducibleRefitCheck(csvRaw, committedMetricsRaw);
  const after = await captureProtectedHashes();
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error("forbidden protected-file write detected during check-only execution");
  }
  process.stdout.write(`${JSON.stringify({ ...result, protectedFilesUnchanged: true })}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`${JSON.stringify({
    reproductionStatus: "FAIL",
    promotionEligibility: "BLOCKED_DATA_QUALITY",
    error: message,
  })}\n`);
  process.exitCode = 1;
});
