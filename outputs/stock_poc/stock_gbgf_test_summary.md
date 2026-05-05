# GBGF Stock POC Test Summary
**Date:** 2026-05-05

## pytest results
```
python3 -m pytest tests/test_stock_gbgf_poc.py -v
29 passed in 0.25s
```

## Tests run (29)
- Domain: test_stock_domain_type, csv validation (5 tests), hypothesis JSON validation (5 tests)
- Adapter: validate_input_data, detect_leakage, compute_ev (5 tests)
- Gate runner: full G10 integration (4 tests)G01
- Reproducibility: pack exists, parseable, safety confirmations (3 tests)
- Gate result: JSON parseable

## All 29 tests PASS
- No lottery contamination in executable code
- No external data fetch
- No production write
