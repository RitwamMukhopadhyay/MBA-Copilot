from database import get_connection
from datetime import datetime, timedelta


def check_and_archive_expired_events():
    """
    Automatically archive events that have passed.
    
    Rules:
    - Date-only events: archive after that day (next day at 00:00)
    - Date + Time events: archive 1 hour after event time
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all active events
    cursor.execute("""
        SELECT id, event_date, event_time, is_completed
        FROM events
        WHERE is_completed = 0
    """)
    
    events = cursor.fetchall()
    now = datetime.now()
    
    for event in events:
        event_date = event['event_date']  # YYYY-MM-DD format
        event_time = event['event_time']  # HH:MM or None
        
        try:
            if event_time and event_time.strip():
                # Date + Time event: archive 1 hour after event time
                event_datetime = datetime.strptime(f"{event_date} {event_time}", "%Y-%m-%d %H:%M")
                archive_time = event_datetime + timedelta(hours=1)
            else:
                # Date-only event: archive next day at 00:00
                event_datetime = datetime.strptime(event_date, "%Y-%m-%d")
                archive_time = event_datetime + timedelta(days=1)
            
            # If current time is past archive time, mark as completed
            if now > archive_time:
                cursor.execute("""
                    UPDATE events
                    SET is_completed = 1
                    WHERE id = ?
                """, (event['id'],))
        except (ValueError, TypeError):
            # Handle date parsing errors gracefully
            pass
    
    conn.commit()
    conn.close()


def add_event(event):

    conn = get_connection()
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
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event.title,
            event.subject_id,
            event.event_type,
            event.event_date,
            event.event_time,
            event.description,
            datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        )
    )

    conn.commit()
    conn.close()

    return {
        "message": "Event added"
    }


def get_events():
    """Get all active events (is_completed = 0), active assignments, and active exams"""
    check_and_archive_expired_events()
    
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            e.*,
            s.name AS subject_name
        FROM events e
        LEFT JOIN subjects s
        ON e.subject_id = s.id
        WHERE e.is_completed = 0
        ORDER BY event_date ASC
        """
    )
    events = [
        dict(row)
        for row in cursor.fetchall()
    ]

    # Fetch active assignments
    cursor.execute(
        """
        SELECT
            a.id,
            a.title,
            a.subject_id,
            a.due_date AS event_date,
            'Assignment' AS event_type,
            '23:59' AS event_time,
            a.description,
            0 AS is_completed,
            a.created_at,
            s.name AS subject_name
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.status != 'Completed'
        """
    )
    assignments_data = [dict(row) for row in cursor.fetchall()]
    for a in assignments_data:
        a["id"] = f"assignment_{a['id']}"

    # Fetch active exams
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
            '' AS created_at,
            s.name AS subject_name
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_completed = 0
        """
    )
    exams_data = [dict(row) for row in cursor.fetchall()]
    for ex in exams_data:
        ex["id"] = f"exam_{ex['id']}"

    conn.close()

    combined = events + assignments_data + exams_data
    combined.sort(key=lambda x: x["event_date"])
    return combined


def get_completed_events():
    """Get all completed/archived events (is_completed = 1), completed assignments, and completed exams"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            e.*,
            s.name AS subject_name
        FROM events e
        LEFT JOIN subjects s
        ON e.subject_id = s.id
        WHERE e.is_completed = 1
        ORDER BY event_date DESC
        """
    )
    events = [
        dict(row)
        for row in cursor.fetchall()
    ]

    # Fetch completed assignments
    cursor.execute(
        """
        SELECT
            a.id,
            a.title,
            a.subject_id,
            a.due_date AS event_date,
            'Assignment' AS event_type,
            '23:59' AS event_time,
            a.description,
            1 AS is_completed,
            a.created_at,
            s.name AS subject_name
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.status = 'Completed'
        """
    )
    assignments_data = [dict(row) for row in cursor.fetchall()]
    for a in assignments_data:
        a["id"] = f"assignment_{a['id']}"

    # Fetch completed exams
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
            '' AS created_at,
            s.name AS subject_name
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_completed = 1
        """
    )
    exams_data = [dict(row) for row in cursor.fetchall()]
    for ex in exams_data:
        ex["id"] = f"exam_{ex['id']}"

    conn.close()

    combined = events + assignments_data + exams_data
    combined.sort(key=lambda x: x["event_date"], reverse=True)
    return combined


