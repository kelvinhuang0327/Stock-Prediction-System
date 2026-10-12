# Next Prompt After P29C — Backtest / Simulation Contract

**From:** P29C-HARDRESET
**P29C classification:** `P29C_BACKTEST_SIMULATION_CONTRACT_READY`
**P26F4 state:** `WAITING_FOR_OPERATOR_SOURCE`

---

## Route A — Source still not arrived → P29-D or P30-A

### P29-D — FinancialReport / NewsEvent Drop-zone Scaffold (Axis A)

```
任務名稱：P29D-HARDRESET — FinancialReport / NewsEvent Drop-zone Scaffold

目標：
1. 建立 data/manual/financial-report/p29b-dropzone/ 目錄結構 + README
2. 建立 data/manual/news-event/p29b-dropzone/ 目錄結構 + README
3. 建立 manifest template JSON files
4. 建立 manifest validation utility
5. 不放真實資料；不做 DB write；不改 corpus

Final Classification: P29D_DROPZONE_SCAFFOLD_READY
```

### P30-A — TSC Triage v1 (Infrastructure)

```
任務名稱：P30A-HARDRESET — TSC Full-Clean Triage

目標：
1. 分類現有 tsc --noEmit 錯誤（Next route params / Prisma drift / test typing / onlineValidation debt）
2. 修最低風險最大阻塞子集
3. 目標：data-quality/route.ts + 其他 LOW_RISK 類別清零
4. 不改 scoring / corpus / DB
```

---

## Route B — MonthlyRevenue source arrived

Use: `outputs/online_validation/p26_next_prompt_source_arrival_only.md`

---

## Route C — Ready for paper simulation scaffold

```
任務名稱：P29E-HARDRESET — Paper Simulation Scaffold (Axis B)

目標：
1. 依 P29C backtest contract v1 建立 paper simulation runner
2. 用現有 P3/P19 corpus (read-only) 做 mock simulation run
3. 輸出 p29c-backtest-output-v1 格式 artifacts
4. 驗證 outcome isolation: outcomePrice / returnPct 不進 feature input
5. 不寫 DB；不擴 corpus；不跑 optimizer；不改 scoring

Final Classification: P29E_PAPER_SIMULATION_SCAFFOLD_READY
```

---

## CEO Route D Reminder

P27 housekeeping = deprioritized to P10.
Options in priority order:
1. P29-D Drop-zone scaffold (axis A, operator enablement)
2. P30-A TSC triage (infrastructure, real value)
3. P29-E Paper simulation scaffold (axis B, follow-up to P29C)
4. P26F4 gate (if operator drops MonthlyRevenue source)

*Not investment advice.*
