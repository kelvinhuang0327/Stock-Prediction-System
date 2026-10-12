-- Research Execution Layer — Phase H
-- Adds persistence tables for: experiment runs, signal effectiveness results,
-- walk-forward results, regime stratification results, and parameter versioning.

-- ─── Parameter Version Set ──────────────────────────────────────
-- Tracks which parameter values were active during each research run.

CREATE TABLE IF NOT EXISTS "ResearchParameterSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "version" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "description" TEXT,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ResearchParameterSet_version_key"
    ON "ResearchParameterSet"("version");

-- ─── Experiment Run ─────────────────────────────────────────────
-- One row per experiment execution attempt.

CREATE TABLE IF NOT EXISTS "ExperimentRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "experimentId" TEXT NOT NULL,
    "parameterSetId" INTEGER,
    "status" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "evidenceLevel" TEXT NOT NULL,
    "findings" TEXT,
    "metrics" TEXT,
    "blockers" TEXT,
    "coverageSnapshot" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentRun_parameterSetId_fkey"
        FOREIGN KEY ("parameterSetId") REFERENCES "ResearchParameterSet" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExperimentRun_experimentId_idx"
    ON "ExperimentRun"("experimentId");
CREATE INDEX "ExperimentRun_status_idx"
    ON "ExperimentRun"("status");
CREATE INDEX "ExperimentRun_startedAt_idx"
    ON "ExperimentRun"("startedAt");

-- ─── Signal Effectiveness Result ────────────────────────────────
-- Persists each evaluation of SignalEffectivenessEngine.

CREATE TABLE IF NOT EXISTS "SignalEffectivenessResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "experimentRunId" INTEGER,
    "signalType" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "hitRate" REAL NOT NULL,
    "avgReturn" REAL NOT NULL,
    "excessReturn" REAL NOT NULL,
    "excessHitRate" REAL,
    "volatility" REAL NOT NULL,
    "stabilityScore" REAL NOT NULL,
    "classification" TEXT NOT NULL,
    "brierLikeScore" REAL,
    "regimeBreakdown" TEXT,
    "persistence" TEXT,
    "limitations" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignalEffectivenessResult_experimentRunId_fkey"
        FOREIGN KEY ("experimentRunId") REFERENCES "ExperimentRun" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SignalEffectivenessResult_signalType_idx"
    ON "SignalEffectivenessResult"("signalType");
CREATE INDEX "SignalEffectivenessResult_evaluatedAt_idx"
    ON "SignalEffectivenessResult"("evaluatedAt");
CREATE INDEX "SignalEffectivenessResult_experimentRunId_idx"
    ON "SignalEffectivenessResult"("experimentRunId");

-- ─── Walk-Forward Validation Result ─────────────────────────────
-- Persists each WalkForwardValidator run.

CREATE TABLE IF NOT EXISTS "WalkForwardResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "experimentRunId" INTEGER,
    "signalType" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "hasSufficientData" BOOLEAN NOT NULL,
    "firstHalf" TEXT NOT NULL,
    "secondHalf" TEXT NOT NULL,
    "consistencyLabel" TEXT NOT NULL,
    "hitRateDeviation" REAL NOT NULL,
    "classificationMatch" BOOLEAN NOT NULL,
    "excessReturnSignMatch" BOOLEAN NOT NULL,
    "limitations" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalkForwardResult_experimentRunId_fkey"
        FOREIGN KEY ("experimentRunId") REFERENCES "ExperimentRun" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WalkForwardResult_signalType_idx"
    ON "WalkForwardResult"("signalType");
CREATE INDEX "WalkForwardResult_evaluatedAt_idx"
    ON "WalkForwardResult"("evaluatedAt");

-- ─── Regime Stratification Result ───────────────────────────────
-- Persists each RegimeStratifiedEngine evaluation.

CREATE TABLE IF NOT EXISTS "RegimeStratifiedResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "experimentRunId" INTEGER,
    "signalType" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "overall" TEXT NOT NULL,
    "regimeBreakdown" TEXT NOT NULL,
    "consistencyLabel" TEXT NOT NULL,
    "dominantRegime" TEXT,
    "fragileRegimes" TEXT,
    "unknownRegimeFraction" REAL NOT NULL,
    "hasSufficientRegimeData" BOOLEAN NOT NULL,
    "limitations" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegimeStratifiedResult_experimentRunId_fkey"
        FOREIGN KEY ("experimentRunId") REFERENCES "ExperimentRun" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RegimeStratifiedResult_signalType_idx"
    ON "RegimeStratifiedResult"("signalType");
CREATE INDEX "RegimeStratifiedResult_evaluatedAt_idx"
    ON "RegimeStratifiedResult"("evaluatedAt");
