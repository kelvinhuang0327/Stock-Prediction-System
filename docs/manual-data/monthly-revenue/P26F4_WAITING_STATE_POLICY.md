# P26F4 Waiting-State Policy

**Date:** 2026-05-16

## Core Rules

1. **No repeated empty  Do not schedule drop-zone scan as a 24h task unless operator explicitly confirms source files were added.scans** 

2. **Source arrival  The only valid trigger for resuming P26F4 pipeline is an explicit operator confirmation that real TWSE/MOPS source files (2025-09 ~ 2026-01) have been placed in the drop-zone.trigger** 

3. **Token  The approval token `P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY` must be provided by the operator. It must NOT be provided before dry-run PASS.gate** 

4. **No import before dry-run  The controlled import step is blocked until source-present gate runs and dry-run succeeds.PASS** 

5. **No corpus expansion before controlled import + coverage  Corpus expansion is only allowed after successful controlled import and post-import coverage preview confirms data quality.preview** 

6. **No optimizer/backtest before corpus expansion  These depend on corpus expansion being authorized.gate** 

## Summary Gate Sequence
```
operator places source files
 operator fills SOURCE_MANIFEST.json
 agent runs source-present gate
 dry-run PASS
 operator provides approval token
 agent runs controlled import
 post-import coverage preview
 corpus expansion gate decision
```

> Observability only. No investment recommendations.
