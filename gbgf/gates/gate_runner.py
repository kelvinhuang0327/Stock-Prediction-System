from typing import List
from ..models import GateResult, GateStatus, StrategyState, EvidenceBundle, ValidationTier
from ..domain.base import DomainAdapter

CRITICAL_GATES = {"G01", "G02", "G03", "G04", "G05"}
PRODUCTION_GATES = {"G09", "G10"}

class GateRunner:
    def run_all(
        self,
        strategy_state: StrategyState,
        evidence_bundle: EvidenceBundle,
        domain_adapter: DomainAdapter,
        human_review: bool = False,
        dry_run_passed: bool = False,
    ) -> List[GateResult]:
        results = []
        has_critical_failure = False

        # G01: Hypothesis Registry Gate
        g01 = self._run_g01(strategy_state, evidence_bundle)
        results.append(g01)
        if g01.status == GateStatus.FAIL:
            has_critical_failure = True

        # G02: Data Leakage Gate
        g02 = self._run_g02(strategy_state, evidence_bundle, domain_adapter)
        results.append(g02)
        if g02.status == GateStatus.FAIL:
            has_critical_failure = True

        # G03: OOS Validation Gate
        g03 = self._run_g03(strategy_state, evidence_bundle)
        results.append(g03)
        if g03.status == GateStatus.FAIL:
            has_critical_failure = True

        # G04: Permutation Null Gate
        g04 = self._run_g04(strategy_state, evidence_bundle)
        results.append(g04)
        if g04.status == GateStatus.FAIL:
            has_critical_failure = True

        # G05: Multiple Testing Gate
        g05 = self._run_g05(strategy_state, evidence_bundle)
        results.append(g05)
        if g05.status == GateStatus.FAIL:
            has_critical_failure = True

        # G06: EV / ROI Gate
        g06 = self._run_g06(strategy_state, evidence_bundle, domain_adapter)
        results.append(g06)

        # G07: Live Monitoring Gate
        g07 = self._run_g07(strategy_state)
        results.append(g07)

        # G08: Retirement Gate
        g08 = self._run_g08(strategy_state)
        results.append(g08)

        # G09: Production Write Gate — BLOCKED if critical failure or missing human review
        g09 = self._run_g09(strategy_state, has_critical_failure, human_review, dry_run_passed)
        results.append(g09)

        # G10: Human Review Gate — never auto-PASS
        g10 = self._run_g10(human_review)
        results.append(g10)

        strategy_state.has_critical_failure = has_critical_failure
        return results

    def _run_g01(self, state: StrategyState, bundle: EvidenceBundle) -> GateResult:
        registered = bundle.metadata.get("hypothesis_pre_registered", False)
        if registered:
            return GateResult("G01", "Hypothesis Registry Gate", GateStatus.PASS,
                              "Hypothesis pre-registered", {"pre_registered": True})
        return GateResult("G01", "Hypothesis Registry Gate", GateStatus.FAIL,
                          "Hypothesis not pre-registered — post-hoc research rejected",
                          {"pre_registered": False})

    def _run_g02(self, state: StrategyState, bundle: EvidenceBundle, adapter: DomainAdapter) -> GateResult:
        clean, msg = adapter.detect_leakage(bundle.metadata.get("data_meta", {}))
        status = GateStatus.PASS if clean else GateStatus.FAIL
        return GateResult("G02", "Data Leakage Gate", status, msg, {"leakage_clean": clean})

    def _run_g03(self, state: StrategyState, bundle: EvidenceBundle) -> GateResult:
        results = bundle.backtest_results
        if not results:
            return GateResult("G03", "OOS Validation Gate", GateStatus.WARN,
                              "No backtest results in evidence bundle", {})
        passing = [r for r in results if r.edge_pp >= 2.0 and r.p_value < 0.05]
        if len(passing) == len(results):
            return GateResult("G03", "OOS Validation Gate", GateStatus.PASS,
                              f"All {len(results)} OOS windows pass DEGRADED threshold",
                              {"passing": len(passing), "total": len(results)})
        return GateResult("G03", "OOS Validation Gate", GateStatus.FAIL,
                          f"Only {len(passing)}/{len(results)} OOS windows pass",
                          {"passing": len(passing), "total": len(results)})

    def _run_g04(self, state: StrategyState, bundle: EvidenceBundle) -> GateResult:
        p_value = bundle.metadata.get("permutation_p_value", None)
        if p_value is None:
            return GateResult("G04", "Permutation Null Gate", GateStatus.WARN,
                              "No permutation p-value in evidence bundle", {})
        if p_value < 0.05:
            return GateResult("G04", "Permutation Null Gate", GateStatus.PASS,
                              f"p={p_value:.4f} < 0.05", {"p_value": p_value})
        return GateResult("G04", "Permutation Null Gate", GateStatus.FAIL,
                          f"p={p_value:.4f} >= 0.05 — strategy classified as noise",
                          {"p_value": p_value})

    def _run_g05(self, state: StrategyState, bundle: EvidenceBundle) -> GateResult:
        bh_pass = bundle.metadata.get("bh_fdr_pass", None)
        if bh_pass is None:
            return GateResult("G05", "Multiple Testing Gate", GateStatus.WARN,
                              "No BH-FDR result in evidence bundle", {})
        if bh_pass:
            return GateResult("G05", "Multiple Testing Gate", GateStatus.PASS,
                              "Passes BH-FDR correction", {"bh_fdr_pass": True})
        return GateResult("G05", "Multiple Testing Gate", GateStatus.FAIL,
                          "Fails BH-FDR correction — likely noise after multiple testing",
                          {"bh_fdr_pass": False})

    def _run_g06(self, state: StrategyState, bundle: EvidenceBundle, adapter: DomainAdapter) -> GateResult:
        ev_result = adapter.compute_ev(state)
        classification = ev_result.get("classification", "UNKNOWN")
        if classification == "EV_POSITIVE":
            return GateResult("G06", "EV / ROI Gate", GateStatus.PASS,
                              "EV positive — strategy is monetizable", ev_result)
        if classification in ("VALID_SIGNAL_NON_MONETIZABLE", "EV_NEGATIVE_BY_DESIGN"):
            return GateResult("G06", "EV / ROI Gate", GateStatus.WARN,
                              f"EV negative by design. Classification: {classification}. Not recommended for production betting.",
                              ev_result)
        return GateResult("G06", "EV / ROI Gate", GateStatus.FAIL,
                          f"EV gate inconclusive: {classification}", ev_result)

    def _run_g07(self, state: StrategyState) -> GateResult:
        if state.live_outcome_count < 5:
            return GateResult("G07", "Live Monitoring Gate", GateStatus.WARN,
                              f"Insufficient live outcomes: {state.live_outcome_count} (need >=5 for reliable monitoring)",
                              {"live_outcome_count": state.live_outcome_count})
        if state.consecutive_negative >= 3:
            return GateResult("G07", "Live Monitoring Gate", GateStatus.WARN,
                              f"Warning: {state.consecutive_negative} consecutive negative periods",
                              {"consecutive_negative": state.consecutive_negative})
        return GateResult("G07", "Live Monitoring Gate", GateStatus.PASS,
                          "Live monitoring OK", {"live_outcome_count": state.live_outcome_count})

    def _run_g08(self, state: StrategyState) -> GateResult:
        if state.tier == ValidationTier.RETIRED:
            return GateResult("G08", "Retirement Gate", GateStatus.FAIL,
                              "Strategy is RETIRED", {"tier": state.tier.value})
        return GateResult("G08", "Retirement Gate", GateStatus.PASS,
                          "No retirement condition triggered", {"tier": state.tier.value})

    def _run_g09(self, state: StrategyState, has_critical_failure: bool,
                 human_review: bool, dry_run_passed: bool) -> GateResult:
        if has_critical_failure:
            return GateResult("G09", "Production Write Gate", GateStatus.BLOCKED,
                              "Blocked: critical gate failure upstream", {"reason": "critical_failure"})
        if not human_review:
            return GateResult("G09", "Production Write Gate", GateStatus.BLOCKED,
                              "Blocked: human review not completed", {"human_review": False})
        if not dry_run_passed:
            return GateResult("G09", "Production Write Gate", GateStatus.BLOCKED,
                              "Blocked: dry-run not passed", {"dry_run_passed": False})
        if state.tier != ValidationTier.T4_PRODUCTION_ALLOWED:
            return GateResult("G09", "Production Write Gate", GateStatus.BLOCKED,
                              f"Blocked: strategy not at T4 (current: {state.tier.value})",
                              {"tier": state.tier.value})
        return GateResult("G09", "Production Write Gate", GateStatus.PASS,
                          "Production write approved (T4 + human review + dry-run passed)", {})

    def _run_g10(self, human_review: bool) -> GateResult:
        if not human_review:
            return GateResult("G10", "Human Review Gate", GateStatus.BLOCKED,
                              "Human review not yet completed. Agent cannot auto-approve.",
                              {"human_review": False, "auto_approval": "NEVER_ALLOWED"})
        return GateResult("G10", "Human Review Gate", GateStatus.WARN,
                          "Human review marked complete. Verify externally — agent cannot self-validate.",
                          {"human_review": True, "note": "Agent acknowledges; cannot self-verify"})
