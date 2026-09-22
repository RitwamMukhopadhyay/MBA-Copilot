"""
retriever.py
Phase 3 – Retrieval Engine

Loads a subject's FAISS index, converts a query embedding into a
similarity search, and returns the top-k matching text chunks.
"""

import faiss
import numpy as np
from pathlib import Path
from knowledge.faiss_store import get_subject_index_dir, load_subject_metadata

# ── constants ──────────────────────────────────────────────────────────────────
EMBEDDING_DIM = 1536          # text-embedding-3-small output dimension
DEFAULT_TOP_K  = 5


# ── public API ─────────────────────────────────────────────────────────────────

def retrieve_chunks(
    subject_name: str,
    query_embedding: list[float],
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    """
    Searches the FAISS index for *subject_name* using *query_embedding*
    and returns the top-k most similar chunks.

    Each returned dict contains:
        - subject        : str
        - filename       : str
        - chunk_number   : int
        - text           : str
        - similarity     : float  (0-1, higher = more similar)
        - l2_distance    : float  (raw FAISS L2 distance, lower = more similar)

    Raises FileNotFoundError if no FAISS index exists for the subject.
    """
    print(f"[RETRIEVAL] Subject selected: '{subject_name}'")

    index_dir  = get_subject_index_dir(subject_name)
    faiss_path = index_dir / "index.faiss"

    if not faiss_path.exists():
        raise FileNotFoundError(
            f"[RETRIEVAL] No FAISS index found for subject '{subject_name}'. "
            "Index this subject first."
        )

    # ── 1. Load FAISS index ────────────────────────────────────────────────────
    index = faiss.read_index(str(faiss_path.resolve()))
    print(f"[RETRIEVAL] FAISS index loaded – {index.ntotal} vectors")

    # ── 2. Load companion metadata (text + chunk info) ─────────────────────────
    metadata = load_subject_metadata(subject_name)
    if not metadata:
        return []

    # ── 3. Run similarity search ───────────────────────────────────────────────
    query_np = np.array([query_embedding], dtype=np.float32)
    actual_k = min(top_k, index.ntotal)
    distances, indices = index.search(query_np, actual_k)

    print(f"[RETRIEVAL] Top matches found – returning {actual_k} result(s)")

    # ── 4. Build results ───────────────────────────────────────────────────────
    results = []
    for rank, (dist, idx) in enumerate(zip(distances[0], indices[0])):
        if idx == -1 or idx >= len(metadata):
            continue                          # FAISS padding

        item = metadata[idx]

        # Convert L2 distance to a 0-1 similarity score.
        # We use an exponential decay so that dist≈0 → sim≈1 and dist→∞ → sim→0.
        similarity = float(np.exp(-dist / EMBEDDING_DIM))

        results.append({
            "rank"         : rank + 1,
            "subject"      : item.get("subject", subject_name),
            "filename"     : item.get("filename", ""),
            "chunk_number" : item.get("chunk_number", idx),
            "text"         : item.get("text", ""),
            "similarity"   : round(similarity, 4),
            "l2_distance"  : round(float(dist), 4),
        })

    print(f"[RETRIEVAL] Chunks returned: {len(results)}")
    return results
