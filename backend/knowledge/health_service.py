import os
import json
import faiss
from pathlib import Path
from knowledge.models import get_knowledge_connection
from knowledge.faiss_store import get_subject_index_dir, load_subject_metadata, save_subject_metadata, rebuild_faiss_index
from knowledge.document_service import delete_document

def check_subject_health(subject_name: str) -> dict:
    """
    Checks the index health for a subject.
    Detects:
    1. Missing PDFs: Registered documents whose physical file does not exist on disk.
    2. Broken indexes: If 'indexed = 1' but index files are missing or FAISS index is corrupted.
    3. Orphaned metadata: Chunks in index.json for files that are not registered or not marked indexed = 1.
    4. Duplicate chunks: Duplicate chunk entries in index.json.
    """
    issues = []
    has_index_files = False
    
    # 1. Load registered documents from knowledge.db
    conn_k = get_knowledge_connection()
    cursor_k = conn_k.cursor()
    
    # Ensure subject is ensured/registered
    cursor_k.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
    sub_row = cursor_k.fetchone()
    if not sub_row:
        conn_k.close()
        print("[INDEX] Health Check Complete")
        return {
            "status": "No Index",
            "issues": ["Subject not registered in knowledge base"],
            "documents_count": 0,
            "chunks_count": 0,
            "last_indexed": None
        }
    
    subject_id = sub_row["id"]
    cursor_k.execute("SELECT id, filename, filepath, indexed, chunk_count, last_indexed FROM documents WHERE subject_id = ?", (subject_id,))
    db_docs = [dict(row) for row in cursor_k.fetchall()]
    conn_k.close()
    
    db_filenames = {doc["filename"] for doc in db_docs}
    indexed_db_filenames = {doc["filename"] for doc in db_docs if doc["indexed"] == 1}
    
    # 2. Check physical PDFs
    for doc in db_docs:
        filepath = Path(doc["filepath"])
        if not filepath.exists():
            issues.append(f"Missing PDF: {doc['filename']} does not exist at {filepath}")

    # 3. Check FAISS index files
    index_dir = get_subject_index_dir(subject_name)
    metadata_path = index_dir / "index.json"
    faiss_path = index_dir / "index.faiss"
    
    any_indexed = any(doc["indexed"] == 1 for doc in db_docs)
    
    if metadata_path.exists() and faiss_path.exists():
        has_index_files = True
        try:
            # Test loading the FAISS index
            index = faiss.read_index(str(faiss_path.resolve()))
            faiss_vector_count = index.ntotal
        except Exception as e:
            issues.append(f"Broken Index: Failed to load FAISS index file: {e}")
            faiss_vector_count = -1
    else:
        if any_indexed:
            issues.append("Broken Index: Index files missing but documents marked as indexed in database")
        faiss_vector_count = -1

    # 4. Check index.json metadata (orphans and duplicates)
    metadata = []
    if metadata_path.exists():
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception as e:
            issues.append(f"Broken Index: Failed to parse index.json: {e}")
            
    chunks_count = len(metadata)
    
    # Check duplicate chunks
    seen_chunks = set()
    duplicates_found = False
    for item in metadata:
        fname = item.get("filename")
        chunk_num = item.get("chunk_number")
        key = (fname, chunk_num)
        if key in seen_chunks:
            if not duplicates_found:
                issues.append(f"Duplicate chunks: Multiple entries found in index.json")
                duplicates_found = True
        else:
            seen_chunks.add(key)
            
    # Check orphaned metadata
    orphaned_docs = set()
    for item in metadata:
        fname = item.get("filename")
        if fname not in indexed_db_filenames:
            orphaned_docs.add(fname)
            
    for fname in orphaned_docs:
        issues.append(f"Orphaned metadata: Chunks exist in index.json for unregistered or unindexed document '{fname}'")

    # Mismatches
    if faiss_vector_count >= 0 and faiss_vector_count != chunks_count:
        issues.append(f"Broken Index: Vector count mismatch. FAISS index has {faiss_vector_count} vectors, index.json has {chunks_count} chunks.")

    # Determine status
    if not any_indexed and not has_index_files:
        status = "No Index"
    elif issues:
        status = "Unhealthy"
    else:
        status = "Healthy"

    # Get overall document counts and last indexed from db
    documents_count = len(db_docs)
    last_indexed = None
    # find the most recent last_indexed time
    for doc in db_docs:
        if doc["last_indexed"]:
            if not last_indexed or doc["last_indexed"] > last_indexed:
                last_indexed = doc["last_indexed"]

    print("[INDEX] Health Check Complete")
    
    return {
        "status": status,
        "issues": issues,
        "documents_count": documents_count,
        "chunks_count": chunks_count,
        "last_indexed": last_indexed
    }

def repair_subject_index(subject_name: str) -> dict:
    """
    Repairs diagnostic discrepancies:
    1. Removes orphaned metadata.
    2. Deduplicates index.json chunks.
    3. Removes database records and chunks for missing PDFs.
    4. Rebuilds the FAISS index files.
    """
    # 1. First find missing PDFs and delete them properly
    conn_k = get_knowledge_connection()
    cursor_k = conn_k.cursor()
    cursor_k.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
    sub_row = cursor_k.fetchone()
    if not sub_row:
        conn_k.close()
        return {"message": f"Subject '{subject_name}' not found. Nothing to repair."}
    
    subject_id = sub_row["id"]
    cursor_k.execute("SELECT filename, filepath FROM documents WHERE subject_id = ?", (subject_id,))
    db_docs = [dict(row) for row in cursor_k.fetchall()]
    conn_k.close()
    
    deleted_docs = []
    for doc in db_docs:
        filepath = Path(doc["filepath"])
        if not filepath.exists():
            # Delete missing document from all tables and indexes
            delete_document(subject_name, doc["filename"])
            deleted_docs.append(doc["filename"])
            
    # Refresh lists after deletion of missing documents
    conn_k = get_knowledge_connection()
    cursor_k = conn_k.cursor()
    cursor_k.execute("SELECT filename FROM documents WHERE subject_id = ? AND indexed = 1", (subject_id,))
    indexed_db_filenames = {row["filename"] for row in cursor_k.fetchall()}
    conn_k.close()
    
    # 2. Clean metadata
    index_dir = get_subject_index_dir(subject_name)
    metadata_path = index_dir / "index.json"
    
    metadata = []
    if metadata_path.exists():
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception as e:
            print(f"[REPAIR] Error loading metadata to repair: {e}")
            
    cleaned_metadata = []
    seen_chunks = set()
    orphans_removed = 0
    duplicates_removed = 0
    
    for item in metadata:
        fname = item.get("filename")
        chunk_num = item.get("chunk_number")
        
        # Check if orphaned
        if fname not in indexed_db_filenames:
            orphans_removed += 1
            continue
            
        # Check if duplicate
        key = (fname, chunk_num)
        if key in seen_chunks:
            duplicates_removed += 1
            continue
            
        seen_chunks.add(key)
        cleaned_metadata.append(item)
        
    # 3. Save cleaned metadata and rebuild index
    save_subject_metadata(subject_name, cleaned_metadata)
    rebuild_faiss_index(subject_name, cleaned_metadata)
    
    return {
        "message": f"Index repair complete for '{subject_name}'",
        "deleted_missing_docs": deleted_docs,
        "orphans_removed": orphans_removed,
        "duplicates_removed": duplicates_removed,
        "final_chunks": len(cleaned_metadata)
    }
