from database import get_connection
import sqlite3

def get_all_terms():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM terms ORDER BY name ASC")
    terms = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return terms

def add_term_to_db(name: str):
    name = name.strip()
    if not name:
        return {"error": "Term name cannot be empty"}
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO terms (name) VALUES (?)", (name,))
        conn.commit()
        new_id = cursor.lastrowid
        return {"message": "Term added successfully", "id": new_id}
    except sqlite3.IntegrityError:
        return {"error": "Term already exists"}
    finally:
        conn.close()

def rename_term_in_db(term_id: int, new_name: str):
    new_name = new_name.strip()
    if not new_name:
        return {"error": "Term name cannot be empty"}
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get old term name
        cursor.execute("SELECT name FROM terms WHERE id = ?", (term_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "Term not found"}
        old_name = row["name"]

        # Check if new name already exists
        cursor.execute("SELECT id FROM terms WHERE name = ? AND id != ?", (new_name, term_id))
        if cursor.fetchone():
            return {"error": "Term with this name already exists"}

        # Update terms table
        cursor.execute("UPDATE terms SET name = ? WHERE id = ?", (new_name, term_id))
        
        # Update subjects table
        cursor.execute("UPDATE subjects SET term = ? WHERE term = ?", (new_name, old_name))
        
        conn.commit()
        return {"message": "Term renamed successfully"}
    except sqlite3.IntegrityError:
        return {"error": "Term name already exists"}
    finally:
        conn.close()

def delete_term_from_db(term_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get term name
        cursor.execute("SELECT name FROM terms WHERE id = ?", (term_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "Term not found"}
        term_name = row["name"]

        # Check if any subjects are assigned to this term
        cursor.execute("SELECT COUNT(*) FROM subjects WHERE term = ?", (term_name,))
        count = cursor.fetchone()[0]
        if count > 0:
            return {"error": "Cannot delete term because subjects are assigned to it"}

        cursor.execute("DELETE FROM terms WHERE id = ?", (term_id,))
        conn.commit()
        return {"message": "Term deleted successfully"}
    finally:
        conn.close()
