from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from ..models import DomainType, BacktestResult, StrategyState

class DomainAdapter(ABC):
    @abstractmethod
    def domain_type(self) -> DomainType:
        pass

    @abstractmethod
    def validate_input_data(self, data: Any) -> tuple:
        """Returns (valid: bool, message: str)."""
        pass

    @abstractmethod
    def get_prediction_target(self) -> str:
        """Returns description of what is being predicted."""
        pass

    @abstractmethod
    def compute_oos_windows(self, data: Any) -> List[Dict]:
        """Returns list of OOS window specs."""
        pass

    @abstractmethod
    def compute_ev(self, state: StrategyState) -> Dict[str, Any]:
        """Returns EV analysis dict."""
        pass

    @abstractmethod
    def detect_leakage(self, data_meta: Dict) -> tuple:
        """Returns (clean: bool, message: str)."""
        pass

    @abstractmethod
    def format_report_context(self, state: StrategyState) -> Dict[str, Any]:
        """Returns domain-specific report context dict."""
        pass
