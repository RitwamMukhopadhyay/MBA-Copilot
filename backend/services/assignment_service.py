from database import get_connection
from datetime import datetime

def add_assignment(assignment):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO assignments
        (
            title,
            subject_id,
            due_date,
            description,
            priority,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            assignment.title,
            assignment.subject_id,
            assignment.due_date,
            assignment.description,
            assignment.priority,
            assignment.status,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
    )
    conn.commit()
    conn.close()
    return {"message": "Assignment created"}

def get_assignments():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            a.*,
            s.name AS subject_name
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        ORDER BY due_date ASC
        """
    )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def update_assignment(assignment_id, assignment):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE assignments
        SET
            title = ?,
            subject_id = ?,
            due_date = ?,
            description = ?,
            priority = ?,
            status = ?
        WHERE id = ?
        """,
        (
            assignment.title,
            assignment.subject_id,
            assignment.due_date,
            assignment.description,
            assignment.priority,
            assignment.status,
            assignment_id
        )
    )
    conn.commit()
    conn.close()
    return {"message": "Assignment updated"}

def delete_assignment(assignment_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
    conn.commit()
    conn.close()
    return {"message": "Assignment deleted"}

def mark_assignment_complete(assignment_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE assignments
        SET status = 'Completed'
        WHERE id = ?
        """,
        (assignment_id,)
    )
    conn.commit()
    conn.close()
    return {"message": "Assignment completed"}
