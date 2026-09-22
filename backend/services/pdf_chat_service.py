import re
import fitz
from pathlib import Path
from datetime import datetime

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"

from database import get_connection
from llm import call_llm_api, SYSTEM_FORMATTING_PROMPT

def chunk_text(text: str, chunk_size: int = 3000, overlap: int = 500) -> list:
    chunks = []
    start = 0
    text_len = len(text)
    if text_len == 0:
        return []
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        if end == text_len:
            break
        start += (chunk_size - overlap)
    return chunks

def get_keywords(text: str) -> list:
    words = re.findall(r'\w+', text.lower())
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 
        'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 
        'after', 'above', 'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 
        'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 
        'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 
        'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 
        'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
        'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 
        'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 
        'whom', 'this', 'that', 'these', 'those', 'am', 'been', 'being', 'have', 'has', 'had', 'having', 
        'do', 'does', 'did', 'doing', 'would', 'could', 'should', 'ought'
    }
    return list(set(w for w in words if w not in stopwords and len(w) > 2))

def retrieve_relevant_chunks(query: str, chunks: list, top_k: int = 3) -> str:
    if not chunks:
        return ""
    
    query_keywords = get_keywords(query)
    if not query_keywords:
        return "\n\n--- [Page Section] ---\n\n".join(chunks[:top_k])
        
    scored_chunks = []
    for i, chunk in enumerate(chunks):
        chunk_lower = chunk.lower()
        score = 0
        for kw in query_keywords:
            score += chunk_lower.count(kw)
        scored_chunks.append((score, i, chunk))
        
    scored_chunks.sort(key=lambda x: (x[0], -x[1]), reverse=True)
    selected = scored_chunks[:top_k]
    selected.sort(key=lambda x: x[1])
    
    return "\n\n--- [Page Section] ---\n\n".join(c[2] for c in selected)

def get_general_context(chunks: list, max_chars: int = 24000) -> str:
    if not chunks:
        return ""
    
    chunk_len_avg = sum(len(c) for c in chunks) / len(chunks)
    max_chunks = max(1, int(max_chars // chunk_len_avg))
    
    if len(chunks) <= max_chunks:
        return "\n\n--- [Page Section] ---\n\n".join(chunks)
    
    sampled_indices = [int(i * (len(chunks) - 1) / (max_chunks - 1)) for i in range(max_chunks)]
    unique_indices = []
    for idx in sampled_indices:
        if idx not in unique_indices:
            unique_indices.append(idx)
            
    selected_chunks = [chunks[i] for i in unique_indices]
    return "\n\n--- [Page Section] ---\n\n".join(selected_chunks)

def get_pdf_chat_history(subject_name: str, pdf_name: str) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT role, content, timestamp 
        FROM pdf_chat_history 
        WHERE subject_name = ? AND pdf_name = ?
        ORDER BY id ASC
        """,
        (subject_name, pdf_name)
    )
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return history

def save_pdf_chat_message(subject_name: str, pdf_name: str, role: str, content: str):
    conn = get_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    cursor.execute(
        """
        INSERT INTO pdf_chat_history (subject_name, pdf_name, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """,
        (subject_name, pdf_name, role, content, timestamp)
    )
    conn.commit()
    conn.close()

def clear_pdf_chat_history(subject_name: str, pdf_name: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        DELETE FROM pdf_chat_history 
        WHERE subject_name = ? AND pdf_name = ?
        """,
        (subject_name, pdf_name)
    )
    conn.commit()
    conn.close()

def extract_pdf_text(subject_name: str, pdf_name: str) -> str:
    pdf_path = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
        / "PDFs"
        / pdf_name
    )
    if not pdf_path.exists():
        # Fallback to direct uploads/Subject/ folder check
        pdf_path_fallback = (
            UPLOADS_ROOT
            / subject_name.replace(" ", "_")
            / pdf_name
        )
        if pdf_path_fallback.exists():
            pdf_path = pdf_path_fallback
        else:
            raise FileNotFoundError(f"{pdf_name} not found in uploads for subject {subject_name}")

    document = fitz.open(pdf_path)
    text = ""
    for page in document:
        text += page.get_text() + "\n"
    document.close()
    return text

def ask_pdf_question(subject_name: str, pdf_name: str, question_type: str, custom_question: str = None) -> str:
    raw_text = extract_pdf_text(subject_name, pdf_name)
    chunks = chunk_text(raw_text, chunk_size=3000, overlap=500)
    
    if question_type == "summarize":
        context = get_general_context(chunks)
        prompt = f"Summarize the main topics, key concepts, and managerial implications of the PDF: {pdf_name}.\n\nContext from PDF:\n{context}"
        user_display_msg = "Summarize PDF"
    elif question_type == "notes":
        context = get_general_context(chunks)
        prompt = f"Generate comprehensive MBA-style revision notes from the PDF: {pdf_name}. Structure it with headings, bullet points, and key takeaways.\n\nContext from PDF:\n{context}"
        user_display_msg = "Generate Notes"
    elif question_type == "mcqs":
        context = get_general_context(chunks)
        prompt = f"Generate 10 MBA multiple choice questions (MCQs) with 4 options, indicating the correct answer and a brief explanation, based on the PDF: {pdf_name}.\n\nContext from PDF:\n{context}"
        user_display_msg = "Generate MCQs"
    elif question_type == "flashcards":
        context = get_general_context(chunks)
        prompt = f"Generate 10 revision flashcards (Front: Concept/Question, Back: Explanation/Answer) based on the PDF: {pdf_name}.\n\nContext from PDF:\n{context}"
        user_display_msg = "Generate Flashcards"
    elif question_type == "viva":
        context = get_general_context(chunks)
        prompt = f"Generate 8-10 viva (oral exam) questions and ideal answers based on the PDF: {pdf_name}.\n\nContext from PDF:\n{context}"
        user_display_msg = "Generate Viva Questions"
    elif question_type == "custom":
        if not custom_question or not custom_question.strip():
            raise ValueError("Custom question cannot be empty")
        context = retrieve_relevant_chunks(custom_question.strip(), chunks, top_k=3)
        prompt = f"Answer the following question about the PDF: {pdf_name} using the relevant context provided.\n\nQuestion: {custom_question.strip()}\n\nContext from PDF:\n{context}"
        user_display_msg = custom_question.strip()
    else:
        raise ValueError(f"Invalid question type: {question_type}")
        
    history = get_pdf_chat_history(subject_name, pdf_name)
    
    messages = []
    messages.append({"role": "system", "content": SYSTEM_FORMATTING_PROMPT})
    messages.append({
        "role": "system", 
        "content": f"You are a helpful MBA Copilot. You are answering queries about the PDF document '{pdf_name}'."
    })
    
    for msg in history[-8:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    messages.append({"role": "user", "content": prompt})
    
    response_text = call_llm_api(messages)
    
    source_footer = f"\n\n_Generated from {pdf_name}_"
    if source_footer not in response_text:
        response_text += source_footer
        
    save_pdf_chat_message(subject_name, pdf_name, "user", user_display_msg)
    save_pdf_chat_message(subject_name, pdf_name, "assistant", response_text)
    
    return response_text
