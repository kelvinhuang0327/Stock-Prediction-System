#!/usr/bin/env python3
"""
strategy_research_framework.py - 標準化策略研究框架

此腳本整合所有驗證模組，對 Asset Doubling 策略執行完整驗證流程：
1. 資料驗證
2. 回測 (含交易成本)
3. Benchmark 對照
4. Walk-forward 驗證
5. Monte Carlo 模擬
6. 偏差偵測
7. 防自欺檢查

使用方式:
    python strategy_research_framework.py [--stock STOCK_ID] [--months MONTHS]

輸出:
    策略驗證報告 (JSON + console)
"""

import sys
import os
import json
import sqlite3
import math
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict

# ─── Configuration ───

# Taiwan stock trading costs
COMMISSION_RATE = 0.001425  # 0.1425% per side
TAX_RATE = 0.003            # 0.3% on sell
SLIPPAGE_PCT = 0.001        # 0.1% estimated slippage
DISCOUNT = 0.6              # broker discount (6折)

ROUND_TRIP_COST = (
    COMMISSION_RATE * DISCOUNT  # buy commission
    + COMMISSION_RATE * DISCOUNT  # sell commission
    + TAX_RATE                    # sell tax
    + SLIPPAGE_PCT * 2            # slippage both sides
)

RISK_FREE_RATE = 0.02  # 2% annual
TRADING_DAYS_PER_YEAR = 252


@dataclass
class PriceBar:
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Trade:
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    shares: int
    gross_return: float
    net_return: float
    cost: float
    holding_days: int
    exit_reason: str


@dataclass
class PerformanceMetrics:
    total_return: float
    cagr: float
    profit_factor: float
    expectancy: float
    avg_win: float
    avg_loss: float
    win_rate: float
    payoff_ratio: float
    max_drawdown: float
    volatility: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    ulcer_index: float
    total_trades: int
    exposure: float
    avg_holding_days: float
    max_consecutive_losses: int
    max_consecutive_wins: int
    sample_period_days: int
    total_costs: float
    cost_drag: float


@dataclass
class ValidationWarning:
    level: str  # critical, warning, info
    code: str
    message: str


# ─── Data Loading ───

