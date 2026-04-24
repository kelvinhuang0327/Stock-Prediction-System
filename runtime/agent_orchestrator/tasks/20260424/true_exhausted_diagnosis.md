TRUE_EXHAUSTED diagnosis

Summary
- Trigger: TRUE_EXHAUSTED — fullTradeCount=4 < min=5 (classifier gate)
- Evidence: audit run (node scripts/audit_learning_signals.js) produced READINESS: fullTradesClosed: 4, gate_5_clear: false, has_signal: true, setupDiversity: ["trend","rebound"]. SNR=71% (signal 51, time-exit 21).

Root causes
1) Minimum-sample gate: classifier threshold coldMinTrades defaults to 5 (src/lib/agent-orchestrator/signalStateClassifier.ts DEFAULT_THRESHOLDS.coldMinTrades = 5). The classifier marks TRUE_EXHAUSTED when fullTradeCount < coldMinTrades.
2) Trade-mode filtering: StrategyLearningEngine counts only non-shadow trades toward fullTradeCount (src/lib/autonomous/StrategyLearningEngine.ts: "if (tradeMode !== 'shadow') fullTradeCount++"). High proportion of shadow trades reduces counted full trades.
3) Time-exit neutral outcomes: many reviews are time-exit (neutral) and are excluded from success/failure signals, reducing effective informative samples (audit shows time-exit count = 21).
4) Contamination filter: contaminated trades are excluded (learning engine excludes marketContext containing "dataQuality":"contaminated"). Historical insight entries show isolated contaminated batches; these reduce clean samples.
5) Low setup diversity: only 2 setup types observed (trend, rebound), limiting cross-setup evidence and probe eligibility.

Immediate implications
- System correctly prevented learning adjustments due to insufficient full-trade samples (safety gate).
- Recovery should focus on increasing counted full trades (non-shadow or promoted) and reducing neutral/time-exit bias while preserving guardrail safety.

References (code)
- Thresholds and classification logic: src/lib/agent-orchestrator/signalStateClassifier.ts (DEFAULT_THRESHOLDS.coldMinTrades; classification rule at lines checking features.fullTradeCount < thresholds.coldMinTrades).
- Sample counting and down-weighting: src/lib/autonomous/StrategyLearningEngine.ts (fullTradeCount increment; shadow weight policy).
- Audit helper: scripts/audit_learning_signals.js (readable evidence script; produced current counts).

Recommended next actions (high level)
1) Run targeted probe campaign: schedule N shadow-probe trades (n=8-12) across under-represented setups and mark as isProbe=true to collect probe evidence; promote well-performing probes to full mode to increase fullTradeCount.
2) Backfill / re-evaluate recent synthetic-batch exclusions: audit contaminated exclusions and, if safe, re-run analysis on a sanitized copy to recover valid samples.
3) Reduce time-exit bias: inspect time-exit causes (holding period thresholds) and consider temporary minor extension for outgoing probes to reduce neutral outcomes.
4) Re-run machine-readable audit and only consider exiting TRUE_EXHAUSTED when pass criteria (see validation_rerun_checklist.md) are met.

Generated at: 2026-04-24T23:57:00+08:00
