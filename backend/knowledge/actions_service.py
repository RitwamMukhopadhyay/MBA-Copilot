"""
actions_service.py

Handles Knowledge Actions for the Knowledge Hub:
- Notes
- MCQs
- Flashcards
- Viva Questions
- Revision Sheets

All actions retrieve context chunks from the subject FAISS index and
ground the LLM generation strictly in the retrieved context.
"""

import sys
from pathlib import Path
from fpdf import FPDF

# Ensure paths include backend and agentic
BACKEND_DIR = Path(__file__).resolve().parent.parent
AGENTIC_DIR = BACKEND_DIR.parent / "agentic"

if str(AGENTIC_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTIC_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from knowledge.query_service import search_knowledge
from llm import ask_llm_no_memory

class NotesPDF(FPDF):
    def __init__(self, subject_name="Subject"):
        super().__init__()
        self.subject_name = subject_name

    def header(self):
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(156, 163, 175)  # gray-400
        self.cell(0, 10, f'MBA COPILOT - {self.subject_name.upper()} STUDY NOTES', 0, 0, 'L')
        self.ln(10)
        
    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(156, 163, 175)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def generate_pdf_from_markdown(subject_name: str, markdown_text: str, output_path: Path):
    """
    Transforms raw markdown notes into a styled, printable PDF.
    """
    pdf = NotesPDF(subject_name=subject_name)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Parse lines
    lines = markdown_text.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            pdf.ln(4)
            continue
            
        # Clean line to ensure it is latin-1 compatible
        line = (line.replace('\u2013', '-')
                    .replace('\u2014', '-')
                    .replace('\u201c', '"')
                    .replace('\u201d', '"')
                    .replace('\u2018', "'")
                    .replace('\u2019', "'")
                    .replace('\u2022', '-')
                    .replace('\u2026', '...'))
        # Safe encode-decode
        line = line.encode('latin-1', 'replace').decode('latin-1')
        
        # Check headings
        if line.startswith('# '):
            pdf.set_font('Helvetica', 'B', 16)
            pdf.set_text_color(30, 41, 59)  # Slate 800
            pdf.cell(0, 10, line[2:], 0, 1)
            pdf.ln(3)
        elif line.startswith('## '):
            pdf.set_font('Helvetica', 'B', 13)
            pdf.set_text_color(79, 70, 229)  # Indigo 600
            pdf.cell(0, 8, line[3:], 0, 1)
            pdf.ln(2)
        elif line.startswith('### '):
            pdf.set_font('Helvetica', 'B', 11)
            pdf.set_text_color(30, 41, 59)
            pdf.cell(0, 6, line[4:], 0, 1)
            pdf.ln(1)
        elif line.startswith('- ') or line.startswith('* '):
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(51, 65, 85)  # Slate 700
            # bullet indentation
            pdf.write(5, '  *  ')
            # Handle bold formatting inside line: e.g. **Bold Text**: regular text
            parts = line[2:].split('**')
            for i, part in enumerate(parts):
                if i % 2 == 1:
                    pdf.set_font('Helvetica', 'B', 10)
                else:
                    pdf.set_font('Helvetica', '', 10)
                pdf.write(5, part)
            pdf.ln(5)
        else:
            # Paragraph
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(51, 65, 85)
            # Handle inline bold formatting
            parts = line.split('**')
            for i, part in enumerate(parts):
                if i % 2 == 1:
                    pdf.set_font('Helvetica', 'B', 10)
                else:
                    pdf.set_font('Helvetica', '', 10)
                pdf.write(5, part)
            pdf.ln(5)
            
    pdf.output(str(output_path.resolve()))

def run_knowledge_action(subject_name: str, action_type: str) -> dict:
    """
    Executes a RAG-based Knowledge Action for the given subject.
    
    1. Triggers the action and logs start state.
    2. Performs FAISS search for context chunks.
    3. Formulates a prompt based on the action type.
    4. Invokes LLM to generate the structured study material.
    5. Returns result content and execution logs.
    """
    logs = []
    action_type = action_type.lower().strip()
    
    # 1. Action Started Log (V1 custom notes log vs default)
    if action_type == "notes":
        log = "[NOTES] Generation Started"
        logs.append(log)
        print(log)
        log = "[NOTES] Subject Selected"
        logs.append(log)
        print(log)
    else:
        action_log_mapping = {
            "mcqs": "MCQ Generation Started",
            "flashcards": "Flashcard Generation Started",
            "viva": "Viva Generation Started",
            "revision": "Revision Sheet Generation Started"
        }
        action_name = action_log_mapping.get(action_type, f"{action_type.capitalize()} Generation Started")
        log = f"[ACTION] {action_name}"
        logs.append(log)
        print(log)
    
    # 2. Formulate search query based on action type to get the most relevant chunks
    search_queries = {
        "notes": f"Key concepts, definitions, important points, summary notes for {subject_name}",
        "mcqs": f"Core facts, theories, concepts, definitions, quiz questions for {subject_name}",
        "flashcards": f"Term definition, questions and answers, concepts for flashcards in {subject_name}",
        "viva": f"Conceptual questions, viva oral examination questions, expected answers for {subject_name}",
        "revision": f"Important concepts, definitions, frequently repeated exam topics for {subject_name}"
    }
    query = search_queries.get(action_type, f"Overview notes and questions for {subject_name}")
    
    # 3. Retrieve chunks from FAISS
    chunks = []
    try:
        # Retrieve top 15 chunks to ensure adequate material for notes, MCQs (20), flashcards (20), etc.
        retrieval_res = search_knowledge(subject_name, query, top_k=15)
        if "error" in retrieval_res:
            raise Exception(retrieval_res["error"])
        chunks = retrieval_res.get("results", [])
    except Exception as e:
        err_msg = f"Failed to retrieve chunks for subject '{subject_name}': {str(e)}"
        print(f"[ERROR] {err_msg}")
        return {
            "error": "No documents uploaded or indexed for this subject. Please upload and index documents first.",
            "logs": logs
        }
        
    # Find list of unique documents used
    filenames = list(set([c.get("filename") for c in chunks if c.get("filename")]))
    doc_count = len(filenames)

    # 4. Log retrieved chunks
    log_chunks = f"[RAG] Retrieved Chunks: {len(chunks)}"
    logs.append(log_chunks)
    print(log_chunks)

    if action_type == "notes":
        log_docs = f"[RAG] Documents Used: {doc_count}"
        logs.append(log_docs)
        print(log_docs)
    
    context_text = "\n\n".join([c.get("text", "") for c in chunks])
    context_len = len(context_text)
    
    # 5. Log context length
    log_len = f"[RAG] Context Length: {context_len}"
    logs.append(log_len)
    print(log_len)

    # Perform context validation (retrieved chunks, context length, information density)
    words = context_text.split()
    num_words = len(words)
    unique_words = len(set(w.lower() for w in words if w.isalnum()))

    # Insufficient if chunks == 0, context_len < 500, total words < 100, or unique words < 50
    if len(chunks) > 0 and context_len >= 500 and num_words >= 100 and unique_words >= 50:
        log_passed = "[RAG] Context Validation Passed"
        logs.append(log_passed)
        print(log_passed)
    else:
        log_failed = "[RAG] Context Validation Failed"
        logs.append(log_failed)
        print(log_failed)
        log_abort = "[RAG] Generation Aborted"
        logs.append(log_abort)
        print(log_abort)
        return {
            "subject": subject_name,
            "action": action_type,
            "result": "Not enough relevant information found in uploaded documents.",
            "logs": logs,
            "chunks_count": len(chunks),
            "doc_count": doc_count
        }
    
    # 6. Prompt formulation based on action type
    prompts = {
        "notes": f"""You are an expert MBA study assistant.
Generate structured, comprehensive study notes based STRICTLY on the retrieved context below.

OUTPUT FORMAT:
The output must use this exact layout with Markdown headings:

# Subject Notes

## Key Concepts
[Detailed bullet points explaining key concepts found in the context]

## Definitions
[Key terms and their exact definitions from the context]

## Important Topics
[Important topics mentioned in the context]

## Important Points
[Bullet points highlighting crucial exam-focused details]

## Exam Focus Areas
[Special focus areas for the exams based on the context]

## Quick Summary
[A concise summary paragraph synthesizing the retrieved material]

INSTRUCTION:
Answer ONLY using the provided context. Do not generate from pre-trained model memory.

CONTEXT:
{context_text}
""",

        "mcqs": f"""You are an expert MBA exam creator.
Generate exactly 20 Multiple Choice Questions (MCQs) based STRICTLY on the retrieved context below.
Each question must have exactly 4 options (A, B, C, D), a correct answer, and a clear explanation based on the context.

OUTPUT FORMAT:
For each question, follow this exact structure:

### Question [Number]: [Question Text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]

**Correct Answer:** [A/B/C/D]

**Explanation:** [Explanation explaining why it's correct based on the context]

---

INSTRUCTION:
Answer ONLY using the provided context. Do not generate from pre-trained model memory.

CONTEXT:
{context_text}
""",

        "flashcards": f"""You are an expert MBA study assistant.
Generate at least 20 flashcards based STRICTLY on the retrieved context below.
Each flashcard consists of a Question and a corresponding Answer.

OUTPUT FORMAT:
For each flashcard, use this exact structure:

### Flashcard [Number]
**Question:** [Question text]

**Answer:** [Detailed and concise answer text]

---

INSTRUCTION:
Answer ONLY using the provided context. Do not generate from pre-trained model memory.

CONTEXT:
{context_text}
""",

        "viva": f"""You are an expert MBA examiner.
Generate at least 15 Viva (oral exam) questions and their expected answers based STRICTLY on the retrieved context below.
These questions should test conceptual understanding and application of the material.

OUTPUT FORMAT:
For each viva question, use this exact structure:

### Viva Question [Number]: [Question text]
**Expected Answer:** [Expected answer explaining key concepts]

---

INSTRUCTION:
Answer ONLY using the provided context. Do not generate from pre-trained model memory.

CONTEXT:
{context_text}
""",

        "revision": f"""You are an expert MBA study assistant.
Generate a structured Exam Revision Sheet based STRICTLY on the retrieved context below.

OUTPUT FORMAT:
The output must use this exact layout with Markdown headings:

# Exam Revision Sheet

## Most Important Concepts
[Bullet points listing and explaining the most important concepts]

## Most Important Definitions
[Important terms and their definitions]

## Frequently Repeated Topics
[List of topics that appear repeatedly or are highly important for exams]

## Exam Quick Revision Notes
[Quick bulleted notes for last-minute exam prep]

## One Page Summary
[A structured summary that fits the overall context into a single concise overview]

INSTRUCTION:
Answer ONLY using the provided context. Do not generate from pre-trained model memory.

CONTEXT:
{context_text}
"""
    }
    
    prompt = prompts.get(action_type, prompts["notes"])
    
    # 7. Generate response using LLM
    try:
        response_text = ask_llm_no_memory(prompt)
    except Exception as e:
        err_msg = f"LLM generation failed: {str(e)}"
        print(f"[ERROR] {err_msg}")
        return {
            "error": "Failed to generate study materials via the LLM provider.",
            "logs": logs
        }
        
    if action_type == "notes":
        log = "[NOTES] Generation Complete"
        logs.append(log)
        print(log)

    return {
        "subject": subject_name,
        "action": action_type,
        "result": response_text.strip(),
        "logs": logs,
        "chunks_count": len(chunks),
        "doc_count": doc_count
    }
