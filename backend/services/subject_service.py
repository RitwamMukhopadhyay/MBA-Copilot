from database import get_connection
import sqlite3
import shutil
from pathlib import Path


def add_subject_to_db(subject):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            INSERT INTO subjects
            (
                course_code,
                name,
                credits,
                faculty,
                term
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                subject.course_code,
                subject.name,
                subject.credits,
                subject.faculty,
                subject.term
            )
        )

        conn.commit()

        return {
            "message": "Subject added"
        }

    except sqlite3.IntegrityError:

        return {
            "message": "Subject already exists"
        }

    finally:

        conn.close()


def get_all_subjects():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM subjects"
    )

    subjects = [
        dict(row)
        for row in cursor.fetchall()
    ]

    conn.close()

    return subjects


def delete_subject_from_db(subject_id):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # Get subject before deletion
        cursor.execute(
            """
            SELECT *
            FROM subjects
            WHERE id = ?
            """,
            (subject_id,)
        )

        subject = cursor.fetchone()

        if not subject:

            return {
                "message": "Subject not found"
            }

        subject_name = subject["name"]

        # Delete calendar events associated with this subject
        cursor.execute(
            """
            DELETE FROM events
            WHERE subject_id = ?
            """,
            (subject_id,)
        )

        # Delete attendance records
        cursor.execute(
            """
            DELETE FROM attendance
            WHERE subject_id = ?
            """,
            (subject_id,)
        )

        # Delete study sessions
        cursor.execute(
            """
            DELETE FROM study_sessions
            WHERE subject_id = ?
            """,
            (subject_id,)
        )

        # Delete exams
        cursor.execute(
            """
            DELETE FROM exams
            WHERE subject_id = ?
            """,
            (subject_id,)
        )

        # Delete assignments
        cursor.execute(
            """
            DELETE FROM assignments
            WHERE subject_id = ?
            """,
            (subject_id,)
        )

        # Delete PDF chat history
        cursor.execute(
            """
            DELETE FROM pdf_chat_history
            WHERE subject_name = ?
            """,
            (subject_name,)
        )

        # Delete PDF metadata
        cursor.execute(
            """
            DELETE FROM pdf_metadata
            WHERE subject_name = ?
            """,
            (subject_name,)
        )

        # Delete subject
        cursor.execute(
            """
            DELETE FROM subjects
            WHERE id = ?
            """,
            (subject_id,)
        )

        conn.commit()

        # -------------------------------------
        # Delete uploads folder
        # -------------------------------------

        uploads_folder = (
            Path(__file__).resolve().parents[2]
            / "uploads"
            / subject_name.replace(" ", "_")
        )

        if uploads_folder.exists():
            try:
                shutil.rmtree(uploads_folder)
                print(f"Deleted uploads folder: {uploads_folder}")
            except Exception as e:
                print(f"Error deleting uploads folder {uploads_folder}: {e}")
        else:
            print(f"Uploads folder not found: {uploads_folder}")

        # -------------------------------------
        # Delete knowledge store folder
        # -------------------------------------
        knowledge_folder = (
            Path(__file__).resolve().parents[2]
            / "database"
            / "knowledge"
            / subject_name.replace(" ", "_")
        )
        if knowledge_folder.exists():
            try:
                shutil.rmtree(knowledge_folder)
                print(f"Deleted knowledge store folder: {knowledge_folder}")
            except Exception as e:
                print(f"Error deleting knowledge store folder {knowledge_folder}: {e}")

        # Delete from knowledge.db explicitly
        try:
            from knowledge.models import get_knowledge_connection
            k_conn = get_knowledge_connection()
            k_cursor = k_conn.cursor()
            k_cursor.execute("DELETE FROM subjects WHERE name = ?", (subject_name,))
            k_conn.commit()
            k_conn.close()
            print(f"[SUBJECT DELETE] Successfully deleted '{subject_name}' from knowledge.db")
        except Exception as e:
            print(f"[SUBJECT DELETE] Warning: failed to delete from knowledge.db: {e}")

        print("[SUBJECT] Deleted")
        return {
            "message": f"{subject_name} deleted successfully"
        }

    finally:

        conn.close()


