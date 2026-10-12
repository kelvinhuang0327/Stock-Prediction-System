# Backtest / Simulation Contract v1

**Version:** p29c-backtest-simulation-contract-v1 | **Paper design** | *Not investment advice*

## Purpose
Define the data contract and PIT constraints for all future backtest/simulation work on axis B.

## Input Contract (required)
`asOfDate, symbol, alphaScore, recommendationBucket, horizon`

## Outcome Isolation Rule
`outcomePrice / returnPct / realizedReturnClass` are **ONLY in the outcome section**. They must **NEVER** appear in `ActiveScoringSnapshot / factorSnapshot / scoreSnapshot / renderer input`.

**Join timing:** outcome fields joined AFTER scoring snapshot is frozen and PIT registry gate passes.

## Evaluation Modes
| Mode | Allowed | Token Required |
| --- | :---: | --- |
| OBSERVABILITY_ONLY | ✅ | None |
| PAPER_ONLY_SIMULATION | 🔒 | `P29C_APPROVE_PAPER_SIMULATION_ONLY` |
| CORPUS_EXPANSION | ❌ blocked | Requires P26F4 import |
| OPTIMIZER | ❌ blocked | Requires corpus expansion + anti-overfit gates |
| PRODUCTION_TRADING | ❌ **PERMANENTLY BLOCKED** | Never allowed |

## PIT Safety Rules
All features queried with `date / releaseDate / publishedAt <= asOfDate`.
See P29A registry for per-source status.

*Observability only. Not investment advice.*
