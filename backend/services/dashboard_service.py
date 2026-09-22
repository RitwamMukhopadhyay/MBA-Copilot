import os
import sqlite3
from pathlib import Path
from datetime import datetime
from database import get_connection

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"

def get_dashboard_stats():
    """
    Computes all modernized dashboard statistics, Academic Health Score,
    and Focus Panel components.
    """
    conn = get_connection()
    # Configure row factory to access columns by name
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    today = datetime.now().date()

    # 1. Total Subjects
    cursor.execute("SELECT COUNT(*) FROM subjects")
    subject_count = cursor.fetchone()[0] or 0

    # 2. Average Attendance across all subjects
    cursor.execute("SELECT id, name FROM subjects")
    subjects = [dict(row) for row in cursor.fetchall()]
    
    subject_attendance_rates = []
    lowest_attendance_subject = None
    lowest_attendance_rate = 101.0  # Sentinel value above 100%

    for sub in subjects:
        sub_id = sub["id"]
        sub_name = sub["name"]
        
        cursor.execute(
            """
            SELECT 
                SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END)
            FROM attendance
            WHERE subject_id = ?
            """,
            (sub_id,)
        )
        res = cursor.fetchone()
        present = res[0] or 0
        absent = res[1] or 0
        total = present + absent
        
        if total > 0:
            rate = round((present / total) * 100, 2)
            subject_attendance_rates.append(rate)
            if rate < lowest_attendance_rate:
                lowest_attendance_rate = rate
                lowest_attendance_subject = {
                    "subject_id": sub_id,
                    "subject_name": sub_name,
                    "attendance": rate
                }

    if subject_attendance_rates:
        average_attendance = round(sum(subject_attendance_rates) / len(subject_attendance_rates), 2)
    else:
        average_attendance = 100.0  # Default to 100% if no attendance records exist yet

    # 3. Pending Assignments
    cursor.execute("SELECT COUNT(*) FROM assignments WHERE status != 'Completed'")
    pending_assignments_count = cursor.fetchone()[0] or 0

    # 4. Upcoming Exams
    cursor.execute("SELECT COUNT(*) FROM exams WHERE is_completed = 0")
    upcoming_exams_count = cursor.fetchone()[0] or 0

    # 5. Knowledge Hub Documents and Chunks (Source of truth: knowledge.db)
    pdf_count = 0
    chunk_count = 0
    total_docs = 0
    indexed_docs = 0
    broken_indexes_count = 0
    missing_pdfs_count = 0
    low_content_count = 0

    try:
        from knowledge.models import get_knowledge_connection
        k_conn = get_knowledge_connection()
        k_conn.row_factory = sqlite3.Row
        k_cursor = k_conn.cursor()

        # Count total documents
        k_cursor.execute("SELECT COUNT(*) FROM documents")
        pdf_count = k_cursor.fetchone()[0] or 0

        # Count total indexed chunks
        k_cursor.execute("SELECT SUM(chunk_count) FROM documents WHERE indexed = 1")
        chunk_count = k_cursor.fetchone()[0] or 0

        # Detailed documents status for Academic Health Score
        k_cursor.execute("SELECT id, subject_id, filename, filepath, indexed, chunk_count FROM documents")
        all_docs = [dict(row) for row in k_cursor.fetchall()]
        total_docs = len(all_docs)
        indexed_docs = sum(1 for d in all_docs if d["indexed"] == 1)

        # Check for missing files on disk
        for doc in all_docs:
            fpath = doc["filepath"]
            if fpath:
                path_obj = Path(fpath)
                if not path_obj.exists():
                    missing_pdfs_count += 1
            else:
                missing_pdfs_count += 1

        # Check for broken indexes (missing FAISS files for subjects with documents)
        k_cursor.execute("SELECT name FROM subjects")
        k_subjects = [row["name"] for row in k_cursor.fetchall()]
        for k_sub in k_subjects:
            k_cursor.execute(
                "SELECT COUNT(*) FROM documents d JOIN subjects s ON d.subject_id = s.id WHERE s.name = ?",
                (k_sub,)
            )
            sub_doc_count = k_cursor.fetchone()[0] or 0
            if sub_doc_count > 0:
                # Check FAISS index files
                from knowledge.faiss_store import get_subject_index_dir
                idx_dir = get_subject_index_dir(k_sub)
                json_path = idx_dir / "index.json"
                faiss_path = idx_dir / "index.faiss"
                if not json_path.exists() or not faiss_path.exists():
                    broken_indexes_count += 1

            # Count low content warning
            if sub_doc_count == 0:
                low_content_count += 1

        k_conn.close()
    except Exception as ke:
        print(f"[DASHBOARD STATS] Error loading stats from knowledge.db: {ke}")

    # 6. Academic Health Score (0-100) Calculation
    # Component A: Attendance (30% weight)
    attendance_score = average_attendance

    # Component B: Assignments (30% weight)
    assignment_deductions = 0
    cursor.execute("SELECT title, due_date FROM assignments WHERE status != 'Completed'")
    pending_asns = [dict(row) for row in cursor.fetchall()]
    for asn in pending_asns:
        try:
            due = datetime.strptime(asn["due_date"], "%Y-%m-%d").date()
            diff = (due - today).days
            if diff < 0:
                assignment_deductions += 15  # Overdue
            elif diff <= 3:
                assignment_deductions += 5   # Due within 3 days
        except Exception:
            pass
    assignments_score = max(0, 100 - assignment_deductions)

    # Component C: Exams (20% weight)
    exam_deductions = 0
    cursor.execute("SELECT s.name as subject_name, e.exam_date FROM exams e JOIN subjects s ON e.subject_id = s.id WHERE e.is_completed = 0")
    pending_exms = [dict(row) for row in cursor.fetchall()]
    for exm in pending_exms:
        try:
            exm_date = datetime.strptime(exm["exam_date"], "%Y-%m-%d").date()
            diff = (exm_date - today).days
            if diff >= 0:
                if diff <= 3:
                    exam_deductions += 15  # Scheduled within 3 days
                elif diff <= 7:
                    exam_deductions += 5   # Scheduled within 7 days
        except Exception:
            pass
    exams_score = max(0, 100 - exam_deductions)

    # Component D: Knowledge Hub Coverage & Integrity (20% weight)
    coverage_score = (indexed_docs / total_docs * 100) if total_docs > 0 else 100.0
    kh_deductions = (broken_indexes_count * 20) + (missing_pdfs_count * 20)
    knowledge_hub_score = max(0, coverage_score - kh_deductions)

    # Final Academic Health Score
    health_score = round(
        (attendance_score * 0.3) + 
        (assignments_score * 0.3) + 
        (exams_score * 0.2) + 
        (knowledge_hub_score * 0.2), 
        0
    )
    health_score = int(health_score)

    if health_score >= 90:
        health_rating = "Excellent"
    elif health_score >= 80:
        health_rating = "Good"
    elif health_score >= 70:
        health_rating = "Satisfactory"
    else:
        health_rating = "Needs Improvement"

    # 7. Focus Panel Data
    # Focus Item A: Lowest Attendance Subject
    # Already computed above in lowest_attendance_subject
    
    # Focus Item B: Nearest Assignment
    nearest_assignment = None
    cursor.execute(
        """
        SELECT a.title, a.due_date, s.name as subject_name
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.status != 'Completed' AND a.due_date IS NOT NULL AND a.due_date != ''
        """
    )
    asns_rows = [dict(row) for row in cursor.fetchall()]
    min_asn_days = 99999
    for row in asns_rows:
        try:
            due = datetime.strptime(row["due_date"], "%Y-%m-%d").date()
            diff = (due - today).days
            # We want the nearest pending assignment (including overdue ones)
            if diff < min_asn_days:
                min_asn_days = diff
                nearest_assignment = {
                    "title": row["title"],
                    "due_date": row["due_date"],
                    "subject_name": row["subject_name"] or "General",
                    "days_remaining": diff
                }
        except Exception:
            pass

    # Focus Item C: Nearest Exam
    nearest_exam = None
    cursor.execute(
        """
        SELECT e.exam_date, e.difficulty, s.name as subject_name
        FROM exams e
        JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_completed = 0 AND e.exam_date IS NOT NULL AND e.exam_date != ''
        """
    )
    exms_rows = [dict(row) for row in cursor.fetchall()]
    min_exm_days = 99999
    for row in exms_rows:
        try:
            exm_date = datetime.strptime(row["exam_date"], "%Y-%m-%d").date()
            diff = (exm_date - today).days
            if diff >= 0 and diff < min_exm_days:
                min_exm_days = diff
                nearest_exam = {
                    "subject_name": row["subject_name"],
                    "exam_date": row["exam_date"],
                    "days_remaining": diff,
                    "difficulty": row["difficulty"]
                }
        except Exception:
            pass

    # Focus Item D: Most Recently Indexed Subject
    most_recently_indexed = None
    try:
        from knowledge.models import get_knowledge_connection
        k_conn = get_knowledge_connection()
        k_conn.row_factory = sqlite3.Row
        k_cursor = k_conn.cursor()
        k_cursor.execute(
            """
            SELECT d.filename, d.last_indexed, s.name as subject_name
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE d.indexed = 1 AND d.last_indexed IS NOT NULL AND d.last_indexed != ''
            ORDER BY d.last_indexed DESC
            LIMIT 1
            """
        )
        recent_row = k_cursor.fetchone()
        if recent_row:
            most_recently_indexed = {
                "subject_name": recent_row["subject_name"],
                "filename": recent_row["filename"],
                "last_indexed": recent_row["last_indexed"]
            }
        k_conn.close()
    except Exception as ke:
        print(f"[DASHBOARD FOCUS] Error querying recent index: {ke}")
    # Calculate the new focus panel fields
    subject_needing_attention = "None"
    attendance_risk = "Healthy (80%+)"
    suggested_action = "Review study materials in the Knowledge Hub."
    ai_recommendation = "All metrics look healthy! Keep up the great work. Upload new materials to the Knowledge Hub to expand your resource library."

    if subjects:
        # Create map of subject name -> attendance rate
        sub_rates = {}
        for sub in subjects:
            sub_id = sub["id"]
            sub_name = sub["name"]
            cursor.execute(
                """
                SELECT 
                    SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END)
                FROM attendance
                WHERE subject_id = ?
                """,
                (sub_id,)
            )
            res = cursor.fetchone()
            present = res[0] or 0
            absent = res[1] or 0
            total = present + absent
            sub_rates[sub_name] = round((present / total) * 100, 2) if total > 0 else None

        # Determine subject needing attention
        chosen_sub = None
        reason = None  # 'attendance_critical', 'exam', 'assignment', 'attendance_warning', 'default'

        # 1. Check for critical attendance (< 75)
        crit_subs = [(name, rate) for name, rate in sub_rates.items() if rate is not None and rate < 75.0]
        if crit_subs:
            # Pick lowest
            crit_subs.sort(key=lambda x: x[1])
            chosen_sub = crit_subs[0][0]
            reason = 'attendance_critical'
        
        # 2. Check for exam <= 3 days
        if not chosen_sub and nearest_exam and nearest_exam.get("days_remaining", 9999) <= 3:
            chosen_sub = nearest_exam["subject_name"]
            reason = 'exam'
            
        # 3. Check for assignment overdue or due <= 3 days
        if not chosen_sub and nearest_assignment and nearest_assignment.get("days_remaining", 9999) <= 3:
            chosen_sub = nearest_assignment["subject_name"]
            reason = 'assignment'

        # 4. Check for warning attendance (75 <= rate < 80)
        if not chosen_sub:
            warn_subs = [(name, rate) for name, rate in sub_rates.items() if rate is not None and 75.0 <= rate < 80.0]
            if warn_subs:
                warn_subs.sort(key=lambda x: x[1])
                chosen_sub = warn_subs[0][0]
                reason = 'attendance_warning'

        # 5. Default to lowest attendance subject (even if healthy) or just first subject
        if not chosen_sub:
            valid_subs = [(name, rate) for name, rate in sub_rates.items() if rate is not None]
            if valid_subs:
                valid_subs.sort(key=lambda x: x[1])
                chosen_sub = valid_subs[0][0]
                reason = 'default'
            else:
                chosen_sub = subjects[0]["name"]
                reason = 'default'

        subject_needing_attention = chosen_sub
        rate = sub_rates.get(chosen_sub)

        # Set risk level based on rate
        if rate is not None:
            if rate < 75.0:
                attendance_risk = "Critical (<75%)"
            elif rate < 80.0:
                attendance_risk = "Warning (75-80%)"
            else:
                attendance_risk = "Healthy (80%+)"
        else:
            attendance_risk = "Healthy (80%+)"

        # Set suggested action and ai recommendation
        if reason == 'attendance_critical':
            suggested_action = "Attend upcoming lectures to recover attendance."
            ai_recommendation = f"Your attendance in '{chosen_sub}' is currently at {rate}%, which is below the critical threshold of 75%. Try to attend all remaining classes to avoid being ineligible for the final exam. You can also generate Revision Notes to stay on track."
        elif reason == 'exam' and nearest_exam:
            suggested_action = "Prepare revision notes and practice MCQs."
            ai_recommendation = f"You have an upcoming exam in '{chosen_sub}' in {nearest_exam['days_remaining']} days. Leverage the Exam Planner to generate targeted revision material, review your subject PDFs, and practice with the mock MCQ generator."
        elif reason == 'assignment' and nearest_assignment:
            days = nearest_assignment['days_remaining']
            due_str = f"in {days} days" if days >= 0 else f"OVERDUE by {abs(days)} days"
            suggested_action = "Complete and submit the pending assignment."
            ai_recommendation = f"The assignment '{nearest_assignment['title']}' for '{chosen_sub}' is {due_str}. We recommend prioritizing this task immediately. You can upload reference documents to the Knowledge Hub to get context-specific support."
        elif reason == 'attendance_warning':
            suggested_action = "Attend upcoming classes to stay above the safe margin."
            ai_recommendation = f"Your attendance in '{chosen_sub}' is {rate}%, placing you in the warning zone. A single missed class could push you below the required 75% limit. Be sure to attend class sessions this week."
        else:
            suggested_action = "Review study materials in the Knowledge Hub."
            ai_recommendation = f"All metrics for '{chosen_sub}' are healthy. Keep up the great work! To stay ahead, upload lecture slides to the Knowledge Hub and query key terms with PDF Chat."
    else:
        subject_needing_attention = "None"
        attendance_risk = "Healthy (80%+)"
        suggested_action = "Add subjects or register attendance."
        ai_recommendation = "Start by adding subjects and uploading PDF course materials to unlock personalized AI recommendations."

    conn.close()

    return {
        "subjects": subject_count,
        "pdfs": pdf_count,
        "overall_attendance": average_attendance,
        "pending_assignments": pending_assignments_count,
        "upcoming_exams": upcoming_exams_count,
        "indexed_chunks": chunk_count,
        "health_score": health_score,
        "health_rating": health_rating,
        "focus_panel": {
            "lowest_attendance": lowest_attendance_subject,
            "nearest_assignment": nearest_assignment,
            "nearest_exam": nearest_exam,
            "recently_indexed": most_recently_indexed,
            "subject_needing_attention": subject_needing_attention,
            "attendance_risk": attendance_risk,
            "suggested_action": suggested_action,
            "ai_recommendation": ai_recommendation
        }
    }

def get_attendance_alerts():
    """
    Keep legacy support for /dashboard/attendance-alerts
    """
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM subjects")
    subjects_rows = cursor.fetchall()
    alerts = []

    for subject in subjects_rows:
        subject_id = subject["id"]
        subject_name = subject["name"]

        cursor.execute(
            """
            SELECT
                SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END)
            FROM attendance
            WHERE subject_id = ?
            """,
            (subject_id,)
        )
        result = cursor.fetchone()
        present = result[0] or 0
        absent = result[1] or 0
        total = present + absent

        attendance = (
            round((present / total) * 100, 2)
            if total > 0
            else 0
        )

        if attendance >= 80:
            status = "Healthy"
        elif attendance >= 75:
            status = "Warning"
        else:
            status = "Critical"

        alerts.append(
            {
                "subject_id": subject_id,
                "subject": subject_name,
                "attendance": attendance,
                "status": status
            }
        )

    conn.close()
    return alerts