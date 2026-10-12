# P4-01 — Stock Data Source Expansion Audit

**Task for Next Worker Agent**

---

## Background

The Stock Prediction System has completed P3 research (P3-04 through P3-13). All rule-based OHLCV hypotheses H001-H012 have been validated and rejected or archived. The system is now entering P4, which requires new data sources and a qualitative redesign of the hypothesis framework.

P3-14 (Research Program Reset) identified the following data gaps:
- InstitutionalChip only has 1 year of history (2025-05 to 2026-05) — insufficient for 500d window backtesting
- MonthlyRevenue only has 2 months (2026-02 to 2026-03) — insufficient for event-based hypotheses
- Stock.industry has numeric codes with no mapping table
- No dividend/ex-right event table exists
- Short selling balance and margin balance tables are missing

The P4 roadmap requires these data sources before hypothesis design can begin.

---

## Task Name

**P4-01 — Stock Data Source Expansion Audit**

---

## Objectives

1. Audit all existing data sources in `prisma/dev.db` for:
   - Row count, date coverage (min/max date, trading days), symbol coverage, PIT safety
   - Historical depth sufficiency (need >=500 trading days for primary window)

2. Identify what backfill is required:
   - InstitutionalChip: need historical data back to 2021+ (5 years for robust validation)
   - MonthlyRevenue: need historical data back to 2021+
   - FinancialReport: audit quarterly coverage

3. Check sector/industry metadata:
   - Map Stock.industry numeric codes to sector names
   - Identify if any ETF/stock classification flag exists or can be derived
   - Inventory MarketIndex sector indices and map to industry codes

4. Document missing data sources:
   - Short selling balance, margin balance, dividend schedule, ex-right/ex-dividend events

5. Check existing sync/backfill scripts in scripts/ directory

---

## What This Task MUST NOT Do

- Do NOT design new hypotheses
- Do NOT run any validation
- Do NOT modify any production strategy
- Do NOT make production writes
- Do NOT call external LLMs
- Do NOT change trading thresholds
- Do NOT modify existing hypothesis registry files

---

## Required Outputs

```
outputs/stock_data_expansion/p4_01_data_source_audit.json
outputs/stock_data_expansion/p4_01_data_source_audit.md
outputs/stock_data_expansion/p4_01_backfill_requirements.json
outputs/stock_data_expansion/p4_01_backfill_requirements.md
outputs/stock_data_expansion/p4_01_industry_code_mapping.json
```

---

## Reference Files

- `prisma/dev.db` — SQLite database with all tables
- `outputs/stock_research_program/p4_data_availability_audit.json` — P3-14 preliminary audit
- `outputs/stock_research_program/p4_research_roadmap.json` — P4 roadmap
- `outputs/stock_research_program/next_gen_hypothesis_design_principles.json` — Design principles
- `research/stock_hypothesis_registry_v3_candidates.json` — Do NOT modify

---

## Success Criteria

- [ ] All DB tables audited with row count and date coverage
- [ ] InstitutionalChip date coverage confirmed
- [ ] MonthlyRevenue date coverage confirmed
- [ ] Stock.industry codes mapped (at least partially)
- [ ] Missing data sources explicitly listed as DATA_SOURCE_MISSING
- [ ] Backfill requirements documented per table
- [ ] Existing sync/backfill scripts inventoried
- [ ] Tests passing
- [ ] No hypothesis designed
- [ ] No validation run
- [ ] No production write

---

## Final Classification

Output one of:
- `STOCK_DATA_SOURCE_AUDIT_COMPLETE` — all tables audited, gaps documented, backfill plan ready
- `STOCK_DATA_SOURCE_AUDIT_INCOMPLETE` — some tables could not be audited
- `STOCK_DATA_SOURCE_AUDIT_BLOCKED` — DB inaccessible or critical error
