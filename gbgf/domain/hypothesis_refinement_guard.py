"""
P3-10: Anti-Data-Snooping Guard for Hypothesis Refinement

Enforces structural rules on v3 candidate hypotheses to prevent:
- Candidates without traceable base hypotheses
- Over-proliferation of candidates
- Promotion of symbol-specific or exploratory-only candidates
- Threshold relaxation without explicit tagging
- Direct promotion from a single batch result

This module is READ-ONLY with respect to registry files.
It validates in-memory candidate dicts; it never writes to disk.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_CANDIDATE_COUNT: int = 4

VALID_STATUSES: frozenset[str] = frozenset([
    "registered_candidate",
])

VALID_ALLOWED_SCOPES: frozenset[str] = frozenset([
    "full_validation",
    "exploratory_observation_only",
])

VALID_CHANGE_TYPES: frozenset[str] = frozenset([
    "parameter_change",
    "threshold_relaxation",
    "symbol_specific_probe",
])

# Bases that already have a promotion-eligible refinement assigned.
# Each base may have at most 1 promotion-eligible v3 candidate.
_BASES_WITH_PROMOTION_ELIGIBLE: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Violation types
# ---------------------------------------------------------------------------
@dataclass
class RefinementViolation(Exception):
    rule: str
    candidate_id: str
    detail: str

    def __str__(self) -> str:  # pragma: no cover
        return f"[{self.rule}] {self.candidate_id}: {self.detail}"


# ---------------------------------------------------------------------------
# Guard result
# ---------------------------------------------------------------------------
@dataclass
class RefinementGuardResult:
    candidate_id: str
    passed: bool
    violations: list[RefinementViolation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "passed": self.passed,
            "violations": [
                {"rule": v.rule, "detail": v.detail}
                for v in self.violations
            ],
            "warnings": self.warnings,
        }


# ---------------------------------------------------------------------------
# Core guard
# ---------------------------------------------------------------------------
class HypothesisRefinementGuard:
    """
    Validates that v3 candidate hypotheses comply with anti-data-snooping rules.

    Usage::

        guard = HypothesisRefinementGuard()
        results = guard.validate_candidates(candidates)
        # results: list[RefinementGuardResult]
    """

    def validate_candidate(
        self,
        candidate: dict[str, Any],
        existing_candidates: list[dict[str, Any]] | None = None,
    ) -> RefinementGuardResult:
        """
        Validate a single candidate dict.

        Parameters
        ----------
        candidate:
            The candidate hypothesis dict (as stored in v3 registry).
        existing_candidates:
            Other already-accepted candidates (used for count and
            per-base promotion-eligibility checks).
        """
        cid = candidate.get("hypothesis_id", "<unknown>")
        existing = existing_candidates or []
        violations: list[RefinementViolation] = []
        warnings: list[str] = []

        # Rule 1: Must have base_hypothesis_id
        base = candidate.get("base_hypothesis_id")
        if not base:
            violations.append(RefinementViolation(
                rule="RULE_1_MUST_HAVE_BASE",
                candidate_id=cid,
                detail="candidate is missing 'base_hypothesis_id' — all v3 "
                       "candidates must derive from an existing hypothesis",
            ))

        # Rule 2: candidate count (including this one) must not exceed MAX
        total_count = len(existing) + 1  # +1 for the candidate being checked
        if total_count > MAX_CANDIDATE_COUNT:
            violations.append(RefinementViolation(
                rule="RULE_2_MAX_CANDIDATE_COUNT",
                candidate_id=cid,
                detail=f"adding this candidate would bring total to "
                       f"{total_count}, exceeding the limit of {MAX_CANDIDATE_COUNT}",
            ))

        # Rule 3: exploratory_observation_only scope → promotion_allowed must be false
        scope = candidate.get("allowed_scope", "")
        promotion_allowed = candidate.get("promotion_allowed", True)
        if scope == "exploratory_observation_only" and promotion_allowed is not False:
            violations.append(RefinementViolation(
                rule="RULE_3_EXPLORATORY_NO_PROMOTION",
                candidate_id=cid,
                detail="candidates with allowed_scope='exploratory_observation_only' "
                       "must have promotion_allowed=false",
            ))

        # Rule 4: symbol_specific candidates → promotion_allowed must be false
        if candidate.get("symbol_specific") and promotion_allowed is not False:
            violations.append(RefinementViolation(
                rule="RULE_4_SYMBOL_SPECIFIC_NO_PROMOTION",
                candidate_id=cid,
                detail="symbol-specific candidates must have promotion_allowed=false "
                       "because results are post-hoc and carry high data-snooping risk",
            ))

        # Rule 5: threshold_relaxation change_type → threshold_relaxation flag must be true
        change_type = candidate.get("change_type", "")
        if change_type == "threshold_relaxation" and not candidate.get("threshold_relaxation"):
            violations.append(RefinementViolation(
                rule="RULE_5_THRESHOLD_RELAXATION_FLAG",
                candidate_id=cid,
                detail="candidate with change_type='threshold_relaxation' must "
                       "set threshold_relaxation=true to ensure auditability",
            ))

        # Rule 6: at most 1 promotion-eligible refinement per base
        if base and promotion_allowed is not False:
            for other in existing:
                other_base = other.get("base_hypothesis_id")
                other_promotion = other.get("promotion_allowed", True)
                if other_base == base and other_promotion is not False:
                    violations.append(RefinementViolation(
                        rule="RULE_6_ONE_PROMOTION_PER_BASE",
                        candidate_id=cid,
                        detail=f"base '{base}' already has a promotion-eligible "
                               f"candidate ({other.get('hypothesis_id', '?')}); "
                               f"only one promotion-eligible refinement is allowed per base",
                    ))
                    break

        # Rule 7: status must be registered_candidate
        status = candidate.get("status", "")
        if status not in VALID_STATUSES:
            violations.append(RefinementViolation(
                rule="RULE_7_VALID_STATUS",
                candidate_id=cid,
                detail=f"status='{status}' is not allowed; "
                       f"must be one of {sorted(VALID_STATUSES)}",
            ))

        # Rule 8: allowed_scope must be a valid value
        if scope not in VALID_ALLOWED_SCOPES:
            violations.append(RefinementViolation(
                rule="RULE_8_VALID_SCOPE",
                candidate_id=cid,
                detail=f"allowed_scope='{scope}' is not valid; "
                       f"must be one of {sorted(VALID_ALLOWED_SCOPES)}",
            ))

        # Rule 9: human_review_required must be true
        if not candidate.get("human_review_required"):
            violations.append(RefinementViolation(
                rule="RULE_9_HUMAN_REVIEW",
                candidate_id=cid,
                detail="human_review_required must be true for all v3 candidates",
            ))

        # Rule 10: change_type must be valid
        if change_type and change_type not in VALID_CHANGE_TYPES:
            violations.append(RefinementViolation(
                rule="RULE_10_VALID_CHANGE_TYPE",
                candidate_id=cid,
                detail=f"change_type='{change_type}' is not valid; "
                       f"must be one of {sorted(VALID_CHANGE_TYPES)}",
            ))

        # Warnings (non-blocking)
        snooping_risk = candidate.get("data_snooping_risk", "")
        if "HIGH" in snooping_risk.upper() and promotion_allowed is not False:
            warnings.append(
                f"HIGH data_snooping_risk with promotion_allowed not explicitly false "
                f"— strongly recommend setting promotion_allowed=false"
            )
        if change_type == "threshold_relaxation":
            warnings.append(
                "threshold_relaxation: ensure change was pre-specified before "
                "observing batch validation results"
            )

        passed = len(violations) == 0
        return RefinementGuardResult(
            candidate_id=cid,
            passed=passed,
            violations=violations,
            warnings=warnings,
        )

    def validate_candidates(
        self,
        candidates: list[dict[str, Any]],
    ) -> list[RefinementGuardResult]:
        """
        Validate a full list of candidates sequentially.
        Each candidate is validated against already-validated candidates.
        """
        results: list[RefinementGuardResult] = []
        accepted: list[dict[str, Any]] = []

        # First check total count
        if len(candidates) > MAX_CANDIDATE_COUNT:
            # Return one synthetic result with count violation
            return [RefinementGuardResult(
                candidate_id="<batch>",
                passed=False,
                violations=[RefinementViolation(
                    rule="RULE_2_MAX_CANDIDATE_COUNT",
                    candidate_id="<batch>",
                    detail=f"total candidate count {len(candidates)} exceeds "
                           f"limit of {MAX_CANDIDATE_COUNT}",
                )],
            )]

        for candidate in candidates:
            result = self.validate_candidate(candidate, existing_candidates=accepted)
            results.append(result)
            if result.passed:
                accepted.append(candidate)

        return results

    def assert_valid(
        self,
        candidates: list[dict[str, Any]],
    ) -> None:
        """
        Validate all candidates and raise RefinementViolation on first failure.
        Convenience method for use in tests.
        """
        results = self.validate_candidates(candidates)
        for r in results:
            if not r.passed:
                raise r.violations[0]


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------
def validate_v3_registry(registry: dict[str, Any]) -> list[RefinementGuardResult]:
    """
    Validate a v3 candidates registry dict (as loaded from JSON).
    Returns list of RefinementGuardResult.
    """
    candidates = registry.get("hypotheses", [])
    max_limit = registry.get("max_candidate_count", MAX_CANDIDATE_COUNT)

    guard = HypothesisRefinementGuard()

    if len(candidates) > max_limit:
        return [RefinementGuardResult(
            candidate_id="<registry>",
            passed=False,
            violations=[RefinementViolation(
                rule="RULE_2_MAX_CANDIDATE_COUNT",
                candidate_id="<registry>",
                detail=f"registry has {len(candidates)} candidates, "
                       f"exceeding max_candidate_count={max_limit}",
            )],
        )]

    return guard.validate_candidates(candidates)
