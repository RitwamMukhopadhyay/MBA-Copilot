import sqlite3
from datetime import datetime
from pathlib import Path


DB_PATH = (
    Path(__file__)
    .resolve()
    .parent.parent.parent
    / "database"
    / "mba_copilot_v2.db"
)


def create_event(
    title,
    event_type,
    event_date,
    event_time="",
    description=""
):

    try:

        print("\n========== CREATE EVENT ==========")
        print("DATABASE =", DB_PATH)
        print("TITLE =", title)
        print("TYPE =", event_type)
        print("DATE =", event_date)
        print("TIME =", event_time)
        print("DESCRIPTION =", description)
        print("==================================\n")

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO events
            (
                title,
                subject_id,
                event_type,
                event_date,
                event_time,
                description,
                created_at,
                is_completed
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            (
                title,
                None,
                event_type,
                event_date,
                event_time,
                description,
                datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                0
            )
        )

        conn.commit()

        event_id = cursor.lastrowid

        print("\n========== EVENT CREATED ==========")
        print("EVENT ID =", event_id)
        print("===================================\n")

        conn.close()

        return {
            "success": True,
            "event_id": event_id,
            "message": f"Event '{title}' created successfully."
        }

    except Exception as e:

        print("\n========== CREATE EVENT ERROR ==========")
        print(str(e))
        print("========================================\n")

        return {
            "success": False,
            "error": str(e)
        }