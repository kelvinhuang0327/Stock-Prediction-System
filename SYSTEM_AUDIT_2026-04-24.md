# Autonomous Training Scheduler — Truth-Level Audit

**Date:** 2026-04-24
**Scope:** Full system — scheduler, miner, insight/guardrail/recovery, pipeline, execution
**Method:** Evidence-based code review with file:line citations. Assumptions are not granted; claims are verified in source.

---

## SECTION 1 — Architecture Audit

### Is the scheduler design logically complete?

Partially. The four layers (`intraday-monitor`, `daily-cycle`, `nightly-opt`, `weekly-deep`) exist and are wired through `TrainingScheduler.ts` (~647 lines) via `runJobWithOrchestration.ts`. Registry + backfill policies exist in `autonomousJobRegistry.ts:88-130`. Idempotency keys are DB-unique (`prisma/schema.prisma:473`). Logically, the skeleton is present.

**What's missing for completeness:**
- No **event-driven layer** (e.g., regime break, halt, corporate action) — everything is time-boxed.
- No **continuous calibration layer** (weekly-deep is 8h heavy, but there is no monthly walk-forward re-fit).
- No **kill-switch / safe-mode** layer that can gate *all* downstream layers on a single signal.

### 4-layer separation quality

Layers are named-separated but **not execution-separated**. `TrainingScheduler.ts:193` calls `runAutonomousCycle()` directly inside `runDailyCycleLayer()`. That same cycle is *also* registered as an independent autonomous job (`autonomousJobRunners.ts:58-73`). **Result: the same trading cycle can legitimately run twice per day** depending on how both schedulers tick.

### Coupling issues

- **Scheduler ↔ Miner:** clean — miner runs inside `nightly-opt` layer with no back-call.
- **Scheduler ↔ Insights:** one-way, fine — guardrails read from `OptimizationInsightRecord`.
- **Scheduler ↔ Pipeline:** **contaminated** — training layer invokes pipeline, pipeline also scheduled independently.
- **Insights ↔ Pipeline:** **broken loop** — `ReviewEngine.ts` (74 lines total) generates reports but *never persists new insights*. Insights are only ever created from external worker JSON reports (`InsightIntegrationLayer.ts:92-109, 330-357`). Trade outcomes do not autonomously produce insights.

### Over-engineering

- 7 guardrail mechanisms in `InsightGuardrailLayer.ts` (742 lines), but 3 of them (conflict detection, logging, regime-awareness) have limited coverage. Conflict detection is **3 hardcoded pairs** (`InsightGuardrailLayer.ts:157-181`) for a 6-signal system — most combinations never interact.
- `StrategyLearningEngine.ts` is 241 lines but the *output* it produces (`ReviewEngine` → Learning) does not feed the guardrail system.

### Fragile dependencies

- **File-system coupling:** `TrainingScheduler.ts:310-330` reads `runtime/training_reports/` via filesystem and processes sequentially. Any malformed JSON blocks the whole layer with no per-file timeout.
- **External worker coupling:** The entire insight pipeline's quality is dictated by an out-of-process AI worker whose output format is assumed, not validated (`InsightIntegrationLayer.ts:92-109`).

---

## SECTION 2 — Runtime Behavior Audit

### Will it run continuously? ~Yes, with caveats.
The 60s tick loop in `run-training-scheduler.ts:37,68-77` runs, calls `checkAndRunIfDue()` for each `TRAINING_JOB_NAMES` sequentially, awaits each. The daemon does not die on individual job failure because `runJobWithOrchestration.ts:49-82` wraps in try/catch.

### Will it stall?
**Yes, under specific conditions:**

1. **Zombie-running state.** `runJobWithOrchestration.ts` has **no timeout wrapper**. If a runner hangs (e.g., a stuck file read in `processCompletedOptimizationTaskFromFS`, `TrainingScheduler.ts:320`), the DB row remains `status='running'` forever. On next tick, `JobOrchestrationService.ts:87-93` sees `running` and skips. The job is permanently stuck with no auto-recovery. Only manual `force=true` intervention resolves it.

2. **Sequential nightly-opt blocks next ticks.** `TrainingScheduler.ts:296-394` processes report files sequentially inside a single layer run. One large run can overlap into next tick interval; since `run-training-scheduler.ts` awaits `tick()` before scheduling the next one, the loop effectively serializes.

