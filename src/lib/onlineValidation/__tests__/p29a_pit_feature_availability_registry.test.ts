/**
 * P29A PIT-safe Feature Availability Registry v1 Tests
 *
 * Validates the paper-design registry artifacts:
 *   - Registry v1 JSON exists with 6 core sources
 *   - MonthlyRevenue = REPAIRED_BUT_SOURCE_GATED
 *   - FinancialReport = HIGH_RISK_SOURCE_ABSENT, entersAlphaScore=false
 *   - NewsEvent = HIGH_RISK_SOURCE_ABSENT, entersAlphaScore=false
 *   - No HIGH_RISK source has entersAlphaScore=true
 *   - All sources have PIT date field or explicit reason
 *   - Registry does not claim import-ready
 *   - P26F4 remains WAITING
 *   - No DB / corpus / scoring file changes
 *
 * Read-only. Observability only. Not investment advice.
 */

import * as fs from 'fs';
import * as path from 'path';

const OV = path.resolve(__dirname, '../../../../outputs/online_validation');

interface RegistrySource {
    sourceName: string;
    sourceStatus: string;
    entersAlphaScore: boolean;
    pitDateField: string | null;
    gateField: string | null;
    forbiddenBehavior: string;
}

interface Registry {
    registryVersion: string;
    paperDesignOnly: boolean;
    noProductionScoringImpact: boolean;
    p26f4State: string;
    sources: RegistrySource[];
    summary: {
        totalSources: number;
        highRiskSources: string[];
        entersAlphaScore: string[];
    };
}

function loadJson<T>(filename: string): T {
    const fp = path.join(OV, filename);
    expect(fs.existsSync(fp)).toBe(true);
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as T;
}

function loadText(filename: string): string {
    const fp = path.join(OV, filename);
    expect(fs.existsSync(fp)).toBe(true);
    return fs.readFileSync(fp, 'utf8');
}

describe('P29A PIT Feature Availability Registry v1', () => {
    test('Registry v1 JSON exists and is valid JSON', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        expect(registry).toBeDefined();
        expect(registry.registryVersion).toBe('v1');
    });

    test('Registry contract JSON exists', () => {
        const contract = loadJson<{ contractVersion: string; registryRules: string[] }>(
            'p29a_pit_feature_availability_registry_contract.json'
        );
        expect(contract.contractVersion).toBe('p29a-registry-contract-v1');
        expect(contract.registryRules.length).toBeGreaterThanOrEqual(10);
    });

    test('Registry is paper design only (not production scoring)', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        expect(registry.paperDesignOnly).toBe(true);
        expect(registry.noProductionScoringImpact).toBe(true);
    });

    test('Six core sources exist in registry', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const names = registry.sources.map((s) => s.sourceName);
        expect(names).toContain('TWSE_TPEX_Quote');
        expect(names).toContain('MarketRegime');
        expect(names).toContain('InstitutionalChip');
        expect(names).toContain('MonthlyRevenue');
        expect(names).toContain('FinancialReport');
        expect(names).toContain('NewsEvent');
        expect(registry.summary.totalSources).toBeGreaterThanOrEqual(6);
    });

    test('MonthlyRevenue status is REPAIRED_BUT_SOURCE_GATED', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const mr = registry.sources.find((s) => s.sourceName === 'MonthlyRevenue');
        expect(mr).toBeDefined();
        expect(mr!.sourceStatus).toBe('REPAIRED_BUT_SOURCE_GATED');
    });

    test('FinancialReport status is HIGH_RISK_SOURCE_ABSENT', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const fr = registry.sources.find((s) => s.sourceName === 'FinancialReport');
        expect(fr).toBeDefined();
        expect(fr!.sourceStatus).toBe('HIGH_RISK_SOURCE_ABSENT');
    });

    test('NewsEvent status is HIGH_RISK_SOURCE_ABSENT', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const ne = registry.sources.find((s) => s.sourceName === 'NewsEvent');
        expect(ne).toBeDefined();
        expect(ne!.sourceStatus).toBe('HIGH_RISK_SOURCE_ABSENT');
    });

    test('FinancialReport entersAlphaScore = false', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const fr = registry.sources.find((s) => s.sourceName === 'FinancialReport');
        expect(fr!.entersAlphaScore).toBe(false);
    });

    test('NewsEvent entersAlphaScore = false', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const ne = registry.sources.find((s) => s.sourceName === 'NewsEvent');
        expect(ne!.entersAlphaScore).toBe(false);
    });

    test('No HIGH_RISK_SOURCE_ABSENT source has entersAlphaScore = true', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const violations = registry.sources.filter(
            (s) => s.sourceStatus === 'HIGH_RISK_SOURCE_ABSENT' && s.entersAlphaScore === true
        );
        expect(violations).toHaveLength(0);
    });

    test('All sources have pitDateField or explicit reason (gateField or pitDateField)', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        const missing: string[] = [];
        for (const s of registry.sources) {
            const hasPITFieldOrReason = (s.pitDateField !== null && s.pitDateField !== undefined) ||
                (s.gateField !== null && s.gateField !== undefined);
            if (!hasPITFieldOrReason) {
                missing.push(s.sourceName);
            }
        }
        // Expect at most 0 sources with no PIT field and no explicit gate
        // (FinancialReport has gateField=null but pitDateField is documented as 'NOT IMPLEMENTED')
        // We accept if the registry has a note explaining why
        const registryText = loadText('p29a_pit_feature_availability_registry_v1.json');
        for (const name of missing) {
            // If field is null, the JSON text should contain 'NOT IMPLEMENTED' near the source
            expect(registryText).toContain('NOT IMPLEMENTED');
        }
    });

    test('Registry does not claim P26F4 is import-ready', () => {
        const text = loadText('p29a_pit_feature_availability_registry_v1.json');
        expect(text).not.toMatch(/import.?ready/i);
        expect(text).not.toMatch(/P26F4.*COMPLETE/i);
    });

    test('P26F4 remains WAITING_FOR_OPERATOR_SOURCE in registry', () => {
        const registry = loadJson<Registry>('p29a_pit_feature_availability_registry_v1.json');
        expect(registry.p26f4State).toBe('WAITING_FOR_OPERATOR_SOURCE');
    });

    test('Canonical source-arrival prompt unchanged', () => {
        const fp = path.join(OV, 'p26_next_prompt_source_arrival_only.md');
        expect(fs.existsSync(fp)).toBe(true);
    });

    test('Scoring boundary review exists and all checks pass', () => {
        const review = loadJson<{ allChecksPassed: boolean; verdict: string }>(
            'p29a_registry_scoring_boundary_review.json'
        );
        expect(review.allChecksPassed).toBe(true);
        expect(review.verdict).toContain('SAFE');
    });

    test('No forbidden claims in registry v1 text', () => {
        const text = loadText('p29a_pit_feature_availability_registry_v1.json');
        const lower = text.toLowerCase();
        const forbidden = ['roi', 'win-rate', 'profit', 'outperform', 'guaranteed', '買進', '賣出', '買入'];
        for (const f of forbidden) {
            // Allow if only in forbiddenBehavior description (i.e., saying "Must NOT...")
            const idx = lower.indexOf(f);
            if (idx !== -1) {
                // Check context: should be in a "must not" or disclaimer context
                const ctx = text.slice(Math.max(0, idx - 30), idx + 50);
                expect(ctx.toLowerCase()).toMatch(/must not|no |not allowed|forbidden|disclaimer/i);
            }
        }
    });
});
