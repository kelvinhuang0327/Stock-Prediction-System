# FinancialReport Source Acquisition Plan

**Phase:** P29B | **Paper design only** | *Not investment advice*

## Source Purpose
Quarterly financials (EPS, net income, margins) for Taiwan stocks. Available after MOPS filing.

## Recommended Source
**MOPS official announcements** (`https://mops.twse.com.tw/mops/web/ajax_t164sb03`)
- Must capture **filingDate (公告日期)** — NOT periodEndDate
- Operator manually exports to CSV

## PIT-safe Rule
`filingDate <= asOfDate` — **filingDate is the PIT gate, not period end date**

## Taiwan Disclosure Calendar
| Quarter | Period End | Filing Deadline |
| --- | --- | --- |
| Q1 | Mar 31 | ~May 15 (~45 days later) |
| Q2 | Jun 30 | ~Aug 14 (~45 days later) |
| Q3 | Sep 30 | ~Nov 14 (~45 days later) |
| Q4/Annual | Dec 31 | ~Mar 31 next year (~90 days later) |

## Required Fields
`symbol, year, quarter, filingDate (YYYY-MM-DD), eps, netIncome, sourceName, sourceUrl`

## Drop-zone
`data/manual/financial-report/p29b-dropzone/`
Files: `financial_report_<YYYY>_Q<N>_<label>.csv`

## Status Transition
`HIGH_RISK_SOURCE_ABSENT` → `SOURCE_PRESENT_AWAITING_VALIDATION` → `AVAILABLE_NEEDS_VALIDATION`
(each step requires validator PASS + approval token)

## Schema Changes (paper plan only)
Add `filingDate DateTime?`, `sourceName String?`, `sourceUrl String?` to `FinancialReport` model.

## Forbidden
- `periodEndDate` as PIT gate ❌
- Outcome fields ❌
- Inferred filingDate ❌
- Enters alphaScore before AVAILABLE_PIT_SAFE ❌
