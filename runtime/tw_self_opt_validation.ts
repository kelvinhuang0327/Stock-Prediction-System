const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { updateOrchestratorScheduler } = require('../src/lib/agent-orchestrator/service');
const { getLlmPolicyState } = require('../src/lib/agent-orchestrator/llmExecutionPolicy');
const {
  runTrainingTaiwanOptimizationMiner,
  runTrainingTaiwanWorkerCycle,
  runTrainingTaiwanInsightIngest,
  runTrainingTaiwanWeeklyDeepResearch,
  runTrainingTaiwanSelfAudit,
} = require('../src/lib/jobs/autonomousJobRunners');
const { loadProjectProfile } = require('../src/lib/agent-orchestrator/profile');
const { loadSchedulerState, loadTaskIndex } = require('../src/lib/agent-orchestrator/storage');

const eventLogPath = path.join(process.cwd(), 'runtime/agent_orchestrator/llm_execution_events.jsonl');
const schedulerStatePath = path.join(process.cwd(), 'runtime/agent_orchestrator/scheduler_state.json');

function eventCount() {
  if (!fs.existsSync(eventLogPath)) return 0;
  const raw = fs.readFileSync(eventLogPath, 'utf8').trim();
  return raw ? raw.split(/\n+/).filter(Boolean).length : 0;
}

function artifactExists(filePath) {
  if (!filePath) return false;
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return fs.existsSync(absolute);
}

async function latestRun(jobName, id) {
  if (id) {
    return prisma.jobRunLog.findUnique({ where: { id } });
  }
  return prisma.jobRunLog.findFirst({ where: { jobName }, orderBy: { createdAt: 'desc' } });
}

async function summarize(execResult) {
  const row = await latestRun(execResult.jobRun.jobName, execResult.jobRun.id);
  return {
    result: {
      jobName: execResult.jobRun.jobName,
      status: execResult.jobRun.status,
      skipped: execResult.skipped,
      reason: execResult.reason ?? null,
      startedAt: execResult.jobRun.startedAt,
      finishedAt: execResult.jobRun.finishedAt,
      summary: execResult.jobRun.summary,
      errorMessage: execResult.jobRun.errorMessage,
      outcome: execResult.outcome ?? null,
    },
    jobRunLog: row
      ? {
          id: row.id,
          status: row.status,
          scheduledFor: row.scheduledFor,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          idempotencyKey: row.idempotencyKey,
          summary: row.summary,
          errorMessage: row.errorMessage,
          metadata: row.metadata,
        }
      : null,
  };
}

