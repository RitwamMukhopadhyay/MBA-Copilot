"""
query_service.py
Phase 3 – Query Orchestration

Accepts a raw user question + subject name, generates a query embedding
via OpenAI, runs FAISS retrieval, and returns structured chunk results.

No LLM summarisation is performed here – pure retrieval only.
"""

from knowledge.embeddings import get_openai_embeddings
from knowledge.retriever  import retrieve_chunks

# ── public API ─────────────────────────────────────────────────────────────────

def search_knowledge(
    subject_name: str,
    question: str,
    top_k: int = 5,
) -> dict:
    """
    Full retrieval pipeline:

        question (str)
            ↓  embed with text-embedding-3-small
        query_embedding (1536-dim vector)
            ↓  FAISS similarity search on subject index
        top-k chunk candidates
            ↓  return structured response

    Returns a dict:
        {
            "subject"  : str,
            "question" : str,
            "results"  : [
                {
                    "rank"        : int,
                    "filename"    : str,
                    "chunk_number": int,
                    "text"        : str,
                    "similarity"  : float,
                    "l2_distance" : float,
                },
                ...
            ],
            "logs"     : [str, ...]
        }
    """
    logs: list[str] = []

    # ── Step 1: receive query ──────────────────────────────────────────────────
    logs.append(f"[RETRIEVAL] Query received: '{question[:80]}{'...' if len(question) > 80 else ''}'")
    print(logs[-1])

    if not question.strip():
        return {"subject": subject_name, "question": question, "results": [], "logs": logs,
                "error": "Question cannot be empty."}

    if not subject_name.strip():
        return {"subject": subject_name, "question": question, "results": [], "logs": logs,
                "error": "Subject name cannot be empty."}

    # ── Step 2: generate query embedding ──────────────────────────────────────
    try:
        embeddings = get_openai_embeddings([question.strip()])
        query_embedding = embeddings[0]
        logs.append("[RETRIEVAL] Query embedding generated")
        print(logs[-1])
    except Exception as e:
        err = f"[RETRIEVAL] Failed to generate query embedding: {e}"
        logs.append(err)
        print(err)
        return {"subject": subject_name, "question": question, "results": [], "logs": logs, "error": err}

    # ── Step 3: FAISS retrieval ────────────────────────────────────────────────
    logs.append(f"[RETRIEVAL] Subject selected: '{subject_name}'")
    print(logs[-1])

    try:
        results = retrieve_chunks(subject_name, query_embedding, top_k=top_k)
        logs.append(f"[RETRIEVAL] FAISS index loaded")
        logs.append(f"[RETRIEVAL] Top matches found – {len(results)} result(s)")
        logs.append(f"[RETRIEVAL] Chunks returned: {len(results)}")
        for log in logs[-3:]:
            print(log)
    except FileNotFoundError as e:
        err = str(e)
        logs.append(err)
        print(err)
        return {"subject": subject_name, "question": question, "results": [], "logs": logs, "error": err}
    except Exception as e:
        err = f"[RETRIEVAL] FAISS search error: {e}"
        logs.append(err)
        print(err)
        return {"subject": subject_name, "question": question, "results": [], "logs": logs, "error": err}

    return {
        "subject"  : subject_name,
        "question" : question,
        "results"  : results,
        "logs"     : logs,
    }


def search_knowledge_hub(
    query: str,
    subject_name: str = None,
    search_all: bool = False,
    top_k: int = 5,
) -> dict:
    """
    Direct search on the vector database.
    Supports single-subject or all-subject FAISS querying.
    Returns:
        {
            "query": str,
            "results": list[dict],
            "logs": list[str]
        }
    """
    logs: list[str] = []

    # [SEARCH] Query received
    log_msg = "[SEARCH] Query received"
    logs.append(log_msg)
    print(log_msg)

    if not query.strip():
        log_msg = "[SEARCH] Results found"
        logs.append(log_msg)
        print(log_msg)
        return {"query": query, "results": [], "logs": logs}

    # [SEARCH] Embedding generated
    try:
        embeddings = get_openai_embeddings([query.strip()])
        query_embedding = embeddings[0]
        log_msg = "[SEARCH] Embedding generated"
        logs.append(log_msg)
        print(log_msg)
    except Exception as e:
        err_msg = f"Failed to generate query embedding: {e}"
        logs.append(err_msg)
        print(err_msg)
        return {"query": query, "results": [], "logs": logs, "error": err_msg}

    # [SEARCH] Searching FAISS
    log_msg = "[SEARCH] Searching FAISS"
    logs.append(log_msg)
    print(log_msg)

    results = []

    if search_all:
        from services.subject_service import get_all_subjects
        try:
            subjects = get_all_subjects()
        except Exception as e:
            print(f"Error fetching subjects: {e}")
            subjects = []

        for sub in subjects:
            name = sub.get("name")
            if not name:
                continue
            try:
                sub_results = retrieve_chunks(name, query_embedding, top_k=top_k)
                results.extend(sub_results)
            except FileNotFoundError:
                # Silently ignore if subject has no index
                continue
            except Exception as e:
                print(f"Error searching FAISS for subject '{name}': {e}")
                continue
    else:
        if not subject_name:
            err_msg = "subject_name must be provided if search_all is False"
            logs.append(err_msg)
            print(err_msg)
            return {"query": query, "results": [], "logs": logs, "error": err_msg}
        try:
            results = retrieve_chunks(subject_name, query_embedding, top_k=top_k)
        except FileNotFoundError:
            pass
        except Exception as e:
            err_msg = f"Error searching FAISS for subject '{subject_name}': {e}"
            logs.append(err_msg)
            print(err_msg)
            return {"query": query, "results": [], "logs": logs, "error": err_msg}

    # Sort merged results by similarity descending
    results.sort(key=lambda x: x.get("similarity", 0.0), reverse=True)
    # Take top k overall results
    results = results[:top_k]
    # Re-assign rank based on sorted order
    for idx, item in enumerate(results):
        item["rank"] = idx + 1

    # [SEARCH] Results found
    log_msg = "[SEARCH] Results found"
    logs.append(log_msg)
    print(log_msg)

    return {
        "query": query,
        "results": results,
        "logs": logs
    }