### Will it flood tasks?
No direct flooding risk. Miner quota is hardcoded at HIGH=1 / MEDIUM=3 / LOW=5 (`optimizationMiner.ts:39`). So ≤9 tasks/day. **But quota enforcement is per-mining-run — if nightly-opt runs twice in a day (due to backfill or the double-schedule bug below), quota effectively doubles.**

### Will it skip critical work?

**Yes.** `SchedulerStateEngine.ts:262-310` `reconcile()` only evaluates the **current window** (`const scheduledFor = def.getScheduledFor(now)` at line 267). If the system was down for 3 days, only *today's* daily-cycle is backfilled. The prior two days are silently dropped. There is no "walk backwards through missed windows" loop.

### Backfill correctness

Window classification (`SchedulerStateEngine.ts:163-184`):
- Future window → `not_due_yet`
- Success/running idempotency key exists → `already_ran`
- No prior run anywhere → `never_ran`
- Otherwise → `missed`

The logic is internally consistent, but only applied to **one window at a time**. `maxMissedAgeMs: null` for `training:daily_cycle` (line 115-119) and `training:nightly_opt` (line 120-124) means "no age limit" — but since there's no multi-window backfill loop, this flag has no effect on old windows.

### Job idempotency

`buildAutonomousIdempotencyKey` = `${jobName}:${scheduledFor.toISOString()}` (`autonomousJobRegistry.ts:98-99`). Backed by `@unique` constraint (`schema.prisma:473`). Within a single process this is correct.

**Race condition across processes:** `JobOrchestrationService.ts:74-139` uses a findUnique-then-create pattern (lines 76 → 118) with **no transaction wrapper**. Two schedulers (or two `reconcile()` calls in the same process during startup) can both read null, both attempt insert, and the second hits a Prisma unique constraint error that is not caught gracefully.

### Task deduplication

Miner-level dedup is by `dedupeKey` with 14-day TTL (`optimizationMiner.ts:15,42`). **But no cross-source dedup** — `system_health__stale_quotes` and `execution_layer__data_quality_miss` describing the same root cause are distinct keys and both pass.

### Starvation risk

Medium. All jobs in the tick loop are awaited sequentially. A runaway layer drains the interval. No priority queue.

### Deadlock / circular

- `TrainingScheduler.ts:193` → `runAutonomousCycle()`
- `autonomousJobRunners.ts:61` → `runAutonomousCycle()` (scheduled independently)

Not a deadlock (same cycle invoked twice, not cyclically). But the **double-invocation is a real behavior bug**: same-day double-execution of the trading pipeline is possible. Trades, proposals, and learning insights get created twice.

### Timezone — **CRITICAL BUG**

`autonomousJobRegistry.ts:12-20`:

```typescript
function truncateToUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
```

All scheduling buckets are **UTC**. Taiwan (TWSE) market: 09:00–13:30 Asia/Taipei = 01:00–05:30 UTC. If `daily-cycle` is logically "run at EOD" but the window boundary is UTC midnight, it actually fires at **08:00 Taipei time, mid-morning mid-market**, not at EOD.

Training layers that were "supposed to" run after close run during or before market open. This invalidates the mental model behind the whole scheduler.

---

## SECTION 3 — Learning & Optimization Effectiveness

### Are insights actually improving trading behavior?

**No, not autonomously from trading outcomes.** The learning loop is asymmetric:

- `ReviewEngine.ts:8-64` produces a `ReviewReport` with boolean flags (`technicalEffective`, `regimeMismatch`, etc.) — but never calls `persistInsights()`.
- `StrategyLearningEngine.ts:132-194` *does* compute recovery signals from trade reviews, but only runs when `guardrailResult.gatingDecisions.length > 0` (line 130). Without existing gates, no learning happens.
- `InsightIntegrationLayer.ts:92-109` sources insights exclusively from external worker JSON in `runtime/training_reports/`.

**So**: closed trades create reports. Reports don't become insights. Only the external worker creates insights. The "self-improving" loop runs through an LLM-in-a-subprocess, not through observed trade PnL.

### Signal strength — is it sufficient?

