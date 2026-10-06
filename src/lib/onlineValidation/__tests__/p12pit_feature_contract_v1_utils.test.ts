/**
 * p12pit_feature_contract_v1_utils.test.ts
 * P26A-HARDRESET PART I — Tests for P12FeatureContractV1Utils
 */

import {
    buildP12ContractV1,
    buildContractV1Summary,
    validateContractV1,
    getMonthlyRevenueV1Status,
    getHighRiskSourceNames,
    type P12ContractV1,
} from '../P12FeatureContractV1Utils';

// ─── Contract invariants ──────────────────────────────────────────────────────

describe('buildP12ContractV1', () => {
    let contract: P12ContractV1;

    beforeEach(() => {
        contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
    });

    it('returns contractVersion v1', () => {
        expect(contract.contractVersion).toBe('p12-pit-feature-contract-v1');
    });

    it('supersedes v0', () => {
        expect(contract.supersedes).toBe('p12-pit-feature-contract-v0');
    });

    it('has 6 feature sources', () => {
        expect(contract.featureSources).toHaveLength(6);
    });

    it('MonthlyRevenue status is REPAIRED_2026_05_12', () => {
        const status = getMonthlyRevenueV1Status(contract);
        expect(status).toBe('REPAIRED_2026_05_12');
    });

    it('FinancialReport is still STILL_HIGH_RISK_NOT_PIT_GATED', () => {
        const fr = contract.featureSources.find(s => s.sourceName === 'FinancialReport');
        expect(fr?.pitStatus).toBe('STILL_HIGH_RISK_NOT_PIT_GATED');
    });

    it('NewsEvent is still STILL_HIGH_RISK_NOT_PIT_GATED', () => {
        const ne = contract.featureSources.find(s => s.sourceName === 'NewsEvent');
        expect(ne?.pitStatus).toBe('STILL_HIGH_RISK_NOT_PIT_GATED');
    });

    it('StockQuote is ALREADY_PIT_GATED', () => {
        const sq = contract.featureSources.find(s => s.sourceName === 'StockQuote');
        expect(sq?.pitStatus).toBe('ALREADY_PIT_GATED');
    });

    it('InstitutionalChip is ALREADY_PIT_GATED', () => {
        const ic = contract.featureSources.find(s => s.sourceName === 'InstitutionalChip');
        expect(ic?.pitStatus).toBe('ALREADY_PIT_GATED');
    });

    it('MarketRegime is ALREADY_PIT_GATED', () => {
        const mr = contract.featureSources.find(s => s.sourceName === 'MarketRegime');
        expect(mr?.pitStatus).toBe('ALREADY_PIT_GATED');
    });

    it('does not contain outcome fields in any activeSnapshotFields', () => {
        const forbidden = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
        for (const src of contract.featureSources) {
            for (const field of src.activeSnapshotFields) {
                for (const f of forbidden) {
                    expect(field).not.toContain(f);
                }
            }
        }
    });

    it('FinancialReport does not enter alphaScore', () => {
        const fr = contract.featureSources.find(s => s.sourceName === 'FinancialReport');
        expect(fr?.entersAlphaScore).toBe(false);
    });

    it('NewsEvent does not enter alphaScore', () => {
        const ne = contract.featureSources.find(s => s.sourceName === 'NewsEvent');
        expect(ne?.entersAlphaScore).toBe(false);
    });

    it('MonthlyRevenue enters alphaScore', () => {
        const mr = contract.featureSources.find(s => s.sourceName === 'MonthlyRevenue');
        expect(mr?.entersAlphaScore).toBe(true);
    });

    it('StockQuote enters alphaScore', () => {
        const sq = contract.featureSources.find(s => s.sourceName === 'StockQuote');
        expect(sq?.entersAlphaScore).toBe(true);
    });

    it('MonthlyRevenue references repair evidence (P17/P24/P25)', () => {
        const mr = contract.featureSources.find(s => s.sourceName === 'MonthlyRevenue');
        expect(mr?.repairReferences).toContain('P17-HARDRESET');
        expect(mr?.repairReferences).toContain('P24-HARDRESET');
        expect(mr?.repairReferences).toContain('P25-HARDRESET');
    });

    it('MonthlyRevenue supersededV0Notes is populated', () => {
        const mr = contract.featureSources.find(s => s.sourceName === 'MonthlyRevenue');
        expect(mr?.supersededV0Notes).toBeTruthy();
        expect(mr?.supersededV0Notes).toContain('superseded');
    });

    it('knownStaleness describes v0 MonthlyRevenue supersession', () => {
        const hasStaleNote = contract.knownStaleness.some(n => n.toLowerCase().includes('monthly'));
        expect(hasStaleNote).toBe(true);
    });

    it('nonGoals does not promise FinancialReport activation', () => {
        const mentionsTimeline = contract.nonGoals.some(g =>
            g.toLowerCase().includes('financialreport') && g.toLowerCase().includes('timeline'),
        );
        expect(mentionsTimeline).toBe(false);
        // Check it doesn't promise activation either
        const hasFinancialReportNonGoal = contract.nonGoals.some(g =>
            g.toLowerCase().includes('financialreport') || g.toLowerCase().includes('financial'),
        );
        expect(hasFinancialReportNonGoal).toBe(true);
    });

    it('verdict is CONTRACT_V1_COMPLETE', () => {
        expect(contract.verdict).toBe('CONTRACT_V1_COMPLETE');
    });

    it('is deterministic: same generatedAt → same output', () => {
        const c1 = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        const c2 = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        expect(JSON.stringify(c1)).toBe(JSON.stringify(c2));
    });
});

