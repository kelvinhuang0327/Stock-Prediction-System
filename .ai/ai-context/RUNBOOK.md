# Stock-Prediction-System AI Runbook

## Phase 0 Context Load

Future tasks must read these files before implementation:

- `.ai/ai-context/PROJECT_PROFILE.md`
- `.ai/ai-context/PROJECT_CONTEXT.md`
- `.ai/ai-context/RUNBOOK.md`
- `.ai/ai-memory/MEMORY_LOG.md`

Workers must summarize task-relevant constraints before implementation:

- `risk_domains`
- `do_not_touch`
- `hard_gates`
- DB and output restrictions
- Branch and worktree restrictions
- Diagnostic-only and no-investment-advice rules

## Worktree Rules

- If the canonical checkout is dirty, do not clean it.
- Use only the explicitly specified worktree path.
- Do not create fallback worktree directories.
- Do not create nested worktrees.
- Stop if the specified worktree is dirty or on the wrong branch.

## Default Hard Gates

- No DB write.
- No migration.
- No backfill, provider, or scheduler.
- No POST rerun, refit, or retrain.
- No `outputs/retraining` mutation.
- No run-history mutation.
- No investment advice, trading signal, or profitability claims.

## Testing And Reporting

- Prefer targeted tests.
- Run full CI only if explicitly in scope.
- Report all NOT RUN checks as NOT RUN.
- Do not claim full green unless it was actually run and green.

## Handoff Rules

- Report files changed.
- Report commands run.
- Report tests as PASS, FAIL, or NOT RUN.
- Confirm forbidden paths were not changed.
- Report git status.
- Report remaining risks.
