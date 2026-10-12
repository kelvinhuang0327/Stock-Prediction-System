# Branch Policy — Stock Prediction System

**Version:** 1.0  
**Established:** 2026-05-20 (P29X)  
**Owner:** CTO Agent  
**Status:** ACTIVE — must be read at the start of every agent session

---

## 1. Main is the Only Handoff Baseline

`main` is the **sole** authoritative branch for all agent handoffs and task continuations.

- Every new task session starts from `main`.
- Every task that produces commits must deliver those commits onto `main` before handing off.
- An agent completing a task must verify: `git branch --show-current` → `main`.

## 2. New Tasks Start from Main

```bash
git checkout main
git pull origin main   # if remote is configured
```

Before starting any new task, confirm:
- `git branch --show-current` is `main`
- `git log --oneline -1` shows the expected last commit (check with prior agent's final report)

## 3. Task Completion → Merge to Main → Handoff

The correct task lifecycle is:

1. Work on `main` directly (for focused single-phase work), OR
2. Create a short-lived feature branch from `main`, complete work, merge back to `main`
3. Run full validation suite before committing
4. Commit to `main`
5. Verify: `git branch --contains <latest-commit>` → includes `main`
6. Document final commit SHA in the phase's final report artifact
7. Hand off with `main` HEAD SHA as the reference

**Never hand off from a non-main branch.**

## 4. Old Branches Are Read-Only Historical References

Branches in `merged/YYYYMMDD/` namespace are **archived history only**:

- No new commits to archived branches
- No cherry-picks from archived branches without explicit CTO approval + diff audit
- No checkout-as-base for new work
- Archived branches are not deleted — they exist as audit trail

If you see a branch prefixed with `merged/`, it is **RETIRED**. Do not use it as a starting point.

## 5. Archive Policy — Rename, Never Delete

When a branch is superseded or merged:

```bash
# Step 1: Remove worktree if attached
git worktree remove --force .claude/worktrees/<name>

# Step 2: Rename (replace slashes in name with hyphens)
git branch -m <old-name> merged/YYYYMMDD/<sanitized-old-name>
# Example: claude/frosty-borg-e85827 → merged/20260520/claude-frosty-borg-e85827
```

**Prohibited:**
- `git branch -D <branch>`
- `git push origin --delete <branch>`
- `git push --force`

## 6. Local-only Branch Risk

Any branch that is **not** an ancestor of `main` carries a scaffold-missing risk:
- Future agents may build on `main` without knowing about the branch's unique content
- This caused the P29G-PREFLIGHT BLOCKER (P29D/P29E local-only branches)
- **Rule:** If a branch has unique commits not in `main`, either merge it into `main` or classify it as SUPERSEDED with explicit CTO documentation

## 7. Agent Onboarding Checklist

At the start of any new session, every agent MUST:

1. `git branch --show-current` → must be `main`
2. `git log --oneline -5` → verify last 5 commits match expected state
3. `git status --short` → identify runtime dirty files (do not stage them)
4. Read: `outputs/online_validation/` → find the latest `*_final_report.md` for context
5. Read this file: `00-Plan/roadmap/branch_policy.md`
6. Read: `00-Plan/roadmap/roadmap.md` → latest section for current phase
7. Read: `00-Plan/roadmap/CTO-Analysis.md` → latest section for CTO direction

## 8. Archived Branches (as of 2026-05-20)

All `claude/*` branches were archived in P29X:

| Archived Name | Tip | Original Purpose |
|---------------|-----|-----------------|
| `merged/20260520/claude-frosty-borg-e85827` | `51d15df` | P29E paper simulation scaffold (superseded by P29H) |
| `merged/20260520/claude-frosty-visvesvaraya-ff0e3f` | `330b8ea` | P25 post-migration observability |
| `merged/20260520/claude-loving-mirzakhani-b7a453` | `675771a` | P9 corpus work |
| `merged/20260520/claude-objective-kalam-b00477` | `ecd5c86` | P29D dropzone scaffold (superseded) |
| `merged/20260520/claude-optimistic-spence-419897` | `5260be3` | P27 governance audit |
| `merged/20260520/claude-quirky-black-eb3d86` | `2da1203` | P29C backtest contract |
| `merged/20260520/claude-stupefied-cray-62e312` | `4c7cab7` | P5 HARDRESET walkthrough |

## 9. Runtime Dirty Files — Never Stage

These files are always dirty due to runtime side effects. **Never stage or commit them:**

- `prisma/dev.db`, `prisma/dev.db-shm`, `prisma/dev.db-wal`
- `runtime/agent_orchestrator/llm_usage.jsonl`
- `runtime/agent_orchestrator/pids/*.pid`
- `logs/launchd/*`
- `runtime/training_reports/*.json`

## 10. Promotion Gate

Any mode other than `dryRun=true` / `paperOnly=true` requires explicit CTO approval per P29C contract. The next hard gate before upgrading simulation mode is:

**Quote/Regime/Chip PIT Validation Audit (Axis A)**

---

*This policy was established by P29X on 2026-05-20 to prevent agent handoff failures caused by fragmented branch topology.*
