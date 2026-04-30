# 凱利準則與風險防禦系統整合指南

> Last reviewed: 2026-04-30 — Action: confirmed referenced source files exist (src/lib/portfolio/KellyCalculator.ts, src/lib/risk/RiskDefenseModule.ts). Minor clarifications added to docs repository.


## 概述

本系統已整合凱利準則 (Kelly Criterion) 倉位管理與多層級風險防禦模組，提供科學化的資金配置與風險控制。

---

## 核心模組

### 1. KellyCalculator (凱利準則計算器)

**位置**: `src/lib/portfolio/KellyCalculator.ts`

**功能**:
- 計算最佳倉位比例 (Full Kelly & Half-Kelly)
- 從歷史回測數據估算參數
- 風險等級評估 (LOW/MEDIUM/HIGH/EXTREME)
- 自動安全上限 (30% 單一標的)

**基本用法**:
```typescript
import { kellyCalculator } from '@/lib/portfolio/KellyCalculator';

// 方法 1: 從歷史交易估算參數
const trades = [
    { pnlPct: 0.15 },  // +15% 獲利
    { pnlPct: -0.07 }, // -7% 虧損 (停損)
    // ... 更多交易記錄 (至少 10 筆)
];

const params = kellyCalculator.estimateFromBacktest(trades);
// 輸出: { winRate: 0.6, avgWin: 0.18, avgLoss: 0.07 }

// 方法 2: 直接計算凱利倉位
const result = kellyCalculator.calculate({
    winRate: 0.65,  // 65% 勝率
    avgWin: 0.18,   // 平均獲利 18%
    avgLoss: 0.07   // 平均虧損 7%
});

console.log(result.recommended); // 建議倉位 (例如: 0.15 = 15%)
console.log(result.reasoning);   // 推理說明
```

**公式說明**:
```
f* = (bp - q) / b
其中:
  f* = 最佳倉位比例
  b  = 賠率 (avgWin / avgLoss)
  p  = 勝率
  q  = 敗率 (1 - p)
```

---

### 2. RiskDefenseModule (風險防禦模組)

**位置**: `src/lib/risk/RiskDefenseModule.ts`

**功能**:
- 四層止損系統 (L1-L4)
- 市場環境過濾器 (BULL/NEUTRAL/CORRECTION/BEAR)
- 自動倉位縮減 (熊市 -75%)

**止損層級**:

| 層級 | 條件 | 優先度 |
|------|------|--------|
| L1: 緊急止損 | 虧損 ≥ 7% | 最高 |
| L2: ATR 動態 | 價格 < 進場價 - 2×ATR | 高 |
| L3: 移動停利 | 獲利 ≥ 20% 後跌破峰值 10% | 中 |
| L4: 時間止損 | 持倉 ≥ 20 天未達標 | 低 |

**基本用法**:
```typescript
import { riskDefenseModule } from '@/lib/risk/RiskDefenseModule';

// 評估現有倉位是否應停損
const position = {
    entryPrice: 400,
    entryDate: new Date('2026-01-10'),
    currentPrice: 370,  // -7.5%
    highestPrice: 420,
    atr: 15
};

const result = riskDefenseModule.evaluateStopLoss(position);
if (result.shouldExit) {
    console.log(`觸發 ${result.level}: ${result.reasoning}`);
}

// 計算新倉位的止損價
const stopPrice = riskDefenseModule.calculateStopLossPrice(400, 15);
console.log(`建議止損價: ${stopPrice}`); // 例如: 370 (400 - 2×15)

// 計算目標價 (3:1 風報比)
const targetPrice = riskDefenseModule.calculateTargetPrice(400, 370, 3.0);
console.log(`目標價: ${targetPrice}`); // 例如: 490
```

---

### 3. MarketEnvironmentFilter (市場環境過濾器)

**功能**:
- 偵測市場環境 (牛市/中性/修正/熊市)
- 自動調整倉位規模

**策略**:
- **牛市** (價格 > MA20 > MA60): 100% 倉位
- **中性** (混合訊號): 75% 倉位
- **修正** (價格 < MA20 但 > MA60): 50% 倉位
- **熊市** (價格 < MA60 或 VIX > 30): 25% 倉位

**整合範例**:
```typescript
import { marketEnvironmentFilter } from '@/lib/risk/RiskDefenseModule';

const environment = marketEnvironmentFilter.assessMarketRegime(
    18000,  // 大盤指數
    17500,  // MA20
    17000   // MA60
);

console.log(environment.regime);         // 'BULL'
console.log(environment.scalingFactor);  // 1.0 (100%)
console.log(environment.reasoning);      // '強勢上升趨勢：全力進攻'
```

---

## 整合至 AssetDoublingStrategy

### 步驟 1: 策略回測準備

首先需要有歷史回測數據來估算凱利參數:

```bash
# 執行資產翻倍策略回測
npm run backtest
```

### 步驟 2: 計算策略參數

從回測結果提取參數:

```typescript
// 假設回測產生 100 筆交易
const backtestTrades = [
    { pnlPct: 0.22 },
    { pnlPct: -0.07 },
    // ... 98 more trades
];

const strategyParams = kellyCalculator.estimateFromBacktest(backtestTrades);
```