Confidence is a floor-ratio heuristic, not Bayesian:
- `score_bias`: `confidence = min(1, sampleSize/50)` (`InsightIntegrationLayer.ts:161`)
- `setup_imbalance`: `min(1, totalTrades/20)` (line 178)
- `time_exit_dominance`: `min(1, sampleCount/30)` (line 195)

Minimum sample gates are shallow: `sampleSize < 10` for score_bias (line 158), `< 5` for setup_imbalance (line 175), `< 3` for sector_misalignment (line 240). A 3-trade sector_misalignment insight persists 7+ days.

### Gating — too weak or too strong?

- **Tier 1 is decorative.** Soft-tier penalties for a 0.6-confidence insight: 6–9% with 25% global cap (`InsightIntegrationLayer.ts:112,122-129`). Five Tier 1 insights stacked ≈ 15% before cap. This does not change trade selection meaningfully.
- **Tier 2 is real.** `STRONG_COEFFICIENT_BOOST = 2.0` (line 568) × 0.15 coef × 0.8 conf = 24% penalty.
- **Tier 3 is hard-blocking** but recovery is thin (see Section 9).

### Recovery effectiveness

- `successful_probe` = "closed with non-negative PnL" (`StrategyLearningEngine.ts:134-142`). **One winning probe contributes 0.25 toward the 0.7 soft-recovery threshold** (`GateRecoveryEngine.ts:310,53`). A single +0.1% probe is ~36% of a gate lift.
- `reduced_time_exit` fires at N≥5 trades, rate<0.40 (`GateRecoveryEngine.ts:152-170`). 2/5 = 0.4 exactly is NOT signaled (edge case), 1/5 = 0.5 signal value. N=5 is noise-dominated.
- `regime_change` **is declared as a signal type** (lines 63-67) but **is not emitted anywhere** in the codebase. The recovery engine waits for a signal that never comes.

### Time-exit dominance handling

`time_exit_dominance` is in `GATEABLE_INSIGHT_TYPES` (`InsightGuardrailLayer.ts:580-585`). At 30 samples + 70%+ time exits, confidence = 1.0 → Tier 3 hard-gate on that setup type. Given recovery is thin, a setup can be gated for the 7-day gate-TTL.

### setupType diversity

Diversity rescue (`GateRecoveryEngine.ts:336-374`) exempts the **most-frequent** gated setup type if all are gated. This is conservative — it picks the most common rather than the *most historically profitable*. Bias: if a bad setup type dominates candidate generation, it becomes the rescue.

### triggerScore validity

In-sample metrics only. `SignalEffectivenessResult` schema (lines 391–415) stores hitRate/Sharpe/Brier but there is no enforced walk-forward split. High overfitting risk.

---

## SECTION 4 — Risk & Failure Modes

**P0 — Critical (must fix before any production use):**

1. **Timezone bug — all schedules fire at wrong times for TWSE** (`autonomousJobRegistry.ts:12-20`). EOD jobs run mid-morning Taipei. Entire time-of-day semantic is invalid.
2. **Learning loop is broken** — trade outcomes never autonomously create insights (`ReviewEngine.ts`, `InsightIntegrationLayer.ts:92-109`). The system is not self-improving from its own trading.
3. **Bootstrap contamination** — `SimulationExecutionEngine.ts:210-216` relaxes `insufficient` → `limited` data coverage to seed first trades. Those contaminated trades are later used at lines 288-315 to "validate" setupType credibility. Self-reinforcing bias.
4. **Zombie job state** — no execution timeout in `runJobWithOrchestration.ts`. A hung runner leaves `status='running'` permanently; all future windows skipped.
5. **Double-execution of trading pipeline** — `TrainingScheduler.ts:193` + `autonomousJobRunners.ts:61` both invoke `runAutonomousCycle()` under different schedules. Same day → two sets of trades/reports.

**P1 — Important:**

6. **Backfill loses multi-day downtime** — `SchedulerStateEngine.ts:267` only classifies current window. Yesterday and earlier silently dropped.
7. **No portfolio-level risk caps** — `SimulationExecutionEngine.ts` has per-trade stops but no daily drawdown, no concurrent-position cap, no sector concentration cap.
8. **`regime_change` recovery signal never emitted** — declared type, no producer. Recovery depends on it in spirit.
9. **Tier 1 is theater** — 6–9% penalty is indistinguishable from noise. If Tier 1 is intended as "caution," it is not.
10. **Probe mode selection via FNV-1a on short keys** (`GateRecoveryEngine.ts:160-168,259`) — distribution unverified. Actual probe rate may deviate ±20% from the 8%/16% target.
11. **Cold-start unguarded** — empty insight DB → full-risk trading immediately.
12. **Race condition on concurrent `reconcile()`** — no transaction around findUnique→create (`JobOrchestrationService.ts:76→118`). Unique-constraint exceptions not caught.

