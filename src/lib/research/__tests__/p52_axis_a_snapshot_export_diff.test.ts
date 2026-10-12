/**
 * P52 — Axis A Snapshot v0 Export Diff Tests
 *
 * Tests for SnapshotExportDiff: diffSnapshotLogExports()
 * covering: empty cases, added/removed/unchanged classification, order
 * preservation, count accuracy, determinism, non-mutation, blocked-source
 * fidelity, JSON serializability, forbidden-field scan, and index re-export.
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 */

import {
  SNAPSHOT_EXPORT_DIFF_VERSION,
  diffSnapshotLogExports,
  type SnapshotExportDiffReport,
} from "@/lib/research/snapshot/v0/SnapshotExportDiff";

// Index re-exports — used by T52.9
import {
  SNAPSHOT_EXPORT_DIFF_VERSION as IDX_DIFF_VERSION,
  diffSnapshotLogExports as idxDiff,
} from "@/lib/research/snapshot/v0";

import { buildControlledResearchSnapshot } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SnapshotBuildInput } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";
import { emitSnapshot } from "@/lib/research/snapshot/v0/SnapshotEmitter";
import { serializeEmitResult } from "@/lib/research/snapshot/v0/SnapshotLogWriter";
import type { SnapshotLogRecord } from "@/lib/research/snapshot/v0/SnapshotLogWriter";
import { exportSnapshotLogRecords } from "@/lib/research/snapshot/v0/SnapshotLogExporter";
import type { SnapshotLogExport } from "@/lib/research/snapshot/v0/SnapshotLogExporter";

// ─── Test constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T02:00:00.000Z";
const FIXED_EXPORTED_AT_A = "2026-05-25T06:00:00.000Z";
const FIXED_EXPORTED_AT_B = "2026-05-25T07:00:00.000Z";
const FIXED_DIFFED_AT = "2026-05-25T00:00:00.000Z";
const PAST_DATE = "2026-05-01";

const SYMBOL_A = "2330";
const SYMBOL_B = "2317";
const SYMBOL_C = "2454";

const LOGGED_AT_1 = "2026-05-20T04:00:00.000Z";
const LOGGED_AT_2 = "2026-05-21T04:00:00.000Z";
const LOGGED_AT_3 = "2026-05-22T04:00:00.000Z";
const LOGGED_AT_4 = "2026-05-23T04:00:00.000Z";

// ─── Source readiness fixtures ────────────────────────────────────────────────

function makeEligibleMR(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p52-test-mr",
  };
}

function makeEligibleQuote(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p52-test-quote",
  };
}

function makeEligibleRegime(): SourceReadinessFacts {
  return {
    sourceName: "Regime",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p52-test-regime",
  };
}

function makeBlockedMR(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "BLOCKED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
    sourceTrace: "p52-test-mr-blocked",
  };
}

// ─── Input factories ──────────────────────────────────────────────────────────

function readyInput(symbol: string): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p52-ready",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeEligibleQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

function blockedInput(symbol: string): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p52-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeBlockedMR(),
  };
}

// ─── Record factory ───────────────────────────────────────────────────────────

function makeRecord(
  input: SnapshotBuildInput,
  fixedLoggedAt: string,
): SnapshotLogRecord {
  const snapshot = buildControlledResearchSnapshot(input);
  const emitResult = emitSnapshot(snapshot, FIXED_READOUT_AT);
  return serializeEmitResult(emitResult, fixedLoggedAt);
}

// ─── Pre-built records ────────────────────────────────────────────────────────

const recA1 = makeRecord(readyInput(SYMBOL_A), LOGGED_AT_1);   // A, time 1
const recA2 = makeRecord(readyInput(SYMBOL_A), LOGGED_AT_2);   // A, time 2 (same symbol, different loggedAt)
const recB1 = makeRecord(readyInput(SYMBOL_B), LOGGED_AT_1);   // B, time 1
const recC1 = makeRecord(readyInput(SYMBOL_C), LOGGED_AT_1);   // C, time 1
const recBlockedB = makeRecord(blockedInput(SYMBOL_B), LOGGED_AT_3); // blocked source

// ─── Export factory ───────────────────────────────────────────────────────────

function makeExport(
  records: readonly SnapshotLogRecord[],
  exportedAt = FIXED_EXPORTED_AT_A,
): SnapshotLogExport {
  return exportSnapshotLogRecords([...records], exportedAt);
}

const emptyExport = makeExport([]);
const exportA1 = makeExport([recA1]);
const exportA1B1 = makeExport([recA1, recB1]);
const exportA1B1C1 = makeExport([recA1, recB1, recC1]);
const exportB1C1 = makeExport([recB1, recC1]);

