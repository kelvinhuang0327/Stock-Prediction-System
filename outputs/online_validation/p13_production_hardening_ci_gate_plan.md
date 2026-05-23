# P13 — Production Hardening: CI Gate Plan
**Generated**: 2026-05-23T09:29:23Z
**Classification**: P13_PRODUCTION_HARDENING_PLAN_READY
**Authorized by**: `begin production hardening`
**HEAD at plan creation**: 90b931d (main)

---

## Objective

Define and implement a CI gate that enforces the 5121/5121 test baseline on every
push to `main`. No code that breaks the baseline should be mergeable.

**Baseline to protect**:
- onlineValidation: 4846/4846 PASS, 127 suites
- research + simulation: 275/275 PASS, 8 suites
- Total: 5121/5121 PASS
- DB SHA: a5cf2771... (must not change)
- Test environment: jest-environment-jsdom, `@/*` → `./src/*` alias

---

## Scope Boundaries

### IN SCOPE
- CI workflow YAML (GitHub Actions or equivalent)
- Two parallel test jobs (onlineValidation + research/simulation)
- Dirty-file bleed-through guard (Category D exclusion check)
- Pass/fail gate: merge blocked if any job exits non-zero
- Job timeout configuration (onlineValidation: ~210s; research+sim: ~60s)

### OUT OF SCOPE (hard boundary)
- No DB migrations or schema changes
- No prisma changes
- No scoring / optimizer / real backtest changes
- No data/manual changes
- No champion strategy modifications
- No production deployment configuration

---

## Proposed Workflow Structure

### File: `.github/workflows/test-gate.yml`

```yaml
name: Test Gate — 5121/5121 Baseline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: test-gate-${{ github.ref }}
  cancel-in-progress: true

jobs:

  online-validation:
    name: onlineValidation (4846/4846)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run onlineValidation suite
        run: npx jest src/lib/onlineValidation --no-coverage --forceExit
        env:
          CI: true

  research-simulation:
    name: research + simulation (275/275)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run research suite
        run: npx jest src/lib/research --no-coverage --forceExit
        env:
          CI: true
      - name: Run simulation suite
        run: npx jest src/lib/simulation --no-coverage --forceExit
        env:
          CI: true

  dirty-file-guard:
    name: Dirty-File Bleed-Through Guard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify MUST_NOT_COMMIT patterns absent
        run: |
          # Fail if any MUST_NOT_COMMIT file paths appear in the commit
          git diff --name-only HEAD~1 HEAD | grep -E             "^(logs/|runtime/agent_orchestrator/pids/|data/manual/|prisma/)"             && echo "BOUNDARY_VIOLATION" && exit 1 || echo "BOUNDARY_CLEAN"
```

---

## DB SHA Guard (optional, recommended)

Add a step in `online-validation` job to assert DB SHA has not changed:

```yaml
      - name: Assert DB SHA unchanged
        run: |
          EXPECTED="a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8"
          ACTUAL=$(sha256sum prisma/dev.db 2>/dev/null | awk '{print $1}' || echo "NO_DB")
          if [ "$ACTUAL" != "$EXPECTED" ] && [ "$ACTUAL" != "NO_DB" ]; then
            echo "DB_SHA_MISMATCH: $ACTUAL != $EXPECTED"
            exit 1
          fi
          echo "DB_SHA_OK: $ACTUAL"
```

---

## Acceptance Criteria

| Criterion | Target |
|---|---|
| onlineValidation job passes | 4846/4846 exit 0 |
| research-simulation job passes | 275/275 exit 0 |
| dirty-file guard passes | No MUST_NOT_COMMIT patterns |
| DB SHA guard passes | a5cf2771... unchanged |
| PR merge gate | Blocked on any job failure |
| No new test failures introduced | 5121/5121 ≥ baseline |

---

## Implementation Steps

1. **Draft workflow file** — create `.github/workflows/test-gate.yml`
2. **Local validation** — verify Jest commands match CI invocation
   - Confirm `npx jest src/lib/onlineValidation --no-coverage --forceExit` exits 0 locally
   - Confirm `npx jest src/lib/research src/lib/simulation --no-coverage --forceExit` exits 0 locally
3. **Node version pin** — confirm Node 20 matches local environment (`node --version`)
4. **Timeout tuning** — measure actual suite runtime to set safe margins
   - onlineValidation last known: ~192s → 10 min ceiling is safe
   - research+simulation: ~30s → 5 min ceiling is safe
5. **Branch protection rule** — require both jobs green before merge (GitHub repo settings)
6. **Commit workflow file** — commit message: `P13: add CI test gate for 5121/5121 baseline`
7. **Verify on first PR** — confirm both jobs appear in Checks

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `prisma/dev.db` not present in CI (ephemeral runner) | Medium | SHA guard uses `2>/dev/null` fallback; onlineValidation tests mock DB |
| Node version mismatch CI vs local | Low | Pin Node 20 via `.nvmrc` or `engines` field |
| `npm ci` slower than `npm install` in CI | Low | Acceptable; cache reduces impact |
| onlineValidation timeout on slow runner | Medium | 10 min ceiling; add `--testTimeout=30000` if needed |
| Workflow YAML syntax errors block CI | Low | Validate locally with `act` or GitHub YAML linter |

---

## Status

**Plan**: READY — awaiting explicit `YES create CI gate workflow` to write the file.

Do NOT create `.github/workflows/test-gate.yml` until user authorizes:
```
YES create CI gate workflow
```

---

## Governance Invariants

- entersAlphaScore=false
- paperOnly=true
- dryRunOnly=true
- noRealExecution=true
- DB SHA: a5cf2771... must remain unchanged
- No prisma, migration, or corpus changes
