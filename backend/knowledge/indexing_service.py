import traceback
from datetime import datetime
from knowledge.models import get_knowledge_connection
from knowledge.chunker import extract_and_chunk_pdf
from knowledge.embeddings import get_openai_embeddings
from knowledge.faiss_store import add_document_to_store

def index_document_pipeline(subject_name: str, filename: str):
    """
    Synchronous implementation of the indexing pipeline.
    Runs text extraction, chunking, OpenAI embeddings, and FAISS indexing.
    Updates knowledge.db status appropriately.
    """
    print(f"[INDEXING WORKER] Starting indexing pipeline for subject '{subject_name}', document '{filename}'")
    print("[DOC] Reindex Started")
    conn = get_knowledge_connection()
    cursor = conn.cursor()
    
    doc_id = None
    try:
        # 1. Retrieve subject and document entries
        cursor.execute("SELECT id FROM subjects WHERE name = ?", (subject_name,))
        sub_row = cursor.fetchone()
        if not sub_row:
            print(f"[INDEXING WORKER] Error: Subject '{subject_name}' not found in database.")
            conn.close()
            return
        subject_id = sub_row["id"]

        cursor.execute("SELECT id, filepath FROM documents WHERE subject_id = ? AND filename = ?", (subject_id, filename))
        doc_row = cursor.fetchone()
        if not doc_row:
            print(f"[INDEXING WORKER] Error: Document '{filename}' not found for subject '{subject_name}'.")
            conn.close()
            return
        doc_id = doc_row["id"]
        pdf_path = doc_row["filepath"]

        # 2. Update status to Indexing (indexed = 2)
        cursor.execute("UPDATE documents SET indexed = 2 WHERE id = ?", (doc_id,))
        conn.commit()
        print(f"[INDEXING WORKER] Status updated to 'Indexing' (2) for doc_id {doc_id}")

        # 3. Chunker: Extract text and split
        print(f"[INDEXING WORKER] Extracting and chunking PDF at: {pdf_path}")
        chunks = extract_and_chunk_pdf(pdf_path)
        if not chunks:
            print(f"[INDEXING WORKER] Warning: PDF extracted 0 text chunks. Setting empty index.")
            chunks = [{"text": "", "chunk_number": 0}]

        # 4. Embeddings: Fetch OpenAI embeddings
        print(f"[INDEXING WORKER] Generating embeddings for {len(chunks)} chunks via OpenAI...")
        texts = [chunk["text"] for chunk in chunks]
        embeddings = get_openai_embeddings(texts)

        # 5. FAISS Store: Append chunks and write index files
        print(f"[INDEXING WORKER] Saving to FAISS and companion metadata store...")
        add_document_to_store(subject_name, doc_id, filename, chunks, embeddings)

        # 6. Complete: Update status to Indexed (indexed = 1)
        last_indexed = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE documents
            SET indexed = 1, chunk_count = ?, last_indexed = ?
            WHERE id = ?
            """,
            (len(chunks), last_indexed, doc_id)
        )
        conn.commit()
        print("[DB] Metadata updated")
        print("[INDEXING] Completed successfully")
        print("[DOC] Reindex Complete")
        print("[DOC] Reindexed")
        print(f"[INDEXING WORKER] Indexing completed successfully for doc_id {doc_id}. {len(chunks)} chunks written.")

    except Exception as e:
        print(f"[INDEXING WORKER] Critical error during indexing: {e}")
        traceback.print_exc()
        
        # Revert status to Not Indexed (indexed = 0) on failure
        if doc_id is not None:
            try:
                cursor.execute("UPDATE documents SET indexed = 0 WHERE id = ?", (doc_id,))
                conn.commit()
                print(f"[INDEXING WORKER] Reverted status of doc_id {doc_id} to 'Not Indexed' (0)")
            except Exception as rollback_err:
                print(f"[INDEXING WORKER] Rollback status update failed: {rollback_err}")
                
    finally:
        conn.close()

def start_background_indexing(subject_name: str, filename: str):
    """
    Triggers the indexing pipeline. Usually called inside a background task or thread.
    """
    index_document_pipeline(subject_name, filename)
