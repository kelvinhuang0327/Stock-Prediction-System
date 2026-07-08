# Stock-Prediction-System Project Profile

## Identity

- project_name: Stock-Prediction-System
- project_type: Taiwan-stock research and decision-support platform
- stack: Next.js 16, React 19, TypeScript, Prisma 5, SQLite
- canonical_branch: main
- bootstrap_base: f030603cb9b75f3bfea22d60573040fd9d8d64bc
- production_ready: false
- diagnostic_only: true
- prompts_home: /Users/kelvin/Kelvin-WorkSpace/personal-ai-flow
- workspace_path: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System.worktrees/ai-flow-bootstrap/.ai

This project is research-only and provides non-investment advice. It must not produce or imply investment advice, trading instructions, guaranteed returns, model-quality claims, or production-readiness claims.

## Risk Domains

| Domain | Risk | Initial boundary |
|---|---|---|
| market-data-api | HIGH | External market-data calls require explicit task scope and provenance handling. |
| data-ingestion | CRITICAL | Sync, import, normalization, and backfill can alter persisted data. |
| canonical-db | CRITICAL | The operational canonical SQLite file is unknown; DB access is denied by default. |
| scheduled-jobs | CRITICAL | Cron, launchd, monitoring, and autonomous jobs may mutate state or call providers. |
| timezone-date | HIGH | Taiwan market-day semantics must be reconciled with UTC-based date helpers. |
| stats-methodology | HIGH | Metrics and performance claims require explicit validated methodology. |
| backtest-lookahead | CRITICAL | Point-in-time, as-of, walk-forward, and leakage controls are mandatory. |
| trading-execution | CRITICAL | Live broker/execution integration is unknown; default to no execution. |
| compliance-disclaimer | CRITICAL | Research-only and non-investment-advice language must remain intact. |
| worktree-debt | HIGH | The original worktree has excluded dirty and untracked state. |
| data-provenance | CRITICAL | Source, availability, freshness, and as-of metadata must be preserved. |
| secrets-hygiene | CRITICAL | Secrets and environment values must not be read, displayed, copied, or committed. |
| agent-automation | HIGH | Planner, worker, provider, and auto-commit paths require explicit authorization. |

## Hard Gates

- No DB access or mutation by default.
- No data sync, import, normalization, or backfill without explicit authorization.
- No scheduler, service, monitor, provider, launchd, or orchestrator start without explicit authorization.
- No production-readiness, model-quality, investment, performance, or trading claims.
- No dirty-worktree ingestion into `.ai`.
- No current `outputs/**`, `runtime/**`, or `logs/**` ingestion.
- Any non-dry-run or non-paper-only execution requires explicit authorization and task-specific evidence.
- A task that can mutate state or call an external provider must have an explicit scope and traceable task identity.

## Branch and Worktree Rules

- `main` is the canonical handoff baseline.
- Start implementation tasks from a clean, verified `origin/main` base unless the owner explicitly authorizes another base.
- Record the exact base SHA for governance or bootstrap changes.
- Never use unrelated dirty files as task inputs merely because they exist in another worktree.
- Never delete, clean, stash, archive, or overwrite another worktree's state without explicit authorization.

## Do Not Touch by Default

```text
.env*
prisma/*.db*
dev.db
runtime/**
logs/**
outputs/**
data/manual/**
current excluded dirty/untracked entries
```

These paths may contain secrets, mutable databases, real financial inputs, operational state, generated evidence, or unresolved owner work. Read or write them only when a task explicitly authorizes the exact operation.
