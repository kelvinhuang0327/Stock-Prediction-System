/**
 * Chip Anomaly Scanner
 * 籌碼異常偵測掃描器
 * 
 * 功能：
 * 1. 偵測籌碼集中度異常上升
 * 2. 識別冷門分點突然大買
 * 3. 追蹤主力建倉軌跡
 */

import type { InstitutionalChip } from '@prisma/client';

export interface ChipAnomalySignal {
    stockId: string;
    date: string;
    anomalyType: 'CONCENTRATION_SURGE' | 'COLD_BROKER_BUY' | 'TRUST_ACCUMULATION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    score: number;  // 0-100
    reasoning: string;
    details: {
        concentrationChange?: number;  // 集中度變化 %
        brokerName?: string;
        buyAmount?: number;
        daysAccumulating?: number;
    };
}

export class ChipAnomalyScanner {

    /**
     * 偵測籌碼集中度異常上升
     * 
     * 策略：計算過去 5/10/20 天集中度的斜率與加速度
     */
    detectConcentrationSurge(
        chipHistory: InstitutionalChip[],
        windowDays: number = 20
    ): ChipAnomalySignal | null {

        if (chipHistory.length < windowDays) {
            return null;
        }

        // 計算集中度趨勢
        const recent = chipHistory.slice(-windowDays);
        const concentrations = recent.map(chip =>
            Math.abs(chip.foreignBuy) + Math.abs(chip.trustBuy) + Math.abs(chip.dealerBuy)
        );

        // 計算斜率 (簡化版：最後 5 天平均 vs 前 15 天平均)
        const recentAvg = concentrations.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const previousAvg = concentrations.slice(0, 15).reduce((a, b) => a + b, 0) / 15;

        const changePercent = previousAvg > 0
            ? ((recentAvg - previousAvg) / previousAvg) * 100
            : 0;

        // 異常標準：變化超過 100% (翻倍)
        if (changePercent > 100) {
            return {
                stockId: chipHistory[0].stockId,
                date: chipHistory[chipHistory.length - 1].date,
                anomalyType: 'CONCENTRATION_SURGE',
                severity: changePercent > 200 ? 'HIGH' : 'MEDIUM',
                score: Math.min(100, changePercent),
                reasoning: `籌碼急速集中：最近 5 天法人買賣力道較前 15 天增加 ${changePercent.toFixed(1)}%`,
                details: {
                    concentrationChange: changePercent
                }
            };
        }

        return null;
    }

    /**
     * 偵測投信連續買超
     * 
     * 策略：投信連續 N 天買超視為「認養」訊號
     */
    detectTrustAccumulation(
        chipHistory: InstitutionalChip[],
        minDays: number = 3
    ): ChipAnomalySignal | null {

        if (chipHistory.length < minDays) {
            return null;
        }

        // 檢查最近 N 天投信買超
        const recent = chipHistory.slice(-minDays);
        const consecutiveBuying = recent.every(chip => chip.trustBuy > 0);

        if (!consecutiveBuying) {
            return null;
        }

        // 計算總買超量
        const totalBuy = recent.reduce((sum, chip) => sum + chip.trustBuy, 0);

        // 檢查持續天數
        let accumulatingDays = minDays;
        for (let i = chipHistory.length - minDays - 1; i >= 0; i--) {
            if (chipHistory[i].trustBuy > 0) {
                accumulatingDays++;
            } else {
                break;
            }
        }

        return {
            stockId: chipHistory[0].stockId,
            date: chipHistory[chipHistory.length - 1].date,
            anomalyType: 'TRUST_ACCUMULATION',
            severity: accumulatingDays >= 5 ? 'HIGH' : 'MEDIUM',
            score: Math.min(100, accumulatingDays * 15),
            reasoning: `投信連續 ${accumulatingDays} 天買超，總計 ${totalBuy.toLocaleString()} 張`,
            details: {
                daysAccumulating: accumulatingDays,
                buyAmount: totalBuy
            }
        };
    }

    /**
     * 綜合掃描
     * 
     * 對單支股票執行所有異常偵測
     */
    async scanStock(
        stockId: string,
        chipHistory: InstitutionalChip[]
    ): Promise<ChipAnomalySignal[]> {

        const signals: ChipAnomalySignal[] = [];

        // 1. 集中度異常
        const concentrationSignal = this.detectConcentrationSurge(chipHistory);
        if (concentrationSignal) {
            signals.push(concentrationSignal);
        }

        // 2. 投信認養
        const trustSignal = this.detectTrustAccumulation(chipHistory);
        if (trustSignal) {
            signals.push(trustSignal);
        }

        return signals;
    }

    /**
     * 計算籌碼異常分數
     * 
     * 整合所有訊號得出 0-100 分
     */
    calculateAnomalyScore(signals: ChipAnomalySignal[]): number {
        if (signals.length === 0) {
            return 0;
        }

        // 加權平均
        const weights = {
            'CONCENTRATION_SURGE': 1.5,
            'COLD_BROKER_BUY': 1.2,
            'TRUST_ACCUMULATION': 1.0
        };

        let totalScore = 0;
        let totalWeight = 0;

        for (const signal of signals) {
            const weight = weights[signal.anomalyType] || 1.0;
            totalScore += signal.score * weight;
            totalWeight += weight;
        }

        return Math.min(100, totalScore / totalWeight);
    }
}

export const chipAnomalyScanner = new ChipAnomalyScanner();
