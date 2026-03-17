/**
 * Unit Tests for Chip Anomaly Scanner
 */

import { ChipAnomalyScanner } from '../ChipAnomalyScanner';
import type { InstitutionalChip } from '@prisma/client';

describe('ChipAnomalyScanner', () => {
    let scanner: ChipAnomalyScanner;

    beforeEach(() => {
        scanner = new ChipAnomalyScanner();
    });

    describe('detectConcentrationSurge', () => {
        it('should detect concentration surge when buying increases 100%+', () => {
            const chipHistory: InstitutionalChip[] = [];

            // 前 15 天：平均買超 100 張
            for (let i = 0; i < 15; i++) {
                chipHistory.push({
                    id: i,
                    stockId: '2330',
                    date: `2026011${String(i).padStart(2, '0')}`,
                    foreignBuy: 50,
                    trustBuy: 30,
                    dealerBuy: 20,
                    totalBuy: 100,
                    holders400: null,
                    holders1000: null,
                    createdAt: new Date()
                });
            }

            // 最近 5 天：平均買超 300 張 (增加 200%)
            for (let i = 15; i < 20; i++) {
                chipHistory.push({
                    id: i,
                    stockId: '2330',
                    date: `2026011${String(i).padStart(2, '0')}`,
                    foreignBuy: 150,
                    trustBuy: 90,
                    dealerBuy: 60,
                    totalBuy: 300,
                    holders400: null,
                    holders1000: null,
                    createdAt: new Date()
                });
            }

            const result = scanner.detectConcentrationSurge(chipHistory);

            expect(result).not.toBeNull();
            expect(result?.anomalyType).toBe('CONCENTRATION_SURGE');
            expect(result?.severity).toBe('MEDIUM');  // 200% increase = MEDIUM (HIGH requires >200%)
            expect(result?.details.concentrationChange).toBeGreaterThan(100);
        });

        it('should return null when no surge detected', () => {
            const chipHistory: InstitutionalChip[] = [];

            // 穩定買超 100 張
            for (let i = 0; i < 20; i++) {
                chipHistory.push({
                    id: i,
                    stockId: '2330',
                    date: `2026011${String(i).padStart(2, '0')}`,
                    foreignBuy: 50,
                    trustBuy: 30,
                    dealerBuy: 20,
                    totalBuy: 100,
                    holders400: null,
                    holders1000: null,
                    createdAt: new Date()
                });
            }

            const result = scanner.detectConcentrationSurge(chipHistory);

            expect(result).toBeNull();
        });
    });

    describe('detectTrustAccumulation', () => {
        it('should detect trust accumulation when buying 3+ consecutive days', () => {
            const chipHistory: InstitutionalChip[] = [];

            // 投信連續 5 天買超
            for (let i = 0; i < 5; i++) {
                chipHistory.push({
                    id: i,
                    stockId: '3661',
                    date: `2026011${String(i + 10).padStart(2, '0')}`,
                    foreignBuy: 0,
                    trustBuy: 100 + i * 10,  // 遞增買超
                    dealerBuy: 0,
                    totalBuy: 100 + i * 10,
                    holders400: null,
                    holders1000: null,
                    createdAt: new Date()
                });
            }

            const result = scanner.detectTrustAccumulation(chipHistory, 3);

            expect(result).not.toBeNull();
            expect(result?.anomalyType).toBe('TRUST_ACCUMULATION');
            expect(result?.severity).toBe('HIGH');  // 5 days >= 5
            expect(result?.details.daysAccumulating).toBe(5);
        });

        it('should return null when trust sells', () => {
            const chipHistory: InstitutionalChip[] = [];

            // 投信賣超
            for (let i = 0; i < 3; i++) {
                chipHistory.push({
                    id: i,
                    stockId: '2330',
                    date: `20260110`,
                    foreignBuy: 0,
                    trustBuy: -50,  // 賣超
                    dealerBuy: 0,
                    totalBuy: -50,
                    holders400: null,
                    holders1000: null,
                    createdAt: new Date()
                });
            }

            const result = scanner.detectTrustAccumulation(chipHistory);

            expect(result).toBeNull();
        });
    });

    describe('calculateAnomalyScore', () => {
        it('should calculate weighted average of multiple signals', () => {
            const signals = [
                {
                    stockId: '2330',
                    date: '20260115',
                    anomalyType: 'CONCENTRATION_SURGE' as const,
                    severity: 'HIGH' as const,
                    score: 80,
                    reasoning: 'Test',
                    details: {}
                },
                {
                    stockId: '2330',
                    date: '20260115',
                    anomalyType: 'TRUST_ACCUMULATION' as const,
                    severity: 'MEDIUM' as const,
                    score: 60,
                    reasoning: 'Test',
                    details: {}
                }
            ];

            const score = scanner.calculateAnomalyScore(signals);

            // CONCENTRATION_SURGE weight: 1.5, TRUST_ACCUMULATION weight: 1.0
            // (80 * 1.5 + 60 * 1.0) / (1.5 + 1.0) = 180 / 2.5 = 72
            expect(score).toBeCloseTo(72, 0);
        });

        it('should return 0 for empty signals', () => {
            const score = scanner.calculateAnomalyScore([]);
            expect(score).toBe(0);
        });
    });
});
