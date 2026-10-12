from .models import StrategyState, BacktestResult, RetirementDecision

class RetirementEngine:
    MIN_CONSECUTIVE_NEGATIVE = 5
    LIVE_DEGRADED_THRESHOLD_PP = -2.0

    def evaluate(self, state: StrategyState, latest_backtest: BacktestResult = None) -> RetirementDecision:
        """Evaluate all retirement conditions R01-R10. Returns RetirementDecision."""

        # R04: EV negative by design (non-monetizable — not a retirement trigger, but flag)
        if state.ev_classification in ("EV_NEGATIVE_BY_DESIGN", "VALID_SIGNAL_NON_MONETIZABLE"):
            return RetirementDecision(
                strategy_id=state.strategy_id,
                retire=False,
                reason_code="R04",
                reason="EV negative by design or non-monetizable. Strategy may continue as research signal only.",
                immediate=False,
                human_review_required=False,
                notes="VALID_SIGNAL_NON_MONETIZABLE: not retired, classified as research-only"
            )

        # R01: Long-window OOS fail
        if latest_backtest is not None and not latest_backtest.passed_degraded_threshold:
            return RetirementDecision(
                strategy_id=state.strategy_id,
                retire=True,
                reason_code="R01",
                reason="Long-window OOS validation failed: edge below DEGRADED threshold",
                immediate=False,
                human_review_required=True,
            )

        # R06: Circular bias / R07: Leakage detected
        if "circular_bias" in state.notes.lower():
            return RetirementDecision(
                strategy_id=state.strategy_id,
                retire=True,
                reason_code="R06",
                reason="Circular match bias detected — immediate retirement required",
                immediate=True,
                human_review_required=True,
            )

        # R10: Live degradation threshold breach
        if (state.consecutive_negative >= self.MIN_CONSECUTIVE_NEGATIVE and
                state.live_outcome_count >= 5):
            return RetirementDecision(
                strategy_id=state.strategy_id,
                retire=True,
                reason_code="R10",
                reason=f"Live degradation: {state.consecutive_negative} consecutive negative periods",
                immediate=False,
                human_review_required=True,
            )

        return RetirementDecision(
            strategy_id=state.strategy_id,
            retire=False,
            reason_code="NONE",
            reason="No retirement condition triggered",
        )

    def apply_policy(self, decision: RetirementDecision, state: StrategyState) -> StrategyState:
        from .models import ValidationTier
        if decision.retire:
            state.tier = ValidationTier.RETIRED
            state.has_critical_failure = True
        return state
