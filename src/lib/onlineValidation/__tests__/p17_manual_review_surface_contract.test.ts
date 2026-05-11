import * as fs from 'fs';
import * as path from 'path';

import {
    buildManualReviewSurfaceContract,
    validateManualReviewSurfaceContract,
} from '../ManualReviewSurfaceContract';

function loadJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('ManualReviewSurfaceContract — P17', () => {
    const workflowBinding = loadJson(path.resolve(process.cwd(), 'outputs/online_validation/p16_manual_review_workflow_binding.json'));
    const actionSchema = loadJson(path.resolve(process.cwd(), 'outputs/online_validation/p16_manual_review_action_schema.json'));
    const statusCards = loadJson(path.resolve(process.cwd(), 'outputs/online_validation/p16_manual_review_status_cards.json'));
    const surface = buildManualReviewSurfaceContract(
        { workflowBinding, actionSchema, statusCards },
        {
            surfaceRunId: 'p17-surface-001',
            generatedAt: '2026-05-11T10:20:00.000Z',
        },
    );

    it('READY_FOR_MANUAL_REVIEW maps to READY_FOR_MANUAL_REVIEW_SURFACE', () => {
        expect(surface.surfaceStatus).toBe('READY_FOR_MANUAL_REVIEW_SURFACE');
    });

    it('status sections include review only indicator', () => {
        const statusText = JSON.stringify(surface.statusSections);
        expect(statusText).toMatch(/review only/i);
    });

    it('action sections contain only enabled manual-review actions', () => {
        const actionIds = surface.actionSections.flatMap(section => section.items.map(item => item.id));
        expect(actionIds).toEqual(
            expect.arrayContaining([
                'REVIEW_REHEARSAL_ARTIFACT',
                'REVIEW_WRITE_PATH_POLICY',
                'REVIEW_QUALITY_IMPACT_PREVIEW',
                'REQUEST_MORE_DATA',
                'ACKNOWLEDGE_DATA_LIMITED',
            ]),
        );
    });

    it('disabled action sections include blocked actions', () => {
        const disabledIds = surface.disabledActionSections.flatMap(section => section.items.map(item => item.id));
        expect(disabledIds).toEqual(
            expect.arrayContaining([
                'APPROVE_PRODUCTION_BACKFILL',
                'APPROVE_CORPUS_WRITE',
                'APPROVE_OPTIMIZER',
                'APPROVE_TRADING_ACTION',
                'AUTO_PROMOTE',
            ]),
        );
    });

    it('warning sections include manual review is not approval complete', () => {
        const warningText = JSON.stringify(surface.warningSections);
        expect(warningText).toMatch(/not approval complete/i);
    });

    it('validation passes for valid surface', () => {
        expect(surface.validationStatus).toBe('PASS');
        expect(validateManualReviewSurfaceContract(surface).validationStatus).toBe('PASS');
    });

    it('PRODUCTION_READY rejected', () => {
        const mutated = { ...surface, surfaceStatus: 'PRODUCTION_READY' as any };
        expect(validateManualReviewSurfaceContract(mutated).validationStatus).toBe('FAIL');
    });

    it('APPROVED rejected', () => {
        const mutated = { ...surface, surfaceStatus: 'APPROVED' as any };
        expect(validateManualReviewSurfaceContract(mutated).validationStatus).toBe('FAIL');
    });

    it('forbidden claims rejected', () => {
        const mutated = { ...surface, pageSubtitle: 'profit' };
        expect(validateManualReviewSurfaceContract(mutated as typeof surface).validationStatus).toBe('FAIL');
    });
});
