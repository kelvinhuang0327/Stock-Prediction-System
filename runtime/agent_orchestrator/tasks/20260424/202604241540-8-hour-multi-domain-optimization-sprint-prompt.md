# 8-Hour Multi-Domain Optimization Sprint (系統 / 功能 / 模擬 / 實戰 / 自我學習)

**Est Duration:** 8h | **Risk:** MEDIUM | **Composite:** 5 domains (3 miner-sourced, 2 fallback)

## Objective
在 8 小時內完成橫跨 5 個優化面向的整合性 sprint，確保系統健康、功能體驗、模擬品質、實戰執行、以及自我學習迴路皆有可驗證的推進。

## How to Execute
1. 按照 Phase 1 → Phase 5 的順序逐段實作；每段都要留下 artifact（report / log / diff）作為驗收憑據。
2. 每個 phase 完成後，在 `completed.md` 內以對應的 `[domain] criterion` tag 更新進度。
3. 若某一 phase 受到資料或權限阻擋，**不要跳過**，而是在該 phase 的驗收條件下記錄具體 blocker 作為 evidence。
4. 所有 reports 統一落在 `docs/reports/` 下，檔名需包含日期與 domain key。

## Phases
### Phase 1: 系統優化 (System Optimization)

**Problem 1 — system_health.** Most recent StockQuote was 143h ago. Market data sync may be broken or incomplete, silently degrading all downstream signal quality.

Evidence: `Latest StockQuote: 2026-04-18T16:28:29.000Z`; `Threshold: must be within 2 trading days`; `Affected stock: 2014`

**Problem 2 — test_coverage.** 19 orchestrator modules have no test file: ctoReviewTick, ctoTypes, executionPolicy, gate, plannerTick. Critical planner/worker/gate logic runs without regression protection.

Evidence: `src/lib/agent-orchestrator/ctoReviewTick.ts — no test file`; `src/lib/agent-orchestrator/ctoTypes.ts — no test file`; `src/lib/agent-orchestrator/executionPolicy.ts — no test file`

**Suggested Files:**
- `scripts/`
- `src/lib/sync/`
- `docs/DATA_SYNC_GUIDE.md`
- `src/lib/agent-orchestrator/ctoReviewTick.ts`
- `src/lib/agent-orchestrator/ctoTypes.ts`
- `src/lib/agent-orchestrator/executionPolicy.ts`
- `src/lib/agent-orchestrator/gate.ts`
- `src/lib/agent-orchestrator/plannerTick.ts`
- `src/lib/agent-orchestrator/profile.ts`

**Acceptance Criteria:**
- [ ] [system] Diagnose root cause of sync gap and document in report
- [ ] [system] Run manual backfill or trigger resync for all affected date ranges
- [ ] [system] Verify StockQuote.createdAt is within 48h for all tracked stocks after fix
- [ ] [system] Write gap summary to docs/reports/sync_gap_report.md
- [ ] [system] Test files created for: ctoReviewTick, ctoTypes, executionPolicy, gate
- [ ] [system] Each test covers: happy path, error path, and at least one edge case
- [ ] [system] All tests pass: jest --testPathPattern=agent-orchestrator
- [ ] [system] Coverage report shows improvement in orchestrator module line coverage

**Forbidden Actions:**
- ⛔ Do not delete existing quote records
- ⛔ Do not modify strategy thresholds
- ⛔ Do not add tests that require a live DB or network connection
- ⛔ Use mocks for prisma and filesystem calls

### Phase 2: 功能優化 (Feature & UX Optimization)

**Problem 1 — ui_ux.** 20 page directories lack loading.tsx or error.tsx. Operators see blank screens or crashes during slow fetches or API errors.

Evidence: `Missing loading/error in src/app`; `Missing loading/error in src/app/analysis`; `Missing loading/error in src/app/asset-doubling`

**Problem 2 — wiki_docs.** USER_GUIDE.md was last modified 98 days ago. Recent orchestrator, CTO review, and daemon autostart changes are undocumented.

Evidence: `USER_GUIDE.md mtime: 2026-01-16T08:20:18.352Z`; `Age: 98 days since last update`

**Suggested Files:**
- `src/app`
- `src/app/analysis`
- `src/app/asset-doubling`
- `src/app/backtest`
- `src/app/calendar`
- `src/app/candidates`
- `USER_GUIDE.md`
- `docs/autonomous-scheduler.md`
- `deploy/launchd-orchestrator/`

**Acceptance Criteria:**
- [ ] [feature] loading.tsx added to all identified page directories
- [ ] [feature] error.tsx added to all identified page directories
- [ ] [feature] Each loading state shows a meaningful skeleton or spinner (not a blank screen)
- [ ] [feature] Each error state shows the error message and a retry action
- [ ] [feature] TypeScript compiles with zero errors
- [ ] [feature] USER_GUIDE.md updated with orchestrator dual-view (main + CTO)
- [ ] [feature] Daemon autostart procedure documented (launchd)
- [ ] [feature] Rate-limit recovery procedure documented
- [ ] [feature] Structured backlog_research.json workflow explained with example

