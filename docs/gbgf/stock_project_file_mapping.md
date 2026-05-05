# GBGF → Stock Project File Mapping

**Version:** 1.0  
**Date:** 2026-05-05  
**Task:** P3-03  

Legend: **COPY** = copy verbatim | **ADAPT** = copy then modify | **EXCLUDE** = do not copy

---

## GBGF Core

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `gbgf/__init__.py` | `gbgf/__init__.py` | COPY | Framework entry point; domain-agnostic |
| `gbgf/models.py` | `gbgf/models.py` | COPY | All shared dataclasses/enums; no lottery coupling |
| `gbgf/ev_gate.py` | `gbgf/ev_gate.py` | COPY | EV gate logic; domain-agnostic |
| `gbgf/evidence_collector.py` | `gbgf/evidence_collector.py` | COPY | Evidence bundle builder; domain-agnostic |
| `gbgf/hypothesis_registry.py` | `gbgf/hypothesis_registry.py` | COPY | Pre-registration enforcer; domain-agnostic |
| `gbgf/knowledge_gate.py` | `gbgf/knowledge_gate.py` | COPY | Knowledge gate; domain-agnostic |
| `gbgf/leakage_detector.py` | `gbgf/leakage_detector.py` | COPY | Leakage detection base; domain-agnostic |
| `gbgf/lesson_accumulator.py` | `gbgf/lesson_accumulator.py` | COPY | Lesson storage; domain-agnostic |
| `gbgf/multiple_testing.py` | `gbgf/multiple_testing.py` | COPY | BH-FDR correction; domain-agnostic |
| `gbgf/oos_backtester.py` | `gbgf/oos_backtester.py` | COPY | OOS window logic; domain-agnostic |
| `gbgf/permutation_test.py` | `gbgf/permutation_test.py` | COPY | Permutation null test; domain-agnostic |
| `gbgf/production_write_guard.py` | `gbgf/production_write_guard.py` | COPY | Safety guard; critical for stock |
| `gbgf/retirement_engine.py` | `gbgf/retirement_engine.py` | COPY | Strategy retirement; domain-agnostic |
| `gbgf/rollback_guard.py` | `gbgf/rollback_guard.py` | COPY | Rollback protection; domain-agnostic |
| `gbgf/validation_tier.py` | `gbgf/validation_tier.py` | COPY | Validation tier enum; domain-agnostic |
| `gbgf/gates/__init__.py` | `gbgf/gates/__init__.py` | COPY | Gate package init |
| `gbgf/gates/gate_runner.py` | `gbgf/gates/gate_runner.py` | COPY | G01–G10 implementation; domain-agnostic |

---

## Domain Adapters

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `gbgf/domain/__init__.py` | `gbgf/domain/__init__.py` | COPY | Domain package init |
| `gbgf/domain/base.py` | `gbgf/domain/base.py` | COPY | DomainAdapter ABC; required by all adapters |
| `gbgf/domain/stock.py` | `gbgf/domain/stock.py` | ADAPT | Core stock adapter — mock CSV path must be updated to real PIT data source |
| `gbgf/domain/lottery.py` | *(excluded)* | EXCLUDE | Lottery-specific: reads lottery_v2.db, H6 JSON, DAILY_539 payout model |
| `gbgf/domain/betting.py` | *(excluded)* | EXCLUDE | Betting-specific: CLV placeholder — not relevant to stock |

---

## Scripts

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `scripts/run_gbgf_stock_poc.py` | `scripts/run_gbgf_stock_poc.py` | ADAPT | Update CSV/hypothesis paths for new directory structure |
| `scripts/verify_stock_poc_reproducibility.py` | `scripts/verify_stock_poc_reproducibility.py` | ADAPT | Update ROOT path and pack path for new directory |
| `scripts/run_gbgf_h6_gate_pipeline.py` | *(excluded)* | EXCLUDE | H6/Lottery-specific pipeline |
| `scripts/verify_h6_gbgf_reproducibility.py` | *(excluded)* | EXCLUDE | H6/Lottery-specific verifier |

