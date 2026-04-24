import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { generateCrossMarketTheme } from '@/lib/events/CrossMarketThemeEngine';
import { generateSectorLinkageTimeline } from '@/lib/events/SectorLinkageTimelineEngine';

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic')?.trim();
  if (!topic) {
    return NextResponse.json(
      {
        topic: '',
        crossMarket: null,
        timeline: null,
        generatedAt: new Date().toISOString(),
        limitations: ['Missing required query param: topic'],
      },
      { status: 400 },
    );
  }

  const rawDays = Number(req.nextUrl.searchParams.get('days') ?? '14');
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 3), 30) : 14;
  const rawMinBreadth = Number(req.nextUrl.searchParams.get('minBreadth') ?? '1');
  const minBreadth = Number.isFinite(rawMinBreadth) ? Math.min(Math.max(rawMinBreadth, 1), 20) : 1;

  const cacheKey = `events:sector-timeline:v1:t=${topic}:d=${days}:b=${minBreadth}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [crossMarket, timeline] = await Promise.all([
    generateCrossMarketTheme({ topic, days, minBreadth }),
    generateSectorLinkageTimeline({ topic, days, minBreadth }),
  ]);

  const result = {
    topic,
    crossMarket,
    timeline,
    generatedAt: new Date().toISOString(),
    limitations: [...crossMarket.limitations, ...timeline.limitations],
  };
  apiCache.set(cacheKey, result, 120);
  return NextResponse.json(result);
}