**Forbidden Actions:**
- ⛔ Do not modify page business logic
- ⛔ Do not change routing structure
- ⛔ Do not remove existing operator procedures

### Phase 3: 模擬優化 (Simulation Pipeline Optimization)

**Problem 1 — price_analysis_quality.** Price data quality issues detected: Latest quote: 2026-04-18T16:28:29.000Z (stale > 48h); 24 StockQuote rows with volume ≤ 0; 2 active simulated-trade symbols need fresh price data.

Evidence: `Latest quote: 2026-04-18T16:28:29.000Z (stale > 48h)`; `24 StockQuote rows with volume ≤ 0`; `2 active simulated-trade symbols need fresh price data`

**Suggested Files:**
- `scripts/`
- `src/lib/sync/`
- `prisma/schema.prisma`
- `docs/reports/`

**Acceptance Criteria:**
- [ ] [simulation] Produce JSON report of latest quote date per active symbol (docs/reports/price_data_quality.json)
- [ ] [simulation] Report count of missing trading days per symbol for last 30 days
- [ ] [simulation] Report all zero-volume and OHLC-anomaly rows with symbol/date
- [ ] [simulation] Verify pipeline sync covers all open-trade symbols within 48h
- [ ] [simulation] Add DB query assertions for OHLC integrity to data sync pipeline tests

**Forbidden Actions:**
- ⛔ Do not change live trading thresholds
- ⛔ Do not modify position sizing or risk floor
- ⛔ Do not auto-tune strategy parameters
- ⛔ Do not modify alphaScore or triggerScore weighting without evidence
- ⛔ Do not bypass learning gates
- ⛔ Diagnostics and reports only — no automated strategy changes

### Phase 4: 實戰操作優化 (Real-Trading Execution Optimization)

**Problem.** Check the bridge between simulation and real execution — trigger distribution, shadow/full promotion, and live trade feedback.

_(No miner candidate found for this domain today — the fallback audit is used instead.)_

**Suggested Files:**
- `src/lib/trading/`
- `src/lib/scoring/`
- `src/lib/execution/`
- `docs/reports/`

**Acceptance Criteria:**
- [ ] [real_trading] Summarize trigger distribution for the last 7 days and flag any setupType > 60% of trades
- [ ] [real_trading] Review shadow-to-full promotion criteria; list blockers preventing at least 3 promotions this week
- [ ] [real_trading] Audit live-trade feedback loop (pnl confirmation, position reconciliation) end-to-end and document gaps
- [ ] [real_trading] Write execution_readiness_report.md under docs/reports/ with a concrete action list

**Forbidden Actions:**
- ⛔ Do not place or cancel real orders during this phase
- ⛔ Do not modify live position sizing without explicit operator approval

### Phase 5: 系統自我學習優化 (Self-Learning Loop Optimization)

**Problem.** Without fresh StrategyLearningInsight records the system cannot adapt. Validate the learning pipeline and regenerate if stalled.

_(No miner candidate found for this domain today — the fallback audit is used instead.)_

**Suggested Files:**
- `src/lib/learning/`
- `src/lib/agent-orchestrator/signalStateClassifier.ts`
- `docs/reports/`

**Acceptance Criteria:**
- [ ] [self_learning] Report the age of the most recent StrategyLearningInsight and flag as stale if > 7 days
- [ ] [self_learning] Trace the insight-generation pipeline end-to-end and document each stage (inputs → outputs)
- [ ] [self_learning] Attempt to regenerate at least one insight on current data OR document the exact data block preventing it
- [ ] [self_learning] Write learning_loop_health.md under docs/reports/ capturing recommendations for the next iteration

**Forbidden Actions:**
- ⛔ Do not insert synthetic StrategyLearningInsight rows to mask a pipeline failure
- ⛔ Do not change learning thresholds without an explicit experiment plan

## Global Constraints
- Do not modify trading thresholds or strategy parameters outside of the designated phase
- Do not require live broker connection
- Do not skip a phase silently — if blocked, document the blocker as acceptance evidence
- Do not delete existing quote records
- Do not modify strategy thresholds
- Do not add tests that require a live DB or network connection
- Use mocks for prisma and filesystem calls
- Do not modify page business logic
- Do not change routing structure
- Do not remove existing operator procedures
- Do not change live trading thresholds
- Do not modify position sizing or risk floor
- Do not auto-tune strategy parameters
- Do not modify alphaScore or triggerScore weighting without evidence
- Do not bypass learning gates
- Diagnostics and reports only — no automated strategy changes
- Do not place or cancel real orders during this phase
- Do not modify live position sizing without explicit operator approval
- Do not insert synthetic StrategyLearningInsight rows to mask a pipeline failure
- Do not change learning thresholds without an explicit experiment plan

## System Constraints
- Do not modify protected paths from the project profile
- Every acceptance criterion must be testable and verifiable with an artifact path
- Each phase must produce at least one file/diff/log as evidence
- If time runs short, deliver fewer phases **completely** rather than all phases partially