-- CTO Decision Fields — StrategyProposal
-- Adds ctoDecision and ctoDecisionReason columns so the CTO review tick
-- can persist decisions (ACCEPTED_FOR_LEARNING, REJECTED_ADJUST_SIGNAL,
-- DEFERRED_REGIME_MISMATCH, REFLECTED_IN_INSIGHT, DUPLICATE, SUPERSEDED)
-- back to proposals and query pending-review proposals (ctoDecision IS NULL).

ALTER TABLE "StrategyProposal" ADD COLUMN "ctoDecision" TEXT;
ALTER TABLE "StrategyProposal" ADD COLUMN "ctoDecisionReason" TEXT;

-- Index for efficient pending-review queries (WHERE ctoDecision IS NULL)
CREATE INDEX IF NOT EXISTS "StrategyProposal_ctoDecision_idx" ON "StrategyProposal"("ctoDecision");
