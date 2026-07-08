# Stock-Prediction-System Project Context

## Bootstrap Snapshot

- Canonical source snapshot: tracked files from fetched `origin/main` only.
- Bootstrap base: `f030603cb9b75f3bfea22d60573040fd9d8d64bc` (P205).
- Bootstrap date: 2026-07-08 Asia/Taipei.
- Current bootstrap workspace contains distilled context only; it does not certify runtime, data, model, CI, or production health.

## Architecture Summary

- Next.js App Router provides the UI and API route surface.
- Prisma with SQLite provides the tracked persistence schema and migrations.
- `scripts/`, `deploy/`, scheduler routes, cron definitions, launchd definitions, and agent workers are operational risk surfaces because they can call providers or mutate state.
- Market-data ingestion and signal fusion form the first analysis layer.
- Screening, ranking, backtesting, and research workflows build decision-support outputs above the data layer.
- Research and autonomous modules contain point-in-time, freshness, simulation, learning, and promotion concepts.
- The agent-orchestrator is a separate automation boundary with planner, worker, provider, storage, scheduler, and optional auto-commit behavior.
- The repository describes research support and simulation behavior; external live-broker execution capability remains unknown.

## Canonical Knowledge Precedence

When sources conflict, use this order and verify against the exact task baseline:

1. Source code and schema
2. Tests and enforced guardrails
3. Durable tracked documentation
4. Wiki architecture
5. README
6. Dated plans and reports

Time-sensitive claims such as current data coverage, task phase, service health, CI status, or operational DB identity must be reverified rather than inherited from documentation.

## Tracked Knowledge Inventory from origin/main

| Source | Handling | Bootstrap use |
|---|---|---|
| `README.md` | DISTILL | Project identity, stack, high-level architecture, disclaimer, and command discovery. |
| `docs/` | DISTILL selectively | Durable runbooks, source policies, orchestration notes, and operating constraints. |
| `docs/reports/` | IGNORE as current state | Historical health and setup snapshots are not live evidence. |
| `docs/agent-orchestrator/project_profile.schema.json` | DISTILL | Protected-path, required-check, planner, worker, and UI concepts. |
| `wiki/v1/` | DISTILL | Architecture, guardrails, data model, research layer, and lifecycle concepts. |
| `00-Plan/roadmap/branch_policy.md` | DISTILL | `main`-only handoff baseline and runtime-file restrictions. |
| `00-Plan/roadmap/roadmap.md` | DISTILL durable gates only | Dated phase status must be reverified. |
| `00-Plan/roadmap/CTO-Analysis.md` | DISTILL durable gates only | Preserve PIT, authorization, paper-only, and claim restrictions. |
| `00-Plan/roadmap/CEO-Decision.md` | DISTILL durable gates only | Preserve explicit authorization boundaries, not old priorities. |
| `00-Plan/roadmap/active_task.md` | IGNORE as active state | It describes P161 and is stale relative to the P205 base. |
| `00-StockPlan/` | IGNORE initially | Historical, dated plans and handoffs remain in place. |
| `package.json` | DISTILL | Command and dependency discovery; commands remain unverified. |
| `src/app`, `src/components`, `src/lib` | DISTILL shape only | Canonical application, API, UI, analysis, data, research, and automation boundaries. |
| `src/lib/data/DataSourceContract.ts` | DISTILL | Provenance, quality, availability, fallback, and readiness concepts. |
| `prisma/schema.prisma` and migrations | DISTILL structure only | Schema and PIT metadata; never ingest database contents. |
| `prisma/*.db*` and root `dev.db` | IGNORE | Mutable binary data, backups, and sidecars. |
| `scripts/` and `deploy/` | DISTILL risk and entry points | Do not execute during bootstrap. |
| `.github/` | KEEP IN PLACE | CI and repository automation remain authoritative in their native location. |
| `outputs/` | IGNORE initially | Large historical and generated evidence corpus; do not bulk-ingest. |
| `runtime/` and `logs/` | IGNORE | Operational state; never treat as durable bootstrap knowledge. |

No canonical tracked `.ai` workspace or general-purpose memory log existed at the bootstrap base.

## Stale and Excluded Sources

`00-Plan/roadmap/active_task.md` is stale relative to P205 and must not be treated as the current task. Dated roadmap, CTO, CEO, StockPlan, report, and runtime entries may contain useful history, but their current-state claims require verification.

### Dirty Worktree Exclusion

- Excluded branch: `codex/strategy-lab-visible-results`.
- Excluded state: 260 dirty/untracked entries in the original worktree.
- The excluded entries were not copied, cleaned, staged, archived, committed, or otherwise ingested.
- Exclusion does not classify any file as disposable or canonical.
- A future owner-authorized retention and disposition task is required.

## Current Unknowns

- Which SQLite file is the operational canonical database.
- Whether a live broker or external execution adapter exists and is reachable.
- Current market-data coverage, quality, and freshness.
- Current CI and test health.
- The authoritative Taiwan market-day boundary where code currently uses a UTC date helper.
- Which tracked output artifacts remain authoritative.
- Whether documented simulation `full` mode is live, paper-only, or an internal abstraction in the current deployment.
