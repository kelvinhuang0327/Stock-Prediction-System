# P29C — Existing Simulation / Replay Landscape

**Scan method:** codebase + artifact inspection

## Key Existing Modules

| Module | Role | PIT Risk | Contains Outcome | Status |
| --- | --- | --- | :---: | --- |
| BacktestRunner | Core backtest engine | MEDIUM | ✅ | Not formally contracted |
| WalkForwardEngine | Walk-forward validation | MEDIUM | ✅ | Not formally contracted |
| PitSafeLedgerReplayEngine | PIT-safe ledger replay | LOW | ❌ | Exists, PIT-safe |
| RealPriceOutcomeResolver | Entry+outcome price resolution | LOW | ✅ | Outcome isolated |
| SimulationSnapshotCorpusAccumulator | corpus builder | LOW | ❌ | Frozen corpus |
| OutcomeBackfillCandidateSelector | Outcome candidate selection | LOW | ✅ (output only) | Outcome isolated |
| SimulationExecutionEngine | Autonomous simulation | MEDIUM | ❌ | Has known issues |

## Simulation Corpus State
- `simulation_snapshot_corpus.jsonl`: **60 entries, 2 symbols, qualityStatus=BLOCKED**
- Not optimizer-ready (needs real MonthlyRevenue source + corpus expansion)

## Key Gaps P29C Fills
1. No unified simulation contract (P29C adds it)
2. No outcome isolation contract (P29C adds it)
3. No corpus expansion gate spec (P29C adds it)
4. BacktestRunner not wired to PIT registry (P29C defines the requirement)

*Observability only. Not investment advice.*
