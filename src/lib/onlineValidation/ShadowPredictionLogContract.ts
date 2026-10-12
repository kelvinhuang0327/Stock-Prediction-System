/**
 * P0-02B — Shadow Prediction Log Contract
 *
 * Builds, validates, and sanitizes shadow prediction log entries.
 *
 * IMPORTANT:
 * - research mode only
 * - dry-run only / append-only contract only
 * - no production Prediction row write
 * - no StrategySignal write
 * - no auto trading
 * - no precision prediction claim
 * - no DB write
 * - no external API
 * - no LLM call
 * - no strategy mutation
 * - no performance claim
 * - no edge claim
 */

// ─── Types ────────────────────────────────────────────────────────

export type ShadowLogWriteMode = 'DRY_RUN' | 'APPEND_ONLY_CONTRACT';
export type ValidationStatusValue = 'PASS' | 'WARN' | 'FAIL';
export type TargetHorizonLabel = '5D' | '20D' | '60D';
export type OutcomeStatus = 'PENDING';

export interface TargetHorizon {
    horizonLabel: TargetHorizonLabel;
    outcomeStatus: OutcomeStatus; // always PENDING in this contract
    outcomeWriteBackAllowed: false; // locked to false in dry-run contract
}

export interface SourceDateBasis {
    sourceDate: string; // YYYY-MM-DD — must be <= asOfDate
    sourceType: string; // e.g. 'stockQuote' | 'institutionalChip' | 'monthlyRevenue'
    missingDataFlags: string[];
}

export interface ScoreSnapshot {
    researchScore: number; // sanitized from alphaScore — research ranking only, not performance claim
    confidenceScore: number;
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    marketAdjustment: number;
}

export interface ShadowPredictionLogEntry {
    logVersion: string;
    taskName: string;
    runId: string;
    asOfDate: string; // YYYY-MM-DD
    generatedAt: string; // ISO datetime
    universeTier: string;
    symbol: string;
    stockName: string;
    researchBucket: string; // sanitized from recommendationBucket — research only
    scoreSnapshot: ScoreSnapshot;
    confidenceSnapshot: number;
    factorSnapshot: string[];
    riskSnapshot: string[];
    limitationSnapshot: string[];
    dataCoverageSnapshot: {
        coverage: string;
        usedSources: string[];
        missingSources: string[];
    };
    sourceDateBasis: SourceDateBasis;
    targetHorizons: TargetHorizon[];
    validationStatus: ValidationStatusValue;
    validationMessages: string[];
    guardrailStatus: ValidationStatusValue;
    duplicateKey: string;
    writeMode: ShadowLogWriteMode;
}

export interface ShadowPredictionLogBatch {
    batchVersion: string;
    taskName: string;
    runId: string;
    asOfDate: string;
    generatedAt: string;
    runMode: ShadowLogWriteMode;
    universeTier: string;
    entryCount: number;
    entries: ShadowPredictionLogEntry[];
    batchValidationStatus: ValidationStatusValue;
    batchValidationMessages: string[];
}

export interface ShadowPredictionLogArtifact {
    taskName: string;
    runId: string;
    asOfDate: string;
    generatedAt: string;
    writeMode: ShadowLogWriteMode;
    entryCount: number;
    jsonPayload: ShadowPredictionLogBatch;
    jsonlLines: string[];
    markdownSummary: string;
    validationStatus: ValidationStatusValue;
}

export interface ValidationResult {
    status: ValidationStatusValue;
    messages: string[];
}

/** Raw research candidate input (from StrategyScreenEngine or similar) */
export interface RawResearchCandidate {
    symbol: string;
    name: string;
    alphaScore?: number;          // will be sanitized -> researchScore
    recommendationBucket?: string; // will be sanitized -> researchBucket
    confidence?: number;
    technicalScore?: number;
    chipScore?: number;
    fundamentalScore?: number;
    marketAdjustment?: number;
    factors?: string[];
    topFactors?: string[];
    keyRisks?: string[];
    limitations?: string[];
    dataCoverage?: string;
    usedSources?: string[];
    missingSources?: string[];
    // Any extra fields to be sanitized away
    [key: string]: unknown;
}

export interface SanitizedResearchCandidate {
    symbol: string;
    stockName: string;
    researchBucket: string;
    researchScore: number;
    confidenceScore: number;
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    marketAdjustment: number;
    factors: string[];
    keyRisks: string[];
    limitations: string[];
    dataCoverageSnapshot: {
        coverage: string;
        usedSources: string[];
        missingSources: string[];
    };
}

// ─── Forbidden terms guard ────────────────────────────────────────

