# P147 CI-only JobAlert Rootpage Mismatch Isolation Report

## 1) Repo / branch / start HEAD / end HEAD
- Repo: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
- Branch: main
- Start HEAD: 2fc6588
- End HEAD (before P147 commit): 2fc6588

## 2) Lane objective / strict scope
Objective:
- CI-only evidence collection for JobAlert rootpage mismatch and dev-db mismatch isolation.
- Produce report/json artifacts and a P148 single-lane prompt.

Strict exclusions enforced:
- No code changes.
- No schema changes.
- No migration changes.
- No db repair/rebuild.
- No SystemSetting/UI expectation/LLM audit/Notification behavior fix work.

## 3) Phase 0 actual-state verification
Commands executed:
- `pwd`
- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git rev-parse --short HEAD`
- `git status --short --untracked-files=all`
- `git log --oneline -12`

Results:
- Canonical repo matched.
- Branch matched (`main`).
- HEAD matched expected baseline (`2fc6588`).
- Existing unrelated dirty/untracked files were left untouched.

## 4) P146 artifact precondition check
Verified present and tracked:
- `outputs/online_validation/p146_jobalert_rootpage_schema_devdb_integrity_report.md`
- `outputs/online_validation/p146_jobalert_rootpage_schema_devdb_integrity.json`

Result:
- Precondition PASS.

## 5) Latest completed CI attribution target
Latest completed CI run on main at execution time:
- Run ID: `26739064464`
- Workflow: `CI`
- Head SHA: `2fc65889b9ecf2706befd94028f739454f006288`
- Status/Conclusion: `completed` / `failure`
- URL: https://github.com/kelvinhuang0327/Stock-Prediction-System/actions/runs/26739064464

## 6) CI failing jobs/steps evidence
From run `26739064464`:
- `test-node` (job `78798496151`) failed at `Run Jest tests`
- `test-python` (job `78798496167`) failed at `Run Python tests`
- `lint` (job `78798496173`) failed at `Run ESLint`

`build` and `e2e` were skipped due upstream failure.

## 7) CI rootpage signature evidence (test-node)
Failed log extracted from job `78798496151`.

Representative evidence:
- Repeated Prisma connector query errors:
  - `malformed database schema (JobAlert) - invalid rootpage`
- JobAlert family failure points include:
  - `FAIL src/lib/jobs/__tests__/AutonomousAlertService.test.ts`
  - `FAIL src/lib/jobs/__tests__/JobAlertHistoryService.test.ts`
  - `Invalid prisma.jobAlert.deleteMany() invocation`
- Recommendation family failure points include:
  - `FAIL src/lib/jobs/__tests__/RecommendationTrendService.test.ts`
  - `Invalid prisma.recommendationHistory.deleteMany() invocation`

Interpretation:
- CI still reproduces the same JobAlert-rootpage failure signature and propagates into both delegate families.

## 8) CI python lane correlation evidence (test-python)
Failed log extracted from job `78798496167`.

Representative evidence:
- Multiple failures with:
  - `sqlite3.DatabaseError: malformed database schema (JobAlert) - invalid rootpage`
- Affected tests include:
  - `tests/test_stock_signal_coverage_audit.py::TestAuditScriptExecutable::test_run_audit_callable_dry_run`
  - `tests/test_survivorship_filter.py::test_basic_filtering`
  - `tests/test_survivorship_filter.py::test_period_validation`
  - `tests/test_survivorship_filter.py::test_date_format_handling`

Interpretation:
- Python lane shares the same rootpage signal in CI, not only node/prisma lane.

## 9) CI lint baseline evidence (non-lane but active)
Failed log extracted from job `78798496173`.

Summary line:
- `✖ 696 problems (368 errors, 328 warnings)`

Interpretation:
- Lint debt remains active but is out of P147 repair scope.

## 10) Workflow DB-preparation and ordering analysis
Inspected `.github/workflows/ci.yml`:
- `test-node` sets `DATABASE_URL=file:./dev.db` and runs `npm run test:coverage`.
- `test-python` runs pytest without a DB prep step.
- No explicit CI step for:
  - `prisma generate`
  - `prisma migrate deploy`
  - `prisma db push`
  - sqlite integrity precheck
- Job ordering:
  - `test-node` and `test-python` run independently (no `needs` relationship between them).

Interpretation:
- CI currently consumes repository DB artifacts directly without explicit preparation/alignment checks.

## 11) Local DB artifact and metadata evidence (read-only)
Commands:
- `git ls-files -s prisma/dev.db prisma/dev.db-wal prisma/dev.db-shm prisma/schema.prisma`
- `git status --short --untracked-files=all prisma`
- `shasum -a 256 prisma/dev.db`
- `ls -lh prisma/dev.db prisma/dev.db-wal prisma/dev.db-shm`
- sqlite checks (`integrity_check`, `sqlite_master`, `table_info`, `foreign_key_check`)

Key outputs:
- `prisma/dev.db` tracked blob id: `e0c06f4c60d11ec8b2f3cbc9cdeb9ae8cec76161`
- `prisma/dev.db` sha256: `2b021894fa22cd3b6a8911dcfd544c36f836848cf51e6baee17349f9420153f7`
- File sizes observed:
  - `prisma/dev.db` ~54M
  - `prisma/dev.db-wal` ~459K
  - `prisma/dev.db-shm` ~32K
- `PRAGMA integrity_check;` => `ok`
- Rootpages observed locally:
  - `JobAlert|13756`
  - `RecommendationHistory|13761`
  - `Stock|2`
- `PRAGMA table_info('JobAlert')` returned expected columns.
- `PRAGMA foreign_key_check` returned no violations.

Interpretation:
- Local artifact snapshot appears structurally healthy under read-only diagnostics.

## 12) Prisma delegate existence check (read-only)
Command:
- `node -e "const {PrismaClient}=require('@prisma/client'); ..."`

Result:
- `delegates true true`

Interpretation:
- Generated client exposes both `jobAlert` and `recommendationHistory` delegates locally.

## 13) Representative local observation tests (read-only)
Executed:
- `DATABASE_URL=file:./dev.db npx jest src/lib/jobs/__tests__/JobAlertService.test.ts --no-coverage`
- `DATABASE_URL=file:./dev.db npx jest src/lib/jobs/__tests__/JobAlertHistoryService.test.ts --no-coverage`
- `DATABASE_URL=file:./dev.db npx jest src/lib/jobs/__tests__/AutonomousAlertService.test.ts --no-coverage`

Results:
- `JobAlertService`: FAIL (semantic assertion mismatch: expected summary.total > 0, got 0)
- `JobAlertHistoryService`: FAIL (semantic assertion mismatch: expected summary.total = 4, got 0)
- `AutonomousAlertService`: FAIL (semantic assertion mismatch: expected no alerts, received critical training alerts)
- No local `invalid rootpage` signature from these three tests.

Interpretation:
- Local lane still shows semantic/data expectation failures, not CI rootpage corruption signature, reinforcing CI-vs-local mismatch.

## 14) CI-vs-local mismatch isolation statement
Observed mismatch:
- CI (`26739064464`) reproducibly reports `malformed database schema (JobAlert) - invalid rootpage` across node and python lanes.
- Local read-only diagnostics report integrity `ok`, valid table metadata, delegates present, and representative tests fail semantically instead of rootpage.

Minimum evidence-based hypothesis:
- CI DB preparation/consumption path for repository DB artifacts is misaligned with local assumptions (artifact state/check ordering), causing CI-only rootpage manifestation.

## 15) Files changed in P147
Only evidence artifacts created:
- `outputs/online_validation/p147_ci_only_jobalert_rootpage_mismatch_report.md`
- `outputs/online_validation/p147_ci_only_jobalert_rootpage_mismatch.json`

No product code/schema/db/migration files modified.

## 16) Whether P2 browser review is allowed
- Not allowed (CI remains failing and rootpage mismatch unresolved).

## 17) Final Classification
- **P147_RECOMMEND_CI_DB_PREPARATION_ALIGNMENT_LANE**

## 18) Next 24H Prompt for P148 Single-Lane Execution
```text
[Stock P148 Single-Lane Prompt] — CI DB Preparation Alignment for JobAlert Rootpage