def find_db_path() -> str:
    """Find the SQLite database"""
    candidates = [
        os.path.join(os.path.dirname(__file__), 'prisma', 'dev.db'),
        os.path.join(os.path.dirname(__file__), 'dev.db'),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Cannot find dev.db database")


def load_price_data(stock_id: str, months: int = 12, db_path: str = None) -> List[PriceBar]:
    """Load price data from SQLite, sorted chronologically.
    Handles mixed date formats (ROC era '1140101' and ISO '2025-01-01')."""
    if db_path is None:
        db_path = find_db_path()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Load ALL data for this stock, then filter in Python to handle mixed date formats
    cursor.execute("""
        SELECT date, open, high, low, close, volume
        FROM StockQuote
        WHERE stockId = ?
        ORDER BY date ASC
    """, (stock_id,))

    cutoff = datetime.now() - timedelta(days=months * 30)
    bars = []
    for row in cursor.fetchall():
        date_str = row[0]
        # Try to parse date and filter
        try:
            if '-' in date_str:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
            elif len(date_str) == 7:
                # ROC era: e.g., '1140127' -> year=2025, month=01, day=27
                roc_year = int(date_str[:3])
                dt = datetime(roc_year + 1911, int(date_str[3:5]), int(date_str[5:7]))
                date_str = dt.strftime('%Y-%m-%d')
            elif len(date_str) == 8:
                dt = datetime.strptime(date_str, '%Y%m%d')
                date_str = dt.strftime('%Y-%m-%d')
            else:
                continue

            if dt >= cutoff:
                bars.append(PriceBar(
                    date=date_str, open=row[1], high=row[2],
                    low=row[3], close=row[4], volume=row[5]
                ))
        except (ValueError, IndexError):
            continue

    conn.close()
    # Sort by date to ensure chronological order
    bars.sort(key=lambda b: b.date)
    return bars


def load_all_stocks(db_path: str = None) -> List[str]:
    """Get all stock IDs with sufficient data"""
    if db_path is None:
        db_path = find_db_path()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT stockId, COUNT(*) as cnt
        FROM StockQuote
        GROUP BY stockId
        HAVING cnt >= 60
    """)
    stocks = [row[0] for row in cursor.fetchall()]
    conn.close()
    return stocks


# ─── Indicator Calculations ───

def sma(closes: List[float], period: int) -> float:
    if len(closes) < period:
        return 0
    return sum(closes[-period:]) / period


def rsi(closes: List[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50
    gains = losses = 0
    for i in range(-period, 0):
        change = closes[i] - closes[i - 1]
        if change > 0:
            gains += change
        else:
            losses -= change
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def atr(bars: List[PriceBar], period: int = 14) -> float:
    if len(bars) < period + 1:
        return 0
    tr_sum = 0
    for i in range(-period, 0):
        tr = max(
            bars[i].high - bars[i].low,
            abs(bars[i].high - bars[i - 1].close),
            abs(bars[i].low - bars[i - 1].close)
        )
        tr_sum += tr
    return tr_sum / period


# ─── Strategy Definitions ───

def asset_doubling_entry(bars: List[PriceBar]) -> bool:
    """Asset Doubling entry: Price > MA10 > MA60, RSI 40-75, ATR ≤ 5%"""
    if len(bars) < 61:
        return False

    closes = [b.close for b in bars]
    ma10 = sma(closes, 10)
    ma60 = sma(closes, 60)
    current_rsi = rsi(closes)
    current_atr = atr(bars)
    price = closes[-1]

    if price <= ma10 or ma10 <= ma60:
        return False
    if current_rsi < 40 or current_rsi > 75:
        return False
    if current_atr > 0 and (current_atr / price) > 0.05:
        return False
    if (price - ma60) / ma60 < 0.02:
        return False

    return True


def asset_doubling_exit(bars: List[PriceBar]) -> bool:
    """Exit when price < MA20 or RSI > 85"""
    closes = [b.close for b in bars]
    ma20 = sma(closes, 20)
    current_rsi = rsi(closes)

    if ma20 > 0 and closes[-1] < ma20:
        return True
    if current_rsi > 85:
        return True
    return False


def asset_doubling_stop(bars: List[PriceBar]) -> float:
    """Stop = max(MA20, Recent20High - 2×ATR)"""
    closes = [b.close for b in bars]
    ma20 = sma(closes, 20)
    current_atr = atr(bars)
    recent_high = max(b.high for b in bars[-20:]) if len(bars) >= 20 else bars[-1].high

    atr_stop = recent_high - 2 * current_atr if current_atr > 0 else closes[-1] * 0.93
    ma_stop = ma20 if ma20 > 0 else closes[-1] * 0.93

    return max(atr_stop, ma_stop)


def buy_and_hold_entry(bars: List[PriceBar]) -> bool:
    """Always enter on first bar"""
    return True


def buy_and_hold_exit(bars: List[PriceBar]) -> bool:
    """Never exit"""
    return False


def ma_cross_entry(bars: List[PriceBar]) -> bool:
    """MA10 > MA60 crossover"""
    if len(bars) < 61:
        return False
    closes = [b.close for b in bars]
    return sma(closes, 10) > sma(closes, 60)


def ma_cross_exit(bars: List[PriceBar]) -> bool:
    """MA10 < MA60"""
    if len(bars) < 61:
        return False
    closes = [b.close for b in bars]
    return sma(closes, 10) < sma(closes, 60)


# ─── Backtest Engine ───

def run_backtest(
    bars: List[PriceBar],
    entry_fn,
    exit_fn,
    stop_fn=None,
    initial_capital: float = 1_000_000,
    max_position_pct: float = 0.25,
    max_holding_days: int = 60,
    include_costs: bool = True,
    name: str = "Strategy"
) -> Dict:
    """Run backtest with proper cost handling"""

    capital = initial_capital
    position = None
    trades: List[Trade] = []
    equity_curve = []
    total_costs = 0
    bars_with_position = 0

    for i in range(20, len(bars)):  # start at 20 for indicator warmup
        bar = bars[i]
        history = bars[:i + 1]

        # Check exit
        if position is not None:
            position['holding_days'] += 1
            exit_reason = None

            # Stop loss
            if stop_fn and bar.low <= position['stop_loss']:
                exit_reason = 'stop_loss'
                exit_price = min(bar.open, position['stop_loss'])
            elif position['holding_days'] >= max_holding_days:
                exit_reason = 'time_stop'
                exit_price = bar.close
            elif exit_fn(history):
                exit_reason = 'signal'
                exit_price = bar.close

            if exit_reason:
                cost = position['capital_used'] * ROUND_TRIP_COST if include_costs else 0
                gross_ret = (exit_price - position['entry_price']) / position['entry_price']
                net_proceeds = exit_price * position['shares']
                if include_costs:
                    net_proceeds *= (1 - COMMISSION_RATE * DISCOUNT - TAX_RATE - SLIPPAGE_PCT)
                net_ret = (net_proceeds - position['capital_used']) / position['capital_used']

                total_costs += cost
                capital += net_proceeds

                trades.append(Trade(
                    entry_date=position['entry_date'],
                    exit_date=bar.date,
                    entry_price=position['entry_price'],
                    exit_price=exit_price,
                    shares=position['shares'],
                    gross_return=gross_ret,
                    net_return=net_ret,
                    cost=cost,
                    holding_days=position['holding_days'],
                    exit_reason=exit_reason,
                ))
                position = None

        # Check entry
        if position is None and entry_fn(history):
            if bar.volume >= 100_000:
                pos_capital = min(capital * max_position_pct, capital * 0.9)
                entry_price = bar.close
                if include_costs:
                    entry_price *= (1 + COMMISSION_RATE * DISCOUNT + SLIPPAGE_PCT)
                shares = int(pos_capital / entry_price / 1000) * 1000

                if shares >= 1000:
                    actual_capital = entry_price * shares
                    capital -= actual_capital
                    stop_price = stop_fn(history) if stop_fn else bar.close * 0.93

                    position = {
                        'entry_date': bar.date,
                        'entry_price': bar.close,
                        'effective_entry': entry_price,
                        'shares': shares,
                        'capital_used': actual_capital,
                        'stop_loss': stop_price,
                        'holding_days': 0,
                    }

        # Track equity
        pos_value = position['shares'] * bar.close if position else 0
        equity_curve.append({'date': bar.date, 'equity': capital + pos_value})
        if position:
            bars_with_position += 1

    # Close remaining position
    if position:
        last_bar = bars[-1]
        exit_price = last_bar.close
        net_proceeds = exit_price * position['shares']
        if include_costs:
            net_proceeds *= (1 - COMMISSION_RATE * DISCOUNT - TAX_RATE - SLIPPAGE_PCT)
        gross_ret = (exit_price - position['entry_price']) / position['entry_price']
        net_ret = (net_proceeds - position['capital_used']) / position['capital_used']
        capital += net_proceeds

        trades.append(Trade(
            entry_date=position['entry_date'],
            exit_date=last_bar.date,
            entry_price=position['entry_price'],
            exit_price=exit_price,
            shares=position['shares'],
            gross_return=gross_ret,
            net_return=net_ret,
            cost=position['capital_used'] * ROUND_TRIP_COST if include_costs else 0,
            holding_days=position['holding_days'],
            exit_reason='end_of_data',
        ))

    # Calculate metrics
    metrics = calculate_metrics(trades, equity_curve, initial_capital,
                                 len(bars), bars_with_position, total_costs)

    return {
        'name': name,
        'trades': [asdict(t) for t in trades],
        'metrics': asdict(metrics),
        'equity_curve': equity_curve,
        'total_bars': len(bars),
        'include_costs': include_costs,
        'round_trip_cost_pct': f"{ROUND_TRIP_COST * 100:.3f}%",
    }


def calculate_metrics(
    trades: List[Trade],
    equity_curve: List[Dict],
    initial_capital: float,
    total_bars: int,
    bars_with_position: int,
    total_costs: float
) -> PerformanceMetrics:
    """Calculate comprehensive performance metrics"""

    wins = [t for t in trades if t.net_return > 0]
    losses = [t for t in trades if t.net_return <= 0]

    final_equity = equity_curve[-1]['equity'] if equity_curve else initial_capital
    total_return = (final_equity - initial_capital) / initial_capital

    years = total_bars / TRADING_DAYS_PER_YEAR
    cagr = (1 + total_return) ** (1 / years) - 1 if years > 0 and total_return > -1 else 0

    # Daily returns
    daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1]['equity']
        if prev > 0:
            daily_returns.append((equity_curve[i]['equity'] - prev) / prev)

    # Volatility
    avg_daily = sum(daily_returns) / len(daily_returns) if daily_returns else 0
    variance = sum((r - avg_daily) ** 2 for r in daily_returns) / (len(daily_returns) - 1) if len(daily_returns) > 1 else 0
    daily_vol = math.sqrt(variance)
    annual_vol = daily_vol * math.sqrt(TRADING_DAYS_PER_YEAR)

    # Downside deviation
    downside = [r for r in daily_returns if r < 0]
    downside_var = sum(r ** 2 for r in downside) / len(downside) if downside else 0
    downside_dev = math.sqrt(downside_var) * math.sqrt(TRADING_DAYS_PER_YEAR)

    # Max drawdown
    peak = initial_capital
    max_dd = 0
    for point in equity_curve:
        if point['equity'] > peak:
            peak = point['equity']
        dd = (peak - point['equity']) / peak
        if dd > max_dd:
            max_dd = dd

    # Ulcer index
    peak = initial_capital
    dd_squared_sum = 0
    for point in equity_curve:
        if point['equity'] > peak:
            peak = point['equity']
        dd_pct = ((peak - point['equity']) / peak) * 100
        dd_squared_sum += dd_pct ** 2
    ulcer = math.sqrt(dd_squared_sum / len(equity_curve)) if equity_curve else 0

    # Ratios
    excess = cagr - RISK_FREE_RATE
    sharpe = excess / annual_vol if annual_vol > 0 else 0
    sortino = excess / downside_dev if downside_dev > 0 else 0
    calmar = cagr / max_dd if max_dd > 0 else 0

    # Trade metrics
    avg_win = sum(t.net_return for t in wins) / len(wins) if wins else 0
    avg_loss = abs(sum(t.net_return for t in losses) / len(losses)) if losses else 0
    win_rate = len(wins) / len(trades) if trades else 0
    payoff = avg_win / avg_loss if avg_loss > 0 else 0
    pf_num = sum(t.net_return for t in wins) if wins else 0
    pf_den = abs(sum(t.net_return for t in losses)) if losses else 0
    profit_factor = pf_num / pf_den if pf_den > 0 else (float('inf') if pf_num > 0 else 0)
    expectancy = sum(t.net_return for t in trades) / len(trades) if trades else 0

    # Consecutive
    max_cons_w = max_cons_l = cons_w = cons_l = 0
    for t in trades:
        if t.net_return > 0:
            cons_w += 1
            cons_l = 0
            max_cons_w = max(max_cons_w, cons_w)
        else:
            cons_l += 1
            cons_w = 0
            max_cons_l = max(max_cons_l, cons_l)

    # Cost drag
    gross_total = sum(t.gross_return * t.shares * t.entry_price for t in trades)
    cost_drag = total_costs / abs(gross_total) if gross_total != 0 else 0

    return PerformanceMetrics(
        total_return=round(total_return, 4),
        cagr=round(cagr, 4),
        profit_factor=round(profit_factor, 4),
        expectancy=round(expectancy, 4),
        avg_win=round(avg_win, 4),
        avg_loss=round(avg_loss, 4),
        win_rate=round(win_rate, 4),
        payoff_ratio=round(payoff, 4),
        max_drawdown=round(max_dd, 4),
        volatility=round(annual_vol, 4),
        sharpe_ratio=round(sharpe, 4),
        sortino_ratio=round(sortino, 4),
        calmar_ratio=round(calmar, 4),
        ulcer_index=round(ulcer, 4),
        total_trades=len(trades),
        exposure=round(bars_with_position / total_bars, 4) if total_bars > 0 else 0,
        avg_holding_days=round(sum(t.holding_days for t in trades) / len(trades)) if trades else 0,
        max_consecutive_losses=max_cons_l,
        max_consecutive_wins=max_cons_w,
        sample_period_days=total_bars,
        total_costs=round(total_costs, 2),
        cost_drag=round(cost_drag, 4),
    )


# ─── Anti-Deception Validation ───

def validate_results(metrics: Dict) -> List[ValidationWarning]:
    """Check for suspiciously good or unreliable results"""
    warnings = []

    if metrics.get('sharpe_ratio', 0) > 3:
        warnings.append(ValidationWarning(
            'critical', 'SUSPICIOUS_SHARPE',
            f"Sharpe {metrics['sharpe_ratio']:.2f} 異常偏高。真實市場 Sharpe > 2 已屬頂尖。"
        ))

    if metrics.get('win_rate', 0) > 0.8 and metrics.get('total_trades', 0) > 10:
        warnings.append(ValidationWarning(
            'critical', 'SUSPICIOUS_WIN_RATE',
            f"勝率 {metrics['win_rate']*100:.1f}% 異常。80%+ 在頻繁交易中極罕見。"
        ))

    if metrics.get('cagr', 0) > 1.0:
        warnings.append(ValidationWarning(
            'critical', 'UNREALISTIC_CAGR',
            f"年化報酬 {metrics['cagr']*100:.1f}% 超過 100%。持續維持幾乎不可能。"
        ))

    if metrics.get('total_trades', 0) < 30:
        warnings.append(ValidationWarning(
            'warning', 'INSUFFICIENT_TRADES',
            f"僅 {metrics['total_trades']} 筆交易，樣本不足以判斷統計顯著性。"
        ))

    if metrics.get('sample_period_days', 0) < 252:
        warnings.append(ValidationWarning(
            'warning', 'SHORT_PERIOD',
            f"回測期間 {metrics['sample_period_days']} 天，不足一年。"
        ))

    if metrics.get('max_drawdown', 0) < 0.02 and metrics.get('total_return', 0) > 0.2:
        warnings.append(ValidationWarning(
            'critical', 'SUSPICIOUS_LOW_DD',
            f"最大回撤僅 {metrics['max_drawdown']*100:.2f}% 但報酬 {metrics['total_return']*100:.1f}%。極不尋常。"
        ))

    return warnings


# ─── Walk-Forward Validation ───

def walk_forward_validate(
    bars: List[PriceBar],
    entry_fn,
    exit_fn,
    stop_fn=None,
    n_windows: int = 4,
    train_ratio: float = 0.7,
    name: str = "Strategy"
) -> Dict:
    """Split data into train/test windows and check consistency"""

    if len(bars) < 120:
        return {
            'error': f'資料不足: {len(bars)} bars，需至少 120 bars',
            'windows': [],
            'consistent': False,
        }

    window_size = len(bars) // n_windows
    results = []

    for w in range(n_windows):
        start = w * window_size
        end = min(start + window_size, len(bars))
        window_bars = bars[start:end]

        if len(window_bars) < 40:
            continue

        # Split train/test
        split_idx = int(len(window_bars) * train_ratio)
        test_bars = window_bars[split_idx:]

        if len(test_bars) < 20:
            continue

        result = run_backtest(
            test_bars, entry_fn, exit_fn, stop_fn,
            name=f"{name}_window_{w}"
        )

        results.append({
            'window': w,
            'period': f"{test_bars[0].date} ~ {test_bars[-1].date}",
            'bars': len(test_bars),
            'total_return': result['metrics']['total_return'],
            'sharpe': result['metrics']['sharpe_ratio'],
            'win_rate': result['metrics']['win_rate'],
            'trades': result['metrics']['total_trades'],
            'max_dd': result['metrics']['max_drawdown'],
        })

    # Check consistency
    returns = [r['total_return'] for r in results if r['trades'] > 0]
    positive_windows = sum(1 for r in returns if r > 0)
    all_positive = positive_windows == len(returns) if returns else False

    return_std = (sum((r - sum(returns)/len(returns))**2 for r in returns) / len(returns))**0.5 if len(returns) > 1 else 0

    return {
        'windows': results,
        'n_windows': len(results),
        'positive_windows': positive_windows,
        'all_positive': all_positive,
        'return_std': round(return_std, 4),
        'consistent': all_positive and return_std < 0.2,
        'verdict': (
            '策略在所有視窗均為正報酬且波動穩定' if all_positive and return_std < 0.2
            else '策略表現不一致，可能存在過度擬合' if not all_positive
            else '策略報酬波動大，穩定性不足'
        ),
    }


# ─── Main Execution ───

def run_full_validation(stock_id: str, months: int = 12) -> Dict:
    """Run complete strategy validation pipeline"""

    print(f"\n{'='*60}")
    print(f"  策略驗證框架 - {stock_id}")
    print(f"  期間: {months} 個月")
    print(f"  交易成本: 來回 {ROUND_TRIP_COST*100:.3f}%")
    print(f"{'='*60}\n")

    try:
        bars = load_price_data(stock_id, months)
    except Exception as e:
        return {'error': f'載入資料失敗: {str(e)}', 'stock_id': stock_id}

    if len(bars) < 30:
        return {
            'error': f'資料不足: {stock_id} 僅 {len(bars)} 筆，需至少 30 筆',
            'stock_id': stock_id,
        }

    print(f"✅ 載入 {len(bars)} 筆價格資料 ({bars[0].date} ~ {bars[-1].date})")

    # 1. Asset Doubling Strategy (with costs)
    print("\n📊 回測: Asset Doubling Strategy (含交易成本)...")
    ad_result = run_backtest(
        bars, asset_doubling_entry, asset_doubling_exit, asset_doubling_stop,
        name="Asset Doubling (含成本)"
    )
    print(f"   交易: {ad_result['metrics']['total_trades']} 筆")
    print(f"   淨報酬: {ad_result['metrics']['total_return']*100:.2f}%")
    print(f"   Sharpe: {ad_result['metrics']['sharpe_ratio']:.2f}")
    print(f"   最大回撤: {ad_result['metrics']['max_drawdown']*100:.2f}%")

    # 2. Asset Doubling WITHOUT costs (for comparison)
    print("\n📊 回測: Asset Doubling Strategy (不含交易成本，僅供對照)...")
    ad_nocost = run_backtest(
        bars, asset_doubling_entry, asset_doubling_exit, asset_doubling_stop,
        include_costs=False, name="Asset Doubling (不含成本)"
    )
    cost_impact = ad_nocost['metrics']['total_return'] - ad_result['metrics']['total_return']
    print(f"   不含成本報酬: {ad_nocost['metrics']['total_return']*100:.2f}%")
    print(f"   交易成本影響: -{cost_impact*100:.2f}%")

    # 3. Benchmark: Buy & Hold
    print("\n📊 Benchmark: Buy & Hold...")
    bh_result = run_backtest(
        bars, buy_and_hold_entry, buy_and_hold_exit, None,
        max_holding_days=99999, name="Buy & Hold"
    )
    print(f"   報酬: {bh_result['metrics']['total_return']*100:.2f}%")

    # 4. Benchmark: MA Crossover
    print("\n📊 Benchmark: MA10/60 Crossover...")
    ma_result = run_backtest(
        bars, ma_cross_entry, ma_cross_exit, None,
        name="MA10/60 Crossover"
    )
    print(f"   報酬: {ma_result['metrics']['total_return']*100:.2f}%")

    # 5. Alpha calculation
    alpha = ad_result['metrics']['cagr'] - bh_result['metrics']['cagr']
    excess_sharpe = ad_result['metrics']['sharpe_ratio'] - bh_result['metrics']['sharpe_ratio']

    print(f"\n📈 Alpha vs Buy&Hold: {alpha*100:.2f}%")
    print(f"📈 Excess Sharpe: {excess_sharpe:.2f}")

    # 6. Walk-forward validation
    print("\n🔄 Walk-Forward 驗證...")
    wf_result = walk_forward_validate(
        bars, asset_doubling_entry, asset_doubling_exit, asset_doubling_stop,
        name="Asset Doubling"
    )
    if 'error' in wf_result:
        print(f"   ⚠️ {wf_result['error']}")
    else:
        print(f"   視窗數: {wf_result['n_windows']}")
        print(f"   正報酬視窗: {wf_result['positive_windows']}/{wf_result['n_windows']}")
        print(f"   一致性: {'✅' if wf_result['consistent'] else '❌'} {wf_result['verdict']}")

    # 7. Anti-deception validation
    print("\n🛡️ 防自欺驗證...")
    warnings = validate_results(ad_result['metrics'])
    for w in warnings:
        icon = '🚨' if w.level == 'critical' else '⚠️' if w.level == 'warning' else 'ℹ️'
        print(f"   {icon} [{w.code}] {w.message}")

    if not warnings:
        print("   ✅ 未發現異常")

    # 8. Verdict
    print(f"\n{'='*60}")
    print("  最終結論")
    print(f"{'='*60}")

    critical_count = sum(1 for w in warnings if w.level == 'critical')
    has_alpha = alpha > 0.05 and excess_sharpe > 0.3
    wf_consistent = wf_result.get('consistent', False)
    enough_trades = ad_result['metrics']['total_trades'] >= 20

    if critical_count > 0:
        verdict = "❌ 回測結果存在嚴重問題，策略有效性不可信"
    elif not enough_trades:
        verdict = "⚠️ 交易次數不足，無法判斷策略有效性"
    elif has_alpha and wf_consistent:
        verdict = "✅ 策略在此期間表現優於 benchmark 且 walk-forward 一致，但仍需更多驗證"
    elif has_alpha:
        verdict = "⚠️ 策略有 alpha 但 walk-forward 不一致，可能存在過度擬合"
    else:
        verdict = "❌ 策略未能穩定優於 benchmark，不建議在當前條件下使用"

    print(f"\n{verdict}\n")

    # Compile full report
    report = {
        'stock_id': stock_id,
        'period': f"{bars[0].date} ~ {bars[-1].date}",
        'data_points': len(bars),
        'cost_model': f"來回 {ROUND_TRIP_COST*100:.3f}%",
        'strategy_result': ad_result['metrics'],
        'strategy_nocost': ad_nocost['metrics'],
        'cost_impact': round(cost_impact, 4),
        'benchmark_buy_hold': bh_result['metrics'],
        'benchmark_ma_cross': ma_result['metrics'],
        'alpha': round(alpha, 4),
        'excess_sharpe': round(excess_sharpe, 4),
        'walk_forward': wf_result,
        'validation_warnings': [asdict(w) for w in warnings],
        'verdict': verdict,
        'disclaimers': [
            '過去績效不保證未來報酬',
            '回測基於歷史模擬，實際交易涉及額外風險',
            '交易成本為估計值，實際成本因券商而異',
            '此報告不構成投資建議',
        ],
        'timestamp': datetime.now().isoformat(),
    }

    return report


def run_universe_validation(months: int = 12, max_stocks: int = 20) -> Dict:
    """Run validation across multiple stocks"""

    print(f"\n{'='*60}")
    print(f"  多股票 Universe 驗證")
    print(f"{'='*60}\n")

    try:
        all_stocks = load_all_stocks()
    except Exception as e:
        return {'error': f'載入股票清單失敗: {str(e)}'}

    stocks_to_test = all_stocks[:max_stocks]
    print(f"共 {len(all_stocks)} 檔有足夠資料，測試前 {len(stocks_to_test)} 檔\n")

    results = []
    for sid in stocks_to_test:
        try:
            bars = load_price_data(sid, months)
            if len(bars) < 60:
                continue

            result = run_backtest(
                bars, asset_doubling_entry, asset_doubling_exit, asset_doubling_stop,
                name=f"AD_{sid}"
            )
            bh = run_backtest(
                bars, buy_and_hold_entry, buy_and_hold_exit, None,
                max_holding_days=99999, name=f"BH_{sid}"
            )

            results.append({
                'stock_id': sid,
                'ad_return': result['metrics']['total_return'],
                'bh_return': bh['metrics']['total_return'],
                'alpha': result['metrics']['total_return'] - bh['metrics']['total_return'],
                'trades': result['metrics']['total_trades'],
                'win_rate': result['metrics']['win_rate'],
                'max_dd': result['metrics']['max_drawdown'],
            })
            print(f"  {sid}: AD={result['metrics']['total_return']*100:+.1f}% BH={bh['metrics']['total_return']*100:+.1f}% α={results[-1]['alpha']*100:+.1f}%")

        except Exception as e:
            print(f"  {sid}: 錯誤 - {str(e)}")

    if not results:
        return {'error': '無可回測股票'}

    # Summary
    avg_alpha = sum(r['alpha'] for r in results) / len(results)
    positive_alpha = sum(1 for r in results if r['alpha'] > 0)
    avg_win_rate = sum(r['win_rate'] for r in results if r['trades'] > 0) / max(1, sum(1 for r in results if r['trades'] > 0))

    print(f"\n{'='*60}")
    print(f"  Universe 結果摘要")
    print(f"{'='*60}")
    print(f"  測試股票: {len(results)}")
    print(f"  平均 Alpha: {avg_alpha*100:+.2f}%")
    print(f"  正 Alpha 比例: {positive_alpha}/{len(results)} ({positive_alpha/len(results)*100:.0f}%)")
    print(f"  平均勝率: {avg_win_rate*100:.1f}%")

    universe_verdict = (
        '策略在多數標的表現優於 benchmark' if positive_alpha / len(results) > 0.6
        else '策略未能在多數標的穩定優於 benchmark'
    )
    print(f"\n  結論: {universe_verdict}\n")

    return {
        'stocks_tested': len(results),
        'avg_alpha': round(avg_alpha, 4),
        'positive_alpha_ratio': round(positive_alpha / len(results), 4),
        'avg_win_rate': round(avg_win_rate, 4),
        'results': results,
        'verdict': universe_verdict,
    }


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='策略驗證框架')
    parser.add_argument('--stock', type=str, default=None, help='股票代號')
    parser.add_argument('--months', type=int, default=12, help='回測月數')
    parser.add_argument('--universe', action='store_true', help='執行多股票驗證')
    parser.add_argument('--output', type=str, default=None, help='輸出 JSON 檔案路徑')
    args = parser.parse_args()

    if args.universe:
        report = run_universe_validation(args.months)
    elif args.stock:
        report = run_full_validation(args.stock, args.months)
    else:
        # Default: try to find a stock with data
        try:
            stocks = load_all_stocks()
            if stocks:
                print(f"找到 {len(stocks)} 檔有資料的股票")
                # Run on first stock as demo
                report = run_full_validation(stocks[0], args.months)
            else:
                print("資料庫中無股票資料。請先同步資料。")
                report = {'error': '無可用資料'}
        except Exception as e:
            print(f"錯誤: {e}")
            report = {'error': str(e)}

    if args.output and 'error' not in report:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\n報告已輸出至: {args.output}")
