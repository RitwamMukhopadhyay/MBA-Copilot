import sqlite3
from pathlib import Path

DB_PATH = (
    Path(__file__)
    .resolve()
    .parent.parent.parent
    / "database"
    / "mba_copilot_v2.db"
)


def get_all_events():

    try:

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()

        cursor.execute("""
        SELECT
            e.id,
            e.title,
            e.event_type,
            e.event_date,
            e.event_time,
            e.description,
            e.is_completed,
            s.name as subject_name
        FROM events e
        LEFT JOIN subjects s ON e.subject_id = s.id
        ORDER BY e.event_date ASC,
                 e.event_time ASC
        """)

        rows = cursor.fetchall()
        events = []
        for row in rows:
            events.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "event_type": row["event_type"],
                    "event_date": row["event_date"],
                    "event_time": row["event_time"],
                    "description": row["description"],
                    "is_completed": row["is_completed"]
                }
            )

        # Fetch all exams
        cursor.execute(
            """
            SELECT
                e.id,
                'Exam: ' || s.name AS title,
                e.subject_id,
                e.exam_date AS event_date,
                'Exam' AS event_type,
                '09:00' AS event_time,
                e.notes AS description,
                e.is_completed,
                s.name AS subject_name
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id = s.id
            """
        )
        exams_rows = cursor.fetchall()
        for row in exams_rows:
            events.append(
                {
                    "id": f"exam_{row['id']}",
                    "title": row["title"],
                    "event_type": row["event_type"],
                    "event_date": row["event_date"],
                    "event_time": row["event_time"],
                    "description": row["description"],
                    "is_completed": row["is_completed"]
                }
            )

        conn.close()

        events.sort(key=lambda x: x["event_date"])
        return events

    except Exception as e:

        return {
            "error": str(e)
        }


def get_upcoming_events():

    try:

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()

        cursor.execute("""
        SELECT
            e.id,
            e.title,
            e.event_type,
            e.event_date,
            e.event_time,
            e.description,
            e.is_completed,
            s.name as subject_name
        FROM events e
        LEFT JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_completed = 0
        ORDER BY e.event_date ASC,
                 e.event_time ASC
        """)

        rows = cursor.fetchall()
        events = []
        for row in rows:
            events.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "event_type": row["event_type"],
                    "event_date": row["event_date"],
                    "event_time": row["event_time"],
                    "description": row["description"],
                    "is_completed": row["is_completed"]
                }
            )

        # Fetch active upcoming exams
        cursor.execute(
            """
            SELECT
                e.id,
                'Exam: ' || s.name AS title,
                e.subject_id,
                e.exam_date AS event_date,
                'Exam' AS event_type,
                '09:00' AS event_time,
                e.notes AS description,
                e.is_completed,
                s.name AS subject_name
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE e.is_completed = 0
            """
        )
        exams_rows = cursor.fetchall()
        for row in exams_rows:
            events.append(
                {
                    "id": f"exam_{row['id']}",
                    "title": row["title"],
                    "event_type": row["event_type"],
                    "event_date": row["event_date"],
                    "event_time": row["event_time"],
                    "description": row["description"],
                    "is_completed": row["is_completed"]
                }
            )

        conn.close()

        events.sort(key=lambda x: x["event_date"])
        return events

    except Exception as e:

        return {
            "error": str(e)
        }


def get_events_by_date(date_string):

    try:

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("""
        SELECT
            id,
            title,
            event_type,
            event_date,
            event_time,
            description,
            is_completed
        FROM events
        WHERE event_date = ?
        ORDER BY event_time ASC
        """, (date_string,))

        rows = cursor.fetchall()

        conn.close()

        events = []

        for row in rows:

            events.append(
                {
                    "id": row[0],
                    "title": row[1],
                    "event_type": row[2],
                    "event_date": row[3],
                    "event_time": row[4],
                    "description": row[5],
                    "is_completed": row[6]
                }
            )

        return events

    except Exception as e:

        return {
            "error": str(e)
        }
    
def get_event_by_id(event_id):

    try:

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("""
        SELECT *
        FROM events
        WHERE id = ?
        """, (event_id,))

        row = cursor.fetchone()

        conn.close()

        return row

    except Exception as e:

        return {
            "error": str(e)
        }


def get_event_by_title(title):

    try:

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("""
        SELECT *
        FROM events
        WHERE title LIKE ?
        """, (f"%{title}%",))

        rows = cursor.fetchall()

        conn.close()

        return rows

    except Exception as e:

        return {
            "error": str(e)
        }
    
def get_event_dict_by_title(title):

    rows = get_event_by_title(title)

    if not rows:
        return None

    row = rows[0]

    return {
        "id": row[0],
        "title": row[1],
        "subject_id": row[2],
        "event_type": row[3],
        "event_date": row[4],
        "event_time": row[5],
        "description": row[6]
    }