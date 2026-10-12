# P26A Renderer Integration Contract

**Version:** p26a-renderer-integration-v1
**Backward compatible:** Yes
**Additive only:** Yes

## Preserved existing fields
- ` raw corpus value (unchanged)reasonSnapshot` 
- ` first 100 chars of reasonSnapshot (unchanged)reasonSnapshotSummary` 
- ` first slash-split token (unchanged)topSignalOrFactor` 

## New additive fields on CaseReviewResult
| Field | Type | Description |
|---|---|---|
| `renderedReason` | string | Enriched display reason using factorSnapshot if available |
| `renderedReasonFactorCount` | number | Factor dimension count in rendered output |
| `reasonRendererVersion` | string | "p26a-corpus-renderer-v1" |
| `reasonRendererOutcome` | string | ENRICHED / ALREADY_RICH / FALLBACK_EMPTY |
| `dataAvailabilityNote` | string | Neutral note when missingSources present |

## Guarantees
- No scoring change, no alphaScore change, no bucket change
- No DB write, no corpus mutation
- Deterministic, no external API call
- No buy/sell or performance claims
