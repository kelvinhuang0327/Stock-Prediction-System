# Stock Prediction System Roadmap

Version 2.0 CTO Alignment Update - 2026-05-20  
Owner: Kelvin Huang  
Prepared by: CTO Agent  
Classification: CTO_ROADMAP_UPDATED_WITH_RISKS

> This roadmap is an engineering execution plan for Taiwan stock research, PIT-safe prediction analysis, and paper-only simulation readiness. It is not investment advice, does not authorize automated trading, and does not make performance claims.

## 0. Consolidation Note

The requested target file `00-Plan/roadmap/roadmap.md` did not exist before this update. The historical long-form roadmap remains in `00-StockPlan/roadmap/stock_roadmapPlan_20260504.md` and is treated as the source history rather than overwritten here.

This file is the current CTO execution overlay. It records the latest confirmed state and the P0-P10 order after P29F-Repair.

## 1. Latest Confirmed State

| Area | Status | CTO Read |
| --- | --- | --- |
| Current HEAD | [Confirmed] `1c5a270 P29F-Repair: Fix Quote Chip PIT date normalization` | Current main HEAD contains the trust-root repair. |
| P29A PIT registry | [Confirmed] Complete at `3e02b9d` | Registry exists, but pre-repair Quote/Chip status is now stale. |
| P29B source acquisition plan | [Confirmed] Complete at `cb53516` | FinancialReport and NewsEvent remain `HIGH_RISK_SOURCE_ABSENT`; both `entersAlphaScore=false`. |
| P29C simulation contract | [Confirmed] Complete at `2da1203` | Paper design contract exists; no real backtest and no optimizer. |
| P29D drop-zone scaffold | [Confirmed] Commit `ecd5c86` exists in local branch/worktree refs; [Confirmed] not an ancestor of current `main` | Drop-zone material is present locally, but mainline integration is not confirmed. Treat as completed artifact with integration risk. |
| P29E paper simulation scaffold | [Confirmed] Commit `51d15df` exists in local branch/worktree refs; [Confirmed] not an ancestor of current `main` | P29E evidence exists, but current `main` lacks the P29E files. P29G must preflight scaffold presence. |
| P29F Quote / Regime / Chip PIT audit | [Confirmed] Complete at `0165d79` | Found Quote/Chip ISO-vs-YYYYMMDD PIT gate mismatch. |
| P29F-Repair | [Confirmed] Complete at `1c5a270` | Quote, Regime, and Chip are now `PIT_SAFE_VERIFIED`; `trustRootBlockerRemains=false`. |
| Online validation | [Confirmed] P29F-Repair report says 106 suites / 3181 tests PASS | This review did not rerun the full suite. |
| FinancialReport | [Confirmed] Source absent / source-gated | Must not enter alphaScore; `filingDate` path remains required. |
| NewsEvent | [Confirmed] Source absent / source-gated | Must not enter alphaScore; `publishedAt` must be the PIT gate, not `ingestedAt`. |
| MonthlyRevenue | [Confirmed] `REPAIRED_BUT_SOURCE_GATED` | Still operator-source gated unless official source files and manifest arrive. |

## 2. Roadmap Alignment Audit

| Marker | Item | Assessment |
| --- | --- | --- |
| [Aligned] | P29F and P29F-Repair | CEO-corrected direction was followed: Quote / Regime / Chip trust root was audited and repaired before simulation expansion. |
| [Aligned] | Optimizer restraint | Roadmap continues to block optimizer readiness until dry-run simulation output is validated. |
| [Aligned] | FinancialReport / NewsEvent safety | Both remain source-absent and outside alphaScore. |
| [Drift] | Historical `00-StockPlan` roadmap | The latest visible section still says Quote / Chip / Regime are `AVAILABLE_NEEDS_VALIDATION`; this is outdated after P29F-Repair. |
| [Drift] | P29D/P29E integration | Local commits exist, but they are not ancestors of current `main`; P29G cannot assume files are present without preflight. |
| [Missing] | P29F-Repair completion | Roadmap needed an explicit trust-root-cleared entry. |
| [Missing] | P29G current P0 | Roadmap needed to promote paper simulation runner dry-run expansion after trust-root clearance. |
| [Outdated] | P30-B Quote / Regime / Chip PIT audit as future work | The audit and repair are no longer future items; they are complete for Quote / Regime / Chip. |
| [Blocked] | FinancialReport / NewsEvent source path | Source files are absent; only dry-run gate work is valid when source arrives. |
| [Blocked] | Corpus expansion and optimizer | Both remain blocked until source gates and P29G dry-run outputs are validated. |

## 3. Reordered P0-P10 Execution Plan

