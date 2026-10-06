from .models import ValidationTier, StrategyState

TIER_ORDER = [
    ValidationTier.T0_EXPLORATORY,
    ValidationTier.T1_REGISTERED,
    ValidationTier.T2_VALIDATED,
    ValidationTier.T3_DEPLOYABLE,
    ValidationTier.T4_PRODUCTION_ALLOWED,
]

class ValidationTierTracker:
    def can_promote(self, state: StrategyState) -> bool:
        if state.tier == ValidationTier.RETIRED:
            return False
        if state.tier == ValidationTier.T3_DEPLOYABLE:
            return state.human_review_complete and not state.has_critical_failure
        return not state.has_critical_failure

    def promote(self, state: StrategyState) -> StrategyState:
        if not self.can_promote(state):
            return state
        idx = TIER_ORDER.index(state.tier) if state.tier in TIER_ORDER else -1
        if idx < len(TIER_ORDER) - 1:
            state.tier = TIER_ORDER[idx + 1]
        return state

    def retire(self, state: StrategyState) -> StrategyState:
        state.tier = ValidationTier.RETIRED
        return state
