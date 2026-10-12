import { NextResponse } from 'next/server';
import { getOrchestratorSummary, updateOrchestratorProviders } from '@/lib/agent-orchestrator/service';
import type { PlannerProvider, WorkerProvider } from '@/lib/agent-orchestrator/types';

const PLANNER_OPTIONS = [
  { value: 'codex',  label: 'Codex',  available: true, reason: '' },
  { value: 'claude', label: 'Claude', available: true, reason: '' },
];
const WORKER_OPTIONS = [
  { value: 'codex',          label: 'Codex',          available: true, reason: '' },
  { value: 'claude',         label: 'Claude',          available: true, reason: '' },
  { value: 'copilot',        label: 'Copilot',         available: true, reason: '' },
  { value: 'copilot-daemon', label: 'Copilot Daemon',  available: true, reason: '' },
];

export async function GET() {
  try {
    const summary = await getOrchestratorSummary();
    const planner = summary.plannerProvider;
    const worker  = summary.workerProvider;
    const combo_label = `planner=${planner} · worker=${worker}`;
    return NextResponse.json({
      ok: true,
      planner_provider: planner,
      worker_provider:  worker,
      planner_options:  PLANNER_OPTIONS,
      worker_options:   WORKER_OPTIONS,
      worker_copilot_model: '',
      worker_copilot_model_presets: [
        { value: 'auto' },
        { value: 'gpt-4o' },
        { value: 'gpt-4o-mini' },
      ],
      combo_label,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function isPlannerProvider(value: unknown): value is PlannerProvider {
  return value === 'codex' || value === 'claude';
}

function isWorkerProvider(value: unknown): value is WorkerProvider {
  return value === 'codex' || value === 'claude' || value === 'copilot' || value === 'copilot-daemon';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const plannerProvider = body?.planner_provider;
    const workerProvider = body?.worker_provider;

    if (!isPlannerProvider(plannerProvider) || !isWorkerProvider(workerProvider)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid provider(s). planner_provider and worker_provider are required.' },
        { status: 400 },
      );
    }

    const state = await updateOrchestratorProviders(plannerProvider, workerProvider);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
