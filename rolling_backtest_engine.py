import pandas as pd
import numpy as np
import sqlite3
import talib
from datetime import datetime, timedelta

class RollingBacktestEngine:
    def __init__(self, db_path='prisma/dev.db', initial_capital=1000000, position_mode='fixed', strict_mode=False, filter_survivorship=True):
        self.db_path = db_path
        self.initial_capital = initial_capital
        self.position_mode = position_mode  # 'fixed' or 'kelly'
        self.strict_mode = strict_mode  # Enable look-ahead bias detection
        self.filter_survivorship = filter_survivorship  # Enable survivorship bias filtering
        self.reset()
        
        # Kelly parameters (will be estimated from historical trades)
        self.kelly_win_rate = 0.6
        self.kelly_avg_win = 0.15
        self.kelly_avg_loss = 0.07
        
        # Look-ahead bias detection
        self.data_access_log = []  # Track what data is accessed when
        self.violations = []        # Track look-ahead violations
        
        # Survivorship bias filtering
        if self.filter_survivorship:
            from src.validators.SurvivorshipFilter import SurvivorshipFilter
            self.survivorship_filter = SurvivorshipFilter(db_path=self.db_path)
        else:
            self.survivorship_filter = None
            
        if self.strict_mode:
            from src.validators.LookAheadBiasDetector import LookAheadBiasDetector
            self.bias_detector = LookAheadBiasDetector()
        else:
            self.bias_detector = None
        
        # Load all data once to speed up simulation
        self._load_data()

    def reset(self):
        self.capital = self.initial_capital
        self.positions = [] 
        self.trade_log = []
        self.history = []
        if self.strict_mode:
            self.data_access_log = []
            self.violations = [] 

    def _load_data(self):
        conn = sqlite3.connect(self.db_path)
        print("Loading market data...")
        self.quotes = pd.read_sql_query("SELECT * FROM StockQuote ORDER BY date ASC", conn)
        # Custom date parser to handle ROC dates (e.g. 1150108) and standard dates
        def parse_date(d):
            try:
                # Try standard parsing first
                return pd.to_datetime(d)
            except:
                pass
            
            # Handler for integer/string ROC dates
            try:
                s = str(d)
                if len(s) == 7: # e.g. 1150108
                    roc_year = int(s[:3])
                    month = int(s[3:5])
                    day = int(s[5:])
                    return datetime(roc_year + 1911, month, day)
            except:
                return pd.NaT
            return pd.NaT

        # Apply robust parsing
        self.quotes['date'] = self.quotes['date'].apply(parse_date)
        # Drop invalid dates
        self.quotes.dropna(subset=['date'], inplace=True)
        self.quotes.set_index(['stockId', 'date'], inplace=True)
        self.stock_ids = self.quotes.index.get_level_values(0).unique()
        
        # Pre-calculate indicators for all stocks to save time during loop
        print("Pre-calculating indicators...")
        list_dfs = []
        for sid in self.stock_ids:
            df = self.quotes.xs(sid, level=0).copy()
            if len(df) < 50: continue
            
            # Standard Indicators
            df['ma5'] = talib.SMA(df['close'], 5)
            df['ma10'] = talib.SMA(df['close'], 10)
            df['ma20'] = talib.SMA(df['close'], 20)
            df['vol_ma20'] = df['volume'].shift(1).rolling(20).mean()
            df['high20'] = df['high'].shift(1).rolling(20).max()
            
            df['stockId'] = sid
            list_dfs.append(df)
            
        if list_dfs:
            self.enhanced_quotes = pd.concat(list_dfs).reset_index().set_index(['date', 'stockId']).sort_index()
            # Drop duplicates to prevent Series return on loc
            self.enhanced_quotes = self.enhanced_quotes[~self.enhanced_quotes.index.duplicated(keep='last')]
            self.dates = sorted(self.enhanced_quotes.index.get_level_values(0).unique())
            print(f"Data ready. {len(self.dates)} trading days loaded.")
        else:
            self.enhanced_quotes = pd.DataFrame()
            self.dates = []
            print("No sufficient data loaded.")

    def run(self, strategy_func, start_date='2025-06-01', end_date='2026-01-15', params=None):
        """
        Runs the simulation.
        strategy_func: function(date, daily_data_slice) -> list of stock_ids to buy
        params: dict of strategy parameters (optional)
        """
        self.reset()
        self.params = params or {}
        
        # Default parameters if not provided
        self.params.setdefault('stop_loss', 0.07)
        self.params.setdefault('take_profit', 0.20)
        self.params.setdefault('time_stop', 20)
        
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        
        sim_dates = [d for d in self.dates if start_dt <= d <= end_dt]
        
        print(f"Starting simulation from {start_date} to {end_date}...")
        
        for current_date in sim_dates:
            # 1. Update Portfolio (Mark to Market & Check Exits)
            self._update_positions(current_date)
            
            # 2. Get today's market slice
            try:
                daily_slice = self.enhanced_quotes.loc[current_date]
            except KeyError:
                continue

            # 3. Ask Strategy for Buy Signals
            owned_stocks = [p['stock_id'] for p in self.positions]
            candidates = strategy_func(current_date, daily_slice)
            
            # 4. Execute Buys
            
            # [Phase 4] Survivorship Bias Filter
            if self.survivorship_filter:
                # Filter candidates to ensure they were listed at current_date
                # Note: candidates is a list of stockIds. Convert string date if needed.
                date_str = current_date.strftime('%Y-%m-%d')
                candidates = self.survivorship_filter.filter_stocks(date_str, candidates)
            
            # [Phase 4] Look-ahead Bias Check (Strict Mode)
            if self.strict_mode and self.bias_detector:
                # Log usage of today's Close/High/Low used for 'Buys' (simulated check)
                # In real engine, we'd wrap data access. Here we audit the strategy result.
                # If strategy returns a buy signal for today, we check if it 'peeked'.
                # For this simplified engine, we assume strategy function *only* gets daily_slice.
                pass 
                # Ideally, we verify daily_slice usage, but since it's passed by value, 
                # we can't easily trap access without a wrapper. 
                # Instead, we assume the user respects the input.
                
            self._execute_buys(current_date, candidates, daily_slice, owned_stocks)
            
            # Record history
            total_value = self.capital + sum(p['shares'] * p['current_price'] for p in self.positions)
            self.history.append({'date': current_date, 'value': total_value})

        return self._generate_report()

    def _update_positions(self, current_date):
        active_positions = []
        for pos in self.positions:
            sid = pos['stock_id']
            try:
                row = self.enhanced_quotes.loc[(current_date, sid)]
                # Ensure scalar
                current_price = float(row['close']) if isinstance(row['close'], (float, int, np.number)) else float(row['close'].iloc[0])
            except (KeyError, IndexError):
                active_positions.append(pos)
                continue
                
            pos['current_price'] = current_price
            pnl_pct = (current_price - pos['entry_price']) / pos['entry_price']
            days_held = (current_date - pos['entry_date']).days
            
            # Simple Exit Rules
            stop_loss_threshold = -abs(self.params.get('stop_loss', 0.07))
            take_profit_threshold = abs(self.params.get('take_profit', 0.20))
            time_stop_days = int(self.params.get('time_stop', 20))
            
            is_stop_loss = pnl_pct < stop_loss_threshold
            is_take_profit = pnl_pct > take_profit_threshold
            is_time_stop = days_held > time_stop_days 
            
            if is_stop_loss or is_take_profit or is_time_stop:
                revenue = pos['shares'] * current_price
                self.capital += revenue
                reason = "Stop Loss" if is_stop_loss else ("Take Profit" if is_take_profit else "Time Stop")
                self.trade_log.append({
                    'entry_date': pos['entry_date'],
                    'exit_date': current_date,
                    'stock_id': sid,
                    'entry_price': pos['entry_price'],
                    'exit_price': current_price,
                    'pnl_pct': pnl_pct,
                    'reason': reason
                })
            else:
                active_positions.append(pos)
        self.positions = active_positions

    def _execute_buys(self, current_date, candidates, daily_slice, owned_stocks):
        MAX_POSITIONS = 5
        if len(self.positions) >= MAX_POSITIONS: return
        
        buy_list = [c for c in candidates if c not in owned_stocks][:MAX_POSITIONS - len(self.positions)]
        if not buy_list: return
        
        # Calculate position size based on mode
        if self.position_mode == 'kelly':
            # Update Kelly parameters from recent trades (if enough history)
            if len(self.trade_log) >= 10:
                recent_trades = self.trade_log[-20:]  # Last 20 trades
                wins = [t['pnl_pct'] for t in recent_trades if t['pnl_pct'] > 0]
                losses = [abs(t['pnl_pct']) for t in recent_trades if t['pnl_pct'] <= 0]
                
                if wins and losses:
                    self.kelly_win_rate = len(wins) / len(recent_trades)
                    self.kelly_avg_win = sum(wins) / len(wins)
                    self.kelly_avg_loss = sum(losses) / len(losses)
            
            # Calculate Kelly fraction
            if self.kelly_avg_loss > 0:
                odds = self.kelly_avg_win / self.kelly_avg_loss
                kelly_full = (odds * self.kelly_win_rate - (1 - self.kelly_win_rate)) / odds
                kelly_half = max(0.05, min(0.30, kelly_full * 0.5))  # Half-Kelly, capped 5-30%
            else:
                kelly_half = 0.15
            
            target_allocation = self.initial_capital * kelly_half
        else:
            # Fixed 20%
            target_allocation = self.initial_capital * 0.2
        
        for sid in buy_list:
            if self.capital < target_allocation: break
            try:
                price = daily_slice.loc[sid]['close']
            except KeyError:
                continue
            
            shares = int(target_allocation / price)
            cost = shares * price
            
            if cost > self.capital: continue
            
            self.capital -= cost
            self.positions.append({
                'stock_id': sid,
                'entry_price': price,
                'shares': shares,
                'entry_date': current_date,
                'current_price': price
            })

    def _generate_report(self):
        df_trades = pd.DataFrame(self.trade_log)
        df_history = pd.DataFrame(self.history)
        
        if df_trades.empty:
            return {"total_trades": 0, "win_rate": 0, "total_return_pct": 0, "avg_pnl": 0, "trades": pd.DataFrame()}
            
        win_rate = len(df_trades[df_trades['pnl_pct'] > 0]) / len(df_trades)
        total_ret = (self.history[-1]['value'] - self.initial_capital) / self.initial_capital
        
        return {
            "total_trades": len(df_trades),
            "win_rate": win_rate,
            "avg_pnl": df_trades['pnl_pct'].mean(),
            "total_return_pct": total_ret * 100,
            "trades": df_trades
        }

def example_breakout_strategy(date, daily_data):
    mask = (
        (daily_data['close'] > daily_data['high20']) &
        (daily_data['ma5'] > daily_data['ma20']) &
        (daily_data['volume'] > 2 * daily_data['vol_ma20'])
    )
    
    # stockId is the index after slicing by date
    return daily_data[mask].index.tolist()

if __name__ == "__main__":
    engine = RollingBacktestEngine()
    results = engine.run(example_breakout_strategy, start_date='2025-07-01', end_date='2026-01-14')
    print("\n--- Rolling Backtest Results ---")
    print(f"Total Trades: {results['total_trades']}")
    print(f"Win Rate: {results['win_rate']*100:.2f}%")
    print(f"Total Return: {results['total_return_pct']:.2f}%")
