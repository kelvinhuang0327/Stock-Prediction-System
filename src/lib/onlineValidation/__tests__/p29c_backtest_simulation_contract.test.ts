/**
 * P29C Backtest / Simulation Contract Tests
 *
 * Validates paper design artifacts:
 *   - Contract v1 exists and is paper design only
 *   - Outcome isolation design exists
 *   - Backtest output schema exists and marks mode=paper_only
 *   - Outcome fields are in outcome section only
 *   - alphaScore / bucket remain in input snapshot
 *   - leakageControls exist in schema
 *   - Corpus expansion gate says blocked until P26F4/post-import
 *   - No optimizer gate exists and blocks optimizer
 *   - No investment advice wording as claims
 *   - No DB / corpus / scoring change
 *
 * Read-only. Not investment advice.
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

interface Contract {
    paperDesignOnly: boolean;
    noProductionBacktest: boolean;
    noOptimizer: boolean;
    inputContract: { required: Array<{ field: string }>; forbidden: Array<{ field: string }> };
    outcomeContract: { fields: Array<{ field: string }>; forbidden: string[] };
    evaluationModes: Array<{ mode: string; allowed: boolean }>;
    forbiddenBehavior: string[];
}

interface Schema {
    schemaVersion: string;
    paperDesignOnly: boolean;
    sampleEntry: {
        mode: string;
        alphaScore: number | null;
        outcome: { outcomePrice: number | null; returnPct: number | null; realizedReturnClass: string };
        leakageControls: { featuresFrozenBeforeOutcomeJoin: boolean; outcomeExcludedFromScoringInput: boolean };
    };
}

describe('P29C Backtest / Simulation Contract', () => {

    describe('Contract v1', () => {
        let contract: Contract;
        beforeAll(() => { contract = loadJson<Contract>('p29c_backtest_simulation_contract_v1.json'); });

        test('Contract v1 exists and is paper design only', () => {
            expect(contract.paperDesignOnly).toBe(true);
            expect(contract.noProductionBacktest).toBe(true);
            expect(contract.noOptimizer).toBe(true);
        });

        test('Contract v1 requires asOfDate, alphaScore, symbol, horizon in input', () => {
            const fields = contract.inputContract.required.map((f) => f.field);
            expect(fields).toContain('asOfDate');
            expect(fields).toContain('alphaScore');
            expect(fields).toContain('symbol');
            expect(fields).toContain('horizon');
        });

        test('Contract v1 forbids outcome fields in input', () => {
            const forbidden = contract.inputContract.forbidden.map((f) => f.field);
            expect(forbidden).toContain('outcomePrice');
            expect(forbidden).toContain('returnPct');
            expect(forbidden).toContain('realizedReturnClass');
        });

        test('Contract v1 outcome section exists with outcome fields', () => {
            const fields = contract.outcomeContract.fields.map((f) => f.field);
            expect(fields).toContain('outcomePrice');
            expect(fields).toContain('returnPct');
            expect(fields).toContain('realizedReturnClass');
        });

        test('Outcome contract forbids outcome in scoring path', () => {
            const forbiddenText = contract.outcomeContract.forbidden.join(' ').toLowerCase();
            expect(forbiddenText).toMatch(/activeScoring|factorSnapshot|scoreSnapshot|alphaScore|renderer/i);
        });

        test('PRODUCTION_TRADING mode is permanently blocked', () => {
            const prodMode = contract.evaluationModes.find((m) => m.mode === 'PRODUCTION_TRADING');
            expect(prodMode).toBeDefined();
            expect(prodMode!.allowed).toBe(false);
        });

        test('OPTIMIZER mode is blocked', () => {
            const optimizerMode = contract.evaluationModes.find((m) => m.mode === 'OPTIMIZER');
            expect(optimizerMode).toBeDefined();
            expect(optimizerMode!.allowed).toBe(false);
        });

        test('Contract forbids investment recommendations', () => {
            const forbidden = contract.forbiddenBehavior.join(' ').toLowerCase();
            expect(forbidden).toMatch(/investment|recommendation|optimizer|production scoring|scoring input/i);
        });
    });

    describe('Outcome isolation design', () => {
        test('Outcome isolation design exists', () => {
            const d = loadJson<{ outcomeFields: Array<{ field: string; forbiddenIn: string[] }>; joinTiming: string }>(
                'p29c_outcome_isolation_leakage_control_design.json'
            );
            expect(d.outcomeFields).toBeDefined();
            expect(d.outcomeFields.length).toBeGreaterThanOrEqual(3);
            expect(d.joinTiming).toBeTruthy();
        });

        test('outcomePrice / returnPct / realizedReturnClass are in isolation design', () => {
            const d = loadJson<{ outcomeFields: Array<{ field: string }> }>(
                'p29c_outcome_isolation_leakage_control_design.json'
            );
            const fields = d.outcomeFields.map((f) => f.field);
            expect(fields).toContain('outcomePrice');
            expect(fields).toContain('returnPct');
            expect(fields).toContain('realizedReturnClass');
        });
    });

    describe('Backtest output schema', () => {
        let schema: Schema;
        beforeAll(() => { schema = loadJson<Schema>('p29c_backtest_output_schema_draft.json'); });

        test('Schema exists and marks mode = paper_only', () => {
            expect(schema.paperDesignOnly).toBe(true);
            expect(schema.sampleEntry.mode).toBe('paper_only');
        });

        test('Schema outcome fields are under outcome section', () => {
            const entry = schema.sampleEntry;
            // outcome fields must NOT be at root level
            expect((entry as unknown as Record<string, unknown>)['outcomePrice']).toBeUndefined();
            expect((entry as unknown as Record<string, unknown>)['returnPct']).toBeUndefined();
            expect((entry as unknown as Record<string, unknown>)['realizedReturnClass']).toBeUndefined();
            // They must be in outcome section
            expect(entry.outcome).toBeDefined();
            expect('outcomePrice' in entry.outcome).toBe(true);
        });

        test('Schema has leakageControls', () => {
            expect(schema.sampleEntry.leakageControls).toBeDefined();
            expect(schema.sampleEntry.leakageControls.featuresFrozenBeforeOutcomeJoin).toBe(true);
            expect(schema.sampleEntry.leakageControls.outcomeExcludedFromScoringInput).toBe(true);
        });

        test('Schema disclaimer exists and mentions paper-only / not investment advice', () => {
            const schemaText = loadText('p29c_backtest_output_schema_draft.json');
            expect(schemaText.toLowerCase()).toMatch(/paper.?only|not investment/i);
        });
    });

    describe('Corpus expansion gate', () => {
        test('Corpus expansion gate design exists', () => {
            const d = loadJson<{ expansionBlockedUntil: string[]; currentCorpusState: Record<string, unknown> }>(
                'p29c_simulation_corpus_expansion_gate_design.json'
            );
            expect(d.expansionBlockedUntil).toBeDefined();
            expect(d.expansionBlockedUntil.length).toBeGreaterThanOrEqual(3);
        });

        test('Corpus expansion gate blocks until P26F4 import', () => {
            const d = loadJson<{ expansionBlockedUntil: string[] }>(
                'p29c_simulation_corpus_expansion_gate_design.json'
            );
            const blockText = d.expansionBlockedUntil.join(' ').toLowerCase();
            expect(blockText).toMatch(/p26f4|monthlyrevenue|import/i);
        });
    });

    describe('Gate matrix', () => {
        test('Gate matrix exists with 10 gates', () => {
            const d = loadJson<{ gates: Array<{ id: string; status: string }> }>(
                'p29c_backtest_simulation_gate_matrix.json'
            );
            expect(d.gates.length).toBeGreaterThanOrEqual(10);
        });

        test('Gate matrix shows G3 (P26F4 source gate) as BLOCKED', () => {
            const d = loadJson<{ gates: Array<{ id: string; status: string }> }>(
                'p29c_backtest_simulation_gate_matrix.json'
            );
            const g3 = d.gates.find((g) => g.id === 'G3');
            expect(g3).toBeDefined();
            expect(g3!.status).toBe('BLOCKED');
        });

        test('Gate matrix shows G9 (No optimizer gate) as PASS', () => {
            const d = loadJson<{ gates: Array<{ id: string; status: string }> }>(
                'p29c_backtest_simulation_gate_matrix.json'
            );
            const g9 = d.gates.find((g) => g.id === 'G9');
            expect(g9).toBeDefined();
            expect(g9!.status).toBe('PASS');
        });
    });

    describe('Invariance guards', () => {
        test('P26F4 remains WAITING_FOR_OPERATOR_SOURCE', () => {
            const pf = loadJson<{ p26f4State: string }>('p29c_backtest_simulation_contract_preflight.json');
            expect(pf.p26f4State).toBe('WAITING_FOR_OPERATOR_SOURCE');
        });

        test('P29A registry still marks FinancialReport as HIGH_RISK_SOURCE_ABSENT', () => {
            const reg = loadJson<{ sources: Array<{ sourceName: string; sourceStatus: string }> }>(
                'p29a_pit_feature_availability_registry_v1.json'
            );
            const fr = reg.sources.find((s) => s.sourceName === 'FinancialReport');
            expect(fr!.sourceStatus).toBe('HIGH_RISK_SOURCE_ABSENT');
        });

        test('P29A registry still marks NewsEvent as HIGH_RISK_SOURCE_ABSENT', () => {
            const reg = loadJson<{ sources: Array<{ sourceName: string; sourceStatus: string }> }>(
                'p29a_pit_feature_availability_registry_v1.json'
            );
            const ne = reg.sources.find((s) => s.sourceName === 'NewsEvent');
            expect(ne!.sourceStatus).toBe('HIGH_RISK_SOURCE_ABSENT');
        });

        test('Canonical source-arrival prompt still present', () => {
            expect(fs.existsSync(path.join(OV, 'p26_next_prompt_source_arrival_only.md'))).toBe(true);
        });
    });
});
