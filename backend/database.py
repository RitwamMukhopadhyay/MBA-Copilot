import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "database" / "mba_copilot_v2.db"


def get_connection():

    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    return conn


def initialize_database():

    conn = get_connection()

    cursor = conn.cursor()

    # -----------------------------
    # Subjects
    # -----------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS subjects
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_code TEXT,
            name TEXT UNIQUE NOT NULL,
            credits REAL,
            faculty TEXT,
            term TEXT
        )
        """
    )

    # -----------------------------
    # Study Sessions
    # -----------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS study_sessions
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            subject_id INTEGER,
            notes TEXT,

            FOREIGN KEY(subject_id)
            REFERENCES subjects(id)
        )
        """
    )

    # -----------------------------
    # Attendance History
    # -----------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS attendance
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            subject_id INTEGER NOT NULL,

            attendance_date TEXT NOT NULL,

            status TEXT NOT NULL,

            FOREIGN KEY(subject_id)
            REFERENCES subjects(id)
        )
        """
    )

    # -----------------------------
    # Calendar Events
    # -----------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS events
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            subject_id INTEGER,

            event_type TEXT NOT NULL,

            event_date TEXT NOT NULL,

            event_time TEXT,

            description TEXT,

            created_at TEXT NOT NULL,

            is_completed INTEGER DEFAULT 0,

            FOREIGN KEY(subject_id)
            REFERENCES subjects(id)
        )
        """
    )

    # -----------------------------
    # Assignments
    # -----------------------------
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS assignments
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject_id INTEGER,
            due_date TEXT NOT NULL,
            description TEXT,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(subject_id) REFERENCES subjects(id)
        )
        """
    )

    # -----------------------------
    # PDF Chat History
    # -----------------------------
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS pdf_chat_history
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_name TEXT NOT NULL,
            pdf_name TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
        """
    )

    # -----------------------------
    # Exams
    # -----------------------------
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS exams
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER NOT NULL,
            exam_date TEXT NOT NULL,
            topics_count INTEGER NOT NULL,
            difficulty TEXT NOT NULL,
            notes TEXT,
            is_completed INTEGER DEFAULT 0,
            FOREIGN KEY(subject_id) REFERENCES subjects(id)
        )
        """
    )

    # Add is_completed column if it doesn't exist (migration)
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN is_completed INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        # Column already exists
        pass

    # -----------------------------
    # Terms
    # -----------------------------
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS terms
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
        """
    )

    # Seed only "Term 1" on first-ever initialization.
    # On subsequent startups, respect whatever terms the user has configured.
    cursor.execute("SELECT COUNT(*) FROM terms")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO terms (name) VALUES (?)", ("Term 1",))

    # -----------------------------
    # PDF Metadata (classification)
    # -----------------------------
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS pdf_metadata
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'academic',
            classified_at TEXT NOT NULL,
            UNIQUE(subject_name, filename)
        )
        """
    )

    # -----------------------------
    # Settings
    # -----------------------------
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS settings
        (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )

    # -----------------------------
    # Self-Healing Database Cleanup
    # -----------------------------
    cursor.execute("DELETE FROM attendance WHERE subject_id NOT IN (SELECT id FROM subjects)")
    purged_att = cursor.rowcount
    if purged_att > 0:
        print(f"[DATABASE INIT] Self-healing: Purged {purged_att} orphaned attendance records.")

    cursor.execute("DELETE FROM exams WHERE subject_id NOT IN (SELECT id FROM subjects)")
    cursor.execute("DELETE FROM assignments WHERE subject_id NOT IN (SELECT id FROM subjects)")
    cursor.execute("DELETE FROM events WHERE subject_id IS NOT NULL AND subject_id NOT IN (SELECT id FROM subjects)")

    conn.commit()

    conn.close()