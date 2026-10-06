#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run-8h-window.sh — 8-Hour Unattended Autonomous System Readiness Run
#
# SAFE: read-only data sync + simulation replay only.
# Does NOT modify: scores, thresholds, regime multipliers, policy, schema.
# Resumable: each stage checks its own state before running.
#
# Usage:
#   bash scripts/run-8h-window.sh              # full 8h run
#   bash scripts/run-8h-window.sh --stage T1   # run only one stage
#   bash scripts/run-8h-window.sh --resume     # resume skipping completed stages
#
# Output logs: logs/8h-run-YYYYMMDD-HHMMSS/
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail  # -e removed: stage failures must not abort the 8h window

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
LOG_DIR="$REPO_ROOT/logs/8h-run-$RUN_ID"
STATE_FILE="$LOG_DIR/state.json"
ONLY_STAGE="${2:-}"
RESUME=false

mkdir -p "$LOG_DIR"

[[ "${1:-}" == "--resume" ]] && RESUME=true
[[ "${1:-}" == "--stage" ]] && ONLY_STAGE="${2:-}"

# ─── Helpers ─────────────────────────────────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_DIR/main.log"; }
log_section() { echo "" | tee -a "$LOG_DIR/main.log"; log "═══ $* ═══"; }

mark_done() {
  local stage="$1"
  echo "{}" > "$LOG_DIR/${stage}.done"
  log "✅ $stage complete"
}

is_done() {
  local stage="$1"
  [[ -f "$LOG_DIR/${stage}.done" ]]
}

should_run() {
  local stage="$1"
  if [[ -n "$ONLY_STAGE" && "$ONLY_STAGE" != "$stage" ]]; then return 1; fi
  if $RESUME && is_done "$stage"; then
    log "⏭  $stage already done — skipping (--resume)"
    return 1
  fi
  return 0
}

check_python() {
  python3 -c "import requests" 2>/dev/null || pip3 install requests -q
}

# ─── DB quick query helper ────────────────────────────────────────────────────

db_query() {
  sqlite3 "$REPO_ROOT/prisma/dev.db" "$1"
}

# ─── Pre-flight ───────────────────────────────────────────────────────────────

log_section "Pre-flight checks"
log "Repo: $REPO_ROOT"
log "Log dir: $LOG_DIR"
log "Run ID: $RUN_ID"

STOCKS=$(db_query "SELECT COUNT(*) FROM Stock;")
QUOTES=$(db_query "SELECT COUNT(*) FROM StockQuote;")
STOCKS_GE250=$(db_query "SELECT COUNT(*) FROM (SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= 250);")
CHIP_LATEST=$(db_query "SELECT MAX(date) FROM InstitutionalChip;")
SNAPSHOT_COUNT=$(db_query "SELECT COUNT(*) FROM AutonomousResearchSnapshot;")
TRADE_COUNT=$(db_query "SELECT COUNT(*) FROM SimulatedTrade;")
QUOTE_LATEST=$(db_query "SELECT MAX(date) FROM StockQuote;")
DAYS_STALE=$(python3 -c "from datetime import date; d=date.fromisoformat('$QUOTE_LATEST'); print((date.today()-d).days)" 2>/dev/null || echo "?")

log "  Stocks: $STOCKS  | QuoteRows: $QUOTES  | Stocks≥250days: $STOCKS_GE250"
log "  QuoteLatest: $QUOTE_LATEST ($DAYS_STALE days ago) | ChipLatest: $CHIP_LATEST"
log "  Snapshots: $SNAPSHOT_COUNT  | SimTrades: $TRADE_COUNT"

if [ "$DAYS_STALE" != "?" ] && [ "$DAYS_STALE" -gt 5 ]; then
  log "  ⚠️  DATA IS STALE ($DAYS_STALE days) — T0 freshness sync will run first"
fi

# Save pre-flight state
cat > "$LOG_DIR/preflight.json" <<EOF
{
  "runId": "$RUN_ID",
  "startedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "preflight": {
    "stocks": $STOCKS,
    "quoteRows": $QUOTES,
    "stocksGe250days": $STOCKS_GE250,
    "quoteLatest": "$QUOTE_LATEST",
    "daysStale": "$DAYS_STALE",
    "chipLatest": "$CHIP_LATEST",
    "snapshotCount": $SNAPSHOT_COUNT,
    "tradeCount": $TRADE_COUNT
  }
}
EOF

