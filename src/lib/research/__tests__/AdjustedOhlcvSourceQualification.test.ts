import { createHash } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  AUTHORIZED_INPUT_SHA256,
  REQUIRED_PROMOTION_ELIGIBILITY,
  SOURCE_CANDIDATE_EVALUATIONS,
  TWSE_QUALIFICATION_ENDPOINTS,
  TWSE_QUALIFICATION_FIXTURE_PAYLOADS,
  AdjustedOhlcvQualificationError,
  TwseAdjustedOhlcvSourceAdapter,
  calculateCloseToCloseReturn,
  classifyPointInTimeStatus,
  createTwseQualificationFixtureFetch,
  normalizeTwseSplitReferencePayload,
  parseCommittedQualificationObservations,
  rawPayloadSha256,
  runAdjustedOhlcvSourceQualification,
  serializeQualificationResult,
  verifyRawPayloadSha256,
  type CommittedObservation,
  type DatasetIdentifier,
  type FetchRequestInitLike,
  type InjectedFetch,
  type QualificationResult,
} from "../AdjustedOhlcvSourceQualification";

jest.setTimeout(120_000);

const ROOT = process.cwd();
const CLI_PATH = path.join(ROOT, "scripts/strategy-lab-adjusted-source-check.ts");
const CORE_PATH = path.join(
  ROOT,
  "src/lib/research/AdjustedOhlcvSourceQualification.ts",
);
const FIXED_FETCHED_AT = "2025-06-18T10:05:00.000Z";
const COMMITTED_OBSERVATIONS: readonly CommittedObservation[] = [
  { symbol: "0050", tradingDate: "2025-06-10", rawClose: 188.65 },
  { symbol: "0050", tradingDate: "2025-06-18", rawClose: 47.57 },
  { symbol: "2330", tradingDate: "2025-06-10", rawClose: 1045 },
  { symbol: "2330", tradingDate: "2025-06-18", rawClose: 1055 },
];

interface MutableTwseReport {
  stat: string;
  fields: string[];
  data: string[][];
  [key: string]: unknown;
}

function mutatePayload(
  rawPayload: string,
  mutate: (report: MutableTwseReport) => void,
): string {
  const report = JSON.parse(rawPayload) as MutableTwseReport;
  mutate(report);
  return JSON.stringify(report);
}

function splitOverride(
  mutate: (report: MutableTwseReport) => void,
): Partial<Record<DatasetIdentifier, string>> {
  return {
    "TWSE_TWTCAU_2025-06-18": mutatePayload(
      TWSE_QUALIFICATION_FIXTURE_PAYLOADS.splitReference,
      mutate,
    ),
  };
}

function price0050Override(
  mutate: (report: MutableTwseReport) => void,
): Partial<Record<DatasetIdentifier, string>> {
  return {
    "TWSE_STOCK_DAY_0050_2025-06": mutatePayload(
      TWSE_QUALIFICATION_FIXTURE_PAYLOADS.stockDay0050,
      mutate,
    ),
  };
}

function fixtureAdapter(
  overrides: Partial<Record<DatasetIdentifier, string>> = {},
  fetchFn: InjectedFetch = createTwseQualificationFixtureFetch(overrides),
  expectedPayloadHashes: Partial<Record<DatasetIdentifier, string>> = {},
): TwseAdjustedOhlcvSourceAdapter {
  return new TwseAdjustedOhlcvSourceAdapter({
    executionMode: "FIXTURE",
    fetchFn,
    expectedPayloadHashes,
    now: () => new Date(FIXED_FETCHED_AT),
  });
}

async function runFixture(
  overrides: Partial<Record<DatasetIdentifier, string>> = {},
  committedObservations: readonly CommittedObservation[] = COMMITTED_OBSERVATIONS,
): Promise<QualificationResult> {
  return runAdjustedOhlcvSourceQualification({
    adapter: fixtureAdapter(overrides),
    committedObservations,
    executionMode: "FIXTURE",
  });
}

function resolveTsNodeBin(): string {
  const candidates = [
    path.join(ROOT, "node_modules/ts-node/dist/bin.js"),
    path.join(ROOT, "../Stock-Prediction-System/node_modules/ts-node/dist/bin.js"),
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) throw new Error("ts-node executable is unavailable for CLI verification");
  return resolved;
}

