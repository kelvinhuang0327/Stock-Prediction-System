# User Guide: Asset Doubling System

This guide explains how to operate the system effectively to find high-potential stocks ("飆股").

## 🕒 Daily Routine

### 1. Pre-Market (08:30 - 09:00)
-   **Data Sync**: `npm run sync` (Fetches latest TWSE data).
-   **Run Briefing**: `npm run brief`.
-   **Review Report**: Check `reports/` folder. Look for "Bullish" sentiment candidates.
-   **Check Market Status**: Is the TAIEX trend Bullish? (Safety Mode off?).

### 2. Market Hours (09:00 - 13:30)
-   **Open Dashboard**: `npm run dev` -> `http://localhost:3000`.
-   **Check "Ignition" Tab**: Look for stocks with the 🚀 rocket icon. These are breaking out *right now* with volume.
-   **Smart Money**: prioritize stocks with "Institutional Buying" (Big player support).
-   **Sizing**: Use the "Rec. Lot Size" calculator on the card. Do NOT oversize.

### 3. Post-Market (14:00+)
-   **Run Watchdog**: `npm run monitor` (or ensure it ran auto).
-   **Portfolio Review**: If any stock triggered a **Sell Alert**, place the sell order for next day (or after-hours).

---

## ⚙️ Configuration & Tuning

The strategy behavior is defined in `src/lib/strategies/AssetDoublingStrategy.ts`.
You can adjust these constants to fit your style:

### 1. Risk Tolerance
-   `RISK_PER_TRADE_PERCENT`: Default `0.02` (2%). Increase to 0.03 for aggressive, reduce to 0.01 for conservative.
-   `TOTAL_CAPITAL`: Set this to your actual account size (Default `2,000,000`). This ensures "Rec. Lot Size" is accurate for YOU.

### 2. Strategy Sensitivity
-   `REVENUE_GROWTH_THRESHOLD`: Default `30` (30% YoY). Higher = Fewer, higher quality stocks.
-   `VOLATILITY_MULTIPLIER`: Default `2.0` (ATR Bands). Higher = Looser stops, fewer shakeouts.

### 3. Market Regime
-   In `src/lib/services/MarketStatusService.ts`, you can adjust the MA periods (20/60) if you prefer different trend definitions.

## ❓ FAQ

**Q: Why is the dashboard empty?**
A: Ensure you have data. Run `debug:twse` to verify connectivity (though real data usually comes from your detailed data pipeline). The mock data is used if no DB data exists.

**Q: I didn't get a LINE notification.**
A: Check `.env` for `LINE_NOTIFY_TOKEN`. Also check `logs/notifications.log` to see if the system *tried* to send it.

**Q: "Market Correction" warning appeared.**
A: This is normal. The system automatically reduced your suggested position size by 50%. You can still trade, just smaller.
