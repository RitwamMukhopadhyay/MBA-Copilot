import os
from datetime import datetime
from pathlib import Path
from knowledge.models import get_knowledge_connection

def sync_subject_documents(subject_name):
    """
    Scans the subject's PDFs uploads directory and syncs database records in knowledge.db.
    Registers files that are on disk but not in the DB.
    This preserves existing/legacy PDF uploads automatically.
    """
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        # Ensure subject exists in database
        cursor.execute("INSERT OR IGNORE INTO subjects (name) VALUES (?)", (subject_name,))
        cursor.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
        subject_id = cursor.fetchone()[0]
    except Exception as e:
        print(f"[DOCUMENT SYNC] Error ensuring subject '{subject_name}' exists: {e}")
        conn.close()
        return

    # Path to PDFs uploads folder
    uploads_dir = Path(__file__).resolve().parent.parent.parent / "uploads"
    subject_dir = uploads_dir / subject_name.replace(" ", "_")
    subject_pdf_dir = subject_dir / "PDFs"

    disk_files = {}
    for folder in [subject_dir, subject_pdf_dir]:
        if folder.exists() and folder.is_dir():
            for file in folder.iterdir():
                if file.is_file() and file.suffix.lower() == ".pdf":
                    stat = file.stat()
                    uploaded_at = datetime.fromtimestamp(stat.st_mtime).isoformat()
                    disk_files[file.name] = {
                        "filepath": str(file.resolve()),
                        "uploaded_at": uploaded_at
                    }

    try:
        # Retrieve registered documents in database
        cursor.execute("SELECT id, filename FROM documents WHERE subject_id = ?", (subject_id,))
        db_files = {row["filename"]: row["id"] for row in cursor.fetchall()}

        # 1. Register new files found on disk
        for filename, info in disk_files.items():
            if filename not in db_files:
                cursor.execute(
                    """
                    INSERT INTO documents (subject_id, filename, filepath, uploaded_at, indexed, chunk_count, last_indexed)
                    VALUES (?, ?, ?, ?, 0, 0, NULL)
                    """,
                    (subject_id, filename, info["filepath"], info["uploaded_at"])
                )
                print(f"[DOCUMENT SYNC] Automatically registered PDF: {filename}")

        conn.commit()
    except Exception as e:
        print(f"[DOCUMENT SYNC] Error syncing documents: {e}")
    finally:
        conn.close()

def sync_all_subjects_documents():
    """
    Syncs documents for all subjects known to the main database.
    """
    from database import get_connection as get_main_connection
    try:
        main_conn = get_main_connection()
        main_cursor = main_conn.cursor()
        main_cursor.execute("SELECT name FROM subjects")
        subjects = [row["name"] for row in main_cursor.fetchall()]
        main_conn.close()
    except Exception as e:
        print(f"[DOCUMENT SYNC] Error fetching subjects for all-sync: {e}")
        return

    for subject_name in subjects:
        sync_subject_documents(subject_name)

def register_document(subject_name, filename, filepath, uploaded_at=None, indexed=0, chunk_count=0, last_indexed=None):
    """
    Registers a new file directly (typically called upon dynamic upload).
    """
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        # Ensure subject exists
        cursor.execute("INSERT OR IGNORE INTO subjects (name) VALUES (?)", (subject_name,))
        cursor.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
        subject_id = cursor.fetchone()[0]

        if not uploaded_at:
            uploaded_at = datetime.now().isoformat()

        cursor.execute(
            """
            INSERT INTO documents (subject_id, filename, filepath, uploaded_at, indexed, chunk_count, last_indexed)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(subject_id, filename) DO UPDATE SET
                filepath = excluded.filepath,
                uploaded_at = excluded.uploaded_at,
                indexed = excluded.indexed,
                chunk_count = excluded.chunk_count,
                last_indexed = excluded.last_indexed
            """,
            (subject_id, filename, filepath, uploaded_at, indexed, chunk_count, last_indexed)
        )
        conn.commit()
        print(f"[DOCUMENT SERVICE] Successfully registered document: {filename}")
    except Exception as e:
        print(f"[DOCUMENT SERVICE] Error registering document: {e}")
    finally:
        conn.close()