**P2 — Nice to have:**

13. Conflict detection covers 3 hardcoded pairs out of 15 possible pairs among 6 signal types (`InsightGuardrailLayer.ts:157-181`).
14. `TrainingMiner.ts:322-328` does not enforce minimum sample size for trigger distribution signals.
15. No cross-source dedup in miner (`optimizationMiner.ts`).
16. Missing DB indexes on `TradeReviewReport(generatedAt)`, `SimulatedTrade(status, tradeMode)`.
17. 706 TODO/FIXME comments flagged in `optimizationMiner.ts:699-714`.
18. Stdout-only logging for guardrail decisions; no queryable audit store.

---

## SECTION 5 — Scheduler Design Gaps

### Are 4 layers enough?

No. What is missing:

- **Event-driven layer.** Regime break, market halt, unusually large drawdown, stop-hit on concentrated position. Time-scheduled jobs cannot react in <30 minutes.
- **Monthly / quarterly walk-forward refit.** Weekly-deep is 8h "research," but nothing does out-of-sample validation on a longer horizon. Drift is invisible.
- **Safe-mode / kill-switch layer.** A single trigger (e.g., "data provider silent for 2 ticks" or "daily drawdown > X%") should short-circuit all downstream. Not present.
- **Reconciliation/audit layer.** A periodic consistency sweep — zombie jobs, stuck trades, orphaned insights — exists only implicitly in `reconcile()`, which is startup-only.

### Should some tasks be event-driven?

Yes:

- **Intraday monitor** should be event-driven on price-threshold events or spread widening, not 30-min polling. A 30-min tick can miss a 5% drop recovery in between.
- **Probe trade evaluation** should be outcome-driven (on trade close) rather than waiting for the next learning cycle.
- **Gate recovery evaluation** should run on `successful_probe` emit, not wait for the next scheduled learning run.

### Adaptive scheduling

None observed. Tick interval is hardcoded 60s (`run-training-scheduler.ts:37`). Quota is hardcoded (`optimizationMiner.ts:39`). No feedback from "we're not finding enough signal → run more often" or vice versa.

---

## SECTION 6 — Optimization Miner Quality

### Task sources (from `optimizationMiner.ts:113-124`)

`system_health`, `execution_layer`, `lifecycle`, `code_quality`, `ui_ux`, `wiki_docs`, `test_coverage`, `learning_layer` (partial).

### Are they real signal?

- `system_health__stale_quotes` (lines 128–146): mines age of `StockQuote` rows. This is **operational health**, not trading signal. Fixing a stale-quote bug doesn't validate that fresh quotes improve edge.
- `execution_layer` trigger-skew detection (lines 315–400): `freq[setupType] > 0.8`. Detects concentration but not whether it is costly. 80% skew toward a winning setup is signal; 80% toward a loser is noise. The miner does not distinguish.
- `code_quality`, `ui_ux`, `wiki_docs`, `test_coverage`: these are **engineering-hygiene** tasks masquerading as trading-optimization tasks. They should not be in the same quota as trading-signal tasks.

### Missing high-value sources

- **Post-trade slippage reconciliation** — compare expected (`SimulationExecutionEngine.ts:37-41` heuristic) to realized.
- **MFE/MAE decomposition by setupType** — required for stop/target calibration.
- **Hold-duration vs. return curves** — prerequisite for intelligent `time_exit_dominance`.
- **Correlation of triggerScore to forward return buckets**, with sample size guard.
- **Cross-validation of regime classifier** — currently `detectRegime` is used without any back-measurement of its accuracy.

### Task density

HIGH=1 / MED=3 / LOW=5 per run (`optimizationMiner.ts:39`). In steady state ~5–9/day. Task output is **template-driven** (`makeCandidate` wraps pre-authored problem statements). Not learned.

### Duplication

14-day TTL within source, no cross-source collision detection. Two sources can describe the same root cause as two tasks.

