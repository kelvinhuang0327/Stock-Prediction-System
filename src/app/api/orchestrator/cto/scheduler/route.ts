import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.orchestratorSetting.findUnique({
      where: { key: 'cto_scheduler_enabled' },
    });
    const enabled = setting?.value === 'true';
    const freq = await prisma.orchestratorSetting.findUnique({
      where: { key: 'cto_frequency_mode' },
    });
    return NextResponse.json({
      ok: true,
      schedulerEnabled: enabled,
      frequencyMode: freq?.value ?? 'manual',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { enabled, frequencyMode } = body as { enabled?: boolean; frequencyMode?: string };

    if (enabled !== undefined) {
      await prisma.orchestratorSetting.upsert({
        where:  { key: 'cto_scheduler_enabled' },
        update: { value: String(enabled), updatedAt: new Date() },
        create: { key: 'cto_scheduler_enabled', value: String(enabled), updatedAt: new Date() },
      });
    }

    if (frequencyMode) {
      const allowed = ['manual', 'hourly', 'daily'];
      if (!allowed.includes(frequencyMode)) {
        return NextResponse.json({ ok: false, error: 'invalid frequencyMode' }, { status: 400 });
      }
      await prisma.orchestratorSetting.upsert({
        where:  { key: 'cto_frequency_mode' },
        update: { value: frequencyMode, updatedAt: new Date() },
        create: { key: 'cto_frequency_mode', value: frequencyMode, updatedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, enabled, frequencyMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
