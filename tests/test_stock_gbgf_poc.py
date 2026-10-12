"""
tests/test_gbgf_domain_stock.py — P3-02
Tests for StockDomain adapter (P3 POC).
"""

import csv
import json
import os
import pytest
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "research", "stock_poc", "sample_stock_ohlcv.csv")
HYP_PATH = os.path.join(BASE_DIR, "research", "stock_poc", "stock_momentum_hypothesis.json")


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def adapter():
    from gbgf.domain.stock import StockDomain
    return StockDomain(csv_path=CSV_PATH, hypothesis_path=HYP_PATH)


@pytest.fixture
def state():
    from gbgf.models import StrategyState, DomainType, ValidationTier
    return StrategyState(
        strategy_id="STOCK_POC_SIMPLE_20D_MOMENTUM_001",
        domain=DomainType.STOCK,
        tier=ValidationTier.T1_REGISTERED,
    )


# ─── Domain type ─────────────────────────────────────────────────────────────

def test_stock_domain_type(adapter):
    from gbgf.models import DomainType
    assert adapter.domain_type() == DomainType.STOCK


# ─── CSV data loading ─────────────────────────────────────────────────────────

def test_stock_csv_exists():
    assert os.path.exists(CSV_PATH), f"CSV not found: {CSV_PATH}"


def test_stock_csv_has_required_columns():
    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
    required = {"date", "symbol", "open", "high", "low", "close", "volume"}
    assert required.issubset(set(fields)), f"Missing columns: {required - set(fields)}"


def test_stock_csv_two_symbols(adapter):
    rows = adapter._load_csv()
    symbols = {r["symbol"] for r in rows}
    assert len(symbols) >= 2, f"Expected ≥2 symbols, got {len(symbols)}: {symbols}"


def test_stock_csv_120_trading_days_per_symbol(adapter):
    rows = adapter._load_csv()
    symbols = {r["symbol"] for r in rows}
    for sym in symbols:
        sym_rows = [r for r in rows if r["symbol"] == sym]
        assert len(sym_rows) >= 120, (
            f"Symbol {sym}: expected ≥120 trading days, got {len(sym_rows)}"
        )


def test_stock_csv_pit_flag(adapter):
    rows = adapter._load_csv()
    non_pit = [r for r in rows if r.get("data_is_point_in_time") != "true"]
    assert len(non_pit) == 0, f"{len(non_pit)} rows missing data_is_point_in_time=true"


# ─── Hypothesis JSON ──────────────────────────────────────────────────────────

def test_hypothesis_json_parseable():
    assert os.path.exists(HYP_PATH), f"Hypothesis JSON not found: {HYP_PATH}"
    with open(HYP_PATH) as f:
        hyp = json.load(f)
    assert isinstance(hyp, dict)


def test_hypothesis_has_required_fields():
    with open(HYP_PATH) as f:
        hyp = json.load(f)
    required = {
        "hypothesis_id", "domain", "strategy_name", "registered_at",
        "prediction_target", "expected_direction", "min_oos_window",
        "transaction_cost_bps", "human_review_required",
    }
    missing = required - set(hyp.keys())
    assert not missing, f"Hypothesis JSON missing fields: {missing}"


def test_hypothesis_domain_is_stock():
    with open(HYP_PATH) as f:
        hyp = json.load(f)
    assert hyp["domain"] == "STOCK"


def test_hypothesis_human_review_required():
    with open(HYP_PATH) as f:
        hyp = json.load(f)
    assert hyp["human_review_required"] is True


def test_hypothesis_not_trading_recommendation():
    with open(HYP_PATH) as f:
        hyp = json.load(f)
    notes = hyp.get("notes", "").lower()
    status = hyp.get("status", "").lower()
    assert "not a trading" in notes or "unvalidated" in status, (
        "Hypothesis JSON must clearly state it is not a trading recommendation"
    )


# ─── validate_input_data ─────────────────────────────────────────────────────

