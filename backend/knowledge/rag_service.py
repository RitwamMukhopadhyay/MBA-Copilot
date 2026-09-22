import sys
from pathlib import Path

# Ensure search paths include backend and agentic directories for robustness
BACKEND_DIR = Path(__file__).resolve().parent.parent
AGENTIC_DIR = BACKEND_DIR.parent / "agentic"

if str(AGENTIC_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTIC_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from knowledge.query_service import search_knowledge
from llm import ask_llm_no_memory, call_llm_api

# Mappings of common keywords/abbreviations to exact subject names in the database
SUBJECT_ABBREVIATIONS = {
    "ptm": "Pharmacology and Therapeutic Management",
    "pharmacology": "Pharmacology and Therapeutic Management",
    "pom": "Principles of Management",
    "management": "Principles of Management",
    "ipr": "Intellectual Property Rights ",
    "intellectual property": "Intellectual Property Rights ",
    "uhve": "Universal Human Values and Ethics (UHVE) ",
    "ethics": "Universal Human Values and Ethics (UHVE) ",
    "human values": "Universal Human Values and Ethics (UHVE) ",
    "pe": "Essentials of Pharmaco- epidemiology",
    "pharmaco-epidemiology": "Essentials of Pharmaco- epidemiology",
    "pharmaco epidemiology": "Essentials of Pharmaco- epidemiology",
    "pbe": "Pharma Business Environment",
    "pharma business": "Pharma Business Environment",
    "economics": "Managerial Economics",
    "marketing": "Managerial Economics",
    "strategy": "Managerial Economics",
}

def detect_subject(question: str, subjects_list: list[str]) -> str:
    """
    Detects the relevant subject for a question using keyword mapping or LLM fallback.
    """
    q_lower = question.lower()

    # 1. Check direct abbreviation and keyword matches
    for kw, sub in SUBJECT_ABBREVIATIONS.items():
        if kw in q_lower:
            # Verify the subject exists in our database list
            if sub in subjects_list:
                return sub

    # 2. Check direct substring matches with database subject names
    for sub in subjects_list:
        if sub.lower() in q_lower:
            return sub

    # 3. LLM classification fallback
    subjects_str = "\n".join([f"- {s}" for s in subjects_list])
    classify_prompt = f"""You are a precise classifier. Classify the user question into exactly one of these subjects:
{subjects_str}

If the question is completely unrelated to any of these subjects, reply with "None".
Your answer MUST be either one of the exact subject names listed above, or "None". Do not output anything else.

Question: {question}
Subject:"""

    messages = [
        {"role": "system", "content": "You are a precise classifier. Answer only with the subject name or 'None'."},
        {"role": "user", "content": classify_prompt}
    ]

    try:
        ans = call_llm_api(messages).strip()
        ans = ans.replace('"', '').replace("'", "").strip()
        if ans in subjects_list:
            return ans
        # Try soft match on LLM output
        for s in subjects_list:
            if s.lower() in ans.lower() or ans.lower() in s.lower():
                return s
    except Exception as e:
        print(f"[RAG] Subject detection LLM fallback failed: {e}")

    return "None"

def run_rag(question: str) -> dict:
    """
    Executes the full RAG pipeline:
      1. Detect Subject (Hybrid keyword/LLM)
      2. Retrieve top-5 chunks from subject FAISS index
      3. Construct strict context prompt
      4. Query LLM with grounding instructions
    """
    logs = []

    # Step 1: Question received
    log = f"[RAG] Question received: '{question}'"
    logs.append(log)
    print(log)

    # Fetch registered subjects from database metadata
    from knowledge.metadata_service import get_all_subjects_with_stats
    subjects = []
    try:
        subjects_data = get_all_subjects_with_stats()
        subjects = [s["name"] for s in subjects_data]
    except Exception as e:
        print(f"[RAG] Warning: failed to load subjects from db: {e}")

    # Step 2: Subject detected
    subject_name = detect_subject(question, subjects)
    log = f"[RAG] Subject detected: '{subject_name}'"
    logs.append(log)
    print(log)

    # Short circuit if no subject matches (general knowledge / off-topic)
    if subject_name == "None":
        answer = "The uploaded knowledge base does not contain enough information to answer this question."
        log = "[RAG] Retrieved 0 chunks"
        logs.append(log)
        print(log)
        log = "[RAG] Context length: 0"
        logs.append(log)
        print(log)
        return {
            "subject": "None",
            "question": question,
            "answer": answer,
            "chunks": [],
            "logs": logs
        }

    # Step 3: Generate Query Embedding & Search FAISS
    # We log embedding creation right before query_service triggers it
    log = "[RAG] Query embedding generated"
    logs.append(log)
    print(log)

    try:
        retrieval_res = search_knowledge(subject_name, question, top_k=5)
        chunks = retrieval_res.get("results", [])
        log = "[RAG] FAISS search completed"
        logs.append(log)
        print(log)
    except Exception as e:
        print(f"[RAG] Retrieval search failed: {e}")
        chunks = []

    # Step 4: Retrieved X chunks
    log = f"[RAG] Retrieved {len(chunks)} chunks"
    logs.append(log)
    print(log)

    # Short circuit if index has no chunks or is missing
    if not chunks:
        answer = "The uploaded knowledge base does not contain enough information to answer this question."
        log = "[RAG] Context length: 0"
        logs.append(log)
        print(log)
        return {
            "subject": subject_name,
            "question": question,
            "answer": answer,
            "chunks": [],
            "logs": logs
        }

    # Build prompt context
    context_text = "\n\n".join([item.get("text", "") for item in chunks])

    # Step 5: Context length
    log = f"[RAG] Context length: {len(context_text)} characters"
    logs.append(log)
    print(log)

    # Step 6: Sending grounded prompt to LLM
    log = "[RAG] Sending grounded prompt to LLM"
    logs.append(log)
    print(log)

    # strict prompt template matching the instruction format requirements
    prompt = f"""CONTEXT:
{context_text}

QUESTION:
{question}

INSTRUCTIONS:
Answer ONLY using the provided context.
If information is not present in context:
Reply:
"The uploaded knowledge base does not contain enough information to answer this question."
"""

    try:
        answer = ask_llm_no_memory(prompt)
    except Exception as e:
        answer = f"Error generating grounded LLM response: {e}"
        print(f"[RAG] Error calling LLM: {e}")

    return {
        "subject": subject_name,
        "question": question,
        "answer": answer.strip(),
        "chunks": chunks,
        "logs": logs
    }
