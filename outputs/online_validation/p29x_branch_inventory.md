# P29X Branch Inventory

**Phase:** P29X — Mainline Consolidation and Merged Branch Archival  
**Date:** 2026-05-20

## Local Branch Classification

| Branch | Tip | Classification | Action |
|--------|-----|----------------|--------|
| `main` | `676266d` | ACTIVE_CURRENT | Keep as active mainline |
| `claude/frosty-borg-e85827` | `51d15df` | SUPERSEDED_BY_MAIN | Archive → `merged/20260520/` |
| `claude/frosty-visvesvaraya-ff0e3f` | `330b8ea` | MERGED_IN_MAIN | Archive → `merged/20260520/` |
| `claude/loving-mirzakhani-b7a453` | `675771a` | MERGED_IN_MAIN | Archive → `merged/20260520/` |
| `claude/objective-kalam-b00477` | `ecd5c86` | SUPERSEDED_BY_MAIN | Archive → `merged/20260520/` |
| `claude/optimistic-spence-419897` | `5260be3` | MERGED_IN_MAIN | Archive → `merged/20260520/` |
| `claude/quirky-black-eb3d86` | `2da1203` | MERGED_IN_MAIN | Archive → `merged/20260520/` |
| `claude/stupefied-cray-62e312` | `4c7cab7` | MERGED_IN_MAIN | Archive → `merged/20260520/` |

## Remote Branch Classification

| Branch | Classification |
|--------|----------------|
| `origin/main` | DO_NOT_TOUCH |
| `origin/dependabot/*` (7 branches) | DO_NOT_TOUCH |

## Summary

| Category | Count |
|----------|-------|
| ACTIVE_CURRENT | 1 (`main`) |
| MERGED_IN_MAIN | 5 |
| SUPERSEDED_BY_MAIN | 2 |
| NEEDS_REVIEW_BEFORE_ARCHIVE | 0 |
| DO_NOT_TOUCH | 9 (remote) |

## Superseded Branch Details

### `claude/frosty-borg-e85827` (P29E original)
- 1 unique commit (`51d15df`) not in main ancestry
- Contains P29E artifact reports and original scaffold source
- **Superseded by:** P29H (`53cbdd2`) re-implemented P29E on main; P29G (`676266d`) extended it
- Main has P29F/P29G source files that this branch does NOT have

### `claude/objective-kalam-b00477` (P29D)
- 1 unique commit (`ecd5c86`) not in main ancestry
- Contains FinancialReport/NewsEvent manual dropzone scaffold templates
- **Superseded by:** Dropzone files already present as untracked in main's working tree
- User policy explicitly prohibits cherry-picking P29D into main

**→ NEEDS_REVIEW_BEFORE_ARCHIVE count: 0**  
All branches are safe to archive with no content loss risk.
