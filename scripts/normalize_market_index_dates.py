"""
Normalize MarketIndex date format to ISO YYYY-MM-DD and remove duplicates safely.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "prisma" / "dev.db"


def to_iso(date_raw: str) -> str:
    d = (date_raw or "").strip()
    if len(d) == 10 and d[4] == "-" and d[7] == "-":
        return d
    if len(d) == 8 and d.isdigit():  # YYYYMMDD
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}"
    if len(d) == 7 and d.isdigit():  # ROC 7 digits
        year = int(d[:3]) + 1911
        return f"{year}-{d[3:5]}-{d[5:7]}"
    return d


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM MarketIndex")
    before_rows = cur.fetchone()[0]
    cur.execute("SELECT date FROM MarketIndex")
    rows = cur.fetchall()

    converted = 0
    for (raw_date,) in rows:
        normalized = to_iso(raw_date)
        if normalized != raw_date:
            cur.execute("UPDATE MarketIndex SET date = ? WHERE date = ?", (normalized, raw_date))
            converted += cur.rowcount

    # dedupe by keeping latest createdAt then largest id
    cur.execute(
        """
        DELETE FROM MarketIndex
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY name, date
                     ORDER BY datetime(createdAt) DESC, id DESC
                   ) AS rn
            FROM MarketIndex
          ) t
          WHERE t.rn > 1
        )
        """
    )
    deleted = cur.rowcount
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM MarketIndex")
    after_rows = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM MarketIndex WHERE NOT (length(date)=10 AND substr(date,5,1)='-' AND substr(date,8,1)='-')")
    non_iso = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM (SELECT name, date, COUNT(*) c FROM MarketIndex GROUP BY name, date HAVING c>1)")
    dup_groups = cur.fetchone()[0]
    cur.execute("SELECT MIN(date), MAX(date) FROM MarketIndex")
    min_date, max_date = cur.fetchone()

    print(
        {
            "beforeRows": before_rows,
            "afterRows": after_rows,
            "convertedRows": converted,
            "deletedDuplicates": deleted,
            "nonIsoRows": non_iso,
            "duplicateGroups": dup_groups,
            "dateRange": [min_date, max_date],
        }
    )
    conn.close()


if __name__ == "__main__":
    main()
