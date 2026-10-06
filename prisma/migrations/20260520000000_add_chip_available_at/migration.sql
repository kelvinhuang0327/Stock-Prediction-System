-- P30: Add availableAt to InstitutionalChip for PIT (point-in-time) tracking.
-- DISCLAIMER: Does not constitute investment advice.
-- Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
-- InstitutionalChip.entersAlphaScore = false (always).
-- DRAFT: Not applied to production DB.
-- Requires explicit `prisma migrate deploy` approval.

-- AlterTable: add availableAt PIT field to InstitutionalChip
ALTER TABLE "InstitutionalChip" ADD COLUMN "availableAt" DATETIME;

-- CreateIndex: index on availableAt for PIT range queries
CREATE INDEX "InstitutionalChip_availableAt_idx" ON "InstitutionalChip"("availableAt");
