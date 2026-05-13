// P26F3-HARDRESET: Source Acquisition Plan Builder
// DISCLAIMER: Does not constitute investment advice.
// NO DB WRITE. NO EXTERNAL API FETCH. NO CORPUS OVERWRITE. DRY-RUN ONLY.

'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../outputs/online_validation');

const TARGET_SYMBOLS = [
  "0055","00712","00738U","00830","00891","00903",
  "1210","1308","1314","1319","1326","1402","1434",
  "1513","1536","1560","1598","1605","1710","1717",
  "1802","2317","2330","2454","6415",
];

const plan = {
  phase: "P26F3-HARDRESET",
  date: "2026-05-13",
  neededPeriods: ["2025-09","2025-10","2025-11","2025-12","2026-01"],
  neededSymbols: TARGET_SYMBOLS,
  neededSymbolCount: TARGET_SYMBOLS.length,
  requiredOfficialSourceFields: [
    "stockId","year","month","revenue","releaseDate","releaseDateSource"
  ],
  localSourceGaps: {
    periodsWithNoLocalData: ["2025-09","2025-10","2025-11","2025-12","2026-01"],
    symbolsWithNoLocalHistoricalData: TARGET_SYMBOLS.length,
    reason: "DB seeded with 2026-02/03 data only; no historical sync performed",
  },
  officialSourceMapping: {
    source: "TWSE (Taiwan Stock Exchange) / MOPS",
    dataType: "Monthly Revenue (月營收)",
    publicInfoUrl: "https://www.twse.com.tw (reference only — do not fetch without P26F4 approval)",
    releaseSchedule: "Typically released by the 10th of the following month",
    releaseDateVerification: "REQUIRES_MANUAL_VERIFICATION — inferred 10th is not official",
    externalFetchAllowed: false,
    acquisitionRequiresApproval: true,
  },
  candidateReleaseDates: {
    "2025-09": "2025-10-10",
    "2025-10": "2025-11-10",
    "2025-11": "2025-12-10",
    "2025-12": "2026-01-10",
    "2026-01": "2026-02-10",
  },
  acquisitionSteps: [
    "1. CTO/manual approval to acquire historical TWSE MonthlyRevenue data",
    "2. Download TWSE monthly revenue data for 2025-09 to 2026-01 for 25 target symbols",
    "3. Verify actual releaseDate for each period from official source metadata",
    "4. Apply Prisma migration: 20260512000000_monthly_revenue_release_date_pit_draft",
    "5. Import data via P26F4 controlled import approval gate",
    "6. Re-run P26F2/P26F3 coverage preview with real data",
    "7. Confirm PIT safety and scoring invariance post-import",
  ],
  suggestedFutureCommands: [
    "# DO NOT RUN without P26F4 controlled import approval:",
    "# npx prisma migrate deploy",
    "# node scripts/run-p26f4-controlled-historical-import.js --approved",
  ],
  dbImportPrerequisites: [
    "P26F4 controlled import approval gate PASS",
    "prisma migrate deploy: 20260512000000_monthly_revenue_release_date_pit_draft",
    "Manual releaseDate verification for each period",
    "DB backup taken before import",
    "Scoring invariance baseline captured before import",
  ],
  reviewChecklist: [
    "releaseDate verified from official TWSE source (not inferred)",
    "No fabricated revenue data",
    "PIT safety validated before DB import",
    "Scoring invariance confirmed: alphaScore/recommendationBucket unchanged",
    "Frozen corpus (60/4500/9900/4500/4500) unchanged after import",
  ],
  dbWriteAllowed: false,
  corpusOverwriteAllowed: false,
  scoringChangeAllowed: false,
  optimizerAllowed: false,
  externalFetchAllowed: false,
  status: "SOURCE_ACQUISITION_PLAN_COMPLETE",
};

const planJsonPath = path.join(OUT_DIR, 'p26f3_source_acquisition_plan.json');
fs.writeFileSync(planJsonPath, JSON.stringify(plan, null, 2), 'utf8');
console.log(`Written: ${planJsonPath}`);

const planMd = `# P26F3-HARDRESET — Source Acquisition Plan

**Date**: 2026-05-13  
**Status**: SOURCE_ACQUISITION_PLAN_COMPLETE

## Needed Periods
${plan.neededPeriods.map(p => `- ${p} → candidate releaseDate: ${plan.candidateReleaseDates[p]}`).join('\n')}

## Needed Symbols (${TARGET_SYMBOLS.length})
${TARGET_SYMBOLS.join(', ')}

## Official Source
- Source: TWSE (Taiwan Stock Exchange) / MOPS
- Data type: Monthly Revenue (月營收)
- Release schedule: typically by 10th of following month
- Verification: REQUIRES_MANUAL_VERIFICATION
- External fetch allowed: **NO** (requires P26F4 approval)

## Acquisition Steps
${plan.acquisitionSteps.join('\n')}

## DB Import Prerequisites
${plan.dbImportPrerequisites.map(s => `- ${s}`).join('\n')}

## Review Checklist
${plan.reviewChecklist.map(s => `- [ ] ${s}`).join('\n')}

## Constraints
- dbWriteAllowed: false
- corpusOverwriteAllowed: false
- scoringChangeAllowed: false
- optimizerAllowed: false
- externalFetchAllowed: false

**This plan requires P26F4 Controlled Historical MonthlyRevenue Import Approval Gate.**
`;

const planMdPath = path.join(OUT_DIR, 'p26f3_source_acquisition_plan.md');
fs.writeFileSync(planMdPath, planMd, 'utf8');
console.log(`Written: ${planMdPath}`);
console.log('run-p26f3-source-acquisition-plan: COMPLETE');
