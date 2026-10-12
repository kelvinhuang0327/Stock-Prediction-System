# GBGF Stock Project Migration Checklist

**Version:** 1.0  
**Date:** 2026-05-05  
**Task:** P3-03  
**Status:** PLAN_READY — checklist for execution, not yet executed  

---

## Pre-Migration

- [ ] **CHK-01** Confirm Stock project path exists (`~/Projects/StockResearch/`)
- [ ] **CHK-02** Create git backup branch: `git checkout -b feat/gbgf-integration`
- [ ] **CHK-03** Verify Python 3.9+ in target environment: `python3 --version`
- [ ] **CHK-04** Verify pytest available: `python3 -m pytest --version`

---

## Core Migration

- [ ] **CHK-05** Copy GBGF core (19 files) — see `stock_project_file_mapping.json` COPY list
  - `gbgf/__init__.py`, `gbgf/models.py`, all non-domain modules
  - `gbgf/gates/__init__.py`, `gbgf/gates/gate_runner.py`
- [ ] **CHK-06** Copy domain base: `gbgf/domain/__init__.py`, `gbgf/domain/base.py`
- [ ] **CHK-07** Copy StockDomain adapter: `gbgf/domain/stock.py`
- [ ] **CHK-08** Confirm `gbgf/domain/lottery.py` is NOT in Stock project
- [ ] **CHK-09** Confirm `gbgf/domain/betting.py` is NOT in Stock project
- [ ] **CHK-10** Grep check — no lottery patterns in copied files:
  ```bash
  grep -r "lottery_v2.db\|LotteryDomain\|DAILY_539\|H6_gate" gbgf/
  # Must return nothing
  ```

---

## Stock POC Scripts & Data

- [ ] **CHK-11** Copy `scripts/run_gbgf_stock_poc.py` and update paths for new directory
- [ ] **CHK-12** Copy `scripts/verify_stock_poc_reproducibility.py` and update ROOT path
- [ ] **CHK-13** Copy mock data to `research/poc/`:
  - `sample_stock_ohlcv.csv`
  - `stock_momentum_hypothesis.json`
- [ ] **CHK-14** Copy reproducibility pack: `outputs/reproducibility/stock_poc_pack_20260505.json`

---

## Real Data Adapter (Post-POC, before production)

- [ ] **CHK-15** Replace mock CSV with real PIT data adapter (`StockPITDataAdapter`)
  - Must use asof-join — no look-ahead on fundamentals/restatements
  - Must include delisted stocks in universe
- [ ] **CHK-16** Implement `TransactionCostModel` (bid-ask + market impact)
- [ ] **CHK-17** Implement `SurvivorshipGuard` (delisting-inclusive universe enforcer)
- [ ] **CHK-18** Implement `BlockPermutationTest` (time-series-aware null distribution)
- [ ] **CHK-19** Implement `RealOOSWindowSplitter` (walk-forward, no refit leakage)

---

## Test Execution

- [ ] **CHK-20** Run model unit tests: `python3 -m pytest tests/test_gbgf_models.py -v` → all PASS
- [ ] **CHK-21** Run gate runner tests: `python3 -m pytest tests/test_gbgf_gate_runner.py -v` → all PASS
- [ ] **CHK-22** Run stock domain tests: `python3 -m pytest tests/test_gbgf_domain_stock.py -v` → all PASS
- [ ] **CHK-23** Run retirement engine tests: `python3 -m pytest tests/test_gbgf_retirement_engine.py -v` → all PASS
- [ ] **CHK-24** Confirm `test_gbgf_domain_lottery.py` does NOT exist in Stock project

---

## Dry-Run Pipeline

- [ ] **CHK-25** Run stock POC dry-run:
  ```bash
  python3 scripts/run_gbgf_stock_poc.py --dry-run
  ```
  Expected: G01 PASS, G02 PASS, G03 FAIL (mock data), G09/G10 BLOCKED

- [ ] **CHK-26** Run reproducibility verification:
  ```bash
  python3 scripts/verify_stock_poc_reproducibility.py \
    --pack outputs/reproducibility/stock_poc_pack_20260505.json
  ```
  Expected: 7/7 PASS

---

## Safety Assertions

- [ ] **CHK-27** Verify no trading API write:
  ```bash
  grep -r "order_place\|brokerage\|api_key\|trade_execute" scripts/ gbgf/
  # Must return nothing
  ```
- [ ] **CHK-28** Verify no live order execution code
- [ ] **CHK-29** Verify G09 BLOCKED by default (no human review):
  ```bash
  grep -A2 '"G09"' outputs/stock_poc_gate_result.json
  # status must be "BLOCKED"
  ```
- [ ] **CHK-30** Verify `is_trading_recommendation=False` in all outputs:
  ```bash
  grep "is_trading_recommendation" outputs/stock_poc_gate_result.json
  # Must show false
  ```
- [ ] **CHK-31** Verify `production_write=False` in all outputs
- [ ] **CHK-32** Verify no lottery DB in Stock project:
  ```bash
  find . -name "*.db" -o -name "lottery*"
  # Must return nothing
  ```

---

## Reproducibility Pack & Archival

- [ ] **CHK-33** Generate fresh reproducibility pack after real-data adapter integration
- [ ] **CHK-34** Archive pack with timestamp: `outputs/reproducibility/stock_prod_pack_YYYYMMDD.json`
- [ ] **CHK-35** Confirm pack contains SHA256 for all source artifacts

---

## Human Review Gate

- [ ] **CHK-36** **Human review required before any production integration**
  - Reviewer must inspect G09 status
  - Reviewer must confirm no live trading connection
  - Reviewer must sign off on reproducibility pack
  - Only after review: G09 may be conditionally cleared by authorized human
- [ ] **CHK-37** Document reviewer name, date, and decision in reproducibility pack

---

## Final Confirmation

- [ ] **CHK-38** All tests pass in Stock project (target: 40+ tests)
- [ ] **CHK-39** Reproducibility verifier: 7/7 PASS
- [ ] **CHK-40** No lottery domain code in any Stock project file
- [ ] **CHK-41** `STOCK_PROJECT_MIGRATION_COMPLETE` classification issued in gate report

---

## Checklist Status Summary

| Phase | Items | Required Before |
|---|---|---|
| Pre-Migration | CHK-01–04 | Any copy |
| Core Migration | CHK-05–10 | Test execution |
| POC Scripts & Data | CHK-11–14 | Dry-run |
| Real Data Adapter | CHK-15–19 | Production consideration |
| Test Execution | CHK-20–24 | Dry-run |
| Dry-Run Pipeline | CHK-25–26 | Safety assertions |
| Safety Assertions | CHK-27–32 | Reproducibility pack |
| Reproducibility Pack | CHK-33–35 | Human review |
| Human Review | CHK-36–37 | Any production step |
| Final | CHK-38–41 | Closure |
