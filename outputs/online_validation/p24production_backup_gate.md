# P24-HARDRESET: Production Backup Gate

**Generated:** 2026-05-12T07:16:26.182Z  
**Backup Status:** ✅ PASS  
**Token:** VERIFIED  

## Pre-Backup State

| Field | Value |
|-------|-------|
| DB File | `prisma/dev.db` |
| DB File Size | 53.6 MB |
| MonthlyRevenue rows (pre-migration) | 2143 |

## Backup Details

| Field | Value |
|-------|-------|
| Backup Path | `prisma/dev.p24_premigration_backup_2026-05-12_0716.db` |
| Checksum File | `prisma/dev.p24_premigration_backup_2026-05-12_0716.db.sha256` |
| sha256 | `a5cf277182c161dfe97ba05f9b81528d6c8e477dd5ac0bec6810ffbb8711c6f8` |
| Timestamp | 2026-05-12_0716 |
| Status | PASS |

## Pre-Migration Schema Snapshot

```
0|id|INTEGER|1||1
1|stockId|TEXT|1||0
2|year|INTEGER|1||0
3|month|INTEGER|1||0
4|revenue|REAL|1||0
5|yoyGrowth|REAL|0||0
6|momGrowth|REAL|0||0
7|createdAt|DATETIME|1|CURRENT_TIMESTAMP|0
```

## Backup Status: PASS

✅ Backup complete. Safe to proceed to migration gate.

---

*DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.*