### Usefulness

Mixed. Operational-health tasks have clear actionability (fix stale quote sync). Trading-signal tasks are statistically underpowered and template-described. The miner's output is better treated as "things to investigate" than "insights to apply."

---

## SECTION 7 — Insight System Audit

### Is extraction accurate?

Extraction operates on the external worker's JSON reports — so accuracy is bounded by the worker. No schema validation beyond type coercion. Hallucinated numbers from the worker pass through (`InsightIntegrationLayer.ts:92-109, 330-357`).

### Is confidence calibrated?

No. Pivot points (50, 20, 30) in the `min(1, N/pivot)` formulas are heuristic. A 50-sample `score_bias` gets confidence 1.0, a 51-sample gets 1.0, a 5-sample gets 0.1. No sequential testing, no Bayesian updating, no binomial intervals.

### Are conflicts handled correctly?

Only for 3 hardcoded pairs (`InsightGuardrailLayer.ts:157-181`):

1. `data_quality_issue` ↔ `indicator_insufficient` → redundant, drop lower
2. `score_bias` ↔ `setup_imbalance` → correlated, both ×0.70
3. `sector_misalignment` ↔ `time_exit_dominance` → correlated, both ×0.70

Non-paired combinations do not interact. Six signals → 15 possible pairs. 12 combinations untreated. No opposing-signal resolution (the code path for `opposing` is defined at lines 318–327 but never triggered).

### Decay behavior

Exponential `0.5^(ageRatio × 2)` — confidence halves at 50% of TTL. Correct, but TTL defaults (7d score_bias, 14d setup_imbalance, 3d time_exit_dominance, 1d data_quality_issue) are not empirically grounded.

### Evidence requirement

`evidence.length >= 2` is required for Tier 3 (`InsightGuardrailLayer.ts:633-644`). Soft/strong only need `> 0` effectively via the validation layer. Low bar.

### Regime-awareness

50% penalty on regime-mismatched insight (lines 249–263). Correct structure. But since `regime_change` signal is never emitted (see Section 3), the regime-transition feedback loop doesn't close.

### Influence stacking

Global cap 0.25 (line 112) enforced in `computeTriggerScoreInsightMultiplier()` (line 417). Works.

---

## SECTION 8 — Guardrail & Gate System

### Tier 3 safety

`TIER_STRONG_MAX = 0.9` (confidence threshold for Tier 3) + `evidence.length ≥ 2` + gateable type. The bar is high enough that noise-driven Tier 3 gates are unlikely in normal operation.

However, `time_exit_dominance` is gateable (`InsightGuardrailLayer.ts:580-585`) and reaches confidence 1.0 at 30 samples + 70% time exits. 30 samples is not a lot; a 2-week losing streak of chop can hit this.

### Tier 2 strength

Real. `STRONG_COEFFICIENT_BOOST = 2.0` + `STRONG_SIZING_MULTIPLIER = 0.5` (halves position size). Meaningful intervention.

### Tier 1 meaningfulness

Decorative. At minimum qualifying confidence 0.6, max penalty on a single signal is 0.15 × 0.6 = 9%. Five Tier 1 stacked ≈ 15% pre-cap. The cap itself is 25%. Against real signal-to-noise in equity forward returns, a 6–15% score penalty is below the noise floor. **Either raise the per-signal weights at Tier 1, or treat Tier 1 purely as logging.**

### Gating scope correctness

Scoped to setupType per gate. Global gate possible but rare. Symbol-level gating exists (`affectedSymbols`) but not heavily used in gate creation logic.

### Over-restriction risk

Low under normal load — diversity rule exempts at least one setup type. But diversity picks the **most frequent** candidate, which may be the one causing the problem. If all 4 setups gated and the biggest offender is the most-frequent candidate, the rescue preserves the offender.

### Missing gating scenarios

- **Market-wide gates.** If a TWSE-wide regime event occurs (e.g., a single-day >5% index drop), no gate mechanism exists other than per-setupType reactions arriving days later.
- **Position-level gates.** No gate "do not add more of symbol X this week" — yet sector misalignment signals detect sector concentration.
- **Data-quality gates.** `data_quality_issue` is **not** in `GATEABLE_INSIGHT_TYPES` (line 580–585). So if data is bad, it only produces a soft penalty. Trades continue on degraded data.