def update_subject_in_db(subject_id: int, subject):
    """
    Updates a subject's details in the database.
    If the subject's name is changed, also renames:
      - The workspace folder
      - The knowledge index folder
      - References in pdf_metadata and pdf_chat_history
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Get the old subject name before updating
        cursor.execute("SELECT name FROM subjects WHERE id = ?", (subject_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "Subject not found"}
        old_name = row["name"]

        # Update the subject record
        cursor.execute(
            """
            UPDATE subjects
            SET course_code = ?,
                name = ?,
                credits = ?,
                faculty = ?,
                term = ?
            WHERE id = ?
            """,
            (
                subject.course_code,
                subject.name,
                subject.credits,
                subject.faculty,
                subject.term,
                subject_id
            )
        )
        conn.commit()

        # If the subject name changed, perform folder and reference renames
        if old_name != subject.name:
            root_dir = Path(__file__).resolve().parents[2]

            # 1. Rename uploads folder
            old_uploads = root_dir / "uploads" / old_name.replace(" ", "_")
            new_uploads = root_dir / "uploads" / subject.name.replace(" ", "_")
            if old_uploads.exists():
                try:
                    old_uploads.rename(new_uploads)
                    print(f"Renamed uploads folder from {old_uploads} to {new_uploads}")
                except Exception as e:
                    print(f"[SUBJECT UPDATE] Warning: failed to rename uploads folder: {e}")

            # 2. Rename knowledge index folder
            old_knowledge = root_dir / "database" / "knowledge" / old_name.replace(" ", "_")
            new_knowledge = root_dir / "database" / "knowledge" / subject.name.replace(" ", "_")
            if old_knowledge.exists():
                try:
                    old_knowledge.rename(new_knowledge)
                    print(f"Renamed knowledge folder from {old_knowledge} to {new_knowledge}")
                except Exception as e:
                    print(f"[SUBJECT UPDATE] Warning: failed to rename knowledge folder: {e}")

            # 3. Update pdf_metadata table references
            cursor.execute(
                "UPDATE pdf_metadata SET subject_name = ? WHERE subject_name = ?",
                (subject.name, old_name)
            )

            # 4. Update pdf_chat_history table references
            cursor.execute(
                "UPDATE pdf_chat_history SET subject_name = ? WHERE subject_name = ?",
                (subject.name, old_name)
            )
            conn.commit()

            # 5. Update knowledge.db subject name, file paths, and companion index.json
            try:
                from knowledge.models import get_knowledge_connection
                k_conn = get_knowledge_connection()
                k_cursor = k_conn.cursor()
                
                # Update subject name
                k_cursor.execute(
                    "UPDATE subjects SET name = ? WHERE name = ?",
                    (subject.name, old_name)
                )
                
                # Fetch all documents under this subject to update their filepaths
                k_cursor.execute("""
                    SELECT d.id, d.filepath, d.filename
                    FROM documents d
                    JOIN subjects s ON d.subject_id = s.id
                    WHERE s.name = ?
                """, (subject.name,))
                docs = k_cursor.fetchall()
                
                old_safe = old_name.replace(" ", "_")
                new_safe = subject.name.replace(" ", "_")
                
                for doc in docs:
                    doc_id = doc["id"]
                    old_path = doc["filepath"]
                    # Replace folder name in filepath
                    new_path = old_path.replace(f"uploads/{old_safe}/PDFs", f"uploads/{new_safe}/PDFs")
                    new_path = new_path.replace(f"uploads\\{old_safe}\\PDFs", f"uploads\\{new_safe}\\PDFs")
                    # Also handle direct uploads/Subject/ paths
                    new_path = new_path.replace(f"uploads/{old_safe}/", f"uploads/{new_safe}/")
                    new_path = new_path.replace(f"uploads\\{old_safe}\\", f"uploads\\{new_safe}\\")
                    
                    k_cursor.execute("UPDATE documents SET filepath = ? WHERE id = ?", (new_path, doc_id))
                    
                k_conn.commit()
                k_conn.close()
                print(f"[SUBJECT UPDATE] Updated {len(docs)} document paths in knowledge.db")
            except Exception as e:
                print(f"[SUBJECT UPDATE] Warning: failed to update knowledge.db document paths: {e}")

            # 6. Update subject field inside the FAISS companion index.json
            try:
                index_json_path = root_dir / "database" / "knowledge" / new_safe / "index.json"
                if index_json_path.exists():
                    import json
                    with open(index_json_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    for chunk in meta:
                        chunk["subject"] = subject.name
                    with open(index_json_path, "w", encoding="utf-8") as f:
                        json.dump(meta, f, indent=4)
                    print(f"[SUBJECT UPDATE] Updated index.json subject metadata for {subject.name}")
            except Exception as e:
                print(f"[SUBJECT UPDATE] Warning: failed to update index.json: {e}")

            print("[SUBJECT] Renamed")

        return {"message": "Subject updated successfully"}

    except sqlite3.IntegrityError:
        return {"error": "Subject with this name already exists"}
    finally:
        conn.close()