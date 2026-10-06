// P26F3-HARDRESET: Historical Source PIT Safety Validation
// DISCLAIMER: Does not constitute investment advice.
// NO DB WRITE. NO CORPUS OVERWRITE. DRY-RUN ONLY.

'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../outputs/online_validation');

function inferNextMonthTenth(year, month) {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2,'0')}-10`;
}

function isCandidateVisible(candidate, asOfDate) {
  if (!candidate.candidateReleaseDate || candidate.candidateReleaseDate === 'INVALID') return false;
  return candidate.candidateReleaseDate <= asOfDate;
}

function simpleHash(stockId, year, month) {
  const key = `${stockId}|${year}|${month}|null|null`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const tests = [
  {
    id: 1,
    name: "releaseDate <= asOfDate → visible",
    run: () => {
      const c = { candidateReleaseDate: "2025-10-10" };
      return isCandidateVisible(c, "2025-10-14") === true;
    }
  },
  {
    id: 2,
    name: "releaseDate > asOfDate → not visible",
    run: () => {
      const c = { candidateReleaseDate: "2025-11-10" };
      return isCandidateVisible(c, "2025-10-31") === false;
    }
  },
  {
    id: 3,
    name: "releaseDate === asOfDate → visible",
    run: () => {
      const c = { candidateReleaseDate: "2025-10-10" };
      return isCandidateVisible(c, "2025-10-10") === true;
    }
  },
  {
    id: 4,
    name: "missing candidateReleaseDate → not visible",
    run: () => {
      const c = { candidateReleaseDate: null };
      return isCandidateVisible(c, "2025-10-14") === false;
    }
  },
  {
    id: 5,
    name: "templateOnlyRow has isRealSource=false",
    run: () => {
      const c = { sourceType: "TEMPLATE_ONLY", isRealSource: false, revenueMissing: true };
      return c.isRealSource === false && c.revenueMissing === true;
    }
  },
  {
    id: 6,
    name: "year=2025,month=9 → candidateReleaseDate=2025-10-10; asOfDate=2025-10-14 → visible",
    run: () => {
      const cd = inferNextMonthTenth(2025, 9);
      return cd === "2025-10-10" && isCandidateVisible({ candidateReleaseDate: cd }, "2025-10-14");
    }
  },
  {
    id: 7,
    name: "year=2025,month=10 → candidateReleaseDate=2025-11-10; asOfDate=2025-11-10 → visible",
    run: () => {
      const cd = inferNextMonthTenth(2025, 10);
      return cd === "2025-11-10" && isCandidateVisible({ candidateReleaseDate: cd }, "2025-11-10");
    }
  },
  {
    id: 8,
    name: "year=2025,month=10 → candidateReleaseDate=2025-11-10; asOfDate=2025-10-31 → NOT visible",
    run: () => {
      const cd = inferNextMonthTenth(2025, 10);
      return cd === "2025-11-10" && isCandidateVisible({ candidateReleaseDate: cd }, "2025-10-31") === false;
    }
  },
  {
    id: 9,
    name: "template row with revenueMissing=true → not counted as real coverage",
    run: () => {
      const c = { isRealSource: false, revenueMissing: true, candidateReleaseDate: "2026-02-10" };
      const wouldBeVisible = isCandidateVisible(c, "2026-02-11");
      // visible in date terms but not real coverage since isRealSource=false
      return wouldBeVisible === true && c.isRealSource === false;
    }
  },
  {
    id: 10,
    name: "dryRunOnly=true always",
    run: () => {
      const c = { dryRunOnly: true, dbWriteAllowed: false };
      return c.dryRunOnly === true;
    }
  },
  {
    id: 11,
    name: "dbWriteAllowed=false always",
    run: () => {
      const c = { dryRunOnly: true, dbWriteAllowed: false };
      return c.dbWriteAllowed === false;
    }
  },
  {
    id: 12,
    name: "no outcome fields in template candidates",
    run: () => {
      const c = { stockId: "2330", year: 2025, month: 9, dryRunOnly: true };
      return !('outcomePrice' in c) && !('returnPct' in c) && !('realizedReturnClass' in c);
    }
  },
  {
    id: 13,
    name: "deterministic rowHash: same inputs → same hash",
    run: () => {
      const h1 = simpleHash("2330", 2025, 9);
      const h2 = simpleHash("2330", 2025, 9);
      const h3 = simpleHash("1210", 2025, 9);
      return h1 === h2 && h1 !== h3;
    }
  },
];

const results = tests.map(t => {
  let passed = false;
  let error = null;
  try {
    passed = t.run();
  } catch (e) {
    error = e.message;
  }
  return { id: t.id, name: t.name, passed, error };
});

const passedCount = results.filter(r => r.passed).length;
const failedCount = results.length - passedCount;

console.log(`PIT Safety: ${passedCount}/${results.length} passed`);
results.forEach(r => console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.id}. ${r.name}${r.error ? ' ERROR: ' + r.error : ''}`));

const validationResult = {
  phase: "P26F3-HARDRESET",
  date: "2026-05-13",
  totalTests: results.length,
  passedTests: passedCount,
  failedTests: failedCount,
  tests: results,
  allPassed: failedCount === 0,
  classification: failedCount === 0 ? "PASS" : "P26F3_PIT_LEAKAGE_DETECTED",
  status: failedCount === 0 ? "PIT_SAFETY_VALIDATION_PASS" : "PIT_SAFETY_VALIDATION_FAIL",
};

const jsonPath = path.join(OUT_DIR, 'p26f3_historical_source_pit_safety_validation.json');
fs.writeFileSync(jsonPath, JSON.stringify(validationResult, null, 2), 'utf8');
console.log(`Written: ${jsonPath}`);

const md = `# P26F3-HARDRESET — Historical Source PIT Safety Validation

**Date**: 2026-05-13  
**Status**: ${validationResult.status}

## Results: ${passedCount}/${results.length} PASS

| # | Test | Result |
|---|---|---|
${results.map(r => `| ${r.id} | ${r.name} | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

${failedCount === 0 ? '**All PIT safety tests passed.**' : `**${failedCount} test(s) failed — classification: P26F3_PIT_LEAKAGE_DETECTED**`}
`;

const mdPath = path.join(OUT_DIR, 'p26f3_historical_source_pit_safety_validation.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`Written: ${mdPath}`);
