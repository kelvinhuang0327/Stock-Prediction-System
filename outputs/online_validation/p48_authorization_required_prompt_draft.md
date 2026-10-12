# P48 Authorization Required — Prompt Draft

To proceed with P48, send the following as your **next message** (or include it at the top of the next task prompt):

---

## Authorization Phrase (copy exactly)

```
YES design paper simulation dry-run result artifact golden fixture for P48
```

---

## Suggested Next 24h Task Prompt (after authorization)

```
任務名稱：
P48_PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_GOLDEN_FIXTURE_DESIGN

授權句（必須出現在訊息頂部）：
YES design paper simulation dry-run result artifact golden fixture for P48

背景：
1. P47 已完成：P47_PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_MATERIALIZATION_READY
   - Commit: 7cd6b42
   - Tests: 98/98 PASS
   - P38–P47 regression: 935/935 PASS
   - P47 定義了 result artifact materialization contract
   - 未執行真實 simulation / optimizer / backtest
   - 未產生 PnL / ROI / win-rate

2. P48-AUTH-GATE 已完成：P48_AUTH_GATE_WAITING_FOR_USER_AUTHORIZATION

3. P48 目標：
   設計 Paper Simulation Dry-run Result Artifact Golden Fixture。
   Golden fixture = 代表預期 dry-run result artifact 的確定性測試驗證資料結構。

Phase 0 — Pre-flight
  cd /Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System
  git rev-parse --show-toplevel
  git branch --show-current
  git status --short
  若不是 main / canonical repo → STOP

Phase 1 — Authorization check
  確認訊息頂部包含獨立授權句：
  YES design paper simulation dry-run result artifact golden fixture for P48

Phase 2 — Design golden fixture schema
  - 定義 golden fixture 資料結構（TypeScript type / Zod schema）
  - 涵蓋 P47 result artifact materialization contract 中的所有欄位
  - 確保 deterministic（固定 seed / 固定 input → 固定 output）
  - 不執行真實 simulation
  - 不產生 PnL / ROI / win-rate

Phase 3 — Implement golden fixture files
  新增：src/lib/onlineValidation/p48/goldenFixtures/
  不修改 P47 及以下的 src / test 檔案

Phase 4 — Tests
  新增 P48 test suite
  P38–P47 regression 必須全部 PASS

Phase 5 — Artifacts
  outputs/online_validation/p48_golden_fixture_design.json
  outputs/online_validation/p48_golden_fixture_design.md
  00-StockPlan/online_validation/p48_golden_fixture_design.md

Phase 6 — Validation
  pytest / vitest full suite
  P38–P48 regression PASS

Phase 7 — Commit
  git commit -m "P48: Add paper simulation dry-run result artifact golden fixture design"

禁止：
- 不得執行真實 simulation / optimizer / backtest
- 不得產生 PnL / ROI / win-rate
- 不得修改 P47 及以下已完成的 src / test
- 不得修改 DB / corpus / scoring formula
```

---

## Notes

- Golden fixture は P48 の核心成果物です
- 真實 simulation は行いません（dry-run のみ）
- P47 contract を参照して golden data を設計します
