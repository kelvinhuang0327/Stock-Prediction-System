# P26  Next ActionsGovernance 

**Date:** 2026-05-16

## Now / Next / Later

| Horizon | Action | Dependency |
|---------|--------|-----------|
| **Now** | Wait for operator source files | operator action required |
| **Now** | Non-source governance cleanup only | no dependency |
| **Next** | Source-present gate (when source arrives) | operator provides files + manifest |
| **Next** | Dry-run gate | source-present gate PASS |
| **Later** | Controlled import | dry-run PASS + token |
| **Later** | Post-import coverage preview | import complete |
| **Later** | Corpus expansion gate decision | coverage preview PASS |
| **Later** | Optimizer / backtest on new data | corpus expansion authorized |

## What NOT To Do Without Source
 Run P26F4 dry-run- 
 Import to DB- 
 Expand corpus- 
 Run optimizer- 
 Repeat empty drop-zone scan as primary task- 

> Observability only. No investment recommendations.
