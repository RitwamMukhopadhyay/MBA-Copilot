from datetime import datetime
from knowledge.models import get_knowledge_connection

def initialize_knowledge_db():
    """
    Initializes the SQLite tables for the knowledge database.
    """
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                term TEXT
            )
            """
        )
        try:
            cursor.execute("ALTER TABLE subjects ADD COLUMN term TEXT")
        except Exception:
            pass
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                indexed INTEGER DEFAULT 0,
                chunk_count INTEGER DEFAULT 0,
                last_indexed TEXT,
                FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                UNIQUE(subject_id, filename)
            )
            """
        )
        conn.commit()
        print("[KNOWLEDGE DB] Successfully initialized database tables.")
    except Exception as e:
        print(f"[KNOWLEDGE DB] Error initializing database: {e}")
    finally:
        conn.close()

def sync_subjects():
    """
    Synchronizes subjects from the main database to the knowledge database.
    Subjects in the main DB are added to the knowledge DB.
    Subjects deleted from the main DB are removed from the knowledge DB (cascading to documents).
    """
    from database import get_connection as get_main_connection
    
    try:
        main_conn = get_main_connection()
        main_cursor = main_conn.cursor()
        main_cursor.execute("SELECT name, term FROM subjects")
        main_subjects = {row["name"]: row["term"] for row in main_cursor.fetchall()}
        main_conn.close()
    except Exception as e:
        print(f"[KNOWLEDGE SYNC] Error fetching main subjects: {e}")
        return

    conn = get_knowledge_connection()
    cursor = conn.cursor()
    
    try:
        # Insert or update subjects
        for sub_name, sub_term in main_subjects.items():
            cursor.execute("INSERT OR IGNORE INTO subjects (name, term) VALUES (?, ?)", (sub_name, sub_term))
            cursor.execute("UPDATE subjects SET term = ? WHERE name = ?", (sub_term, sub_name))
            
        # Delete subjects that no longer exist in the main database
        cursor.execute("SELECT id, name FROM subjects")
        known_subjects = cursor.fetchall()
        for row in known_subjects:
            if row["name"] not in main_subjects:
                cursor.execute("DELETE FROM subjects WHERE id = ?", (row["id"],))
                print(f"[KNOWLEDGE SYNC] Deleted subject '{row['name']}' from knowledge.db")
                
        conn.commit()
    except Exception as e:
        print(f"[KNOWLEDGE SYNC] Error syncing subjects: {e}")
    finally:
        conn.close()

def get_knowledge_stats():
    """
    Returns aggregate stats for the Knowledge Hub page.
    """
    # Ensure subjects are in sync
    sync_subjects()
    
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM subjects")
        total_subjects = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM documents")
        total_documents = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM documents WHERE indexed = 1")
        indexed_documents = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(chunk_count) FROM documents")
        total_chunks_row = cursor.fetchone()
        total_chunks = total_chunks_row[0] if total_chunks_row[0] is not None else 0
        
        # Get total terms from main db
        total_terms = 0
        try:
            from database import get_connection as get_main_connection
            main_conn = get_main_connection()
            main_cursor = main_conn.cursor()
            main_cursor.execute("SELECT COUNT(*) FROM terms")
            total_terms = main_cursor.fetchone()[0]
            main_conn.close()
        except Exception as e:
            print(f"[KNOWLEDGE STATS] Error getting total terms: {e}")

        # Get 5 recently uploaded documents
        cursor.execute("""
            SELECT d.filename, d.uploaded_at, d.indexed, s.name as subject_name 
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            ORDER BY d.uploaded_at DESC, d.id DESC
            LIMIT 5
        """)
        recent_docs = [dict(row) for row in cursor.fetchall()]
        
        return {
            "total_terms": total_terms,
            "total_subjects": total_subjects,
            "total_documents": total_documents,
            "indexed_documents": indexed_documents,
            "total_chunks": total_chunks,
            "recently_uploaded": recent_docs
        }
    except Exception as e:
        print(f"[KNOWLEDGE STATS] Error getting stats: {e}")
        return {
            "total_subjects": 0,
            "total_documents": 0,
            "indexed_documents": 0,
            "recently_uploaded": []
        }
    finally:
        conn.close()

def get_all_subjects_with_stats():
    """
    Returns a list of all subjects with document count and overall indexing status.
    """
    # Ensure subjects are in sync
    sync_subjects()
    
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT s.id, s.name, s.term,
                   COUNT(d.id) as document_count,
                   SUM(CASE WHEN d.indexed = 1 THEN 1 ELSE 0 END) as indexed_count,
                   SUM(CASE WHEN d.indexed = 2 THEN 1 ELSE 0 END) as indexing_count,
                   SUM(COALESCE(d.chunk_count, 0)) as total_chunks
            FROM subjects s
            LEFT JOIN documents d ON s.id = d.subject_id
            GROUP BY s.id, s.name, s.term
            ORDER BY s.name ASC
        """)
        subjects = []
        for row in cursor.fetchall():
            sub = dict(row)
            sub["total_chunks"] = sub["total_chunks"] if sub["total_chunks"] is not None else 0
            # A subject's status can be Indexed, Indexing, or Not Indexed
            if sub["document_count"] > 0:
                if sub["indexing_count"] > 0:
                    sub["status"] = "Indexing"
                elif sub["indexed_count"] == sub["document_count"]:
                    sub["status"] = "Indexed"
                else:
                    sub["status"] = "Not Indexed"
            else:
                sub["status"] = "Not Indexed"
            subjects.append(sub)
        return subjects
    except Exception as e:
        print(f"[KNOWLEDGE SUBJECTS] Error: {e}")
        return []
    finally:
        conn.close()
