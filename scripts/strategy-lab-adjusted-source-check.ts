import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  REQUIRED_PROMOTION_ELIGIBILITY,
  TwseAdjustedOhlcvSourceAdapter,
  createTwseQualificationFixtureFetch,
  parseCommittedQualificationObservations,
  runAdjustedOhlcvSourceQualification,
  serializeQualificationResult,
  type ExecutionMode,
  type InjectedFetch,
} from "../src/lib/research/AdjustedOhlcvSourceQualification";

const COMMITTED_INPUT_PATH = path.resolve(
  process.cwd(),
  "outputs/retraining/p194_twstock_ohlcv_export.csv",
);
const FIXTURE_FETCHED_AT = "2025-06-18T10:05:00.000Z";

function writeCliFailure(executionMode: ExecutionMode, reason: string): void {
  process.stderr.write(`${JSON.stringify({
    qualificationStatus: "BLOCKED",
    executionMode,
    promotionEligibility: REQUIRED_PROMOTION_ELIGIBILITY,
    blockReasons: [reason],
  })}\n`);
  process.exitCode = 1;
}

function livePublicFetch(): InjectedFetch {
  return async (url, init) => {
    const response = await fetch(url, {
      method: init.method,
      headers: init.headers,
      credentials: "omit",
      redirect: "error",
    });
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text: () => response.text(),
    };
  };
}

async function main(): Promise<void> {
  const argument = process.argv[2] ?? "--fixture";
  const executionMode: ExecutionMode = argument === "--live-probe"
    ? "LIVE_PROBE"
    : "FIXTURE";
  if ((argument !== "--fixture" && argument !== "--live-probe")
    || process.argv.length > 3) {
    writeCliFailure(executionMode, "CLI_USAGE_ERROR");
    return;
  }

  try {
    const committedInput = await readFile(COMMITTED_INPUT_PATH);
    const committedObservations = parseCommittedQualificationObservations(committedInput);
    const adapter = new TwseAdjustedOhlcvSourceAdapter({
      executionMode,
      fetchFn: executionMode === "FIXTURE"
        ? createTwseQualificationFixtureFetch()
        : livePublicFetch(),
      now: executionMode === "FIXTURE"
        ? () => new Date(FIXTURE_FETCHED_AT)
        : () => new Date(),
    });
    const result = await runAdjustedOhlcvSourceQualification({
      adapter,
      committedObservations,
      executionMode,
    });
    const serialized = serializeQualificationResult(result);
    if (result.qualificationStatus === "PASS") {
      process.stdout.write(`${serialized}\n`);
      return;
    }
    process.stderr.write(`${serialized}\n`);
    process.exitCode = 1;
  } catch {
    writeCliFailure(executionMode, "CLI_EXECUTION_FAILURE");
  }
}

void main();