### 步驟 3: 在 ScreeningResult 中加入 Kelly 建議

`AssetDoublingStrategy` 已整合以下欄位:

```typescript
export interface ScreeningResult {
    // ... 現有欄位
    
    // Kelly 倉位建議
    kellyPositionPct?: number;      // 凱利建議倉位 %
    kellyReasoning?: string;        // 推理說明
    kellyRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    
    // 市場環境
    marketRegime?: 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR';
    marketScalingFactor?: number;   // 倉位縮放係數
}
```

### 步驟 4: 使用範例

```typescript
// 在前端顯示建議倉位
const stock = screeningResults[0];

console.log(`${stock.name}`);
console.log(`信心分數: ${stock.technicalScore}分`);
console.log(`建議倉位: ${stock.kellyPositionPct?.toFixed(1)}%`);
console.log(`風險等級: ${stock.kellyRisk}`);
console.log(`市場狀態: ${stock.marketRegime}`);
console.log(`推理: ${stock.kellyReasoning}`);
```

---

## 完整交易流程範例

```typescript
// 1. 策略篩選股票
const candidates = await assetDoublingStrategy.screen(allStocks, marketData);

// 2. 取得市場環境
const marketStatus = await marketStatusService.getStatus();

// 3. 計算凱利倉位 (假設策略歷史勝率 65%)
const kellyResult = kellyCalculator.calculateForStock(
    {
        winRate: 0.65,
        avgWin: 0.18,
        avgLoss: 0.07
    },
    candidates[0].technicalScore  // 信心分數 0-100
);

// 4. 應用市場縮放
const finalPositionPct = kellyResult.recommended * marketStatus.scalingFactor;

// 5. 計算實際股數 (2% 風險法則)
const capital = 2000000;
const stockPrice = candidates[0].closePrice;
const stopLoss = candidates[0].suggestedStopLoss;

const shares = riskDefenseModule.calculatePositionSize(
    capital,
    stockPrice,
    stopLoss,
    0.02  // 2% 風險
);

console.log(`
推薦標的: ${candidates[0].name}
市場環境: ${marketStatus.regime} (縮放 ${marketStatus.scalingFactor * 100}%)
凱利建議: ${(kellyResult.recommended * 100).toFixed(1)}%
最終倉位: ${(finalPositionPct * 100).toFixed(1)}%
建議股數: ${shares.toLocaleString()} 股
止損價: ${stopLoss}
風險等級: ${kellyResult.risk}
`);
```

---

## 測試與驗證

所有模組皆有完整單元測試:

```bash
# 測試凱利計算器
npm test -- KellyCalculator

# 測試風險防禦模組
npm test -- RiskDefenseModule

# 測試全部
npm test
```

**測試覆蓋率**: 22/22 tests passing ✅

---

## 最佳實踐

### 1. 凱利準則使用建議
- ✅ 使用 Half-Kelly (較保守)
- ✅ 設定 30% 倉位上限
- ✅ 根據信心分數調整
- ❌ 不要使用 Full Kelly (風險過高)

### 2. 風險管理建議
- ✅ 嚴格執行 L1 緊急止損 (-7%)
- ✅ 獲利 20% 後啟用移動停利
- ✅ 熊市自動減倉至 25%
- ❌ 不要手動關閉止損系統

### 3. 市場環境適應
- ✅ 牛市: 積極進攻 (100% 倉位)
- ✅ 修正: 謹慎觀察 (50% 倉位)
- ✅ 熊市: 防守為主 (25% 倉位)
- ❌ 不要在熊市逆勢加碼

---

## 效能指標

| 模組 | 單元測試 | 測試覆蓋率 | 狀態 |
|------|----------|------------|------|
| KellyCalculator | 11/11 | 100% | ✅ |
| RiskDefenseModule | 11/11 | 100% | ✅ |
| MarketEnvironmentFilter | 包含於 RiskDefense | 100% | ✅ |

---

## 常見問題

### Q: 為什麼使用 Half-Kelly 而非 Full Kelly?
**A**: Full Kelly 在極端情況下可能建議 40-50% 倉位，波動過大。Half-Kelly 提供更平穩的資金曲線。

### Q: 止損層級會衝突嗎?
**A**: 系統依優先度執行 (L1 > L2 > L3 > L4)，只要有任一層級觸發即停損。

### Q: 市場環境誤判怎麼辦?
**A**: 系統使用 MA20/MA60 golden cross，是經典技術指標。若需更敏感度可調整參數。

### Q: 凱利公式的勝率從哪來?
**A**: 使用 `estimateFromBacktest()` 從歷史回測數據自動估算，或手動設定策略預期勝率。

---

## 下一步

1. [x] ✅ 凱利準則實作  
2. [x] ✅ 風險防禦模組
3. [x] ✅ 市場環境過濾
4. [ ] 🔄 整合至前端 UI
5. [ ] 🔄 滾動式回測驗證
6. [ ] 📋 歷史翻倍股特徵庫

---

**文件版本**: v1.0  
**最後更新**: 2026-01-21  
**維護者**: Asset Doubling Team