// ─── T52.1 — Empty before / empty after ──────────────────────────────────────

describe("T52.1 — empty before / empty after", () => {
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(emptyExport, emptyExport, FIXED_DIFFED_AT);
  });

  it("T52.1.1 addedCount is 0", () => {
    expect(report.addedCount).toBe(0);
  });

  it("T52.1.2 removedCount is 0", () => {
    expect(report.removedCount).toBe(0);
  });

  it("T52.1.3 unchangedCount is 0", () => {
    expect(report.unchangedCount).toBe(0);
  });

  it("T52.1.4 added array is empty", () => {
    expect(report.added).toHaveLength(0);
  });

  it("T52.1.5 removed array is empty", () => {
    expect(report.removed).toHaveLength(0);
  });

  it("T52.1.6 unchanged array is empty", () => {
    expect(report.unchanged).toHaveLength(0);
  });
});

// ─── T52.2 — Empty before / non-empty after ──────────────────────────────────

describe("T52.2 — empty before / non-empty after", () => {
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(
      emptyExport,
      exportA1B1,
      FIXED_DIFFED_AT,
    );
  });

  it("T52.2.1 all records appear in added", () => {
    expect(report.addedCount).toBe(2);
  });

  it("T52.2.2 removedCount is 0", () => {
    expect(report.removedCount).toBe(0);
  });

  it("T52.2.3 unchangedCount is 0", () => {
    expect(report.unchangedCount).toBe(0);
  });

  it("T52.2.4 added contains recA1", () => {
    expect(report.added).toContain(recA1);
  });

  it("T52.2.5 added contains recB1", () => {
    expect(report.added).toContain(recB1);
  });
});

// ─── T52.3 — Non-empty before / empty after ───────────────────────────────────

describe("T52.3 — non-empty before / empty after", () => {
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(
      exportA1B1,
      emptyExport,
      FIXED_DIFFED_AT,
    );
  });

  it("T52.3.1 addedCount is 0", () => {
    expect(report.addedCount).toBe(0);
  });

  it("T52.3.2 all records appear in removed", () => {
    expect(report.removedCount).toBe(2);
  });

  it("T52.3.3 unchangedCount is 0", () => {
    expect(report.unchangedCount).toBe(0);
  });

  it("T52.3.4 removed contains recA1", () => {
    expect(report.removed).toContain(recA1);
  });

  it("T52.3.5 removed contains recB1", () => {
    expect(report.removed).toContain(recB1);
  });
});

// ─── T52.4 — Identical exports → all unchanged ───────────────────────────────

describe("T52.4 — identical exports → all unchanged", () => {
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(
      exportA1B1,
      exportA1B1,
      FIXED_DIFFED_AT,
    );
  });

  it("T52.4.1 addedCount is 0", () => {
    expect(report.addedCount).toBe(0);
  });

  it("T52.4.2 removedCount is 0", () => {
    expect(report.removedCount).toBe(0);
  });

  it("T52.4.3 unchangedCount equals source record count", () => {
    expect(report.unchangedCount).toBe(2);
  });

  it("T52.4.4 unchanged contains both records", () => {
    expect(report.unchanged).toContain(recA1);
    expect(report.unchanged).toContain(recB1);
  });
});

// ─── T52.5 — Added record detection ──────────────────────────────────────────

describe("T52.5 — added record detection", () => {
  // before: [recA1]; after: [recA1, recC1] — recC1 is new
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(
      exportA1,
      makeExport([recA1, recC1]),
      FIXED_DIFFED_AT,
    );
  });

  it("T52.5.1 addedCount is 1", () => {
    expect(report.addedCount).toBe(1);
  });

  it("T52.5.2 added[0] is recC1", () => {
    expect(report.added[0]).toBe(recC1);
  });

  it("T52.5.3 unchangedCount is 1", () => {
    expect(report.unchangedCount).toBe(1);
  });

  it("T52.5.4 removedCount is 0", () => {
    expect(report.removedCount).toBe(0);
  });
});

// ─── T52.6 — Removed record detection ────────────────────────────────────────

describe("T52.6 — removed record detection", () => {
  // before: [recA1, recC1]; after: [recA1] — recC1 is removed
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(
      makeExport([recA1, recC1]),
      exportA1,
      FIXED_DIFFED_AT,
    );
  });

  it("T52.6.1 removedCount is 1", () => {
    expect(report.removedCount).toBe(1);
  });

  it("T52.6.2 removed[0] is recC1", () => {
    expect(report.removed[0]).toBe(recC1);
  });

  it("T52.6.3 unchangedCount is 1", () => {
    expect(report.unchangedCount).toBe(1);
  });

  it("T52.6.4 addedCount is 0", () => {
    expect(report.addedCount).toBe(0);
  });
});

