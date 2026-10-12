/**
 * Kelly Position Sizing Integration Example
 * 
 * This module demonstrates how to use Kelly Calculator with historical backtest data
 */

import { kellyCalculator } from '../src/lib/portfolio/KellyCalculator';
import { riskDefenseModule } from '../src/lib/risk/RiskDefenseModule';

// Example 1: Estimate Kelly parameters from historical trades
function example1_estimateFromBacktest() {
    console.log('=== Example 1: Estimate Kelly from Backtest ===\n');

    // Simulated historical trades from backtesting
    const historicalTrades = [
        { pnlPct: 0.15 },  // +15% win
        { pnlPct: 0.22 },  // +22% win
        { pnlPct: -0.07 }, // -7% loss (stopped out)
        { pnlPct: 0.18 },  // +18% win
        { pnlPct: -0.07 }, // -7% loss
        { pnlPct: 0.25 },  // +25% win
        { pnlPct: 0.12 },  // +12% win
        { pnlPct: -0.06 }, // -6% loss
        { pnlPct: 0.30 },  // +30% win
        { pnlPct: 0.19 },  // +19% win
        { pnlPct: -0.07 }, // -7% loss
        { pnlPct: 0.21 }   // +21% win
    ];

    const params = kellyCalculator.estimateFromBacktest(historicalTrades);
    console.log('Estimated Parameters:');
    console.log(`  Win Rate: ${(params.winRate * 100).toFixed(1)}%`);
    console.log(`  Avg Win: ${(params.avgWin * 100).toFixed(1)}%`);
    console.log(`  Avg Loss: ${(params.avgLoss * 100).toFixed(1)}%`);

    const result = kellyCalculator.calculate(params);
    console.log('\nKelly Recommendation:');
    console.log(`  Full Kelly: ${(result.kellyFraction * 100).toFixed(1)}%`);
    console.log(`  Half Kelly: ${(result.halfKelly * 100).toFixed(1)}%`);
    console.log(`  Recommended: ${(result.recommended * 100).toFixed(1)}%`);
    console.log(`  Risk Level: ${result.risk}`);
    console.log(`  Reasoning: ${result.reasoning}\n`);
}

// Example 2: Calculate position size for a specific stock
function example2_stockPositionSizing() {
    console.log('=== Example 2: Stock Position Sizing ===\n');

    // Strategy has historical 65% win rate
    const strategyPerformance = {
        winRate: 0.65,
        avgWin: 0.18,   // Average winner: +18%
        avgLoss: 0.07   // Average loser: -7% (stop loss)
    };

    // Current stock has confidence score of 75/100
    const stockConfidence = 75;

    const result = kellyCalculator.calculateForStock(
        strategyPerformance,
        stockConfidence
    );

    console.log('Stock: 世芯-KY (3661)');
    console.log(`Confidence Score: ${stockConfidence}/100`);
    console.log(`\nPosition Sizing:`);
    console.log(`  Recommended Position: ${(result.recommended * 100).toFixed(1)}%`);
    console.log(`  Risk Level: ${result.risk}`);
    console.log(`  Reasoning: ${result.reasoning}`);

    // Calculate actual shares to buy
    const capital = 2000000;  // 2M TWD
    const stockPrice = 420;   // Current price
    const positionValue = capital * result.recommended;
    const shares = Math.floor(positionValue / stockPrice);
    const lots = Math.floor(shares / 1000);

    console.log(`\nWith ${(capital / 1000000).toFixed(1)}M capital at price ${stockPrice}:`);
    console.log(`  Position Value: ${(positionValue / 1000).toFixed(0)}K`);
    console.log(`  Shares: ${shares.toLocaleString()}`);
    console.log(`  Lots: ${lots}\n`);
}

// Example 3: Risk Defense - Stop Loss Management
function example3_stopLossManagement() {
    console.log('=== Example 3: Stop Loss Management ===\n');

    const position = {
        entryPrice: 400,
        entryDate: new Date('2026-01-10'),
        currentPrice: 450,  // Up 12.5%
        highestPrice: 460,  // Peak was 15%
        atr: 15
    };

    console.log('Position Details:');
    console.log(`  Entry: ${position.entryPrice}`);
    console.log(`  Current: ${position.currentPrice} (+${((position.currentPrice / position.entryPrice - 1) * 100).toFixed(1)}%)`);
    console.log(`  Peak: ${position.highestPrice} (+${((position.highestPrice / position.entryPrice - 1) * 100).toFixed(1)}%)`);
    console.log(`  ATR: ${position.atr}`);

    const stopLoss = riskDefenseModule.evaluateStopLoss(position);

    console.log(`\nStop Loss Analysis:`);
    console.log(`  Should Exit: ${stopLoss.shouldExit ? '❌ YES' : '✅ NO'}`);
    console.log(`  Current P&L: ${(stopLoss.currentLoss * 100).toFixed(1)}%`);
    if (stopLoss.shouldExit) {
        console.log(`  Trigger Level: ${stopLoss.level}`);
        console.log(`  Stop Price: ${stopLoss.stopPrice?.toFixed(2)}`);
    }
    console.log(`  Reasoning: ${stopLoss.reasoning}\n`);
}

// Example 4: Complete Workflow - Entry to Exit
function example4_completeWorkflow() {
    console.log('=== Example 4: Complete Trading Workflow ===\n');

    const capital = 2000000;
    const stockPrice = 380;
    const atr = 12;

    // Step 1: Calculate Stop Loss
    const stopLoss = riskDefenseModule.calculateStopLossPrice(stockPrice, atr);
    console.log(`Step 1: Entry Planning`);
    console.log(`  Stock Price: ${stockPrice}`);
    console.log(`  ATR: ${atr}`);
    console.log(`  Stop Loss: ${stopLoss.toFixed(2)}`);
    console.log(`  Risk per Share: ${(stockPrice - stopLoss).toFixed(2)}`);

    // Step 2: Calculate Target Price (3:1 Risk-Reward)
    const target = riskDefenseModule.calculateTargetPrice(stockPrice, stopLoss, 3.0);
    console.log(`\nStep 2: Target Price (3:1 R:R)`);
    console.log(`  Target: ${target.toFixed(2)} (+${((target / stockPrice - 1) * 100).toFixed(1)}%)`);

    // Step 3: Position Size (2% Risk Rule)
    const shares = riskDefenseModule.calculatePositionSize(capital, stockPrice, stopLoss, 0.02);
    const lots = Math.floor(shares / 1000);
    const positionValue = shares * stockPrice;
    const positionPct = (positionValue / capital) * 100;

    console.log(`\nStep 3: Position Sizing (2% Risk)`);
    console.log(`  Shares: ${shares.toLocaleString()}`);
    console.log(`  Lots: ${lots}`);
    console.log(`  Position Value: ${(positionValue / 1000).toFixed(0)}K (${positionPct.toFixed(1)}%)`);
    console.log(`  Max Risk: ${(capital * 0.02 / 1000).toFixed(0)}K (2% of capital)\n`);
}

// Run all examples
if (require.main === module) {
    example1_estimateFromBacktest();
    example2_stockPositionSizing();
    example3_stopLossManagement();
    example4_completeWorkflow();
}

export {
    example1_estimateFromBacktest,
    example2_stockPositionSizing,
    example3_stopLossManagement,
    example4_completeWorkflow
};
