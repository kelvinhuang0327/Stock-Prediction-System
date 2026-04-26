import path from 'node:path';
import { promises as fs } from 'node:fs';

const WORKSPACE_ROOT = process.cwd();
const PROFILE_PATH = path.join(WORKSPACE_ROOT, 'runtime', 'agent_orchestrator', 'project_profile.json');
const CLEANUP_TASK_STATUSES = new Set(['FAILED', 'FAILED_RATE_LIMIT', 'REPLAN_REQUIRED', 'CANCELLED']);

function nowIso() {
  return new Date().toISOString();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getCleanupKey(task) {
  const dedupeKey = task?.plannerContext?.dedupeKey;
  if (dedupeKey) return `dedupe:${dedupeKey}`;
  if (task?.slug) return `slug:${task.slug}`;
  return null;
}

function shouldArchiveTask(task, latestCompletedTaskIdByKey) {
  const cleanupKey = getCleanupKey(task);
  if (!cleanupKey) return false;
  if (!CLEANUP_TASK_STATUSES.has(task.status)) return false;

  const latestCompletedTaskId = latestCompletedTaskIdByKey.get(cleanupKey);
  if (!latestCompletedTaskId) return false;
  return task.taskId < latestCompletedTaskId;
}

function runMentionsRemovedTask(run, removedTaskIds) {
  if (!run?.reason || removedTaskIds.size === 0) return false;

  for (const taskId of removedTaskIds) {
    if (run.reason.includes(`#${taskId}`) || run.reason.includes(`task #${taskId}`) || run.reason.includes(`Task #${taskId}`)) {
      return true;
    }
  }

  return false;
}

async function moveFileIfExists(filePath, archiveRoot, movedFiles) {
  if (!filePath) return;

  try {
    await fs.access(filePath);
  } catch {
    return;
  }

  const relativePath = path.relative(WORKSPACE_ROOT, filePath);
  const targetPath = path.join(archiveRoot, 'files', relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.rename(filePath, targetPath);
  movedFiles.push({ from: filePath, to: targetPath });
}

async function archiveTaskFiles(tasks, archiveRoot) {
  const movedFiles = [];

  for (const task of tasks) {
    await moveFileIfExists(task.promptPath, archiveRoot, movedFiles);
    await moveFileIfExists(task.contractPath, archiveRoot, movedFiles);
    await moveFileIfExists(task.completedPath, archiveRoot, movedFiles);
    await moveFileIfExists(task.resultPath, archiveRoot, movedFiles);
    await moveFileIfExists(task.metaPath, archiveRoot, movedFiles);
    await moveFileIfExists(task.workerLogPath, archiveRoot, movedFiles);
  }

  return movedFiles;
}

async function collectArchivedTaskIds(archiveParentPath) {
  const archivedTaskIds = new Set();

  try {
    const entries = await fs.readdir(archiveParentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('cleanup-')) continue;

      const manifestPath = path.join(archiveParentPath, entry.name, 'archive.json');
      try {
        const manifest = await readJson(manifestPath);
        for (const taskId of manifest.removedTaskIds ?? []) {
          archivedTaskIds.add(taskId);
        }
      } catch {
        // Ignore broken or partial archive manifests.
      }
    }
  } catch {
    return archivedTaskIds;
  }

  return archivedTaskIds;
}

async function main() {
  const profile = await readJson(PROFILE_PATH);
  const orchestratorRoot = path.resolve(WORKSPACE_ROOT, profile.orchestrator_root);
  const taskIndexPath = path.join(orchestratorRoot, 'task_index.json');
  const runStorePath = path.join(orchestratorRoot, 'runs.json');
  const archiveParentPath = path.join(orchestratorRoot, 'archive');

  const taskIndex = await readJson(taskIndexPath);
  const runStore = await readJson(runStorePath);

  const latestCompletedTaskIdByKey = new Map();
  for (const task of taskIndex.tasks) {
    const cleanupKey = getCleanupKey(task);
    if (!cleanupKey || task.status !== 'COMPLETED') continue;

    const current = latestCompletedTaskIdByKey.get(cleanupKey) ?? 0;
    if (task.taskId > current) {
      latestCompletedTaskIdByKey.set(cleanupKey, task.taskId);
    }
  }

  const tasksToRemove = taskIndex.tasks.filter((task) => shouldArchiveTask(task, latestCompletedTaskIdByKey));
  const removedTaskIds = new Set(tasksToRemove.map((task) => task.taskId));
  const archivedTaskIds = await collectArchivedTaskIds(archiveParentPath);
  const allKnownRemovedTaskIds = new Set([...removedTaskIds, ...archivedTaskIds]);
  const runsToRemove = runStore.runs.filter(
    (run) => (run.taskId !== null && allKnownRemovedTaskIds.has(run.taskId)) || runMentionsRemovedTask(run, allKnownRemovedTaskIds),
  );
  const removedRunIds = new Set(runsToRemove.map((run) => run.runId));

  if (tasksToRemove.length === 0 && runsToRemove.length === 0) {
    console.log(JSON.stringify({ ok: true, changed: false, removedTaskIds: [], removedRunIds: [] }, null, 2));
    return;
  }

  const timestamp = nowIso().replaceAll(':', '-').replaceAll('.', '-');
  const archiveRoot = path.join(orchestratorRoot, 'archive', `cleanup-${timestamp}`);
  await fs.mkdir(archiveRoot, { recursive: true });

  const movedFiles = await archiveTaskFiles(tasksToRemove, archiveRoot);
  const archive = {
    version: '1.0',
    createdAt: nowIso(),
    reason: 'Removed superseded failed orchestrator history after a later PASS for the same dedupeKey.',
    removedTaskIds: tasksToRemove.map((task) => task.taskId),
    removedRunIds: runsToRemove.map((run) => run.runId),
    tasks: tasksToRemove,
    runs: runsToRemove,
    movedFiles,
  };

  await writeJson(path.join(archiveRoot, 'archive.json'), archive);

  taskIndex.tasks = taskIndex.tasks.filter((task) => !removedTaskIds.has(task.taskId));
  runStore.runs = runStore.runs.filter((run) => !removedRunIds.has(run.runId));

  await writeJson(taskIndexPath, taskIndex);
  await writeJson(runStorePath, runStore);

  console.log(
    JSON.stringify(
      {
        ok: true,
        changed: true,
        archivePath: path.join(archiveRoot, 'archive.json'),
        removedTaskIds: archive.removedTaskIds,
        removedRunIds: archive.removedRunIds,
        movedFiles: movedFiles.length,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}