import { NextResponse } from 'next/server';
import { getAutonomousDashboardSummary } from '@/lib/jobs/AutonomousDashboardService';

export async function GET() {
  try {
    const dashboard = await getAutonomousDashboardSummary();
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('Autonomous dashboard failed:', error);
    return NextResponse.json(
      { error: 'Failed to load autonomous dashboard' },
      { status: 500 },
    );
  }
}
