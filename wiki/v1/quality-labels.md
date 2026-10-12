# Quality Labels and Thresholds (final)

This page records the authoritative label sets and numeric thresholds pulled directly from the implementation. If you need to change any constants, update the corresponding source file and tests first.

## Event Source Quality (authoritative: src/lib/events/EventSourceQualityEngine.ts)

- MIN_EVENTS_FOR_CONCLUSION = 3
- MOCK_DOMINATED_THRESHOLD = 0.5  (mockRatio > 0.5 => SIMULATION_DOMINATED)
- MOCK_MIXED_THRESHOLD = 0.2     (mockRatio > 0.2 => MIXED_SOURCE)
- HIGH_TRUST_RATIO_THRESHOLD = 0.6 (official+mainstream >= 60% → LIVE_CONFIDENT)

Labels (exact): `LIVE_CONFIDENT`, `MIXED_SOURCE`, `SIMULATION_DOMINATED`, `INSUFFICIENT_EVENT_DATA`

Rule summary (priority order — see implementation for edge cases):
1. totalEvents === 0 → `INSUFFICIENT_EVENT_DATA`
2. !sourceTypeTracked → conservative, cap at `MIXED_SOURCE` or `INSUFFICIENT_EVENT_DATA` if < MIN_EVENTS
3. rssCount === 0 && mockCount > 0 → `SIMULATION_DOMINATED`
4. mockRatio > MOCK_DOMINATED_THRESHOLD → `SIMULATION_DOMINATED`
5. mockRatio > MOCK_MIXED_THRESHOLD → `MIXED_SOURCE`
6. rssCount < MIN_EVENTS_FOR_CONCLUSION → `INSUFFICIENT_EVENT_DATA`
7. highTrustRatio >= HIGH_TRUST_RATIO_THRESHOLD → `LIVE_CONFIDENT`
8. otherwise → `MIXED_SOURCE`

## Relevance Quality Overlay (authoritative: src/lib/relevance/RelevanceQualityOverlay.ts)

- Outputs: `signalQualityScore` (0–100), `confidenceDelta`, `label`.
- Label buckets (human-facing): `HIGH_CONFIDENCE`, `MEDIUM_CONFIDENCE`, `LOW_CONFIDENCE`, `NO_EVIDENCE`.
- Implementation note: exact numeric boundaries are computed in code; consult the file before changing.

## Trigger Scoring (authoritative: src/lib/autonomous/TriggerScoringEngine.ts)

- Normal thresholds: `shadow = 0.3`, `pending = 0.6`, `triggered = 0.8` (final score range 0.0–1.0).
- Bootstrap thresholds (system warm-up): `shadow = 0.1`, `pending = 0.4`, `triggered = 0.6`.
- Tier mapping (finalScore → tradeMode):
  - finalScore < 0.3 (normal) → `none`
  - 0.3 ≤ finalScore < 0.6 → `shadow`
  - 0.6 ≤ finalScore < 0.8 → `pending`
  - finalScore ≥ 0.8 → `full`

- Shadow sizing and targets are defined by `shadowSetupThresholds(setupType)` and `tradeModePositionMultiplier(tradeMode)`.

## Sizing / Risk thresholds (authoritative: src/lib/autonomous/AutonomousRiskEngine.ts)

- Risk rejection floor: when `adjustedPositionSizing <= 0.01` → proposal rejected (not approved) unless bootstrap exceptions apply.
- `maxRiskPerTrade = 0.02` and `totalExposureCap = 0.3` (0.15 when marketState === 'defensive').

Notes

- This page is intentionally compact. For implementation-level logic consult the referenced TypeScript files and add unit tests when changing thresholds.