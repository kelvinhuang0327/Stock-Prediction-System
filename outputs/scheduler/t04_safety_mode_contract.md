# T-04 Safety Mode Contract

**Generated:** 2026-05-06

## Safety Modes

| Mode | Trigger | LLM Allowed | DB Write |
|---|---|---|---|
| NORMAL | All clear | |  | 
| SAFE_RUN | SAFE_RUN env |/ | param | 
| LLM_HARD_OFF | LLM_HARD_OFF |  | env | 
| DEGRADED | Ops Report not |  | PASS | 
| BLOCKED | Guardrail fail or  |CRITICAL  | taskId | 

## LLM Hard-Off Triggers (any one sufficient)

- `SAFE_RUN` param or env `SAFE_RUN=true`
- env `LLM_HARD_OFF=true`
- `opsReportStatus !== 'PASS'`
- `opsGuardrailOk === false`
- `taskIdAlert.level === 'CRITICAL'`

## TaskId Alert Levels

| Level | Condition | Blocks? |
|---|---|---|
| NONE | taskId present and non-empty | No |
| WARNING | Missing but dry-run/non-mutating | No |
 BLOCKED |

## Implementation

- **File:** `src/lib/scheduler/SafetyGuard.ts`
- **Functions:** `evaluateSafetyMode()`, `validateTaskId()`, `assertLlmAllowed()`
- **Integrated in:** `src/app/api/cron/daily-sync/route.ts`
