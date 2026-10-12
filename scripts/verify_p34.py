import json, os

files = [
    "outputs/online_validation/p34_news_event_source_present_dry_run.json",
    "outputs/online_validation/p34_news_event_dry_run_sample.json",
    "outputs/online_validation/p34_news_event_pit_audit.json",
    "outputs/online_validation/p34_spec_conformance.json",
    "outputs/online_validation/p34_forbidden_claims_scan.json",
]

failures = []
for fp in files:
    if not os.path.exists(fp):
        failures.append("MISSING: " + fp)
        continue
    try:
        d = json.load(open(fp))
    except Exception as e:
        failures.append("JSON_ERR " + fp + ": " + str(e))
        continue
    fname = os.path.basename(fp)
    for flag, exp in [
        ("entersAlphaScore", False), ("paperOnly", True), ("dryRun", True),
        ("notInvestmentRecommendation", True), ("noBuySellActionSemantics", True)
    ]:
        if flag in d and d[flag] != exp:
            failures.append("FLAG_MISMATCH " + fname + " " + flag + "=" + str(d[flag]))

dj = json.load(open("outputs/online_validation/p34_news_event_source_present_dry_run.json"))
rc = dj["rowCounts"]
total, ready, blocked, skipped = rc["total"], rc["readyRows"], rc["blockedRows"], rc["skippedRows"]
if ready + blocked + skipped != total:
    failures.append("ROW_COUNT_MISMATCH: %d+%d+%d!=%d" % (ready, blocked, skipped, total))
else:
    print("ROW_COUNT OK: %d+%d+%d=%d" % (ready, blocked, skipped, total))

pa = json.load(open("outputs/online_validation/p34_news_event_pit_audit.json"))
print("PIT: cov=%s%%, nulls=%s, anomalies=%s, result=%s" % (
    pa["coverage"]["publishedAtCoveragePct"],
    pa["coverage"]["publishedAtNullCount"],
    pa["pitTimingAnomalies"]["rowsWherePublishedAtAfterIngestedAt"],
    pa["pitAuditResult"]
))

sc = json.load(open("outputs/online_validation/p34_spec_conformance.json"))
print("CONFORMANCE: " + sc["overallConformanceResult"])

fc = json.load(open("outputs/online_validation/p34_forbidden_claims_scan.json"))
print("CLAIMS SCAN: live=%d, result=%s" % (fc["liveClaimCount"], fc["scanResult"]))

print("FILES:")
for fp in files:
    print("  " + ("EXISTS" if os.path.exists(fp) else "MISSING") + "  " + fp)

if failures:
    print("FAILURES:")
    for f in failures:
        print("  - " + f)
    import sys; sys.exit(1)
else:
    print("\nD7 VERIFICATION: PASS")
