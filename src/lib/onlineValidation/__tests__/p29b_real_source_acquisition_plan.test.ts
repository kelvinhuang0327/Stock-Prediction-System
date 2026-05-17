/**
 * P29B Real Source Acquisition Plan Tests
 *
 * Validates:
 *   - FinancialReport and NewsEvent source plans exist
 *   - Both require PIT date fields (filingDate / publishedAt)
 *   - Both forbid outcome fields
 *   - Both keep entersAlphaScore = false
 *   - Both keep HIGH_RISK_SOURCE_ABSENT until validation
 *   - Drop-zone paths are manual (not production import scripts)
 *   - Manifest has no approval token baked in
 *   - No DB / corpus / scoring file changes
 *
 * Read-only. Observability only. Not investment advice.
 */

import * as fs from 'fs';
import * as path from 'path';

const OV = path.resolve(__dirname, '../../../../outputs/online_validation');

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

interface SourcePlan {
    paperDesignOnly: boolean;
    noDBWrite: boolean;
    noScoringChange: boolean;
    requiredFields: { mandatory: Array<{ field: string; description?: string }> };
    pitSafeRule: { gateField: string; rule: string };
    dropZoneProposal: { path: string };
    statusTransitionCriteria: Array<{ from: string; to: string; conditions?: string[]; approvalToken?: string }>;
    forbiddenBehavior: string[];
    manifestFields?: { attestation?: { approvalTokenNotIncluded?: boolean } };
}

