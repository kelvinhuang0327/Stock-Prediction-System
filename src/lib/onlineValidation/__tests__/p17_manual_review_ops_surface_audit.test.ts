import * as fs from 'fs';
import * as path from 'path';

import { buildManualReviewSurfaceContract } from '../ManualReviewSurfaceContract';
import {
    buildManualReviewOpsSurfaceAudit,
    validateManualReviewOpsSurfaceAudit,
} from '../ManualReviewOpsSurfaceAudit';

function loadJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('ManualReviewOpsSurfaceAudit — P17', () => {
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
    const audit = buildManualReviewOpsSurfaceAudit(surface, {
        auditRunId: 'p17-audit-001',
        generatedAt: '2026-05-11T10:20:00.000Z',
    });

    it('all enabled actions require human', () => {
        expect(audit.actionAudit.allEnabledActionsRequireHuman).toBe(true);
    });

    it('all enabled actions writePathEffect NONE', () => {
        expect(audit.actionAudit.allEnabledActionsWritePathEffectNone).toBe(true);
    });

    it('production write false', () => {
        expect(audit.actionAudit.allEnabledActionsProductionWriteFalse).toBe(true);
    });

    it('corpus write false', () => {
        expect(audit.actionAudit.allEnabledActionsCorpusWriteFalse).toBe(true);
    });

    it('optimizer false', () => {
        expect(audit.actionAudit.allEnabledActionsOptimizerFalse).toBe(true);
    });

    it('disabled action audit covers blocked actions', () => {
        expect(audit.disabledActionAudit.productionBackfillDisabled).toBe(true);
        expect(audit.disabledActionAudit.corpusWriteDisabled).toBe(true);
        expect(audit.disabledActionAudit.optimizerDisabled).toBe(true);
        expect(audit.disabledActionAudit.tradingActionDisabled).toBe(true);
        expect(audit.disabledActionAudit.autoPromoteDisabled).toBe(true);
    });

    it('forbidden token audit PASS', () => {
        expect(audit.forbiddenTokenAudit.pass).toBe(true);
    });

    it('auditStatus PASS for valid surface', () => {
        expect(audit.auditStatus).toBe('PASS');
        expect(validateManualReviewOpsSurfaceAudit(audit).validationStatus).toBe('PASS');
    });

    it('forbidden claims rejected', () => {
        const mutated = { ...audit, forbiddenTokenAudit: { ...audit.forbiddenTokenAudit, checkedText: 'profit' } };
        expect(validateManualReviewOpsSurfaceAudit(mutated as typeof audit).validationStatus).toBe('FAIL');
    });
});
