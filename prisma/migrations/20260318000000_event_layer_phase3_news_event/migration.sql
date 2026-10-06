-- Event Layer Phase 3: persistent NewsEvent storage
CREATE TABLE IF NOT EXISTS "NewsEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "source" TEXT NOT NULL,
  "trustLevel" TEXT NOT NULL,
  "publishedAt" DATETIME NOT NULL,
  "relatedSymbols" TEXT NOT NULL,
  "relatedThemes" TEXT NOT NULL,
  "rawUrl" TEXT,
  "titleHash" TEXT NOT NULL,
  "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NewsEvent_publishedAt_idx" ON "NewsEvent"("publishedAt");
CREATE INDEX IF NOT EXISTS "NewsEvent_titleHash_idx" ON "NewsEvent"("titleHash");
CREATE INDEX IF NOT EXISTS "NewsEvent_source_idx" ON "NewsEvent"("source");
