# P29C Backtest Output Schema Draft

**Schema:** `p29c-backtest-output-v1` | **Paper design** | *Not investment advice*

Key constraint: `outcome` section (outcomePrice / returnPct / realizedReturnClass) is **separate** from feature input.
`leakageControls.featuresFrozenBeforeOutcomeJoin = true` is always required.
`mode = "paper_only"` throughout P29C.
