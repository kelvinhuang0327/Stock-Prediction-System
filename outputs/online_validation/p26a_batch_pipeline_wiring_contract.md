# P26A Batch Pipeline  ContractWiring 

## Field Mappings

| From (P3 Corpus Row) | To (WalkthroughCaseInput) | Behavior |
|----------------------|--------------------------|----------|
| `corpusRow.activeScoringSnapshot.factorSnapshot` | `WalkthroughCaseInput.factorSnapshot` | pass-through if present |
| `corpusRow.activeScoringSnapshot.usedSources` | `WalkthroughCaseInput.usedSources` | pass-through if present |
| `corpusRow.activeScoringSnapshot.missingSources` | `WalkthroughCaseInput.missingSources` | pass-through if present |

## Constraints

- No mutation of `activeScoringSnapshot`
- No change to `alphaScore`/`bucket`/`reasonSnapshot`
- No DB write
- No corpus write
- No external API call
- No investment recommendation claims
- All new fields are optional (backward compatible with legacy callers)

## Adapter Contract

```typescript
// src/lib/onlineValidation/P26ACorpusRowAdapter.ts
export function corpusRowToWalkthroughCaseInput(row: CorpusRow): WalkthroughCaseInput
```

- Pure  no side effectsfunction 
- Read- does not mutate inputonly 
-  same input produces same outputDeterministic 

---
*Not investment advice.*
