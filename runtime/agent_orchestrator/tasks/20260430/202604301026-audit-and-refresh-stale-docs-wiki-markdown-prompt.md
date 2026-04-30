# 8-Hour Optimization Task: Audit and refresh stale docs/wiki markdown files

**Source:** wiki_docs | **Risk:** LOW | **Est:** 6h | **Priority:** 34

## Problem Statement
5 markdown files in docs/ or wiki/ have not been updated in > 30 days. They may reference outdated APIs, file paths, or procedures.

## Evidence
- docs/DATA_SYNC_GUIDE.md
- docs/KELLY_RISK_INTEGRATION.md
- docs/autonomous-quickstart.md
- docs/autonomous-scheduler.md
- docs/reports/doubling_report_20260212.md

## Impact
Stale docs mislead operators and agents. The agent-orchestrator reads docs as context — drift causes incorrect assumptions.

## Suggested Files
- `docs/DATA_SYNC_GUIDE.md`
- `docs/KELLY_RISK_INTEGRATION.md`
- `docs/autonomous-quickstart.md`
- `docs/autonomous-scheduler.md`
- `docs/reports/doubling_report_20260212.md`

## Acceptance Criteria
- [ ] Each stale file reviewed and updated or marked as archived
- [ ] File paths and API references verified against current codebase
- [ ] CHANGELOG.md updated with a doc-refresh entry
- [ ] No dead links remaining in docs/ or wiki/

## Forbidden Actions
- ⛔ Do not delete documents without archiving to archive/

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale