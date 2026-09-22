import sqlite3
from pathlib import Path
from database import get_connection
from datetime import datetime
from llm import ask_llm_no_memory

def get_all_exams():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT e.id, e.subject_id, e.exam_date, e.topics_count, e.difficulty, e.notes, e.is_completed, s.name as subject_name, s.term as term
        FROM exams e
        JOIN subjects s ON e.subject_id = s.id
        ORDER BY e.exam_date ASC
        """
    )
    exams = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return exams

def add_exam_to_db(subject_id: int, exam_date: str, topics_count: int, difficulty: str, notes: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO exams (subject_id, exam_date, topics_count, difficulty, notes, is_completed)
        VALUES (?, ?, ?, ?, ?, 0)
        """,
        (subject_id, exam_date, topics_count, difficulty, notes)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"message": "Exam added successfully", "id": new_id}

def update_exam_in_db(exam_id: int, subject_id: int, exam_date: str, topics_count: int, difficulty: str, notes: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE exams
        SET subject_id = ?, exam_date = ?, topics_count = ?, difficulty = ?, notes = ?
        WHERE id = ?
        """,
        (subject_id, exam_date, topics_count, difficulty, notes, exam_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Exam updated successfully"}

def delete_exam_from_db(exam_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
    conn.commit()
    conn.close()
    return {"message": "Exam deleted successfully"}

def mark_exam_completed_in_db(exam_id: int, is_completed: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE exams SET is_completed = ? WHERE id = ?", (is_completed, exam_id))
    conn.commit()
    conn.close()
    return {"message": "Exam status updated successfully"}

def generate_study_plan(exam_id: int) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT e.exam_date, e.topics_count, e.difficulty, e.notes, s.name as subject_name
        FROM exams e
        JOIN subjects s ON e.subject_id = s.id
        WHERE e.id = ?
        """,
        (exam_id,)
    )
    exam = cursor.fetchone()
    conn.close()
    
    if not exam:
        raise ValueError("Exam not found")
        
    today = datetime.now().date()
    try:
        exam_date = datetime.strptime(exam["exam_date"], "%Y-%m-%d").date()
        days_remaining = (exam_date - today).days
    except Exception:
        days_remaining = 7
        
    if days_remaining < 0:
        days_remaining = 0
        
    prompt = f"""
You are an expert MBA study planner.
Create a highly structured, day-by-day study schedule to prepare for an exam in the subject: {exam['subject_name']}.

EXAM DETAILS:
- Days remaining: {days_remaining}
- Topics to cover: {exam['topics_count']}
- Difficulty level: {exam['difficulty']}
- Additional notes from user: {exam['notes'] or 'None'}

Please outline a daily plan. If time is short (e.g. less than 3 days), make it a high-intensity crash course focusing on high-impact concepts. If time is longer, allocate structured review blocks, practice questions, and mock quizzes. Provide structured, concise responses, and use Markdown headers, tables, or lists.
"""
    return ask_llm_no_memory(prompt)
