/**
 * p3active_scoring_snapshot_builder.test.ts — P3-HARDRESET PART F (Test 1 of 2)
 *
 * Tests for ActiveScoringSnapshotBuilder.
 *
 * Coverage:
 * - buildActiveScoringSnapshot with injected mock analyzer (no DB calls)
 * - COMPLETE/PARTIAL/EMPTY classification logic
 * - No fabricated scores — score must come from analyzer, not generated
 * - EMPTY snapshot returned on analyzer error
 * - validateActiveScoringSnapshot catches forbidden claims
 * - mapRecommendationToEnglishBucket covers all 5 Chinese labels + fallback
 * - pitGateDate === asOfDate
 * - Score values map correctly from StockAnalysisResult
 * - factorSnapshot and signalSnapshot correct format
 * - computeScoringCompletenessDistribution aggregates correctly
 * - buildRawCandidateFromActiveScoringSnapshot maps to RawResearchCandidate
 */

import {
    buildActiveScoringSnapshot,
    classifyScoringSnapshotCompleteness,
    validateActiveScoringSnapshot,
    mapRecommendationToEnglishBucket,
    buildRawCandidateFromActiveScoringSnapshot,
    computeScoringCompletenessDistribution,
    ACTIVE_SCORING_BUILDER_VERSION,
    ACTIVE_SCORING_ENGINE_SOURCE,
    ACTIVE_SCORING_MODE,
    ActiveScoringSnapshot,
    ScoringCompletenessStatus,
} from '../ActiveScoringSnapshotBuilder';

import { StockAnalysisResult } from '@/lib/analysis/RuleBasedStockAnalyzer';

// ─── Test helpers ──────────────────────────────────────────────────────────

function makeAnalysisResult(overrides?: Partial<StockAnalysisResult>): StockAnalysisResult {
    return {
        symbol: '2330',
        name: 'TSMC',
        overallScore: 72,
        technicalScore: 68,
        chipStrength: 75,
        recommendation: '偏多',
        factors: [
            { name: 'MA 趨勢', value: '多頭', note: 'MA20>MA60' },
            { name: 'RSI(14)', value: '55.2', note: '偏多' },
        ],
        limitations: [],
        dataCoverage: 'full',
        dataPoints: 500,
        usedSources: ['StockQuote', 'InstitutionalChip'],
        missingSources: [],
        reason: '技術偏多',
        summary: '多頭格局',
        riskScore: 30,
        riskLevel: 'low',
        ...overrides,
    };
}

function makeEmptyResult(overrides?: Partial<StockAnalysisResult>): StockAnalysisResult {
    return {
        symbol: '9999',
        name: 'TestCo',
        overallScore: 0,
        technicalScore: 0,
        chipStrength: 0,
        recommendation: '資料不足',
        factors: [],
        limitations: ['No data'],
        dataCoverage: 'insufficient',
        dataPoints: 0,
        usedSources: [],
        missingSources: ['StockQuote', 'InstitutionalChip'],
        reason: '',
        summary: '',
        riskScore: 0,
        riskLevel: 'unknown',
        ...overrides,
    };
}

// ─── Constants ─────────────────────────────────────────────────────────────