Canonical Repo: /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
Canonical Branch: main
Expected Baseline Commit: <latest main after P147 artifacts commit>
Previous Classification: P147_RECOMMEND_CI_DB_PREPARATION_ALIGNMENT_LANE

Objective:
- Isolate and align CI database preparation/consumption path so that JobAlert invalid-rootpage defect can be deterministically reproduced and then eliminated without touching non-DB lanes.

Strict scope:
- Only CI DB preparation alignment work in `.github/workflows/ci.yml` and strictly related CI harness checks.
- Add read-only integrity instrumentation and deterministic DB prep ordering checks.
- Do NOT modify product behavior, SystemSetting/UI/LLM/Notification logic, or lint-debt clusters.

Required evidence:
1) Explicit DB artifact source and path checks in both test-node and test-python jobs.
2) Pre-test sqlite integrity/rootpage instrumentation in CI logs.
3) Deterministic ordering or gating that removes ambiguous DB state assumptions.
4) Before/after CI log comparison showing whether rootpage signature persists.

Exit condition:
- Either (A) CI rootpage signature eliminated with narrow CI-prep alignment, or
- (B) hard evidence proving corruption is already present at checkout artifact state, with clear handoff to artifact-source lane.
```

---

## Required Completion Check
1. 是否真的完成
- 是（完成 P147 所要求之 CI-only evidence/report 產出，且未做 code/schema/db 修復）

2. 測試結果 PASS / FAIL / NOT RUN
- CI run `26739064464`: FAIL (`test-node`, `test-python`, `lint`)
- Local representative tests:
  - JobAlertService: FAIL (semantic)
  - JobAlertHistoryService: FAIL (semantic)
  - AutonomousAlertService: FAIL (semantic)
- 本輪未執行修復性測試（遵守 read-only lane）

3. 仍卡住的唯一問題
- CI-only `JobAlert invalid rootpage` failure persists while local diagnostics remain structurally healthy, indicating CI DB preparation/consumption mismatch.

4. 修改檔案清單
- `outputs/online_validation/p147_ci_only_jobalert_rootpage_mismatch_report.md`
- `outputs/online_validation/p147_ci_only_jobalert_rootpage_mismatch.json`

5. staged / commit / push 狀態
- Pending (to be performed after artifact creation validation)

6. CI 結果
- Latest completed attribution run: `26739064464` => failure

7. 是否允許進入下一輪 P2 browser review
- 否

8. Final Classification
- P147_RECOMMEND_CI_DB_PREPARATION_ALIGNMENT_LANE
