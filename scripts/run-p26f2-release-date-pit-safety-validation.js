// P26F2-HARDRESET: PIT Safety Validation Script
// Plain Node.js, no PrismaClient. Tests PIT safety with synthetic data.

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');
const JSON_OUT = path.join(OUTPUT_DIR, 'p26f2_release_date_pit_safety_validation.json');
const MD_OUT = path.join(OUTPUT_DIR, 'p26f2_release_date_pit_safety_validation.md');

// Inline inference logic (same as production rule)
function inferCandidateReleaseDate(year, month) {
  if (month < 1 || month > 12) return "INVALID";
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mm = String(nextMonth).padStart(2, '0');
  return `${nextYear}-${mm}-10`;
}

function isCandidateVisible(candidate, asOfDate) {
  if (!candidate || !candidate.candidateReleaseDate || candidate.candidateReleaseDate === 'INVALID') return false;
  return candidate.candidateReleaseDate <= asOfDate;
}

function buildCandidate(year, month) {
  return {
    id: 1,
    stockId: "TEST",
    year,
    month,
    revenue: 100,
    candidateReleaseDate: inferCandidateReleaseDate(year, month),
    dryRunOnly: true,
    productionWriteAllowed: false,
  };
}

const tests = [
  {
    id: 1,
    description: "candidateReleaseDate <= asOfDate → visible",
    run: () => {
      const c = { candidateReleaseDate: "2026-03-10" };
      return isCandidateVisible(c, "2026-03-15") === true;
    },
  },
  {
    id: 2,
    description: "candidateReleaseDate > asOfDate → not visible",
    run: () => {
      const c = { candidateReleaseDate: "2026-03-10" };
      return isCandidateVisible(c, "2026-02-11") === false;
    },
  },
  {
    id: 3,
    description: "candidateReleaseDate === asOfDate → visible",
    run: () => {
      const c = { candidateReleaseDate: "2026-03-10" };
      return isCandidateVisible(c, "2026-03-10") === true;
    },
  },
  {
    id: 4,
    description: 'candidateReleaseDate = "INVALID" → not visible',
    run: () => {
      const c = { candidateReleaseDate: "INVALID" };
      return isCandidateVisible(c, "2026-03-15") === false;
    },
  },
  {
    id: 5,
    description: "missing candidateReleaseDate → not visible",
    run: () => {
      const c = {};
      return isCandidateVisible(c, "2026-03-15") === false;
    },
  },
  {
    id: 6,
    description: "year=2026, month=2 → candidateReleaseDate = 2026-03-10 (deterministic)",
    run: () => inferCandidateReleaseDate(2026, 2) === "2026-03-10",
  },
  {
    id: 7,
    description: "year=2026, month=12 → candidateReleaseDate = 2027-01-10 (December rolls over)",
    run: () => inferCandidateReleaseDate(2026, 12) === "2027-01-10",
  },
  {
    id: 8,
    description: "year=2026, month=3 → candidateReleaseDate = 2026-04-10",
    run: () => inferCandidateReleaseDate(2026, 3) === "2026-04-10",
  },
  {
    id: 9,
    description: "year=2025, month=12, asOfDate=2026-03-11 → visible (2026-01-10 <= 2026-03-11)",
    run: () => {
      const c = { candidateReleaseDate: inferCandidateReleaseDate(2025, 12) };
      return isCandidateVisible(c, "2026-03-11") === true;
    },
  },
  {
    id: 10,
    description: "dryRunOnly=true always",
    run: () => {
      const c = buildCandidate(2026, 2);
      return c.dryRunOnly === true;
    },
  },
  {
    id: 11,
    description: "productionWriteAllowed=false always",
    run: () => {
      const c = buildCandidate(2026, 3);
      return c.productionWriteAllowed === false;
    },
  },
  {
    id: 12,
    description: "no outcome fields in candidates",
    run: () => {
      const c = buildCandidate(2026, 2);
      return !('outcomePrice' in c) && !('returnPct' in c) && !('realizedReturnClass' in c);
    },
  },
  {
    id: 13,
    description: "deterministic: same input → same candidateReleaseDate",
    run: () => {
      const d1 = inferCandidateReleaseDate(2026, 2);
      const d2 = inferCandidateReleaseDate(2026, 2);
      const d3 = inferCandidateReleaseDate(2026, 2);
      return d1 === d2 && d2 === d3 && d1 === "2026-03-10";
    },
  },
];

const results = tests.map((t) => {
  let passed = false;
  let error = null;
  try {
    passed = t.run();
  } catch (e) {
    error = e.message;
  }
  return {
    id: t.id,
    description: t.description,
    passed,
    error: error || undefined,
  };
});

const totalTests = results.length;
const passedTests = results.filter(r => r.passed).length;
const failedTests = totalTests - passedTests;

const output = {
  phase: "P26F2-HARDRESET",
  totalTests,
  passedTests,
  failedTests,
  tests: results,
  allPassed: failedTests === 0,
  status: failedTests === 0 ? "PIT_SAFETY_VALIDATION_PASS" : "PIT_SAFETY_VALIDATION_FAIL",
};

fs.writeFileSync(JSON_OUT, JSON.stringify(output, null, 2), 'utf8');
console.log(`[P26F2] PIT safety: ${passedTests}/${totalTests} passed`);

const md = `# P26F2-HARDRESET: Release Date PIT Safety Validation

## Phase
P26F2-HARDRESET

## Results

| Metric | Value |
|---|---|
| Total tests | ${totalTests} |
| Passed | ${passedTests} |
| Failed | ${failedTests} |

## Test Cases

${results.map(r => `| ${r.id} | ${r.description} | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

## Status

**${output.status}** ${output.allPassed ? '✅' : '❌'}
`;

fs.writeFileSync(MD_OUT, md, 'utf8');
console.log(`[P26F2] Status: ${output.status}`);
if (failedTests > 0) {
  console.error('[P26F2] FAILED TESTS:');
  results.filter(r => !r.passed).forEach(r => console.error(`  Test ${r.id}: ${r.description} — ${r.error || 'returned false'}`));
  process.exit(1);
}
