import { NextResponse } from 'next/server';
import { runAutonomousDailyCycle } from '@/lib/jobs/autonomousJobRunners';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scheduledFor = body?.scheduledFor ? new Date(body.scheduledFor) : undefined;
    const result = await runAutonomousDailyCycle({
      triggerSource: 'api',
      scheduledFor,
      force: Boolean(body?.force),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Autonomous run failed:', error);
    return NextResponse.json(
      { error: 'Autonomous research & simulation cycle failed' },
      { status: 500 },
    );
  }
}
