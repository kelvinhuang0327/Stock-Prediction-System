from .base import DomainAdapter
from .stock import StockDomain
from .stock_real import StockRealDomain
from .point_in_time_guard import PointInTimeGuard, PITCheckResult, PITViolation, LeakageError
from .stock_features import (
    compute_features_for_rows,
    compute_universe_median_returns,
    return_nd, ma_nd, volatility_nd, volume_zscore_nd,
    drawdown_nd, breakout_nd_high, universe_relative_strength,
)

__all__ = [
    "DomainAdapter",
    "StockDomain",
    "StockRealDomain",
    "PointInTimeGuard",
    "PITCheckResult",
    "PITViolation",
    "LeakageError",
    "compute_features_for_rows",
    "compute_universe_median_returns",
    "return_nd",
    "ma_nd",
    "volatility_nd",
    "volume_zscore_nd",
    "drawdown_nd",
    "breakout_nd_high",
    "universe_relative_strength",
]
