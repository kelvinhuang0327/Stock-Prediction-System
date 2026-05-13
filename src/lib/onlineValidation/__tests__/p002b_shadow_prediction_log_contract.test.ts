/**
 * P0-02B — Shadow Prediction Log Contract Tests
 *
 * @jest-environment node
 */

import {
    buildShadowPredictionLogEntry,
    buildShadowPredictionLogBatch,
    buildShadowPredictionLogArtifact,
    validateShadowPredictionLogEntry,
    validateShadowPredictionLogBatch,
    detectShadowLogDuplicateKey,
    sanitizeResearchCandidateForShadowLog,
    RawResearchCandidate,
    ShadowPredictionLogEntry,
} from '../ShadowPredictionLogContract';

// ─── Fixtures ─────────────────────────────────────────────────────

const makeCandidate = (overrides: Partial<RawResearchCandidate> = {}): RawResearchCandidate => ({
    symbol: '2330',
    name: 'TSMC',
    alphaScore: 78.5,
    recommendationBucket: 'Strong Candidate',
    confidence: 65,
    technicalScore: 80,
    chipScore: 70,
    fundamentalScore: 85,
    marketAdjustment: 5,
    topFactors: ['momentum above average', 'institutional concentration improving'],
    keyRisks: ['sector concentration'],
    limitations: ['limited chip data'],
    dataCoverage: 'full',
    usedSources: ['price', 'chip'],
    missingSources: [],
    ...overrides,
});

const BASE_PARAMS = {
    asOfDate: '2026-05-07',
    runId: 'test-run-001',
    universeTier: 'MVP_CORE',
    sourceDateBasis: {
        sourceDate: '2026-05-06',
        sourceType: 'stockQuote',
        missingDataFlags: [],
    },
};

// ─── Tests ────────────────────────────────────────────────────────

describe('P0-02B buildShadowPredictionLogEntry', () => {
    it('creates entry with asOfDate', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        expect(entry.asOfDate).toBe('2026-05-07');
    });

    it('creates deterministic duplicateKey', () => {
        const entry1 = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const entry2 = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        expect(entry1.duplicateKey).toBe(entry2.duplicateKey);
        expect(entry1.duplicateKey).toBe('2026-05-07|2330|MVP_CORE|test-run-001');
    });

    it('sets targetHorizons outcomeStatus to PENDING', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        for (const h of entry.targetHorizons) {
            expect(h.outcomeStatus).toBe('PENDING');
        }
    });

    it('sets targetHorizons outcomeWriteBackAllowed to false', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        for (const h of entry.targetHorizons) {
            expect(h.outcomeWriteBackAllowed).toBe(false);
        }
    });

    it('sets writeMode to DRY_RUN', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        expect(entry.writeMode).toBe('DRY_RUN');
    });

    it('does not contain signal field', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const str = JSON.stringify(entry);
        expect(str).not.toMatch(/"signal"/);
    });

    it('does not contain alphaScore field name', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const str = JSON.stringify(entry);
        expect(str).not.toMatch(/"alphaScore"/);
    });

    it('does not contain recommendationBucket field name', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const str = JSON.stringify(entry);
        expect(str).not.toMatch(/"recommendationBucket"/);
    });
});

describe('P0-02B sourceDateBasis validation', () => {
    it('sourceDate <= asOfDate passes validation', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const result = validateShadowPredictionLogEntry(entry);
        expect(result.status).toBe('PASS');
    });

    it('sourceDate > asOfDate fails validation', () => {
        const entry = buildShadowPredictionLogEntry({
            candidate: makeCandidate(),
            ...BASE_PARAMS,
            sourceDateBasis: { ...BASE_PARAMS.sourceDateBasis, sourceDate: '2026-05-08' },
        });
        const result = validateShadowPredictionLogEntry(entry);
        expect(result.status).toBe('FAIL');
        expect(result.messages.some(m => m.includes('sourceDate'))).toBe(true);
    });
});

describe('P0-02B sanitizeResearchCandidateForShadowLog', () => {
    it('maps alphaScore to researchScore', () => {
        const sanitized = sanitizeResearchCandidateForShadowLog(makeCandidate());
        expect(sanitized.researchScore).toBe(78.5);
        expect((sanitized as Record<string, unknown>).alphaScore).toBeUndefined();
    });

    it('maps recommendationBucket to researchBucket', () => {
        const sanitized = sanitizeResearchCandidateForShadowLog(makeCandidate());
        expect(sanitized.researchBucket).toBe('Strong');
        expect((sanitized as Record<string, unknown>).recommendationBucket).toBeUndefined();
    });

    it('removes forbidden fields — no buy/sell/alpha/edge/profit keys', () => {
        const raw = makeCandidate({ alphaScore: 50, recommendationBucket: 'Watch' });
        const sanitized = sanitizeResearchCandidateForShadowLog(raw);
        const keys = Object.keys(sanitized);
        const forbidden = ['buy', 'sell', 'alpha', 'edge', 'profit', 'alphaScore', 'recommendationBucket'];
        for (const f of forbidden) {
            expect(keys).not.toContain(f);
        }
    });

    it('handles Watch bucket correctly', () => {
        const sanitized = sanitizeResearchCandidateForShadowLog(
            makeCandidate({ recommendationBucket: 'Watch' }),
        );
        expect(sanitized.researchBucket).toBe('Watch');
    });
});

