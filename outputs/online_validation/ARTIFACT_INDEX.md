# Canonical Artifact  outputs/online_validationIndex 

**Generated:** 2026-05-18  
**Maintained by:** P27-ARTIFACT-INDEX-CONSISTENCY-HARDRESET

---

## 1. Current State

| Phase | Status |
|-------|--------|
| P26A | **COMPLETE** (commit ba39187) |
| P26F4 | **WAITING_FOR_OPERATOR_SOURCE** (candidateSourceFiles = 0) |
| P27 | **NON_SOURCE_GOVERNANCE_READY** (commit ea5ee51) |
| P28 reason underoutput track | **CLOSED** (P28A→P28E; renderer v2; closure marker present) |
| DB write | BLOCKED — no write since baseline |
| Corpus expansion | BLOCKED — all 5 corpora frozen |
| Optimizer | BLOCKED — requires P26F4 import first |
| Next axis-A round | **P29-A PIT-safe Feature Availability Registry v1** (paper design; CEO Route D mandate) |

---

## 2. Canonical Latest Reports

| Phase | Canonical Report |
|-------|-----------------|
|  Renderer Fix | p26a_renderer_fix_final_report.md |P26A 
|  Renderer Integration | p26a_renderer_integration_final_report.md |P26A 
|  Batch Pipeline Wiring | p26a_batch_pipeline_wiring_final_report.md |P26A 
|  Readiness Recheck | p26f4_readiness_recheck_final_report.md |P26F4 
|  Operator Source Packet V2 | p26f4_operator_source_packet_v2_final_report.md |P26F4 
|  Source Present Gate | p26f4_source_present_gate_final_report.md |P26F4 
|  Waiting State Governance | p26f4_waiting_state_governance_final_report.md |P26F4 
|  Non-Source Governance | p27_non_source_governance_final_report.md |P27 
|  Artifact Index Consistency | p27_artifact_index_consistency_final_report.md |P27 
| P28A Scoring Underoutput Audit | p28a_scoring_underoutput_audit_final_report.md |
| P28B Reason Template Coverage Plan | p28b_reason_template_coverage_final_report.md |
| P28C Renderer-only Repair | p28c_renderer_only_repair_final_report.md |
| P28D Post-Renderer Validation | p28d_post_renderer_validation_final_report.md |
| P28E Reason Underoutput Closure | p28e_reason_underoutput_closure_final_report.md |

---

## 3. Canonical Next Prompts

| Trigger | Use This Prompt |
|---------|----------------|
| Operator confirms source placed in drop-zone | **p26_next_prompt_source_arrival_only.md** |
| Source NOT yet arrived (CEO Route D, axis-A continuation) | **p28_next_prompt_after_reason_underoutput_closure.md** (Route D: P29-A PIT-safe Feature Availability Registry v1) |
| Source NOT yet arrived (P27 housekeeping ONLY if axis-A round complete) | `p27_non_source_governance_backlog.md` (deprioritized to P10) |

> **Note:** `p26f4_next_prompt_when_source_present.md` is SUPERSEDED by `p26_next_prompt_source_arrival_only.md`. Use the latter.
> **CEO Route D mandate:** When source is not arrived, the **next-round main task** must be `P29-A PIT-safe Feature Availability Registry v1` (paper design). P27 naming audit / scanner consolidation / phase registry housekeeping are explicitly forbidden as next-round main task.

---

## 4. Canonical Corpora (ALL FROZEN)

| Corpus File | Lines | Status |
|------------|-------|--------|
| simulation_snapshot_corpus.jsonl | 60 | FROZEN |
| p0hardreset_historical_replay_corpus.jsonl | 4500 | FROZEN |
| p1baseline_historical_replay_corpus.jsonl | 9900 | FROZEN |
| p3active_scoring_historical_replay_corpus.jsonl | 4500 | FROZEN |
| p19active_scoring_pit_replay_corpus.jsonl | 4500 (4499 physical) | FROZEN |

**Do NOT modify any corpus file without P1 approval token.**

---

## 5. Canonical Guard Artifacts

| Guard | File |
|-------|------|
| P26F4 freeze marker (source of truth) | p26f4_waiting_state_freeze_marker.json |
| Phase chain registry | p26_phase_chain_registry.json |
| P28 reason underoutput track registry | p28_reason_underoutput_track_registry.json |
| P28 closure marker | p28_reason_underoutput_closure_marker.json |
| CI guard proposal | p27_waiting_state_ci_guard_proposal.json |
| Policy guard test | src/lib/onlineValidation/__tests__/p27_waiting_state_policy_guard.test.ts |
| Index consistency test | src/lib/onlineValidation/__tests__/p27_artifact_index_consistency.test.ts |
| P28E closure test | src/lib/onlineValidation/__tests__/p28e_reason_underoutput_closure.test.ts |

---

## 6. Historical / Deprecated / Do-Not-Use

| File | Status | Note |
|------|--------|------|
| p26f4_or_p26a_followup_final_report.md | HISTORICAL | Route-decision artifact, both paths now resolved |
| p26f4_or_p26a_followup_preflight.json | HISTORICAL | Route-decision artifact |
| p26f4_or_p26a_route_decision.json | HISTORICAL | Route-decision artifact |
| p26f4_next_prompt_when_source_present.md | SUPERSEDED | Use p26_next_prompt_source_arrival_only.md instead |

---

## 7. Warnings / Open Items

1. **Two next_prompt files** for source-arrival trigger exist. Canonical = `p26_next_prompt_source_arrival_only.md`. Superseded = `p26f4_next_prompt_when_source_present.md`. Not  serve different levels of  but use canonical for agent triggers.detail contradictory 
2. **267 unknown-type artifacts** (mostly historical per-phase reports before naming conventions). Not a problem; see p27_artifact_inventory for full classification.
3. **50 artifacts** missing json/md  most predate the pair convention. No action required.pair 

---

## Invariants (Must Not Change Without Approval Token)

- P26F4 freeze marker `currentState` = `P26F4_WAITING_FOR_OPERATOR_SOURCE`
- All 5 corpus line counts unchanged
- `prisma/dev.db` SHA256 = `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8`
- Scoring files SHA256 unchanged (see preflight)

---

*Observability only. This system does not provide investment recommendations.*
