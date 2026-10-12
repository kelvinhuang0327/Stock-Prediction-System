# P26F4 Agent Controlled Import Runbook

**Version:** P26F4-AGENT-CONTROLLED-IMPORT-RUNBOOK-V1  
**Date:** 2026-05-15  
**Audience:** Agent executing import after operator source files are provided

> **This runbook must not be used to auto-download external data.**  
> **All source files must be placed in the drop-zone by a human operator first.**  
> **No import may occur before dry-run PASS and explicit approval token.**

---

## Step 1: Pre-flight Commands

```bash
# Verify repo state
cd /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
git status --short
git log --oneline -5

# Record baseline sha256 before any action
shasum -a 256 prisma/dev.db
wc -l data/corpus/simulation_snapshot_corpus.jsonl
wc -l data/corpus/p0hardreset_historical_replay_corpus.jsonl
wc -l data/corpus/p1baseline_historical_replay_corpus.jsonl
wc -l data/corpus/p3active_scoring_historical_replay_corpus.jsonl
wc -l data/corpus/p19active_scoring_pit_replay_corpus.jsonl
shasum -a 256 src/lib/analysis/RuleBasedStockAnalyzer.ts
shasum -a 256 src/lib/alpha/SignalFusionEngine.ts
shasum -a 256 src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts
```

Expected: DB and corpus sha256 match pre-import baseline.

---

## Step 2: Drop-zone Scan

```bash
node scripts/run-p26f3-5-dropzone-conditional-scan.js
```

Expected output: `candidateSourceFiles > 0` if operator has placed files.

If `candidateSourceFiles = 0`: **STOP** — operator has not placed files yet.  
Classification: `P26F4_WAITING_FOR_OPERATOR_SOURCE`

---

## Step 3: Inventory

Verify files found by scan:
- Check `outputs/online_validation/p26f3_5_dropzone_scan_result.json`
- Verify filenames match expected pattern: `twse_monthly_revenue_YYYY_MM.csv`
- Verify no `TEMPLATE`, `DO_NOT_IMPORT`, `SYNTHETIC`, `MANIFEST_TEMPLATE` files are listed as candidates

---

## Step 4: Dry-run Gate Commands

```bash
# Run pipeline in dry-run mode (no DB write)
node scripts/run-p26f3-5-pipeline-preflight.js --source=real --no-write

# Or run with real dropzone path if script supports it
```

Dry-run must verify:
- `validator.acceptedRows > 0`
- `validator.rejectedRows` documented (may be > 0 for non-target symbols)
- `coverage.matchedRows > 0`
- `safety.status = PASS`
- `invariance.mismatchedAlphaScoreCount = 0`
- `invariance.mismatchedBucketCount = 0`

---

## Step 5: JSON Validation Commands

```bash
# Validate EXPECTED_SCHEMA compliance
node -e "
const schema = require('./data/manual/monthly-revenue/p26f3-2-dropzone/EXPECTED_SCHEMA.json');
console.log('Required fields:', schema.requiredFields);
console.log('Target symbols:', schema.targetSymbols.length);
console.log('Forbidden fields:', schema.forbiddenFields);
"
```

---

## Step 6: No-write Invariance Commands

```bash
# Verify DB unchanged after dry-run
shasum -a 256 prisma/dev.db

# Verify corpus unchanged
wc -l data/corpus/simulation_snapshot_corpus.jsonl
wc -l data/corpus/p3active_scoring_historical_replay_corpus.jsonl
wc -l data/corpus/p19active_scoring_pit_replay_corpus.jsonl

# Verify scoring files unchanged
shasum -a 256 src/lib/analysis/RuleBasedStockAnalyzer.ts
shasum -a 256 src/lib/alpha/SignalFusionEngine.ts
```

All values must match pre-import baseline. Any mismatch = **ABORT**.

---

## Step 7: Approval Token Check

After dry-run PASS, show operator the results and request approval token.

Expected token (exact, case-sensitive):
```
P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY
```

- If token does not match exactly: **STOP** — do not import
- If token not provided: **STOP** — await operator decision
- Do not prompt operator for token before dry-run PASS

---

## Step 8: DB Backup Procedure

**Execute immediately before import, after token verified:**

```bash
# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp prisma/dev.db "prisma/dev.db.backup_p26f4_${TIMESTAMP}"

# Record backup sha256
shasum -a 256 "prisma/dev.db.backup_p26f4_${TIMESTAMP}"

# Verify backup matches pre-import db
shasum -a 256 prisma/dev.db
# (must match backup sha256)
```

Store backup path in import artifact for rollback reference.

---

## Step 9: Controlled Import Procedure

```bash
# Import historical MonthlyRevenue only
# Token check is embedded in import script
node scripts/run-p26f4-import.js \
  --token=P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY \
  --source-dir=data/manual/monthly-revenue/p26f3-2-dropzone \
  --dry-run=false \
  --no-corpus-expand \
  --no-scoring-change
```

Import constraints:
- Only `MonthlyRevenue` table writes permitted
- No alphaScore/recommendationBucket modification
- No corpus expansion
- Import audit trail must be written to `outputs/online_validation/`

---

## Step 10: Post-import Checks

```bash
# Verify DB now has new rows
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.monthlyRevenue.count().then(n => { console.log('MonthlyRevenue rows:', n); prisma.\$disconnect(); });
"

# Verify releaseDate range
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.monthlyRevenue.findMany({ select: { releaseDate: true }, distinct: ['releaseDate'] })
  .then(r => { console.log('ReleaseDates:', r.map(x => x.releaseDate)); prisma.\$disconnect(); });
"

# Verify corpus still unchanged
wc -l data/corpus/simulation_snapshot_corpus.jsonl
wc -l data/corpus/p3active_scoring_historical_replay_corpus.jsonl

# Verify scoring files unchanged
shasum -a 256 src/lib/analysis/RuleBasedStockAnalyzer.ts
shasum -a 256 src/lib/alpha/SignalFusionEngine.ts
```

---

## Step 11: Rollback / Restore Procedure

If post-import checks fail or unexpected behavior is detected:

```bash
# STOP all further operations immediately
# Restore DB from backup
BACKUP_FILE="prisma/dev.db.backup_p26f4_<TIMESTAMP>"

# Verify backup integrity
shasum -a 256 "${BACKUP_FILE}"
# (must match pre-import sha256)

# Restore
cp "${BACKUP_FILE}" prisma/dev.db

# Verify restore
shasum -a 256 prisma/dev.db
# (must match backup sha256)

# Run tests to confirm no side effects
npx jest src/lib/onlineValidation/__tests__ --no-coverage
```

Document rollback in a `p26f4_rollback_report.md` artifact.

---

## Step 12: Final Classification Mapping

| Condition | Classification |
|-----------|---------------|
| `candidateSourceFiles = 0` | `P26F4_WAITING_FOR_OPERATOR_SOURCE` |
| Dry-run fails validator | `P26F4_DRY_RUN_VALIDATION_FAILED` |
| Dry-run safety gate fails | `P26F4_DRY_RUN_SAFETY_GATE_FAILED` |
| Dry-run invariance fails | `P26F4_DRY_RUN_INVARIANCE_FAILED` |
| Token not provided | `P26F4_AWAITING_APPROVAL_TOKEN` |
| Token mismatch | `P26F4_TOKEN_MISMATCH` |
| Import success, all checks pass | `P26F4_IMPORT_COMPLETE` |
| Rollback executed | `P26F4_ROLLED_BACK` |

---

*This runbook does not authorize autonomous download of external data.*  
*All source files must be human-provided. No investment recommendations are generated.*
