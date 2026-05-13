# P26F4-or-P26A-FOLLOWUP-HARDRESET Final Report

**Date:** 2026-05-14
**Previous commit:** 5a04977 P26F3-5-HARDRESET

> Does not constitute investment advice.

## 1. Goals

- If drop-zone has real source + approval token: run P26F4 Controlled Import Gate
- Otherwise: run P26A SCORING_UNDEROUTPUT 9-case read-only audit

## 2. Route Decision

- candidateSourceFiles: **0**
- Approval token provided: **NO**
- Route: **P26A_SCORING_UNDEROUTPUT_AUDIT**
- P26F4 Import Gate: BLOCKED (SOURCE_NOT_PROVIDED)
- No DB write this round

## 3. Drop-zone Scan

- Result: P26F3_5_SOURCE_NOT_PROVIDED
- candidateSourceFiles = 0, DB write = NOT performed

## 4. Approval Token

- Required: P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY
- Provided: NO

## 5. P26F4 -- NOT EXECUTED

Operator must provide real TWSE/MOPS source files per P26F3_5_OPERATOR_HANDOFF_PACKET.md.

## 6. P26A 9-Case Read-only Audit

### Inventory

| caseId | symbol | asOfDate | horizon | alphaScore | reasonTokens | factorCount |
|--------|--------|----------|---------|------------|--------------|-------------|
| P5-CASE-010 | 1710 | 2025-12-15 | 5d | 68 | 1 | 10 |
| P5-CASE-011 | 00738U | 2025-12-19 | 5d | 63 | 1 | 10 |
| P5-CASE-013 | 1710 | 2025-12-15 | 5d | 68 | 1 | 10 |
| P5-CASE-023 | 00891 | 2025-11-12 | 20d | 63 | 1 | 10 |
| P5-CASE-026 | 00891 | 2025-11-12 | 20d | 63 | 1 | 10 |
| P5-CASE-037 | 00891 | 2025-10-15 | 60d | 63 | 1 | 10 |
| P5-CASE-053 | 00738U | 2025-12-19 | 5d | 63 | 1 | 10 |
| P5-CASE-054 | 00891 | 2025-12-30 | 5d | 63 | 1 | 10 |
| P5-CASE-055 | 1710 | 2025-12-15 | 5d | 68 | 1 | 10 |

### Taxonomy

- MONTHLY_REVENUE_BLOCKED_BY_SOURCE: 9
- SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED: 9

### Root Cause

**Primary: SNAPSHOT_FIELD_PRESENT_BUT_REASON_NOT_RENDERED**

All 9 cases: reasonSnapshot is a single-token string instead of structured multi-factor object. factorSnapshot has 10+ rich signals (MA/RSI/MACD/momentum/volume/volatility/institutional) but NOT surfaced in reasonSnapshot. Renderer receives pre-collapsed string, cannot decompose. MonthlyRevenue absent from all usedSources (in missingSources). alphaScore is correctly computed; this is a renderer/serialization issue, NOT a scoring formula problem.

**Secondary: MONTHLY_REVENUE_BLOCKED_BY_SOURCE**
All 3 symbols have MonthlyRevenue in missingSources.

### Patch Recommendations

1. PATCH_CANDIDATE_RENDERER: use factorSnapshot to render multi-factor reason. No scoring change. Next: P26A-RENDERER-FIX
2. MONTHLY_REVENUE_BLOCKED_BY_SOURCE: operator provides source files, then P26F4 import.

## 7. Tests

- New tests (p26a_scoring_underoutput_9case_audit.test.ts): 32 PASS
- Full onlineValidation suite: 2714 PASS

## 8. Forbidden Claims Scan

- Scanned all p26f4_or_p26a_* and audit artifacts
- Only match: test file scanner regex definition (allowed)
- Result: CLEAN

## 9. New Files

- outputs/online_validation/p26f4_or_p26a_followup_preflight.json/.md
- outputs/online_validation/p26f4_or_p26a_route_decision.json/.md
- outputs/online_validation/p26a_scoring_underoutput_9case_audit.json/.md
- src/lib/onlineValidation/__tests__/p26a_scoring_underoutput_9case_audit.test.ts
- outputs/online_validation/p26f4_or_p26a_followup_final_report.md

## 10. Invariance

- simulation_snapshot_corpus.jsonl: 60/60 -- OK
- p0hardreset_historical_replay_corpus.jsonl: 4500/4500 -- OK
- p1baseline_historical_replay_corpus.jsonl: 9900/9900 -- OK
- p3active_scoring_historical_replay_corpus.jsonl: 4500/4500 -- OK
- p19active_scoring_pit_replay_corpus.jsonl: 4500/4500 -- OK
- prisma/dev.db sha256: UNCHANGED
- Scoring formula sha256: all UNCHANGED

## 11. Risks

- TWSE/MOPS URLs in handoff packet marked URL TBD; CTO must verify
- 9 SCORING_UNDEROUTPUT cases: renderer fix identified but not implemented
- MonthlyRevenue source gap: awaiting operator

## 12. Next Round

- If operator places source files: P26F4 Controlled Import Gate (approval token required)
- For renderer fix: P26A-RENDERER-FIX (no scoring change required)

## 13. CEO Axis Contribution

Axis A (MonthlyRevenue): Indirect. Pipeline ready; drop-zone gating confirmed.
Axis B (Reason quality): Direct. Renderer underoutput root cause documented; patch candidate identified.

## 14. Final Classification

**P26A_9CASE_AUDIT_COMPLETE_PATCH_CANDIDATE_FOUND**

Renderer fix identified (no scoring change required). All 9 also blocked by MonthlyRevenue source gap (P26F4 required).

---
> Does not constitute investment advice.
