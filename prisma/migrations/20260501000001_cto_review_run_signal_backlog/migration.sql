-- CTO Review Run, Intent Signal, and Backlog Item tables
-- These models support the CTO review tick workflow:
--   CtoReviewRun      — persists each review run and its summary
--   CtoIntentSignal   — records per-run intent outcome signals
--   CtoBacklogItem    — priority-scored backlog of issues to address

-- CtoReviewRun
CREATE TABLE IF NOT EXISTS "CtoReviewRun" (
  "id"              INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "runId"           TEXT NOT NULL,
  "frequencyMode"   TEXT NOT NULL,
  "startedAt"       DATETIME NOT NULL,
  "completedAt"     DATETIME NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "candidateCount"  INTEGER NOT NULL,
  "acceptedCount"   INTEGER NOT NULL,
  "rejectedCount"   INTEGER NOT NULL,
  "deferredCount"   INTEGER NOT NULL,
  "reflectedCount"  INTEGER NOT NULL,
  "summary"         TEXT NOT NULL,
  "reportJson"      TEXT NOT NULL,
  "isManual"        BOOLEAN NOT NULL,
  "runIntent"       TEXT,
  "parentRunId"     TEXT,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CtoReviewRun_runId_key" ON "CtoReviewRun"("runId");
CREATE INDEX IF NOT EXISTS "CtoReviewRun_createdAt_idx" ON "CtoReviewRun"("createdAt");

-- CtoIntentSignal
CREATE TABLE IF NOT EXISTS "CtoIntentSignal" (
  "id"             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "runId"          TEXT NOT NULL,
  "runIntent"      TEXT NOT NULL,
  "outcome"        TEXT NOT NULL,
  "candidateCount" INTEGER NOT NULL,
  "acceptedCount"  INTEGER NOT NULL,
  "rejectedCount"  INTEGER NOT NULL,
  "deferredCount"  INTEGER NOT NULL,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CtoIntentSignal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CtoReviewRun"("runId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CtoIntentSignal_runId_idx" ON "CtoIntentSignal"("runId");

-- CtoBacklogItem
CREATE TABLE IF NOT EXISTS "CtoBacklogItem" (
  "id"              INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "findingId"       TEXT NOT NULL,
  "ctoRunId"        TEXT,
  "source"          TEXT NOT NULL,
  "severity"        TEXT NOT NULL,
  "impactScore"     REAL NOT NULL,
  "urgency"         TEXT NOT NULL,
  "category"        TEXT NOT NULL,
  "suggestedAction" TEXT,
  "proposalId"      INTEGER,
  "status"          TEXT NOT NULL DEFAULT 'open',
  "priorityScore"   REAL NOT NULL,
  "priorityLevel"   TEXT NOT NULL,
  "agingBonus"      INTEGER NOT NULL DEFAULT 0,
  "rank"            INTEGER,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "CtoBacklogItem_findingId_key" ON "CtoBacklogItem"("findingId");
CREATE INDEX IF NOT EXISTS "CtoBacklogItem_status_idx" ON "CtoBacklogItem"("status");
CREATE INDEX IF NOT EXISTS "CtoBacklogItem_priorityScore_idx" ON "CtoBacklogItem"("priorityScore");
CREATE INDEX IF NOT EXISTS "CtoBacklogItem_ctoRunId_idx" ON "CtoBacklogItem"("ctoRunId");
