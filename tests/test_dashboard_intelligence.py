import os
import sys
import shutil
import sqlite3
import requests
from datetime import datetime, timedelta
from pathlib import Path

# Force UTF-8 encoding for stdout/stderr to support emojis on Windows consoles
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent
DB_DIR = PROJECT_ROOT / "database"
MAIN_DB = DB_DIR / "mba_copilot_v2.db"
KNOW_DB = DB_DIR / "knowledge.db"

BACKUP_MAIN = DB_DIR / "mba_copilot_v2.db.bak"
BACKUP_KNOW = DB_DIR / "knowledge.db.bak"

def setup_backups():
    print("[TEST SETUP] Creating database backups...")
    if MAIN_DB.exists():
        shutil.copy2(MAIN_DB, BACKUP_MAIN)
    if KNOW_DB.exists():
        shutil.copy2(KNOW_DB, BACKUP_KNOW)

def restore_backups():
    print("[TEST TEARDOWN] Restoring database backups...")
    if BACKUP_MAIN.exists():
        shutil.copy2(BACKUP_MAIN, MAIN_DB)
        os.remove(BACKUP_MAIN)
    if BACKUP_KNOW.exists():
        shutil.copy2(BACKUP_KNOW, KNOW_DB)
        os.remove(BACKUP_KNOW)

def seed_test_scenarios():
    print("[TEST SEEDING] Inserting test scenarios into database...")
    
    # Dates
    today = datetime.now().date()
    overdue_date = (today - timedelta(days=4)).strftime("%Y-%m-%d")
    exam_date = (today + timedelta(days=2)).strftime("%Y-%m-%d")
    
    # 1. Seed main db (subjects, attendance, assignments, exams)
    conn = sqlite3.connect(str(MAIN_DB))
    cursor = conn.cursor()
    try:
        # Create Test Subject
        cursor.execute(
            "INSERT INTO subjects (course_code, name, credits, faculty, term) VALUES (?, ?, ?, ?, ?)",
            ("TEST-101", "Test_Dashboard_IPR", 4.0, "Faculty Test", "Term 1")
        )
        subject_id = cursor.lastrowid
        
        # Attendance: 75% rate (3 Present, 1 Absent)
        attendance_records = [
            (subject_id, "2026-06-01", "Present"),
            (subject_id, "2026-06-02", "Present"),
            (subject_id, "2026-06-03", "Present"),
            (subject_id, "2026-06-04", "Absent"),
        ]
        cursor.executemany(
            "INSERT INTO attendance (subject_id, attendance_date, status) VALUES (?, ?, ?)",
            attendance_records
        )
        
        # Overdue Assignment
        cursor.execute(
            "INSERT INTO assignments (title, subject_id, due_date, description, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("Overdue Assignment", subject_id, overdue_date, "Must be completed", "High", "Pending", "2026-06-01T12:00:00")
        )
        
        # Exam scheduled within 3 days
        cursor.execute(
            "INSERT INTO exams (subject_id, exam_date, topics_count, difficulty, notes, is_completed) VALUES (?, ?, ?, ?, ?, ?)",
            (subject_id, exam_date, 5, "Hard", "Important exam", 0)
        )
        
        conn.commit()
    finally:
        conn.close()

    # 2. Seed knowledge db (subject and document with missing PDF file)
    k_conn = sqlite3.connect(str(KNOW_DB))
    k_cursor = k_conn.cursor()
    try:
        k_cursor.execute("INSERT INTO subjects (name, term) VALUES (?, ?)", ("Test_Dashboard_IPR", "Term 1"))
        k_subject_id = k_cursor.lastrowid
        
        # Missing PDF document (filepath points to non-existent location)
        k_cursor.execute(
            """
            INSERT INTO documents (subject_id, filename, filepath, uploaded_at, indexed, chunk_count)
            VALUES (?, ?, ?, ?, 1, 3)
            """,
            (k_subject_id, "missing_test_file.pdf", "C:/dummy/missing_test_file.pdf", "2026-06-01T12:00:00")
        )
        k_conn.commit()
    finally:
        k_conn.close()
        
    print("[TEST SEEDING] Successfully seeded 75% attendance, overdue assignment, exam in 2 days, and missing PDF index.")

