import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { generateThemeLinkage, type LinkageStrength } from '@/lib/events/ThemeLinkageEngine';
import { generateSectorRelationGraph } from '@/lib/events/SectorRelationGraphEngine';

const LEVELS: LinkageStrength[] = ['weak', 'moderate', 'strong'];

function parseLevel(value: string | null): LinkageStrength {
  if (value && LEVELS.includes(value as LinkageStrength)) return value as LinkageStrength;
  return 'weak';
}

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic')?.trim();
  if (!topic) {
    return NextResponse.json(
      {
        topic: '',
        linkage: { topic: '', linkedTopics: [], limitations: ['Missing required query param: topic'] },
        graph: { topic: '', nodes: [], edges: [], limitations: ['Missing required query param: topic'] },
        generatedAt: new Date().toISOString(),
        limitations: ['Missing required query param: topic'],
      },
      { status: 400 },
    );
  }
  const rawDays = Number(req.nextUrl.searchParams.get('days') ?? '7');
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 30) : 7;
  const minStrength = parseLevel(req.nextUrl.searchParams.get('minStrength'));
  const includeSymbols = parseBool(req.nextUrl.searchParams.get('includeSymbols'), true);
  const cacheKey = `events:theme-linkage:v1:t=${topic}:d=${days}:s=${minStrength}:sym=${includeSymbols}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [linkage, graph] = await Promise.all([
    generateThemeLinkage({ topic, days, minStrength, includeSymbols }),
    generateSectorRelationGraph({ topic, days, minStrength: minStrength === 'strong' ? 3 : minStrength === 'moderate' ? 2 : 1, includeSymbols }),
  ]);
  const result = {
    topic,
    linkage,
    graph,
    generatedAt: new Date().toISOString(),
    limitations: [...linkage.limitations, ...graph.limitations],
  };
  apiCache.set(cacheKey, result, 120);
  return NextResponse.json(result);
}
