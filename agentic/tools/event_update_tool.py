import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__)
    .resolve()
    .parent.parent.parent
    / "database"
    / "mba_copilot_v2.db"
)


def update_event(
    event_id,
    title,
    event_type,
    event_date,
    event_time,
    description
):

    try:

        print("\n========== UPDATE EVENT ==========")
        print("DATABASE =", DB_PATH)
        print("EVENT ID =", event_id)
        print("TITLE =", title)
        print("DATE =", event_date)
        print("TIME =", event_time)
        print("==================================\n")

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE events
            SET
                title = ?,
                event_type = ?,
                event_date = ?,
                event_time = ?,
                description = ?
            WHERE id = ?
            """,
            (
                title,
                event_type,
                event_date,
                event_time,
                description,
                event_id
            )
        )

        conn.commit()

        updated_rows = cursor.rowcount

        conn.close()

        if updated_rows == 0:

            return {
                "success": False,
                "message": "Event not found."
            }

        return {
            "success": True,
            "message": f"Event {event_id} updated successfully."
        }

    except Exception as e:

        print("\n========== UPDATE ERROR ==========")
        print(str(e))
        print("==================================\n")

        return {
            "success": False,
            "error": str(e)
        }