# ─── T0: Freshness Sync — update existing stocks to today ─────────────────────
#
# CRITICAL: dataCoverage is computed based on freshness (≤5 days = fresh).
# If quotes are stale, AutonomousDataLayer marks all coverage as 'insufficient',
# causing every proposal to fail the risk floor (adj_sizing < 0.01 → rejected).
# T0 syncs the RECENT months for already-tracked stocks WITHOUT --skip-ge250.
# This takes ~30min for 80 priority stocks.

if should_run "T0"; then
  log_section "T0: Freshness Sync (bring priority stocks to current date)"
  log "  Syncing recent 1 year for top 80 stocks — NO skip-ge250"
  log "  This fixes dataCoverage: insufficient → limited/full"

  check_python

  # NO --resume: force re-fetch regardless of state file (symbols may be marked
  # 'completed' from prior T1 runs but need their most recent months refreshed).
  # NO --skip-ge250: we WANT to update stocks that already have ≥250 days.
  python3 "$REPO_ROOT/scripts/backfill_stock_quote_full.py" \
    --years 1 \
    --top-cap 80 \
    --max-symbols 80 \
    --sleep-symbol 1.0 \
    --sleep-month 0.5 \
    2>&1 | tee "$LOG_DIR/T0-freshness-sync.log" || log "⚠️  T0 had errors (check log)"

  T0_LATEST=$(db_query "SELECT MAX(date) FROM StockQuote;")
  T0_DAYS=$(python3 -c "from datetime import date; d=date.fromisoformat('$T0_LATEST'); print((date.today()-d).days)" 2>/dev/null || echo "?")
  log "  Post-T0 quote latest: $T0_LATEST ($T0_DAYS days ago)"
  echo "{\"quoteLatest_after\": \"$T0_LATEST\", \"daysStale\": \"$T0_DAYS\"}" > "$LOG_DIR/T0.result.json"
  mark_done "T0"
fi

# ─── T1: StockQuote Backfill — Priority 300 stocks ────────────────────────────

if should_run "T1"; then
  log_section "T1: StockQuote Backfill (priority stocks, ≥250 days target)"
  log "  Scope: top-300 market-cap proxy, skipping already ≥250 days"
  log "  Resume enabled: checks logs/backfill_stock_quote_full_state.json"

  check_python

  python3 "$REPO_ROOT/scripts/backfill_stock_quote_full.py" \
    --years 3 \
    --top-cap 300 \
    --max-symbols 350 \
    --sleep-symbol 1.5 \
    --sleep-month 0.8 \
    --resume \
    --skip-ge250 \
    2>&1 | tee "$LOG_DIR/T1-quote-backfill.log" || log "⚠️  T1 had errors (check log)"

  # Capture post-T1 counts
  T1_AFTER=$(db_query "SELECT COUNT(*) FROM (SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= 250);")
  log "  Post-T1 stocks ≥250 days: $T1_AFTER (was $STOCKS_GE250)"
  echo "{\"stocksGe250_after\": $T1_AFTER}" > "$LOG_DIR/T1.result.json"
  mark_done "T1"
fi

# ─── T2: InstitutionalChip Backfill — 2026-03-19 to present ───────────────────

if should_run "T2"; then
  log_section "T2: InstitutionalChip Backfill (fill gaps to 2026-03-27)"
  log "  Scope: dates 2026-03-19 through today, all symbols, resume-safe"

  check_python

  python3 "$REPO_ROOT/scripts/backfill_chip_resilient.py" \
    --start 2026-03-19 \
    --end 2026-03-28 \
    --limit-dates 10 \
    --resume \
    --sleep 1.5 \
    --timeout 25 \
    2>&1 | tee "$LOG_DIR/T2-chip-backfill.log" || log "⚠️  T2 had errors (check log)"

  CHIP_AFTER=$(db_query "SELECT MAX(date) FROM InstitutionalChip;")
  CHIP_ROWS=$(db_query "SELECT COUNT(*) FROM InstitutionalChip WHERE date >= '2026-03-19';")
  log "  Post-T2 chip latest: $CHIP_AFTER | new rows: $CHIP_ROWS"
  echo "{\"chipLatest_after\": \"$CHIP_AFTER\", \"newRows\": $CHIP_ROWS}" > "$LOG_DIR/T2.result.json"
  mark_done "T2"
