# 8-Hour Optimization Task: Audit and archive legacy root-level Python scripts

**Source:** code_quality | **Risk:** LOW | **Est:** 4h | **Priority:** 47

## Problem Statement
14 Python scripts at workspace root (ai_advisor.py, asset_doubling.py, asset_doubling_hunter.py, auto_optimizer.py, doubling_final_report.py). These appear to be legacy research scripts not integrated into the main pipeline.

## Evidence
- ai_advisor.py
- asset_doubling.py
- asset_doubling_hunter.py
- auto_optimizer.py
- doubling_final_report.py
- major_players.py
- rolling_backtest_engine.py
- strategy_research_framework.py

## Impact
Legacy scripts confuse the agent about what is active vs. dead code, and add maintenance surface without benefit.

## Suggested Files
- `ai_advisor.py`
- `asset_doubling.py`
- `asset_doubling_hunter.py`
- `auto_optimizer.py`
- `doubling_final_report.py`
- `major_players.py`
- `rolling_backtest_engine.py`
- `strategy_research_framework.py`
- `super_surge_detector.py`
- `validate_kelly.py`
- `validate_kelly_backtest.py`
- `validate_risk_defense.py`
- `validate_walk_forward.py`
- `verify_hunter.py`

## Acceptance Criteria
- [ ] Each Python script classified as: active (document usage), archiveable, or delete-candidate
- [ ] Archiveable scripts moved to archive/ with an INVENTORY.md entry
- [ ] Delete-candidates listed in report for operator approval
- [ ] Write classification report to docs/reports/python_script_audit.md

## Forbidden Actions
- ⛔ Do not delete any Python script without explicit approval in report
- ⛔ Do not modify scripts still referenced by cron or launchd

## System Constraints
- Do not modify trading thresholds or strategy parameters
- Do not require live trading decisions or broker connection
- All acceptance criteria must be testable and verifiable
- Document every significant change with rationale