---

## Research / Mock Data

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `research/stock_poc/sample_stock_ohlcv.csv` | `research/poc/sample_stock_ohlcv.csv` | ADAPT | Reference only — must be replaced with real PIT data |
| `research/stock_poc/stock_momentum_hypothesis.json` | `research/poc/stock_momentum_hypothesis.json` | COPY | Hypothesis template — update registered_at |
| `research/daily539_long_window_validation_20260428.py` | *(excluded)* | EXCLUDE | Lottery-specific research script |

---

## Tests

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `tests/test_gbgf_models.py` | `tests/test_gbgf_models.py` | COPY | Model unit tests; domain-agnostic |
| `tests/test_gbgf_gate_runner.py` | `tests/test_gbgf_gate_runner.py` | COPY | GateRunner unit tests; domain-agnostic |
| `tests/test_gbgf_domain_stock.py` | `tests/test_gbgf_domain_stock.py` | ADAPT | Update BASE_DIR and CSV/hypothesis paths |
| `tests/test_gbgf_retirement_engine.py` | `tests/test_gbgf_retirement_engine.py` | COPY | Retirement engine tests; domain-agnostic |
| `tests/test_gbgf_domain_lottery.py` | *(excluded)* | EXCLUDE | Lottery-specific; requires lottery_v2.db |

---

## Outputs / Reproducibility

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `outputs/reproducibility/stock_poc_pack_20260505.json` | `outputs/reproducibility/stock_poc_pack_20260505.json` | COPY | Baseline reproducibility pack for verification |
| `outputs/reproducibility/h6_gbgf_pack_20260505.json` | *(excluded)* | EXCLUDE | H6/Lottery-specific evidence |
| `outputs/reproducibility/h6_gbgf_pack_20260505.md` | *(excluded)* | EXCLUDE | H6/Lottery-specific evidence |
| `outputs/stock_poc_gate_result.json` | `outputs/stock_poc_gate_result.json` | COPY | Stock POC gate results |
| `outputs/stock_poc_gate_report.md` | `outputs/stock_poc_gate_report.md` | COPY | Stock POC gate report |
| `outputs/h6_gate_pipeline_result.json` | *(excluded)* | EXCLUDE | H6/Lottery specific |
| `outputs/h6_gate_pipeline_report.md` | *(excluded)* | EXCLUDE | H6/Lottery specific |
| `outputs/h6_long_window_validation.json` | *(excluded)* | EXCLUDE | H6 research artifact |
| `outputs/h6_long_window_validation.md` | *(excluded)* | EXCLUDE | H6 research artifact |
| `outputs/daily539_payout_ev_analysis.json` | *(excluded)* | EXCLUDE | Lottery payout model |
| `outputs/daily539_payout_ev_analysis.md` | *(excluded)* | EXCLUDE | Lottery payout model |
| `outputs/research_closure_report.json` | *(excluded)* | EXCLUDE | Lottery research closure |
| `outputs/strategy_retirement_policy_summary.json` | *(excluded)* | EXCLUDE | Lottery-specific |
| `outputs/forbidden_strategy_patterns.json` | *(excluded)* | EXCLUDE | Lottery-specific |

---

## Framework Planning / Reference Docs

| Source in LotteryNew | Target in Stock Project | Action | Reason |
|---|---|---|---|
| `outputs/framework_gate_spec.json` | `outputs/framework_gate_spec.json` | COPY | G01–G10 spec; domain-agnostic reference |
| `outputs/framework_transfer_roadmap.json` | `outputs/framework_roadmap.json` | ADAPT | Update phases for stock-only roadmap |
| `outputs/domain_transfer_risk_register.json` | `outputs/stock_risk_register.json` | ADAPT | Extract stock-specific risks only |
| `outputs/transfer_mapping_matrix.json` | *(excluded)* | EXCLUDE | Multi-domain comparison document |

---

## Summary Counts

| Action | Count |
|---|---|
| COPY | 21 |
| ADAPT | 7 |
| EXCLUDE | 25+ |
