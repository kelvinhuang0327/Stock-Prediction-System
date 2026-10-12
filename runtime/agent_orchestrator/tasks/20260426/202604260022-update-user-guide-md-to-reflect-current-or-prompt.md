# 8-Hour Optimization Task: Update USER_GUIDE.md to reflect current orchestrator and scheduler features

**Source:** wiki_docs | **Risk:** LOW | **Est:** 4h | **Priority:** 34

## Problem Statement
USER_GUIDE.md was last modified 100 days ago. Recent orchestrator, CTO review, and daemon autostart changes are undocumented.

## Evidence
- USER_GUIDE.md mtime: 2026-01-16T08:20:18.352Z
- Age: 100 days since last update

## Impact
Operators follow an outdated guide. New autonomous features go unused because they are not documented.

## Suggested Files
- `USER_GUIDE.md`
- `docs/autonomous-scheduler.md`
- `deploy/launchd-orchestrator/`

## Acceptance Criteria
- [ ] USER_GUIDE.md updated with orchestrator dual-view (main + CTO)
- [ ] Daemon autostart procedure documented (launchd)
- [ ] Rate-limit recovery procedure documented
- [ ] Structured backlog_research.json workflow explained with example

## Forbidden Actions
- ⛔ Do not remove existing operator procedures

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale