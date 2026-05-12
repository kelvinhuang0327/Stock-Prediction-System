-- DRAFT: Not applied to production DB.
-- Requires explicit `prisma migrate deploy` approval (productionApplyAllowed=false).
-- P17-HARDRESET: MonthlyRevenue releaseDate PIT gate fields.
--
-- DISCLAIMER: Does not constitute investment advice.
-- Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.

-- AlterTable: add releaseDate PIT gate fields to MonthlyRevenue
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDate" DATETIME;
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateSource" TEXT;
ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateConfidence" TEXT;
