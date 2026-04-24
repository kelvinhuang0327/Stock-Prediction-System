import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BacklogPanel } from '@/components/orchestrator/BacklogPanel';
import { CtoReviewPanel } from '@/components/orchestrator/CtoReviewPanel';
import { getLatestCtoRun } from '@/lib/agent-orchestrator/ctoReviewTick';
import { getPrioritizedBacklog } from '@/lib/agent-orchestrator/backlogService';
import { getExecutionPolicyMode } from '@/lib/agent-orchestrator/executionPolicy';
import { classifySignalState } from '@/lib/agent-orchestrator/signalStateClassifier';
import { prisma } from '@/lib/prisma';

const CTO_FLOW = [
  {
    step: '1. Intake',
    title: '收 worker / learning source',
    detail: '讀取 worker 提交、review candidates、regime / data gap findings，建立 CTO decision inputs。',
  },
  {
    step: '2. Review',
    title: 'CTO run 決策',
    detail: '依 signal state、run intent、candidate quality 決定 accepted / rejected / deferred / reflected。',
  },
  {
    step: '3. Backlog',
    title: '產生 priority backlog',
    detail: '只有 CTO flow 會維護 P0-P3 backlog、suggested action、severity、urgency 與 category。',
  },
  {
    step: '4. Policy',
    title: '批次選取與排程',
    detail: '透過 strict priority / balanced / fairness 選下一批 backlog，這和 Planner / Worker 排程分離。',
  },
];

export default async function OrchestratorCtoPage() {
  const [latestCtoRun, signalStateResult, ctoSchedulerSetting, backlogItems, execMode] = await Promise.all([
    getLatestCtoRun(),
    classifySignalState(),
    prisma.orchestratorSetting.findUnique({ where: { key: 'cto_scheduler_enabled' } }),
    getPrioritizedBacklog(20),
    getExecutionPolicyMode(),
  ]);

  const ctoSchedulerEnabled = ctoSchedulerSetting?.value === 'true';

  const latestRunForPanel = latestCtoRun
    ? {
        runId:          latestCtoRun.runId,
        candidateCount: latestCtoRun.candidateCount,
        acceptedCount:  latestCtoRun.acceptedCount,
        rejectedCount:  latestCtoRun.rejectedCount,
        deferredCount:  latestCtoRun.deferredCount,
        reflectedCount: latestCtoRun.reflectedCount,
        summary:        latestCtoRun.summary,
        isManual:       latestCtoRun.isManual,
        createdAt:      latestCtoRun.createdAt.toISOString(),
      }
    : null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">CTO Review System</div>
          <h1 className="text-3xl font-black text-white mt-2">CTO Review / Backlog Control Plane</h1>
          <p className="text-slate-400 mt-2">
            這一頁承接 CTO review、priority backlog 與 execution policy。它不再和 Task Orchestration 混在同一個入口。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/orchestrator"
            className="text-sm text-slate-400 hover:text-white transition-colors border border-slate-700 rounded-lg px-3 py-1.5"
          >
            ← 返回 Orchestrator
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100">Target CTO Flow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {CTO_FLOW.map((item) => (
              <div key={item.step} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.step}</div>
                <div className="mt-2 text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-2 text-sm text-slate-400">{item.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100">Source / Target Alignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="font-semibold text-white">Source</div>
              <div className="mt-2 text-slate-400">worker review outputs、learning findings、data gaps、regime mismatch signals。</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="font-semibold text-white">Target</div>
              <div className="mt-2 text-slate-400">CTO review decisions、priority backlog、execution policy state、selected batches for follow-up action。</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CtoReviewPanel
        schedulerEnabled={ctoSchedulerEnabled}
        signalState={{
          state:           signalStateResult.state,
          confidenceLabel: signalStateResult.confidenceLabel,
          reason:          signalStateResult.reason,
        }}
        latestRun={latestRunForPanel}
      />

      <BacklogPanel
        items={backlogItems}
        executionMode={execMode}
        openCount={backlogItems.length}
      />
    </div>
  );
}
