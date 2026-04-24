# Stock洞察平台

台股研究、候選股篩選、回測驗證與每日洞察平台。

原名 "Asset Doubling Prediction System"，現已整合 AI 訊號融合、市場環境偵測、每日快照比較、通知發送層，升級為完整研究輔助平台。

> ⚠️ **免責聲明**：本平台所有分析與提醒均僅供研究參考，不構成任何投資建議或交易指令。

---

## 📋 目錄

- [架構總覽](#架構總覽)
- [核心功能](#核心功能)
- [資料底座](#資料底座)
- [系統運維](#系統運維)
- [快速開始](#快速開始)
- [專案結構](#專案結構)
- [v1 Release Notes](#v1-release-notes)
- [v2 路線圖](#v2-路線圖)

---

## 架構總覽

系統採用分層架構，各層職責嚴格分離：

| Layer | 模組 | 說明 |
|-------|------|------|
| L1 | SignalFusionEngine | 多因子 alpha 計算 |
| L2 | StrategyScreenEngine | 候選股篩選與 bucket 分類 |
| L2 | Backtest Engine | 策略回測與 B&H 比較 |
| L3 | MultiAgentResearchEngine | 多 Agent 解釋與風險辯論 |
| L3 | Event / Topic Layer | 新聞、主題、題材脈絡 |
| L3+ | PortfolioImpactEngine | 組合風險與集中度分析 |

---

## 核心功能

### 1. Alpha + 篩選系統（L1 / L2）

- `alphaScore`：融合 technical / chip / fundamental 的多因子評分
- bucket 分類：`Strong` / `Watch` / `Neutral` / `Excluded`
- `confidence` / `riskLevel` 隨分析深度動態更新
- strict validation pipeline — 資料不足時降級輸出，不亂推

### 2. 個股研究頁 `/stocks/[symbol]`

5 大分析維度：

| Tab | 說明 |
|-----|------|
| 綜合分析 | alpha / bucket / confidence |
| 技術指標 | MA / RSI / MACD / KD |
| 回測概覽 | Strategy vs Buy & Hold |
| 研究委員會 | 6 Agent 分析 |
| 持倉脈絡 | 候選池 + watchlist 狀態 |

- Snapshot comparison（昨日 vs 今日變化）
- Backtest summary（自動計算）
- 事件 + 主題脈絡整合

### 3. 多 Agent 研究層（L3）

6 個 deterministic Agent（無 LLM，無幻覺）：

| Agent | 職責 |
|-------|------|
| Technical | 技術結構分析 |
| Market | 市場環境評估 |
| Chip | 籌碼集中度分析 |
| Fundamental | 基本面評估 |
| Catalyst | 事件催化劑偵測 |
| Risk | 反證與風險辯論 |

- 完全 deterministic，不受 LLM 影響
- degraded mode：資料不足時誠實揭露，不推測
- 不影響 `alphaScore`（研究層與量化層隔離）

### 4. 事件 / 主題系統（TrendRadar-style）

**Event Layer**
- RSS + 多來源整合
- 去重（URL / title / 時間窗）
- trust 分級：`official` / `mainstream` / `secondary` / `unknown`

**Topic 系列引擎**

| 模組 | 功能 |
|------|------|
| TopicSurge | 主題升溫偵測 |
| ThemeDiffusion | 題材擴散追蹤 |
| TopicMomentum | 趨勢狀態（spike / rising / cooling） |
| ThemeLinkage | 主題連動分析 |
| SectorGraph | 題材 → 產業 → 個股關聯圖 |
| CrossMarketTheme | 跨板塊傳導 |
| SectorTimeline | 題材生命週期 |

### 5. Event Alerts（研究提醒）

- 模式：`symbol` / `watchlist` / `candidates` / `market`
- Alert types：`new_event` / `topic_surging` / `theme_diffusing` / `low_trust_cluster`
- ❌ 不產生交易訊號，❌ 不影響策略層

### 6. Portfolio Decision Support（L3+）

輸出（`/watchlist` / `/report/daily`）：
- `themeConcentration` / `sectorConcentration`
- `riskClusters` / `regimeExposure`
- Snapshot Comparison（1d / 7d / 30d）
  - 嚴格基準日，不做 fallback 補值
  - `comparisonAvailable=false` 誠實揭露資料不足

### 7. 通知系統

| 管道 | 狀態 |
|------|------|
| LINE Notify | ✅ 已整合 |
| Webhook | ✅ 已整合 |
| Email | 🔲 stub（預留） |

- delivery log + retry
- degraded mode（token 缺失時不崩潰）
- test endpoint：`POST /api/system/test-notify`
- channel status dashboard：`/settings/notifications`

---

## 資料底座

| 資料表 | 覆蓋 |
|--------|------|
| StockQuote | 230 檔（229 檔 ≥ 250 天） |
| InstitutionalChip | 1,343 檔（avg 195 天） |
| MarketIndex | 1,001 rows（已正規化） |
| NewsEvent | 81 筆（多來源） |

已解決：
- T86 歷史資料缺口 → 已可回補
- 日期格式混亂 → 已統一
- RSS 單點失敗 → 多來源 fallback

---

## 系統運維

### Cron Jobs

| Job | 說明 |
|-----|------|
| `daily_sync` | 資料同步 |
| `event_sync` | 事件抓取 |
| `daily_alerts` | 研究提醒產生 |
| `portfolio_snapshot_*` | 組合快照 |
| `daily_cleanup` | retention 清理 |

### Retention Policy

| 資料表 | 保留 |
|--------|------|
| Snapshot | 180 天 |
| Alerts | 90 天 |
| Market / Candidate | 60–90 天 |

- hard floor：30 天（不刪最近 30 天）
- 不刪當日資料

### System Health

- `GET /api/system/health` — 整合資料品質、snapshot freshness、通知狀態、sync logs
- `/settings/system` — UI 面板

---

## 快速開始

### 環境需求

- Node.js v18+
- SQLite（預設）

### 安裝

```bash
git clone <repo>
npm install
npx prisma db push
```

### 環境變數

建立 `.env`：

```env
DATABASE_URL="file:./dev.db"
LINE_NOTIFY_TOKEN="your_token_here"   # 選填：LINE 通知
OPENAI_API_KEY="your_key_here"        # 選填：AI 情緒分析
```

### 啟動

```bash
# 開發伺服器
npm run dev
# 開啟 http://localhost:3000

# 背景監控（建議 CRON 每小時執行）
npm run monitor

# 每日報告
npm run brief

# 回測
npm run backtest
```

---

## 專案結構

```
src/
├── app/                  # Next.js App Router 頁面與 API routes
├── components/           # UI 元件（GlassCard、Charts、Tables）
├── lib/
│   ├── strategies/       # 核心交易邏輯（AssetDoublingStrategy）
│   ├── services/         # 業務服務（Screening、MarketStatus）
│   ├── analysis/         # RuleBasedStockAnalyzer
│   ├── events/           # Event / Topic 引擎
│   ├── portfolio/        # PortfolioImpactEngine
│   ├── report/           # 報告產生
│   ├── notify/           # 通知發送
│   └── prisma-safe.ts    # 型別安全 Prisma accessor
├── types/
│   ├── status.ts         # 共用 status / degraded-state 型別
│   └── api-payloads.ts   # 共用 API response 型別
scripts/                  # 自動化腳本（Watchdog、Briefing、Optimizer）
prisma/                   # Schema 與 migrations
```

---

## v1 Release Notes

> **v1 封板時間**：2026-03

### 🎯 v1 系統達成

- ✅ 完整量化核心（L1/L2）
- ✅ 可解釋研究層（L3）— 6 Agent，完全 deterministic
- ✅ 組合決策輔助（L3+）— snapshot comparison、集中度分析
- ✅ 穩定資料與運維基礎（cron / retention / health）
- ✅ 型別與 build 收斂完成（TypeScript 0 errors）

### 🔧 工程品質

- **TypeScript**：全專案 0 errors，移除大量 `any`，建立共用型別基礎（`status.ts`、`api-payloads.ts`）
- **測試**：多模組單元測試覆蓋（event / alert / portfolio / agent / snapshot）
- **Build**：`npm run build` ✅，核心區域 lint ✅

### ⚠️ 已知限制

| 限制 | 說明 |
|------|------|
| CatalystAgent | 仍依賴新聞資料，事件歷史深度 < 90 天 |
| Symbol coverage | 部分個股無 sector mapping 或完整 quote |
| Topic graph | 簡化版，非完整 network graph |

---

## v2 路線圖

> v1 是「**會分析**的系統」，v2 是「**知道什麼重要**的系統」

### 🧭 v2 核心目標

1. **哪些訊號真的有用**（Signal → Value）
2. **哪些資訊只是噪音**（Noise → 減少）
3. **如何讓人每天「會用」**而不是「看過就關」

### 🔺 架構升級方向

| 層級 | v1 | v2 |
|------|----|----|
| L1/L2 | alpha / screen | ✅ 不變（穩定核心） |
| L3 | 研究解釋 | → 重要性排序 + relevance filtering |
| L3+ | 組合分析 | → 決策優先級 + 行動提示（非交易） |
| 新增 | ❌ | **L4：Decision Context Layer** |

### 🧠 v2 五大核心模組

#### Phase 1 🥇 Signal Effectiveness Layer（最優先）

> 解決：哪些東西真的有用？

每個訊號附帶：
- `historicalHitRate`：歷史準確率
- `conditionalROI`：條件性報酬
- `regimePerformance`：在不同市場環境下的表現

範例輸出：
```
「AI 伺服器主題擴散」→ 過去 12 次：
  上漲機率：58%  |  超越大盤：+1.8%  |  僅在 Bull regime 有效
```

#### Phase 2 🥈 Relevance Filtering（降噪）

每個輸出加上：
- `relevanceScore`：對該股票 / 組合的重要性
- `dataQuality`：資料品質評級

UI 行為：只顯示 Top N 重要資訊，其餘收進「次要觀察」。

#### Phase 3 🥉 Decision Context Layer（新層）

> 不給買賣建議，而是：「你現在應該注意什麼」

輸出類型：
- ⚠️ 風險升高（Risk Rising）
- 📉 結構轉弱（Structure Weakening）
- 📊 題材過熱（Theme Overcrowded）
- 🔄 Regime 轉換

#### Phase 4 Signal Consistency Tracking（時間維度）

每個 symbol / topic 追蹤：
- 連續幾天出現
- 是否持續升溫 / 突然消失

#### Phase 5 User Behavior Layer

記錄使用者瀏覽行為，自動產生個人化 watchlist / alerts / report。

### 📊 v2 驗證指標

| 類型 | 指標 |
|------|------|
| 系統層 | alert 點擊率、report 閱讀完成率、watchlist 使用頻率 |
| 訊號層 | signal consistency、regime stability、topic persistence |

### 🗺️ v2 開發優先順序

```
Phase 1 → Signal Effectiveness Layer  （決定系統有沒有價值）
Phase 2 → Relevance Filtering         （降噪，提升 UX）
Phase 3 → Decision Context Layer      （讓系統像顧問）
Phase 4 → Signal Consistency Tracking （時間維度）
Phase 5 → User Behavior Layer         （產品化）
```

---

> ⚠️ 本平台所有分析均為研究工具輸出，不構成投資建議。所有模型推估均有明確標示，請自行判斷與承擔風險。
