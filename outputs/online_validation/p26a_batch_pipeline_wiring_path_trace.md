# P26A Batch Pipeline  Path TraceWiring 

## Data Flow

```
P3 corpus row
 activeScoringSnapshot. EXISTS (10+ entries)factorSnapshot    
 activeScoringSnapshot. EXISTSusedSources       
 activeScoringSnapshot. EXISTSmissingSources    
        
if [[ -e "$PUB" ]]; then   echo "publication-worktree-exists";   exit 1; fi [sample-p4-calibration-walkthrough-cases.js buildScenario()]
   GAP: factorSnapshot/usedSources/missingSources NOT copied        
        
p4calibration_walkthrough_cases.json (58 cases)
 factorSnapshot: MISSING  
 usedSources: MISSING  
 missingSources: MISSING  
        
if [[ -e "$PUB" ]]; then   echo "publication-worktree-exists";   exit 1; fi [run-p5-walkthrough-review.js]
        
reviewCase(caseRow) 
 factorSnapshot = [] (empty)  
 renderer fires as FALLBACK_EMPTY  
```

## Key Findings

- `reviewCase()` is called in 2 test files and defined in `P5WalkthroughReviewUtils.ts`
- `run-p5-walkthrough-review.js` is the main batch runner, loads from `p4calibration_walkthrough_cases.json`
- `sample-p4-calibration-walkthrough-cases.js` builds P4 cases from P3 corpus via ` **MISSING factorSnapshot/usedSources/missingSources**buildScenario()` 
- P3 corpus rows have full `activeScoringSnapshot.factorSnapshot/usedSources/missingSources`
- Minimum safe intervention: add these fields to `buildScenario()` output + create `P26ACorpusRowAdapter.ts`

## Renderer Integration State

| State | Condition |
|-------|-----------|
| ENRICHED | `WalkthroughCaseInput.factorSnapshot` is provided and non-empty |
| FALLBACK_EMPTY | `factorSnapshot` is empty or absent |

## Fix

1. Add `factorSnapshot/usedSources/missingSources` to `buildScenario()` output in `sample-p4-calibration-walkthrough-cases.js`
2. Create `P26ACorpusRowAdapter.ts` as a read-only adapter
3. Regenerate `p4calibration_walkthrough_cases.json` (still 58 cases)

---
*Not investment advice.*
