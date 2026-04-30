# Phase 1 — Taiwan Stock Orchestration UI Gap Analysis

**Date:** 2026-04-30  
**Scope:** Read-only baseline audit. No production code modified.  
**System:** Taiwan Stock Trading Assistance System (Stock-Prediction-System)

---

## 1. UI Readiness Summary

**Status: UI_DOMAIN_PAGES_EXIST_ORCHESTRATION_PANEL_PARTIAL**

The frontend has a rich set of domain-oriented pages covering candidates, watchlist, screener, backtest, report, signals, and institutional chip views. An orchestrator panel exists at `/orchestrator` and `/orchestrator/cto`, but it surfaces only the AI research task queue (planner/worker/gate cycle) — not taiwan-stock-specific domain batch jobs.

There is no UI to:
- View the status of the daily data sync pipeline steps (per-endpoint progress)
- Trigger or monitor `DATA_SYNC_HEALTH`, `CANDIDATE_SCREENING_DRY_RUN`, or `DAILY_MARKET_SNAPSHOT` tasks
- View scheduler heartbeat / missed-run detection for taiwan-stock tasks
- Track data quality score trends over time

Existing orchestration UI is functional for the AI research lane but does not provide visibility into the taiwan-stock batch job layer.

---

## 2. Existing Pages Inventory

| Route | File | Role | Domain | Relevant to Orchestration? |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Entry / navigation hub | General | — |
| `/dashboard/live` | `src/app/dashboard/live/page.tsx` | Live market dashboard | Market data | Indirect — shows live state, not job status |
| `/report/daily` | `src/app/report/daily/page.tsx` | Daily report narrative (candidates, events, signals, portfolio impact) | Taiwan stock | Indirect — reads from snapshots; no job status |
| `/candidates` | `src/app/candidates/page.tsx` | Alpha candidate research table (StrategyScreenEngine output) | Taiwan stock | Indirect — shows screening result, not run status |
| `/watchlist` | `src/app/watchlist/page.tsx` | Watchlist monitoring + alerts | Taiwan stock | Indirect |
| `/screener` | `src/app/screener/page.tsx` | Manual stock filter search (`mockData` based) | Taiwan stock | Minimal — uses mock data, not StrategyScreenEngine |
| `/backtest` | `src/app/backtest/page.tsx` | Backtest trigger UI (calls API) | Backtest | Partial — triggers backtest but no task status view |
| `/signals` | `src/app/signals/page.tsx` | Signal effectiveness / reliability | Research | Reads research lane results |
| `/institutional` | `src/app/institutional/page.tsx` | Institutional chip data view | Taiwan stock | — |
| `/sectors` | `src/app/sectors/page.tsx` | Sector analysis | Taiwan stock | — |
| `/sectors/[id]` | `src/app/sectors/[id]/page.tsx` | Sector detail | Taiwan stock | — |
| `/rankings` | `src/app/rankings/page.tsx` | Stock rankings | Taiwan stock | — |
| `/indicators` | `src/app/indicators/page.tsx` | Technical indicators | Taiwan stock | — |
| `/analysis` | `src/app/analysis/page.tsx` | General stock analysis | Taiwan stock | — |
| `/stock/[symbol]` | `src/app/stock/[symbol]/page.tsx` | Stock detail | Taiwan stock | — |
| `/stocks/[symbol]` | `src/app/stocks/[symbol]/page.tsx` | Stock detail (alternate route) | Taiwan stock | — |
| `/asset-doubling` | `src/app/asset-doubling/page.tsx` | Doubling stock detector | Research | — |
| `/calendar` | `src/app/calendar/page.tsx` | Revenue/earnings calendar | Taiwan stock | — |
| `/alerts/daily` | `src/app/alerts/daily/page.tsx` | Daily alert inbox | Notifications | — |
| `/settings` | `src/app/settings/page.tsx` | System status + manual sync trigger | Admin | **High relevance** — already shows sync status; gap: no per-task status |
| `/settings/system` | `src/app/settings/system/page.tsx` | System health check (data freshness, sync log, snapshots) | Admin | **High relevance** — already shows data freshness and sync log |
| `/settings/notifications` | `src/app/settings/notifications/page.tsx` | Notification config | Admin | — |
| `/orchestrator` | `src/app/orchestrator/page.tsx` | AI research task queue (planner/worker/gate) | AI orchestrator | **High relevance** — exists but AI-research-task scoped only |
| `/orchestrator/cto` | `src/app/orchestrator/cto/page.tsx` | CTO review panel (backlog + decisions) | AI orchestrator | — |
| `/autonomous/dashboard` | `src/app/autonomous/dashboard/page.tsx` | Autonomous pipeline dashboard (proposals, trades, reviews) | Autonomous trading | — |
| `/autonomous/alerts` | `src/app/autonomous/alerts/page.tsx` | Autonomous alerts | Autonomous trading | — |
| `/simplified` | `src/app/simplified/page.tsx` | Simplified entry view | General | — |

---

## 3. Existing Orchestration UI: Capabilities and Gaps

### `/orchestrator` — AI Research Task Queue

**What it shows:**
- Planner/Worker/Gate/Replan flow diagram
- Task status badges (QUEUED / RUNNING / COMPLETED / FAILED / REPLAN_REQUIRED)
- Gate verdict badges (PASS / FAIL)
- Task history (last 20 tasks, paginated)
- OrchestratorControlPanel component (scheduler enable/disable toggle)

**Gap:** Surfaces only AI research tasks (e.g., `analyze_chip_anomaly_via_codex`, `report_generation_draft`). Taiwan-stock domain tasks (data sync, market snapshot, candidate screening) are not visible here.

