import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { runRealOhlcvValidationProtocol } from "../src/lib/research/RealOhlcvValidationProtocol";

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, "outputs/retraining/p194_twstock_ohlcv_export.csv");

async function walkFiles(directory: string): Promise<string[]> {
  let entries: Dirent[];
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
  for (const entry of entries.sort(
    (left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function protectedFilePaths(): Promise<string[]> {
  const recursiveRoots = [
    "outputs/retraining",
    "outputs/online_validation/fixture_db",
    "runtime",
    ".ai",
    ".github/workflows",
  ].map((relativePath) => path.join(ROOT, relativePath));
  const recursiveFiles = (await Promise.all(recursiveRoots.map(walkFiles))).flat();
  const explicitFiles = [
    "dev.db",
    "dev.db-wal",
    "dev.db-shm",
    "prisma/dev.db",
    "prisma/dev.db-wal",
    "prisma/dev.db-shm",
    "prisma/dev.p24_premigration_backup_2026-05-12_0716.db",
    "prisma/dev.p24_premigration_backup_2026-05-12_0716.db-wal",
    "prisma/dev.p24_premigration_backup_2026-05-12_0716.db-shm",
    "package.json",
    "package-lock.json",
  ].map((relativePath) => path.join(ROOT, relativePath));
  return [...new Set([...recursiveFiles, ...explicitFiles])].sort();
}

async function captureProtectedHashes(): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const filePath of await protectedFilePaths()) {
    try {
      const bytes = await readFile(filePath);
      hashes[path.relative(ROOT, filePath)] = createHash("sha256").update(bytes).digest("hex");
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
  const inputBytes = await readFile(INPUT_PATH);
  const result = runRealOhlcvValidationProtocol(inputBytes);
  const after = await captureProtectedHashes();
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error("forbidden protected-file write detected during check-only execution");
  }
  process.stdout.write(`${JSON.stringify({ ...result, protectedFilesUnchanged: true })}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({
    protocolStatus: "FAIL",
    evidenceStatus: "DIAGNOSTIC_ONLY",
    promotionEligibility: "BLOCKED_DATA_QUALITY",
    error: message,
  })}\n`);
  process.exitCode = 1;
});
