# P49-LEDGER — Known Failures Ledger

**Captured:** 2026-05-23T10:45:00+08:00  
**HEAD:** `261cd369db68f100e7d609b85dbd8af86094249d`  
**Subject:** P48: Add paper simulation dry-run result artifact golden fixture design

---

## Summary

| Classification | Count |
|---|---|
| Pre-existing | **4** |
| New | **0** |
| Unattributed | **0** |
| **Total failing** | **4** |

`ledgerMatchesP48ClaimedSet` = **true** — all 4 P48-named failures present and confirmed, no extras.

---

## Failure Ledger

| ID | File | Full Test Path | Type | Classification | Blocking | Owner | Next Action |
|---|---|---|---|---|---|---|---|
| LF-01 | `p26a_renderer_fix.test.ts` | `P26A renderer fix — DB unchanged > prisma/dev.db sha256 unchanged (no DB write)` | assertion | pre-existing | No | p26a | defer to P8 |
| LF-02 | `p26a_batch_pipeline_wiring.test.ts` | `invariance: DB unchanged > prisma/dev.db sha256 unchanged` | assertion | pre-existing | No | p26a | defer to P8 |
| LF-03 | `p27_waiting_state_policy_guard.test.ts` | `P27 Waiting-State Policy Guard > prisma dev.db has correct baseline SHA256` | assertion | pre-existing | No | p27 | defer to P8 |
| LF-04 | `p29d_dropzone_scaffold.test.ts` | `T12: prisma/dev.db SHA256 is unchanged from P29C baseline` | assertion | pre-existing | No | p29d | defer to P8 |

---

## Detailed Entries

### LF-01 — `p26a_renderer_fix.test.ts`

- **Describe:** `P26A renderer fix — DB unchanged`
- **It:** `prisma/dev.db sha256 unchanged (no DB write)`
- **Failure message:**
  ```
  Expected: "9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6"
  Received: "a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8"
  (line 369)
  ```
- **First committed:** `3411614` — `P26A: Fix reason renderer underoutput using factorSnapshot`
- **Pre-P38 confirmed:** YES
- **Root cause:** Stale P29C SHA baseline hardcoded in test

---

### LF-02 — `p26a_batch_pipeline_wiring.test.ts`

- **Describe:** `invariance: DB unchanged`
- **It:** `prisma/dev.db sha256 unchanged`
- **Failure message:**
  ```
  Expected: "9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6"
  Received: "a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8"
  (line 233)
  ```
- **First committed:** `ba39187` — `P26A: Wire factorSnapshot/usedSources/missingSources from corpus row into batch pipeline`
- **Pre-P38 confirmed:** YES
- **Root cause:** Stale P29C SHA baseline hardcoded in test

---

### LF-03 — `p27_waiting_state_policy_guard.test.ts`

- **Describe:** `P27 Waiting-State Policy Guard`
- **It:** `prisma dev.db has correct baseline SHA256`
- **Failure message:**
  ```
  Expected substring: "9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6"
  Received string: "a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8"
  (line 138)
  ```
- **First committed:** `ea5ee51` — `P27: Add non-source governance backlog and waiting-state guard proposal`
- **Pre-P38 confirmed:** YES
- **Root cause:** Stale P29C SHA baseline hardcoded in test

---

### LF-04 — `p29d_dropzone_scaffold.test.ts`

- **Describe:** (top-level test)
- **It:** `T12: prisma/dev.db SHA256 is unchanged from P29C baseline`
- **Failure message:**
  ```
  Expected: "9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6"
  Received: "a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8"
  (line 151)
  ```
- **First committed:** **untracked/never-committed** — file exists on disk (P29D era) but was never `git add`ed. Listed as `??` in `git status`.
- **P48 named:** YES — explicitly named in P48 self-report
- **Root cause:** Stale P29C SHA baseline hardcoded in test. Same pattern as LF-01/02/03.
- **P8 action note:** In addition to SHA update, P8 must decide whether to `git add` this file or discard it.

---

## Shared Root Cause

All 4 failures are caused by a single stale baseline:

```
Stale (P29C era):  9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6
Current (HEAD):    a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8
```

The `dev.db` was updated in post-P29C migration phases. These 4 tests have not had their  
baseline updated. **Repair is a P8 activity** — not authorized in this round.

---

## P48 Claimed Set vs Actual

| P48-Claimed Failure | Found in This Run | Match |
|---|---|---|
| `p26a_renderer_fix` | YES (LF-01) | ✅ |
| `p26a_batch_pipeline_wiring` | YES (LF-02) | ✅ |
| `p27_waiting_state_policy_guard` | YES (LF-03) | ✅ |
| `p29d_dropzone_scaffold` | YES (LF-04) | ✅ |
| Any extra failures? | NO | ✅ |

**`ledgerMatchesP48ClaimedSet` = true**

---

*Disclaimer: Ledger only. No repair authorized. Not investment advice. No scoring/DB/corpus change.*
