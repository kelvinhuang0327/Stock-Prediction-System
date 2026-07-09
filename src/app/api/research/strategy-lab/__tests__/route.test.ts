type MockResponse = {
  body: unknown;
  status: number;
};

const execFileMock = jest.fn();

jest.mock("node:child_process", () => ({ execFile: execFileMock }));
jest.mock("node:util", () => ({ promisify: () => execFileMock }));
jest.mock("@/lib/research/strategyLabArtifacts", () => ({
  readStrategyLabSnapshot: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }): MockResponse => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}));

function request(headers: Record<string, string> = {}) {
  return {
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => ({ action: "rerun-refit" }),
  } as unknown as import("next/server").NextRequest;
}

describe("Strategy Lab rerun authorization", () => {
  let GET: typeof import("../route").GET;
  let POST: typeof import("../route").POST;

  beforeAll(async () => {
    ({ GET, POST } = await import("../route"));
  });

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    execFileMock.mockReset();
  });

  it("returns an expanded resolved sample from GET when artifact validation passes", async () => {
    const { readStrategyLabSnapshot } = await import("@/lib/research/strategyLabArtifacts");
    (readStrategyLabSnapshot as jest.Mock).mockResolvedValue({
      artifactSetStatus: "complete",
      predictions: {
        recentResolved: Array.from({ length: 41 }, (_, index) => ({
          symbol: "0050",
          featureDate: `2026-06-${String(index + 1).padStart(2, "0")}`,
          targetDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
        })),
      },
    });

    const response = await GET() as unknown as MockResponse;
    expect(response.status).toBe(200);
    expect((response.body as { predictions: { recentResolved: unknown[] } }).predictions.recentResolved.length)
      .toBeGreaterThan(40);
  });

  it("rejects POST when CRON_SECRET is not configured", async () => {
    const response = await POST(request()) as unknown as MockResponse;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Unauthorized" });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token without running refit", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const response = await POST(request({ authorization: "Bearer wrong-secret" })) as unknown as MockResponse;
    expect(response.status).toBe(401);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("accepts the repository x-cron-secret convention", async () => {
    process.env.CRON_SECRET = "expected-secret";
    execFileMock.mockResolvedValue({ stdout: "{}", stderr: "" });
    const { readStrategyLabSnapshot } = await import("@/lib/research/strategyLabArtifacts");
    (readStrategyLabSnapshot as jest.Mock).mockResolvedValue({ artifactSetStatus: "complete" });

    const response = await POST(request({ "x-cron-secret": "expected-secret" })) as unknown as MockResponse;
    expect(response.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });
});
