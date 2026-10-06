import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrchestratorControlPanel } from '@/components/orchestrator/OrchestratorControlPanel';
import {
  getOrchestratorSummary,
  getOrchestratorTaskDetail,
  listOrchestratorTasks,
} from '@/lib/agent-orchestrator/service';

const ORCHESTRATION_FLOW = [
  {
    step: '1. Planner',
    title: '選任務來源與目標',
    detail: '從 orchestrator backlog 產生 task contract，決定 objective、scope、acceptance tests 與 dedupe key。',
  },
  {
    step: '2. Worker',
    title: '執行任務編排',
    detail: 'worker claim queued task，執行 provider，寫回 completed/result artifacts 與 gate input。',
  },
  {
    step: '3. Gate',
    title: '驗收與終態',
    detail: '依 delivery、acceptance、runtime outcome 決定 COMPLETED / REPLAN_REQUIRED / FAILED_RATE_LIMIT。',
  },
  {
    step: '4. Replan',
    title: '回饋下一輪排程',
    detail: '只有 task orchestration 留在這裡；CTO review 與 priority backlog 另走 CTO flow。',
  },
];

function statusTone(status: string | null | undefined): string {
  if (!status) return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  if (status === 'COMPLETED') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (status === 'RUNNING') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (status === 'FAILED_RATE_LIMIT') return 'bg-orange-500/10 text-orange-200 border-orange-500/30';
  if (status === 'REPLAN_REQUIRED' || status === 'FAILED') return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  if (status === 'QUEUED') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
}

function gateTone(verdict: string | null | undefined): string {
  if (!verdict) return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  if (verdict === 'PASS') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
}

export default async function OrchestratorPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ tab?: string }>;
}>) {
  const { tab = 'orchestrator' } = await searchParams;
  const [summary, taskPage] =
    await Promise.all([
      getOrchestratorSummary(),
      listOrchestratorTasks({ page: 1, pageSize: 20 }),
    ]);

  const latestTaskId = summary.latestTask?.taskId ?? null;
  const latestDetail = latestTaskId ? await getOrchestratorTaskDetail(latestTaskId) : null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Dual-Agent Orchestrator</div>
          <h1 className="text-3xl font-black text-white mt-2">Task Orchestration Control Plane</h1>
          <p className="text-slate-400 mt-2">
            這一頁只處理 Planner / Worker 任務編排。CTO review、priority backlog、execution policy 已獨立到 CTO flow。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={summary.schedulerEnabled ? statusTone('COMPLETED') : statusTone('FAILED')}>
            {summary.schedulerEnabled ? 'scheduler enabled' : 'scheduler disabled'}
          </Badge>
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
            planner: {summary.plannerProvider}
          </Badge>
          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/30">
            worker: {summary.workerProvider}
          </Badge>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 border-b border-slate-800 pb-0 items-end">
        {[
          { key: 'orchestrator', label: '🤖 Task Orchestration' },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`/orchestrator?tab=${key}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-400 text-blue-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {label}
          </Link>
        ))}
        <Link
          href="/orchestrator/cto"
          className="ml-auto px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 border-transparent text-slate-200 hover:text-white hover:bg-slate-800/40 transition-colors"
        >
          🔍 CTO Review / Backlog →
        </Link>
      </div>

      {tab === 'backlog' && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm text-amber-100">
            `📋 Backlog` 已移到 CTO flow。任務編排在此頁，CTO backlog / execution policy / review runs 請改走
            {' '}
            <Link href="/orchestrator/cto" className="font-semibold underline underline-offset-4">
              /orchestrator/cto
            </Link>
            。
          </CardContent>
        </Card>
      )}

      {tab === 'orchestrator' && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-100">Target Flow</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {ORCHESTRATION_FLOW.map((item) => (
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
                <CardTitle className="text-slate-100">Flow Boundary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="font-semibold text-white">這頁負責</div>
                  <div className="mt-2 text-slate-400">task source selection、planner draft、worker execution、gate verdict、replan feedback。</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="font-semibold text-white">CTO 頁負責</div>
                  <div className="mt-2 text-slate-400">review candidates、priority backlog、execution policy、batch selection、resolve / dismiss decision。</div>
                </div>
                <Link href="/orchestrator/cto" className="inline-flex text-cyan-300 hover:text-cyan-200 underline underline-offset-4">
                  Open CTO review flow
                </Link>
              </CardContent>
            </Card>
          </div>

          <OrchestratorControlPanel
            schedulerEnabled={summary.schedulerEnabled}
            plannerProvider={summary.plannerProvider}
            workerProvider={summary.workerProvider}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300">Task Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-white">{summary.taskCounts.total}</div>
                <div className="text-sm text-slate-400 mt-1">
                  queued {summary.taskCounts.queued} · running {summary.taskCounts.running}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300">Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-white">{summary.taskCounts.completed}</div>
                <div className="text-sm text-slate-400 mt-1">
                  replan {summary.taskCounts.replanRequired} · failed {summary.taskCounts.failed} · rate limit {summary.taskCounts.failedRateLimit ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300">Next Planner Run</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-white break-all">{summary.nextPlannerRunAt ?? 'n/a'}</div>
                <div className="text-xs text-slate-500 mt-1">last {summary.lastPlannerRunAt ?? 'n/a'}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300">Next Worker Run</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-white break-all">{summary.nextWorkerRunAt ?? 'n/a'}</div>
                <div className="text-xs text-slate-500 mt-1">last {summary.lastWorkerRunAt ?? 'n/a'}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-100">Recent Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {taskPage.rows.length === 0 ? (
                  <div className="text-sm text-slate-400">No tasks yet.</div>
                ) : (
                  taskPage.rows.map((task) => (
                    <div key={task.taskId} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-white">Task #{task.taskId}</div>
                          <div className="text-xs text-slate-500">
                            {task.slug} · updated {task.updatedAt}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusTone(task.status)}>{task.status}</Badge>
                          <Badge className={gateTone(task.gateVerdict)}>{task.gateVerdict ?? 'N/A'}</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400 mt-2">{task.latestProgressSummary}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-slate-100">Latest Task Detail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestDetail ? (
                  <>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Objective</div>
                      <div className="mt-1 text-sm text-white">{latestDetail.contract?.objective ?? 'n/a'}</div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Gate Verdict</div>
                      <div className="mt-1 text-sm text-white">{latestDetail.result?.gate_verdict ?? 'n/a'}</div>
                      <div className="mt-1 text-xs text-slate-500">{latestDetail.result?.gate_reason ?? 'No result yet'}</div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Acceptance Results</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-300">
                        {(latestDetail.result?.acceptance_results ?? []).length === 0 ? (
                          <div className="text-slate-500">No acceptance result yet.</div>
                        ) : (
                          latestDetail.result?.acceptance_results.map((row, idx) => (
                            <div key={`${row.name}-${idx}`}>
                              {row.passed ? 'PASS' : 'FAIL'} · {row.name}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">No latest task detail available.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