def get_documents_for_subject(subject_name):
    """
    Returns lists of documents for a subject, with indexing details and validation status.
    Runs synchronization beforehand.
    """
    sync_subject_documents(subject_name)
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        # Check if there are duplicate filenames in this subject
        cursor.execute(
            """
            SELECT d.filename, COUNT(d.id) as cnt
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE s.name = ?
            GROUP BY d.filename
            """,
            (subject_name,)
        )
        duplicate_filenames = {row["filename"] for row in cursor.fetchall() if row["cnt"] > 1}

        cursor.execute(
            """
            SELECT d.id, d.filename, d.filepath, d.uploaded_at, d.indexed, d.chunk_count, d.last_indexed
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE s.name = ?
            ORDER BY d.uploaded_at DESC
            """,
            (subject_name,)
        )
        rows = [dict(row) for row in cursor.fetchall()]

        # Load FAISS index details
        from knowledge.faiss_store import get_subject_index_dir, load_subject_metadata
        faiss_metadata = load_subject_metadata(subject_name)
        faiss_file_exists = (get_subject_index_dir(subject_name) / "index.faiss").exists()

        for doc in rows:
            filename = doc["filename"]
            filepath = doc["filepath"]
            db_id = doc["id"]
            db_chunk_count = doc["chunk_count"]
            db_indexed = doc["indexed"]

            pdf_exists = os.path.exists(filepath)
            doc_chunks = [c for c in faiss_metadata if c.get("filename") == filename]
            faiss_exists = len(doc_chunks) > 0 and faiss_file_exists

            # Diagnose issues
            issues = []

            # Case 4 Checks (Repair Required)
            is_dup_metadata = filename in duplicate_filenames
            if is_dup_metadata:
                issues.append("Duplicate metadata rows in database.")

            # Duplicate chunks
            seen_chunk_nums = set()
            has_duplicate_chunks = False
            for item in doc_chunks:
                cnum = item.get("chunk_number")
                if cnum in seen_chunk_nums:
                    has_duplicate_chunks = True
                else:
                    seen_chunk_nums.add(cnum)
            if has_duplicate_chunks:
                issues.append("Duplicate chunk entries in FAISS index.")

            # Broken references (id mismatch)
            id_mismatch = any(item.get("document_id") != db_id for item in doc_chunks)
            if id_mismatch:
                issues.append("FAISS chunk document ID references are broken.")

            # Broken references (chunk count mismatch or missing index file when marked indexed)
            chunk_count_mismatch = (db_indexed == 1 and db_chunk_count != len(doc_chunks))
            if chunk_count_mismatch:
                issues.append(f"Chunk count mismatch: DB has {db_chunk_count}, index.json has {len(doc_chunks)}.")

            missing_faiss_file = (len(doc_chunks) > 0 and not faiss_file_exists)
            if missing_faiss_file:
                issues.append("FAISS index file (index.faiss) is missing from disk.")

            # Determine validation status
            if is_dup_metadata or has_duplicate_chunks or id_mismatch or chunk_count_mismatch or missing_faiss_file:
                val_status = "Repair Required"
            elif not pdf_exists and (faiss_exists or db_indexed == 1):
                val_status = "Document Missing"
                issues.append("PDF file is missing on disk.")
            elif pdf_exists and not faiss_exists:
                val_status = "Reindex Required"
                issues.append("FAISS index has not been generated for this PDF.")
            elif pdf_exists and faiss_exists:
                val_status = "Indexed"
            else:
                val_status = "Reindex Required"
                issues.append("PDF is present but FAISS index is missing.")

            doc["validation_status"] = val_status
            doc["issues"] = issues

        return rows
    except Exception as e:
        print(f"[DOCUMENT SERVICE] Error listing documents for {subject_name}: {e}")
        return []
    finally:
        conn.close()

