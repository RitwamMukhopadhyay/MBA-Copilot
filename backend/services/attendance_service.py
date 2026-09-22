from database import get_connection
from datetime import datetime


def get_subject_id(subject_name):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id
        FROM subjects
        WHERE name = ?
        """,
        (subject_name,)
    )

    row = cursor.fetchone()

    conn.close()

    if row:
        return row["id"]

    return None


def mark_attendance(
    subject_name,
    status
):

    subject_id = get_subject_id(
        subject_name
    )

    if not subject_id:

        return {
            "message": "Subject not found"
        }

    conn = get_connection()
    cursor = conn.cursor()

    today = datetime.now().strftime(
        "%Y-%m-%d"
    )

    cursor.execute(
        """
        INSERT INTO attendance
        (
            subject_id,
            attendance_date,
            status
        )
        VALUES (?, ?, ?)
        """,
        (
            subject_id,
            today,
            status
        )
    )

    conn.commit()
    conn.close()

    return {
        "message": f"{status} recorded"
    }


def get_attendance_stats(
    subject_name
):

    subject_id = get_subject_id(
        subject_name
    )

    if not subject_id:

        return {
            "present": 0,
            "absent": 0,
            "cancelled": 0,
            "attendance_percentage": 0
        }

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT status
        FROM attendance
        WHERE subject_id = ?
        """,
        (subject_id,)
    )

    rows = cursor.fetchall()

    conn.close()

    present = 0
    absent = 0
    cancelled = 0

    for row in rows:

        status = row["status"]

        if status == "Present":
            present += 1

        elif status == "Absent":
            absent += 1

        elif status == "Cancelled":
            cancelled += 1

    conducted_classes = (
        present + absent
    )

    if conducted_classes == 0:

        attendance_percentage = 0

    else:

        attendance_percentage = round(
            (
                present
                / conducted_classes
            )
            * 100,
            2
        )

    return {
        "present": present,
        "absent": absent,
        "cancelled": cancelled,
        "attendance_percentage":
            attendance_percentage
    }


def get_attendance_history(
    subject_name
):

    subject_id = get_subject_id(
        subject_name
    )

    if not subject_id:

        return []

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            attendance_date,
            status
        FROM attendance
        WHERE subject_id = ?
        ORDER BY attendance_date DESC
        """,
        (subject_id,)
    )

    rows = cursor.fetchall()

    conn.close()

    return [
        dict(row)
        for row in rows
    ]


def get_attendance_insights(
    subject_name
):

    stats = get_attendance_stats(
        subject_name
    )

    present = stats["present"]
    absent = stats["absent"]

    total = (
        present + absent
    )

    percentage = stats[
        "attendance_percentage"
    ]

    if total == 0:

        return {
            "status": "No Data",
            "safe_to_miss": 0,
            "classes_needed": 0
        }

    if percentage >= 80:

        status = "Excellent"

    elif percentage >= 75:

        status = "Warning"

    else:

        status = "Critical"

    safe_to_miss = 0

    while True:

        future_total = (
            total
            + safe_to_miss
        )

        future_percentage = (
            present
            / future_total
        ) * 100

        if future_percentage < 75:

            break

        safe_to_miss += 1

    safe_to_miss = max(
        0,
        safe_to_miss - 1
    )

    classes_needed = 0

    if percentage < 75:

        while True:

            future_present = (
                present
                + classes_needed
            )

            future_total = (
                total
                + classes_needed
            )

            future_percentage = (
                future_present
                / future_total
            ) * 100

            if future_percentage >= 75:

                break

            classes_needed += 1

    return {
        "status": status,
        "safe_to_miss":
            safe_to_miss,
        "classes_needed":
            classes_needed
    }