fi

# ─── T3: 30 Autonomous Daily Cycles (simulation replay) ───────────────────────
#
# Each cycle:
#   1. buildAutonomousDataSnapshot
#   2. buildAutonomousResearchSnapshot  
#   3. buildStrategyProposals (incl. learning feedback)
#   4. executeSimulationCycle (shadow/pending/full + Phase 2.5 promotion)
#   5. buildStrategyLearningInsight
#   6. runResearchCycle (non-blocking)
#
# The daily cycle is idempotent per snapshotDate (uses upsert).
# Using --force to override the idempotency guard for replay simulation.

if should_run "T3"; then
  log_section "T3: 30 Autonomous Daily Cycles (replay + bootstrap + promotion)"
  log "  Running 30 cycles with --force to bypass once-per-day idempotency"
  log "  Expected: shadow trades → promotion candidate accumulation → learning activation"

  CYCLE_PASS=0
  CYCLE_FAIL=0

  for i in $(seq 1 30); do
    CYCLE_LOG="$LOG_DIR/T3-cycle-$(printf '%02d' $i).json"
    log "  Cycle $i/30..."

    if TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
       npx ts-node -r tsconfig-paths/register \
       "$REPO_ROOT/scripts/run-autonomous-daily.ts" \
       --force \
       > "$CYCLE_LOG" 2>&1; then
      CYCLE_PASS=$((CYCLE_PASS + 1))
      # Show last meaningful line
      grep -o '"proposals":[0-9]*\|"trades":[0-9]*\|"reviews":[0-9]*' "$CYCLE_LOG" | tr '\n' ' ' | head -1 | xargs -I{} log "    cycle $i: {}"
    else
      CYCLE_FAIL=$((CYCLE_FAIL + 1))
      log "  ⚠️  Cycle $i failed — $(tail -1 $CYCLE_LOG)"
    fi

    # Brief pause between cycles to avoid DB contention
    sleep 3
  done

  TRADE_AFTER=$(db_query "SELECT COUNT(*) FROM SimulatedTrade;")
  SHADOW_AFTER=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status IN ('shadow-open','shadow-closed');")
  REVIEW_AFTER=$(db_query "SELECT COUNT(*) FROM TradeReviewReport;")
  log "  Post-T3: trades=$TRADE_AFTER shadow=$SHADOW_AFTER reviews=$REVIEW_AFTER pass=$CYCLE_PASS fail=$CYCLE_FAIL"
  echo "{\"cyclesPassed\": $CYCLE_PASS, \"cyclesFailed\": $CYCLE_FAIL, \"trades\": $TRADE_AFTER, \"shadowTrades\": $SHADOW_AFTER, \"reviews\": $REVIEW_AFTER}" > "$LOG_DIR/T3.result.json"
  mark_done "T3"
fi

# ─── T4: Review + Learning Cycle ───────────────────────────────────────────────

if should_run "T4"; then
  log_section "T4: Autonomous Review + Learning Cycle"

  log "  Running review cycle (generates TradeReviewReports for closed trades)..."
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
    npx ts-node -r tsconfig-paths/register \
    "$REPO_ROOT/scripts/run-autonomous-review.ts" \
    --force \
    2>&1 | tee "$LOG_DIR/T4-review.json"

  log "  Running learning cycle (builds StrategyLearningInsight)..."
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
    npx ts-node -r tsconfig-paths/register \
    "$REPO_ROOT/scripts/run-autonomous-learning.ts" \
    --force \
    2>&1 | tee "$LOG_DIR/T4-learning.json"

  REVIEWS=$(db_query "SELECT COUNT(*) FROM TradeReviewReport;")
  INSIGHTS=$(db_query "SELECT COUNT(*) FROM StrategyLearningInsight;")
  FULL_COUNT=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status='closed';")
  log "  Post-T4: reviews=$REVIEWS insights=$INSIGHTS fullTrades=$FULL_COUNT"
  echo "{\"reviews\": $REVIEWS, \"insights\": $INSIGHTS, \"fullTrades\": $FULL_COUNT}" > "$LOG_DIR/T4.result.json"
  mark_done "T4"
fi

# ─── T5: Research Experiment Cycle ─────────────────────────────────────────────

