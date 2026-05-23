# P17 Branch Protection Plan — Stock-Prediction-System

**Date**: 2026-05-24
**Author**: CTO Agent (P17)
**Repo**: kelvinhuang0327/Stock-Prediction-System
**Branch**: main
**Current protection state**: NONE (HTTP 404 — "Branch not protected")

---

## 1. CI Green Run Evidence

| CI Run | Workflow | SHA | Result |
|--------|----------|-----|--------|
| 26333654132 | Test Gate — 5121/5121 Baseline | ab7090b (P16b) | ALL GREEN |
| — | onlineValidation (4846/4846) | — | PASS (1m29s) |
| — | research + simulation (275/275) | — | PASS (37s) |
| — | Dirty-File Bleed-Through Guard | — | PASS (7s) |

View: https://github.com/kelvinhuang0327/Stock-Prediction-System/actions/runs/26333654132

---

## 2. Required Checks — Proposed

The workflow file `.github/workflows/test-gate.yml` defines three jobs. For GitHub's required-status-checks, the check name must match the job's `name:` field exactly (not the YAML key).

| YAML Job Key | Display Name (required-check string) | Purpose |
|---|---|---|
| `online-validation` | `onlineValidation (4846/4846)` | 4846 online validation tests |
| `research-simulation` | `research + simulation (275/275)` | 275 research/simulation tests |
| `dirty-file-guard` | `Dirty-File Bleed-Through Guard` | Prevents logs/runtime/data leakage |

All three must pass before a PR can merge to `main`.

---

## 3. Recommended Branch Protection Settings

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "onlineValidation (4846/4846)",
      "research + simulation (275/275)",
      "Dirty-File Bleed-Through Guard"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false
}
```

**Notes**:
- `strict: true` — branch must be up-to-date with main before checks run. Prevents merging stale PRs even if checks passed on older base.
- `enforce_admins: false` — repo owner (kelvinhuang0327) retains emergency bypass. Set to `true` for stronger governance.
- `required_pull_request_reviews: null` — single-developer project; PR reviews not required. Enable when adding collaborators.
- `required_linear_history: true` — prohibit merge commits; require rebase/squash. Consistent with P15b history rewrite goal.
- `allow_force_pushes: false` — prohibit force push. NOTE: P15b required a force push to clean logs/. Emergency bypass via `enforce_admins: false` or temporary disable.

---

## 4. Authorization Gate

The following phrase is required to execute GitHub branch protection mutation:
```
YES configure branch protection
```

**Do NOT run the GitHub API mutation without this phrase.**

### What the mutation will do (when authorized)

```bash
gh api repos/kelvinhuang0327/Stock-Prediction-System/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["onlineValidation (4846/4846)","research + simulation (275/275)","Dirty-File Bleed-Through Guard"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews=null \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

Pre-flight before mutation:
1. Confirm `git rev-parse HEAD` = `ab7090b` (or latest green)
2. Confirm CI run is green (not in-progress)
3. Read current protection state (expect 404)
4. Execute API call
5. Read back protection state and verify

---

## 5. Rollback Plan

If branch protection causes unexpected workflow issues (e.g., required check name drift after test count changes):

**Rollback command** (removes all protection):
```bash
gh api repos/kelvinhuang0327/Stock-Prediction-System/branches/main/protection \
  --method DELETE
```

**Test count drift scenario**: If test baselines change (e.g., tests added, baseline becomes 5200/5200), the job display name will change from `onlineValidation (4846/4846)` to a new count. Branch protection required-check strings are exact-match — the old string would no longer be fulfilled, blocking all merges.

**Fix for test count drift**:
1. Update required-checks via `gh api PUT` with new check names
2. Or set the check names to use the YAML job keys instead (not supported by GitHub API directly — only display names are accepted)
3. Recommended: maintain the display name as the canonical count string; update branch protection when baseline is intentionally changed.

---

## 6. Risks

| Risk | Severity | Notes |
|------|----------|-------|
| **Node.js 20 deprecation — URGENT** | CRITICAL | GitHub Actions forces Node 24 on **June 2, 2026 (9 days)**. `actions/checkout@v4` and `actions/setup-node@v4` run on Node 20. Will break CI. Must update to `@v5` or set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` before June 2. |
| Test count name drift | HIGH | If baseline changes, `onlineValidation (4846/4846)` check name becomes stale and blocks merges |
| `enforce_admins: false` allows admin bypass | MEDIUM | Emergency escape hatch; set to `true` once branch health is stable |
| `allow_force_pushes: false` blocks emergency rebase | MEDIUM | Use `gh api DELETE .../protection` temporarily if force push needed |
| PR review not required | LOW | Acceptable for solo development; revisit on first collaborator |

---

## 7. Node.js 20 Deprecation — URGENT Action Required

**Deadline**: June 2, 2026 (**9 days from today**, 2026-05-24)

GitHub will force Node.js 24 as the default for Actions runners on June 2, 2026. After that date, `actions/checkout@v4` and `actions/setup-node@v4` may fail or produce unexpected behavior.

**Required changes to `.github/workflows/test-gate.yml`**:
```yaml
# Change:
uses: actions/checkout@v4
# To:
uses: actions/checkout@v4  # OR upgrade to v5 (supports Node 24 natively)
```

**Recommended fix** (two options):
1. **Pin to v4 with opt-in** (fastest): Add `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at workflow level
2. **Upgrade to v5** (proper): `actions/checkout@v5`, `actions/setup-node@v5` — full Node 24 support

Authorization phrase for this action: `YES update actions node versions`

---

## 8. Exact Authorization Needed for GitHub Mutation

To execute branch protection configuration, user must say:
```
YES configure branch protection
```

This will:
- Read current state (currently: 404 / not protected)
- Apply PUT with settings in Section 3
- Verify protection is active
- Log result in P17 final report
