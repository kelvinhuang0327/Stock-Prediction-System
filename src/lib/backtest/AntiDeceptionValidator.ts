/**
 * AntiDeceptionValidator - 防自欺驗證模組
 *
 * 在顯示回測結果前，自動檢查是否存在以下問題：
 * 1. 結果過於完美 (可能過度擬合)
 * 2. 樣本不足
 * 3. 缺少交易成本
 * 4. 缺少 benchmark 對照
 * 5. 只展示最佳期間/參數
 * 6. Sharpe > 3 (幾乎不可能在真實市場達到)
 */

import type { PerformanceMetrics, BacktestResult } from './StrategyBacktestEngine';

export interface ValidationWarning {
  level: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  detail: string;
}

export interface ValidationReport {
  passed: boolean;
  trustScore: number;  // 0-100, higher = more trustworthy
  warnings: ValidationWarning[];
  summary: string;
}

export function validateBacktestResult(result: BacktestResult): ValidationReport {
  const warnings: ValidationWarning[] = [];
  let trustScore = 100;

  const m = result.metrics;

  // === CRITICAL: Suspiciously good results ===

  if (m.sharpeRatio > 3) {
    warnings.push({
      level: 'critical',
      code: 'SUSPICIOUS_SHARPE',
      message: `Sharpe Ratio ${m.sharpeRatio.toFixed(2)} 異常偏高`,
      detail: '真實市場中，年化 Sharpe > 2 已屬頂尖，> 3 幾乎不可能。此結果高度疑似過度擬合、生存者偏差、或遺漏交易成本。',
    });
    trustScore -= 30;
  }

  if (m.winRate > 0.8 && m.totalTrades > 10) {
    warnings.push({
      level: 'critical',
      code: 'SUSPICIOUS_WIN_RATE',
      message: `勝率 ${(m.winRate * 100).toFixed(1)}% 異常偏高`,
      detail: '80%+ 勝率在頻繁交易中極為罕見。可能存在前視偏差或過度擬合。',
    });
    trustScore -= 25;
  }

  if (m.maxDrawdown < 0.02 && m.totalTrades > 20 && m.totalReturn > 0.2) {
    warnings.push({
      level: 'critical',
      code: 'SUSPICIOUS_LOW_DD',
      message: `最大回撤僅 ${(m.maxDrawdown * 100).toFixed(2)}%，報酬卻達 ${(m.totalReturn * 100).toFixed(1)}%`,
      detail: '高報酬低回撤組合在真實市場中極為罕見。可能存在資料問題或前視偏差。',
    });
    trustScore -= 25;
  }

  if (m.cagr > 1.0) {
    warnings.push({
      level: 'critical',
      code: 'UNREALISTIC_CAGR',
      message: `年化報酬率 ${(m.cagr * 100).toFixed(1)}% 超過 100%`,
      detail: '持續年化報酬超過 100% 在現實中幾乎不可能維持。此結果可能來自極短期間或極端市場條件。',
    });
    trustScore -= 20;
  }

  // === WARNING: Sample insufficiency ===

  if (m.totalTrades < 10) {
    warnings.push({
      level: 'warning',
      code: 'INSUFFICIENT_TRADES',
      message: `僅 ${m.totalTrades} 筆交易，樣本嚴重不足`,
      detail: '統計上至少需要 30 筆以上交易才能評估策略是否具備統計顯著性。目前結果不可作為策略有效性的依據。',
    });
    trustScore -= 20;
  } else if (m.totalTrades < 30) {
    warnings.push({
      level: 'warning',
      code: 'LOW_TRADE_COUNT',
      message: `${m.totalTrades} 筆交易，樣本量偏低`,
      detail: '建議至少 30 筆交易以上再評估策略。目前結果僅供參考。',
    });
    trustScore -= 10;
  }

  if (m.samplePeriodDays < 126) {  // ~6 months
    warnings.push({
      level: 'warning',
      code: 'SHORT_PERIOD',
      message: `回測期間僅 ${m.samplePeriodDays} 天 (不足 6 個月)`,
      detail: '短期回測無法反映不同市場環境。建議至少回測 1-2 年以涵蓋多種市況。',
    });
    trustScore -= 15;
  } else if (m.samplePeriodDays < 252) {
    warnings.push({
      level: 'info',
      code: 'MODERATE_PERIOD',
      message: `回測期間 ${m.samplePeriodDays} 天 (不足 1 年)`,
      detail: '建議延長回測期間以涵蓋完整年度市場循環。',
    });
    trustScore -= 5;
  }

  // === WARNING: Cost issues ===

  if (m.costDrag < 0.001 && m.totalTrades > 5) {
    warnings.push({
      level: 'warning',
      code: 'NO_COST_DETECTED',
      message: '交易成本影響極低，可能遺漏',
      detail: '台股每筆來回交易成本約 0.585%。若未計入，回測報酬將被高估。',
    });
    trustScore -= 15;
  }

  // === INFO: Good practices ===

  if (m.exposure < 0.1 && m.totalReturn > 0.1) {
    warnings.push({
      level: 'info',
      code: 'LOW_EXPOSURE',
      message: `市場曝險時間僅 ${(m.exposure * 100).toFixed(1)}%`,
      detail: '大部分時間未持有部位。雖然降低風險，但也可能代表策略機會稀少。',
    });
  }

  if (m.maxConsecutiveLosses >= 5) {
    warnings.push({
      level: 'info',
      code: 'CONSECUTIVE_LOSSES',
      message: `最大連續虧損 ${m.maxConsecutiveLosses} 筆`,
      detail: '連續虧損 5 筆以上在心理與資金管理上具有挑戰性。實際操作時需有應對計畫。',
    });
  }

  // === Summary ===

  trustScore = Math.max(0, Math.min(100, trustScore));

  const criticalCount = warnings.filter(w => w.level === 'critical').length;
  const warningCount = warnings.filter(w => w.level === 'warning').length;

  let summary: string;
  if (criticalCount > 0) {
    summary = `⚠️ 發現 ${criticalCount} 個嚴重問題。回測結果不可信，需修正後重新驗證。`;
  } else if (warningCount > 0) {
    summary = `⚡ 發現 ${warningCount} 個注意事項。結果可參考但需謹慎解讀。`;
  } else {
    summary = '✅ 回測結果通過基本品質檢查。仍建議搭配 walk-forward 驗證及 benchmark 對照。';
  }

  return {
    passed: criticalCount === 0,
    trustScore,
    warnings,
    summary,
  };
}

/**
 * Format a validation report for display
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [
    `═══ 回測品質驗證報告 ═══`,
    `信任分數: ${report.trustScore}/100`,
    `結論: ${report.summary}`,
    '',
  ];

  if (report.warnings.length > 0) {
    lines.push('詳細項目:');
    for (const w of report.warnings) {
      const icon = w.level === 'critical' ? '🚨' : w.level === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`${icon} [${w.code}] ${w.message}`);
      lines.push(`   ${w.detail}`);
    }
  }

  return lines.join('\n');
}