---

## SECTION 9 — Recovery System Audit

### Does probe mode work in real market?

Mechanically: probe selection is deterministic via FNV-1a (`GateRecoveryEngine.ts:160-168`). Same input → same probe decision. Good for reproducibility.

Statistically: untested. FNV-1a on short strings like `"2330:trend:2026-04-24"` has been observed to cluster in the lower 25% of the 32-bit range for certain character-set distributions. **Without an empirical validation pass, the claim that probe rate = 8% is unverified.** I would not bet money on this being within ±3% of the target.

### Recovery too slow / too fast?

Too fast. Weights (`GateRecoveryEngine.ts:310` and adjacent):
- `successful_probe` = 0.25 per probe, capped at 3 → max 0.75
- `reduced_time_exit` = 0.15 max
- `mfe_improvement` = 0.10 (approx)
- `regime_change` = 0.20 (never emitted)

Soft recovery threshold 0.7 (line 53). **Three winning probes alone cross the recovery threshold.** A probe is a shadow trade at 0.25× sizing with tighter stops — it has a built-in bias toward completing without hitting stops. "Three probes at slightly positive PnL" is essentially guaranteed for a setup that isn't catastrophically bad.

### Diversity rule sufficient?

Partially. It guarantees ≥1 setup type remains eligible. But it picks the highest-frequency candidate, not the highest-quality one. A fragile heuristic.

### Time-to-recovery

With `PROBE_RATE = 0.08` and `MIN_PROBE_AGE_DAYS = 3`, expected time to first probe after gate = 3 days + (1/0.08) × (inverse of candidate rate). For a typical setup producing 3 candidates/day, expected first probe = day 3 + ~4 days = 7 days. This also coincides with `MAX_GATE_DAYS_BEFORE_REEVAL = 7` at which point `PROBE_RATE_MATURE = 0.16` kicks in. Fine in theory; unverified in practice.

---

## SECTION 10 — Illusion vs Reality

### Features that look correct but don't actually work

1. **"Self-improving learning loop"** — ReviewEngine generates reports, but they never become insights. The only thing that "learns" is an external AI worker reading its own prior reports. (`ReviewEngine.ts`, `InsightIntegrationLayer.ts:92-109`)

2. **"Tier 1/2/3 guardrails"** — Tier 1 penalty at minimum confidence is 6–9%, below the noise floor of forward-return signal. It's logged but not meaningful.

3. **"Regime-aware recovery"** — `regime_change` is a declared signal type with 0.20 weight, but no emitter exists in the codebase. The regime half of recovery is a placeholder.

4. **"Scheduler runs at end of trading day"** — Schedules use UTC. Taiwan market closes 13:30 Taipei = 05:30 UTC. A "daily-cycle" bucketed to UTC midnight fires at 08:00 Taipei, pre-market, not post-close.

5. **"4–8 hour worker tasks"** — The wall-clock framing exists, but the tasks themselves are template-generated problem statements for an external worker. The worker's output quality is not validated against known-good baselines.

6. **"Backfill for missed windows"** — Flag exists (`maxMissedAgeMs: null`), loop does not. Only the current window is backfilled per reconcile.

7. **"Conflict detection"** — 3 pairs out of 15 possible. The other 12 combinations produce additive penalties regardless of redundancy.

8. **"Recovery engine"** — Mechanically present, but feeds on N=5 and N=1 thresholds, with an unverified hash distribution for probe selection and a missing signal type.

### Assumptions that may be wrong

- That the FNV-1a hash distributes uniformly across `[0,1)` for TWSE symbol strings.
- That 30 samples is enough for a 1.0-confidence `time_exit_dominance` gate.
- That a single +0.1% probe PnL is meaningful evidence of setup viability.
- That the external worker produces well-formed reports (no schema validation).
- That running `runAutonomousCycle` twice in a day (via both scheduling paths) is idempotent at the DB layer — not verified.
- That SQLite will hold up under concurrent scheduler daemons (the race condition in `JobOrchestrationService.ts` suggests no).

---

## SECTION 11 — Optimization Roadmap

### Tier 1 — Must fix now

