# P0-02B — Shadow Prediction Log Contract

**Task:** P0-02B  
**Date:** 2026-05-07  
**Status:** COMPLETE  

---

> **IMPORTANT — research mode only**  
> dry-run only — no production Prediction row write — no StrategySignal write  
> no auto trading — no precision prediction claim — no DB write  
> no external API — no LLM call — no strategy mutation  
> no performance claim — no edge claim — no H001-H012

---

## Purpose

Defines the shadow prediction log contract for saving daily research candidate scores and rationale as post-hoc verification data. This is **not** a production prediction, **not** a trading recommendation, and **not** a strategy validation.

## Contract Highlights

| Field | Description |
|---|---|
| `asOfDate` | YYYY-MM-DD — as-of gate date (enforced) |
| `sourceDateBasis.sourceDate` | must be ≤ asOfDate |
| `researchBucket` | Strong / Watch / Neutral / LowPriority / InsufficientData (sanitized) |
| `scoreSnapshot.researchScore` | sanitized from alphaScore; research ranking only |
| `targetHorizons[].outcomeStatus` | always PENDING |
| `targetHorizons[].outcomeWriteBackAllowed` | always false |
| `writeMode` | DRY_RUN or APPEND_ONLY_CONTRACT |
| `duplicateKey` | `asOfDate\|symbol\|universeTier\|runId` |

## Sanitization Rules

- `alphaScore` → `researchScore`
- `recommendationBucket` → `researchBucket`
- All forbidden fields removed before log entry is created

## Forbidden Fields (never appear in shadow log entries)

`buy`, `sell`, `roi`, `win_rate`, `alpha`, `edge`, `profit`, `outperform`, `guaranteed`,
`expected_return`, `predicted_return`, `expected_profit`, `predicted_profit`, `H001`–`H012`