def test_validate_input_data_passes(adapter):
    valid, msg = adapter.validate_input_data()
    assert valid is True, f"validate_input_data failed: {msg}"
    assert "MOCK DATA" in msg or "PIT" in msg


def test_validate_no_data_fails():
    from gbgf.domain.stock import StockDomain
    empty = StockDomain(csv_path="/nonexistent/path.csv")
    valid, msg = empty.validate_input_data()
    assert valid is False


# ─── detect_leakage ───────────────────────────────────────────────────────────

def test_detect_leakage_passes_with_pit_data(adapter):
    clean, msg = adapter.detect_leakage({})
    assert clean is True
    # Must surface survivorship risk in message
    assert "survivorship" in msg.lower() or "PIT" in msg


def test_detect_leakage_fails_without_csv():
    from gbgf.domain.stock import StockDomain
    empty = StockDomain(csv_path="/nonexistent/path.csv")
    clean, msg = empty.detect_leakage({})
    assert clean is False


# ─── compute_ev ──────────────────────────────────────────────────────────────

def test_compute_ev_returns_dict(adapter, state):
    ev = adapter.compute_ev(state)
    assert isinstance(ev, dict)


def test_compute_ev_has_classification(adapter, state):
    ev = adapter.compute_ev(state)
    assert "classification" in ev
    # Must be a GBGF-recognized classification (not a free-form string)
    valid_classifications = {
        "EV_POSITIVE", "VALID_SIGNAL_NON_MONETIZABLE",
        "EV_NEGATIVE_BY_DESIGN", "STOCK_POC_NO_SIGNAL",
    }
    assert ev["classification"] in valid_classifications, (
        f"Unexpected classification: {ev['classification']}"
    )


def test_compute_ev_surfaces_pit_risks(adapter, state):
    ev = adapter.compute_ev(state)
    assert "pit_risks" in ev
    assert isinstance(ev["pit_risks"], list)
    assert len(ev["pit_risks"]) >= 3  # at least: PIT, survivorship, tx cost


def test_compute_ev_includes_mock_flag(adapter, state):
    ev = adapter.compute_ev(state)
    assert ev.get("mock_data") is True


def test_compute_ev_does_not_write_db(adapter, state, tmp_path):
    # Stock project: verify compute_ev produces no side-effect file writes
    import hashlib, json
    sentinel = tmp_path / "stock_sentinel.json"
    sentinel.write_text(json.dumps({"marker": "before"}))
    before = hashlib.md5(sentinel.read_bytes()).hexdigest()
    adapter.compute_ev(state)
    after = hashlib.md5(sentinel.read_bytes()).hexdigest()
    assert before == after, "compute_ev must not modify external files"


# ─── GateRunner integration ───────────────────────────────────────────────────

def test_gate_runner_runs_all_gates_for_stock(adapter, state):
    from gbgf.gates.gate_runner import GateRunner
    from gbgf.models import EvidenceBundle, GateStatus

    bundle = EvidenceBundle(strategy_id=state.strategy_id)
    bundle.metadata["hypothesis_pre_registered"] = True
    bundle.metadata["data_meta"] = {"temporal_order_ok": True, "target_access_ok": True, "pit_enforced": True}
    bundle.metadata["permutation_p_value"] = None
    bundle.metadata["bh_fdr_pass"] = None

    runner = GateRunner()
    results = runner.run_all(
        strategy_state=state,
        evidence_bundle=bundle,
        domain_adapter=adapter,
        human_review=False,
        dry_run_passed=False,
    )
    gate_ids = [r.gate_id for r in results]
    assert gate_ids == ["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09", "G10"]


