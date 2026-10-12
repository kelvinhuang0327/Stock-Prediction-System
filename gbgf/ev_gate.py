from typing import Tuple

EV_NEGATIVE_BY_DESIGN = "EV_NEGATIVE_BY_DESIGN"
EDGE_NOT_MONETIZABLE = "EDGE_NOT_MONETIZABLE"
EV_POSITIVE = "EV_POSITIVE"
VALID_SIGNAL_NON_MONETIZABLE = "VALID_SIGNAL_NON_MONETIZABLE"

class EVGate:
    def evaluate(self, ev_per_unit: float, cost_per_unit: float) -> Tuple[bool, float]:
        """Returns (profitable, net_ev)."""
        net_ev = ev_per_unit - cost_per_unit
        return net_ev > 0, net_ev

    def classify(self, ev_per_unit: float, cost_per_unit: float, edge_pp: float = 0.0) -> str:
        profitable, net_ev = self.evaluate(ev_per_unit, cost_per_unit)
        if profitable:
            return EV_POSITIVE
        if edge_pp > 0 and not profitable:
            return VALID_SIGNAL_NON_MONETIZABLE
        return EV_NEGATIVE_BY_DESIGN
