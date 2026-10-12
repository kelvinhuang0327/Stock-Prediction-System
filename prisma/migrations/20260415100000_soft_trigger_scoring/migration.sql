-- Soft Trigger Scoring — Execution Layer Redesign
-- Adds triggerScore and tradeMode columns to SimulatedTrade for tiered entry tracking.

-- triggerScore: the computed readiness score (0.0–1.0) at the time of trade creation
ALTER TABLE "SimulatedTrade" ADD COLUMN "triggerScore" REAL;

-- tradeMode: 'shadow' | 'pending' | 'full' — determines sizing and threshold behavior
ALTER TABLE "SimulatedTrade" ADD COLUMN "tradeMode" TEXT;

-- Index on tradeMode for efficient filtering of shadow vs real trades
CREATE INDEX IF NOT EXISTS "SimulatedTrade_tradeMode_idx" ON "SimulatedTrade"("tradeMode");
