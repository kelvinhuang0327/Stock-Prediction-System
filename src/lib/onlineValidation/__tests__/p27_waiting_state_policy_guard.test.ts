/**
 * P27 Waiting-State Policy Guard Tests
 *
 * Validates that governance artifacts correctly reflect the P26F4 waiting state.
 * All tests are READ-ONLY — no DB writes, no corpus changes, no scoring changes.
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../../../");
const FREEZE_MARKER = path.join(
  ROOT,
  "outputs/online_validation/p26f4_waiting_state_freeze_marker.json"
);
const PHASE_INDEX = path.join(
  ROOT,
  "outputs/online_validation/PHASE_INDEX.md"
);
const NEXT_PROMPT = path.join(
  ROOT,
  "outputs/online_validation/p26_next_prompt_source_arrival_only.md"
);
const PHASE_REGISTRY = path.join(
  ROOT,
  "outputs/online_validation/p26_phase_chain_registry.json"
);
const WAITING_POLICY = path.join(
  ROOT,
  "docs/manual-data/monthly-revenue/P26F4_WAITING_STATE_POLICY.md"
);
const GOVERNANCE_NEXT_ACTIONS = path.join(
  ROOT,
  "outputs/online_validation/p26_governance_next_actions.md"
);

describe("P27 Waiting-State Policy Guard", () => {
  // 1. Freeze marker exists
  it("freeze marker file exists", () => {
    expect(fs.existsSync(FREEZE_MARKER)).toBe(true);
  });

  // 2. currentState = P26F4_WAITING_FOR_OPERATOR_SOURCE
  it("currentState is P26F4_WAITING_FOR_OPERATOR_SOURCE", () => {
    const marker = JSON.parse(fs.readFileSync(FREEZE_MARKER, "utf-8"));
    expect(marker.currentState).toBe("P26F4_WAITING_FOR_OPERATOR_SOURCE");
  });

  // 3. candidateSourceFiles = 0
  it("candidateSourceFiles is 0", () => {
    const marker = JSON.parse(fs.readFileSync(FREEZE_MARKER, "utf-8"));
    expect(marker.candidateSourceFiles).toBe(0);
  });

  // 4. corpusExpansion = blocked
  it("corpusExpansion is blocked", () => {
    const marker = JSON.parse(fs.readFileSync(FREEZE_MARKER, "utf-8"));
    expect(marker.corpusExpansion).toBe("blocked");
  });

  // 5. optimizer = blocked
  it("optimizer is blocked", () => {
    const marker = JSON.parse(fs.readFileSync(FREEZE_MARKER, "utf-8"));
    expect(marker.optimizer).toBe("blocked");
  });

  // 6. repeatedEmptyScanPolicy exists and is not permissive
  it("repeatedEmptyScanPolicy exists and is restrictive", () => {
    const marker = JSON.parse(fs.readFileSync(FREEZE_MARKER, "utf-8"));
    expect(marker.repeatedEmptyScanPolicy).toBeDefined();
    expect(marker.repeatedEmptyScanPolicy).toContain("DO_NOT_SCHEDULE");
  });

  // 7. next prompt contains source-arrival-only trigger
  it("source-arrival-only prompt exists", () => {
    expect(fs.existsSync(NEXT_PROMPT)).toBe(true);
  });

  it("source-arrival-only prompt contains trigger condition", () => {
    const content = fs.readFileSync(NEXT_PROMPT, "utf-8");
    expect(content).toMatch(/source.*arrival|operator.*confirms|source files.*placed/i);
  });

  // 8. PHASE_INDEX marks P26F4 as waiting
  it("PHASE_INDEX.md exists", () => {
    expect(fs.existsSync(PHASE_INDEX)).toBe(true);
  });

  it("PHASE_INDEX.md marks P26F4 as waiting", () => {
    const content = fs.readFileSync(PHASE_INDEX, "utf-8");
    expect(content).toMatch(/P26F4.*WAITING|WAITING.*P26F4/i);
  });

  // 9. phase registry does not mark P26F4 as import-ready
  it("phase registry exists", () => {
    expect(fs.existsSync(PHASE_REGISTRY)).toBe(true);
  });

  it("phase registry marks P26F4 as BLOCKED_BY_OPERATOR_SOURCE not import-ready", () => {
    const registry = JSON.parse(fs.readFileSync(PHASE_REGISTRY, "utf-8"));
    const p26f4Import = registry.chains?.P26F4_import ?? "";
    expect(p26f4Import).toMatch(/BLOCKED/i);
    expect(p26f4Import).not.toMatch(/COMPLETE|IMPORT_READY/i);
  });

  // 10. No forbidden investment claims in governance artifacts
  it("freeze marker has no forbidden investment claims", () => {
    const content = fs.readFileSync(FREEZE_MARKER, "utf-8").toLowerCase();
    const forbidden = ["buy", "sell", "guaranteed", "win-rate", "outperform"];
    for (const term of forbidden) {
      expect(content).not.toContain(term);
    }
  });

  it("PHASE_INDEX has no forbidden investment claims", () => {
    const content = fs.readFileSync(PHASE_INDEX, "utf-8").toLowerCase();
    const forbidden = ["buy", "sell", "guaranteed", "win-rate", "outperform"];
    for (const term of forbidden) {
      expect(content).not.toContain(term);
    }
  });

  it("waiting state policy doc exists", () => {
    expect(fs.existsSync(WAITING_POLICY)).toBe(true);
  });

  it("governance next actions doc exists", () => {
    expect(fs.existsSync(GOVERNANCE_NEXT_ACTIONS)).toBe(true);
  });

  // DB / corpus must remain unchanged (no-write guard)
  it("prisma dev.db has correct baseline SHA256", () => {
    const { execSync } = require("child_process");
    const result = execSync(
      `shasum -a 256 "${path.join(ROOT, "prisma/dev.db")}"`,
      { encoding: "utf-8" }
    ).trim();
    expect(result).toContain(
      "a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8"
    );
  });

  it("simulation corpus has 60 lines", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "outputs/online_validation/simulation_snapshot_corpus.jsonl"),
      "utf-8"
    );
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(60);
  });
});
