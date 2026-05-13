# P26F3-5 Pipeline Pre-flight Summary

**Classification:** `P26F3_5_PIPELINE_PREFLIGHT_COMPLETE_AND_OPERATOR_HANDOFF_READY`
**Generated:** 2026-05-13T10:02:23.195Z
**Synthetic fixture:** `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System/data/manual/monthly-revenue/p26f3_5_synthetic_fixture`

## Stage Results

| Stage | Result | Detail |
|---|---|---|
| inventory | PASS | candidateSourceFiles=5 |
| validator | PASS | acceptedRows=125 rejectedRows=0 |
| coveragePreview | PASS | matchedRows=9000 |
| safetyGate | PASS | status=PASS |
| scoringInvariance | PASS | mismatchedAlpha=0 mismatchedBucket=0 |

## Safety

- DB write performed: **NO**
- Corpus write performed: **NO**
- DB sha256 unchanged: **YES**

## Corpus Counts

- simulation_snapshot_corpus.jsonl: 60 (expected 60) — OK
- p0hardreset_historical_replay_corpus.jsonl: 4500 (expected 4500) — OK
- p1baseline_historical_replay_corpus.jsonl: 9900 (expected 9900) — OK
- p3active_scoring_historical_replay_corpus.jsonl: 4500 (expected 4500) — OK
- p19active_scoring_pit_replay_corpus.jsonl: 4500 (expected 4500) — OK

## Note

This pre-flight used **synthetic fixture** only. Real operator-provided source files must be placed in `data/manual/monthly-revenue/p26f3-2-dropzone/` per the operator handoff packet.

> SYNTHETIC FIXTURE ONLY — NOT production data — does not constitute investment advice.