def delete_event(event_id):
    if isinstance(event_id, str) and event_id.startswith("assignment_"):
        assignment_id = int(event_id.replace("assignment_", ""))
        from services.assignment_service import delete_assignment
        return delete_assignment(assignment_id)

    if isinstance(event_id, str) and event_id.startswith("exam_"):
        exam_id = int(event_id.replace("exam_", ""))
        from services.exam_service import delete_exam_from_db
        return delete_exam_from_db(exam_id)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        DELETE FROM events
        WHERE id = ?
        """,
        (event_id,)
    )

    conn.commit()
    conn.close()

    return {
        "message": "Event deleted"
    }


def get_upcoming_events():
    """Get upcoming active events (next 5, is_completed = 0, event_date >= today)"""
    check_and_archive_expired_events()
    
    conn = get_connection()
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')

    cursor.execute(
        """
        SELECT
            e.*,
            s.name AS subject_name
        FROM events e
        LEFT JOIN subjects s
        ON e.subject_id = s.id
        WHERE e.is_completed = 0 AND e.event_date >= ?
        ORDER BY event_date ASC
        """,
        (today,)
    )
    events = [
        dict(row)
        for row in cursor.fetchall()
    ]

    # Fetch active assignments
    cursor.execute(
        """
        SELECT
            a.id,
            a.title,
            a.subject_id,
            a.due_date AS event_date,
            'Assignment' AS event_type,
            '23:59' AS event_time,
            a.description,
            0 AS is_completed,
            a.created_at,
            s.name AS subject_name
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.status != 'Completed' AND a.due_date >= ?
        ORDER BY due_date ASC
        """,
        (today,)
    )
    assignments_data = [dict(row) for row in cursor.fetchall()]
    for a in assignments_data:
        a["id"] = f"assignment_{a['id']}"

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
            '' AS created_at,
            s.name AS subject_name
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_completed = 0 AND e.exam_date >= ?
        """,
        (today,)
    )
    exams_data = [dict(row) for row in cursor.fetchall()]
    for ex in exams_data:
        ex["id"] = f"exam_{ex['id']}"

    conn.close()

    combined = events + assignments_data + exams_data
    combined.sort(key=lambda x: x["event_date"])
    return combined[:5]


def update_event(event_id, event):
    if isinstance(event_id, str) and event_id.startswith("assignment_"):
        assignment_id = int(event_id.replace("assignment_", ""))
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE assignments
            SET
                title = ?,
                subject_id = ?,
                due_date = ?,
                description = ?
            WHERE id = ?
            """,
            (
                event.title,
                event.subject_id,
                event.event_date,
                event.description,
                assignment_id
            )
        )
        conn.commit()
        conn.close()
        return {"message": "Assignment updated"}

    if isinstance(event_id, str) and event_id.startswith("exam_"):
        exam_id = int(event_id.replace("exam_", ""))
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE exams
            SET
                subject_id = ?,
                exam_date = ?,
                notes = ?
            WHERE id = ?
            """,
            (
                event.subject_id,
                event.event_date,
                event.description,
                exam_id
            )
        )
        conn.commit()
        conn.close()
        return {"message": "Exam updated"}

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE events
        SET
            title = ?,
            subject_id = ?,
            event_type = ?,
            event_date = ?,
            event_time = ?,
            description = ?
        WHERE id = ?
        """,
        (
            event.title,
            event.subject_id,
            event.event_type,
            event.event_date,
            event.event_time,
            event.description,
            event_id
        )
    )

    conn.commit()
    conn.close()

    return {
        "message": "Event updated"
    }