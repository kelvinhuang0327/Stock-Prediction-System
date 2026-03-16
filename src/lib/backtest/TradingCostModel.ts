/**
 * TradingCostModel - 台股交易成本模型
 * 
 * Taiwan stock trading costs:
 * - Buy commission: 0.1425% (max, discount varies by broker)
 * - Sell commission: 0.1425%
 * - Securities transaction tax (sell only): 0.3%
 * - Round-trip cost: ~0.585% (before broker discounts)
 * 
 * Slippage model:
 * - Based on bid-ask spread + market impact
 * - Estimated 0.1-0.3% per trade depending on volume
 */

export interface TradingCosts {
  buyCommission: number;     // as decimal (0.001425 = 0.1425%)
  sellCommission: number;
  sellTax: number;           // 0.003 = 0.3%
  slippagePct: number;       // estimated slippage per trade
}

export interface CostResult {
  grossReturn: number;       // before costs
  netReturn: number;         // after costs
  totalCostPct: number;      // total cost as percentage
  buyCost: number;           // buy-side cost amount
  sellCost: number;          // sell-side cost amount
  slippageCost: number;      // slippage cost amount
}

// Default Taiwan stock costs (full commission, no discount)
export const TW_STOCK_COSTS: TradingCosts = {
  buyCommission: 0.001425,
  sellCommission: 0.001425,
  sellTax: 0.003,
  slippagePct: 0.001,  // 0.1% conservative slippage
};

// Discounted commission (common online broker: 6折)
export const TW_STOCK_COSTS_DISCOUNTED: TradingCosts = {
  buyCommission: 0.001425 * 0.6,
  sellCommission: 0.001425 * 0.6,
  sellTax: 0.003,
  slippagePct: 0.001,
};

// Day trade costs (tax halved for day trades)
export const TW_DAY_TRADE_COSTS: TradingCosts = {
  buyCommission: 0.001425 * 0.6,
  sellCommission: 0.001425 * 0.6,
  sellTax: 0.0015,  // 0.15% for day trade
  slippagePct: 0.002, // higher slippage for day trade
};

/**
 * Calculate net price after buy costs
 * Returns effective entry price (higher than market price)
 */
export function effectiveBuyPrice(marketPrice: number, costs: TradingCosts = TW_STOCK_COSTS): number {
  return marketPrice * (1 + costs.buyCommission + costs.slippagePct);
}

/**
 * Calculate net proceeds after sell costs
 * Returns effective exit price (lower than market price)
 */
export function effectiveSellPrice(marketPrice: number, costs: TradingCosts = TW_STOCK_COSTS): number {
  return marketPrice * (1 - costs.sellCommission - costs.sellTax - costs.slippagePct);
}

/**
 * Calculate detailed cost breakdown for a round-trip trade
 */
export function calculateTradeCosts(
  entryPrice: number,
  exitPrice: number,
  shares: number,
  costs: TradingCosts = TW_STOCK_COSTS
): CostResult {
  const buyAmount = entryPrice * shares;
  const sellAmount = exitPrice * shares;

  const buyCost = buyAmount * (costs.buyCommission + costs.slippagePct);
  const sellCost = sellAmount * (costs.sellCommission + costs.sellTax + costs.slippagePct);

  const grossReturn = (exitPrice - entryPrice) / entryPrice;
  const netProfit = sellAmount - buyAmount - buyCost - sellCost;
  const netReturn = netProfit / (buyAmount + buyCost);

  const totalCostPct = (buyCost + sellCost) / buyAmount;

  return {
    grossReturn,
    netReturn,
    totalCostPct,
    buyCost,
    sellCost,
    slippageCost: (buyAmount + sellAmount) * costs.slippagePct,
  };
}

/**
 * Estimate round-trip cost percentage for quick calculations
 */
export function roundTripCostPct(costs: TradingCosts = TW_STOCK_COSTS): number {
  return costs.buyCommission + costs.sellCommission + costs.sellTax + 2 * costs.slippagePct;
}

/**
 * Calculate minimum required return to break even after costs
 */
export function breakEvenReturn(costs: TradingCosts = TW_STOCK_COSTS): number {
  const costPct = roundTripCostPct(costs);
  // Need return > costPct to profit
  return costPct;
}