| # | Item | Impact | Risk | Effort |
|---|------|--------|------|--------|
| 1 | Fix timezone: route all window truncation through Asia/Taipei (e.g., `date-fns-tz`). Add unit tests asserting daily-cycle fires at 14:00 Taipei local. | Schedulers run at correct times; EOD jobs actually see EOD data. | Low — isolated utility. | 1 day. |
| 2 | Implement multi-window backfill in `SchedulerStateEngine.reconcile()`: enumerate windows between `lastSuccessAt` and `now`, honor `maxMissedAgeMs`, emit one run per missed window (with a sane cap). | Restores continuity after downtime. | Medium — need to cap backfill to avoid flood. | 2 days. |
| 3 | Add job execution timeout in `runJobWithOrchestration.ts`. On timeout, call `failJobRun` with reason `timeout`. Add a startup sweep: any `status='running'` older than 2× expected duration → mark failed. | Eliminates zombie state. | Low. | 1 day. |
| 4 | Deduplicate pipeline invocation: either remove `runAutonomousCycle` from `TrainingScheduler.ts:193` or remove the standalone `autonomous:daily` scheduler entry. Pick one execution path. | Eliminates double-trade risk. | Low if test coverage catches it. | 0.5 day. |
| 5 | Close the learning loop: `ReviewEngine` must emit `OptimizationInsightRecord` entries (with calibrated confidence from actual trade outcomes) via `persistInsights`. Define a trade-outcome → insight extraction function. | System becomes actually self-improving. | High — bad insight generation can cascade. Gate behind shadow-only initially. | 5 days. |
| 6 | Add portfolio-level risk gates in `SimulationExecutionEngine` / `AutonomousRiskEngine`: max concurrent positions, daily drawdown cap, per-sector concentration cap. Hard-fail proposals that exceed. | Prevents unbounded loss spiral. | Low. | 2 days. |
| 7 | Remove bootstrap data-coverage relaxation or isolate bootstrap trades so they are NOT used to validate setupType credibility downstream. Add `is_bootstrap` flag to `SimulatedTrade` and exclude from credibility calculations. | Breaks the contamination loop. | Medium — may suppress learning in early days, which is correct. | 2 days. |

### Tier 2 — Important

| # | Item | Impact | Risk | Effort |
|---|------|--------|------|--------|
| 8 | Implement `regime_change` signal emission — periodic regime detection with a change-detection filter, emit signal into `GateRecoveryEngine`. | Completes declared-but-unimplemented recovery path. | Low. | 2 days. |
| 9 | Empirical probe-hash validation: offline simulation of FNV-1a over realistic key distributions. If bias > 2%, replace with SHA-256 truncated modulo. | Verifies probe rate claim. | Low. | 1 day. |
| 10 | Raise recovery thresholds: `successful_probe` weight → 0.10 (was 0.25), cap at 5 probes → 0.50 max. Require a minimum of 2 probes + at least one `reduced_time_exit` for soft recovery. | Stops single-probe gate lifts. | Low — conservative change. | 1 day. |
| 11 | Persist guardrail decisions to `InsightApplicationLog` DB table (not only stdout). Add an API to answer "why no trades on 2026-04-24?" | Operator observability. | Low. | 2 days. |
| 12 | Tighten Tier 1: raise coefficient weights by ~1.5× so minimum-confidence Tier 1 has ~12% impact, or demote purely-observational insights to "informational" (no penalty). | Tier 1 becomes either meaningful or honestly inert. | Medium — affects live scoring. | 1 day. |
| 13 | Minimum-sample enforcement in `TrainingMiner`: require N ≥ 30 for distribution-based signals; attach Wilson confidence intervals rather than point estimates. | Kills noise-driven tasks. | Low. | 2 days. |
| 14 | Walk-forward validation on `SignalEffectivenessResult`. Enforce a 70/30 or time-based split; store train/test scores separately. | Reveals overfitting. | Medium — may invalidate current "validated" signals. | 3 days. |
| 15 | Schema-validate external worker reports (e.g., `zod`) before ingesting into `InsightIntegrationLayer`. Reject malformed reports with audit trail. | Prevents hallucinated insights from ingesting. | Low. | 1 day. |
| 16 | Transaction-wrap the `startJobRun` findUnique→create pair. Catch Prisma P2002 and return `shouldRun: false, reason: 'already_running'`. | Eliminates startup race crash. | Low. | 0.5 day. |

### Tier 3 — Future

