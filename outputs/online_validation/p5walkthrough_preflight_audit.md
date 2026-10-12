# P5-HARDRESET PART A — Pre-flight Audit

**Classification:** `P5_PREFLIGHT_PASS`
**Date:** 2026-05-11
**Gates:** 24/24 PASS

## Gate Results

| ID | Description | Status | Detail |
|----|-------------|--------|--------|
| A01 | p4calibration_walkthrough_cases.json exists | **PASS** | OK |
| A02 | p4calibration_full_audit.json exists | **PASS** | OK |
| A03 | p4calibration_readiness_decision.json exists | **PASS** | OK |
| A04 | p3active_scoring_historical_replay_corpus.jsonl exists | **PASS** | OK |
| A05 | p1baseline_historical_replay_corpus.jsonl exists | **PASS** | OK |
| A06 | simulation_snapshot_corpus.jsonl exists | **PASS** | OK |
| A07 | p3active_scoring_field_inspection.json exists | **PASS** | OK |
| A08 | p4 walkthrough cases >= 50 | **PASS** | OK |
| A09 | p4 walkthrough cases array non-empty | **PASS** | OK |
| A10 | p4 readiness classification = P4_FULL_CALIBRATION_AUDIT_COMPLETE | **PASS** | OK |
| A11 | p4 readiness 29/29 PASS | **PASS** | OK |
| A12 | simulation_snapshot_corpus.jsonl = 60 lines | **PASS** | OK |
| A13 | p3active corpus = 4500 lines | **PASS** | OK |
| A14 | p1baseline corpus = 9900 lines | **PASS** | OK |
| A15 | p0hardreset corpus = 4500 lines | **PASS** | OK |
| A16 | P3 corpus: mock-deterministic=0 | **PASS** | OK |
| A17 | P1 corpus: mock-deterministic=0 | **PASS** | OK |
| A18 | p4calibration_full_audit.json: no forbidden claims | **PASS** | OK |
| A19 | p4calibration_readiness_decision.json: no forbidden claims | **PASS** | OK |
| A20 | p4calibration_walkthrough_cases.json: no forbidden claims | **PASS** | OK |
| A21 | P3 corpus: >=25 unique symbols | **PASS** | OK |
| A22 | P3 corpus: usable ratio 100% (no EMPTY) | **PASS** | OK |
| A23 | P3 corpus: PIT violations = 0 | **PASS** | OK |
| A24 | p4calibration_full_audit.json: byHorizon/byBucket/byScoreDecile/confusionMatrices/predictionVsBaseline all present | **PASS** | OK |

## Result

All gates PASS. Proceed to PART B.