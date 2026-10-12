# Glossary (final)

Definitions for commonly used terms. Keep definitions short and implementation-agnostic.

- alphaScore: Numeric signal strength produced by `SignalFusionEngine` used for candidate ranking.
- recommendationBucket: Enum for candidate categorization (e.g., `Strong`, `Watch`, `Neutral`, `Excluded`).
- shadow trade: Low-certainty, evaluation-only simulated position used for learning and track-record collection.
- pending trade: Partially approved trade (reduced sizing) intended for deeper validation before full promotion.
- full trade: Fully approved trade executed with standard sizing rules.
- evidence overlay: Research-layer annotations and labels (quality, source-trust, narratives) that augment but do not alter `alphaScore`.
- simulation-dominated: Event quality label indicating simulated/mock events are the majority (>50%).
- contamination: Learning metric indicating overlapping signals, reused parameter sets, or other factors that reduce the trustworthiness of a learning insight.
- bootstrap mode: Warm-up state when the system has no closed trades; thresholds are relaxed to seed initial shadow trades.
- trigger score: Composite readiness score (0.0–1.0) produced by `TriggerScoringEngine` used to map to `shadow`/`pending`/`full` modes.

If a term has ambiguous usage in code, link to the owning file instead of adding more prose here.