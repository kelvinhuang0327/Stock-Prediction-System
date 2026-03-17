# Stock洞察平台

台股研究、候選股篩選、回測驗證與每日洞察平台。

原名 "Asset Doubling Prediction System"，現已整合 AI 訊號融合、市場環境偵測、每日快照比較、通知發送層，升級為完整研究輔助平台。

> **免責聲明**：本平台所有分析與提醒均僅供研究參考，不構成任何投資建議或交易指令。

## 🚀 Key Features

### 1. 🧠 Intelligent Strategy
-   **Asset Doubling Logic**: Targets stocks with high revenue growth (>30%) and technical breakout patterns.
-   **Auto-Optimization**: Uses Grid Search to find "Golden Parameters" for Moving Averages and Volatility filters.
-   **Market Regime Detection**: Automatically damps risk (reduces position size) when TAIEX is in a Bear Market or Correction.

### 2. 📊 Advanced Dashboard
-   **Live Screening**: Instantly analyzes 1000+ stocks to find candidates.
-   **Performance Caching**: Results are cached for 30 minutes for instant UI response.
-   **Sector Analytics**: Visualizes capital flow and sector rotation.
-   **Portfolio Tracker**: Tracks your watchlist performance and stop-loss levels.

### 3. 🛡️ Risk Management (Safety First)
-   **Dynamic Stop Loss**: Calculates personalized stop-loss levels (ATR/Moving Average) for every trade.
-   **Position Sizing**: Recommends exact lot sizes based on 2% Risk Rule and Market Status.
-   **Bear Market Protection**: Automatically cuts recommended exposure by 75% during market crashes.

### 4. 🤖 Agentic Automation
-   **Daily Briefing**: Generates a markdown report of the day's best opportunities and AI Sentiment analysis.
-   **Watchdog**: Runs in the background (CRON) to monitor your portfolio.
-   **Proactive Alerts**: Sends LINE Notify messages if a stock hits stop-loss or market crashes.

---

## 🛠️ Getting Started

### Prerequisites
-   Node.js (v18+)
-   SQLite (Default) or MySQL (Configurable)

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Resources setup:
    ```bash
    npx prisma db push
    ```
4.  Environment Setup:
    Create a `.env` file:
    ```env
    DATABASE_URL="file:./dev.db"
    LINE_NOTIFY_TOKEN="your_token_here" # Optional: For Alerts
    OPENAI_API_KEY="your_key_here" # Optional: For AI Sentiment
    ```

### Running the System

#### 1. Web Dashboard (Analysis & Screening)
```bash
npm run dev
# Open http://localhost:3000
```

#### 2. Background Watchdog (Alerts)
Recommended to run this via CRON every hour during trading hours.
```bash
npm run monitor
```

#### 3. Daily Briefing Report
Generates a comprehensive report in `reports/YYYY-MM-DD.md`.
```bash
npm run brief
```

#### 4. Backtesting
Test the strategy against historical data.
```bash
npm run backtest
```

---

## 📂 Project Structure
-   `src/lib/strategies`: Core Trading Logic (`AssetDoublingStrategy.ts`).
-   `src/lib/services`: Business Logic (Screening, Market Status, Sentiment).
-   `src/components`: UI Components (Dashboard, Charts).
-   `scripts`: Automation scripts (Watchdog, Briefing, Optimizer).

## ⚠️ Disclaimer
This system provides **informational analysis only**. It does not constitute financial advice. The "Asset Doubling" strategy involves high risk. Use at your own risk.
