from .models import StrategyState

class RollbackGuard:
    MIN_OUTCOMES_FOR_ROLLBACK = 5
    MIN_CONSECUTIVE_NEGATIVE = 3

    def __init__(self, min_outcomes: int = 5, min_consecutive: int = 3):
        self.min_outcomes = min_outcomes
        self.min_consecutive = min_consecutive

    def can_rollback(self, state: StrategyState) -> tuple:
        """Returns (allowed, reason)."""
        if state.live_outcome_count < self.min_outcomes:
            return False, f"Insufficient outcomes: {state.live_outcome_count} < {self.min_outcomes} required"
        if state.consecutive_negative < self.min_consecutive:
            return False, f"Insufficient consecutive negative: {state.consecutive_negative} < {self.min_consecutive} required"
        return True, "Rollback conditions met"

    def require_min_samples(self) -> dict:
        return {
            "min_outcomes": self.min_outcomes,
            "min_consecutive_negative": self.min_consecutive,
        }
