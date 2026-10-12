# Hypothesis Retirement Decisions

**Task:** P3- Research Program Reset  14 
**Scope:** H012  H001
**All hypotheses:** `promotion_allowed=false`, `can_be_refined_again=false`

---

## Summary

| Decision | Hypotheses |
|----------|-----------|
| RETIRE | H001 |
| ARCHIVE_NO_EDGE | H004, H005, H006, H009, H010, H011 |
| OBSERVATION_ONLY | H002, H012 |
| NEEDS_NEW_DATA | H003, H007, H008 |

---

## Individual Decisions

 **RETIRE**
NEGATIVE_ROI across multiple symbols. No positive signal direction. No future use.

 **OBSERVATION_ONLY**
Local symbol effect on 2317 only. High data snooping risk. Not generalizable. Observation on previously identified symbols only.

 **NEEDS_NEW_DATA**
Volume breakout requires reliable volume regime context. Institutional flow could provide stronger prior. Candidate for redesign in P4.

 **ARCHIVE_NO_EDGE**
Refined into H010 (P3-10). H010 REJECTED in P3-13 expanded validation (50 symbols). No path forward.

 **ARCHIVE_NO_EDGE**
Refined into H009 (P3-10). H009 REJECTED in P3-13 expanded validation (50 symbols). No path forward.

 **ARCHIVE_NO_EDGE**
Refined into H011 (P3-10). H011 REJECTED in P3-13 expanded validation (50 symbols). No path forward.

 **NEEDS_NEW_DATA**
Universe-relative framework requires cross-sectional data with sector/industry metadata. Current DB industry codes mostly empty. Candidate for redesign in P4-02.

 **NEEDS_NEW_DATA**
ETF universe too small (6 symbols 500 rows). Test underpowered. Candidate for redesign when sector index data available.with 

 **ARCHIVE_NO_EDGE**
P3-13: 0/50 primary BH-FDR pass on 50 symbols. avg permutation p=1.000. No future use.

 **ARCHIVE_NO_EDGE**
P3-13: 0/50 primary BH-FDR pass on 50 symbols. avg permutation p=1.000. No future use.

 **ARCHIVE_NO_EDGE**
P3-13: 0/50 primary BH-FDR pass on 50 symbols. avg permutation p=1.000. No future use.

 **OBSERVATION_ONLY**
Permanently scoped as exploratory_observation_only. Hard-locked by hypothesis_refinement_guard. Symbol-specific (2317). Never eligible for promotion.

---

## Governance Rules

1. No hypothesis may be promoted to production
2. No hypothesis may be re-refined based on P3 results (data snooping prevention)
3. ARCHIVE_NO_EDGE hypotheses may not be reopened without new data sources
4. NEEDS_NEW_DATA hypotheses may be redesigned (not refined) in P4 with new features
5. OBSERVATION_ONLY hypotheses require explicit human review before any action