def run_verifications():
    print("\n--- Running API Verifications ---")
    
    stats_url = "http://127.0.0.1:8000/dashboard/stats"
    alerts_url = "http://127.0.0.1:8000/dashboard/smart-alerts"
    
    # 1. Fetch dashboard statistics
    print(f"Requesting GET {stats_url}...")
    stats_res = requests.get(stats_url)
    if stats_res.status_code != 200:
        print(f"[FAIL] Stats API status code: {stats_res.status_code}")
        return False
        
    stats = stats_res.json()
    print("Dashboard Stats Response:")
    print(f"  Subjects: {stats.get('subjects')}")
    print(f"  Overall Attendance: {stats.get('overall_attendance')}%")
    print(f"  Pending Assignments: {stats.get('pending_assignments')}")
    print(f"  Upcoming Exams: {stats.get('upcoming_exams')}")
    print(f"  Health Score: {stats.get('health_score')}/100 ({stats.get('health_rating')})")
    
    focus = stats.get("focus_panel", {})
    print("Focus Panel:")
    print(f"  Lowest Attendance Subject: {focus.get('lowest_attendance')}")
    print(f"  Nearest Assignment: {focus.get('nearest_assignment')}")
    print(f"  Nearest Exam: {focus.get('nearest_exam')}")
    
    # Assertions for Stats
    assert stats.get("subjects") >= 1, "Subjects count should be >= 1"
    assert stats.get("health_score") < 90, "Health score should be degraded due to overdue assignment & upcoming exam"
    assert focus.get("lowest_attendance", {}).get("subject_name") == "Test_Dashboard_IPR", "Lowest attendance subject name mismatch"
    assert focus.get("lowest_attendance", {}).get("attendance") == 75.0, "Lowest attendance value mismatch"
    assert focus.get("nearest_assignment", {}).get("title") == "Overdue Assignment", "Nearest assignment mismatch"
    
    # 2. Fetch smart alerts
    print(f"\nRequesting GET {alerts_url}...")
    alerts_res = requests.get(alerts_url)
    if alerts_res.status_code != 200:
        print(f"[FAIL] Alerts API status code: {alerts_res.status_code}")
        return False
        
    alerts = alerts_res.json()
    critical_alerts = alerts.get("critical", [])
    warning_alerts = alerts.get("warning", [])
    healthy_alerts = alerts.get("healthy", [])
    insights = alerts.get("insights", [])
    
    print("Smart Alerts Grouped:")
    print(f"  Critical: {critical_alerts}")
    print(f"  Warning: {warning_alerts}")
    print(f"  Healthy: {healthy_alerts}")
    print(f"  Insights: {insights}")
    
    # Assertions for Alerts
    # Overdue assignment and exam in 2 days and missing PDF should be Critical
    categories_critical = [a.get("category") for a in critical_alerts]
    assert "Assignments" in categories_critical, "Overdue assignment should trigger critical alert"
    assert "Exams" in categories_critical, "Exam scheduled in 2 days should trigger critical alert"
    assert "Knowledge Hub" in categories_critical, "Missing PDF file should trigger critical Knowledge Hub alert"
    
    # 75% attendance should trigger Warning
    categories_warning = [a.get("category") for a in warning_alerts]
    messages_warning = [a.get("message") for a in warning_alerts]
    assert "Attendance" in categories_warning, "75% attendance should trigger attendance alert"
    assert any("Test_Dashboard_IPR attendance warning" in msg for msg in messages_warning), "Attendance warning message mismatch"
    
    print("\n>>> ALL DASHBOARD INTELLIGENCE TEST CASES PASSED SUCCESSFULLY <<<")
    return True

if __name__ == "__main__":
    success = False
    try:
        setup_backups()
        seed_test_scenarios()
        success = run_verifications()
    except Exception as e:
        print(f"\n[ERROR] Test execution failed or assertion failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        restore_backups()
        
    sys.exit(0 if success else 1)
