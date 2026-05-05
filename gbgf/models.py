from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
import json

class DomainType(Enum):
    LOTTERY = "LOTTERY"
    STOCK = "STOCK"
    BETTING = "BETTING"

class GateStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    BLOCKED = "BLOCKED"
    SKIPPED = "SKIPPED"

class ValidationTier(Enum):
    T0_EXPLORATORY = "T0_EXPLORATORY"
    T1_REGISTERED = "T1_REGISTERED"
    T2_VALIDATED = "T2_VALIDATED"
    T3_DEPLOYABLE = "T3_DEPLOYABLE"
    T4_PRODUCTION_ALLOWED = "T4_PRODUCTION_ALLOWED"
    RETIRED = "RETIRED"

@dataclass
class Hypothesis:
    id: str
    name: str
    domain: DomainType
    registered_at: str
    pre_registered: bool = True
    family: str = "default"
    notes: str = ""

@dataclass
class BacktestResult:
    strategy_id: str
    window_label: str
    edge_pp: float
    p_value: float
    n_samples: int
    passed_degraded_threshold: bool
    notes: str = ""

@dataclass
class GateResult:
    gate_id: str
    gate_name: str
    status: GateStatus
    message: str
    evidence: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        d = asdict(self)
        d["status"] = self.status.value
        return d

    def to_json(self):
        return json.dumps(self.to_dict(), ensure_ascii=False)

@dataclass
class StrategyState:
    strategy_id: str
    domain: DomainType
    tier: ValidationTier
    human_review_complete: bool = False
    dry_run_passed: bool = False
    has_critical_failure: bool = False
    live_outcome_count: int = 0
    consecutive_negative: int = 0
    ev_classification: str = ""
    notes: str = ""

@dataclass
class RetirementDecision:
    strategy_id: str
    retire: bool
    reason_code: str
    reason: str
    immediate: bool = False
    human_review_required: bool = False
    notes: str = ""

@dataclass
class EvidenceBundle:
    strategy_id: str
    gate_results: List[GateResult] = field(default_factory=list)
    backtest_results: List[BacktestResult] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return {
            "strategy_id": self.strategy_id,
            "gate_results": [r.to_dict() for r in self.gate_results],
            "backtest_results": [asdict(r) for r in self.backtest_results],
            "metadata": self.metadata,
        }
