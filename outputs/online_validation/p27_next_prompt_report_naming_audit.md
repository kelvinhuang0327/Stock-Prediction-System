# P27 Next  Report Naming AuditPrompt 

**For use when:** Operator source has NOT yet arrived  
**Task name:** P27_REPORT_NAMING_AUDIT  
**Date created:** 2026-05-18

---

## Trigger Condition

Use this prompt if:
1. `candidateSourceFiles = 0` in drop-zone scan
2. No `SOURCE_MANIFEST.json` in drop-zone
3. P26F4 freeze marker `currentState = P26F4_WAITING_FOR_OPERATOR_SOURCE`

 use `p26_next_prompt_source_arrival_only.md`.

---

## Task Description

**P27_REPORT_NAMING_ Audit and unify report naming conventions across `outputs/online_validation/`AUDIT** 

### Goal

- Inspect all 658 artifacts in `outputs/online_validation/`
- Use `ARTIFACT_INDEX.md` as the canonical reference
- Check naming rules:
  - Every phase's final_report should follow: `p{N}_{phase}_{topic}_final_report.md`
  - Every final_report.md should have a matching `.json` artifact
  - preflight / smoke / forbidden_claims / invariance should follow pair convention
- Label historical artifacts: canonical / deprecated / orphan / historical
- Do NOT delete any artifact
- Do NOT modify any historical artifact content

### Outputs

- `outputs/online_validation/p27_report_naming_audit_final_report.md`
- `outputs/online_validation/p27_report_naming_audit_findings.json`
- Optionally: `outputs/online_validation/p27_report_naming_audit_remediation_plan.md`

### Constraints (HARD)

- No DB write
- No corpus modification
- No scoring path changes
- No RuleBasedStockAnalyzer / SignalFusionEngine / ActiveScoringSnapshotBuilder changes
- No import of any source data
- No investment recommendations

---

## If Source Arrives During This Task

Stop immediately and switch to:
```
outputs/online_validation/p26_next_prompt_source_arrival_only.md
```

---
*Observability only. No investment recommendations.*
