import sqlite3
from pathlib import Path
from datetime import datetime
from tools.memory_tool import get_memory

DB_PATH = Path(__file__).resolve().parent.parent / "database" / "mba_copilot_v2.db"
WORKSPACE_DIR = Path(__file__).resolve().parent.parent / "workspace"

def build_agent_context() -> str:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. Subjects and Attendance
        cursor.execute("SELECT id, course_code, name, credits, faculty, term FROM subjects")
        subjects = [dict(row) for row in cursor.fetchall()]
        
        subjects_by_id = {s["id"]: s["name"] for s in subjects}
        
        attendance_context = []
        for s in subjects:
            cursor.execute(
                """
                SELECT 
                    SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END)
                FROM attendance
                WHERE subject_id = ?
                """,
                (s["id"],)
            )
            res = cursor.fetchone()
            present = res[0] or 0
            absent = res[1] or 0
            total = present + absent
            rate = round((present / total) * 100, 2) if total > 0 else 100.0
            status = "Critical (below 75%)" if rate < 75.0 else "Warning" if rate < 80.0 else "Healthy"
            attendance_context.append(f"- {s['name']} ({s['course_code']}): {rate}% [{status}] (Present: {present}, Absent: {absent})")
            
        # 2. Assignments
        cursor.execute(
            """
            SELECT id, title, subject_id, due_date, priority, status 
            FROM assignments 
            WHERE status != 'Completed' 
            ORDER BY due_date ASC
            """
        )
        assignments = [dict(row) for row in cursor.fetchall()]
        
        # 3. Exams
        cursor.execute(
            """
            SELECT id, subject_id, exam_date, topics_count, difficulty, notes 
            FROM exams 
            WHERE is_completed = 0 
            ORDER BY exam_date ASC
            """
        )
        exams = [dict(row) for row in cursor.fetchall()]
        print("Loaded Exams:")
        print(exams)
        
        # 4. Calendar Events
        today_str = datetime.now().date().isoformat()
        cursor.execute(
            """
            SELECT title, event_type, event_date, event_time, description 
            FROM events 
            WHERE is_completed = 0 AND event_date >= ?
            ORDER BY event_date ASC, event_time ASC
            LIMIT 10
            """,
            (today_str,)
        )
        events = [dict(row) for row in cursor.fetchall()]
        
        # 5. PDF Chat History
        cursor.execute(
            """
            SELECT subject_name, pdf_name, role, content 
            FROM pdf_chat_history 
            ORDER BY id DESC 
            LIMIT 5
            """
        )
        pdf_chat_history = [dict(row) for row in cursor.fetchall()]
        
        # 6. Available PDFs per subject — ACADEMIC ONLY
        # Load classification data from pdf_metadata table
        pdf_classifications = {}
        try:
            cursor.execute("SELECT subject_name, filename, category FROM pdf_metadata")
            for row in cursor.fetchall():
                pdf_classifications[(row["subject_name"], row["filename"])] = row["category"]
        except Exception:
            pass  # Table may not exist on first boot — treat all PDFs as academic

        academic_pdf_info = []
        admin_pdf_excluded = []   # Logged only — never sent to LLM

        for s in subjects:
            folder_name = s["name"].replace(" ", "_")
            pdf_dir = WORKSPACE_DIR / folder_name / "PDFs"
            if pdf_dir.exists():
                pdfs = [f.name for f in pdf_dir.iterdir() if f.is_file() and f.suffix.lower() == ".pdf"]
                academic_pdfs = []
                for pdf_name in pdfs:
                    category = pdf_classifications.get((s["name"], pdf_name), "academic")
                    if category == "academic":
                        academic_pdfs.append(pdf_name)
                    else:
                        admin_pdf_excluded.append(f"  [EXCLUDED-ADMIN] {s['name']}: {pdf_name}")

                if academic_pdfs:
                    academic_pdf_info.append(f"- {s['name']}: {', '.join(academic_pdfs)}")

        if admin_pdf_excluded:
            print("[CONTEXT BUILDER] Administrative PDFs excluded from advisor context:")
            for line in admin_pdf_excluded:
                print(line)

        print("Loaded Academic PDFs:")
        print(academic_pdf_info)
        
        conn.close()
    except Exception as e:
        return f"Error building agent context: {str(e)}"
        
    # Format Memory
    mem_data = get_memory()
    memory_str = ""
    if mem_data:
        for cat, items in mem_data.items():
            for k, v in items.items():
                memory_str += f"- [{cat}] {k}: {v}\n"
    if not memory_str:
        memory_str = "No saved memories.\n"
        
    # Compile Markdown Context
    context = "### CURRENT SUBJECTS & ATTENDANCE STATUS\n"
    if attendance_context:
        context += "\n".join(attendance_context) + "\n"
    else:
        context += "No subjects registered.\n"
        
    context += "\n### UNCOMPLETED ASSIGNMENTS\n"
    if assignments:
        for a in assignments:
            subj_name = subjects_by_id.get(a["subject_id"], "General")
            context += f"- '{a['title']}' for {subj_name} | Due: {a['due_date']} | Priority: {a['priority']}\n"
    else:
        context += "No upcoming assignments.\n"
        
    context += "\n### UPCOMING EXAMS\n"
    if exams:
        for e in exams:
            subj_name = subjects_by_id.get(e["subject_id"], "Unknown")
            context += f"- {subj_name} | Date: {e['exam_date']} | Topics: {e['topics_count']} ch. | Difficulty: {e['difficulty']} | Notes: {e['notes'] or 'None'}\n"
    else:
        context += "No upcoming exams scheduled.\n"
        
    context += "\n### CALENDAR SCHEDULE\n"
    if events:
        for ev in events:
            time_str = f" at {ev['event_time']}" if ev['event_time'] else ""
            context += f"- [{ev['event_type']}] {ev['title']} on {ev['event_date']}{time_str}\n"
    else:
        context += "No calendar events scheduled.\n"
        
    context += "\n### LONG-TERM USER MEMORY\n" + memory_str
    
    context += "\n### RECENT PDF CHAT INTERACTIONS\n"
    if pdf_chat_history:
        # Re-sort to chronological order
        pdf_chat_history.reverse()
        for chat in pdf_chat_history:
            sender = "User" if chat["role"] == "user" else "Assistant"
            context += f"- [{chat['subject_name']} / {chat['pdf_name']}] {sender}: {chat['content'][:150]}\n"
    else:
        context += "No recent PDF chat interactions.\n"
        
    # NOTE: Only ACADEMIC PDFs are listed — admin/fee/hostel docs are excluded
    context += "\n### AVAILABLE ACADEMIC STUDY MATERIALS (PDFs)\n"
    context += "IMPORTANT: Only academic study materials are listed below. Administrative documents (hostel notices, fee receipts, circulars, etc.) are intentionally excluded from this context.\n"
    if academic_pdf_info:
        context += "\n".join(academic_pdf_info) + "\n"
    else:
        context += "No academic PDFs uploaded yet.\n"
        
    return context
