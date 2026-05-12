# P13-HARDRESET: MonthlyRevenue Preflight Audit

> Disclaimer: Observability only. No investment recommendations. No ROI/win-rate/alpha claims.

**Status:** PASS  
**Generated:** 2026-05-12T03:19:39.132Z

## P12 Artifact Checks
- OK: `outputs/online_validation/p12pit_feature_contract_v0.json`
- OK: `outputs/online_validation/p12pit_feature_contract_v0.md`
- OK: `outputs/online_validation/p12pit_feature_contract_validation.json`
- OK: `outputs/online_validation/p12pit_feature_contract_final_report.md`
- OK: `outputs/online_validation/p12pit_feature_source_discovery.json`

## P12 Contract Checks
- PASS: contractVersion = p12-pit-feature-contract-v0
- PASS: MonthlyRevenue.pitRiskLevel = HIGH
- PASS: MonthlyRevenue.repairNeeded = true
- PASS: P3 validationStatus = PASS

## Frozen Corpus Checks
- PASS: simulation_snapshot_corpus.jsonl = 60/60
- PASS: p0hardreset_historical_replay_corpus.jsonl = 4500/4500
- PASS: p1baseline_historical_replay_corpus.jsonl = 9900/9900
- PASS: p3active_scoring_historical_replay_corpus.jsonl = 4500/4500

## MonthlyRevenue Schema Fields
```
model MonthlyRevenue {
  id        Int      @id @default(autoincrement())
  stockId   String
  year      Int
  month     Int
  revenue   Float
  yoyGrowth Float? // YoY %
  momGrowth Float? // MoM %
  createdAt DateTime @default(now())

  stock Stock @relation(fields: [stockId], references: [id])

  @@unique([stockId, year, month])
}
```

- releaseDate field: ❌ MISSING
- announcementDate field: ❌ MISSING
- year/month ints: ✅ PRESENT
- createdAt: ✅

## PIT Risk Assessment
- Current gate type: **YEAR_MONTH_PERIOD_GATE**
- releaseDate field: **MISSING**
- PIT risk level: **HIGH**
- Risk reason: Gates by reporting period (year <= asOfYear AND month <= asOfMonth). Taiwan monthly revenue released ~10th of following month. Pre-10th queries may include unreleased data.
- FundamentalResearchService missing asOf gate: **true**

## Final Classification
**P13_MONTHLY_REVENUE_PREFLIGHT_PASS**
