# P49-LEDGER — Full Suite Baseline (Post-P47/P48)

**Captured:** 2026-05-23T10:45:00+08:00  
**Repo:** `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`  
**Branch:** `main`  
**HEAD:** `261cd369db68f100e7d609b85dbd8af86094249d`  
**Subject:** P48: Add paper simulation dry-run result artifact golden fixture design  
**Scope:** `src/lib/onlineValidation/__tests__`  
**Command:** `npx jest src/lib/onlineValidation/__tests__ --no-coverage`

---

## Baseline Counts

| Metric | Value |
|---|---|
| **Total Suites** | 127 |
| **Passed Suites** | 123 |
| **Failed Suites** | 4 |
| **Total Tests** | 4846 |
| **Passed Tests** | 4842 |
| **Failed Tests** | 4 |
| **Skipped Tests** | 0 |
| **Runtime** | 60.548 s |

## DB Invariance

| | SHA256 |
|---|---|
| `prisma/dev.db` before run | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |
| `prisma/dev.db` after run | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |
| Unchanged? | ✅ **YES** |

## Failing Suites

| Suite File | Failing Test | Failure Type |
|---|---|---|
| `p26a_renderer_fix.test.ts` | `P26A renderer fix — DB unchanged > prisma/dev.db sha256 unchanged (no DB write)` | assertion |
| `p26a_batch_pipeline_wiring.test.ts` | `invariance: DB unchanged > prisma/dev.db sha256 unchanged` | assertion |
| `p27_waiting_state_policy_guard.test.ts` | `P27 Waiting-State Policy Guard > prisma dev.db has correct baseline SHA256` | assertion |
| `p29d_dropzone_scaffold.test.ts` | `T12: prisma/dev.db SHA256 is unchanged from P29C baseline` | assertion |

**Root Cause (shared by all 4):** Each test hardcodes the P29C dev.db SHA256  
(`9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6`).  
The actual dev.db has evolved since P29C to its current hash  
(`a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`).  
Repair = update the hardcoded baseline in 4 test files. Authorized as **P8** activity.

## Overall Classification

**`FULL_SUITE_BASELINE_PRE_EXISTING_ONLY`**

All 4 failures are pre-existing (P48-named). Zero new failures. Zero unattributed failures.

## Next-Round Verdict

**Next round allowed: YES**

All pre-existing failures pinned. P1 Axis A round is **unblocked**.

## What This Means for Tomorrow's P1 Axis A Round

The 4842-test passing baseline is clean at HEAD `261cd36`. The 4 known failures are  
arithmetically stable (same stale-SHA cause, same 4 test files) and do not interact  
with any new `src/lib/research/` module that P1 will introduce. P1 can proceed  
without risk of pre-existing failures being misattributed to new code.

The 11:0 Axis A:Axis B imbalance since P37 is acknowledged. The **anti-axis-monopoly  
hard rule** is in effect: P1 MUST touch `src/` with an Axis A research snapshot stub.  
No further Axis B implementation rounds until Axis A delivers a visible artifact.

*Disclaimer: Verification-only baseline. Not investment advice. No return / PnL claims.  
No scoring formula change. No DB write. Not a buy / sell / hold signal.*
