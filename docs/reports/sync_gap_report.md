# Sync Gap Report

Generated: 2026-05-04T08:21:28.656632Z

StockQuote row count (dev.db): 0

Latest StockQuote.date: None

Latest StockQuote.createdAt: None

Diagnosis: No StockQuote records found in local dev.db. This blocks data-quality and sync verification steps.

Blocker evidence: dev.db contains 0 StockQuote rows.

Recommended immediate actions to unblock:

1. If running locally, restore a recent DB snapshot or copy production-sync snapshot into dev.db (ensure secrets/personal data policy compliance).

2. Run existing sync scripts (scripts/trigger_syncs.js) against a historical date range to backfill missing quotes. Example: node trigger_syncs.js --symbols <list> --from YYYY-MM-DD --to YYYY-MM-DD

3. Inspect SyncLog table and system scheduler for recent errors.

4. After re-population, re-run price_data_quality.json generation and confirm latest quotes are within 48h.

