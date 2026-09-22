import sqlite3
import os
from pathlib import Path
from datetime import datetime
from database import get_connection

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"

def get_smart_alerts():
    """
    Returns priority-based smart alerts grouped into 'critical', 'warning', and 'healthy'.
    """
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    today = datetime.now().date()
    
    critical = []
    warning = []
    healthy = []

    # 1. ATTENDANCE ALERTS & INSIGHTS
    cursor.execute("SELECT id, name FROM subjects")
    subjects = [dict(row) for row in cursor.fetchall()]
    
    has_low_attendance = False
    
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
            if rate < 75.0:
                critical.append({
                    "category": "Attendance",
                    "subject": sub_name,
                    "message": f"{sub_name} attendance is critical at {rate}% (below 75%)."
                })
                has_low_attendance = True
            elif rate < 80.0:
                warning.append({
                    "category": "Attendance",
                    "subject": sub_name,
                    "message": f"{sub_name} attendance warning: {rate}%."
                })
                has_low_attendance = True
            else:
                healthy.append({
                    "category": "Attendance",
                    "subject": sub_name,
                    "message": f"{sub_name} attendance is healthy at {rate}%."
                })
        else:
            # Default state when no attendance is logged
            healthy.append({
                "category": "Attendance",
                "subject": sub_name,
                "message": f"No attendance recorded yet for {sub_name}."
            })
            
    # 2. ASSIGNMENTS ALERTS & INSIGHTS
    cursor.execute(
        """
        SELECT a.id, a.title, a.due_date, s.name as subject_name
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.status != 'Completed' AND a.due_date IS NOT NULL AND a.due_date != ''
        """
    )
    asns_rows = [dict(row) for row in cursor.fetchall()]
    
    urgent_asns_count = 0
    for row in asns_rows:
        try:
            due = datetime.strptime(row["due_date"], "%Y-%m-%d").date()
            diff = (due - today).days
            sub_lbl = row["subject_name"] or "General"
            
            if diff < 0:
                # Overdue
                critical.append({
                    "category": "Assignments",
                    "title": row["title"],
                    "message": f"Assignment '{row['title']}' for {sub_lbl} is OVERDUE by {abs(diff)} days."
                })
                urgent_asns_count += 1
            elif diff <= 3:
                # Warning
                warning.append({
                    "category": "Assignments",
                    "title": row["title"],
                    "message": f"Assignment '{row['title']}' for {sub_lbl} is due in {diff} days."
                })
                urgent_asns_count += 1
        except Exception:
            pass
            
    if urgent_asns_count == 0:
        healthy.append({
            "category": "Assignments",
            "message": "No urgent assignments due."
        })

    # 3. EXAMS ALERTS & INSIGHTS
    cursor.execute(
        """
        SELECT e.id, e.exam_date, e.difficulty, s.name as subject_name
        FROM exams e
        JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_completed = 0 AND e.exam_date IS NOT NULL AND e.exam_date != ''
        """
    )
    exms_rows = [dict(row) for row in cursor.fetchall()]
    
    urgent_exms_count = 0
    for row in exms_rows:
        try:
            exm_date = datetime.strptime(row["exam_date"], "%Y-%m-%d").date()
            diff = (exm_date - today).days
            sub_lbl = row["subject_name"]
            
            if diff >= 0:
                if diff <= 3:
                    critical.append({
                        "category": "Exams",
                        "subject": sub_lbl,
                        "message": f"CRITICAL: Exam for '{sub_lbl}' is in {diff} days!"
                    })
                    urgent_exms_count += 1
                elif diff <= 7:
                    warning.append({
                        "category": "Exams",
                        "subject": sub_lbl,
                        "message": f"Upcoming Exam: '{sub_lbl}' is in {diff} days."
                    })
                    urgent_exms_count += 1
        except Exception:
            pass
            
    if urgent_exms_count == 0:
        healthy.append({
            "category": "Exams",
            "message": "No upcoming exams within 7 days."
        })

    # 4. KNOWLEDGE HUB ALERTS & INSIGHTS
    broken_indexes = 0
    missing_pdfs = 0
    total_indexed_files = 0
    
    try:
        from knowledge.models import get_knowledge_connection
        k_conn = get_knowledge_connection()
        k_conn.row_factory = sqlite3.Row
        k_cursor = k_conn.cursor()
        
        # Check files existence
        k_cursor.execute("SELECT id, subject_id, filename, filepath, indexed FROM documents")
        all_docs = [dict(row) for row in k_cursor.fetchall()]
        
        for doc in all_docs:
            fpath = doc["filepath"]
            if fpath:
                path_obj = Path(fpath)
                if not path_obj.exists():
                    missing_pdfs += 1
                    critical.append({
                        "category": "Knowledge Hub",
                        "message": f"Missing PDF file on disk: '{doc['filename']}'."
                    })
            else:
                missing_pdfs += 1
                critical.append({
                    "category": "Knowledge Hub",
                    "message": f"Missing PDF path: '{doc['filename']}'."
                })
                
        # Check index integrity for subjects
        k_cursor.execute("SELECT name FROM subjects")
        k_subjects = [row["name"] for row in k_cursor.fetchall()]
        for k_sub in k_subjects:
            k_cursor.execute(
                "SELECT COUNT(*) FROM documents d JOIN subjects s ON d.subject_id = s.id WHERE s.name = ?",
                (k_sub,)
            )
            sub_doc_count = k_cursor.fetchone()[0] or 0
            if sub_doc_count > 0:
                from knowledge.faiss_store import get_subject_index_dir
                idx_dir = get_subject_index_dir(k_sub)
                json_path = idx_dir / "index.json"
                faiss_path = idx_dir / "index.faiss"
                if not json_path.exists() or not faiss_path.exists():
                    broken_indexes += 1
                    critical.append({
                        "category": "Knowledge Hub",
                        "message": f"Broken index for subject '{k_sub}': index files missing."
                    })
                total_indexed_files += sub_doc_count
                
        # Check persistence (path writeable)
        from knowledge.faiss_store import DATABASE_ROOT
        if not DATABASE_ROOT.exists() or not os.access(str(DATABASE_ROOT.resolve()), os.W_OK):
            critical.append({
                "category": "Knowledge Hub",
                "message": "Persistence issue: Database folder is not writeable."
            })
            
        k_conn.close()
    except Exception as ke:
        print(f"[DASHBOARD ALERTS] Error running knowledge hub alert scanner: {ke}")
        critical.append({
            "category": "Knowledge Hub",
            "message": "Persistence issue: cannot connect to knowledge.db."
        })

    if broken_indexes == 0 and missing_pdfs == 0:
        healthy.append({
            "category": "Knowledge Hub",
            "message": "Knowledge Hub operational."
        })

    # 5. CURATED SAAS INSIGHTS
    insights = []
    
    # 5a. Best Attendance Subject
    best_sub_name = None
    best_sub_rate = -1.0
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
            if rate > best_sub_rate:
                best_sub_rate = rate
                best_sub_name = sub_name
                
    if best_sub_name:
        insights.append(f"📈 Best Attendance: {best_sub_name} ({best_sub_rate}%)")
    else:
        insights.append("📈 Best Attendance: No logs recorded yet.")

    # 5b. Most Indexed Subject & 5c. Newest PDF Upload
    most_idx_sub = None
    most_idx_chunks = 0
    newest_pdf_name = None
    newest_pdf_sub = None
    
    try:
        from knowledge.models import get_knowledge_connection
        k_conn = get_knowledge_connection()
        k_conn.row_factory = sqlite3.Row
        k_cursor = k_conn.cursor()
        
        # Query most indexed
        k_cursor.execute("""
            SELECT s.name, SUM(d.chunk_count) as total_chunks
            FROM subjects s
            JOIN documents d ON s.id = d.subject_id
            WHERE d.indexed = 1
            GROUP BY s.id
            ORDER BY total_chunks DESC
            LIMIT 1
        """)
        most_idx_row = k_cursor.fetchone()
        if most_idx_row and most_idx_row["total_chunks"] is not None:
            most_idx_sub = most_idx_row["name"]
            most_idx_chunks = most_idx_row["total_chunks"]
            
        # Query newest PDF
        k_cursor.execute("""
            SELECT d.filename, s.name as subject_name
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            ORDER BY d.uploaded_at DESC, d.id DESC
            LIMIT 1
        """)
        new_pdf_row = k_cursor.fetchone()
        if new_pdf_row:
            newest_pdf_name = new_pdf_row["filename"]
            newest_pdf_sub = new_pdf_row["subject_name"]
            
        k_conn.close()
    except Exception as ke:
        print(f"[DASHBOARD INSIGHTS] Error querying knowledge.db: {ke}")
        
    if most_idx_sub:
        insights.append(f"📚 Most Indexed: {most_idx_sub} ({most_idx_chunks} chunks)")
    else:
        insights.append("📚 Most Indexed: No chunks indexed yet.")
        
    if newest_pdf_name:
        insights.append(f"📄 Newest PDF: {newest_pdf_name} ({newest_pdf_sub})")
    else:
        insights.append("📄 Newest PDF: None uploaded yet.")
        
    # 5d. Academic Trend
    cursor.execute(
        """
        SELECT 
            SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END),
            SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END)
        FROM attendance
        """
    )
    all_res = cursor.fetchone()
    all_p = all_res[0] or 0
    all_a = all_res[1] or 0
    all_tot = all_p + all_a
    overall_avg = round((all_p / all_tot) * 100, 2) if all_tot > 0 else 100.0

    cursor.execute("SELECT COUNT(*) FROM assignments WHERE status != 'Completed'")
    pending_asns = cursor.fetchone()[0] or 0

    if overall_avg >= 80.0 and pending_asns == 0:
        insights.append(f"📈 Academic Trend: Excellent! Overall attendance is {overall_avg}% and all tasks are on track.")
    elif overall_avg >= 80.0:
        insights.append(f"📈 Academic Trend: Attendance is stable at {overall_avg}%. Focus on completing the {pending_asns} pending tasks.")
    else:
        insights.append(f"📈 Academic Trend: Alert! Attendance is down at {overall_avg}%. Action required to attend classes and catch up.")

    conn.close()

    return {
        "critical": critical,
        "warning": warning,
        "healthy": healthy,
        "insights": insights
    }