def delete_document(subject_name: str, filename: str):
    """
    Deletes a document from the subject's workspace, removes it from the metadata database,
    removes its chunks from FAISS, and rebuilds the index.
    """
    print("[DOC] Delete Started")
    
    # 1. Retrieve document metadata and delete from knowledge.db
    conn_k = get_knowledge_connection()
    cursor_k = conn_k.cursor()
    filepath = None
    try:
        cursor_k.execute("""
            SELECT d.id, d.filepath 
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE s.name = ? AND d.filename = ?
        """, (subject_name, filename))
        row = cursor_k.fetchone()
        if row:
            doc_id = row["id"]
            filepath = row["filepath"]
            cursor_k.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn_k.commit()
            print(f"[DOCUMENT SERVICE] Deleted document metadata from knowledge.db for id {doc_id}")
    except Exception as e:
        print(f"[DOCUMENT SERVICE] Error deleting metadata from knowledge.db: {e}")
    finally:
        conn_k.close()

    # 2. Delete the physical PDF file from the disk
    if filepath:
        path = Path(filepath)
        if path.exists():
            try:
                os.remove(path)
                print(f"[DOCUMENT SERVICE] Deleted PDF from disk: {filepath}")
            except Exception as disk_err:
                print(f"[DOCUMENT SERVICE] Error deleting PDF from disk: {disk_err}")

    # 3. Delete from pdf_chat_history and pdf_metadata in the main database
    try:
        from database import get_connection as get_main_connection
        conn_m = get_main_connection()
        cursor_m = conn_m.cursor()
        cursor_m.execute("DELETE FROM pdf_chat_history WHERE subject_name = ? AND pdf_name = ?", (subject_name, filename))
        cursor_m.execute("DELETE FROM pdf_metadata WHERE subject_name = ? AND filename = ?", (subject_name, filename))
        conn_m.commit()
        conn_m.close()
        print(f"[DOCUMENT SERVICE] Cleaned up chat history and metadata in main database for '{filename}'")
    except Exception as db_err:
        print(f"[DOCUMENT SERVICE] Error cleaning up main DB references for '{filename}': {db_err}")

    # 4. Delete from FAISS store and rebuild the index
    try:
        from knowledge.faiss_store import remove_document_from_store
        remove_document_from_store(subject_name, filename)
    except Exception as faiss_err:
        print(f"[DOCUMENT SERVICE] Error removing document from FAISS store: {faiss_err}")

    print("[DOC] Deleted")
    print("[DOC] Delete Complete")
    return {"message": f"Successfully deleted document {filename}"}

def rename_document(subject_name: str, old_filename: str, new_filename: str) -> dict:
    """
    Renames a document's physical file, database records, and FAISS store metadata.
    """
    if not new_filename.lower().endswith(".pdf"):
        new_filename += ".pdf"
        
    conn_k = get_knowledge_connection()
    cursor_k = conn_k.cursor()
    try:
        # Get current document metadata
        cursor_k.execute("""
            SELECT d.id, d.filepath 
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE s.name = ? AND d.filename = ?
        """, (subject_name, old_filename))
        row = cursor_k.fetchone()
        if not row:
            return {"error": f"Document {old_filename} not found in subject {subject_name}"}
        
        doc_id = row["id"]
        old_filepath = Path(row["filepath"])
        new_filepath = old_filepath.parent / new_filename
        
        # 1. Rename the physical file on disk
        if old_filepath.exists():
            old_filepath.rename(new_filepath)
            print(f"[DOCUMENT SERVICE] Renamed file on disk: {old_filepath} -> {new_filepath}")
        else:
            print(f"[DOCUMENT SERVICE] Warning: File {old_filepath} not found on disk during rename")

        # 2. Update knowledge.db
        cursor_k.execute("""
            UPDATE documents 
            SET filename = ?, filepath = ? 
            WHERE id = ?
        """, (new_filename, str(new_filepath.resolve()), doc_id))
        conn_k.commit()
        print(f"[DOCUMENT SERVICE] Updated knowledge.db records for ID {doc_id}")

        # 3. Update main db (pdf_metadata and pdf_chat_history)
        try:
            from database import get_connection as get_main_connection
            conn_m = get_main_connection()
            cursor_m = conn_m.cursor()
            cursor_m.execute("""
                UPDATE pdf_chat_history 
                SET pdf_name = ? 
                WHERE subject_name = ? AND pdf_name = ?
            """, (new_filename, subject_name, old_filename))
            cursor_m.execute("""
                UPDATE pdf_metadata 
                SET filename = ? 
                WHERE subject_name = ? AND filename = ?
            """, (new_filename, subject_name, old_filename))
            conn_m.commit()
            conn_m.close()
            print("[DOCUMENT SERVICE] Updated main database records")
        except Exception as main_db_err:
            print(f"[DOCUMENT SERVICE] Error updating main DB during rename: {main_db_err}")

        # 4. Update index.json metadata and rebuild FAISS index
        try:
            from knowledge.faiss_store import load_subject_metadata, save_subject_metadata, rebuild_faiss_index
            metadata = load_subject_metadata(subject_name)
            updated = False
            for item in metadata:
                if item.get("filename") == old_filename:
                    item["filename"] = new_filename
                    updated = True
            if updated:
                save_subject_metadata(subject_name, metadata)
                rebuild_faiss_index(subject_name, metadata)
                print(f"[DOCUMENT SERVICE] Updated index.json metadata for {subject_name}")
        except Exception as faiss_err:
            print(f"[DOCUMENT SERVICE] Error updating FAISS metadata during rename: {faiss_err}")

        return {"message": f"Successfully renamed {old_filename} to {new_filename}"}

    except Exception as e:
        print(f"[DOCUMENT SERVICE] Error renaming document: {e}")
        return {"error": str(e)}
    finally:
        conn_k.close()

