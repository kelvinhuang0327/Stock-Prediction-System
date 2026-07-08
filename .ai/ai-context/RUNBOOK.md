# Stock-Prediction-System AI Runbook

## Phase 0 Rule for Every Future Task

Every future Worker, Planner, CTO, or CEO task must read these files before acting:

1. `.ai/ai-context/PROJECT_PROFILE.md`
2. `.ai/ai-context/PROJECT_CONTEXT.md`
3. `.ai/ai-context/RUNBOOK.md`
4. `.ai/ai-memory/MEMORY_LOG.md`

Summarize only constraints relevant to the current task. Do not perform broad governance updates, rewrite unrelated context, or append memory unless the task requires it.

Then verify the live repository, branch, HEAD, status, task scope, protected paths, and authorization boundary. Live evidence overrides stale task or report text, but it does not weaken safety gates.

## Safe Inspection Commands

These commands inspect repository state and do not authorize subsequent mutations:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch
git log --oneline -5
```

## Discovered Validation Commands

These commands were discovered in tracked configuration but were not executed during bootstrap:

```text
[未驗證] npm run lint
[未驗證] npm test
[未驗證] npm run test:e2e
[未驗證] npm run build
```

Execution requires task-specific authorization and a side-effect review. In particular, build and browser tooling may create generated artifacts.

## Service Commands

These commands are `[未驗證]` and approval-gated. Do not run them merely to inspect the project:

```text
[未驗證] npm run dev
[未驗證] npm run start
[未驗證] npm run monitor
[未驗證] npm run brief
```

## Stateful or High-Risk Commands

The following commands and command families are prohibited by default:

```text
npx prisma db push
npm run sync
npm run backtest
npm run autonomous:*
npm run orchestrator:*
npm run launchd:*
```

They may access or mutate databases, financial data, runtime state, outputs, external providers, background jobs, or operating-system service configuration. Require explicit authorization for the exact command, inputs, outputs, and rollback boundary.

Do not assume `dryRun=true` is file-write-free. Tracked code contains dry-run paths that still write observability reports or history.

## Bootstrap-Safe Operating Rules

- Start from a clean, verified `origin/main` base pinned to an exact SHA.
- Modify only the `.ai/**` files explicitly approved by the bootstrap task.
- Never ingest files from the excluded dirty worktree.
- Never access databases, providers, schedulers, launchd jobs, monitors, or services during bootstrap.
- Never write `data/**`, `runtime/**`, `outputs/**`, `logs/**`, database files, or environment files during bootstrap.
- Do not claim tests passed unless they were actually executed and their results recorded.
- Do not claim production readiness, model quality, trading readiness, positive edge, future performance, or investment advice.
- Preserve research-only and non-investment-advice disclaimers.
- Treat PIT/as-of metadata, freshness, timezone boundaries, data provenance, and look-ahead controls as hard gates for analysis changes.
- Stop when the actual branch, base, dirty state, or authorization scope differs from the task contract.