if should_run "T5"; then
  log_section "T5: Research Experiment Cycle (parameter versioning)"

  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
    npx ts-node -r tsconfig-paths/register \
    "$REPO_ROOT/scripts/run-autonomous-research.ts" \
    2>&1 | tee "$LOG_DIR/T5-research.json"

  mark_done "T5"
fi

# ─── T6: StockQuote Backfill — Next 300 stocks ────────────────────────────────
#
# This is the "expand universe" phase — runs if T1 finished and time allows.
# Targets stocks with 1–249 days that weren't covered in T1's top-300.

if should_run "T6"; then
  log_section "T6: StockQuote Backfill (next 300 stocks)"
  log "  Expanding coverage to more stocks — 1 year lookback"

  python3 "$REPO_ROOT/scripts/backfill_stock_quote_full.py" \
    --years 1 \
    --top-cap 600 \
    --max-symbols 300 \
    --sleep-symbol 1.2 \
    --sleep-month 0.6 \
    --resume \
    --skip-ge250 \
    2>&1 | tee "$LOG_DIR/T6-quote-backfill-2.log"

  T6_AFTER=$(db_query "SELECT COUNT(*) FROM (SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= 20);")
  log "  Post-T6 stocks ≥20 days: $T6_AFTER"
  echo "{\"stocksGe20_after\": $T6_AFTER}" > "$LOG_DIR/T6.result.json"
  mark_done "T6"
fi

# ─── T7: Promotion Readiness Analysis ─────────────────────────────────────────

if should_run "T7"; then
  log_section "T7: Promotion Mechanism Analysis"

  db_query "
  SELECT
    setupType,
    COUNT(*) as total,
    SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins,
    ROUND(AVG(pnlPct), 2) as avgPnl,
    ROUND(CAST(SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*),0) * 100, 1) as winRate
  FROM SimulatedTrade
  WHERE status = 'shadow-closed'
  GROUP BY setupType
  ORDER BY total DESC;
  " 2>&1 | tee "$LOG_DIR/T7-promotion-readiness.txt"

  db_query "
  SELECT
    status,
    COUNT(*) as count,
    ROUND(AVG(pnlPct), 2) as avgPnl
  FROM SimulatedTrade
  GROUP BY status;
  " 2>&1 | tee -a "$LOG_DIR/T7-promotion-readiness.txt"

  db_query "
  SELECT
    json_extract(marketContext, '$.tradeMode') as tradeMode,
    json_extract(marketContext, '$.promotionSource') as promotionSource,
    COUNT(*) as count
  FROM SimulatedTrade
  GROUP BY tradeMode, promotionSource;
  " 2>&1 | tee -a "$LOG_DIR/T7-promotion-readiness.txt"

  SHADOW_CLOSED=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status='shadow-closed';")
  PROMOTED=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE json_extract(marketContext,'$.promotionSource')='shadow_track_record';")
  log "  shadow-closed: $SHADOW_CLOSED | promoted: $PROMOTED"
  echo "{\"shadowClosed\": $SHADOW_CLOSED, \"promotedTrades\": $PROMOTED}" > "$LOG_DIR/T7.result.json"
  mark_done "T7"
fi

# ─── T8: 30 more cycles if time allows ────────────────────────────────────────

if should_run "T8"; then
  log_section "T8: Additional 30 Cycles (post-learning feedback test)"
  log "  Objective: test whether promotion activates and learning engages"

  CYCLE_PASS=0
  CYCLE_FAIL=0

  for i in $(seq 1 30); do
    CYCLE_LOG="$LOG_DIR/T8-cycle-$(printf '%02d' $i).json"
    log "  Cycle $i/30..."

    if TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
       npx ts-node -r tsconfig-paths/register \
       "$REPO_ROOT/scripts/run-autonomous-daily.ts" \
       --force \
       > "$CYCLE_LOG" 2>&1; then
      CYCLE_PASS=$((CYCLE_PASS + 1))
      grep -o '"proposals":[0-9]*\|"trades":[0-9]*\|"reviews":[0-9]*' "$CYCLE_LOG" | tr '\n' ' ' | head -1 | xargs -I{} log "    cycle $i: {}"
    else
      CYCLE_FAIL=$((CYCLE_FAIL + 1))
      log "  ⚠️  T8 cycle $i failed — $(tail -1 $CYCLE_LOG)"
    fi

    sleep 3
  done

  TRADE_AFTER=$(db_query "SELECT COUNT(*) FROM SimulatedTrade;")
  PENDING_AFTER=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE json_extract(marketContext,'$.tradeMode')='pending';")
  PROMOTED_AFTER=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE json_extract(marketContext,'$.promotionSource')='shadow_track_record';")
  log "  Post-T8: total=$TRADE_AFTER pending=$PENDING_AFTER promoted=$PROMOTED_AFTER pass=$CYCLE_PASS fail=$CYCLE_FAIL"
  echo "{\"totalTrades\": $TRADE_AFTER, \"pendingTrades\": $PENDING_AFTER, \"promotedTrades\": $PROMOTED_AFTER}" > "$LOG_DIR/T8.result.json"
  mark_done "T8"