def move_document(old_subject_name: str, new_subject_name: str, filename: str) -> dict:
    """
    Moves a document's physical file, database records, and FAISS store chunks to a new subject.
    """
    if old_subject_name == new_subject_name:
        return {"message": "Document is already in the target subject"}
        
    conn_k = get_knowledge_connection()
    cursor_k = conn_k.cursor()
    try:
        # Get target subject ID or create it
        cursor_k.execute("INSERT OR IGNORE INTO subjects (name) VALUES (?)", (new_subject_name,))
        cursor_k.execute("SELECT id FROM subjects WHERE name = ?", (new_subject_name,))
        new_subject_id = cursor_k.fetchone()[0]

        # Get current document metadata
        cursor_k.execute("""
            SELECT d.id, d.filepath 
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE s.name = ? AND d.filename = ?
        """, (old_subject_name, filename))
        row = cursor_k.fetchone()
        if not row:
            return {"error": f"Document {filename} not found in subject {old_subject_name}"}
            
        doc_id = row["id"]
        old_filepath = Path(row["filepath"])
        
        # Calculate new physical path
        uploads_dir = Path(__file__).resolve().parent.parent.parent / "uploads"
        new_subject_dir = uploads_dir / new_subject_name.replace(" ", "_") / "PDFs"
        new_subject_dir.mkdir(parents=True, exist_ok=True)
        new_filepath = new_subject_dir / filename

        # 1. Move the physical PDF on disk
        if old_filepath.exists():
            import shutil
            shutil.move(str(old_filepath), str(new_filepath))
            print(f"[DOCUMENT SERVICE] Moved physical file: {old_filepath} -> {new_filepath}")
        else:
            print(f"[DOCUMENT SERVICE] Warning: File {old_filepath} not found on disk during move")

        # 2. Update knowledge.db document row
        cursor_k.execute("""
            UPDATE documents 
            SET subject_id = ?, filepath = ? 
            WHERE id = ?
        """, (new_subject_id, str(new_filepath.resolve()), doc_id))
        conn_k.commit()
        print(f"[DOCUMENT SERVICE] Updated knowledge.db document subject ID for document ID {doc_id}")

        # 3. Update main DB (pdf_metadata and pdf_chat_history)
        try:
            from database import get_connection as get_main_connection
            conn_m = get_main_connection()
            cursor_m = conn_m.cursor()
            cursor_m.execute("""
                UPDATE pdf_chat_history 
                SET subject_name = ? 
                WHERE subject_name = ? AND pdf_name = ?
            """, (new_subject_name, old_subject_name, filename))
            cursor_m.execute("""
                UPDATE pdf_metadata 
                SET subject_name = ? 
                WHERE subject_name = ? AND filename = ?
            """, (new_subject_name, old_subject_name, filename))
            conn_m.commit()
            conn_m.close()
            print("[DOCUMENT SERVICE] Updated main database references for moving doc")
        except Exception as main_db_err:
            print(f"[DOCUMENT SERVICE] Error updating main DB during move: {main_db_err}")

        # 4. Move chunks between old and new FAISS stores
        try:
            from knowledge.faiss_store import load_subject_metadata, save_subject_metadata, rebuild_faiss_index
            
            # Load old subject's chunks
            old_metadata = load_subject_metadata(old_subject_name)
            remaining_old = [item for item in old_metadata if item.get("filename") != filename]
            moving_chunks = [item for item in old_metadata if item.get("filename") == filename]
            
            # Save and rebuild old FAISS store
            save_subject_metadata(old_subject_name, remaining_old)
            rebuild_faiss_index(old_subject_name, remaining_old)
            
            # Load new subject's chunks
            new_metadata = load_subject_metadata(new_subject_name)
            # Remove any duplicate filename entry in new_metadata
            new_metadata = [item for item in new_metadata if item.get("filename") != filename]
            
            # Update chunks subject to new subject name
            for chunk in moving_chunks:
                chunk["subject"] = new_subject_name
                
            new_metadata.extend(moving_chunks)
            
            # Save and rebuild new FAISS store
            save_subject_metadata(new_subject_name, new_metadata)
            rebuild_faiss_index(new_subject_name, new_metadata)
            print(f"[DOCUMENT SERVICE] Moved {len(moving_chunks)} vector chunks from {old_subject_name} to {new_subject_name}")
        except Exception as faiss_err:
            print(f"[DOCUMENT SERVICE] Error moving FAISS vector chunks: {faiss_err}")

        return {"message": f"Successfully moved {filename} to {new_subject_name}"}

    except Exception as e:
        print(f"[DOCUMENT SERVICE] Error moving document: {e}")
        return {"error": str(e)}
    finally:
        conn_k.close()


