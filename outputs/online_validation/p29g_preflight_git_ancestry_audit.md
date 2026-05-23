# P29G-PREFLIGHT: Git Ancestry Audit

**Audit Date:** 2026-05-20 (Asia/Taipei)  
**Auditor:** P29G-PREFLIGHT Senior Mainline Integration Audit Agent

---

## Current HEAD

| Field | Value |
|-------|-------|
| SHA (full) | `1c5a270b0be185a9f06d870305ed93f07950c69b` |
| SHA (short) | `1c5a270` |
| Branch | `main` |
| Message | P29F-Repair: Fix Quote Chip PIT date normalization |

---

## Ancestry Checks

### P29D — `ecd5c86`

```
git merge-base --is-ancestor ecd5c86 HEAD ; echo $?
→ exit code: 1   (NOT ancestor)
```

| Field | Value |
|-------|-------|
| Commit | `ecd5c86` |
| Message | P29D: Add FinancialReport and NewsEvent manual drop-zone scaffold |
| Exists in repo | YES (commit object found) |
| Is ancestor of HEAD | **NO** |
| Location | Tip of local branch `claude/objective-kalam-b00477` |
| Status | **LOCAL_ONLY** |

### P29E — `51d15df`

```
git merge-base --is-ancestor 51d15df HEAD ; echo $?
→ exit code: 1   (NOT ancestor)
```

| Field | Value |
|-------|-------|
| Commit | `51d15df` |
| Message | P29E: Add paper simulation scaffold |
| Exists in repo | YES (commit object found) |
| Is ancestor of HEAD | **NO** |
| Location | Tip of local branch `claude/frosty-borg-e85827` |
| Status | **LOCAL_ONLY** |

---

## Topology

```
* 1c5a270  (HEAD -> main)  P29F-Repair
* 0165d79                  P29F
| * 51d15df (claude/frosty-borg-e85827)    P29E  ← LOCAL ONLY
|/
| * ecd5c86 (claude/objective-kalam-b00477) P29D  ← LOCAL ONLY
|/
* 2da1203  (claude/quirky-black-eb3d86)    P29C   ← shared ancestor
* cb53516                  P29B
* 3e02b9d                  P29A
```

**Divergence point:** `2da1203` (P29C). After P29C, `main` continued directly to P29F; P29D and P29E were committed on separate `claude/*` branches and were **never merged into main**.

---

## Verdict

**SCAFFOLD_LOCAL_ONLY** — P29D and P29E commits exist in the local git object store but are not reachable from `main`. No cherry-pick, rebase, or merge was performed (prohibited by audit scope). CTO/CEO decision required to integrate.
