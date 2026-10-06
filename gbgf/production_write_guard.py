from .models import StrategyState, ValidationTier

class ProductionWriteGuard:
    def can_write(self, state: StrategyState, human_review: bool = False, dry_run_passed: bool = False) -> tuple:
        """
        Returns (allowed, reason).
        Production write requires: T4 status + human_review=True + dry_run_passed=True.
        """
        if state.tier != ValidationTier.T4_PRODUCTION_ALLOWED:
            return False, f"Strategy is not at T4. Current tier: {state.tier.value}"
        if not human_review:
            return False, "Human review not completed. Production write blocked."
        if not dry_run_passed:
            return False, "Dry-run not passed. Production write blocked."
        if state.has_critical_failure:
            return False, "Strategy has critical failure flag. Production write blocked."
        return True, "Production write approved"

    def require_human_review(self) -> str:
        return "Human review is mandatory before any production write. No automated bypass allowed."
