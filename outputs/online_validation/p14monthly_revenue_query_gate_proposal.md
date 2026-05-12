# P14-HARDRESET: MonthlyRevenue Query Gate Patch Proposals

> **Disclaimer:** Proposals only. Does not modify production code or DB. Does not constitute investment advice.
> **productionApplyAllowed = false**

**Generated:** 2026-05-12T03:46:00.733Z
**Query Gate Contract:** p14-monthly-revenue-query-gate-contract-v0

---

## Query Gate Rules

| ID | Condition | Result |
|----|-----------|--------|
| QG-001 | year or month is missing/invalid | UNAVAILABLE_MISSING_PERIOD |
| QG-002 | releaseDate present and valid and releaseDate <= asOfDate | AVAILABLE |
| QG-003 | releaseDate present and valid and releaseDate > asOfDate | UNAVAILABLE_RELEASE_DATE_FUTURE |
| QG-004 | releaseDate present but invalid format | UNAVAILABLE_INVALID_RELEASE_DATE |
| QG-005 | releaseDate missing and allowInferredReleaseDate=true: inferred <= asOfDate | AVAILABLE |
| QG-006 | releaseDate missing and allowInferredReleaseDate=true: inferred > asOfDate | UNAVAILABLE_RELEASE_DATE_FUTURE |
| QG-007 | releaseDate missing and allowInferredReleaseDate=false | UNAVAILABLE_INFERRED_NOT_ALLOWED |

---

## Patch Proposals


### Proposal 1: `src/lib/analysis/RuleBasedStockAnalyzer.ts`

**Function:** `analyzeStock()`
**Current Risk:** HIGH

#### Current Implementation

Gates MonthlyRevenue by year/month period (revenueAsOfWhere). Uses OR [{year<asOfYear}, {year=asOfYear AND month<=asOfMonth}]. This treats the reporting period as the availability date, which is not correct for Taiwan monthly revenue released on the 10th of the following month.

**Code Location:** Line ~62-74 in RuleBasedStockAnalyzer.ts
**PIT Leakage:** If asOf=2024-02-05, Jan 2024 revenue (released 2024-02-10) is included. This is a PIT leakage.

#### Proposed Change

Replace year/month period gate with releaseDate gate. After schema migration adds releaseDate, use: where: { stockId, releaseDate: { lte: asOfDate } }.

```typescript
// PROPOSED PATCH — requires schema migration (P15) before applying
// Current: year/month period gate (HIGH PIT risk)
// Proposed: releaseDate gate (PIT-safe)
const revenueAsOfWhere = asOf
  ? { stockId: symbol, releaseDate: { lte: asOf } }
  : { stockId: symbol };
```

**Fallback:** If releaseDate is null after backfill, fall back to INFERRED_NEXT_MONTH_10TH via application-layer filter (not DB query).

#### Why Not Applied Yet

MonthlyRevenue.releaseDate field does not exist in production schema. Schema migration (P15) must be completed and approved before this patch can be applied.

**Approval Requirement:** Requires P15 schema migration approval and completion.

#### Test Cases to Add

| Description | Expected |
|-------------|---------|
| asOf=2024-02-09 → Jan 2024 revenue NOT included (inferred releaseDate=2024-02-10) | unavailable |
| asOf=2024-02-10 → Jan 2024 revenue included (inferred releaseDate=2024-02-10) | available |
| asOf=2024-01-15 → Dec 2023 revenue included (inferred releaseDate=2024-01-10) | available |
| asOf=2024-01-09 → Dec 2023 revenue NOT included (inferred releaseDate=2024-01-10) | unavailable |

---

### Proposal 2: `src/lib/fundamentals/FundamentalResearchService.ts`

**Function:** `buildFundamentalResearchContextForSymbol()`
**Current Risk:** HIGH

#### Current Implementation

No asOf parameter. prisma.monthlyRevenue.findMany({ where: { stockId: input.symbol }, ... }) with no date gate at all. Returns all revenue records regardless of when they were released.

**Code Location:** Line ~76-81 in FundamentalResearchService.ts
**PIT Leakage:** All historical MonthlyRevenue records returned regardless of asOf. Unreleased future revenue data may be included in analysis context.

#### Proposed Change

Add optional asOf parameter to buildFundamentalResearchContextForSymbol. Gate MonthlyRevenue query by releaseDate <= asOf.

```typescript
// PROPOSED PATCH — requires schema migration (P15) before applying
// Add asOf to input type:
// input: { symbol: string; name: string; industry: string; asOf?: string }
//
// Current: no asOf gate (HIGH PIT risk)
// Proposed: gate by releaseDate
const revenueWhere = input.asOf
  ? { stockId: input.symbol, releaseDate: { lte: input.asOf } }
  : { stockId: input.symbol };
prisma.monthlyRevenue.findMany({ where: revenueWhere, ... })
```

**Fallback:** If releaseDate is null after backfill, include records only if inferred releaseDate <= asOf.

#### Why Not Applied Yet

MonthlyRevenue.releaseDate field does not exist in production schema. Schema migration (P15) required. Also requires adding asOf parameter to function signature.

**Approval Requirement:** Requires P15 schema migration approval + interface update for MonthlyRevenueLike.

#### Test Cases to Add

| Description | Expected |
|-------------|---------|
| asOf provided → only revenue with releaseDate <= asOf returned | filtered |
| asOf not provided → all revenue returned (legacy behavior) | all |
| asOf=2024-02-09 → Jan 2024 revenue excluded | excluded |
| asOf=2024-02-10 → Jan 2024 revenue included | included |

---

### Proposal 3: `src/lib/fundamentals/StockFundamentalSnapshot.ts`

**Function:** `MonthlyRevenueLike interface`
**Current Risk:** MEDIUM

#### Current Implementation

MonthlyRevenueLike interface does not include releaseDate field. After schema migration, the interface must be updated to propagate releaseDate through the application layer.

**Code Location:** MonthlyRevenueLike type definition
**PIT Leakage:** Even after schema migration, code consuming MonthlyRevenueLike will not see releaseDate without interface update.

#### Proposed Change

Add optional releaseDate field to MonthlyRevenueLike interface.

```typescript
// PROPOSED PATCH — requires schema migration (P15) before applying
export interface MonthlyRevenueLike {
  year: number;
  month: number;
  revenue: number;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  releaseDate?: string | null;         // ADD: ISO date YYYY-MM-DD
  releaseDateSource?: string | null;   // ADD: AUTHORITATIVE | INFERRED_NEXT_MONTH_10TH
  releaseDateConfidence?: string | null; // ADD: HIGH | MEDIUM | LOW_TO_MEDIUM
}
```



#### Why Not Applied Yet

Requires schema migration first. Interface change is backward compatible (optional fields).

**Approval Requirement:** Requires P15 schema migration completion.

#### Test Cases to Add

| Description | Expected |
|-------------|---------|
| MonthlyRevenueLike with releaseDate field compiles and passes type check | valid |
| Existing code consuming MonthlyRevenueLike without releaseDate still compiles | backward-compatible |


---

## Non-Goals

- Does not directly modify production scoring logic.
- Does not modify alphaScore or recommendationBucket.
- Does not write production DB.
- Does not modify frozen corpora.
- Does not compute ROI, profit, win-rate, or alpha.
- Does not constitute investment advice.
