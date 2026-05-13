import json, sys
from datetime import datetime, timezone

d = json.load(sys.stdin)
now = datetime.now(timezone.utc)

print("=== QUOTES ===")
for q in d["quotes"]:
    created = datetime.fromisoformat(q["createdAt"].replace("Z", "+00:00"))
    age_h = round((now - created).total_seconds() / 3600, 1)
    advanced = q["date"] > "2026-04-30"
    stale_guard = age_h > 48
    vol = q.get("volume", "n/a")
    print("  %s: date=%s close=%s high=%s low=%s vol=%s age=%sh advanced=%s stale_block=%s" % (
        q["stockId"], q["date"], q["close"], q["high"], q["low"], vol, age_h, advanced, stale_guard))

print("\n=== QUOTE FRESHNESS (calendar-aware) ===")
for sym, f in d.get("quoteFreshness", {}).items():
    print("  %s:" % sym)
    print("    latestQuoteDate       = %s" % f["latestQuoteDate"])
    print("    expectedQuoteDate     = %s" % f["expectedQuoteDate"])
    print("    marketCalendarStatus  = %s" % f["marketCalendarStatus"])
    print("    freshnessClassification = %s" % f["freshnessClassification"])
    print("    nextExpectedTradingDate = %s" % f["nextExpectedTradingDate"])
    print("    isStale               = %s" % f["isStale"])

print("\n=== RECENT 2027 QUOTES (last 3) ===")
for q in d.get("recent2027", []):
    print("  %s close=%s high=%s low=%s" % (q["date"], q["close"], q["high"], q["low"]))

print("\n=== SYNC LOGS (latest 5) ===")
for s in d.get("syncLogs", []):
    print("  id=%d endpoint=%-25s status=%s recs=%s at=%s" % (
        s["id"], s["endpoint"], s["status"], s.get("records","?"), s.get("syncedAt","?")[:19]))

print("\n=== TRADES ===")
stop = -3.8
target = 4.5
max_hold = 6
review_pct = 3.0
for t in sorted(d["trades"], key=lambda x: x["id"]):
    upd = datetime.fromisoformat(t["updatedAt"].replace("Z", "+00:00"))
    upd_min = round((now - upd).total_seconds() / 60, 1)
    pnl = t["pnlPct"] if t["pnlPct"] is not None else 0.0
    mae = t["maePct"] if t["maePct"] is not None else 0.0
    mfe = t["mfePct"] if t["mfePct"] is not None else 0.0
    stop_headroom = round(mae - stop, 3)
    target_gap = round(target - pnl, 3)
    days_to_time_exit = max_hold - (t["holdingDays"] or 0)
    if t["exitReason"]:
        classification = "CLOSED"
    elif pnl <= stop:
        classification = "STOP_TRIGGERED"
    elif pnl >= target:
        classification = "TARGET_TRIGGERED"
    elif days_to_time_exit <= 0:
        classification = "TIME_EXIT_PENDING"
    else:
        classification = "STILL_OPEN_HEALTHY"
    print("  id=%d %s %s/%s holdDays=%d pnl=%.3f%% mfe=%.3f%% mae=%.3f%% stop_hdroom=%.3f%% tgt_gap=%.3f%% daysToTimeExit=%d exit=%s updMin=%.1f -> %s" % (
        t["id"], t["symbol"], t["tradeMode"], t["status"],
        t["holdingDays"] or 0, pnl, mfe, mae,
        stop_headroom, target_gap, days_to_time_exit,
        t["exitReason"], upd_min, classification))

print("\n=== REVIEWS (trades 314/315/316) ===")
print(" ", d["reviews"])

print("\n=== MONITOR RUNS (latest 2) ===")
for m in d["monitorRuns"][:2]:
    print("  [%d] %s status=%s at=%s" % (m["id"], m["jobName"], m["status"], m["finishedAt"]))
    print("     ", m["summary"])

print("\n=== ACTIVE INSIGHTS ===")
for ins in d["activeInsights"]:
    exp = datetime.fromisoformat(ins["expiresAt"].replace("Z", "+00:00"))
    expired = exp < now
    print("  id=%d %s sev=%s expiresAt=%s EXPIRED=%s" % (
        ins["id"], ins["insightType"], ins["severity"], ins["expiresAt"], expired))

print("\n=== LLM USAGE (last 10 decisions) ===")
executions = []
for e in d.get("llmUsageLast10", []):
    if not isinstance(e, dict):
        continue
    decision = e.get("decision", "")
    caller = e.get("caller", "")
    provider = e.get("provider", "")
    ts = e.get("timestamp") or e.get("at", "")
    skip = e.get("skipReason") or e.get("skip_reason", "")
    is_exec = decision in ("execute", "success") and caller not in ("cto",)
    print("  caller=%-12s provider=%-18s decision=%-8s skip=%-30s at=%s" % (
        caller, provider, decision, str(skip)[:30], ts[:23]))
    if is_exec:
        executions.append(e)
print("\n  EXTERNAL LLM EXECUTIONS this session: %d" % len(executions))
if executions:
    for ex in executions:
        print("  !! EXECUTION caller=%s provider=%s at=%s" % (
            ex.get("caller"), ex.get("provider"), ex.get("timestamp") or ex.get("at")))

print("\n=== LAST WORKER RUN ===")
lw = d.get("lastWorker", {})
print("  id=%s status=%s summary=%s at=%s" % (
    lw.get("id"), lw.get("status"), lw.get("summary"), lw.get("finishedAt")))

print("\n=== LATEST LEARNING ===")
ll = d.get("latestLearning", {})
print("  id=%s sourceCount=%s generatedAt=%s" % (ll.get("id"), ll.get("sourceCount"), ll.get("generatedAt")))
print(" ", ll.get("summary", ""))
