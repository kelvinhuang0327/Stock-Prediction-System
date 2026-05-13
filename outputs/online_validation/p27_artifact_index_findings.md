# P27 Artifact Index Findings

**Generated:** 2026-05-18

## Summary

| Metric | Value |
|--------|-------|
| Total files | 658 |
| Final reports | 42 |
| Missing json/md pairs | 50 |
| Orphan artifacts | 5 |
| Duplicate next-prompt | 2 (INFO) |
| Import-ready in freeze artifacts | 0 |

## Findings

###  Two next_prompt files for source-arrival trigger [INFO]F1 

**Files:**
- `p26f4_next_prompt_when_source_present. created in c0f4713 (detailed operator instructions)md` 
- `p26_next_prompt_source_arrival_only. created in c4227c0 (canonical trigger-only version)md` 

**Assessment:** Not contradictory. Both are valid documents serving different levels of detail. They do not instruct conflicting actions. The canonical trigger prompt for agent use is `p26_next_prompt_source_arrival_only.md`.

**Action:** Label `p26f4_next_prompt_when_source_present.md` as SUPERSEDED in ARTIFACT_INDEX. No deletion.

---

###  p26f4_or_p26a orphan artifacts [INFO]F2 

**Files (5):** p26f4_or_p26a_* series  

**Assessment:** Created during an earlier ambiguous state where both P26A and P26F4 next-paths were unclear. Both paths are now fully resolved. These are HISTORICAL artifacts.

**Action:** Mark HISTORICAL in ARTIFACT_INDEX. No deletion.

---

###  50 artifacts missing json/md pair [LOW]F3 

**Sample files:** Various historical reports (p3, p4,  era)  p5

**Assessment:** Most predate the json/md pair convention established in P26F. Not an error.

**Action:** No action required. Noted for awareness.

---

###  No import-ready language in freeze artifacts [PASS]F4 

**Checked:** PHASE_INDEX.md, p26_phase_chain_registry.md, p26f4_waiting_state_freeze_marker.md  
**Result:** None contain "import-ready" or "import_ready" language.  

`P26F4_WAITING_FOR_OPERATOR_SOURCE` is correctly maintained throughout.

---

###  Corpus line counts match PHASE_INDEX [PASS]F5 

| Corpus | Expected | Status |
|--------|----------|--------|
| simulation | 60 | PASS |
| p0 | 4500 | PASS |
| p1 | 9900 | PASS |
| p3 | 4500 | PASS |
| p19 | 4500 | PASS |

---

###  No stale prompt requiring empty drop-zone scan [PASS]F6 

No artifact instructs agent to scan drop-zone as main task when `candidateSourceFiles = 0`. Governance artifacts correctly block this pattern.

---

## Overall Assessment

No critical issues. All findings are INFO or PASS. ARTIFACT_INDEX can be marked clean.

---
*Observability only. No investment recommendations.*
