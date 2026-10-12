import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { generateTopicMomentum } from '@/lib/events/TopicMomentumEngine';
import { generateThemeDiffusion } from '@/lib/events/ThemeDiffusionEngine';

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic')?.trim();
  if (!topic) {
    return NextResponse.json(
      {
        topic: '',
        momentum: null,
        diffusion: null,
        generatedAt: new Date().toISOString(),
        limitations: ['Missing required query param: topic'],
      },
      { status: 400 },
    );
  }
  const rawDays = Number(req.nextUrl.searchParams.get('days') ?? '7');
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 30) : 7;
  const rawMinCount = Number(req.nextUrl.searchParams.get('minCount') ?? '1');
  const minCount = Number.isFinite(rawMinCount) ? Math.min(Math.max(rawMinCount, 0), 20) : 1;

  const cacheKey = `events:topic-diffusion:v1:topic=${topic}:days=${days}:min=${minCount}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [momentum, diffusion] = await Promise.all([
    generateTopicMomentum({ topic, days, minCount }),
    generateThemeDiffusion({ topic, days, minCount }),
  ]);

  const result = {
    topic,
    momentum,
    diffusion,
    generatedAt: new Date().toISOString(),
    limitations: [...momentum.limitations, ...diffusion.limitations],
  };
  apiCache.set(cacheKey, result, 120);
  return NextResponse.json(result);
}
