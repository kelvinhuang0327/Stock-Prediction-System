# P26A Batch Pipeline  Final ReportWiring 

**Final Classification**: `P26A_BATCH_PIPELINE_WIRING_COMPLETE`

## Summary

The P26A batch pipeline wiring is complete. The `factorSnapshot`, `usedSources`, and `missingSources` fields from P3 corpus rows are now passed through to `WalkthroughCaseInput` via:

1. `P26ACorpusRowAdapter. new read-only adapterts` 
2. `sample-p4-calibration-walkthrough-cases. updated `buildScenario()` to include the three fieldsjs` 
3. `p4calibration_walkthrough_cases. regenerated with enriched fields (58 cases unchanged)json` 

## Results

| Metric | Value |
|--------|-------|
| 9/9  |ENRICHED | 
| 9/9  |corpusRowFound | 
| 9/9  |factorSnapshotPassed | 
| 9/9 renderedReasonFactorCount >=  |3 | 
| alphaScore mismatches | 0 |
| bucket mismatches | 0 |

## Invariants

| Check | Status |
|-------|--------|
| prisma/dev.db  PASS |sha256 | 
| RuleBasedStockAnalyzer.ts  PASS |sha256 | 
| SignalFusionEngine.ts  PASS |sha256 | 
| ActiveScoringSnapshotBuilder.ts  PASS |sha256 | 
| simulation_snapshot_corpus.jsonl (60  PASS |lines) | 
| p0hardreset corpus (4500  PASS |lines) | 
| p1baseline corpus (9900  PASS |lines) | 
| p3active_scoring corpus (4500  PASS |lines) | 
| p19active_scoring_pit corpus (4500 non- PASS |empty) | 

## Files Created/Modified

### New Files
- `src/lib/onlineValidation/P26ACorpusRowAdapter.ts`
- `src/lib/onlineValidation/__tests__/p26a_batch_pipeline_wiring.test.ts`
- `scripts/run-p26a-batch-pipeline-wiring-validation.js`
- `outputs/online_validation/p26a_batch_pipeline_wiring_preflight.json`
- `outputs/online_validation/p26a_batch_pipeline_wiring_preflight.md`
- `outputs/online_validation/p26a_batch_pipeline_wiring_path_trace.json`
- `outputs/online_validation/p26a_batch_pipeline_wiring_path_trace.md`
- `outputs/online_validation/p26a_batch_pipeline_wiring_contract.json`
- `outputs/online_validation/p26a_batch_pipeline_wiring_contract.md`
- `outputs/online_validation/p26a_batch_pipeline_wiring_9case_real_corpus_validation.json`
- `outputs/online_validation/p26a_batch_pipeline_wiring_9case_real_corpus_validation.md`
- `outputs/online_validation/p26a_batch_pipeline_wiring_invariance.json`
- `outputs/online_validation/p26a_batch_pipeline_wiring_final_report.md`

### Modified Files
- `scripts/sample-p4-calibration-walkthrough-cases. added factorSnapshot/usedSources/missingSources to `buildScenario()`js` 

### Regenerated Files
- `outputs/online_validation/p4calibration_walkthrough_cases. 58 cases, now with factorSnapshotjson` 

## Test Results

22/22 tests passed (`p26a_batch_pipeline_wiring.test.ts`)

---
*Not investment advice. Not a trading system.*