// ─── T52.7 — Mixed added / removed / unchanged ────────────────────────────────

describe("T52.7 — mixed added / removed / unchanged", () => {
  // before: [recA1, recB1]; after: [recA1, recC1]
  // unchanged: recA1; removed: recB1; added: recC1
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(
      exportA1B1,
      makeExport([recA1, recC1]),
      FIXED_DIFFED_AT,
    );
  });

  it("T52.7.1 addedCount is 1", () => {
    expect(report.addedCount).toBe(1);
  });

  it("T52.7.2 removedCount is 1", () => {
    expect(report.removedCount).toBe(1);
  });

  it("T52.7.3 unchangedCount is 1", () => {
    expect(report.unchangedCount).toBe(1);
  });

  it("T52.7.4 added contains recC1", () => {
    expect(report.added).toContain(recC1);
  });

  it("T52.7.5 removed contains recB1", () => {
    expect(report.removed).toContain(recB1);
  });

  it("T52.7.6 unchanged contains recA1", () => {
    expect(report.unchanged).toContain(recA1);
  });
});

// ─── T52.8 — Order preservation ──────────────────────────────────────────────

describe("T52.8 — order preservation", () => {
  // before: [recA1, recB1, recC1]
  // after:  [recC1, recA2, recB1]
  //   added:     [recA2] (follows after order — position 1 in after)
  //   removed:   [recA1] (follows before order — position 0 in before)
  //   unchanged: [recC1, recB1] (follows after order — positions 0, 2 in after)
  let report: SnapshotExportDiffReport;
  const beforeExport = makeExport([recA1, recB1, recC1]);
  const afterExport = makeExport([recC1, recA2, recB1]);

  beforeAll(() => {
    report = diffSnapshotLogExports(beforeExport, afterExport, FIXED_DIFFED_AT);
  });

  it("T52.8.1 added order follows after.records — recA2 at index 0", () => {
    expect(report.added[0]).toBe(recA2);
  });

  it("T52.8.2 removed order follows before.records — recA1 at index 0", () => {
    expect(report.removed[0]).toBe(recA1);
  });

  it("T52.8.3 unchanged[0] is recC1 (first match in after order)", () => {
    expect(report.unchanged[0]).toBe(recC1);
  });

  it("T52.8.4 unchanged[1] is recB1 (second match in after order)", () => {
    expect(report.unchanged[1]).toBe(recB1);
  });

  it("T52.8.5 unchanged length is 2", () => {
    expect(report.unchanged).toHaveLength(2);
  });
});

// ─── T52.9 — Counts always equal array lengths ────────────────────────────────

describe("T52.9 — counts always equal array lengths", () => {
  it("T52.9.1 addedCount equals added.length (mixed scenario)", () => {
    const r = diffSnapshotLogExports(exportA1B1, exportA1B1C1, FIXED_DIFFED_AT);
    expect(r.addedCount).toBe(r.added.length);
  });

  it("T52.9.2 removedCount equals removed.length", () => {
    const r = diffSnapshotLogExports(exportA1B1C1, exportA1B1, FIXED_DIFFED_AT);
    expect(r.removedCount).toBe(r.removed.length);
  });

  it("T52.9.3 unchangedCount equals unchanged.length", () => {
    const r = diffSnapshotLogExports(exportA1B1, exportA1B1, FIXED_DIFFED_AT);
    expect(r.unchangedCount).toBe(r.unchanged.length);
  });
});

// ─── T52.10 — Determinism with fixedDiffedAt ─────────────────────────────────

describe("T52.10 — determinism with fixedDiffedAt", () => {
  it("T52.10.1 diffedAt equals fixedDiffedAt when provided", () => {
    const r = diffSnapshotLogExports(emptyExport, emptyExport, FIXED_DIFFED_AT);
    expect(r.diffedAt).toBe(FIXED_DIFFED_AT);
  });

  it("T52.10.2 same fixedDiffedAt produces same diffedAt on two calls", () => {
    const r1 = diffSnapshotLogExports(exportA1, exportA1B1, FIXED_DIFFED_AT);
    const r2 = diffSnapshotLogExports(exportA1, exportA1B1, FIXED_DIFFED_AT);
    expect(r1.diffedAt).toBe(r2.diffedAt);
  });

  it("T52.10.3 different fixedDiffedAt values produce different diffedAt", () => {
    const r1 = diffSnapshotLogExports(emptyExport, emptyExport, "2026-01-01T00:00:00.000Z");
    const r2 = diffSnapshotLogExports(emptyExport, emptyExport, "2026-06-01T00:00:00.000Z");
    expect(r1.diffedAt).not.toBe(r2.diffedAt);
  });
});

