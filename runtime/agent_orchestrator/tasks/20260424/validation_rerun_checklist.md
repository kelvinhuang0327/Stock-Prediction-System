Validation & rerun checklist (machine-oriented)

1) Run the audit script to collect current metrics (must succeed):
   - node scripts/audit_learning_signals.js
   - Expected output includes: READINESS block with fullTradesClosed, gate_5_clear, has_signal, setupDiversity.

2) Confirm target metrics:
   - fullTradesClosed >= 5
   - SNR (signal/noise) >= 50%
   - setupDiversity length >= 3

3) If metrics not met, run the following recovery steps (ordered):
   a) Launch probe campaign: schedule 8-12 shadow probes across setups. Record preTrade.isProbe=true.
   b) Wait for probes to close, then re-run audit script.
   c) If any probe has non-negative PnL and passes guardrails, promote to full (promotionSource=shadow_track_record) and re-run audit.

4) Re-run classifier and persist calibration log:
   - call classifySignalState() (or run service that triggers classification)
   - Verify classifier output: state != TRUE_EXHAUSTED

5) Post-pass actions:
   - Re-enable optimization miners; run miners and collect backtest evidence.
   - Produce machine-readable report with backtest metrics for 150/500/1500 windows as required by follow-up plan.

6) If blocked (DB access, permissions, or runtime fails), collect error logs and include in task_result_json for handoff.

Pass criteria for exiting TRUE_EXHAUSTED (must all be satisfied):
- fullTradesClosed >= 5
- SNR >= 50%
- setupDiversity >= 3 or a clear successPattern with at least 2 independent symbols

Notes:
- Do NOT change classifier thresholds in production without peer review; prefer increasing evidence via probes/promotions.
- All actions and promotions must be recorded in trade metadata (promotionSource, isProbe, tradeMode) for auditability.
