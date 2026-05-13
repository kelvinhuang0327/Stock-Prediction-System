# P4-03 Market Regime Schema Proposal

Status: PROPOSAL ONLY - not migrated in this round

## Proposed Prisma Schema

model MarketRegimeResult {
  id                   String   @id @default(cuid())
  date                 DateTime @unique
  regimeLabel          String
  confidence           Float
  taiexClose           Float?
  taiexMa50            Float?
  taiexMa200           Float?
  taiexReturn1d        Float?
  taiexReturn20d       Float?
  taiexVolatility20d   Float?
  marketBreadthProxy   Float?
  evidenceJson         String?
  missingFeaturesJson  String?
  pitSafetyFlagsJson   String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

## Notes

- date is UNIQUE - one regime per trading day
- evidenceJson stores evidence_flags as JSON string
- Do NOT migrate in P4-03 round
- Migrate in T-05 redesign or P4-04 round if DB persistence required
- Estimated migration cost: LOW (new table only)