async function main() {
  const profile = await loadProjectProfile();
  const initialState = JSON.parse(fs.readFileSync(schedulerStatePath, 'utf8'));
  const beforePolicy = await getLlmPolicyState();
  const beforeEvents = eventCount();
  const beforeInsightCount = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: new Date() } },
  }).catch(() => 0);

  await updateOrchestratorScheduler(false);
  const hardOff = {
    optimizationMiner: await summarize(await runTrainingTaiwanOptimizationMiner({
      triggerSource: 'local_scheduler',
      scheduledFor: new Date('2026-04-30T08:50:00.000Z'),
    })),
    workerCycle: await summarize(await runTrainingTaiwanWorkerCycle({
      triggerSource: 'local_scheduler',
      scheduledFor: new Date('2026-04-30T08:51:00.000Z'),
    })),
    insightIngest: await summarize(await runTrainingTaiwanInsightIngest({
      triggerSource: 'local_scheduler',
      scheduledFor: new Date('2026-04-30T08:52:00.000Z'),
    })),
    weeklyDeep: await summarize(await runTrainingTaiwanWeeklyDeepResearch({
      triggerSource: 'local_scheduler',
      scheduledFor: new Date('2026-04-30T08:53:00.000Z'),
    })),
    selfAudit: await summarize(await runTrainingTaiwanSelfAudit({
      triggerSource: 'local_scheduler',
      scheduledFor: new Date('2026-04-30T08:54:00.000Z'),
    })),
  };
  const afterHardOffPolicy = await getLlmPolicyState();
  const afterHardOffEvents = eventCount();

  await updateOrchestratorScheduler(true);
  const { paths } = await loadSchedulerState(profile);
  const taskIndexBefore = await loadTaskIndex(paths);
  const maxTaskIdBefore = taskIndexBefore.tasks.reduce((max, task) => Math.max(max, task.taskId || 0), 0);

  const manual = {};
  manual.workerCycle = await summarize(await runTrainingTaiwanWorkerCycle({
    triggerSource: 'local_scheduler',
    scheduledFor: new Date('2026-04-30T08:55:00.000Z'),
  }));
  manual.optimizationMiner = await summarize(await runTrainingTaiwanOptimizationMiner({
    triggerSource: 'local_scheduler',
    scheduledFor: new Date('2026-04-30T08:56:00.000Z'),
  }));
  manual.weeklyDeep = await summarize(await runTrainingTaiwanWeeklyDeepResearch({
    triggerSource: 'local_scheduler',
    scheduledFor: new Date('2026-04-30T08:57:00.000Z'),
  }));
  manual.selfAudit = await summarize(await runTrainingTaiwanSelfAudit({
    triggerSource: 'local_scheduler',
    scheduledFor: new Date('2026-04-30T08:58:00.000Z'),
  }));

  const insightCountBeforeIngest = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: new Date() } },
  }).catch(() => beforeInsightCount);
  manual.insightIngest1 = await summarize(await runTrainingTaiwanInsightIngest({
    triggerSource: 'local_scheduler',
    scheduledFor: new Date('2026-04-30T08:59:00.000Z'),
  }));
  const insightCountAfterIngest1 = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: new Date() } },
  }).catch(() => insightCountBeforeIngest);
  manual.insightIngest2 = await summarize(await runTrainingTaiwanInsightIngest({
    triggerSource: 'local_scheduler',
    scheduledFor: new Date('2026-04-30T09:00:00.000Z'),
  }));
  const insightCountAfterIngest2 = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: new Date() } },
  }).catch(() => insightCountAfterIngest1);

  const taskIndexAfter = await loadTaskIndex(paths);
  const newTasks = taskIndexAfter.tasks
    .filter((task) => (task.taskId || 0) > maxTaskIdBefore)
    .map((task) => ({
      taskId: task.taskId,
      status: task.status,
      dedupeKey: task.plannerContext?.dedupeKey,
      promptPath: task.promptPath,
      contractPath: task.contractPath,
      resultPath: task.resultPath,
      completedPath: task.completedPath,
      promptExists: artifactExists(task.promptPath),
      contractExists: artifactExists(task.contractPath),
      resultExists: artifactExists(task.resultPath),
      completedExists: artifactExists(task.completedPath),
    }));

  const afterManualPolicy = await getLlmPolicyState();
  const afterManualEvents = eventCount();

  await updateOrchestratorScheduler(Boolean(initialState.schedulerEnabled));
  const restoredSchedulerEnabled = JSON.parse(fs.readFileSync(schedulerStatePath, 'utf8')).schedulerEnabled;

  console.log(JSON.stringify({
    initialState,
    policy: {
      before: beforePolicy,
      afterHardOff: afterHardOffPolicy,
      afterManual: afterManualPolicy,
      eventCounts: {
        before: beforeEvents,
        afterHardOff: afterHardOffEvents,
        afterManual: afterManualEvents,
      },
    },
    insightCounts: {
      before: beforeInsightCount,
      beforeIngest: insightCountBeforeIngest,
      afterIngest1: insightCountAfterIngest1,
      afterIngest2: insightCountAfterIngest2,
    },
    hardOff,
    manual,
    newTasks,
    artifactChecks: {
      weeklyDeepReport: artifactExists('runtime/training_reports/tw_weekly_deep_research.json'),
      selfAuditReport: artifactExists('runtime/training_reports/tw_self_audit.json'),
    },
    restoredSchedulerEnabled,
  }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
