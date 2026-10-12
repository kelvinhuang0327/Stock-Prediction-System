# T-05 Existing Walk-Forward Audit

Generated: 2026-05-06

## Summary

| Component | Status |
|-----------|--------|
| Existing portfolio walk-forward | NONE FOUND |
| Existing per-signal walk-forward | YES (WalkForwardValidator.ts, 522 DB rows) |
| H001-H012 references found | YES (9 files) |
| Regime integration in walk-forward | NONE |
| PIT-safe walk-forward | PARTIAL (date split only) |

## Decision: CREATE_NEW_PYTHON_SKELETON

No portfolio-level walk-forward exists. New script required.

## H001-H012 Related Files (MUST NOT USE)

- src/lib/research/ExperimentRegistry.ts
- src/lib/research/ExperimentRunner.ts  
- src/lib/research/ResearchCoverageEngine.ts
- scripts/run_stock_validation.py (and related batch scripts)
- tests/test_stock_hypothesis_*.py

## Reusable Components

- SQLite access pattern: build-market-regime-classifier.py
- PIT-safe feature query: build-p4-feature-foundation.py
- Regime output format: p4_03b_market_regime_sample.json

## Risk Summary

- Retired H001-H012 logic in TypeScript production files: HIGH risk if invoked
- Python skeleton is isolated from TypeScript; risk is LOW
- WalkForwardResult table must NOT be written to in T-05
