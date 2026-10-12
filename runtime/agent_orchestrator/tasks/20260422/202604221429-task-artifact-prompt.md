# Planner Task Prompt

## Objective
先確保排程、task 狀態轉移、artifact 寫入完整且可恢復。

## Scope
- Deliver one coherent, testable increment.
- Keep implementation aligned with project profile constraints.

## Constraints
- Do not modify protected paths from project profile.
- Do not claim completion without machine-readable evidence.
- If blocked by runtime/permission, finalize with clear failure evidence.

## Acceptance Criteria
- completed.md exists and explains what was done.
- task_result.json exists and includes all required_result_fields.
- No forbidden paths are present in changed_files.

## Handoff Notes
- Previous task #12 finished with PASS.
- Read latest task_result.json before planning the next task.

## Allowed References
- README.md
- docs/
- wiki/
- src/
- prisma/schema.prisma