def test_g01_passes_when_hypothesis_registered(adapter, state):
    from gbgf.gates.gate_runner import GateRunner
    from gbgf.models import EvidenceBundle, GateStatus

    bundle = EvidenceBundle(strategy_id=state.strategy_id)
    bundle.metadata["hypothesis_pre_registered"] = True
    bundle.metadata["data_meta"] = {}

    runner = GateRunner()
    results = runner.run_all(state, bundle, adapter, human_review=False, dry_run_passed=False)
    g01 = next(r for r in results if r.gate_id == "G01")
    assert g01.status == GateStatus.PASS


def test_g09_blocked_for_stock_without_human_review(adapter, state):
    from gbgf.gates.gate_runner import GateRunner
    from gbgf.models import EvidenceBundle, GateStatus

    bundle = EvidenceBundle(strategy_id=state.strategy_id)
    bundle.metadata["hypothesis_pre_registered"] = True
    bundle.metadata["data_meta"] = {}

    runner = GateRunner()
    results = runner.run_all(state, bundle, adapter, human_review=False, dry_run_passed=False)
    g09 = next(r for r in results if r.gate_id == "G09")
    assert g09.status == GateStatus.BLOCKED


def test_g10_never_auto_passes_for_stock(adapter, state):
    from gbgf.gates.gate_runner import GateRunner
    from gbgf.models import EvidenceBundle, GateStatus

    bundle = EvidenceBundle(strategy_id=state.strategy_id)
    bundle.metadata["hypothesis_pre_registered"] = True
    bundle.metadata["data_meta"] = {}

    runner = GateRunner()
    # Even with human_review=True, G10 must not PASS (only WARN)
    results = runner.run_all(state, bundle, adapter, human_review=True, dry_run_passed=True)
    g10 = next(r for r in results if r.gate_id == "G10")
    assert g10.status != GateStatus.PASS, "G10 must never auto-PASS"


# ─── format_report_context ────────────────────────────────────────────────────

def test_format_report_context(adapter, state):
    ctx = adapter.format_report_context(state)
    assert ctx["domain"] == "STOCK"
    assert "pit_risks" in ctx
    assert "warnings" in ctx


# ─── Reproducibility pack ─────────────────────────────────────────────────────

def test_stock_poc_reproducibility_pack_exists():
    pack_path = Path(BASE_DIR) / "outputs" / "stock_poc" / "reproducibility" / "stock_poc_pack_20260505.json"
    assert pack_path.exists(), f"Reproducibility pack not found: {pack_path}"


def test_stock_poc_reproducibility_pack_parseable():
    pack_path = Path(BASE_DIR) / "outputs" / "stock_poc" / "reproducibility" / "stock_poc_pack_20260505.json"
    if not pack_path.exists():
        pytest.skip("Pack not found")
    pack = json.loads(pack_path.read_text())
    required = {
        "run_id", "strategy_id", "domain", "final_classification",
        "gate_statuses", "source_artifact_sha256", "gate_result_sha256",
        "safety_confirmations", "reproduction_command", "expected_classification",
    }
    missing = required - set(pack.keys())
    assert not missing, f"Pack missing keys: {missing}"


def test_stock_poc_pack_safety_confirmations():
    pack_path = Path(BASE_DIR) / "outputs" / "stock_poc" / "reproducibility" / "stock_poc_pack_20260505.json"
    if not pack_path.exists():
        pytest.skip("Pack not found")
    pack = json.loads(pack_path.read_text())
    safety = pack["safety_confirmations"]
    assert safety["no_db_write"] is True
    assert safety["no_production_write"] is True
    assert safety["is_trading_recommendation"] is False
    assert safety["dry_run"] is True


def test_stock_gate_result_json_parseable():
    result_path = Path(BASE_DIR) / "outputs" / "stock_poc" / "stock_poc_gate_result.json"
    if not result_path.exists():
        pytest.skip("Gate result not found — run scripts/run_gbgf_stock_poc.py first")
    result = json.loads(result_path.read_text())
    assert result["domain"] == "STOCK"
    assert result["db_modified"] is False
    assert result["production_write"] is False
    assert result["is_trading_recommendation"] is False
