# P26F4 Next Prompt — When Operator Source Files Are Present

**Use this prompt when:** Operator has placed TWSE/MOPS source files in the drop-zone and filled in `SOURCE_MANIFEST_TEMPLATE.json`.

---

## Next-round Prompt Template

```
你是 Stock Prediction System 的 Senior MonthlyRevenue Import Gate Agent。

任務名稱：
P26F4-IMPORT-GATE — MonthlyRevenue Controlled Import Gate

工作目錄：
/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System

目前狀態：
- Operator has placed source files in data/manual/monthly-revenue/p26f3-2-dropzone/
- SOURCE_MANIFEST_TEMPLATE.json has been filled in by operator
- P26F4 infrastructure complete: validator, inventory, safety gate, invariance check all ready
- Previous classification: P26F4_OPERATOR_SOURCE_PACKET_V2_READY_WAITING_FOR_SOURCE
- No DB write has occurred for 2025-09 ~ 2026-01 period

本輪任務：
1. Record no-write baseline (DB sha256, corpus lines, scoring file sha256)
2. Re-scan drop-zone: confirm candidateSourceFiles > 0
3. Read SOURCE_MANIFEST_TEMPLATE.json (or SOURCE_MANIFEST.json if renamed)
4. Validate manifest: check operatorAttestation fields
5. Run inventory: list all candidate source files
6. Run validator dry-run: acceptedRows, rejectedRows, schema compliance
7. Run coverage preview: matchedRows for P3/P19 symbols
8. Run safety gate: no forbidden fields, sourceName valid
9. Run scoring invariance dry-run: alphaScore/bucket must be 0 mismatch (no DB write)
10. Write dry-run output artifacts
11. If dry-run PASS:
    a. Show operator the dry-run results
    b. Request approval token: P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY
12. If token provided and matches exactly:
    a. Create timestamped DB backup
    b. Run controlled import (MonthlyRevenue only)
    c. Verify post-import row count and releaseDate range
    d. Verify corpus unchanged
    e. Verify scoring files unchanged
    f. Write final import report
13. If dry-run FAILS: write failure report, do NOT import

硬性禁止：
- 不得寫 DB 直到 token 驗證通過
- 不得修改 corpus
- 不得修改 RuleBasedStockAnalyzer / SignalFusionEngine / ActiveScoringSnapshotBuilder
- 不得宣稱 ROI / win-rate / alpha / edge / profit / outperform / buy / sell / guaranteed
- 不得自動下載外部資料
- 不得使用 synthetic fixture 假裝真實 source

期望 Final Classification:
- 若 dry-run PASS + token provided: P26F4_IMPORT_COMPLETE
- 若 dry-run PASS + token not yet provided: P26F4_AWAITING_APPROVAL_TOKEN
- 若 dry-run FAIL: P26F4_DRY_RUN_FAILED
- 若 drop-zone still empty: P26F4_WAITING_FOR_OPERATOR_SOURCE
```

---

## Agent Gate Sequence Reference

```
Step 1: git status --short && git log --oneline -5
Step 2: shasum -a 256 prisma/dev.db (record baseline)
Step 3: node scripts/run-p26f3-5-dropzone-conditional-scan.js
Step 4: Verify candidateSourceFiles > 0 (else STOP)
Step 5: Read SOURCE_MANIFEST_TEMPLATE.json attestation
Step 6: node scripts/run-p26f3-5-pipeline-preflight.js (or dry-run equivalent)
Step 7: Verify: acceptedRows > 0, safety PASS, invariance 0 mismatch
Step 8: Show dry-run output to operator
Step 9: Request token (exact: P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY)
Step 10: Verify token match
Step 11: cp prisma/dev.db prisma/dev.db.backup_p26f4_$(date +%Y%m%d_%H%M%S)
Step 12: node scripts/run-p26f4-import.js --token=<token> --no-corpus-expand
Step 13: Verify DB rows added, corpus unchanged, scoring unchanged
Step 14: Write final report, git commit
```

---

## Invariant Baselines to Verify

| Item | Expected Value |
|------|----------------|
| `prisma/dev.db` SHA256 (pre-import) | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |
| `simulation_snapshot_corpus.jsonl` | 60 lines |
| `p0hardreset_historical_replay_corpus.jsonl` | 4500 lines |
| `p1baseline_historical_replay_corpus.jsonl` | 9900 lines |
| `p3active_scoring_historical_replay_corpus.jsonl` | 4500 lines |
| `p19active_scoring_pit_replay_corpus.jsonl` | 4500 (canonical) |
| `RuleBasedStockAnalyzer.ts` SHA256 | `bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d` |
| `SignalFusionEngine.ts` SHA256 | `b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4` |
| `ActiveScoringSnapshotBuilder.ts` SHA256 | `063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d` |

---

*This prompt artifact is for agent continuity only. No investment recommendations are made.*
