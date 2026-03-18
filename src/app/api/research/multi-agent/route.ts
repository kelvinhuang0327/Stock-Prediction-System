/**
 * POST /api/research/multi-agent
 *
 * L3 Research Layer — explainability, scenario notes, risk debate.
 * Does NOT affect alphaScore, screen, backtest, or risk model.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runMultiAgentResearch,
  type ResearchInput,
  type ResearchResult,
} from '@/lib/research/MultiAgentResearchEngine';

export interface MultiAgentResponse extends ResearchResult {
  symbol: string | null;
  dataCoverage: string;
  last_updated: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<MultiAgentResponse | { error: string }>> {
  let body: Partial<ResearchInput> & { symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  const {
    symbol = null,
    marketRegime,
    alphaScore,
    bucket,
    confidence,
    dataCoverage,
    technicalScore,
    chipScore,
    fundamentalScore,
    marketAdjustment,
    regimeConfidence,
    usedSources,
    missingSources,
    limitations,
  } = body as any;

  if (
    marketRegime === undefined ||
    alphaScore === undefined ||
    bucket === undefined ||
    confidence === undefined ||
    dataCoverage === undefined ||
    technicalScore === undefined ||
    chipScore === undefined ||
    fundamentalScore === undefined ||
    marketAdjustment === undefined
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: marketRegime, alphaScore, bucket, confidence, dataCoverage, technicalScore, chipScore, fundamentalScore, marketAdjustment' },
      { status: 400 },
    );
  }

  const input: ResearchInput = {
    symbol: symbol ?? undefined,
    marketRegime,
    regimeConfidence: typeof regimeConfidence === 'number' ? regimeConfidence : undefined,
    alphaScore: Number(alphaScore),
    bucket,
    confidence: Number(confidence),
    dataCoverage,
    technicalScore: Number(technicalScore),
    chipScore: Number(chipScore),
    fundamentalScore: Number(fundamentalScore),
    marketAdjustment: Number(marketAdjustment),
    usedSources: Array.isArray(usedSources) ? usedSources : undefined,
    missingSources: Array.isArray(missingSources) ? missingSources : undefined,
    limitations: Array.isArray(limitations) ? limitations : undefined,
  };

  const result = runMultiAgentResearch(input);

  const response: MultiAgentResponse = {
    ...result,
    symbol,
    dataCoverage,
    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(response);
}

// GET is not supported — always needs context data
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Use POST with research context. See API docs.' },
    { status: 405 },
  );
}
