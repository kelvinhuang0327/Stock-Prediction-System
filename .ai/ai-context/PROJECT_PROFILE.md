# Stock-Prediction-System Project Profile

## Identity

- Project name: Stock-Prediction-System
- Canonical repo path: `/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System`
- Purpose:
  - Taiwan stock prediction research.
  - Strategy Lab validation and simulation research.
  - Artifact-backed, auditable research surfaces.

## Safety Classification

- research-only
- diagnostic-only
- no investment advice
- no trading signal
- not production-ready unless separately verified

## Risk Domains

- DB integrity.
- `outputs/retraining` artifacts.
- No future-data leakage.
- Retraining and rerun mutation.
- Strategy replay misread as performance.
- Dirty canonical checkout.

## Permanent Do-Not-Touch Defaults

- No DB writes unless explicitly authorized.
- No migration unless explicitly authorized.
- No provider, scheduler, or backfill unless explicitly authorized.
- No POST rerun, refit, or retrain unless explicitly authorized.
- No `outputs/retraining` mutation unless explicitly authorized.
- No investment-advice or buy/sell copy.
