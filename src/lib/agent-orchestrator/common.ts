import { promises as fs } from 'fs';
import path from 'path';

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