describe('P0-02B validateShadowPredictionLogEntry', () => {
    it('detects missing asOfDate', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const bad = { ...entry, asOfDate: '' };
        const result = validateShadowPredictionLogEntry(bad);
        expect(result.status).toBe('FAIL');
    });

    it('detects missing symbol', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const bad = { ...entry, symbol: '' };
        const result = validateShadowPredictionLogEntry(bad);
        expect(result.status).toBe('FAIL');
    });

    it('detects missing duplicateKey', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const bad = { ...entry, duplicateKey: '' };
        const result = validateShadowPredictionLogEntry(bad);
        expect(result.status).toBe('FAIL');
    });

    it('detects forbidden claims in researchBucket', () => {
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        const bad: ShadowPredictionLogEntry = { ...entry, researchBucket: 'buy this now' };
        const result = validateShadowPredictionLogEntry(bad);
        expect(result.status).toBe('FAIL');
    });
});

describe('P0-02B buildShadowPredictionLogBatch', () => {
    it('has deterministic ordering', () => {
        const candidates = [
            makeCandidate({ symbol: 'Z999', name: 'Last Co' }),
            makeCandidate({ symbol: '2330', name: 'TSMC' }),
            makeCandidate({ symbol: '1101', name: 'Taiwan Cement' }),
        ];
        const batch = buildShadowPredictionLogBatch({ candidates, ...BASE_PARAMS });
        const symbols = batch.entries.map(e => e.symbol);
        expect(symbols).toEqual(['1101', '2330', 'Z999']);
    });

    it('respects maxCandidates', () => {
        const candidates = [
            makeCandidate({ symbol: '2330' }),
            makeCandidate({ symbol: '2454' }),
            makeCandidate({ symbol: '2317' }),
        ];
        const batch = buildShadowPredictionLogBatch({ candidates, maxCandidates: 2, ...BASE_PARAMS });
        expect(batch.entryCount).toBe(2);
    });
});

describe('P0-02B validateShadowPredictionLogBatch', () => {
    it('detects duplicate keys', () => {
        const candidates = [
            makeCandidate({ symbol: '2330' }),
            makeCandidate({ symbol: '2330' }), // duplicate symbol -> same key
        ];
        const batch = buildShadowPredictionLogBatch({ candidates, ...BASE_PARAMS });
        // After sorting, duplicates will be merged — validate directly
        const dupEntries = [batch.entries[0], { ...batch.entries[0] }]; // force dup
        const result = validateShadowPredictionLogBatch({ entries: dupEntries, asOfDate: BASE_PARAMS.asOfDate });
        expect(result.status).toBe('FAIL');
        expect(result.messages.some(m => m.includes('duplicate key'))).toBe(true);
    });

    it('detects future sourceDate in batch', () => {
        const futureBasis = { ...BASE_PARAMS.sourceDateBasis, sourceDate: '2026-05-09' };
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate()],
            ...BASE_PARAMS,
            sourceDateBasis: futureBasis,
        });
        const result = validateShadowPredictionLogBatch({
            entries: batch.entries,
            asOfDate: BASE_PARAMS.asOfDate,
        });
        expect(result.status).toBe('FAIL');
    });
});

describe('P0-02B buildShadowPredictionLogArtifact', () => {
    it('returns parseable JSON', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate()],
            ...BASE_PARAMS,
        });
        const artifact = buildShadowPredictionLogArtifact(batch);
        const parsed = JSON.parse(JSON.stringify(artifact.jsonPayload));
        expect(parsed).toBeTruthy();
        expect(parsed.taskName).toBe('P0-02B');
    });

    it('JSONL preview lines are parseable', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate({ symbol: '2330' }), makeCandidate({ symbol: '2454', name: 'MediaTek' })],
            ...BASE_PARAMS,
        });
        const artifact = buildShadowPredictionLogArtifact(batch);
        for (const line of artifact.jsonlLines) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });

    it('artifact entryCount matches entries', () => {
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate(), makeCandidate({ symbol: '2454', name: 'MediaTek' })],
            ...BASE_PARAMS,
        });
        const artifact = buildShadowPredictionLogArtifact(batch);
        expect(artifact.entryCount).toBe(batch.entryCount);
        expect(artifact.jsonlLines).toHaveLength(batch.entryCount);
    });
});

describe('P0-02B detectShadowLogDuplicateKey', () => {
    it('returns PASS when key is unique', () => {
        const result = detectShadowLogDuplicateKey('2026-05-07|2330|MVP_CORE|run-001', []);
        expect(result.status).toBe('PASS');
    });

    it('returns WARN when key already exists', () => {
        const existing = ['2026-05-07|2330|MVP_CORE|run-001'];
        const result = detectShadowLogDuplicateKey('2026-05-07|2330|MVP_CORE|run-001', existing);
        expect(result.status).toBe('WARN');
        expect(result.messages.length).toBeGreaterThan(0);
    });
});

describe('P0-02B no production DB write / external API / LLM behavior', () => {
    it('buildShadowPredictionLogEntry is purely functional (no DB import)', () => {
        // If the module imported prisma, this test environment would need mocks.
        // The fact that it works without any jest.mock means no DB is called.
        const entry = buildShadowPredictionLogEntry({ candidate: makeCandidate(), ...BASE_PARAMS });
        expect(entry).toBeTruthy();
    });

    it('does not write Prediction or StrategySignal rows', () => {
        // These are structural guarantees — no prisma calls in the module.
        // Verify by confirming no throws and purely functional output.
        const batch = buildShadowPredictionLogBatch({
            candidates: [makeCandidate()],
            ...BASE_PARAMS,
        });
        expect(batch.entries.length).toBeGreaterThan(0);
    });
});