def validate_single_document(doc, subject_name):
    """
    Validates a single document dictionary for recently uploaded files.
    """
    filename = doc["filename"]
    filepath = doc["filepath"]
    db_id = doc["id"]
    db_chunk_count = doc["chunk_count"]
    db_indexed = doc["indexed"]

    pdf_exists = os.path.exists(filepath)

    from knowledge.faiss_store import get_subject_index_dir, load_subject_metadata
    faiss_metadata = load_subject_metadata(subject_name)
    faiss_file_exists = (get_subject_index_dir(subject_name) / "index.faiss").exists()

    doc_chunks = [c for c in faiss_metadata if c.get("filename") == filename]
    faiss_exists = len(doc_chunks) > 0 and faiss_file_exists

    issues = []

    seen_chunk_nums = set()
    has_duplicate_chunks = False
    for item in doc_chunks:
        cnum = item.get("chunk_number")
        if cnum in seen_chunk_nums:
            has_duplicate_chunks = True
        else:
            seen_chunk_nums.add(cnum)

    id_mismatch = any(item.get("document_id") != db_id for item in doc_chunks)
    chunk_count_mismatch = (db_indexed == 1 and db_chunk_count != len(doc_chunks))
    missing_faiss_file = (len(doc_chunks) > 0 and not faiss_file_exists)

    if has_duplicate_chunks or id_mismatch or chunk_count_mismatch or missing_faiss_file:
        val_status = "Repair Required"
        if has_duplicate_chunks: issues.append("Duplicate chunk entries in FAISS index.")
        if id_mismatch: issues.append("FAISS chunk document ID references are broken.")
        if chunk_count_mismatch: issues.append("Chunk count mismatch between DB and index.")
        if missing_faiss_file: issues.append("FAISS index file is missing.")
    elif not pdf_exists and (faiss_exists or db_indexed == 1):
        val_status = "Document Missing"
        issues.append("PDF file is missing on disk.")
    elif pdf_exists and not faiss_exists:
        val_status = "Reindex Required"
        issues.append("FAISS index has not been generated.")
    elif pdf_exists and faiss_exists:
        val_status = "Indexed"
    else:
        val_status = "Reindex Required"

    return val_status, issues