fi

# ─── Final Report ──────────────────────────────────────────────────────────────

log_section "Final Report"

FINAL_QUOTES=$(db_query "SELECT COUNT(*) FROM (SELECT stockId FROM StockQuote GROUP BY stockId HAVING COUNT(*) >= 250);")
FINAL_CHIP=$(db_query "SELECT MAX(date) FROM InstitutionalChip;")
FINAL_SNAPSHOTS=$(db_query "SELECT COUNT(*) FROM AutonomousResearchSnapshot;")
FINAL_TRADES=$(db_query "SELECT COUNT(*) FROM SimulatedTrade;")
FINAL_SHADOW_CLOSED=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status='shadow-closed';")
FINAL_FULL_CLOSED=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status='closed';")
FINAL_REVIEWS=$(db_query "SELECT COUNT(*) FROM TradeReviewReport;")
FINAL_INSIGHTS=$(db_query "SELECT COUNT(*) FROM StrategyLearningInsight;")
FINAL_PROMOTED=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE json_extract(marketContext,'$.promotionSource')='shadow_track_record' OR status='open';")

log "Stocks ≥250 days:   $STOCKS_GE250 → $FINAL_QUOTES"
log "Chip latest:        $CHIP_LATEST → $FINAL_CHIP"
log "Snapshots:          $SNAPSHOT_COUNT → $FINAL_SNAPSHOTS"
log "Simulated trades:   $TRADE_COUNT → $FINAL_TRADES"
log "  shadow-closed:    $FINAL_SHADOW_CLOSED"
log "  full-closed:      $FINAL_FULL_CLOSED"
log "Trade reviews:      $FINAL_REVIEWS"
log "Learning insights:  $FINAL_INSIGHTS"

# Determine learning readiness
SHADOW_REBOUND=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status='shadow-closed' AND setupType='rebound';")
if [ "$SHADOW_REBOUND" -ge 5 ]; then
  log "🟢 Promotion ELIGIBLE: rebound has $SHADOW_REBOUND shadow-closed trades (≥5 required)"
else
  log "🟡 Promotion NOT YET ELIGIBLE: rebound has only $SHADOW_REBOUND shadow-closed trades (<5 required)"
fi

FULL_TRADE_COUNT=$(db_query "SELECT COUNT(*) FROM SimulatedTrade WHERE status='closed';")
if [ "$FULL_TRADE_COUNT" -ge 5 ]; then
  log "🟢 Learning ACTIVE: $FULL_TRADE_COUNT full trades closed (≥5 required for penalty adjustments)"
else
  log "🟡 Learning PROTECTED: only $FULL_TRADE_COUNT full trades closed (<5, penalties blocked)"
fi

cat > "$LOG_DIR/final-report.json" <<EOF
{
  "runId": "$RUN_ID",
  "completedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "stocksGe250_before": $STOCKS_GE250,
  "stocksGe250_after": $FINAL_QUOTES,
  "chipLatest_before": "$CHIP_LATEST",
  "chipLatest_after": "$FINAL_CHIP",
  "snapshots_after": $FINAL_SNAPSHOTS,
  "trades_after": $FINAL_TRADES,
  "shadowClosed": $FINAL_SHADOW_CLOSED,
  "fullClosed": $FINAL_FULL_CLOSED,
  "reviews": $FINAL_REVIEWS,
  "learningInsights": $FINAL_INSIGHTS,
  "promotionEligible": $([ "$SHADOW_REBOUND" -ge 5 ] && echo true || echo false),
  "learningActive": $([ "$FULL_TRADE_COUNT" -ge 5 ] && echo true || echo false)
}
EOF

log ""
log "Log directory: $LOG_DIR"
log "Done."
