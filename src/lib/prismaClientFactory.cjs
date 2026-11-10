/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');

function createPrismaClient(options = {}) {
  const adapter = new PrismaBetterSqlite3(
    { url: process.env.DATABASE_URL || 'file:./prisma/dev.db' },
    { timestampFormat: 'unixepoch-ms' },
  );

  return new PrismaClient({ ...options, adapter });
}

module.exports = { createPrismaClient };
