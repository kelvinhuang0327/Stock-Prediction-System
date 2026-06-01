-- P144 authorized schema/db lane: add Prisma delegates for JobAlert and RecommendationHistory only.

CREATE TABLE IF NOT EXISTS "JobAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "firstDetectedAt" DATETIME NOT NULL,
    "lastDetectedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "latestJobRunLogId" INTEGER,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobAlert_alertKey_key" ON "JobAlert"("alertKey");
CREATE INDEX IF NOT EXISTS "JobAlert_jobName_status_idx" ON "JobAlert"("jobName", "status");
CREATE INDEX IF NOT EXISTS "JobAlert_status_lastDetectedAt_idx" ON "JobAlert"("status", "lastDetectedAt");
CREATE INDEX IF NOT EXISTS "JobAlert_latestJobRunLogId_idx" ON "JobAlert"("latestJobRunLogId");

CREATE TABLE IF NOT EXISTS "RecommendationHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recommendationKey" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "targetJob" TEXT NOT NULL,
    "targetFamily" TEXT,
    "severity" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "firstDetectedAt" DATETIME NOT NULL,
    "lastDetectedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecommendationHistory_recommendationKey_key" ON "RecommendationHistory"("recommendationKey");
CREATE INDEX IF NOT EXISTS "RecommendationHistory_targetJob_status_idx" ON "RecommendationHistory"("targetJob", "status");
CREATE INDEX IF NOT EXISTS "RecommendationHistory_recommendationType_status_idx" ON "RecommendationHistory"("recommendationType", "status");
CREATE INDEX IF NOT EXISTS "RecommendationHistory_status_lastDetectedAt_idx" ON "RecommendationHistory"("status", "lastDetectedAt");
