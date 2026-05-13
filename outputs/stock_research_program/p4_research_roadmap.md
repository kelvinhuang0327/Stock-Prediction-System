# P4 Research Roadmap

**Task:** P3- Research Program Reset  14 
**P3 Final Classification:** EXPANDED_UNIVERSE_NO_EDGE_FOUND  
**P4 Objective:** Next-generation hypotheses with stronger economic priors, portfolio-level testing, new data sources

---

## Roadmap Overview

```
P4-01: Data Source Expansion Audit
   
P4-02: Cross-Sectional Ranking Framework   P4-03: Market Regime Classifier
                                                
P4-04: Portfolio-Level Backtester (requires P4-02 + P4-03)
   
P4-05: Next-Gen Hypothesis Registry
   
P4-06: P4 Batch Validation
```

---

## P4- Data Source Expansion Audit01 

**Objective:** Confirm which data sources exist, historical depth, and backfill requirements.  
**Prerequisites:** P3-14 complete  
**Complexity:** LOW (read-only audit)  
**Success Criteria:**
- All existing tables audited with row count and date coverage
- Missing sources listed as DATA_SOURCE_MISSING
- Backfill requirements documented
- No hypothesis designed in this stage

---

## P4- Cross-Sectional Ranking Framework02 

**Objective:** Build universe-wide ranking from StockQuote. Enables portfolio-level testing.  
**Prerequisites:** P4-01  
**Complexity:** MEDIUM  
**Success Criteria:**
- Universe rank computable for all eligible symbols
- Risk-adjusted rank (Sharpe-based)
- PIT-safe, reproducible from lineage

---

## P4- Market Regime Classifier03 

**Objective:** TAIEX-based bull/bear/sideways regime. All hypotheses conditioned on regime.  
**Prerequisites:** P4-01  
**Complexity:** MEDIUM  
**Success Criteria:**
3 regime states (bull, bear, sideways)- 
- Covers full StockQuote date range
- No future TAIEX data used

---

## P4- Portfolio-Level Backtester04 

**Objective:** Basket-level validation. Top-N ranked baskets vs random baskets. Higher statistical power.  
**Prerequisites:** P4-02 + P4-03  
**Complexity:** HIGH  
**Success Criteria:**
- Portfolio-level permutation 500 basket shuffles)test (
- BH-FDR across all hypothesis basket tests
- Regime-conditioned results
- Paper-only, no production write

---

## P4- Next-Gen Hypothesis Registry05 

**Objective:** Register H013+ using quality scoring rubric (minimum 70/100).  
**Prerequisites:** P4-01 + P4-02 + P4-03  
**Complexity:** MEDIUM  
**Success Criteria:**
3 new hypotheses registered with quality_ 70score - 
- All have economic_rationale and stronger_prior
- No recycling of H012 thresholdsH001

---

## P4- P4 Batch Validation06 

**Objective:** Validate new hypotheses using portfolio backtester with two-tier BH-FDR.  
**Prerequisites:** P4-04 + P4-05  
**Complexity:** HIGH  
**Success Criteria:**
- All hypotheses tested
- BH-FDR applied (primary + diagnostic)
- REVIEW_CANDIDATE requires human approval
- Anti-overfitting report generated

---

## Governance (All P4 Stages)

 No production write- 
 No auto-promotion- 
 No threshold change from results- 
 No future data leakage- 
 No random split- 
 No external LLM- 
-  Human review required before any promotion