// ─── buildContractV1Summary ───────────────────────────────────────────────────

describe('buildContractV1Summary', () => {
    let contract: P12ContractV1;
    beforeEach(() => { contract = buildP12ContractV1('2026-05-13T00:00:00.000Z'); });

    it('returns correct total source count', () => {
        const summary = buildContractV1Summary(contract);
        expect(summary.totalSources).toBe(6);
    });

    it('lists 2 high risk sources', () => {
        const summary = buildContractV1Summary(contract);
        expect(summary.highRiskRemaining).toHaveLength(2);
        expect(summary.highRiskRemaining).toContain('FinancialReport');
        expect(summary.highRiskRemaining).toContain('NewsEvent');
    });

    it('lists MonthlyRevenue as repaired', () => {
        const summary = buildContractV1Summary(contract);
        expect(summary.repairedSources).toContain('MonthlyRevenue');
    });

    it('lists StockQuote, InstitutionalChip, MarketRegime, MonthlyRevenue as entering alphaScore', () => {
        const summary = buildContractV1Summary(contract);
        expect(summary.sourcesEnteringAlphaScore).toContain('StockQuote');
        expect(summary.sourcesEnteringAlphaScore).toContain('InstitutionalChip');
        expect(summary.sourcesEnteringAlphaScore).toContain('MarketRegime');
        expect(summary.sourcesEnteringAlphaScore).toContain('MonthlyRevenue');
    });

    it('has at least 3 ALREADY_PIT_GATED sources', () => {
        const summary = buildContractV1Summary(contract);
        expect(summary.byPitStatus.ALREADY_PIT_GATED).toBeGreaterThanOrEqual(3);
    });

    it('has exactly 1 REPAIRED source', () => {
        const summary = buildContractV1Summary(contract);
        expect(summary.byPitStatus.REPAIRED_2026_05_12).toBe(1);
    });
});

// ─── validateContractV1 ────────────────────────────────────────────────────────

describe('validateContractV1', () => {
    it('passes validation for a valid contract', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        const result = validateContractV1(contract);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('fails if contractVersion is not v1', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        // @ts-expect-error intentional wrong version for test
        contract.contractVersion = 'p12-pit-feature-contract-v0';
        const result = validateContractV1(contract);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('contractVersion'))).toBe(true);
    });

    it('fails if MonthlyRevenue is not found', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        contract.featureSources = contract.featureSources.filter(s => s.sourceName !== 'MonthlyRevenue');
        const result = validateContractV1(contract);
        expect(result.valid).toBe(false);
    });

    it('fails if MonthlyRevenue status is not REPAIRED', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        const mr = contract.featureSources.find(s => s.sourceName === 'MonthlyRevenue')!;
        // @ts-expect-error intentional wrong status for test
        mr.pitStatus = 'ALREADY_PIT_GATED';
        const result = validateContractV1(contract);
        expect(result.valid).toBe(false);
    });

    it('warns if FinancialReport is not HIGH_RISK', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        const fr = contract.featureSources.find(s => s.sourceName === 'FinancialReport')!;
        // @ts-expect-error intentional wrong status for test
        fr.pitStatus = 'ALREADY_PIT_GATED';
        const result = validateContractV1(contract);
        expect(result.warnings.some(w => w.includes('FinancialReport'))).toBe(true);
    });

    it('fails if outcome field appears in activeSnapshotFields', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        contract.featureSources[0].activeSnapshotFields.push('returnPct');
        const result = validateContractV1(contract);
        expect(result.valid).toBe(false);
    });
});

// ─── getHighRiskSourceNames ───────────────────────────────────────────────────

describe('getHighRiskSourceNames', () => {
    it('returns FinancialReport and NewsEvent', () => {
        const contract = buildP12ContractV1('2026-05-13T00:00:00.000Z');
        const names = getHighRiskSourceNames(contract);
        expect(names).toContain('FinancialReport');
        expect(names).toContain('NewsEvent');
        expect(names).not.toContain('MonthlyRevenue');
        expect(names).not.toContain('StockQuote');
    });
});
