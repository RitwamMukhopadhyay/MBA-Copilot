import os
import sys
import time
import shutil
import sqlite3
from pathlib import Path
import httpx

# Add backend to path so we can import services and modules
BACKEND_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Import knowledge modules
from knowledge.embeddings import get_openai_api_key, get_openai_embeddings
from knowledge.chunker import extract_and_chunk_pdf
from knowledge.models import get_knowledge_connection
from knowledge.faiss_store import get_subject_index_dir, load_subject_metadata
from knowledge.indexing_service import index_document_pipeline

def test_pipeline():
    print("="*60)
    print("STARTING KNOWLEDGE HUB INDEXING PIPELINE TEST")
    print("="*60)

    # 1. Verify API Key Loading
    print("\n--- 1. Verification of API Key Loading ---")
    api_key = get_openai_api_key()
    if api_key:
        print("[SUCCESS] API Key loaded successfully.")
        print(f"API Key prefix: {api_key[:10]}...{api_key[-5:] if len(api_key) > 10 else ''}")
        print("[OPENAI] API key loaded")
    else:
        print("[ERROR] OpenAI API key could not be loaded. Check .env file.")
        return False

    # 2. Verify OpenAI Client & Embeddings Call
    print("\n--- 2. Verification of OpenAI client & text-embedding-3-small ---")
    test_texts = ["This is a test query to verify text-embedding-3-small call."]
    try:
        embeddings = get_openai_embeddings(test_texts)
        if len(embeddings) == 1 and len(embeddings[0]) == 1536:
            print("[SUCCESS] OpenAI client initialized and called successfully.")
            print(f"Embedding vector dimension: {len(embeddings[0])}")
        else:
            print(f"[ERROR] Embedding response shape mismatch. Expected dimension 1536, got {len(embeddings[0]) if embeddings else 0}")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to call OpenAI embeddings API: {e}")
        return False

    # 3. Prepare Test PDF and Subject
    print("\n--- 3. Preparing Test Subject and PDF ---")
    subject_name = "Test_Subject"
    test_pdf_name = "test_document.pdf"
    
    # Check if a template PDF exists to copy
    source_pdf = Path(__file__).resolve().parent / "workspace" / "Managerial_Economics" / "PDFs" / "Strategic_Management.pdf"
    if not source_pdf.exists():
        print(f"[ERROR] Source PDF template not found at {source_pdf}")
        return False

    # Create subject directories in workspace
    workspace_dir = Path(__file__).resolve().parent / "workspace"
    subject_dir = workspace_dir / subject_name
    pdfs_dir = subject_dir / "PDFs"
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    
    dest_pdf_path = pdfs_dir / test_pdf_name
    shutil.copy(source_pdf, dest_pdf_path)
    print(f"Copied test PDF to {dest_pdf_path}")

    # Ensure subject and document are registered in SQLite
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        # Check if subject exists, insert if not
        cursor.execute("INSERT OR IGNORE INTO subjects (name) VALUES (?)", (subject_name,))
        cursor.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
        subject_id = cursor.fetchone()[0]
        
        # Clear any existing document for clean test
        cursor.execute("DELETE FROM documents WHERE subject_id = ? AND filename = ?", (subject_id, test_pdf_name))
        
        # Insert document with status 0 (Not Indexed)
        cursor.execute(
            """
            INSERT INTO documents (subject_id, filename, filepath, uploaded_at, indexed, chunk_count)
            VALUES (?, ?, ?, ?, 0, 0)
            """,
            (subject_id, test_pdf_name, str(dest_pdf_path.resolve()), "2026-06-07T12:00:00")
        )
        conn.commit()
        print(f"Registered test document in database with status 'Not Indexed' (0)")
    finally:
        conn.close()

    # 4. Verify status transition and running of indexing pipeline
    print("\n--- 4. Running Indexing Pipeline ---")
    # We will run index_document_pipeline directly so we can inspect prints and database status
    # Wait, let's verify status transition manually or by mocking/wrapping.
    # In index_document_pipeline:
    # - It updates status to 2 (Indexing)
    # - Calls chunking
    # - Calls embeddings
    # - Saves to FAISS (index.json, index.faiss)
    # - Updates status to 1 (Indexed)
    
    # Let's run it
    try:
        index_document_pipeline(subject_name, test_pdf_name)
    except Exception as e:
        print(f"[ERROR] Indexing pipeline failed: {e}")
        return False

    # 5. Verify results in SQLite
    print("\n--- 5. Verifying SQLite metadata updates ---")
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
        sub_row = cursor.fetchone()
        subject_id = sub_row["id"]
        
        cursor.execute(
            "SELECT indexed, chunk_count, last_indexed FROM documents WHERE subject_id = ? AND filename = ?", 
            (subject_id, test_pdf_name)
        )
        doc_row = cursor.fetchone()
        
        if not doc_row:
            print("[ERROR] Document record not found in database!")
            return False
            
        indexed = doc_row["indexed"]
        chunk_count = doc_row["chunk_count"]
        last_indexed = doc_row["last_indexed"]
        
        print(f"SQLite Record:")
        print(f"  indexed: {indexed} (Expected: 1 for Indexed)")
        print(f"  chunk_count: {chunk_count} (Expected: > 0)")
        print(f"  last_indexed: {last_indexed}")
        
        if indexed != 1:
            print("[ERROR] Document status is not Indexed (1)")
            return False
        if chunk_count <= 0:
            print("[ERROR] Chunk count is 0 or negative")
            return False
            
    finally:
        conn.close()

    # 6. Verify FAISS vectors and metadata index.json
    print("\n--- 6. Verifying FAISS vector store & index.json metadata ---")
    index_dir = get_subject_index_dir(subject_name)
    json_path = index_dir / "index.json"
    faiss_path = index_dir / "index.faiss"
    
    if not json_path.exists():
        print(f"[ERROR] index.json metadata not found at {json_path}")
        return False
    else:
        print(f"[SUCCESS] index.json metadata file exists.")

    if not faiss_path.exists():
        print(f"[ERROR] index.faiss file not found at {faiss_path}")
        return False
    else:
        print(f"[SUCCESS] index.faiss file exists.")

    # Load metadata and check counts
    metadata = load_subject_metadata(subject_name)
    file_chunks = [item for item in metadata if item["filename"] == test_pdf_name]
    print(f"Found {len(file_chunks)} chunks for {test_pdf_name} in FAISS store metadata.")
    
    if len(file_chunks) != chunk_count:
        print(f"[ERROR] Chunks count in FAISS metadata ({len(file_chunks)}) does not match DB chunk count ({chunk_count})")
        return False
        
    print("[SUCCESS] All database and FAISS index checks passed.")
    return True

if __name__ == "__main__":
    success = test_pipeline()
    if success:
        print("\n" + "="*60)
        print("PIPELINE TEST PASSED SUCCESSFULLY")
        print("="*60)
        sys.exit(0)
    else:
        print("\n" + "="*60)
        print("PIPELINE TEST FAILED")
        print("="*60)
        sys.exit(1)
