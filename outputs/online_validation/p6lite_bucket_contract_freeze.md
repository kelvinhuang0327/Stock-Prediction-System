# P6-LITE: Bucket Schema Contract Freeze

**Generated:** 2026-05-12  
**Verdict:** 🟡 BY_DESIGN_BOUNDARY → Contract Frozen

> **Disclaimer:** Schema contract documentation only. No investment recommendations. No scoring changes.

---

## Purpose

This contract freeze records the **observed boundary behavior** of the bucket assignment schema as identified during P6-LITE diagnosis. It does not change any scoring logic, and it does not constitute an investment decision.

---

## Canonical Bucket Labels

| Label | Score Band | Notes |
|-------|-----------|-------|
| Strong | 60–100 | Aliases: Strong Candidate, 偏多, StrongBull |
| **Watch** | **40–70** | **Signal-override boundary: accepts scores [20,39] when signal-qualified** |
| Neutral | 30–59 | Aliases: 中性 |
| LowPriority | 0–39 | Aliases: Low Priority, 低優先, 偏空, WeakBear |
| InsufficientData | N/A | Aliases: N/A, NA, None, '' |

---

## Watch Boundary Contract

| Field | Value |
|-------|-------|
| Canonical Lower Bound | 40 |
| Observed Lower Bound (Signal Override) | 20 |
| Observed Case Count | 5 |
| Observed Score Range | [21, 29] |

**Freeze Rule:** Watch bucket is permissible for composite scores in [20, 39] when individual signal factors provide a qualifying condition. The canonical band (40–70) reflects the typical range, not a hard gate.

**Normalization Rule:** All Watch variants → canonical "Watch".

---

## Normalization Rules

- Trim whitespace: **Yes**
- Case-insensitive: **Yes**
- Chinese aliases: 偏多→Strong, 偏空→LowPriority, 觀察/留意→Watch, 中性→Neutral, 低優先→LowPriority
- InsufficientData variants: Insufficient Data, N/A, NA, None, (empty string)

---

## Non-Goals

- This contract does NOT define investment rules or recommendations.
- This contract does NOT establish performance thresholds or return expectations.
- This contract does NOT modify scoring formulas, alphaScore, or recommendationBucket logic.
- This contract does NOT apply to simulation_snapshot_corpus or P0/P1/P3/P4 corpora.
- This contract is for schema documentation and normalization consistency only.
- Future score re-calibration remains out of scope for P6-LITE.

---

*Frozen: 2026-05-12 | P6-HARDRESET-LITE | BY_DESIGN_BOUNDARY*
