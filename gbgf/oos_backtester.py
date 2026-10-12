from typing import List
from .models import BacktestResult

class OOSBacktester:
    def __init__(self, degraded_threshold_pp: float = 2.0):
        self.degraded_threshold_pp = degraded_threshold_pp

    def validate_window(self, result: BacktestResult) -> bool:
        """Returns True if result passes the DEGRADED threshold."""
        return result.edge_pp >= self.degraded_threshold_pp and result.p_value < 0.05

    def summarize(self, results: List[BacktestResult]) -> dict:
        passing = [r for r in results if self.validate_window(r)]
        return {
            "total_windows": len(results),
            "passing_windows": len(passing),
            "all_pass": len(passing) == len(results),
            "min_edge_pp": min((r.edge_pp for r in results), default=None),
            "max_edge_pp": max((r.edge_pp for r in results), default=None),
        }