| Priority | Item | Status | Gate / Definition of Done |
| --- | --- | --- | --- |
| P0 | P29G Paper Simulation Runner Dry-run Expansion | Ready with preflight | Verify P29E scaffold is present in active branch; runner remains paper-only / dry-run; no DB, corpus, scoring, optimizer, or real backtest mutation; output includes source PIT status and leakage status. |
| P1 | FinancialReport / NewsEvent Source-present Dry-run Gate | Waiting on source | When official source files arrive, validate manifest, filenames, required fields, `filingDate` / `publishedAt`, checksums, and forbidden fields; no direct import; no alphaScore activation. |
| P2 | P26F4 MonthlyRevenue Source-Arrival Fast Lane | Waiting on operator | If official MonthlyRevenue source and manifest arrive, run controlled dry-run route; no production write without explicit approval token. |
| P3 | Post-import Coverage + Corpus Expansion Gate | Blocked by source import | Only after controlled source dry-run/import approval; produce coverage evidence before any corpus expansion. |
| P4 | P29G+ Simulation Output Validation / Leakage Gate Strengthening | Depends on P29G | Ensure output schema is auditable, paper-only, deterministic, and explicitly labels PIT/leakage status. |
| P5 | NewsEvent Integrity Audit + FinancialReport Schema Migration Plan | Waiting on source | Audit `publishedAt` vs `ingestedAt`, mock/real separation, and FinancialReport `filingDate` schema path; plan only unless separately approved. |
| P6 | Optimizer Readiness Gate v1 | Blocked | Do not start until P29G dry-run output, source trust gates, corpus maturity, sample-size, split, and anti-overfit gates pass. |
| P7 | P30-A TSC Triage v1 | Deferred infra | Useful CI signal work, but not current main-axis blocker unless it prevents safe changes. |
| P8 | P27 Housekeeping | Deferred | Keep finite and bounded; must not displace P0/P1 main-axis work. |
| P9 | Scanner Consolidation | Deferred | Valuable governance hardening, but not a current maturity blocker. |
| P10 | Phase Registry Cleanup | Deferred | Run only if registry drift blocks auditability or execution. |

## 4. Items Upgraded, Downgraded, Merged, or Paused

| Change | Item | Decision |
| --- | --- | --- |
| Upgraded to P0 | P29G Paper Simulation Runner Dry-run Expansion | Trust-root blocker is cleared; this is now the shortest path to axis B execution maturity. |
| Downgraded | P27 housekeeping / scanner consolidation / phase registry cleanup | These remain useful but must not consume P0/P1 capacity while main-axis simulation and source gates are blocked. |
| Reclassified | Quote / Regime / Chip PIT audit | No longer future validation work; it is complete and repaired for current trust-root purposes. |
| Paused | Optimizer readiness | Still premature until P29G dry-run outputs are validated. |
| Event-driven | FinancialReport / NewsEvent and MonthlyRevenue source routes | Insert when real source files arrive; do not fabricate or import from templates. |

## 5. Critical Blockers

| Blocker | Impact | Priority | Acceptance |
| --- | --- | --- | --- |
| P29G not yet validated beyond scaffold | Axis B simulation maturity | P0 | Deterministic paper-only runner; no DB/corpus/scoring mutation; leakage/PIT status explicit; artifacts and tests pass. |
| P29D/P29E mainline ambiguity | Execution continuity | P0 preflight condition | P29G must verify active-branch scaffold files/artifacts before expansion; if absent, classify as blocked rather than silently recreating or assuming. |
| FinancialReport / NewsEvent source absent | Axis A fundamental/event breadth | P1 when source arrives | Source-present dry-run gate passes; no import; `entersAlphaScore=false` remains until controlled approval. |
| MonthlyRevenue source absent | Axis A fundamental coverage | P2 / event-driven | Official source arrival confirmed; dry-run validation passes; no production write without approval token. |
| Optimizer readiness premature | Axis B optimization governance | Blocked | P29G complete, output schema stable, PIT/leakage gates pass, dry-run outputs auditable, corpus maturity adequate. |

## 6. Today Focus

Today should focus on:

```text
P29G Paper Simulation Runner Dry-run Expansion
```

Execution caveat:

```text
P29G must begin with a preflight that confirms P29E scaffold files and artifacts are present in the active branch/worktree.
If P29E is absent from current main, do not proceed as if the scaffold is available; classify the run as blocked by missing scaffold integration.
```

Reason:

P29F-Repair cleared the Quote / Regime / Chip trust-root blocker, and this unlocks the next axis B step: moving from paper scaffold to verifiable paper-only dry-run behavior. FinancialReport / NewsEvent and MonthlyRevenue remain source-gated, while optimizer readiness remains blocked.