def run_startup_recovery():
    """
    Restores index status and syncs files on backend startup.
    """
    print("\n" + "="*50)
    print("RUNNING PERSISTENCE & FAISS RECOVERY")
    print("="*50)

    # 1. Sync subjects from main DB
    from knowledge.metadata_service import sync_subjects
    try:
        sync_subjects()
        print("[PERSISTENCE] Metadata Loaded")
    except Exception as e:
        print(f"[PERSISTENCE] Error loading metadata: {e}")
        return

    # 2. Get connection
    from database import get_connection as get_main_connection
    from knowledge.models import get_knowledge_connection

    try:
        main_conn = get_main_connection()
        main_cursor = main_conn.cursor()
        main_cursor.execute("SELECT name FROM subjects")
        subjects = [row["name"] for row in main_cursor.fetchall()]
        main_conn.close()
    except Exception as e:
        print(f"[PERSISTENCE] Error fetching subjects: {e}")
        return

    # Base paths
    uploads_dir = Path(__file__).resolve().parent.parent.parent / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    k_conn = get_knowledge_connection()
    k_cursor = k_conn.cursor()

    any_repair_needed = False

    for subject_name in subjects:
        subject_safe = subject_name.replace(" ", "_")
        subject_uploads_dir = uploads_dir / subject_safe
        subject_pdfs_dir = subject_uploads_dir / "PDFs"

        # Gather all PDF files in both uploads/Subject/ and uploads/Subject/PDFs/
        disk_pdfs = {}
        for path in [subject_uploads_dir, subject_pdfs_dir]:
            if path.exists() and path.is_dir():
                for f in path.iterdir():
                    if f.is_file() and f.suffix.lower() == ".pdf":
                        disk_pdfs[f.name] = f

        # Get subject_id
        k_cursor.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
        sub_row = k_cursor.fetchone()
        if not sub_row:
            continue
        subject_id = sub_row["id"]

        # Load index.json metadata
        from knowledge.faiss_store import get_subject_index_dir, load_subject_metadata
        index_dir = get_subject_index_dir(subject_name)
        faiss_path = index_dir / "index.faiss"
        faiss_file_exists = faiss_path.exists()

        faiss_metadata = load_subject_metadata(subject_name)
        if faiss_metadata and faiss_file_exists:
            print(f"[PERSISTENCE] FAISS Loaded for subject '{subject_name}'")

        # Get database documents
        k_cursor.execute("SELECT id, filename, filepath, indexed, chunk_count, last_indexed FROM documents WHERE subject_id = ?", (subject_id,))
        db_docs = {row["filename"]: dict(row) for row in k_cursor.fetchall()}

        # Process disk files
        for filename, filepath_obj in disk_pdfs.items():
            resolved_filepath = str(filepath_obj.resolve())
            uploaded_at = datetime.fromtimestamp(filepath_obj.stat().st_mtime).isoformat()

            # Check if in FAISS
            doc_chunks = [c for c in faiss_metadata if c.get("filename") == filename]
            faiss_exists = len(doc_chunks) > 0 and faiss_file_exists

            if filename in db_docs:
                doc = db_docs[filename]
                # If path needs update (e.g. references workspace)
                current_path = doc["filepath"]
                if "workspace" in current_path or Path(current_path).resolve() != filepath_obj.resolve():
                    k_cursor.execute("UPDATE documents SET filepath = ? WHERE id = ?", (resolved_filepath, doc["id"]))

                # Check for automatic restoration:
                # PDF exists, metadata exists, FAISS index exists. If valid, restore automatically.
                if faiss_exists and (doc["indexed"] != 1 or doc["chunk_count"] != len(doc_chunks)):
                    k_cursor.execute(
                        "UPDATE documents SET indexed = 1, chunk_count = ?, last_indexed = ? WHERE id = ?",
                        (len(doc_chunks), doc["last_indexed"] or uploaded_at, doc["id"])
                    )
                    print(f"[PERSISTENCE] Documents Restored: {filename} automatically recovered indexing state.")
            else:
                # Missing from database but exists on disk! Let's restore/register it.
                indexed_val = 1 if faiss_exists else 0
                chunks_val = len(doc_chunks) if faiss_exists else 0
                k_cursor.execute(
                    """
                    INSERT INTO documents (subject_id, filename, filepath, uploaded_at, indexed, chunk_count, last_indexed)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (subject_id, filename, resolved_filepath, uploaded_at, indexed_val, chunks_val, uploaded_at if faiss_exists else None)
                )
                print(f"[PERSISTENCE] Documents Restored: {filename} registered from uploads folder.")

        # Validate Case 4 issues:
        k_cursor.execute("SELECT id, filename, filepath, indexed, chunk_count FROM documents WHERE subject_id = ?", (subject_id,))
        updated_docs = k_cursor.fetchall()
        for doc in updated_docs:
            filename = doc["filename"]
            filepath = doc["filepath"]
            doc_chunks = [c for c in faiss_metadata if c.get("filename") == filename]
            faiss_exists = len(doc_chunks) > 0 and faiss_file_exists

            seen_chunk_nums = set()
            has_duplicate_chunks = False
            for item in doc_chunks:
                cnum = item.get("chunk_number")
                if cnum in seen_chunk_nums:
                    has_duplicate_chunks = True
                else:
                    seen_chunk_nums.add(cnum)

            id_mismatch = any(item.get("document_id") != doc["id"] for item in doc_chunks)
            chunk_count_mismatch = (doc["indexed"] == 1 and doc["chunk_count"] != len(doc_chunks))

            if has_duplicate_chunks or id_mismatch or chunk_count_mismatch or (len(doc_chunks) > 0 and not faiss_file_exists):
                any_repair_needed = True
                print(f"[INDEX] Repair Required: Document '{filename}' in subject '{subject_name}' has inconsistencies.")

    k_conn.commit()
    k_conn.close()

    print("[INDEX] Validation Complete")
    if any_repair_needed:
        print("[INDEX] Repair Required")
