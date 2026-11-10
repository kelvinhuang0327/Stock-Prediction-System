-- Add persistence for adaptive policy calculations and backlog selection tracking.
ALTER TABLE "CtoBacklogItem" ADD COLUMN "lastSelectedAt" DATETIME;
ALTER TABLE "CtoBacklogItem" ADD COLUMN "selectionCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "AdaptivePolicyState" (
  "id"                    INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "resubmitMergeRate"     REAL NOT NULL,
  "compareApproveRate"    REAL NOT NULL,
  "forceLearningRate"     REAL NOT NULL,
  "overallAcceptRate"     REAL NOT NULL,
  "categoryPriorityBoosts" TEXT NOT NULL,
  "suggestions"           TEXT NOT NULL,
  "policyConfidence"      TEXT NOT NULL,
  "runsAnalyzed"          INTEGER NOT NULL,
  "computedAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdaptivePolicyState_computedAt_idx"
  ON "AdaptivePolicyState"("computedAt");

CREATE TABLE IF NOT EXISTS "ExecutionPolicyState" (
  "id"                       INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "mode"                     TEXT NOT NULL,
  "consecutiveCategory"      TEXT,
  "consecutiveCategoryCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"                DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "PolicyChangeHistory" (
  "id"                       INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "policyKey"                TEXT NOT NULL,
  "changedAt"                DATETIME NOT NULL,
  "changedBy"                TEXT NOT NULL,
  "oldValue"                 TEXT,
  "newValue"                 TEXT NOT NULL,
  "changedFields"            TEXT NOT NULL,
  "reason"                   TEXT,
  "guardrailCount"           INTEGER NOT NULL DEFAULT 0,
  "guardrailSummary"         TEXT,
  "requiresConfirmation"     BOOLEAN NOT NULL DEFAULT false,
  "guardrailDetails"         TEXT,
  "highestGuardrailSeverity" TEXT,
  "metadata"                 TEXT,
  "createdAt"                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "PolicyChangeHistory_policyKey_changedAt_idx"
  ON "PolicyChangeHistory"("policyKey", "changedAt");
CREATE INDEX IF NOT EXISTS "PolicyChangeHistory_changedAt_idx"
  ON "PolicyChangeHistory"("changedAt");