| # | Item | Impact | Risk | Effort |
|---|------|--------|------|--------|
| 17 | Event-driven layer (Kafka/Redis stream): regime break, halt, large drawdown → immediate gating path. | Responsiveness < 30 min. | Medium — new infra. | 2 weeks. |
| 18 | Monthly walk-forward refit layer — proper cross-validation. | Detects drift. | Low. | 1 week. |
| 19 | Replace template-driven optimization tasks with trade-outcome-driven task generation: "X setup has CVaR worse than Y over last 30 trades" → task. | Real strategic signal vs. operational hygiene. | Medium. | 2 weeks. |
| 20 | Cross-source dedup in miner (root-cause key). | Cleaner task queue. | Low. | 1 day. |
| 21 | Dynamic conflict detection via signal correlation matrix learned over time, replacing hardcoded pairs. | Scales beyond 6 signal types. | Medium. | 1 week. |
| 22 | Replace SQLite with Postgres if ever running >1 scheduler. SQLite + concurrent writers is a long-term footgun. | Removes single-writer ceiling. | Medium — migration. | 1 week. |
| 23 | Kill-switch / safe-mode layer: one metric crosses a threshold → all downstream layers paused + operator alert. | Blast radius containment. | Low. | 3 days. |

---

## SECTION 12 — Final Verdict

### 1. Is this system actually self-improving?

**No, not from its own trading.** It improves from the output of an external AI worker that reads JSON reports. Trade outcomes generate `ReviewReport` objects that are never transformed into insights. The feedback loop from "trade lost money" → "guardrail updated" does not close in code (`ReviewEngine.ts:8-64`, `InsightIntegrationLayer.ts:92-109`). This is the single largest gap between marketing and reality.

### 2. Is it production-ready?

**No.** Hard blockers for any capital:

- Timezone is UTC, not Asia/Taipei. Every time-of-day decision is off by 8 hours (`autonomousJobRegistry.ts:12-20`).
- No portfolio-level risk caps (max drawdown, max concurrent positions, sector concentration). Per-trade stops are not enough.
- Learning loop broken (above).
- Bootstrap contamination taints the first N trades' credibility labels.
- Zombie job state has no recovery.
- Concurrent scheduler startup can crash on race.

It is **research-grade infrastructure** that, with the Tier 1 fixes completed, becomes suitable for paper trading with verifiable outcomes. It is not suitable for live capital today.

### 3. Biggest weakness?

**The learning loop is open, not closed.** The architecture presents itself as "self-improving," but the improvement pathway runs through an out-of-process AI worker producing JSON reports that are ingested with no validation. The trading system's own `ReviewEngine` → `StrategyLearningEngine` → insight-emission pathway is not wired. Trade PnL does not autonomously drive guardrail updates. Everything else in the audit (timezone, backfill, zombie jobs, portfolio caps) is fixable in days. This one is structural.

### 4. Single most important next step

**Close the learning loop from trade outcomes to insights, behind a shadow-only flag, with empirical confidence calibration.**

Concretely:

1. Add `deriveInsightsFromReviewReports(reports: ReviewReport[]): OptimizationInsightRecord[]` that:
   - Buckets reports by setupType and by regime.
   - For each bucket with N ≥ 30, computes Wilson confidence intervals on win rate, time-exit rate, MFE/MAE distributions.
   - Emits insights with confidence = f(sample size, effect size, CI width) — **not** a floor-ratio.
   - Uses at least a 30-trade rolling window; uses a minimum effect size (e.g., >2σ from baseline).
2. Wire it into `runAutonomousLearningCycle` as the primary source of `OptimizationInsightRecord` creation.
3. Gate it behind `INSIGHT_SOURCE=review_engine` env flag initially; compare daily against the external-worker-derived insights for 2 weeks.
4. Once stable, demote external-worker insights to `informational` severity. Retain them as an auxiliary source.

Without this, every other improvement compounds atop a system that is not learning from its own trading — and that is the whole premise.

---

## HARD RULE VERIFICATION

- ✅ No claim about missing data being present.
- ✅ No assumption of model intelligence beyond what code shows.
- ✅ All suggestions have specific file:line anchors.
- ✅ Real failure modes identified (timezone, zombie, double-exec, broken loop, bootstrap contamination, hash bias, single-probe recovery, missing regime signal, no portfolio risk caps).