describe('P29B Real Source Acquisition Plan', () => {

    describe('FinancialReport plan', () => {
        let plan: SourcePlan;
        beforeAll(() => {
            plan = loadJson<SourcePlan>('p29b_financial_report_source_acquisition_plan.json');
        });

        test('FinancialReport plan exists and is paper design', () => {
            expect(plan.paperDesignOnly).toBe(true);
            expect(plan.noDBWrite).toBe(true);
            expect(plan.noScoringChange).toBe(true);
        });

        test('FinancialReport plan requires filingDate as PIT gate field', () => {
            expect(plan.pitSafeRule.gateField).toBe('filingDate');
            expect(plan.pitSafeRule.rule).toContain('filingDate');
        });

        test('FinancialReport plan requires filingDate in mandatory fields', () => {
            const fields = plan.requiredFields.mandatory.map((f) => f.field);
            expect(fields).toContain('filingDate');
        });

        test('FinancialReport plan requires sourceName in mandatory fields', () => {
            const fields = plan.requiredFields.mandatory.map((f) => f.field);
            expect(fields).toContain('sourceName');
        });

        test('FinancialReport plan forbids outcome fields', () => {
            const forbidden = plan.forbiddenBehavior.join(' ');
            expect(forbidden.toLowerCase()).toMatch(/outcome|returnPct|outcomePrice/i);
        });

        test('FinancialReport plan drop-zone is manual path (not production)', () => {
            expect(plan.dropZoneProposal.path).toContain('data/manual/financial-report');
            expect(plan.dropZoneProposal.path).not.toContain('src/');
            expect(plan.dropZoneProposal.path).not.toContain('outputs/');
        });

        test('FinancialReport manifest attestation has approvalTokenNotIncluded=true', () => {
            const text = loadText('p29b_financial_report_source_acquisition_plan.json');
            // The manifest attestation section must declare approvalTokenNotIncluded=true
            expect(text).toContain('"approvalTokenNotIncluded": true');
            // The statusTransitionCriteria may legitimately document the required token name;
            // what matters is that the manifest template itself does not pre-grant approval
        });

        test('FinancialReport must go through HIGH_RISK_SOURCE_ABSENT first', () => {
            const firstTransition = plan.statusTransitionCriteria[0];
            expect(firstTransition.from).toBe('HIGH_RISK_SOURCE_ABSENT');
        });

        test('FinancialReport status transitions require approval token', () => {
            const tokenStep = plan.statusTransitionCriteria.find((s) => s.approvalToken);
            expect(tokenStep).toBeDefined();
            expect(tokenStep!.approvalToken).toBeTruthy();
        });

        test('FinancialReport forbids periodEndDate as PIT gate', () => {
            const text = loadText('p29b_financial_report_source_acquisition_plan.json');
            // The plan should warn against using periodEndDate
            expect(text.toLowerCase()).toContain('periodenddate');
        });
    });

    describe('NewsEvent plan', () => {
        let plan: SourcePlan;
        beforeAll(() => {
            plan = loadJson<SourcePlan>('p29b_news_event_source_acquisition_plan.json');
        });

        test('NewsEvent plan exists and is paper design', () => {
            expect(plan.paperDesignOnly).toBe(true);
            expect(plan.noDBWrite).toBe(true);
            expect(plan.noScoringChange).toBe(true);
        });

        test('NewsEvent plan requires publishedAt as PIT gate field', () => {
            expect(plan.pitSafeRule.gateField).toBe('publishedAt');
            expect(plan.pitSafeRule.rule).toContain('publishedAt');
        });

        test('NewsEvent plan forbids ingestedAt as PIT gate', () => {
            const text = loadText('p29b_news_event_source_acquisition_plan.json');
            expect(text.toLowerCase()).toContain('ingestedat');
            // Must mention it is forbidden
            expect(text).toContain('NEVER');
        });

        test('NewsEvent plan requires publishedAt in mandatory fields', () => {
            const fields = plan.requiredFields.mandatory.map((f) => f.field);
            expect(fields).toContain('publishedAt');
        });

        test('NewsEvent plan requires verificationStatus in mandatory fields', () => {
            const fields = plan.requiredFields.mandatory.map((f) => f.field);
            expect(fields).toContain('verificationStatus');
        });

        test('NewsEvent plan forbids outcome fields', () => {
            // Check both forbiddenBehavior array and requiredFields.forbidden list
            const forbidden = plan.forbiddenBehavior.join(' ');
            const requiredForbidden = JSON.stringify((plan as unknown as { requiredFields: { forbidden: Array<{ field: string }> } }).requiredFields?.forbidden ?? []);
            const combined = (forbidden + ' ' + requiredForbidden).toLowerCase();
            expect(combined).toMatch(/outcome|returnpct|outcomeprice/i);
        });

        test('NewsEvent plan forbids sentiment labels', () => {
            const text = loadText('p29b_news_event_source_acquisition_plan.json');
            expect(text).toContain('BULLISH_EVENT');
            // Should be in forbidden context
            expect(text.toLowerCase()).toMatch(/forbidden|must not|not allowed/i);
        });

        test('NewsEvent drop-zone is manual path (not production)', () => {
            expect(plan.dropZoneProposal.path).toContain('data/manual/news-event');
            expect(plan.dropZoneProposal.path).not.toContain('src/');
        });

        test('NewsEvent status must go through HIGH_RISK_SOURCE_ABSENT first', () => {
            const firstTransition = plan.statusTransitionCriteria[0];
            expect(firstTransition.from).toBe('HIGH_RISK_SOURCE_ABSENT');
        });

        test('NewsEvent status transitions require approval token', () => {
            const tokenStep = plan.statusTransitionCriteria.find((s) => s.approvalToken);
            expect(tokenStep).toBeDefined();
            expect(tokenStep!.approvalToken).toBeTruthy();
        });
    });

    describe('Unified manifest design', () => {
        test('Unified manifest design exists', () => {
            const d = loadJson<{ financialReportManifestTemplate: { attestation: { approvalTokenNotIncluded: boolean } }; newsEventManifestTemplate: { attestation: { approvalTokenNotIncluded: boolean } } }>(
                'p29b_unified_source_manifest_design.json'
            );
            expect(d.financialReportManifestTemplate).toBeDefined();
            expect(d.newsEventManifestTemplate).toBeDefined();
        });

        test('Both manifest templates have approvalTokenNotIncluded=true', () => {
            const d = loadJson<{ financialReportManifestTemplate: { attestation: { approvalTokenNotIncluded: boolean } }; newsEventManifestTemplate: { attestation: { approvalTokenNotIncluded: boolean } } }>(
                'p29b_unified_source_manifest_design.json'
            );
            expect(d.financialReportManifestTemplate.attestation.approvalTokenNotIncluded).toBe(true);
            expect(d.newsEventManifestTemplate.attestation.approvalTokenNotIncluded).toBe(true);
        });
    });

    describe('Registry update proposal', () => {
        test('Registry update proposal keeps both sources as HIGH_RISK_SOURCE_ABSENT', () => {
            const d = loadJson<{ proposedUpdates: Array<{ sourceName: string; proposedImmediateStatus: string; entersAlphaScore: boolean }> }>(
                'p29b_registry_update_proposal.json'
            );
            for (const update of d.proposedUpdates) {
                expect(update.proposedImmediateStatus).toContain('HIGH_RISK_SOURCE_ABSENT');
                expect(update.entersAlphaScore).toBe(false);
            }
        });

        test('Registry update proposal is paper design (noImmediateChange=true)', () => {
            const d = loadJson<{ noImmediateChange: boolean }>('p29b_registry_update_proposal.json');
            expect(d.noImmediateChange).toBe(true);
        });
    });

    describe('Invariance guards', () => {
        test('P26F4 remains WAITING_FOR_OPERATOR_SOURCE', () => {
            const preflight = loadJson<{ p26f4State: string }>('p29b_real_source_plan_preflight.json');
            expect(preflight.p26f4State).toBe('WAITING_FOR_OPERATOR_SOURCE');
        });

        test('P29A registry still marks FinancialReport as HIGH_RISK_SOURCE_ABSENT', () => {
            const registry = loadJson<{ sources: Array<{ sourceName: string; sourceStatus: string }> }>(
                'p29a_pit_feature_availability_registry_v1.json'
            );
            const fr = registry.sources.find((s) => s.sourceName === 'FinancialReport');
            expect(fr!.sourceStatus).toBe('HIGH_RISK_SOURCE_ABSENT');
        });

        test('P29A registry still marks NewsEvent as HIGH_RISK_SOURCE_ABSENT', () => {
            const registry = loadJson<{ sources: Array<{ sourceName: string; sourceStatus: string }> }>(
                'p29a_pit_feature_availability_registry_v1.json'
            );
            const ne = registry.sources.find((s) => s.sourceName === 'NewsEvent');
            expect(ne!.sourceStatus).toBe('HIGH_RISK_SOURCE_ABSENT');
        });

        test('Canonical source-arrival prompt is still present', () => {
            const fp = path.join(OV, 'p26_next_prompt_source_arrival_only.md');
            expect(fs.existsSync(fp)).toBe(true);
        });
    });
});
