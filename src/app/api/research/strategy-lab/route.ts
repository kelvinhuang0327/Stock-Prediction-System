import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

import { readStrategyLabSnapshot } from "@/lib/research/strategyLabArtifacts";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type StrategyLabAction = "rerun-refit";

function isStrategyLabAction(value: unknown): value is StrategyLabAction {
  return value === "rerun-refit";
}

export async function GET(): Promise<NextResponse> {
  const snapshot = await readStrategyLabSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : request.headers.get("x-cron-secret");

  // Refit writes durable artifacts. Keep the endpoint default-deny and reuse the
  // same CRON_SECRET bearer convention as the repository's other task routes.
  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).action
    : null;

  if (!isStrategyLabAction(action)) {
    return NextResponse.json({
      ok: false,
      error: "Unsupported action",
      validActions: ["rerun-refit"],
    }, { status: 400 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await execFileAsync(
      "./node_modules/.bin/ts-node",
      ["scripts/p193_real_ohlcv_refit.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TS_NODE_COMPILER_OPTIONS: "{\"module\":\"commonjs\"}",
        },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      },
    );
    const snapshot = await readStrategyLabSnapshot();
    return NextResponse.json({
      ok: true,
      action,
      startedAt,
      finishedAt: new Date().toISOString(),
      stdout: result.stdout,
      stderr: result.stderr,
      snapshot,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const snapshot = await readStrategyLabSnapshot();
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      action,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: detail,
      snapshot,
    }, { status: 500 });
  }
}
