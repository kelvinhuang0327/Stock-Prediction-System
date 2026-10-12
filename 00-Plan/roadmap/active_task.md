# Active Task — P161 Shared Governance Conflict Resolution

## Source

P161 prompt. P160 correctly stopped due to a stale PROJECT_CONTEXT_LOCK commit hash `97243d5` that conflicted with the actual current baseline `35e7ab1`. This document is updated to resolve that conflict, enabling the continuation of the active lint tranche lane.

---

## PROJECT_CONTEXT_LOCK (MANDATORY)

```text
Project = Stock-Prediction-System
Canonical Repo = /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
Canonical Branch = main
Canonical HEAD (expected at start) = 35e7ab1 (or fast-forward descendant)

If any task, file, commit, or roadmap reference belongs to another project
(Betting-pool, Lottery, MLB, bare TSL, CLV, Novel project, character/relationship
ledger, dsxcai/stock_trading trading semantics, Electron GUI, IPC Python execution):
  STOP immediately. Do not summarize it as current work. Do not create artifacts for it.
  Do not import code or trading semantics from external repos.
```

## Model Capability Guard (MANDATORY)

- Do NOT expand scope beyond the files listed in **Allowed Modifications** for the specific lane you are in.
- Do NOT silence lint/type errors with `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or by editing `tsconfig.json` / `jest.config.js` / `.eslintrc*`. Fix with real types.
- Do NOT weaken governance to make tests pass.
- Do NOT run browser review, start the dev server for review, touch real data / DB / providers / simulation.
- Do NOT use `--no-verify`, force-push, or `--amend` someone else's commit.
- If the fix appears to require touching any **Forbidden** file/area, **STOP** and report with: (1) what you expected, (2) what you observed, (3) why the boundary is hit, (4) a proposed corrected scope.

## Phase 0 — Reconcile prompt vs reality

Trust the live repo over this prompt. If HEAD, file state, or facts do not match what you observe, **STOP** and report the mismatch (expected / observed / cause / proposed scope). Do not force the prompt onto a different reality.

### STOP conditions
- repo ≠ `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`
- branch ≠ `main`
- HEAD is not `35e7ab1` or its fast-forward descendant.
- the repair would require modifying any **Forbidden** file.
- presence of unrelated dirty files.

## Current Task Status

- P160 was blocked by the stale `active_task.md`.
- P161 resolves this governance conflict by updating `active_task.md` to safely permit `35e7ab1`.
- **Next Intended Worker Task**: P162 (or P160-retry) to resume the active lint seventh tranche lane.

## Forbidden Modifications
- DB / Prisma / real data / source providers / external API / simulation execution / optimizer / backtest.
- The semantics of any governance flag, the disclaimer wording, or the forbidden-wording rules (may not be weakened).
- Any modifications to source/test/code outside the explicitly allowed whitelist for the active lint tranche.
- Any modifications to CI workflow, registry, migration, schemas, runtime, logs.
