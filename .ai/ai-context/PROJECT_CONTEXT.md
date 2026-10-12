# Stock-Prediction-System Project Context

## Source Note

This file is bootstrapped from Owner/Worker handoff reports and must not be treated as independent repo audit unless command evidence is added later.

## Current Known State From Handoff

- Strategy Lab UI and research lane were reported completed through PR #34.
- Post-PR34 smoke was reported PASS.
- Expanded resolved sample was reported as 2,280 rows.
- Research-only, non-investment-advice, and non-trading-signal caveats must remain.
- Full build, full lint, and full `tsc` are not confirmed green.
- DB invariance is NOT RUN.
- Durable manifest / SHA inventory and two-run reproduction are NOT RUN.
- Canonical checkout has been reported dirty.

## Next Intended Product Direction

- Strategy Lab Prediction & Retraining Snapshot.
- Read-only artifact-backed panel on `/research/strategy-lab`.
- Show latest predictions, retraining metadata, resolved validation summary, conservative research replay, provenance, and caveats.

## Current Blocker Resolved By This Task

- Missing `.ai` context files blocked the previous Worker before implementation.