describe('ActiveScoringSnapshotBuilder — P3-HARDRESET PART F', () => {
    // ── mapRecommendationToEnglishBucket ──────────────────────────────────

    describe('mapRecommendationToEnglishBucket', () => {
        it('maps 偏多 → Strong Candidate', () => {
            expect(mapRecommendationToEnglishBucket('偏多')).toBe('Strong Candidate');
        });
        it('maps 觀察 → Watch', () => {
            expect(mapRecommendationToEnglishBucket('觀察')).toBe('Watch');
        });
        it('maps 中性 → Neutral', () => {
            expect(mapRecommendationToEnglishBucket('中性')).toBe('Neutral');
        });
        it('maps 偏空 → Avoid', () => {
            expect(mapRecommendationToEnglishBucket('偏空')).toBe('Avoid');
        });
        it('maps 資料不足 → Insufficient Data', () => {
            expect(mapRecommendationToEnglishBucket('資料不足')).toBe('Insufficient Data');
        });
        it('falls back to Neutral for unknown recommendation', () => {
            expect(mapRecommendationToEnglishBucket('UNKNOWN')).toBe('Neutral');
            expect(mapRecommendationToEnglishBucket('')).toBe('Neutral');
        });
    });

    // ── classifyScoringSnapshotCompleteness ───────────────────────────────

    describe('classifyScoringSnapshotCompleteness', () => {
        function makeSnapshot(
            bucket: string,
            score: number,
            factors: string[],
        ): ActiveScoringSnapshot {
            return {
                builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
                symbol: 'TEST',
                asOfDate: '2025-01-15',
                scoringMode: ACTIVE_SCORING_MODE,
                scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
                researchBucket: bucket,
                alphaScore: score,
                scoreSnapshot: { researchScore: score, confidenceScore: 0, technicalScore: 0, chipScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
                signalSnapshot: [],
                factorSnapshot: factors,
                reasonSnapshot: 'test',
                limitations: [],
                dataCoverage: 'full',
                dataPoints: 100,
                usedSources: [],
                missingSources: [],
                pitGateDate: '2025-01-15',
                scoringAvailable: true,
                completenessStatus: 'COMPLETE',
                scoringNote: 'test',
            };
        }

        it('classifies COMPLETE: non-Neutral bucket AND score>0 AND factors present', () => {
            const snap = makeSnapshot('Strong Candidate', 75, ['factor1']);
            expect(classifyScoringSnapshotCompleteness(snap)).toBe('COMPLETE');
        });

        it('classifies COMPLETE for Avoid bucket with score and factors', () => {
            const snap = makeSnapshot('Avoid', 40, ['factor1']);
            expect(classifyScoringSnapshotCompleteness(snap)).toBe('COMPLETE');
        });

        it('classifies PARTIAL: non-Neutral bucket, score>0, but no factors', () => {
            const snap = makeSnapshot('Strong Candidate', 70, []);
            expect(classifyScoringSnapshotCompleteness(snap)).toBe('PARTIAL');
        });

        it('classifies PARTIAL: Neutral bucket but score>0 and factors', () => {
            const snap = makeSnapshot('Neutral', 50, ['factor1']);
            expect(classifyScoringSnapshotCompleteness(snap)).toBe('PARTIAL');
        });

        it('classifies EMPTY: Neutral bucket AND score=0 AND no factors', () => {
            const snap = makeSnapshot('Neutral', 0, []);
            expect(classifyScoringSnapshotCompleteness(snap)).toBe('EMPTY');
        });

        it('classifies EMPTY: InsufficientData bucket with no score or factors', () => {
            const snap = makeSnapshot('InsufficientData', 0, []);
            expect(classifyScoringSnapshotCompleteness(snap)).toBe('EMPTY');
        });
    });

    // ── buildActiveScoringSnapshot ────────────────────────────────────────

    describe('buildActiveScoringSnapshot', () => {
        it('returns snapshot with correct fields from injected analyzer', async () => {
            const mockResult = makeAnalysisResult();
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.symbol).toBe('2330');
            expect(snap.asOfDate).toBe('2025-06-01');
            expect(snap.builderVersion).toBe(ACTIVE_SCORING_BUILDER_VERSION);
            expect(snap.scoringMode).toBe('RULE_BASED_ANALYZER');
            expect(snap.scoringEngineSource).toBe('RuleBasedStockAnalyzer');
        });

        it('maps overallScore → alphaScore (no fabrication)', async () => {
            const mockResult = makeAnalysisResult({ overallScore: 72 });
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            // Score must come from analyzer, not be randomly generated
            expect(snap.alphaScore).toBe(72);
            expect(snap.scoreSnapshot.researchScore).toBe(72);
        });

        it('maps technicalScore and chipStrength correctly', async () => {
            const mockResult = makeAnalysisResult({ technicalScore: 65, chipStrength: 80 });
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.scoreSnapshot.technicalScore).toBe(65);
            expect(snap.scoreSnapshot.chipScore).toBe(80);
        });

        it('maps 偏多 recommendation → Strong Candidate researchBucket', async () => {
            const mockResult = makeAnalysisResult({ recommendation: '偏多' });
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.researchBucket).toBe('Strong Candidate');
        });

        it('pitGateDate === asOfDate (PIT safety)', async () => {
            const mockAnalyzer = jest.fn().mockResolvedValue(makeAnalysisResult());

            const snap = await buildActiveScoringSnapshot('2330', '2025-03-15', {
                analyzer: mockAnalyzer,
            });

            expect(snap.pitGateDate).toBe('2025-03-15');
            expect(snap.pitGateDate).toBe(snap.asOfDate);
        });

        it('analyzer is called with (symbol, asOfDate) — PIT-safe call', async () => {
            const mockAnalyzer = jest.fn().mockResolvedValue(makeAnalysisResult());

            await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(mockAnalyzer).toHaveBeenCalledWith('2330', '2025-06-01');
        });

        it('builds factorSnapshot as "name: value (note)" strings', async () => {
            const mockResult = makeAnalysisResult({
                factors: [
                    { name: 'MA 趨勢', value: '多頭', note: 'MA20>MA60' },
                    { name: 'RSI(14)', value: '55.2', note: '偏多' },
                ],
            });
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.factorSnapshot[0]).toBe('MA 趨勢: 多頭 (MA20>MA60)');
            expect(snap.factorSnapshot[1]).toBe('RSI(14): 55.2 (偏多)');
        });

        it('builds signalSnapshot as factor names only', async () => {
            const mockResult = makeAnalysisResult({
                factors: [
                    { name: 'MA 趨勢', value: '多頭', note: 'MA20>MA60' },
                    { name: 'RSI(14)', value: '55.2', note: '偏多' },
                ],
            });
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.signalSnapshot).toEqual(['MA 趨勢', 'RSI(14)']);
        });

        it('classifies COMPLETE for non-Neutral bucket with score>0 and factors', async () => {
            const mockResult = makeAnalysisResult({
                overallScore: 72,
                recommendation: '偏多',
                factors: [{ name: 'MA', value: '多頭', note: 'note' }],
            });
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.completenessStatus).toBe('COMPLETE');
        });

        it('returns EMPTY snapshot on analyzer error (no throw)', async () => {
            const mockAnalyzer = jest.fn().mockRejectedValue(new Error('DB connection failed'));

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            // Must not throw — must return EMPTY snapshot
            expect(snap.completenessStatus).toBe('EMPTY');
            expect(snap.alphaScore).toBe(0);
            expect(snap.scoreSnapshot.researchScore).toBe(0);
            expect(snap.scoringAvailable).toBe(false);
            expect(snap.pitGateDate).toBe('2025-06-01');
        });

        it('EMPTY snapshot has limitations explaining the error', async () => {
            const mockAnalyzer = jest.fn().mockRejectedValue(new Error('timeout'));

            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            expect(snap.limitations.length).toBeGreaterThan(0);
            expect(snap.limitations[0]).toContain('active-scoring-error');
        });

        it('insufficient data → EMPTY classification', async () => {
            const mockResult = makeEmptyResult();
            const mockAnalyzer = jest.fn().mockResolvedValue(mockResult);

            const snap = await buildActiveScoringSnapshot('9999', '2025-06-01', {
                analyzer: mockAnalyzer,
            });

            // 資料不足 → 'Insufficient Data' bucket → EMPTY
            expect(snap.completenessStatus).toBe('EMPTY');
            expect(snap.researchBucket).toBe('Insufficient Data');
        });
    });

    // ── validateActiveScoringSnapshot ─────────────────────────────────────

    describe('validateActiveScoringSnapshot', () => {
        function makeValidSnapshot(): ActiveScoringSnapshot {
            return {
                builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
                symbol: '2330',
                asOfDate: '2025-06-01',
                scoringMode: ACTIVE_SCORING_MODE,
                scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
                researchBucket: 'Strong Candidate',
                alphaScore: 72,
                scoreSnapshot: {
                    researchScore: 72,
                    confidenceScore: 0,
                    technicalScore: 65,
                    chipScore: 75,
                    fundamentalScore: 0,
                    marketAdjustment: 0,
                },
                signalSnapshot: ['MA 趨勢'],
                factorSnapshot: ['MA 趨勢: 多頭 (MA20>MA60)'],
                reasonSnapshot: '技術偏多',
                limitations: [],
                dataCoverage: 'full',
                dataPoints: 500,
                usedSources: ['StockQuote'],
                missingSources: [],
                pitGateDate: '2025-06-01',
                scoringAvailable: true,
                completenessStatus: 'COMPLETE',
                scoringNote: 'dataCoverage=full dataPoints=500',
            };
        }

        it('validates a well-formed snapshot as valid', () => {
            const result = validateActiveScoringSnapshot(makeValidSnapshot());
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('catches PIT gate violation: pitGateDate !== asOfDate', () => {
            const snap = makeValidSnapshot();
            snap.pitGateDate = '2099-01-01'; // future — PIT violation
            const result = validateActiveScoringSnapshot(snap);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('pitGateDate'))).toBe(true);
        });

        it('catches alphaScore out of range', () => {
            const snap = makeValidSnapshot();
            snap.alphaScore = 150;
            const result = validateActiveScoringSnapshot(snap);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('alphaScore'))).toBe(true);
        });

        it('catches missing symbol', () => {
            const snap = makeValidSnapshot();
            (snap as Partial<typeof snap>).symbol = '';
            const result = validateActiveScoringSnapshot(snap as ActiveScoringSnapshot);
            expect(result.valid).toBe(false);
        });

        it('catches forbidden claim in reasonSnapshot', () => {
            const snap = makeValidSnapshot();
            snap.reasonSnapshot = 'expected_return is 30%'; // forbidden
            const result = validateActiveScoringSnapshot(snap);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Forbidden'))).toBe(true);
        });

        it('catches forbidden claim in factorSnapshot', () => {
            const snap = makeValidSnapshot();
            snap.factorSnapshot = ['ROI guaranteed: 40% (confirmed)'];
            const result = validateActiveScoringSnapshot(snap);
            expect(result.valid).toBe(false);
        });

        it('warns but does not error on EMPTY snapshot', () => {
            const snap = makeValidSnapshot();
            snap.completenessStatus = 'EMPTY';
            snap.alphaScore = 0;
            snap.researchBucket = 'Neutral';
            const result = validateActiveScoringSnapshot(snap);
            // EMPTY alone is not invalid — just a warning
            expect(result.warnings.some(w => w.includes('EMPTY'))).toBe(true);
        });
    });

    // ── buildRawCandidateFromActiveScoringSnapshot ─────────────────────────

    describe('buildRawCandidateFromActiveScoringSnapshot', () => {
        it('maps alphaScore → alphaScore in raw candidate', async () => {
            const mockAnalyzer = jest.fn().mockResolvedValue(makeAnalysisResult({ overallScore: 72 }));
            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', { analyzer: mockAnalyzer });
            const raw = buildRawCandidateFromActiveScoringSnapshot(snap);
            expect(raw.alphaScore).toBe(72);
        });

        it('maps researchBucket → recommendationBucket in raw candidate', async () => {
            const mockAnalyzer = jest.fn().mockResolvedValue(makeAnalysisResult({ recommendation: '偏多' }));
            const snap = await buildActiveScoringSnapshot('2330', '2025-06-01', { analyzer: mockAnalyzer });
            const raw = buildRawCandidateFromActiveScoringSnapshot(snap);
            expect(raw.recommendationBucket).toBe('Strong Candidate');
        });
    });

    // ── computeScoringCompletenessDistribution ───────────────────────────

    describe('computeScoringCompletenessDistribution', () => {
        it('aggregates COMPLETE/PARTIAL/EMPTY counts correctly', async () => {
            const makeSnap = (status: ScoringCompletenessStatus): ActiveScoringSnapshot => ({
                builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
                symbol: 'TEST',
                asOfDate: '2025-01-01',
                scoringMode: ACTIVE_SCORING_MODE,
                scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
                researchBucket: 'Neutral',
                alphaScore: 0,
                scoreSnapshot: { researchScore: 0, confidenceScore: 0, technicalScore: 0, chipScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
                signalSnapshot: [],
                factorSnapshot: [],
                reasonSnapshot: '',
                limitations: [],
                dataCoverage: 'insufficient',
                dataPoints: 0,
                usedSources: [],
                missingSources: [],
                pitGateDate: '2025-01-01',
                scoringAvailable: false,
                completenessStatus: status,
                scoringNote: '',
            });

            const snaps = [
                makeSnap('COMPLETE'),
                makeSnap('COMPLETE'),
                makeSnap('PARTIAL'),
                makeSnap('EMPTY'),
            ];

            const dist = computeScoringCompletenessDistribution(snaps);
            expect(dist.COMPLETE).toBe(2);
            expect(dist.PARTIAL).toBe(1);
            expect(dist.EMPTY).toBe(1);
        });

        it('returns empty counts for empty array', () => {
            const dist = computeScoringCompletenessDistribution([]);
            expect(dist.COMPLETE).toBe(0);
            expect(dist.PARTIAL).toBe(0);
            expect(dist.EMPTY).toBe(0);
        });
    });
});
