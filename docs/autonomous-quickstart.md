# Autonomous Scheduler Quick Start

> Last reviewed: 2026-04-30 — Action: confirmed npm entrypoints and deploy examples exist. Updated verification notes to use the repository's npm scripts.


Use this guide if you want to get the local Autonomous System running in about 5 minutes.

## 1) Prerequisites

- Node.js and npm installed
- This repository checked out locally
- Database and `.env` already configured
- You can run:
  - `npm run autonomous:daily`
  - `npm run autonomous:monitor`
  - `npm run autonomous:review`
  - `npm run autonomous:learning`

## 2) Replace placeholders

Before copying any scheduler template, replace:

- `/PATH/TO/Stock-Prediction-System`
- `C:\PATH\TO\Stock-Prediction-System`
- any log path under `logs/autonomous/`
- any `com.example.*` label in launchd examples

If you use a shell script wrapper, make sure it changes into the repo root first.

## 3) Choose one scheduler

- **cron**: best for Linux and macOS if you want the simplest setup
- **launchd**: best for macOS if you want a native service
- **Windows Task Scheduler**: best for Windows

If you are unsure, start with **cron** or **Task Scheduler**.

## 4) First manual check

Run these once from the repo root:

```bash
npm run autonomous:daily
npm run autonomous:monitor
```

Then open:

- `/api/autonomous/jobs/status`
- `/autonomous/dashboard`

You should see a recent run or a skipped/duplicate status, not a crash.

## 5) Turn on the scheduler

### cron

Copy the example from `deploy/examples/autonomous.cron.example` into your crontab and adjust the paths.

### launchd

Copy `deploy/examples/autonomous.launchd.plist`, adjust the paths, then load it with `launchctl`.

### Windows Task Scheduler

Follow `deploy/examples/autonomous-windows-task.md` and create four tasks:

- daily
- monitor
- review
- learning

## 6) How to confirm it really ran

Check these in order:

1. `/api/autonomous/jobs/status`
2. `/autonomous/dashboard`
3. the job log file you configured

Look for:

- `success`
- `duplicate_success`
- `skipped`
- `already_running`

## 7) How to backfill a missed run

Run the job manually with the original window:

```bash
npm run autonomous:daily -- --scheduled-for=2026-03-30T00:00:00.000Z
```

Use `--force` only if you intentionally want to rerun the same window:

```bash
npm run autonomous:daily -- --scheduled-for=2026-03-30T00:00:00.000Z --force
```

## 8) Common problems

- **Nothing runs**: check the working directory and the Node/npm path
- **Missing `.env`**: source it before the scheduler starts
- **`duplicate_success`**: that window already completed; this is expected
- **`already_running`**: a run is still in progress
- **`missed` / `never-ran`**: check `/api/autonomous/jobs/status` and rerun manually if needed
- **Logs are empty**: confirm the log directory exists and the scheduler can write to it

## 9) Minimal daily routine

If you only want the shortest possible setup:

1. Run `npm run autonomous:daily` once manually
2. Confirm `/api/autonomous/jobs/status`
3. Install one scheduler entry from the example file
4. Check `/autonomous/dashboard` the next day

That is enough for a local first pass.