const FORBIDDEN_FIELD_NAMES = new Set([
    'buy', 'sell', 'roi', 'win_rate', 'alpha', 'edge', 'profit',
    'outperform', 'guaranteed', 'auto_trading', 'expected_return',
    'predicted_return', 'expected_profit', 'predicted_profit',
    'alphaScore', 'recommendationBucket',
]);

const FORBIDDEN_CLAIM_TERMS = [
    'buy', 'sell', 'roi', 'win_rate', 'alpha', 'edge', 'profit',
    'outperform', 'guaranteed', 'auto trading', 'expected_return',
    'predicted_return', 'expected_profit', 'predicted_profit',
];

function containsForbiddenClaim(value: string): boolean {
    const lower = value.toLowerCase();
    return FORBIDDEN_CLAIM_TERMS.some(t => lower.includes(t));
}

// ─── Utilities ────────────────────────────────────────────────────

function nowIso(): string {
    return new Date().toISOString();
}

function resolveGeneratedAt(generatedAt: string | undefined, asOfDate: string): string {
    if (generatedAt) {
        return generatedAt;
    }
    return `${asOfDate}T00:00:00.000Z`;
}

const DEFAULT_HORIZONS: TargetHorizon[] = [
    { horizonLabel: '5D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
    { horizonLabel: '20D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
];

// ─── Public API ───────────────────────────────────────────────────

/**
 * sanitizeResearchCandidateForShadowLog
 *
 * Converts a raw research candidate (from StrategyScreenEngine) into a
 * shadow-log-safe sanitized form:
 * - alphaScore → researchScore
 * - recommendationBucket → researchBucket
 * - forbidden fields removed
 */
export function sanitizeResearchCandidateForShadowLog(
    raw: RawResearchCandidate,
): SanitizedResearchCandidate {
    const researchScore = typeof raw.alphaScore === 'number' ? raw.alphaScore : 0;
    const researchBucket = sanitizeBucket(raw.recommendationBucket ?? 'Neutral');
    const factors = raw.topFactors ?? raw.factors ?? [];
    const keyRisks = raw.keyRisks ?? [];

    return {
        symbol: raw.symbol,
        stockName: raw.name,
        researchBucket,
        researchScore,
        confidenceScore: typeof raw.confidence === 'number' ? raw.confidence : 0,
        technicalScore: typeof raw.technicalScore === 'number' ? raw.technicalScore : 0,
        chipScore: typeof raw.chipScore === 'number' ? raw.chipScore : 0,
        fundamentalScore: typeof raw.fundamentalScore === 'number' ? raw.fundamentalScore : 0,
        marketAdjustment: typeof raw.marketAdjustment === 'number' ? raw.marketAdjustment : 0,
        factors: factors.filter(f => !containsForbiddenClaim(f)),
        keyRisks: keyRisks.filter(r => !containsForbiddenClaim(r)),
        limitations: (raw.limitations ?? []).filter(l => !containsForbiddenClaim(l)),
        dataCoverageSnapshot: {
            coverage: raw.dataCoverage ?? 'unknown',
            usedSources: raw.usedSources ?? [],
            missingSources: raw.missingSources ?? [],
        },
    };
}

function sanitizeBucket(bucket: string): string {
    const map: Record<string, string> = {
        'Strong Candidate': 'Strong',
        'Watch': 'Watch',
        'Neutral': 'Neutral',
        'Avoid': 'LowPriority',
        'Insufficient Data': 'InsufficientData',
    };
    return map[bucket] ?? bucket;
}

/**
 * buildShadowPredictionLogEntry
 *
 * Creates a single shadow prediction log entry for one research candidate.
 * Does NOT write to DB, external API, or LLM.
 */
export function buildShadowPredictionLogEntry(params: {
    candidate: RawResearchCandidate;
    asOfDate: string;
    runId: string;
    universeTier: string;
    sourceDateBasis: SourceDateBasis;
    targetHorizons?: TargetHorizon[];
    generatedAt?: string;
}): ShadowPredictionLogEntry {
    const {
        candidate,
        asOfDate,
        runId,
        universeTier,
        sourceDateBasis,
        targetHorizons = DEFAULT_HORIZONS,
        generatedAt,
    } = params;
    const resolvedGeneratedAt = resolveGeneratedAt(generatedAt, asOfDate);

    const sanitized = sanitizeResearchCandidateForShadowLog(candidate);

    // Deterministic duplicate key: asOfDate|symbol|universeTier|runId
    const duplicateKey = `${asOfDate}|${sanitized.symbol}|${universeTier}|${runId}`;

    // Force all horizons to PENDING / writeBackAllowed: false
    const safeHorizons: TargetHorizon[] = targetHorizons.map(h => ({
        horizonLabel: h.horizonLabel,
        outcomeStatus: 'PENDING' as OutcomeStatus,
        outcomeWriteBackAllowed: false as const,
    }));

    return {
        logVersion: 'p002b-v1',
        taskName: 'P0-02B',
        runId,
        asOfDate,
        generatedAt: resolvedGeneratedAt,
        universeTier,
        symbol: sanitized.symbol,
        stockName: sanitized.stockName,
        researchBucket: sanitized.researchBucket,
        scoreSnapshot: {
            researchScore: sanitized.researchScore,
            confidenceScore: sanitized.confidenceScore,
            technicalScore: sanitized.technicalScore,
            chipScore: sanitized.chipScore,
            fundamentalScore: sanitized.fundamentalScore,
            marketAdjustment: sanitized.marketAdjustment,
        },
        confidenceSnapshot: sanitized.confidenceScore,
        factorSnapshot: sanitized.factors,
        riskSnapshot: sanitized.keyRisks,
        limitationSnapshot: sanitized.limitations,
        dataCoverageSnapshot: sanitized.dataCoverageSnapshot,
        sourceDateBasis,
        targetHorizons: safeHorizons,
        validationStatus: 'PASS',
        validationMessages: [],
        guardrailStatus: 'PASS',
        duplicateKey,
        writeMode: 'DRY_RUN',
    };
}

/**
 * validateShadowPredictionLogEntry
 *
 * Validates a single shadow prediction log entry.
 * Returns PASS / WARN / FAIL.
 */
export function validateShadowPredictionLogEntry(
    entry: ShadowPredictionLogEntry,
): ValidationResult {
    const messages: string[] = [];

    if (!entry.asOfDate) messages.push('FAIL: asOfDate missing');
    if (!entry.symbol) messages.push('FAIL: symbol missing');
    if (!entry.duplicateKey) messages.push('FAIL: duplicateKey missing');

    // sourceDateBasis sourceDate must be <= asOfDate
    const { sourceDate } = entry.sourceDateBasis;
    if (sourceDate > entry.asOfDate) {
        messages.push(`FAIL: sourceDateBasis.sourceDate ${sourceDate} > asOfDate ${entry.asOfDate}`);
    }

    // All targetHorizons must be PENDING
    for (const h of entry.targetHorizons) {
        if (h.outcomeStatus !== 'PENDING') {
            messages.push(`FAIL: targetHorizon ${h.horizonLabel} outcomeStatus must be PENDING`);
        }
        if (h.outcomeWriteBackAllowed !== false) {
            messages.push(`FAIL: targetHorizon ${h.horizonLabel} outcomeWriteBackAllowed must be false`);
        }
    }

    // writeMode must be safe
    if (entry.writeMode !== 'DRY_RUN' && entry.writeMode !== 'APPEND_ONLY_CONTRACT') {
        messages.push(`FAIL: writeMode must be DRY_RUN or APPEND_ONLY_CONTRACT`);
    }

    // Check forbidden claims in researchBucket and factors
    if (containsForbiddenClaim(entry.researchBucket)) {
        messages.push(`FAIL: researchBucket contains forbidden claim: ${entry.researchBucket}`);
    }
    for (const f of entry.factorSnapshot) {
        if (containsForbiddenClaim(f)) {
            messages.push(`WARN: factorSnapshot contains potentially forbidden term: ${f}`);
        }
    }

    // Check scoreSnapshot field names don't contain forbidden keys
    const scoreKeys = Object.keys(entry.scoreSnapshot);
    for (const k of scoreKeys) {
        if (FORBIDDEN_FIELD_NAMES.has(k)) {
            messages.push(`FAIL: scoreSnapshot field name '${k}' is forbidden`);
        }
    }

    const failCount = messages.filter(m => m.startsWith('FAIL')).length;
    const warnCount = messages.filter(m => m.startsWith('WARN')).length;
    const status: ValidationStatusValue = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

    return { status, messages };
}

/**
 * detectShadowLogDuplicateKey
 *
 * Detects duplicates within a set of existing keys.
 * Returns WARN/FAIL if the key already exists.
 */
export function detectShadowLogDuplicateKey(
    newKey: string,
    existingKeys: string[],
): ValidationResult {
    if (existingKeys.includes(newKey)) {
        return {
            status: 'WARN',
            messages: [`WARN: duplicateKey already exists: ${newKey}`],
        };
    }
    return { status: 'PASS', messages: [] };
}

/**
 * buildShadowPredictionLogBatch
 *
 * Builds a batch of shadow prediction log entries.
 * Does NOT write to DB.
 */
export function buildShadowPredictionLogBatch(params: {
    candidates: RawResearchCandidate[];
    asOfDate: string;
    runId: string;
    universeTier: string;
    sourceDateBasis: SourceDateBasis;
    targetHorizons?: TargetHorizon[];
    maxCandidates?: number;
    runMode?: ShadowLogWriteMode;
    generatedAt?: string;
}): ShadowPredictionLogBatch {
    const {
        candidates,
        asOfDate,
        runId,
        universeTier,
        sourceDateBasis,
        targetHorizons = DEFAULT_HORIZONS,
        maxCandidates,
        runMode = 'DRY_RUN',
        generatedAt,
    } = params;
    const resolvedGeneratedAt = resolveGeneratedAt(generatedAt, asOfDate);

    const limited = maxCandidates ? candidates.slice(0, maxCandidates) : candidates;

    // Deterministic ordering: sort by symbol
    const sorted = [...limited].sort((a, b) => a.symbol.localeCompare(b.symbol));

    const entries: ShadowPredictionLogEntry[] = sorted.map(c =>
        buildShadowPredictionLogEntry({
            candidate: c,
            asOfDate,
            runId,
            universeTier,
            sourceDateBasis,
            targetHorizons,
            generatedAt: resolvedGeneratedAt,
        }),
    );

    const batchValidation = validateShadowPredictionLogBatch({ entries, asOfDate });

    return {
        batchVersion: 'p002b-v1',
        taskName: 'P0-02B',
        runId,
        asOfDate,
        generatedAt: resolvedGeneratedAt,
        runMode,
        universeTier,
        entryCount: entries.length,
        entries,
        batchValidationStatus: batchValidation.status,
        batchValidationMessages: batchValidation.messages,
    };
}

/**
 * validateShadowPredictionLogBatch
 *
 * Validates a batch of shadow prediction log entries.
 */
export function validateShadowPredictionLogBatch(params: {
    entries: ShadowPredictionLogEntry[];
    asOfDate: string;
}): ValidationResult {
    const { entries, asOfDate } = params;
    const messages: string[] = [];

    // Check duplicate keys
    const seen = new Set<string>();
    for (const entry of entries) {
        if (seen.has(entry.duplicateKey)) {
            messages.push(`FAIL: duplicate key detected: ${entry.duplicateKey}`);
        }
        seen.add(entry.duplicateKey);
    }

    // Per-entry validation
    for (const entry of entries) {
        const result = validateShadowPredictionLogEntry(entry);
        if (result.status !== 'PASS') {
            messages.push(...result.messages.map(m => `[${entry.symbol}] ${m}`));
        }
    }

    // Future sourceDate check at batch level
    for (const entry of entries) {
        if (entry.sourceDateBasis.sourceDate > asOfDate) {
            messages.push(`FAIL: [${entry.symbol}] sourceDate ${entry.sourceDateBasis.sourceDate} > asOfDate ${asOfDate}`);
        }
    }

    const failCount = messages.filter(m => m.includes('FAIL')).length;
    const warnCount = messages.filter(m => m.includes('WARN')).length;
    const status: ValidationStatusValue = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

    return { status, messages };
}

/**
 * buildShadowPredictionLogArtifact
 *
 * Builds the full artifact: JSON payload + JSONL preview + markdown summary.
 * Does NOT write to DB or ledger file.
 */
export function buildShadowPredictionLogArtifact(
    batch: ShadowPredictionLogBatch,
): ShadowPredictionLogArtifact {
    const jsonlLines = batch.entries.map(e => JSON.stringify(e));

    const markdownSummary = [
        `# P0-02B Shadow Prediction Log Artifact Preview`,
        ``,
        `**Task:** P0-02B  `,
        `**RunId:** ${batch.runId}  `,
        `**AsOfDate:** ${batch.asOfDate}  `,
        `**WriteMode:** ${batch.runMode}  `,
        `**EntryCount:** ${batch.entryCount}  `,
        `**BatchValidation:** ${batch.batchValidationStatus}  `,
        ``,
        `> research mode only — dry-run only — no production Prediction row write — no StrategySignal write`,
        `> no auto trading — no precision prediction claim — no performance claim — no edge claim`,
        ``,
        `## Entries`,
        ...batch.entries.map(
            e => `- ${e.symbol} (${e.stockName}) | researchBucket: ${e.researchBucket} | researchScore: ${e.scoreSnapshot.researchScore} | asOfDate: ${e.asOfDate}`,
        ),
    ].join('\n');

    const validation = validateShadowPredictionLogBatch({
        entries: batch.entries,
        asOfDate: batch.asOfDate,
    });

    return {
        taskName: 'P0-02B',
        runId: batch.runId,
        asOfDate: batch.asOfDate,
        generatedAt: batch.generatedAt,
        writeMode: batch.runMode,
        entryCount: batch.entryCount,
        jsonPayload: batch,
        jsonlLines,
        markdownSummary,
        validationStatus: validation.status,
    };
}
