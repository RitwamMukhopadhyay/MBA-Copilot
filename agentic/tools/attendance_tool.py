from pathlib import Path
import sqlite3

DB_PATH = (
    Path(__file__)
    .resolve()
    .parent.parent.parent
    / "database"
    / "mba_copilot_v2.db"
)

def get_attendance():

    try:

        conn = sqlite3.connect(DB_PATH)

        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                s.name,
                COUNT(
                    CASE
                    WHEN a.status='Present'
                    THEN 1
                    END
                ) AS present,

                COUNT(
                    CASE
                    WHEN a.status='Absent'
                    THEN 1
                    END
                ) AS absent

            FROM subjects s

            LEFT JOIN attendance a
            ON s.id = a.subject_id

            GROUP BY s.id
            """
        )

        rows = cursor.fetchall()

        conn.close()

        results = []

        for row in rows:

            present = row["present"] or 0
            absent = row["absent"] or 0

            total = present + absent

            percentage = 0

            if total > 0:

                percentage = round(
                    (present / total) * 100,
                    2
                )

            results.append(
                {
                    "subject": row["name"],
                    "present": present,
                    "absent": absent,
                    "attendance_percentage": percentage
                }
            )

        return results

    except Exception as e:

        return {
            "error": str(e)
        }