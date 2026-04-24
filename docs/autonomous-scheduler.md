# Autonomous Scheduler Template

This document provides local scheduling templates for the autonomous research and simulation system.

The goal is reliability, not complexity:

- one shared job runner per cycle
- one idempotency key per scheduled window
- one clear log path per job
- no duplicated prediction backfills

## Available npm entry points

The following commands are already wired in `package.json`:

- `npm run autonomous:daily`
- `npm run autonomous:monitor`
- `npm run autonomous:review`
- `npm run autonomous:learning`
- `npm run autonomous:scheduler` (developer helper only)

All commands support:

- `--scheduled-for=...` for replaying a specific scheduled window
- `--force` for reopening an existing key when you intentionally want to rerun it

Example:

```bash
npm run autonomous:daily -- --scheduled-for=2026-03-30T00:00:00.000Z
npm run autonomous:daily -- --scheduled-for=2026-03-30T00:00:00.000Z --force
```

## Recommended schedule frequency

These suggestions are tuned for a local phase:

### 1. Daily cycle

- Frequency: once per weekday
- Recommended time: after market close and after your daily data sync, e.g. `18:20`
- Purpose: produce the main research snapshot and proposal set

### 2. Monitor cycle

- Frequency: every 30 minutes on weekdays during market hours
- Recommended window: `09:00-13:30`
- Purpose: lightweight state check for open trades, latest snapshot presence, and review backlog

### 3. Review cycle

- Frequency: once per weekday after daily data has settled
- Recommended time: e.g. `20:30`
- Purpose: generate review reports for closed trades that hit the trigger threshold

### 4. Learning cycle

- Frequency: three times per week is enough in the local phase
- Recommended days: `Mon/Wed/Fri`
- Recommended time: e.g. `21:00`
- Purpose: refresh the strategy learning insight from accumulated review reports

If you want the simplest setup first, keep:

- `daily`: weekday once per day
- `monitor`: weekdays every 30 minutes
- `review`: weekday once per day
- `learning`: Mon/Wed/Fri

That is conservative enough to avoid churn and still gives enough sample accumulation.

## Environment notes

### Working directory

Run all commands from the repository root:

```bash
cd /PATH/TO/Stock-Prediction-System
```

### Node / npm path

Use a real Node runtime that can execute `ts-node`:

- macOS / Linux: `node`, `npm`
- Windows: `node.exe`, `npm.cmd`

If cron or Task Scheduler does not inherit your shell PATH, call the full binary path.

### `.env` / environment variables

The scripts rely on the same environment variables as the app:

- `DATABASE_URL`
- any API keys used by autonomous research
- any notification / report variables that your local setup needs

Make sure the scheduler process can see those variables.

If your environment does not automatically load `.env`, source it before calling the npm script.

### `ts-node` / path aliases

The npm scripts already use:

- `ts-node`
- `tsconfig-paths/register`

So cron / launchd / Task Scheduler should invoke the npm script, not a raw TypeScript file.

### Log files

Recommended log locations:

- `logs/autonomous/daily.log`
- `logs/autonomous/monitor.log`
- `logs/autonomous/review.log`
- `logs/autonomous/learning.log`
- `logs/autonomous/scheduler.log`

Recommended log pattern:

- append stdout/stderr to a per-job file
- rotate daily or with your OS log rotation tool
- keep the JSON output from the CLI intact

## macOS / Linux cron template

Use a dedicated shell wrapper or inline `bash -lc`.

Example crontab:

```cron
# Daily cycle - weekday after close
20 18 * * 1-5 cd /PATH/TO/Stock-Prediction-System && /usr/bin/env bash -lc 'npm run autonomous:daily >> /PATH/TO/Stock-Prediction-System/logs/autonomous/daily.log 2>&1'

# Monitor cycle - every 30 min during market hours
*/30 9-13 * * 1-5 cd /PATH/TO/Stock-Prediction-System && /usr/bin/env bash -lc 'npm run autonomous:monitor >> /PATH/TO/Stock-Prediction-System/logs/autonomous/monitor.log 2>&1'

# Review cycle - after daily data is settled
30 20 * * 1-5 cd /PATH/TO/Stock-Prediction-System && /usr/bin/env bash -lc 'npm run autonomous:review >> /PATH/TO/Stock-Prediction-System/logs/autonomous/review.log 2>&1'

# Learning cycle - lower-frequency refresh
0 21 * * 1,3,5 cd /PATH/TO/Stock-Prediction-System && /usr/bin/env bash -lc 'npm run autonomous:learning >> /PATH/TO/Stock-Prediction-System/logs/autonomous/learning.log 2>&1'
```

### Cron notes

- Cron uses the machine timezone.
- For market-aligned behavior, keep the machine timezone aligned with your trading calendar.
- If you change the schedule time, keep the same idempotency window. The runner already deduplicates by scheduled window.

## macOS launchd template

launchd is useful when you want a persistent local service without relying on user login shell behavior.