### `/settings/system` — System Health

**What it shows:**
- Data source freshness (last sync timestamp per endpoint)
- Sync log (recent entries from `SyncLog`)
- Snapshot freshness (DailyMarketSnapshot, DailyCandidateSnapshot, DailyWatchlistSnapshot)
- Notification delivery summary

**Gap:** Shows sync history but not per-step task status (which step of daily-sync succeeded/failed). No scheduler heartbeat indicator. No data quality score trend.

### `/settings` — System Status

**What it shows:**
- Overall system status (API health, DB connectivity)
- Manual sync trigger buttons

**Gap:** No per-task status. Manual sync executes the full monolithic daily-sync without step-by-step progress visibility.

### `/candidates` — Alpha Candidates

**What it shows:**
- StrategyScreenEngine output (alpha scores, recommendation buckets, factors, risks)
- Filter controls, explainability panel

**Gap:** No indication of when the screening last ran, whether it ran for today's trading date, or whether the underlying data (StockQuote, InstitutionalChip) is sufficiently fresh. No "run screening now" trigger visible in the UI.

---

## 4. Required Orchestration UI for Phase 2 (Minimal Scope)

The following pages/components are needed to support taiwan-stock orchestration. These do **not** need to be built in Phase 1 (audit only), but are defined here to inform Phase 2 scoping.

| Priority | Component | Proposed Route/Location | Purpose | Builds On |
|---|---|---|---|---|
| P0 | Job Run Status Board | `/settings/system` (add section) | Show status of last run for each taiwan-stock task type (DATA_SYNC_HEALTH, DAILY_MARKET_SNAPSHOT, CANDIDATE_SCREENING, DATA_QUALITY_AUDIT). Last run time, duration, status, idempotency key. | `JobRunLog` table, existing `/settings/system` page |
| P0 | Scheduler Heartbeat Indicator | `/settings/system` (add section) | Shows whether each expected daily task ran today. Red if missed. | `JobRunLog` query: `WHERE jobName = X AND scheduledFor >= today` |
| P1 | Data Quality Score Trend | `/settings/system` or `/data-quality` | Chart of data quality score per day (requires quality score persistence — see backend gap #3) | Depends on adding `DataQualityHistoryLog` table |
| P1 | Manual Task Trigger Panel | `/settings` (extend existing) or `/orchestration/tasks` | Allow operator to manually trigger individual taiwan-stock tasks with a single button. Shows progress indicator and result. | `POST /api/tasks/run` endpoint + `JobRunLog` polling |
| P2 | Per-Step Sync Progress | `/settings/system` (extend) | During a running daily-sync, show which step is in-progress (stock_master, stock_quote, chip, revenue…) | Requires step-level `JobRunLog` entries or SSE progress stream |
| P2 | Candidate Screening Dry-Run Preview | `/candidates` (add dry-run toggle) | Allow operator to preview what today's screening would produce before committing to snapshot update | Requires `dryRun` gate in `StrategyScreenEngine` (see backend gap #2) |
| P3 | Orchestration Task Timeline | `/orchestrator` (extend existing) or new tab | Unified view of both AI research tasks and taiwan-stock batch tasks in a single timeline. Separate lanes by task_type domain. | Extends existing orchestrator page |

---

## 5. UI Risks

1. **`/screener` page uses `mockData`** — The screener page (`src/app/screener/page.tsx`) imports from `src/lib/mockData`. This is a stub that is disconnected from the real `StrategyScreenEngine` output. If a user navigates to `/screener` expecting live screening results, they will see mock data. This could cause confusion when taiwan-stock orchestration is introduced if the screener appears "working" but is not connected to the live data pipeline.

2. **`/candidates` vs `/screener` role confusion** — Both pages appear to be "stock screening" surfaces. `/candidates` is backed by the real `StrategyScreenEngine` via API; `/screener` is backed by mock data. The navigation structure does not make this distinction clear.

3. **`/orchestrator` is AI-task-scoped** — Adding taiwan-stock task lanes to the existing orchestrator UI risks mixing domain concerns. If the orchestrator panel shows both AI research tasks and data-sync tasks together, it becomes harder to understand the status of each domain. A separate section or tab is recommended.

4. **No loading skeleton on `/report/daily`** — The daily report page fetches several large datasets. No loading skeleton was observed in the page component. If any dependency (snapshot, DailyReportEngine) is slow, the page will appear blank to the user.

5. **OrchestratorControlPanel scheduler toggle** — The existing scheduler toggle in `/orchestrator` enables/disables the AI research task scheduler. If the taiwan-stock scheduler is introduced as a separate toggle, the control panel must be extended carefully to avoid toggling the wrong scheduler.

---

## 6. UI Recommendation

**UI_EXTEND_EXISTING_SETTINGS_FIRST**

The quickest path to orchestration visibility is to extend `/settings/system` with:
1. A job status board (read-only, shows last run per taiwan-stock task type from `JobRunLog`)
2. A scheduler heartbeat indicator (shows whether today's expected tasks have completed)

This requires zero new pages, only a new section in an existing page and 1-2 new API read endpoints backed by `JobRunLog`. It also respects the existing information architecture where `/settings/system` is the operator's system health view.

Building `/data-quality` as a standalone page (for quality score trends) and `/orchestration/tasks` (for manual triggers) can follow as P1/P2 work in Phase 2.

The `/screener` → mock-data gap should be addressed separately (not part of Phase 2 orchestration work) — it is a UI debt item.
