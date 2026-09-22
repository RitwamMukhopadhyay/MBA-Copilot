import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__)
    .resolve()
    .parent.parent.parent
    / "database"
    / "mba_copilot_v2.db"
)


def delete_event(event_id):

    try:

        print("\n========== DELETE EVENT ==========")
        print("DATABASE =", DB_PATH)
        print("EVENT ID =", event_id)
        print("==================================\n")

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute(
            """
            DELETE FROM events
            WHERE id = ?
            """,
            (event_id,)
        )

        conn.commit()

        deleted_rows = cursor.rowcount

        conn.close()

        if deleted_rows == 0:

            return {
                "success": False,
                "message": "Event not found."
            }

        return {
            "success": True,
            "message": f"Event {event_id} deleted successfully."
        }

    except Exception as e:

        print("\n========== DELETE ERROR ==========")
        print(str(e))
        print("==================================\n")

        return {
            "success": False,
            "error": str(e)
        }