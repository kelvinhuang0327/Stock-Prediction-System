# GBGF → Stock Project Export Plan

**Version:** 1.0  
**Date:** 2026-05-05  
**Task:** P3-03  
**Status:** PLAN_READY — not yet migrated  

---

## 1. Executive Summary

The Generic Backtest & Governance Framework (GBGF), developed and battle-tested in LotteryNew,
is ready for export to a dedicated Stock Research project. This plan defines the exact files to
copy, files to exclude, adapters to build, directory structure, validation steps, and guardrails.

The Stock POC (P3-01/P3-02) has already demonstrated that `StockDomain` can run G01–G10 via
GateRunner and that the reproducibility verifier achieves 7/7 PASS. The export consists of
copying the **domain-agnostic GBGF core** and the **StockDomain adapter only** — the Lottery
domain and all lottery-specific outputs must be excluded from the target project.

**No actual migration is performed in this task. This is a planning document only.**

---

## 2. Export Goal

| Dimension | Goal |
|---|---|
| Primary | Move GBGF core + StockDomain to a standalone Stock research repo |
| Secondary | Prove framework portability: Lottery → Stock |
| Out of scope | Actual strategy deployment, live trading, order placement |
| Strict prohibition | Production write, order API calls, live trading recommendations |

---

## 3. Target Project Assumptions

- Target repo path: `~/Projects/StockResearch/` (placeholder — confirm before migration)
- Language: Python 3.9+
- No existing GBGF code in target repo
- No existing `gbgf/` package
- Target repo has its own `requirements.txt` or `pyproject.toml`
- Git initialized; migration branch: `feat/gbgf-integration`
- CI/CD: optional (not required for migration, required for production)
- **No live market data connection in scope**
- **No brokerage API credentials in scope**

---

## 4. Files to Copy

### 4.1 GBGF Core (copy verbatim)

```
gbgf/__init__.py
gbgf/models.py
gbgf/ev_gate.py
gbgf/evidence_collector.py
gbgf/hypothesis_registry.py
gbgf/knowledge_gate.py
gbgf/leakage_detector.py
gbgf/lesson_accumulator.py
gbgf/multiple_testing.py
gbgf/oos_backtester.py
gbgf/permutation_test.py
gbgf/production_write_guard.py
gbgf/retirement_engine.py
gbgf/rollback_guard.py
gbgf/validation_tier.py
gbgf/gates/__init__.py
gbgf/gates/gate_runner.py
gbgf/domain/__init__.py
gbgf/domain/base.py
```

### 4.2 StockDomain Adapter (copy, then adapt for real PIT data)

```
gbgf/domain/stock.py
```

### 4.3 POC Scripts (copy, adapt paths)

```
scripts/run_gbgf_stock_poc.py        → stock_project/scripts/run_gbgf_stock_poc.py
scripts/verify_stock_poc_reproducibility.py → stock_project/scripts/verify_stock_poc_reproducibility.py
```

### 4.4 Mock Data (copy as reference only — replace with real PIT data)

```
research/stock_poc/sample_stock_ohlcv.csv          → stock_project/research/poc/
research/stock_poc/stock_momentum_hypothesis.json  → stock_project/research/poc/
```

### 4.5 Tests (copy, adapt imports)

```
tests/test_gbgf_models.py
tests/test_gbgf_gate_runner.py
tests/test_gbgf_domain_stock.py
tests/test_gbgf_retirement_engine.py
```

### 4.6 Reproducibility Pack (copy as evidence baseline)

```
outputs/reproducibility/stock_poc_pack_20260505.json
```

---

## 5. Files NOT to Copy

