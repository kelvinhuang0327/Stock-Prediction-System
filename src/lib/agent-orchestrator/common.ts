import { promises as fs } from 'node:fs';
import path from 'node:path';

export const WORKSPACE_ROOT = process.cwd();
export const PROFILE_PATH = path.resolve(WORKSPACE_ROOT, 'runtime/agent_orchestrator/project_profile.json');
export const BACKLOG_PATH = path.resolve(WORKSPACE_ROOT, 'runtime/agent_orchestrator/backlog.md');
export const BACKLOG_RESEARCH_PATH = path.resolve(WORKSPACE_ROOT, 'runtime/agent_orchestrator/backlog_research.json');
export const MINER_STATE_PATH = path.resolve(WORKSPACE_ROOT, 'runtime/agent_orchestrator/miner_state.json');
export const SCHEMA_PATH = path.resolve(WORKSPACE_ROOT, 'docs/agent-orchestrator/project_profile.schema.json');

export function nowIso(): string {
  return new Date().toISOString();
}

export function toDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function toTimestampCompact(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}${m}${d}${hh}${mm}`;
}

export function scheduleNextRunAt(minutes: number, from = new Date()): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function safeSlug(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  return normalized.slice(0, 42) || 'task';
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getBalancedJsonCloser(start: string): string | null {
  if (start === '{') return '}';
  if (start === '[') return ']';
  return null;
}

function updateJsonStringState(state: { inString: boolean; escaped: boolean }, char: string): void {
  if (!state.inString) {
    if (char === '"') {
      state.inString = true;
    }
    return;
  }

  if (state.escaped) {
    state.escaped = false;
    return;
  }

  if (char === '\\') {
    state.escaped = true;
    return;
  }

  if (char === '"') {
    state.inString = false;
  }
}

function nextJsonDepth(depth: number, char: string, start: string, end: string): number {
  if (char === start) return depth + 1;
  if (char === end) return depth - 1;
  return depth;
}

function extractBalancedJsonCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const start = trimmed[0];
  const end = getBalancedJsonCloser(start);
  if (!end) return null;

  let depth = 0;
  const stringState = { inString: false, escaped: false };

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (stringState.inString || char === '"') {
      updateJsonStringState(stringState, char);
      continue;
    }

    depth = nextJsonDepth(depth, char, start, end);
    if (char === end && depth === 0) {
      return trimmed.slice(0, index + 1);
    }
  }

  return null;
}

async function quarantineCorruptJsonFile(filePath: string, raw: string): Promise<void> {
  const quarantinePath = `${filePath}.corrupt-${Date.now()}`;
  await fs.writeFile(quarantinePath, raw, 'utf8');
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');

  try {
    return JSON.parse(raw) as T;
  } catch {
    const repaired = extractBalancedJsonCandidate(raw);
    if (!repaired) {
      await quarantineCorruptJsonFile(filePath, raw);
      throw new Error(`Failed to parse JSON at ${filePath}`);
    }

    try {
      const parsed = JSON.parse(repaired) as T;
      await quarantineCorruptJsonFile(filePath, raw);
      await fs.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
      return parsed;
    } catch {
      await quarantineCorruptJsonFile(filePath, raw);
      throw new Error(`Failed to repair malformed JSON at ${filePath}`);
    }
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function writeTextFile(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, value, 'utf8');
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

export function resolveWorkspacePath(relativePath: string): string {
  return path.resolve(WORKSPACE_ROOT, relativePath);
}
