# P27 Non-source Governance Backlog

**Date:** 2026-05-17

## A. Executable Now (No Source Required)

| ItemId | Title | Risk | Suggested Prompt |
|--------|-------|------|-----------------|
| P27-A1 | Artifact index consistency check | LOW | P27_ARTIFACT_INDEX_CONSISTENCY |
| P27-A2 | Phase registry consistency audit | LOW | P27_PHASE_REGISTRY_CONSISTENCY |
| P27-A3 | Waiting-state policy guard test | LOW | P27_WAITING_STATE_POLICY_GUARD |
| P27-A4 | Forbidden claims scanner consolidation | LOW | P27_FORBIDDEN_CLAIMS_SCANNER |
| P27-A5 | Report naming convention audit | LOW | P27_REPORT_NAMING_AUDIT |
| P27-A6 | CI guard proposal for waiting-state | LOW | P27_CI_GUARD_PROPOSAL |

## B. Requires Source Files
| ItemId | Title | Dependency |
|--------|-------|-----------|
| P27-B1 | Source-present gate | TWSE/MOPS CSV in drop-zone |
| P27-B2 | Source manifest validation | SOURCE_MANIFEST.json present |
| P27-B3 | Dry-run gate | source present + manifest valid |
| P27-B4 | Controlled import | dry-run PASS + approval token |

## C. Requires Import + Coverage Preview
| ItemId | Title | Dependency |
|--------|-------|-----------|
| P27-C1 | Corpus expansion gate | controlled import + coverage PASS |

## D. Requires Corpus Expansion Gate
| ItemId | Title | Dependency |
|--------|-------|-----------|
| P27-D1 | Optimizer / backtest on expanded corpus | corpus expansion authorized |

> Observability only. No investment recommendations.