| File / Directory | Reason |
|---|---|
| `gbgf/domain/lottery.py` | Lottery-specific: reads lottery_v2.db, H6 JSON — no relevance to stock |
| `gbgf/domain/betting.py` | Betting-specific: CLV model placeholder — not needed for stock |
| `tests/test_gbgf_domain_lottery.py` | Lottery domain tests — will fail without DB |
| `lottery_api/`, `lottery_v2.db`, `lottery.db` | Lottery data sources — must not be copied |
| `data/`, `predictions/` | Lottery prediction outputs |
| `outputs/h6_*` | H6-specific evidence — lottery only |
| `outputs/research_closure_report.json` | Lottery research closure |
| `outputs/strategy_retirement_policy_summary.json` | Lottery-specific retirement policy |
| `outputs/forbidden_strategy_patterns.json` | Lottery-specific forbidden patterns |
| `outputs/daily539_payout_ev_analysis.*` | Taiwan lottery payout model |
| `outputs/h6_long_window_validation.*` | H6 long-window results |
| `scripts/run_gbgf_h6_gate_pipeline.py` | H6/Lottery-specific pipeline |
| `scripts/verify_h6_gbgf_reproducibility.py` | H6/Lottery-specific verifier |
| `research/daily539_*` | Lottery research scripts |
| `index.html`, `styles*.css`, frontend assets | Lottery dashboard |
| `wiki/`, `memory/`, `docs/` | Lottery project knowledge base |
| `CLAUDE.md`, `AGENT_RULES.md`, `.md` root files | Lottery project governance |
| `config/`, `runtime/`, `rl_logs/` | Lottery runtime artifacts |

---

## 6. Lottery-Specific Code to Exclude

Even within files that are copied, these patterns must be removed or replaced:

| Pattern | Location | Action |
|---|---|---|
| `from lottery_api import ...` | Any file | Remove |
| `lottery_v2.db` | Any file | Remove |
| `DomainType.LOTTERY` | `gbgf/models.py` | Keep but not required |
| `LotteryDomain` imports | Any file | Remove |
| H6 strategy IDs | Any file | Remove |
| `DAILY_539` references | Any file | Remove |
| `game_type`, `draw_no` | Any file | Remove |
| payout calculations for 539/Big Lotto | Any file | Remove |

---

## 7. Stock-Specific Adapters to Implement

After initial migration, the following must be built for production use:

| Adapter | Priority | Description |
|---|---|---|
| `StockPITDataAdapter` | HIGH | Real PIT database reader (asof-join, no look-ahead) |
| `SurvivorshipGuard` | HIGH | Enforce delisting-inclusive universe |
| `TransactionCostModel` | HIGH | Real bid-ask spread + market impact model |
| `BlockPermutationTest` | MEDIUM | Time-series-aware permutation null (not i.i.d.) |
| `RealOOSWindowSplitter` | MEDIUM | Walk-forward OOS with no refit leakage |
| `FactorHypothesisRegistry` | MEDIUM | Factor library with pre-registration |
| `StockRetirementEngine` | LOW | Stock-specific retirement policy |

---

## 8. Required Stock Project Directory Structure

```
StockResearch/
├── gbgf/                           # Copied from LotteryNew
│   ├── __init__.py
│   ├── models.py
│   ├── gates/
│   │   ├── __init__.py
│   │   └── gate_runner.py
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── stock.py               # Adapted from LotteryNew
│   ├── ev_gate.py
│   ├── evidence_collector.py
│   ├── hypothesis_registry.py
│   ├── knowledge_gate.py
│   ├── leakage_detector.py
│   ├── lesson_accumulator.py
│   ├── models.py
│   ├── multiple_testing.py
│   ├── oos_backtester.py
│   ├── permutation_test.py
│   ├── production_write_guard.py
│   ├── retirement_engine.py
│   ├── rollback_guard.py
│   └── validation_tier.py
├── research/
│   └── poc/
│       ├── sample_stock_ohlcv.csv  # Reference mock data
│       └── stock_momentum_hypothesis.json
├── scripts/
│   ├── run_gbgf_stock_poc.py       # Adapted paths
│   └── verify_stock_poc_reproducibility.py
├── tests/
│   ├── test_gbgf_models.py
│   ├── test_gbgf_gate_runner.py
│   ├── test_gbgf_domain_stock.py
│   └── test_gbgf_retirement_engine.py
├── outputs/
│   └── reproducibility/
│       └── stock_poc_pack_20260505.json
├── requirements.txt
└── README.md
```

---

## 9. Dependency Requirements

```
# requirements.txt (minimum)
pytest>=7.0
```

No external data libraries required for the mock POC.  
For real PIT data, add: `pandas`, `sqlalchemy`, `pyarrow` (project choice).  
**Do not add brokerage SDKs or order APIs.**

---

## 10. First Migration Command Plan

