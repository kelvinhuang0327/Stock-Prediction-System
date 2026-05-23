# P34 — NewsEvent Dry-run Sample

**Phase:** P34  
**Date:** 2026-05-21  
**Source:** NewsEvent  
**Mode:** source-present-dry-run  
**Sample:** 5 rows — stratified by trustLevel and date  
**Classification:** `NEWS_EVENT_SOURCE_PRESENT_DRY_RUN_SAMPLE_READY`  

> Disclaimer: Dry-run sample only. For structural governance audit purposes. Does not constitute investment advice. No buy/sell/hold signals. No profit, ROI, win-rate, or investment performance claims. `entersAlphaScore = false`. ALWAYS.

---

## Governance Flags

| Flag | Value |
|------|-------|
| `entersAlphaScore` | **false** |
| `paperOnly` | **true** |
| `dryRun` | **true** |
| `notInvestmentRecommendation` | **true** |
| `noBuySellActionSemantics` | **true** |

---

## Sample Fields (allowed)

- `id` — stable internal identifier  
- `title` — headline from source  
- `source` — originating source  
- `trustLevel` — official / mainstream / secondary  
- `publishedAt` — PIT gate field (ms timestamp)  
- `publishedAtDate` — human-readable approximate date  
- `ingestedAt` — ingestion timestamp (bookkeeping only, not PIT gate)  
- `pitEligible` — boolean: true if publishedAt is present and valid  
- `blockedReason` — null if eligible  
- `dryRunTrace` — PIT gate evaluation trace  

**Excluded fields (governance):** No prediction fields. No investment recommendation fields. No buy/sell/hold/action fields. No ROI / win-rate / profit / edge / alpha fields. `entersAlphaScore = false`.

---

## Sample Rows

### Row 1 — trustLevel: official, source: president.gov.tw

| Field | Value |
|-------|-------|
| id | `cmmwl9czh0013ocb863dwalul` |
| title | 總統接見美國半導體產業協會訪團 盼強化臺美合作… |
| source | president.gov.tw |
| trustLevel | **official** |
| publishedAt | 1772439865000 (~2026-04-29) |
| ingestedAt | 1773871447805 |
| pitEligible | ✅ true |
| blockedReason | null |

PIT trace: publishedAt present, trustLevel=official, pitGate=PASS

---

### Row 2 — oldest event (publishedAt MIN)

| Field | Value |
|-------|-------|
| id | `cmmwl9czw001nocb81i2g0jw9` |
| title | 台股盤後｜台積電登天價與內資作帳共舞科技股領軍突破28,800點 1229 |
| source | sinotrade.com.tw |
| trustLevel | secondary |
| publishedAt | 1766995200000 (~2025-12-29) |
| ingestedAt | 1773871447820 (~2026-03-15) |
| pitEligible | ✅ true |
| blockedReason | null |

PIT trace: publishedAt present, historical import gap expected (ingestedAt 76 days after publishedAt), pitGate=PASS using publishedAt

---

### Row 3 — trustLevel: official, source: moea.gov.tw

| Field | Value |
|-------|-------|
| id | `cmmwl9czl0018ocb8ieh17ubr` |
| title | 矽光子、量子前瞻技術 |
| source | moea.gov.tw |
| trustLevel | **official** |
| publishedAt | 1770710400000 (~2026-04-10) |
| ingestedAt | 1773871447809 |
| pitEligible | ✅ true |
| blockedReason | null |

PIT trace: publishedAt present, trustLevel=official, pitGate=PASS

---

### Row 4 — most recent event (publishedAt MAX)

| Field | Value |
|-------|-------|
| id | `cmoshlqcy00ka3ruiky5k80a9` |
| title | 華邦電法說》「記憶體產能緊得不得了！」 2分析師齊看多：股價有戲 |
| source | Yahoo 台股新聞 RSS |
| trustLevel | mainstream |
| publishedAt | 1777976893000 (~2026-05-05) |
| ingestedAt | 1777977006515 |
| pitEligible | ✅ true |
| blockedReason | null |

PIT trace: publishedAt present, near-realtime ingestion (gap=113s), pitGate=PASS

---

### Row 5 — source: 自由財經

| Field | Value |
|-------|-------|
| id | `cmmwl9czu001jocb8ix8s3og4` |
| title | 不和台積電硬拚！BBC揭印度半導體「繞道突圍」真正盤算 改搶3領域 |
| source | 自由財經 |
| trustLevel | secondary |
| publishedAt | 1769587200000 (~2026-01-28) |
| ingestedAt | 1773871447818 |
| pitEligible | ✅ true |
| blockedReason | null |

PIT trace: publishedAt present, trustLevel=secondary, pitGate=PASS

---

## Sample Governance Check

| Check | Result |
|-------|--------|
| All rows have publishedAt | ✅ true |
| All rows pitEligible | ✅ true |
| Blocked rows in sample | 0 |
| Any buy/sell/hold semantics | ✅ none |
| Any investment recommendation | ✅ none |
| Any alphaScore field | ✅ none |
| Any prediction quality field | ✅ none |

**dryRunStatus:** `READY`  
**overallClassification:** `NEWS_EVENT_SOURCE_PRESENT_DRY_RUN_SAMPLE_READY`
