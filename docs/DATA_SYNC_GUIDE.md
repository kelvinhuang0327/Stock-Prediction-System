# 數據同步指南

> Last reviewed: 2026-04-30 — Action: updated npm script and script paths to match repository (changed to `npm run sync` and `scripts/sync-real-data.ts`). See CHANGELOG.md for details.


## 當前狀況

資料庫只有 **8 天數據** (2026-01-08 ~ 2026-01-15)，無法進行有效的歷史翻倍股分析。

## 建議同步策略

### 選項 1: 使用現有同步腳本（推薦）

檢查是否有現成的數據同步腳本：

```bash
# 查找同步腳本
find . -name "*sync*" -o -name "*fetch*" | grep -E "\.ts$|\.js$|\.py$"

# 如果有 sync-data.ts 或類似腳本，執行:
npm run sync-data

# 或
ts-node scripts/sync-historical-data.ts --start-date 2022-01-01 --end-date 2025-12-31
```

### 選項 2: 手動從 TWSE API 下載

使用台灣證交所公開 API：

```python
# scripts/download_historical_data.py
import requests
from datetime import datetime, timedelta

def download_twse_data(stock_id, start_date, end_date):
    """
    從 TWSE 下載歷史數據
    API: https://www.twse.com.tw/rwd/zh/afterTrading/stock
    """
    # 實作細節...
    pass
```

### 選項 3: 使用第三方套件

```bash
# 安裝 yfinance (Yahoo Finance)
pip install yfinance

# 下載台股數據 (加上 .TW 後綴)
python3 -c "
import yfinance as yf
import sqlite3

# 下載鴻海 2022-2025 數據
stock = yf.Ticker('2317.TW')
hist = stock.history(start='2022-01-01', end='2025-12-31')
print(hist)
"
```

## 快速驗證方案

**不等待數據同步，直接測試籌碼異常偵測器：**

使用現有的 3 支翻倍股數據進行功能驗證：
- 2881 富邦金 (+911%)
- 2603 長榮海運 (+326%)
- 2317 鴻海 (+127%)

這樣可以先確保系統邏輯正確，待數據同步完成後再擴大分析範圍。

## 預期結果

同步 2022-2025 年數據後，預期能找到：
- **50-100 支翻倍股**（根據台股歷史統計）
- 每支股票約 800-1000 個交易日數據
- 總數據量約 40,000-80,000 筆 StockQuote 記錄

## 執行順序

1. ✅ 先完成籌碼異常偵測器實作與測試
2. 📊 同步歷史數據（可在背景執行）
3. 🔄 重新執行翻倍股掃描器
4. 📈 分析更多翻倍股特徵

---

**需要我協助創建數據同步腳本嗎？**
