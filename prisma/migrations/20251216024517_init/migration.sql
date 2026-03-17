-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "industry" TEXT,
    "listingDate" TEXT,
    "capital" REAL,
    "shares" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockQuote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "tradeValue" REAL NOT NULL,
    "change" REAL NOT NULL,
    "transactions" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockQuote_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMetrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "pe" REAL,
    "pb" REAL,
    "dividendYield" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMetrics_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketIndex" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "change" REAL NOT NULL,
    "changePercent" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "records" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "error" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StockQuote_stockId_idx" ON "StockQuote"("stockId");

-- CreateIndex
CREATE INDEX "StockQuote_date_idx" ON "StockQuote"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StockQuote_stockId_date_key" ON "StockQuote"("stockId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StockMetrics_stockId_date_key" ON "StockMetrics"("stockId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MarketIndex_name_date_key" ON "MarketIndex"("name", "date");
