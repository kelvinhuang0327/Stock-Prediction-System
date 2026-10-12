# P1-HARDRESET Pre-flight Audit

Generated: 2026-05-11T11:58:21.424Z
Status: **✅ PASS**

## P0 Artifact Checks

| File | Status |
|------|--------|
| `p0hardreset_universe_audit.json` | ✅ EXISTS |
| `p0hardreset_historical_asofdate_candidates.json` | ✅ EXISTS |
| `p0hardreset_historical_replay_corpus.jsonl` | ✅ EXISTS |
| `p0hardreset_historical_replay_summary.md` | ✅ EXISTS |
| `p0hardreset_corpus_quality_gate_rerun.json` | ✅ EXISTS |
| `p0hardreset_final_report.md` | ✅ EXISTS |

## P0 Corpus Validation

| Check | Value | Threshold | Status |
|-------|-------|-----------|--------|
| Lines | 4500 | ≥ 4500 | ✅ |
| Unique symbols | 25 | ≥ 25 | ✅ |
| Unique asOfDates | 60 | ≥ 60 | ✅ |
| mock-deterministic | 0 | = 0 | ✅ |
| stockQuote.close coverage | 93.42% | ≥ 90% | ✅ |
| Frozen corpus lines | 60 | = 60 | ✅ |

## Conclusion

**All P0 quality gates passed. Proceeding with P1 baseline corpus generation.**

---
*Not investment advice. Research corpus only.*
