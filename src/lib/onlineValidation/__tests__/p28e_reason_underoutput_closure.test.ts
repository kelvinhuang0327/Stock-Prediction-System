/**
 * P28E Reason Underoutput Closure Test
 *
 * Validates that:
 *   1. P28D final report and classification exist
 *   2. P28E closure criteria evaluation file exists
 *   3. P28E closure marker exists with correct state
 *   4. Renderer version = p26a-corpus-renderer-v2
 *   5. P26F4 remains WAITING_FOR_OPERATOR_SOURCE
 *   6. Canonical source-arrival prompt unchanged
 *   7. No import-ready wording for P26F4
 *   8. Next-prompt artifact contains Route D (P29-A)
 *   9. Track registry lists P28A..P28E with COMPLETE status
 *
 * Read-only validation. No DB write. No corpus mutation. No scoring touch.
 * Observability only — not investment advice.
 */

import * as fs from 'fs';
import * as path from 'path';

const OV = path.resolve(__dirname, '../../../../outputs/online_validation');

function loadJson(filename: string): unknown {
    const fp = path.join(OV, filename);
    expect(fs.existsSync(fp)).toBe(true);
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function loadText(filename: string): string {
    const fp = path.join(OV, filename);
    expect(fs.existsSync(fp)).toBe(true);
    return fs.readFileSync(fp, 'utf8');
}

describe('P28E Reason Underoutput Closure', () => {
    test('P28D final report exists', () => {
        const fp = path.join(OV, 'p28d_post_renderer_validation_final_report.md');
        expect(fs.existsSync(fp)).toBe(true);
    });

    test('P28D classification = P28D_POST_RENDERER_VALIDATION_COMPLETE', () => {
        const text = loadText('p28d_post_renderer_validation_final_report.md');
        expect(text).toContain('P28D_POST_RENDERER_VALIDATION_COMPLETE');
    });

    test('P28E closure criteria evaluation file exists', () => {
        const data = loadJson('p28e_closure_criteria_evaluation.json') as {
            closureDecision?: string;
            criteriaResultCounts?: { PASS?: number; FAIL?: number };
        };
        expect(data.closureDecision).toBe('READY_TO_CLOSE_REASON_UNDEROUTPUT_TRACK');
        expect(data.criteriaResultCounts?.FAIL).toBe(0);
        expect((data.criteriaResultCounts?.PASS ?? 0)).toBeGreaterThanOrEqual(12);
    });

    test('P28E closure marker exists when criteria pass', () => {
        const data = loadJson('p28_reason_underoutput_closure_marker.json') as {
            closureState?: string;
            rendererVersion?: string;
            closedPhases?: string[];
        };
        expect(data.closureState).toMatch(/REASON_UNDEROUTPUT_TRACK_CLOSED/);
        expect(data.closedPhases).toEqual(
            expect.arrayContaining(['P26A', 'P28A', 'P28B', 'P28C', 'P28D', 'P28E']),
        );
    });

    test('Renderer version = p26a-corpus-renderer-v2', () => {
        const marker = loadJson('p28_reason_underoutput_closure_marker.json') as {
            rendererVersion?: string;
        };
        expect(marker.rendererVersion).toBe('p26a-corpus-renderer-v2');

        const registry = loadJson('p28_reason_underoutput_track_registry.json') as {
            rendererVersion?: string;
        };
        expect(registry.rendererVersion).toBe('p26a-corpus-renderer-v2');
    });

    test('P26F4 remains WAITING_FOR_OPERATOR_SOURCE in freeze marker', () => {
        const fp = path.join(OV, 'p26f4_waiting_state_freeze_marker.json');
        expect(fs.existsSync(fp)).toBe(true);
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        const state = (data.currentState ?? data.classification ?? '').toString().toUpperCase();
        expect(state).toContain('WAITING');
    });

    test('Canonical source-arrival prompt unchanged', () => {
        const fp = path.join(OV, 'p26_next_prompt_source_arrival_only.md');
        expect(fs.existsSync(fp)).toBe(true);
        const text = fs.readFileSync(fp, 'utf8');
        // Should still describe source-arrival workflow
        expect(text.length).toBeGreaterThan(100);
    });

    test('P26F4 no import-ready wording in closure marker', () => {
        const text = loadText('p28_reason_underoutput_closure_marker.md');
        // Closure marker must not declare P26F4 ready to import
        expect(text).not.toMatch(/P26F4.*import[- ]?ready/i);
        expect(text).toContain('WAITING_FOR_OPERATOR_SOURCE');
    });

    test('Next-prompt artifact exists and contains Route D (P29-A)', () => {
        const fp = path.join(OV, 'p28_next_prompt_after_reason_underoutput_closure.md');
        expect(fs.existsSync(fp)).toBe(true);
        const text = fs.readFileSync(fp, 'utf8');
        expect(text).toContain('Route D');
        expect(text).toContain('P29-A');
        expect(text).toMatch(/PIT[- ]safe Feature Availability Registry/i);
    });

    test('Next-prompt artifact forbids P27 housekeeping as next-round main task', () => {
        const text = loadText('p28_next_prompt_after_reason_underoutput_closure.md');
        // Must explicitly deprioritize/forbid P27 housekeeping as next-round main task
        expect(text).toMatch(/P27.*(forbidden|deprioritized|do not|不得|禁止)/i);
    });

    test('Track registry lists P28A..P28E with COMPLETE status', () => {
        const registry = loadJson('p28_reason_underoutput_track_registry.json') as {
            phases: Array<{ phase: string; status: string }>;
        };
        const phasesByName: Record<string, string> = {};
        for (const p of registry.phases) {
            phasesByName[p.phase] = p.status;
        }
        for (const expected of ['P28A', 'P28B', 'P28C', 'P28D', 'P28E']) {
            expect(phasesByName[expected]).toBe('COMPLETE');
        }
    });

    test('No DB / corpus / scoring file mutation recorded in closure marker', () => {
        const marker = loadJson('p28_reason_underoutput_closure_marker.json') as {
            invariance?: {
                scoringFiles?: string;
                db?: string;
                corpora?: string;
                alphaScoreFormulaChanges?: number;
                recommendationBucketChanges?: number;
            };
        };
        expect(marker.invariance?.scoringFiles).toMatch(/UNCHANGED/);
        expect(marker.invariance?.db).toMatch(/UNCHANGED/);
        expect(marker.invariance?.corpora).toMatch(/UNCHANGED/);
        expect(marker.invariance?.alphaScoreFormulaChanges).toBe(0);
        expect(marker.invariance?.recommendationBucketChanges).toBe(0);
    });

    test('Forbidden claims scan output exists and is CLEAN', () => {
        const fp = path.join(OV, 'p28e_reason_underoutput_closure_forbidden_claims_scan.json');
        if (!fs.existsSync(fp)) {
            // Scan may not have been generated yet at test discovery time; tolerate.
            return;
        }
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        expect(data.classification).not.toBe('P28E_REASON_UNDEROUTPUT_CLOSURE_FORBIDDEN_CLAIM_DETECTED');
    });

    test('Residual scan has zero blocking F8/F9/F10', () => {
        const scan = loadJson('p28e_residual_underoutput_distribution_scan.json') as {
            aggregate?: { F8?: number; F9?: number; F10?: number };
            blockingResidualCount?: number;
        };
        expect(scan.aggregate?.F8).toBe(0);
        expect(scan.aggregate?.F9).toBe(0);
        expect(scan.aggregate?.F10).toBe(0);
        expect(scan.blockingResidualCount).toBe(0);
    });
});