Use one plist per cycle.

Example for the daily cycle:

- label: `com.stocksystem.autonomous.daily`
- schedule: weekday `18:20`
- command: `npm run autonomous:daily`

Template file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.stocksystem.autonomous.daily</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>cd /PATH/TO/Stock-Prediction-System && npm run autonomous:daily >> /PATH/TO/Stock-Prediction-System/logs/autonomous/daily.log 2>&1</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
      <key>Weekday</key>
      <integer>2</integer>
      <key>Hour</key>
      <integer>18</integer>
      <key>Minute</key>
      <integer>20</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/PATH/TO/Stock-Prediction-System/logs/autonomous/daily.launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>/PATH/TO/Stock-Prediction-System/logs/autonomous/daily.launchd.err.log</string>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
  </dict>
</plist>
```

To use launchd:

```bash
launchctl unload ~/Library/LaunchAgents/com.stocksystem.autonomous.daily.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/com.stocksystem.autonomous.daily.plist
launchctl start com.stocksystem.autonomous.daily
```

Clone the same pattern for monitor / review / learning by changing:

- `Label`
- `ProgramArguments`
- `StartCalendarInterval`
- log file names

## Windows Task Scheduler template

Use `npm.cmd` or the full path to Node if your PATH is limited.

Example PowerShell-style creation commands:

```powershell
schtasks /Create /TN "StockSystem\Autonomous Daily" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 18:20 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:daily >> logs\autonomous\daily.log 2>&1"
schtasks /Create /TN "StockSystem\Autonomous Monitor" /SC MINUTE /MO 30 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:monitor >> logs\autonomous\monitor.log 2>&1"
schtasks /Create /TN "StockSystem\Autonomous Review" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 20:30 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:review >> logs\autonomous\review.log 2>&1"
schtasks /Create /TN "StockSystem\Autonomous Learning" /SC WEEKLY /D MON,WED,FRI /ST 21:00 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:learning >> logs\autonomous\learning.log 2>&1"
```

If `npm` is not in PATH, replace it with:

- `C:\Program Files\nodejs\npm.cmd`

## How to verify success

Use these checks after each run:

### 1. Job log

Inspect the CLI log file:

- `logs/autonomous/daily.log`
- `logs/autonomous/monitor.log`
- `logs/autonomous/review.log`
- `logs/autonomous/learning.log`

Look for:

- `"status":"success"`
- the expected `summary`
- no `errorMessage`

### 2. Job run history

Open:

- `/api/autonomous/jobs/status`

Confirm:

- latest run exists
- `status` is `success`
- `runMode` is correct
- `missed` is `false` for the current window

### 3. Dashboard summary

Open:

- `/autonomous/dashboard`

Confirm:

- latest snapshot shows up
- proposal / trade / review / learning counts are non-negative
- job health cards are readable

## How to handle missed runs

### What a missed run means

A missed run means the machine was offline or the scheduler did not fire for that window.

Do **not** invent prediction history afterward.

### What to do

1. Check `/api/autonomous/jobs/status`
2. Confirm the missed window
3. If you only need historical facts, backfill the data layer only
4. If you intentionally want to rerun a job window, use `--scheduled-for=...`
5. Use `--force` only when you explicitly want to reopen an already-recorded key

### Interpretation of runner results

- `duplicate_success`: the same scheduled window already succeeded, so the run was skipped
- `already_running`: the same key is still in progress, so the rerun was blocked
- `skipped`: the orchestration layer intentionally did not execute the body
- `never-ran`: no recorded job run exists for that job yet
- `missed`: the expected window is missing or did not complete successfully
- `failed`: the run started but ended with an error

### Manual rerun examples

```bash
npm run autonomous:daily -- --scheduled-for=2026-03-30T00:00:00.000Z
npm run autonomous:daily -- --scheduled-for=2026-03-30T00:00:00.000Z --force
```

Only use `--force` when you know why the existing row should be reopened.

## Recommended local backfill flow

When the machine comes back online:

1. Inspect missed windows in `/api/autonomous/jobs/status`
2. Backfill historical facts first
3. Do not create fake proposal/snapshot history
4. Run today’s live cycle only after the data layer is healthy

That keeps research accounting honest.

## Suggested local log hygiene

- keep one log file per job
- rotate daily
- do not mix scheduler stdout with app server logs
- keep the JSON output from the CLI unmodified
- if you use `local-autonomous-scheduler`, log it separately

## Minimal bootstrap order

For a fresh local machine:

1. Make sure `.env` is loaded
2. Run `npm run autonomous:daily`
3. Verify `/api/autonomous/jobs/status`
4. Verify `/autonomous/dashboard`
5. Then enable cron / launchd / Task Scheduler

## Notes

- `npm run autonomous:scheduler` is only a local developer helper.
- For real OS scheduling, prefer the individual `autonomous:*` scripts.
- The orchestration layer already handles idempotency, so a scheduler retry should not duplicate successful windows.