```bash
# Step 1: Create branch in Stock project
cd ~/Projects/StockResearch/
git checkout -b feat/gbgf-integration

# Step 2: Copy GBGF core (from LotteryNew)
LOTTERY_SRC=~/Kelvin-WorkSpace/LotteryNew
cp -r $LOTTERY_SRC/gbgf/models.py                    gbgf/
cp -r $LOTTERY_SRC/gbgf/ev_gate.py                   gbgf/
cp -r $LOTTERY_SRC/gbgf/evidence_collector.py        gbgf/
cp -r $LOTTERY_SRC/gbgf/gates/gate_runner.py         gbgf/gates/
# ... (full list in file_mapping.json)

# Step 3: Copy StockDomain only (NOT LotteryDomain)
cp $LOTTERY_SRC/gbgf/domain/stock.py                 gbgf/domain/
cp $LOTTERY_SRC/gbgf/domain/base.py                  gbgf/domain/

# Step 4: Copy POC scripts and data
cp $LOTTERY_SRC/scripts/run_gbgf_stock_poc.py        scripts/
cp $LOTTERY_SRC/scripts/verify_stock_poc_reproducibility.py scripts/
cp $LOTTERY_SRC/research/stock_poc/*.csv             research/poc/
cp $LOTTERY_SRC/research/stock_poc/*.json            research/poc/

# Step 5: Update path references in scripts
# Edit scripts to point to new directory structure

# Step 6: Run tests
python3 -m pytest tests/ -v

# Step 7: Run dry-run pipeline
python3 scripts/run_gbgf_stock_poc.py --dry-run
```

---

## 11. Validation Commands

```bash
# Unit tests
python3 -m pytest tests/test_gbgf_models.py -v
python3 -m pytest tests/test_gbgf_gate_runner.py -v
python3 -m pytest tests/test_gbgf_domain_stock.py -v
python3 -m pytest tests/test_gbgf_retirement_engine.py -v

# Stock POC dry-run
python3 scripts/run_gbgf_stock_poc.py --dry-run

# Reproducibility verification
python3 scripts/verify_stock_poc_reproducibility.py \
  --pack outputs/reproducibility/stock_poc_pack_20260505.json \
  --skip-rerun

# Safety assertions
grep -r "is_trading_recommendation.*True" outputs/  # must return nothing
grep -r "production_write.*True" outputs/           # must return nothing
grep -r "db_modified.*True" outputs/                # must return nothing
```

---

## 12. Rollback Plan

Since this is a **planning-only task**, no migration has occurred. If a future migration fails:

1. `git checkout main` in the Stock project — removes all changes
2. Delete the `gbgf/` directory if partially copied
3. Re-read this plan and restart from Step 1
4. **No lottery DB rollback needed** — DB is never touched

---

## 13. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| R01: Lottery-specific code leaks into Stock project | HIGH | File mapping exclusion list; grep check post-copy |
| R02: Mock data mistaken for real results | HIGH | Guardrail note; `mock_data=true` flag in all outputs |
| R03: PIT data not enforced | HIGH | `data_is_point_in_time` flag mandatory; SurvivorshipGuard required |
| R04: Transaction costs underestimated | MEDIUM | TransactionCostModel required before production |
| R05: G09 accidentally bypassed | HIGH | Production write guard enforced; test G09 BLOCKED |
| R06: Path divergence between LotteryNew and Stock project | MEDIUM | Update all absolute paths; run tests after copy |
| R07: DB accidentally written | LOW | DB not included in copy list; no lottery API imported |

---

## 14. Done Criteria

- [ ] `gbgf/` core copied to Stock project
- [ ] `gbgf/domain/stock.py` copied; lottery.py / betting.py NOT copied
- [ ] All 4 test files pass in Stock project
- [ ] `run_gbgf_stock_poc.py --dry-run` exits 0 or 1 (1 = G03 FAIL on mock data, expected)
- [ ] `verify_stock_poc_reproducibility.py` achieves 7/7 PASS
- [ ] No `lottery_v2.db` in Stock project
- [ ] No `LotteryDomain` import in any Stock project file
- [ ] `is_trading_recommendation` = False in all outputs
- [ ] `production_write` = False in all outputs
- [ ] Human review confirmed before any production integration
