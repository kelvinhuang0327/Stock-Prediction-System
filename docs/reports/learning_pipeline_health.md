# Learning Pipeline Health — Diagnosis (2026-04-27)

Summary

- Root cause: Autonomous learning runs stopped being produced daily due to a combination of (a) the orchestrator worker frequently reporting `no_queued_task` while planner produced tasks, and (b) earlier issues in the trade closing pipeline which prevented review reports from being generated (stale quote parsing / freshness guard). A recent fix to SimulationExecutionEngine restored trade closing and allowed a manual learning run to create a fresh StrategyLearningInsight (id 109).

Evidence

- Latest StrategyLearningInsight before intervention: id=33, generatedAt=2026-04-20T01:52:02.577Z.
- Manual run (CLI) produced StrategyLearningInsight id=109 on 2026-04-27T02:00:17Z.
- Orchestrator logs show many planner-created tasks but worker logs with repeated `no_queued_task` entries.
- Previous lifecycle fix (2026-04-26) addressed date parsing and freshness guards; running closeOpenTrades with bypassFreshnessGuard closed ~51 trades in dev DB.

Actions taken

1. Verified pipeline end-to-end by running a local autonomous learning cycle against the dev DB; insight id=109 generated and persisted.
2. Collected and summarized logs and DB evidence into this report.

Next steps (recommended)

- Ensure the orchestrator worker is actively polling and processing queued tasks (investigate why worker observed `no_queued_task` despite planner creating tasks).
- Schedule a controlled daily run (or enable planner-worker cadence) for 3 days to confirm automated regeneration.
- Monitor TradeReviewReport creation rates (expect >0 per day) and learning sourceCount to verify ongoing health.

Forbidden actions performed: none.