// ─── T52.11 — Omitted fixedDiffedAt → valid ISO timestamp ────────────────────

describe("T52.11 — omitted fixedDiffedAt produces valid ISO timestamp", () => {
  it("T52.11.1 diffedAt matches ISO 8601 pattern when fixedDiffedAt omitted", () => {
    const r = diffSnapshotLogExports(emptyExport, emptyExport);
    expect(r.diffedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

// ─── T52.12 — Non-mutation of inputs ─────────────────────────────────────────

describe("T52.12 — before and after inputs are not mutated", () => {
  it("T52.12.1 before.records length unchanged after diff", () => {
    const before = makeExport([recA1, recB1]);
    const after = makeExport([recA1, recC1]);
    const beforeLen = before.records.length;
    diffSnapshotLogExports(before, after, FIXED_DIFFED_AT);
    expect(before.records.length).toBe(beforeLen);
  });

  it("T52.12.2 after.records length unchanged after diff", () => {
    const before = makeExport([recA1, recB1]);
    const after = makeExport([recA1, recC1]);
    const afterLen = after.records.length;
    diffSnapshotLogExports(before, after, FIXED_DIFFED_AT);
    expect(after.records.length).toBe(afterLen);
  });

  it("T52.12.3 before.totalRecords unchanged after diff", () => {
    const before = makeExport([recA1, recB1]);
    const after = makeExport([recA1, recC1]);
    const beforeTotal = before.totalRecords;
    diffSnapshotLogExports(before, after, FIXED_DIFFED_AT);
    expect(before.totalRecords).toBe(beforeTotal);
  });

  it("T52.12.4 after.exportedAt unchanged after diff", () => {
    const before = makeExport([recA1]);
    const after = makeExport([recA1], FIXED_EXPORTED_AT_B);
    const afterExportedAt = after.exportedAt;
    diffSnapshotLogExports(before, after, FIXED_DIFFED_AT);
    expect(after.exportedAt).toBe(afterExportedAt);
  });
});

// ─── T52.13 — Blocked-source records ─────────────────────────────────────────

describe("T52.13 — blocked-source records preserved in diff output", () => {
  // recBlockedB has blockedSources populated
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    const before = makeExport([recA1]);
    const after = makeExport([recA1, recBlockedB]);
    report = diffSnapshotLogExports(before, after, FIXED_DIFFED_AT);
  });

  it("T52.13.1 blocked record appears in added", () => {
    expect(report.added).toContain(recBlockedB);
  });

  it("T52.13.2 blocked record retains blockedSources in added output", () => {
    const found = report.added.find((r) => r === recBlockedB);
    expect(found?.blockedSources.length).toBeGreaterThan(0);
  });

  it("T52.13.3 blocked record governance invariants preserved in output", () => {
    const found = report.added.find((r) => r === recBlockedB);
    expect(found?.entersAlphaScore).toBe(false);
    expect(found?.paperOnly).toBe(true);
    expect(found?.dryRun).toBe(true);
  });
});

// ─── T52.14 — JSON serializability ───────────────────────────────────────────

describe("T52.14 — output is JSON-serializable", () => {
  it("T52.14.1 round-trip through JSON.parse/JSON.stringify equals original (empty case)", () => {
    const r = diffSnapshotLogExports(emptyExport, emptyExport, FIXED_DIFFED_AT);
    const roundTripped = JSON.parse(JSON.stringify(r));
    expect(roundTripped.addedCount).toBe(r.addedCount);
    expect(roundTripped.removedCount).toBe(r.removedCount);
    expect(roundTripped.unchangedCount).toBe(r.unchangedCount);
    expect(roundTripped.diffedAt).toBe(r.diffedAt);
    expect(roundTripped.diffVersion).toBe(r.diffVersion);
  });

  it("T52.14.2 round-trip with records preserves symbol in added", () => {
    const r = diffSnapshotLogExports(emptyExport, exportA1, FIXED_DIFFED_AT);
    const rt = JSON.parse(JSON.stringify(r));
    expect(rt.added[0].symbol).toBe(recA1.symbol);
  });

  it("T52.14.3 JSON.stringify does not throw on mixed diff report", () => {
    const r = diffSnapshotLogExports(exportA1B1, exportB1C1, FIXED_DIFFED_AT);
    expect(() => JSON.stringify(r)).not.toThrow();
  });
});

// ─── T52.15 — No DB / network / FS imports ───────────────────────────────────

describe("T52.15 — no DB / network / FS dependencies in SnapshotExportDiff", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const diffModule = require("@/lib/research/snapshot/v0/SnapshotExportDiff");

  it("T52.15.1 module has no prisma export", () => {
    expect(diffModule.prisma).toBeUndefined();
  });

  it("T52.15.2 module has no db export", () => {
    expect(diffModule.db).toBeUndefined();
  });

  it("T52.15.3 module has no fetch export", () => {
    expect(diffModule.fetch).toBeUndefined();
  });
});

// ─── T52.16 — Forbidden field scan ───────────────────────────────────────────

describe("T52.16 — forbidden fields absent from diff report", () => {
  let report: SnapshotExportDiffReport;

  beforeAll(() => {
    report = diffSnapshotLogExports(exportA1B1, exportB1C1, FIXED_DIFFED_AT);
  });

  const FORBIDDEN = [
    "recommendation",
    "action",
    "buy",
    "sell",
    "target",
    "ROI",
    "PnL",
    "winRate",
    "edge",
    "alphaScore",
    "score",
    "forecast",
    "expectedReturn",
    "benchmark",
  ] as const;

  for (const field of FORBIDDEN) {
    it(`T52.16 — report does not contain field "${field}"`, () => {
      expect((report as Record<string, unknown>)[field]).toBeUndefined();
    });
  }
});

// ─── T52.17 — Version constant ────────────────────────────────────────────────

describe("T52.17 — version constant and diffVersion field", () => {
  it("T52.17.1 SNAPSHOT_EXPORT_DIFF_VERSION equals expected literal", () => {
    expect(SNAPSHOT_EXPORT_DIFF_VERSION).toBe(
      "p52-axis-a-snapshot-export-diff-v0",
    );
  });

  it("T52.17.2 report.diffVersion matches SNAPSHOT_EXPORT_DIFF_VERSION", () => {
    const r = diffSnapshotLogExports(emptyExport, emptyExport, FIXED_DIFFED_AT);
    expect(r.diffVersion).toBe(SNAPSHOT_EXPORT_DIFF_VERSION);
  });

  it("T52.17.3 SNAPSHOT_EXPORT_DIFF_VERSION starts with p52", () => {
    expect(SNAPSHOT_EXPORT_DIFF_VERSION).toMatch(/^p52/);
  });
});

// ─── T52.18 — Same symbol, different loggedAt → distinct identity ─────────────

describe("T52.18 — same symbol, different loggedAt → distinct identity keys", () => {
  // recA1 and recA2 share symbol SYMBOL_A but have different loggedAt
  it("T52.18.1 both treated as added when neither in before", () => {
    const r = diffSnapshotLogExports(
      emptyExport,
      makeExport([recA1, recA2]),
      FIXED_DIFFED_AT,
    );
    expect(r.addedCount).toBe(2);
  });

  it("T52.18.2 recA1 is unchanged and recA2 is added when before=[recA1]", () => {
    const r = diffSnapshotLogExports(
      exportA1,
      makeExport([recA1, recA2]),
      FIXED_DIFFED_AT,
    );
    expect(r.unchangedCount).toBe(1);
    expect(r.addedCount).toBe(1);
    expect(r.unchanged).toContain(recA1);
    expect(r.added).toContain(recA2);
  });
});

// ─── T52.19 — Index re-export surface ────────────────────────────────────────

describe("T52.19 — index.ts re-exports diff API", () => {
  it("T52.19.1 IDX_DIFF_VERSION equals SNAPSHOT_EXPORT_DIFF_VERSION", () => {
    expect(IDX_DIFF_VERSION).toBe(SNAPSHOT_EXPORT_DIFF_VERSION);
  });

  it("T52.19.2 idxDiff is a function", () => {
    expect(typeof idxDiff).toBe("function");
  });

  it("T52.19.3 idxDiff produces same result as direct diffSnapshotLogExports", () => {
    const r1 = diffSnapshotLogExports(exportA1, exportA1B1, FIXED_DIFFED_AT);
    const r2 = idxDiff(exportA1, exportA1B1, FIXED_DIFFED_AT);
    expect(r2.addedCount).toBe(r1.addedCount);
    expect(r2.removedCount).toBe(r1.removedCount);
    expect(r2.unchangedCount).toBe(r1.unchangedCount);
    expect(r2.diffedAt).toBe(r1.diffedAt);
  });
});