## 7. Final CTO Recommendation

Proceed with P29G as the next P0, but keep it strictly paper-only and dry-run only. Do not start optimizer readiness. Do not import FinancialReport / NewsEvent. Do not expand corpus until source gates and P29G dry-run gates pass.

Final classification:

```text
CTO_ROADMAP_UPDATED_WITH_RISKS
```

---

## 8. P29G-PREFLIGHT Gate (2026-05-20)

**Gate Status: ~~P29G_PREFLIGHT_BLOCKED_SCAFFOLD_MISSING~~ → RESOLVED by P29H**

Preflight audit completed at HEAD `1c5a270` on 2026-05-20 (Asia/Taipei).

| Check | Result |
|-------|--------|
| P29D (`ecd5c86`) ancestor of HEAD | NO — `claude/objective-kalam-b00477` only |
| P29E (`51d15df`) ancestor of HEAD | NO — `claude/frosty-borg-e85827` only |
| P29E test files in working tree | MISSING (0) |
| P29E output artifacts in working tree | MISSING (0) |
| onlineValidation suite (HEAD) | PASS 3181/3181 |
| Invariance baseline | ESTABLISHED |
| Forbidden claims | 0 violations |

**P29G was BLOCKED.** The blocker was resolved by P29H (Section 9 below).

See: `00-Plan/roadmap/p29g_preflight_decision.md`

---

## 9. P29H — Scaffold Mainline Repair (2026-05-20)

**Gate Status: P29E_SCAFFOLD_MAINLINE_REPAIRED_P29G_READY**

P29H re-implemented the P29E paper simulation scaffold directly on main HEAD (Option B — no cherry-pick/merge/rebase of the side branch).

| Action | Result |
|--------|--------|
| `src/lib/onlineValidation/p29e/PaperSimulationOutputSchema.ts` created | ✅ |
| `src/lib/onlineValidation/p29e/LeakageGatePlaceholder.ts` created | ✅ |
| `src/lib/onlineValidation/p29e/PaperSimulationScaffoldRunner.ts` created | ✅ |
| `src/lib/onlineValidation/__tests__/p29e_paper_simulation_scaffold.test.ts` created | ✅ |
| Targeted P29E test (58 tests) | PASS |
| Full onlineValidation suite (107 suites / 3239 tests) | PASS — 0 regressions |
| Invariance check (9 checksums) | ALL MATCH |
| Forbidden claims scan | 0 violations |

**P29G is UNBLOCKED. P29G runner implementation may proceed.**

Constraints carried forward:
- `dryRun = true` is the only authorized mode
- Next hard gate before `AVAILABLE_PIT_SAFE`: Quote/Regime/Chip PIT Validation Audit (Axis A)
- `FinancialReport` / `NewsEvent` remain `HIGH_RISK_SOURCE_ABSENT`; `entersAlphaScore=false`

See: `outputs/online_validation/p29h_final_report.md`

---

## 10. P29G — Paper Simulation Dry-run Runner (2026-05-15)

**Gate Status: P29G_DRY_RUN_RUNNER_READY**

P29G implements the executable, governance-enforced paper simulation dry-run runner on top of the P29E scaffold repaired in P29H.

| Action | Result |
|--------|--------|
| `src/lib/onlineValidation/p29g/PaperSimulationDryRunInput.ts` created | ✅ |
| `src/lib/onlineValidation/p29g/PaperSimulationDryRunRunner.ts` created | ✅ |
| `src/lib/onlineValidation/p29g/PaperSimulationDryRunReport.ts` created | ✅ |
| P29G test suite (76 tests) | PASS |
| Full onlineValidation suite (108 suites / 3315 tests) | PASS — 0 regressions |
| Invariance check (8 checksums) | ALL MATCH |
| Forbidden claims scan | 0 violations |
| Leakage gate passes on all fixture outputs | ✅ |

Governance enforced:
- `paperOnly=true` and `dryRun=true` enforced at input contract (TypeScript literal type + runtime validation)
- `notInvestmentRecommendation=true` enforced at input + leakage gate
- `FinancialReport` / `NewsEvent` remain- `FinancialReport` / `NewsEvent` remain- `Finfalse`
- `Quote`- `Quote`- `Quote`- `Quote`- `Quoas `PIT_SAF- `Quote`- `Quote`- `Quote`- `Quote`- `Quoas `PIT_SAF- `Quote`- `Quote`- `Quote`- `Quote`- `Quoas `PIT_SAF- `Quote`- `Quote`- `Qxt hard gate: Quote/Reg- `Quote`- ` Validation Audit (Axis A)**

See: `outputs/online_validation/p29g_final_report.md`
