import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PLANNER_OPTIONS = [
  { value: 'claude', label: 'Claude CLI' },
  { value: 'codex',  label: 'Codex CLI'  },
];
const PLANNER_MODEL_PRESETS = ['auto', 'gpt-5-mini', 'claude-3-5-sonnet'];

function providerLabel(provider: string): string {
  return PLANNER_OPTIONS.find((o) => o.value === provider)?.label ?? provider;
}

async function getSettings() {
  const rows = await prisma.orchestratorSetting.findMany({
    where: { key: { in: ['cto_planner_provider', 'cto_planner_model'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    planner_provider: map['cto_planner_provider'] ?? 'codex',
    planner_model:    map['cto_planner_model']    ?? '',
  };
}

export async function GET() {
  try {
    const { planner_provider, planner_model } = await getSettings();
    return NextResponse.json({
      ok: true,
      planner_provider,
      planner_provider_label: providerLabel(planner_provider),
      planner_model,
      planner_options:        PLANNER_OPTIONS,
      planner_model_presets:  PLANNER_MODEL_PRESETS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const planner_provider = (body.planner_provider as string | undefined)?.trim();
    const planner_model    = (body.planner_model    as string | undefined)?.trim() ?? '';

    if (!planner_provider) {
      return NextResponse.json({ ok: false, error: 'planner_provider required' }, { status: 400 });
    }
    if (!PLANNER_OPTIONS.some((o) => o.value === planner_provider)) {
      return NextResponse.json({ ok: false, error: `Unknown provider: ${planner_provider}` }, { status: 400 });
    }

    const now = new Date();
    await prisma.orchestratorSetting.upsert({
      where:  { key: 'cto_planner_provider' },
      update: { value: planner_provider, updatedAt: now },
      create: { key: 'cto_planner_provider', value: planner_provider, updatedAt: now },
    });
    await prisma.orchestratorSetting.upsert({
      where:  { key: 'cto_planner_model' },
      update: { value: planner_model, updatedAt: now },
      create: { key: 'cto_planner_model', value: planner_model, updatedAt: now },
    });

    return NextResponse.json({
      ok: true,
      planner_provider,
      planner_provider_label: providerLabel(planner_provider),
      planner_model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
