# PIT-safe Feature Availability Registry — Contract v1

**Paper design only. Not investment advice.**

## Purpose

Unify all feature sources into a machine-readable contract describing:
- PIT-safety status and gate field
- Whether the source enters `alphaScore`
- Signal-fusion weights (where applicable)
- Known limitations and fallback behaviour

## Source Status Enum

| Status | Meaning |
| --- | --- |
| `AVAILABLE_PIT_SAFE` | PIT gate verified; safe to enter scoring |
| `AVAILABLE_NEEDS_VALIDATION` | In use but PIT gate not formally audited |
| `REPAIRED_BUT_SOURCE_GATED` | PIT fix done; historical data incomplete |
| `WAITING_FOR_OPERATOR_SOURCE` | Requires operator to supply source files |
| `HIGH_RISK_SOURCE_ABSENT` | No real PIT-safe source; must NOT enter scoring |
| `RENDERER_ONLY` | Visible in reason context only; not in alphaScore |
| `NOT_ALLOWED_FOR_SCORING` | Explicitly excluded from scoring by contract |
| `UNKNOWN_NEEDS_AUDIT` | Status unknown; treat as HIGH_RISK |

## Registry Rules (10)

1. **R1** — entersAlphaScore=true → verified PIT gate required
2. **R2** — HIGH_RISK_SOURCE_ABSENT → entersAlphaScore must be false
3. **R3** — NOT_ALLOWED_FOR_SCORING → entersAlphaScore must be false
4. **R4** — NewsEvent / FinancialReport cannot enter alphaScore until AVAILABLE_PIT_SAFE
5. **R5** — MonthlyRevenue remains REPAIRED_BUT_SOURCE_GATED until P26F4 import
6. **R6** — Registry is paper design; no production scoring path imports it
7. **R7** — entersRendererOnly=true still requires PIT safety for temporal correctness
8. **R8** — forbiddenBehavior must be documented per source
9. **R9** — `ingestedAt`, `createdAt`, `updatedAt`, `periodEndDate`, `fiscalQuarter` are NEVER valid PIT gate fields
10. **R10** — Registry does not grant P26F4 import permission (token still required)

*Observability only. Not investment advice.*
