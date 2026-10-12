/**
 * p12_multi_date_daily_append_plan.test.ts
 * Tests for MultiDateDailyAppendPlan — P12 Online Validation
 */

import {
    buildMultiDateDailyAppendPlan,
    validateMultiDateDailyAppendPlan,
    DEFAULT_MULTI_DATE_AS_OF_DATES,
    MULTI_DATE_PLAN_VERSION,
} from '../MultiDateDailyAppendPlan';

describe('MultiDateDailyAppendPlan — P12', () => {
    it('default plan has 5 dates', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-001',
        });
        expect(plan.planVersion).toBe(MULTI_DATE_PLAN_VERSION);
        expect(plan.dates.length).toBe(5);
        expect(plan.asOfDateCount).toBe(5);
    });

    it('default plan uses the expected asOfDates', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-002',
        });
        expect(plan.dates.map(d => d.asOfDate)).toEqual([...DEFAULT_MULTI_DATE_AS_OF_DATES]);
    });

    it('each date is a TWSE trading day', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-003',
        });

        for (const dateItem of plan.dates) {
            expect(dateItem.tradingDayStatus.isKnownTradingDay).toBe(true);
            expect(dateItem.appendAllowed).toBe(true);
        }
    });

    it('uses deterministic simulationRunId per date', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-004',
        });

        for (const dateItem of plan.dates) {
            expect(dateItem.simulationRunId).toMatch(
                new RegExp(`^p12-daily-real-market-simulation-${dateItem.asOfDate.replace(/-/g, '')}-001$`),
            );
        }
    });

    it('expectedSnapshotCount is 6 per date and 30 overall', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-005',
        });

        for (const dateItem of plan.dates) {
            expect(dateItem.expectedSnapshotCount).toBe(6);
        }
        expect(plan.expectedSnapshotCount).toBe(30);
    });

    it('validationStatus is PASS for the default plan', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-006',
        });
        expect(plan.validationStatus).toBe('PASS');
        expect(validateMultiDateDailyAppendPlan(plan).validationStatus).toBe('PASS');
    });

    it('rejects duplicate dates', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-007',
            asOfDates: ['2026-05-18', '2026-05-18'],
        });

        expect(plan.validationStatus).toBe('FAIL');
        expect(plan.validationMessages.join(' ')).toMatch(/duplicate asOfDate/i);
    });

    it('rejects weekend dates', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-008',
            asOfDates: ['2026-05-16'],
        });

        expect(plan.validationStatus).toBe('FAIL');
        expect(plan.validationMessages.join(' ')).toMatch(/not a TWSE trading day/i);
    });

    it('rejects known TWSE holidays', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-009',
            asOfDates: ['2026-05-01'],
        });

        expect(plan.validationStatus).toBe('FAIL');
        expect(plan.validationMessages.join(' ')).toMatch(/not a TWSE trading day/i);
    });

    it('guardrails are all true', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-010',
        });

        expect(plan.guardrails.noProductionWrite).toBe(true);
        expect(plan.guardrails.noDbWrite).toBe(true);
        expect(plan.guardrails.noExternalApi).toBe(true);
        expect(plan.guardrails.noLlm).toBe(true);
        expect(plan.guardrails.noOptimizerWrite).toBe(true);
        expect(plan.guardrails.noAutoTrading).toBe(true);
        expect(plan.guardrails.noPerformanceClaim).toBe(true);
        expect(plan.guardrails.observabilityOnly).toBe(true);
    });

    it('forbidden claims are rejected', () => {
        const plan = buildMultiDateDailyAppendPlan({
            planRunId: 'p12-test-plan-011',
        });
        const mutated = {
            ...plan,
            validationMessages: ['profit', 'outperform'],
        };

        const result = validateMultiDateDailyAppendPlan(mutated as typeof plan);
        expect(result.validationStatus).toBe('FAIL');
    });
});