function runCli(arguments_: readonly string[]): SpawnSyncReturns<string> {
  const tsNodeBin = resolveTsNodeBin();
  const nodeModulesRoot = path.resolve(path.dirname(tsNodeBin), "../..");
  return spawnSync(process.execPath, [tsNodeBin, CLI_PATH, ...arguments_], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      NODE_PATH: nodeModulesRoot,
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({
        module: "commonjs",
        moduleResolution: "node",
        typeRoots: [path.join(nodeModulesRoot, "@types")],
      }),
    },
    maxBuffer: 5 * 1024 * 1024,
  });
}

function gitStatus(): string {
  const result = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("git status failed");
  return result.stdout;
}

function protectedTrackedDigest(): string {
  const listing = spawnSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (listing.status !== 0) throw new Error("git ls-files failed");
  const protectedPattern = /(^outputs\/retraining\/)|(^|\/)(db|database|backup|backups|fixture|fixtures)(\/|$)|\.(db|sqlite|sqlite3)(-wal|-shm)?$/;
  const paths = listing.stdout.split("\0")
    .filter((relativePath) => relativePath !== "" && protectedPattern.test(relativePath))
    .sort();
  const digest = createHash("sha256");
  for (const relativePath of paths) {
    digest.update(relativePath);
    digest.update("\0");
    digest.update(readFileSync(path.join(ROOT, relativePath)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

describe("AdjustedOhlcvSourceQualification", () => {
  it("normalizes source responses deterministically", async () => {
    const first = await fixtureAdapter().fetchSnapshot();
    const second = await fixtureAdapter().fetchSnapshot();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.requestInventory).toHaveLength(3);
    expect(first.requestInventory.map((request) => request.url)).toEqual([
      TWSE_QUALIFICATION_ENDPOINTS.splitReference,
      TWSE_QUALIFICATION_ENDPOINTS.stockDay0050,
      TWSE_QUALIFICATION_ENDPOINTS.stockDay2330,
    ]);
    expect(first.records.map((record) => ({
      symbol: record.symbol,
      tradingDate: record.tradingDate,
      rawClose: record.rawClose,
      adjustedClose: record.adjustedClose,
    }))).toEqual([
      { symbol: "0050", tradingDate: "2025-06-10", rawClose: 188.65, adjustedClose: 47.16 },
      { symbol: "0050", tradingDate: "2025-06-18", rawClose: 47.57, adjustedClose: 47.57 },
      { symbol: "2330", tradingDate: "2025-06-10", rawClose: 1045, adjustedClose: 1045 },
      { symbol: "2330", tradingDate: "2025-06-18", rawClose: 1055, adjustedClose: 1055 },
    ]);
  });

  it("strictly rejects missing required fields and invalid numeric values", async () => {
    const missingField = splitOverride((report) => {
      const index = report.fields.indexOf("恢復買賣參考價");
      report.fields.splice(index, 1);
      report.data.forEach((row) => row.splice(index, 1));
    });
    const invalidNumeric = price0050Override((report) => {
      const closeIndex = report.fields.indexOf("收盤價");
      report.data[0][closeIndex] = "not-a-number";
    });
    expect((await runFixture(missingField)).blockReasons[0]).toMatch(
      /^MISSING_REQUIRED_FIELD:/,
    );
    expect((await runFixture(invalidNumeric)).blockReasons[0]).toMatch(
      /^INVALID_NUMERIC_FIELD:/,
    );
  });

  it("verifies source payload SHA256 before normalization", async () => {
    const payload = TWSE_QUALIFICATION_FIXTURE_PAYLOADS.splitReference;
    const expected = rawPayloadSha256(payload);
    expect(verifyRawPayloadSha256(payload, expected)).toBe(expected);
    expect(() => verifyRawPayloadSha256(payload, "0".repeat(64))).toThrow(
      /^PAYLOAD_SHA256_MISMATCH:/,
    );
    const result = await runAdjustedOhlcvSourceQualification({
      adapter: fixtureAdapter({}, undefined, {
        "TWSE_TWTCAU_2025-06-18": "0".repeat(64),
      }),
      committedObservations: COMMITTED_OBSERVATIONS,
      executionMode: "FIXTURE",
    });
    expect(result.blockReasons[0]).toMatch(/^PAYLOAD_SHA256_MISMATCH:/);
  });

  it("requires corporate-action effective-date alignment", async () => {
    const result = await runFixture(splitOverride((report) => {
      report.data[0][0] = "114/06/19";
    }));
    expect(result.qualificationStatus).toBe("BLOCKED");
    expect(result.blockReasons[0]).toMatch(/^EVENT_EFFECTIVE_DATE_MISALIGNED:/);
  });

  it("derives and applies the adjustment factor from source prices", async () => {
    const snapshot = await fixtureAdapter().fetchSnapshot();
    const event = snapshot.events[0];
    const prior = snapshot.records.find((record) =>
      record.symbol === "0050" && record.tradingDate === "2025-06-10");
    const next = snapshot.records.find((record) =>
      record.symbol === "0050" && record.tradingDate === "2025-06-18");
    expect(event.adjustmentFactor).toBeCloseTo(47.16 / 188.65, 12);
    expect(prior?.adjustmentFactor).toBe(event.adjustmentFactor);
    expect(prior?.adjustedClose).toBe(47.16);
    expect(next?.adjustmentFactor).toBe(1);
    expect(next?.adjustedClose).toBe(47.57);
  });

  it("calculates the adjusted event return below the existing threshold", () => {
    expect(calculateCloseToCloseReturn(188.65, 47.57)).toBe(-0.74783992);
    expect(calculateCloseToCloseReturn(47.16, 47.57)).toBe(0.00869381);
  });

  it("reconciles the 0050 fixture discontinuity while retaining the promotion block", async () => {
    const result = await runFixture();
    expect(result.qualificationStatus).toBe("PASS");
    expect(result["0050Reconciliation"]).toMatchObject({
      status: "RECONCILED",
      effectiveDate: "2025-06-18",
      corporateActionType: "ETF_SPLIT",
      committedPriorRawClose: 188.65,
      committedNextRawClose: 47.57,
      sourceReferenceAdjustedClose: 47.16,
      adjustedCloseToCloseReturn: 0.00869381,
      reconciledBelowThreshold: true,
    });
    expect(result.promotionEligibility).toBe(
      "BLOCKED_PENDING_ADJUSTED_SOURCE_REFIT",
    );
  });

  it("fails closed when adjustment metadata is missing", async () => {
    const result = await runFixture(splitOverride((report) => {
      report.data = [];
    }));
    expect(result.qualificationStatus).toBe("BLOCKED");
    expect(result.blockReasons[0]).toMatch(/^MISSING_ADJUSTMENT_METADATA:/);
  });

  it("fails closed on conflicting event factors", async () => {
    const result = await runFixture(splitOverride((report) => {
      const conflicting = [...report.data[0]];
      conflicting[5] = "47.17";
      report.data.push(conflicting);
    }));
    expect(result.qualificationStatus).toBe("BLOCKED");
    expect(result.blockReasons[0]).toMatch(/^CONFLICTING_EVENT_FACTORS:/);
  });

  it("does not mark missing publication evidence as PIT_PROVEN", () => {
    expect(classifyPointInTimeStatus([
      {
        sourcePublicationAvailabilityTimestamp: "2025-06-17T03:35:21.000Z",
        timestampEvidence: "HISTORICAL_PUBLICATION",
        evidenceIdentifier: "event",
      },
      {
        sourcePublicationAvailabilityTimestamp: null,
        timestampEvidence: "NONE",
        evidenceIdentifier: "price",
      },
    ], FIXED_FETCHED_AT)).toBe("PIT_PARTIALLY_PROVEN");
  });

  it("rejects future publication evidence for an earlier as-of timestamp", () => {
    expect(() => classifyPointInTimeStatus([{
      sourcePublicationAvailabilityTimestamp: "2025-06-18T10:06:00.000Z",
      timestampEvidence: "HISTORICAL_PUBLICATION",
      evidenceIdentifier: "future-event",
    }], FIXED_FETCHED_AT)).toThrow(/^FUTURE_PUBLICATION_FOR_AS_OF:/);
  });

  it("keeps 2330 as an unadjusted control with no fabricated event", async () => {
    const result = await runFixture();
    expect(result["2330Control"]).toMatchObject({
      status: "PASS",
      corporateActionReported: false,
      adjustmentFactor: 1,
      fabricatedEvent: false,
    });
    const records = result.sourceProvenance.normalizedRecords
      .filter((record) => record.symbol === "2330");
    expect(records.every((record) =>
      record.corporateActionType === null
      && record.adjustmentFactor === 1
      && record.adjustedClose === record.rawClose)).toBe(true);
  });

  it("fails closed on an unrecognized event type", async () => {
    const result = await runFixture(splitOverride((report) => {
      report.data[0][3] = "現金股利";
    }));
    expect(result.blockReasons[0]).toMatch(/^UNRECOGNIZED_EVENT_TYPE:/);
  });

  it("fails closed on out-of-order and duplicate source records", async () => {
    const outOfOrder = price0050Override((report) => {
      report.data.reverse();
    });
    const duplicate = price0050Override((report) => {
      report.data.splice(1, 0, [...report.data[0]]);
    });
    expect((await runFixture(outOfOrder)).blockReasons[0]).toMatch(
      /^OUT_OF_ORDER_RECORDS:/,
    );
    expect((await runFixture(duplicate)).blockReasons[0]).toMatch(
      /^DUPLICATE_RECORD:/,
    );
  });

  it("turns network errors and rate limits into deterministic blocked output", async () => {
    const networkResult = async (detail: string): Promise<string> => {
      const networkFetch: InjectedFetch = async () => {
        throw new Error(detail);
      };
      const result = await runAdjustedOhlcvSourceQualification({
        adapter: fixtureAdapter({}, networkFetch),
        committedObservations: COMMITTED_OBSERVATIONS,
        executionMode: "FIXTURE",
      });
      return serializeQualificationResult(result);
    };
    expect(await networkResult("first transport detail")).toBe(
      await networkResult("different transport detail"),
    );
    expect(JSON.parse(await networkResult("ignored")).blockReasons[0]).toBe(
      "TWSE_NETWORK_ERROR:TWSE_TWTCAU_2025-06-18",
    );

    const rateLimitedFetch: InjectedFetch = async () => ({
      ok: false,
      status: 429,
      async text(): Promise<string> {
        return "rate limited";
      },
    });
    const rateLimited = await runAdjustedOhlcvSourceQualification({
      adapter: fixtureAdapter({}, rateLimitedFetch),
      committedObservations: COMMITTED_OBSERVATIONS,
      executionMode: "FIXTURE",
    });
    expect(rateLimited.qualificationStatus).toBe("BLOCKED");
    expect(rateLimited.blockReasons[0]).toBe(
      "TWSE_RATE_LIMITED:TWSE_TWTCAU_2025-06-18",
    );
  });

  it("never reads credentials or places credential-bearing headers on requests", async () => {
    const requests: Array<{ url: string; init: FetchRequestInitLike }> = [];
    const fixtureFetch = createTwseQualificationFixtureFetch();
    const inspectingFetch: InjectedFetch = async (url, init) => {
      requests.push({ url, init });
      return fixtureFetch(url, init);
    };
    const snapshot = await fixtureAdapter({}, inspectingFetch).fetchSnapshot();
    expect(snapshot.requestInventory).toHaveLength(3);
    expect(requests).toHaveLength(3);
    expect(requests.every(({ url, init }) =>
      url.startsWith("https://www.twse.com.tw/")
      && init.method === "GET"
      && JSON.stringify(init.headers) === JSON.stringify({ Accept: "application/json" }))).toBe(true);
    const implementation = `${readFileSync(CORE_PATH, "utf8")}\n${readFileSync(CLI_PATH, "utf8")}`;
    expect(implementation).not.toMatch(/process[.]env|Authorization|\bCookie\b/);
  });

  it("performs no filesystem write", async () => {
    const statusBefore = gitStatus();
    const protectedBefore = protectedTrackedDigest();
    expect((await runFixture()).qualificationStatus).toBe("PASS");
    const cli = runCli(["--fixture"]);
    expect(cli.status).toBe(0);
    expect(gitStatus()).toBe(statusBefore);
    expect(protectedTrackedDigest()).toBe(protectedBefore);
    const implementation = `${readFileSync(CORE_PATH, "utf8")}\n${readFileSync(CLI_PATH, "utf8")}`;
    expect(implementation).not.toMatch(
      /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|rename|renameSync)\b/,
    );
  });

  it("produces byte-identical JSON across two fixture qualification runs", async () => {
    const first = serializeQualificationResult(await runFixture());
    const second = serializeQualificationResult(await runFixture());
    expect(second).toBe(first);
    expect(createHash("sha256").update(first).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("prints exactly one JSON object to stdout on CLI success", () => {
    const execution = runCli(["--fixture"]);
    expect(execution.status).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout.endsWith("\n")).toBe(true);
    expect(execution.stdout.trimEnd().split("\n")).toHaveLength(1);
    const parsed = JSON.parse(execution.stdout) as QualificationResult;
    expect(parsed.qualificationStatus).toBe("PASS");
    expect(parsed.promotionEligibility).toBe(REQUIRED_PROMOTION_ELIGIBILITY);
  });

  it("uses stderr and a nonzero exit for CLI failures", () => {
    const execution = runCli(["--unsupported"]);
    expect(execution.status).not.toBe(0);
    expect(execution.stdout).toBe("");
    expect(execution.stderr.trimEnd().split("\n")).toHaveLength(1);
    expect(JSON.parse(execution.stderr)).toEqual({
      qualificationStatus: "BLOCKED",
      executionMode: "FIXTURE",
      promotionEligibility: REQUIRED_PROMOTION_ELIGIBILITY,
      blockReasons: ["CLI_USAGE_ERROR"],
    });
  });

  it("reports both values and fails closed when committed raw data conflicts", async () => {
    const conflicting = COMMITTED_OBSERVATIONS.map((observation) =>
      observation.symbol === "0050" && observation.tradingDate === "2025-06-18"
        ? { ...observation, rawClose: 47.58 }
        : observation);
    const result = await runFixture({}, conflicting);
    expect(result.qualificationStatus).toBe("BLOCKED");
    expect(result.blockReasons[0]).toContain("committed=47.58:source=47.57");
  });

  it("pins the authorized committed input and records accepted and rejected candidates", () => {
    const committedInput = readFileSync(
      path.join(ROOT, "outputs/retraining/p194_twstock_ohlcv_export.csv"),
    );
    expect(rawPayloadSha256(committedInput.toString("utf8"))).toBe(
      AUTHORIZED_INPUT_SHA256,
    );
    expect(parseCommittedQualificationObservations(committedInput)).toEqual(
      COMMITTED_OBSERVATIONS,
    );
    expect(SOURCE_CANDIDATE_EVALUATIONS.map(({ sourceName, decision }) => ({
      sourceName,
      decision,
    }))).toEqual([
      {
        sourceName: "TWSE split-reference and STOCK_DAY reports",
        decision: "ACCEPTED",
      },
      { sourceName: "FinMind TaiwanStockPriceAdj", decision: "REJECTED" },
    ]);
  });

  it("normalizes the official split event with traceable publication evidence", () => {
    const events = normalizeTwseSplitReferencePayload(
      TWSE_QUALIFICATION_FIXTURE_PAYLOADS.splitReference,
      {
        fetchedAtTimestamp: FIXED_FETCHED_AT,
        rawPayloadSha256: rawPayloadSha256(
          TWSE_QUALIFICATION_FIXTURE_PAYLOADS.splitReference,
        ),
      },
    );
    expect(events).toEqual([expect.objectContaining({
      symbol: "0050",
      corporateActionType: "ETF_SPLIT",
      effectiveDate: "2025-06-18",
      preEventRawClose: 188.65,
      sourceReferenceAdjustedClose: 47.16,
      sourcePublicationAvailabilityTimestamp: "2025-06-17T03:35:21.000Z",
      timestampEvidence: "HISTORICAL_PUBLICATION",
    })]);
  });

  it("uses canonical qualification errors for invalid committed input hashes", () => {
    expect(() => parseCommittedQualificationObservations(
      "symbol,date,close\n0050,2025-06-10,188.65\n",
    )).toThrow(AdjustedOhlcvQualificationError);
  });
});
