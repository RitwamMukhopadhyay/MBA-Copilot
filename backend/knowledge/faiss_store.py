import json
import os
import faiss
import numpy as np
from pathlib import Path

# Resolve root database folder
DATABASE_ROOT = Path(__file__).resolve().parent.parent.parent / "database"

def get_subject_index_dir(subject_name: str) -> Path:
    """
    Returns the index directory path for a subject.
    Format: database/knowledge/<subject_name_underscored>/
    """
    subject_safe = subject_name.replace(" ", "_")
    path = DATABASE_ROOT / "knowledge" / subject_safe
    path.mkdir(parents=True, exist_ok=True)
    return path

def load_subject_metadata(subject_name: str) -> list[dict]:
    """
    Loads index.json metadata for a subject.
    """
    index_dir = get_subject_index_dir(subject_name)
    metadata_path = index_dir / "index.json"
    if metadata_path.exists():
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                print("[FAISS] Index loaded")
                return data
        except Exception as e:
            print(f"[FAISS STORE] Error loading metadata for {subject_name}: {e}")
    else:
        print("[FAISS] Index loaded")
    return []

def save_subject_metadata(subject_name: str, metadata: list[dict]):
    """
    Saves index.json metadata for a subject.
    """
    index_dir = get_subject_index_dir(subject_name)
    metadata_path = index_dir / "index.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)

def rebuild_faiss_index(subject_name: str, metadata: list[dict]):
    """
    Rebuilds the FAISS index file (index.faiss) from the vectors stored in the metadata.
    """
    index_dir = get_subject_index_dir(subject_name)
    faiss_path = index_dir / "index.faiss"

    if not metadata:
        # If no metadata remains, delete the FAISS file if it exists
        if faiss_path.exists():
            try:
                os.remove(faiss_path)
            except Exception as e:
                print(f"[FAISS STORE] Error deleting empty FAISS index: {e}")
        print("[FAISS] Index Updated")
        return

    # Extract vectors (dimension 1536 for text-embedding-3-small)
    vectors = [item["vector"] for item in metadata]
    np_vectors = np.array(vectors, dtype=np.float32)

    # Create index
    dimension = 1536
    index = faiss.IndexFlatL2(dimension)
    index.add(np_vectors)

    # Save index to disk
    faiss.write_index(index, str(faiss_path.resolve()))
    print(f"[FAISS STORE] Rebuilt FAISS index for '{subject_name}' with {len(metadata)} vectors.")
    print("[FAISS] Index Updated")

def add_document_to_store(subject_name: str, document_id: int, filename: str, chunks: list[dict], embeddings: list[list[float]]):
    """
    Adds (or replaces) a document's chunks and embeddings in the subject's FAISS store.
    """
    if len(chunks) != len(embeddings):
        raise ValueError("Mismatch between chunks size and embeddings list.")

    # Load existing metadata
    metadata = load_subject_metadata(subject_name)

    # Filter out existing chunks for this file to prevent duplicates
    metadata = [item for item in metadata if item["filename"] != filename]

    # Append new chunks
    for chunk, embedding in zip(chunks, embeddings):
        metadata.append({
            "document_id": document_id,
            "subject": subject_name,
            "filename": filename,
            "chunk_number": chunk["chunk_number"],
            "text": chunk["text"],
            "vector": embedding
        })

    print(f"[FAISS] Added {len(chunks)} vectors")

    # Save metadata
    save_subject_metadata(subject_name, metadata)

    # Rebuild FAISS index
    rebuild_faiss_index(subject_name, metadata)

def remove_document_from_store(subject_name: str, filename: str):
    """
    Removes a document's chunks from the subject's FAISS store and rebuilds the index.
    """
    metadata = load_subject_metadata(subject_name)
    filtered_metadata = [item for item in metadata if item["filename"] != filename]

    if len(filtered_metadata) < len(metadata):
        save_subject_metadata(subject_name, filtered_metadata)
        rebuild_faiss_index(subject_name, filtered_metadata)
        print(f"[FAISS STORE] Removed '{filename}' chunks from '{subject_name}' store.")
