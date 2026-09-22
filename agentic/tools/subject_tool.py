import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__)
    .resolve()
    .parent.parent.parent
    / "database"
    / "mba_copilot_v2.db"
)


def get_subjects():

    try:

        print(
            "\n===== SUBJECT TOOL ====="
        )

        print(
            "DB PATH:",
            DB_PATH
        )

        conn = sqlite3.connect(
            DB_PATH
        )

        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                course_code,
                name,
                credits,
                faculty,
                term
            FROM subjects
            """
        )

        rows = cursor.fetchall()

        conn.close()

        subjects = []

        for row in rows:

            subjects.append(
                {
                    "course_code": row[0],
                    "name": row[1],
                    "credits": row[2],
                    "faculty": row[3],
                    "term": row[4]
                }
            )

        return subjects

    except Exception as e:

        print(
            "\nSUBJECT TOOL ERROR:",
            str(e)
        )

        return {
            "error": str(e)
        }