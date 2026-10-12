# Artifact Index V2

> **Version:** 2 | **Supersedes:** ARTIFACT_INDEX.md  
> **Generated:** 2026-05-18 UTC  
> **Task:** P27-OVERNIGHT-GOVERNANCE-DEEP-AUDIT-HARDRESET

---

## 1. Current System State

| Key | Value |
|-----|-------|
| P26A | COMPLETE |
| P26F4 | WAITING_FOR_OPERATOR_SOURCE |
| P27 | NON_SOURCE_GOVERNANCE_READY |
| candidateSourceFiles | 0 |
| Import | BLOCKED |
| Corpus Expansion | BLOCKED |
| Optimizer | BLOCKED |
| DB Write | BLOCKED |

---

## 2. Canonical Reports

| Phase | Report | Commit | Status |
|-------|--------|--------|--------|
| P26A Renderer Fix | p26a_renderer_fix_final_report.md | 3411614 | COMPLETE |
| P26A Integration | p26a_renderer_integration_final_report.md | a0145fa | COMPLETE |
| P26A Batch Wiring | p26a_batch_pipeline_wiring_final_report.md | ba39187 | COMPLETE |
| P26F4 Readiness | p26f4_readiness_recheck_final_report.md | 12dcb27 | COMPLETE |
| P26F4 Operator Packet | p26f4_operator_source_packet_v2_final_report.md | c0f4713 | COMPLETE |
| P26F4 Source Gate | p26f4_source_present_gate_final_report.md | 59fe20a | COMPLETE |
| P26F4 Waiting Governance | p26f4_waiting_state_governance_final_report.md | c4227c0 | COMPLETE |
| P27 Non-source Gov. | p27_non_source_governance_final_report.md | ea5ee51 | COMPLETE |
| P27 Index Consistency | p27_artifact_index_consistency_final_report.md | 8b4ff9c | COMPLETE |
| P27 Overnight Audit | p27_overnight_deep_audit_final_report.md | PENDING | IN_PROGRESS |

---

## 3. Canonical Next Prompts

| Condition | Prompt File |
|-----------|-------------|
| **Source arrived** (operator confirms) | `p26_next_prompt_source_arrival_only.md` |
| **Source not arrived** | P27 Tier A  `p27_non_source_governance_backlog.json` |backlog 
| **After overnight audit** | `p27_next_prompt_after_overnight_audit.md` |

---

## 4. Superseded / Historical Prompts

| File | Status | Reason |
|------|--------|--------|
| p26f4_next_prompt_when_source_present.md | SUPERSEDED | Replaced by `p26_next_prompt_source_arrival_only.md` |
| p26f4_or_p26a_followup_final_report.md | HISTORICAL | Route-decision artifact |
| p26f4_or_p26a_followup_preflight.json | HISTORICAL | Route-decision artifact |
| p26f4_or_p26a_route_decision.json | HISTORICAL | Route-decision artifact |

---

## 5. Canonical Corpus Status

| Corpus | Lines | Status |
|--------|-------|--------|
| simulation_snapshot_corpus.jsonl | 60 | FROZEN |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | FROZEN |
| p1baseline_historical_replay_corpus.jsonl | 9900 | FROZEN |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | FROZEN |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 (4499 physical) | FROZEN |

---

## 6. Guard Artifacts

| Artifact | Status |
|----------|--------|
| p26f4_waiting_state_freeze_marker.json | currentState = P26F4_WAITING_FOR_OPERATOR_SOURCE |
| p26_phase_chain_registry.json | Present |
| p27_waiting_state_ci_guard_proposal.json | Present |
| p27_waiting_state_policy_guard.test.ts | 18/18 PASS |
| p27_artifact_index_consistency.test.ts | 11/11 PASS |

---

## 7. Warnings

- Two next_prompt files for source- use canonical `p26_next_prompt_source_arrival_only.md`arrival 
- 50 artifacts missing json/md pairs (pre-dates pair  INFO onlyconvention) 
- 385 WARNING-risk items (historical reports with disclaimer-context forbidden-claim-candidate text)

---

## 8. Overnight Audit Results

| Part | Result |
|------|--------|
| Inventory v2 | 1124 files scanned |
| JSON integrity | 315 valid, 0 invalid |
| JSONL integrity | 13 files, all clean |
| Contradiction scan | 0 blockers, 1 warning |
| Test matrix | 2885/2885 PASS |
| Invariance | PASS (all hashes unchanged) |
| Forbidden claims | CLEAN |

---

*Observability only. No investment recommendations.*
