import csv
import json
import os
from typing import Any, Dict, List, Optional
from .base import DomainAdapter
from ..models import DomainType, StrategyState, BacktestResult


class StockDomain(DomainAdapter):
    """
    Stock domain adapter — P3 POC implementation.
    Reads mock OHLCV CSV and hypothesis JSON.
    Real production requires PIT database, delisting-inclusive universe,
    transaction cost model, and survivorship-bias-free data.
    """

    PIT_RISKS = [
        "PIT (point-in-time) data required — avoid look-ahead on fundamentals/restatements",
        "Survivorship bias: universe must include delisted stocks",
        "Transaction cost: 10bps assumed; real cost includes slippage + market impact",
        "Sharpe / CAGR / max drawdown: computed from mock data — not production-valid",
    ]

    def __init__(
        self,
        csv_path: Optional[str] = None,
        hypothesis_path: Optional[str] = None,
    ):
        self._csv_path = csv_path
        self._hypothesis_path = hypothesis_path
        self._csv_data: Optional[List[Dict]] = None
        self._hypothesis: Optional[Dict] = None

    # ── DomainAdapter interface ─────────────────────────────────────────────

    def domain_type(self) -> DomainType:
        return DomainType.STOCK

    def validate_input_data(self, data: Any = None) -> tuple:
        rows = self._load_csv()
        if not rows:
            return False, "StockDomain: CSV data not found or empty"
        symbols = {r["symbol"] for r in rows}
        n = len(rows) // max(len(symbols), 1)
        if len(symbols) < 2:
            return False, f"StockDomain: need ≥2 symbols, got {len(symbols)}"
        if n < 120:
            return False, f"StockDomain: need ≥120 trading days per symbol, got {n}"
        pit_ok = all(r.get("data_is_point_in_time") == "true" for r in rows)
        if not pit_ok:
            return False, "StockDomain: data_is_point_in_time not set to 'true' for all rows"
        return True, (
            f"StockDomain: {len(symbols)} symbols, {n} trading days/symbol. "
            f"PIT flag confirmed. MOCK DATA — not for trading."
        )

    def get_prediction_target(self) -> str:
        hyp = self._load_hypothesis()
        if hyp:
            return hyp.get("prediction_target", "next_5d_return_positive")
        return "next_5d_return_positive (20d momentum)"

    def compute_oos_windows(self, data: Any = None) -> List[Dict]:
        rows = self._load_csv()
        if not rows:
            return [{"label": "60d_window", "status": "NO_DATA"}]
        symbols = list({r["symbol"] for r in rows})
        n_per_symbol = len(rows) // len(symbols)
        # Reserve last 60 rows for OOS
        in_sample = n_per_symbol - 60
        return [
            {
                "label": "60d_oos",
                "in_sample_size": in_sample,
                "oos_size": 60,
                "total_rows_per_symbol": n_per_symbol,
                "status": "MOCK_POC",
                "note": "Real OOS requires strict temporal split with no future leakage",
            }
        ]

    def compute_ev(self, state: StrategyState) -> Dict[str, Any]:
        rows = self._load_csv()
        tx_cost_bps = 10

        # Mock 5-day momentum signal: buy if 20d return > 0
        # OOS: last 60 days, compute next-5d return after signal
        signals = self._compute_momentum_signals(rows, lookback=20, forward=5)

        if not signals:
            return {
                "classification": "STOCK_POC_NO_SIGNAL",
                "sharpe": None,
                "cagr": None,
                "max_drawdown": None,
                "transaction_cost_bps": tx_cost_bps,
                "pit_risks": self.PIT_RISKS,
                "status": "NO_SIGNAL_COMPUTED",
            }

        # Compute mock Sharpe and win rate from OOS signals
        oos_signals = signals[-60:] if len(signals) >= 60 else signals
        returns = [s["forward_return"] - tx_cost_bps / 10000.0 for s in oos_signals]
        n = len(returns)
        if n == 0:
            sharpe = None
            win_rate = None
            cagr = None
        else:
            import math
            mean_r = sum(returns) / n
            var_r = sum((r - mean_r) ** 2 for r in returns) / max(n - 1, 1)
            std_r = math.sqrt(var_r) if var_r > 0 else 0.0001
            sharpe = round((mean_r / std_r) * math.sqrt(252 / 5), 4) if std_r > 0 else 0.0
            win_rate = round(sum(1 for r in returns if r > 0) / n, 4)
            cagr = round((1 + mean_r) ** (252 / 5) - 1, 4)

        # Map to GBGF-recognized EV classifications for GateRunner G06
        # Sharpe > 0.5: nominally positive → EV_POSITIVE (G06 PASS)
        # Sharpe > 0: marginal → VALID_SIGNAL_NON_MONETIZABLE (G06 WARN)
        # Sharpe <= 0: negative → EV_NEGATIVE_BY_DESIGN (G06 WARN)
        if sharpe is not None and sharpe > 0.5:
            classification = "EV_POSITIVE"
        elif sharpe is not None and sharpe > 0:
            classification = "VALID_SIGNAL_NON_MONETIZABLE"
        else:
            classification = "EV_NEGATIVE_BY_DESIGN"

        return {
            "classification": classification,
            "sharpe_annualized": sharpe,
            "cagr_annualized": cagr,
            "win_rate": win_rate,
            "n_oos_signals": len(oos_signals),
            "transaction_cost_bps": tx_cost_bps,
            "pit_risks": self.PIT_RISKS,
            "mock_data": True,
            "note": "Mock Sharpe from synthetic data. Not production-valid.",
            "status": "MOCK_POC_COMPUTED",
        }

    def detect_leakage(self, data_meta: Dict = None) -> tuple:
        # For mock PIT CSV: rows are flagged data_is_point_in_time=true
        # Real production would enforce PIT database with asof-join; here we
        # accept the flag as mock compliance and surface the risk as a note.
        rows = self._load_csv()
        if not rows:
            return False, "StockDomain: no data loaded — cannot verify PIT compliance"

        pit_ok = all(r.get("data_is_point_in_time") == "true" for r in rows)
        if not pit_ok:
            return False, (
                "StockDomain: data_is_point_in_time flag missing. "
                "RISK: look-ahead bias possible. Real PIT database required."
            )

        # PIT flag present; surface survivorship risk as a note (not a failure for POC)
        return True, (
            "StockDomain: PIT flag confirmed on mock data. "
            "RISK NOTE: Survivorship bias not enforced — universe excludes delisted stocks. "
            "Real implementation requires delisting-inclusive universe and asof-join PIT data."
        )

    def format_report_context(self, state: StrategyState) -> Dict[str, Any]:
        hyp = self._load_hypothesis()
        return {
            "domain": "STOCK",
            "phase": "P3_POC",
            "strategy_name": hyp.get("strategy_name", "simple_20d_momentum") if hyp else "simple_20d_momentum",
            "pit_risks": self.PIT_RISKS,
            "warnings": [
                "Mock data: results are illustrative only",
                "Not a trading recommendation",
                "Real implementation needs PIT DB + delisting universe + real transaction costs",
            ],
        }

    # ── Internal helpers ───────────────────────────────────────────────────

    def _load_csv(self) -> List[Dict]:
        if self._csv_data is not None:
            return self._csv_data
        if not self._csv_path or not os.path.exists(self._csv_path):
            return []
        with open(self._csv_path, newline="") as f:
            self._csv_data = list(csv.DictReader(f))
        return self._csv_data

    def _load_hypothesis(self) -> Optional[Dict]:
        if self._hypothesis is not None:
            return self._hypothesis
        if not self._hypothesis_path or not os.path.exists(self._hypothesis_path):
            return None
        with open(self._hypothesis_path) as f:
            self._hypothesis = json.load(f)
        return self._hypothesis

    def _compute_momentum_signals(
        self, rows: List[Dict], lookback: int = 20, forward: int = 5
    ) -> List[Dict]:
        """Compute 20d momentum → next-5d return signal for all symbols."""
        from itertools import groupby

        symbols = sorted({r["symbol"] for r in rows})
        all_signals = []

        for sym in symbols:
            sym_rows = [r for r in rows if r["symbol"] == sym]
            sym_rows.sort(key=lambda r: r["date"])
            closes = [float(r["close"]) for r in sym_rows]

            for i in range(lookback, len(closes) - forward):
                mom_return = (closes[i] - closes[i - lookback]) / closes[i - lookback]
                fwd_return = (closes[i + forward] - closes[i]) / closes[i]
                signal = 1 if mom_return > 0 else -1
                all_signals.append({
                    "symbol": sym,
                    "date": sym_rows[i]["date"],
                    "momentum_return": round(mom_return, 6),
                    "forward_return": round(fwd_return * signal, 6),  # directional
                    "signal": signal,
                })

        all_signals.sort(key=lambda s: s["date"])
        return all_signals
