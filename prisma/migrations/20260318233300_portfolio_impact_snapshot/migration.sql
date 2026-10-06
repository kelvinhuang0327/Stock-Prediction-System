-- CreateTable
CREATE TABLE "PortfolioImpactSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotDate" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "symbols" TEXT,
    "themeConcentration" TEXT,
    "sectorConcentration" TEXT,
    "riskClusters" TEXT,
    "regimeExposure" TEXT,
    "summary" TEXT,
    "limitations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioImpactSnapshot_snapshotDate_scope_key" ON "PortfolioImpactSnapshot"("snapshotDate", "scope");

-- CreateIndex
CREATE INDEX "PortfolioImpactSnapshot_scope_snapshotDate_idx" ON "PortfolioImpactSnapshot"("scope", "snapshotDate");
