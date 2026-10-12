# P30 — Chip availableAt Write Policy

**Module:** `src/lib/onlineValidation/p30/ChipAvailableAtWritePolicy.ts`
**Version:** `p30-chip-available-at-write-policy-v1`
**Phase:** P30
**Captured:** 2026-05-20T00:00:00.000Z

## Purpose

Provides a pure, deterministic policy layer for computing and validating `InstitutionalChip.availableAt` values. This module governs how `availableAt` is set when writing (upserting) chip records to the database.

## Functions

### `computeChipWriteAvailableAt(isoDate, mode?)`

Computes `availableAt` for a chip trading date using either the primary or conservative policy.

| Mode | Policy | UTC time | TWN time |
|---|---|---|---|
| `PRIMARY` (default) | `INFERRED_SAME_DAY_T86_0930_UTC` | 09:30 UTC same day | 17:30 TWN same day |
| `CONSERVATIVE` | `INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE` | 09:30 UTC next day | 17:30 TWN next day |

### `buildChipUpsertAvailableAt(isoDate, sourcePayloadAvailableAt?)`

Decision logic for upsert operations:

1. If `sourcePayloadAvailableAt` is a valid `Date` → use it (`policySource: SOURCE_PAYLOAD`)
2. Otherwise → use primary policy (`policySource: INFERRED_PRIMARY`)

### `validateWriteDoesNotAlterChipNumerics(original, updated)`

Returns `true` if all four numeric fields are unchanged:
- `foreignBuy` (外資買賣超)
- `trustBuy` (投信買賣超)
- `dealerBuy` (自營商買賣超)
- `totalBuy` (三大法人合計)

Returns `false` if any numeric value changed — this would indicate an unauthorized alteration of chip signal data.

### `assertEntersAlphaScoreFalse(result)`

Runtime guard that throws if `entersAlphaScore !== false`. Enforces the invariant that `InstitutionalChip` data never enters alphaScore computation.

## Policy Sources

| Source | When Used |
|---|---|
| `SOURCE_PAYLOAD` | Source API provides explicit `availableAt` |
| `INFERRED_PRIMARY` | No source payload; use T86 same-day timing |
| `INFERRED_CONSERVATIVE` | Explicit backfill mode; use next-day timing |

## Key Invariants

- `entersAlphaScore` is always `false as const` — cannot be overridden
- `availableAt` is metadata only — it does not affect alphaScore, signal fusion, or recommendation
- Numeric field writes must be validated with `validateWriteDoesNotAlterChipNumerics` before any upsert

## Disclaimer

Structural write policy only. Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. InstitutionalChip entersAlphaScore = false (always). Results must not be used as investment recommendations or signals.
