"""
PDF Document Classifier
-----------------------
Classifies uploaded PDFs as "academic" or "administrative" using
keyword scoring on filename + extracted text content.

No LLM call — fast, deterministic, and works fully offline.
"""

from pathlib import Path

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"


# ---------------------------------------------------------------------------
# Keyword Sets
# ---------------------------------------------------------------------------

ADMIN_KEYWORDS = [
    # Fee / Payment
    "hostel", "hostel fee", "mess fee", "mess charges", "hostel charges",
    "fee payment", "fee receipt", "fee notice", "fee structure",
    "tuition fee", "late fee", "challan", "payment receipt", "refund",
    "scholarship", "stipend", "financial aid",
    # Admission / Registration
    "admission letter", "offer letter", "admission notice",
    "enrollment form", "registration form", "merit list", "rank list",
    "waiting list", "allotment letter",
    # Administrative Notices
    "circular", "notice", "announcement", "bulletin", "communique",
    "office order", "administrative", "administration office",
    # Identity / Compliance Docs
    "bonafide certificate", "no dues", "library fine", "library clearance",
    "identity card", "id card", "anti-ragging", "undertaking",
    "declaration form", "affidavit", "indemnity bond",
    # Miscellaneous Admin
    "proctor", "warden", "registrar", "dean of students",
    "examination form", "hall ticket application",
    "transport", "bus pass", "canteen",
]

ACADEMIC_KEYWORDS = [
    # Content Types
    "lecture notes", "lecture", "chapter", "unit", "module",
    "syllabus", "course outline", "curriculum",
    "notes", "study material", "study guide", "reading material",
    "textbook", "reference book", "reference material",
    "question bank", "practice questions", "sample paper",
    "model answer", "answer key",
    # Activity Types
    "case study", "case analysis", "tutorial",
    "lab manual", "practical", "experiment",
    "assignment brief", "project brief",
    "revision", "exam prep", "exam preparation",
    # Academic Structure Keywords
    "learning objectives", "learning outcomes",
    "topic", "subtopic", "concept", "theory",
    "introduction to", "overview of",
    "framework", "methodology", "analysis",
]

# ---------------------------------------------------------------------------
# Scoring Logic
# ---------------------------------------------------------------------------

def _score_text(text: str, keywords: list) -> int:
    """Count how many keywords from the list appear in the lowercased text."""
    text_lower = text.lower()
    score = 0
    for kw in keywords:
        if kw in text_lower:
            score += 1
    return score


def _extract_preview_text(pdf_path: Path, max_chars: int = 2000) -> str:
    """Extract the first max_chars characters of text from a PDF file.
    Falls back to empty string on any error."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
            if len(text) >= max_chars:
                break
        doc.close()
        return text[:max_chars]
    except Exception:
        return ""


def classify_pdf(subject_name: str, filename: str) -> str:
    """
    Classify a PDF as 'academic' or 'administrative'.

    Parameters
    ----------
    subject_name : str
        Name of the subject the PDF belongs to.
    filename : str
        The stored filename (may include timestamp prefix).

    Returns
    -------
    str
        Either 'academic' or 'administrative'.
    """
    pdf_path = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
        / "PDFs"
        / filename
    )
    if not pdf_path.exists():
        pdf_path_fallback = (
            UPLOADS_ROOT
            / subject_name.replace(" ", "_")
            / filename
        )
        if pdf_path_fallback.exists():
            pdf_path = pdf_path_fallback

    # --- Score filename alone first (fast path) ---
    admin_filename_score = _score_text(filename, ADMIN_KEYWORDS)
    academic_filename_score = _score_text(filename, ACADEMIC_KEYWORDS)

    # If filename is clearly admin (e.g. "hostel_fee_notice.pdf")
    if admin_filename_score > 0 and admin_filename_score >= academic_filename_score:
        # Still check text to avoid false positives, but weight filename heavily
        pass

    # --- Extract text for deeper scoring ---
    preview = _extract_preview_text(pdf_path)

    admin_text_score = _score_text(preview, ADMIN_KEYWORDS)
    academic_text_score = _score_text(preview, ACADEMIC_KEYWORDS)

    # Combine: filename score weighted 2x (since filename is intentional)
    total_admin = (admin_filename_score * 2) + admin_text_score
    total_academic = (academic_filename_score * 2) + academic_text_score

    # Decision
    if total_admin > total_academic and total_admin > 0:
        return "administrative"

    return "academic"


def save_pdf_classification(subject_name: str, filename: str, category: str):
    """Persist classification result to the pdf_metadata table."""
    from database import get_connection
    from datetime import datetime

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO pdf_metadata (subject_name, filename, category, classified_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(subject_name, filename) DO UPDATE SET
            category = excluded.category,
            classified_at = excluded.classified_at
        """,
        (subject_name, filename, category, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()


def get_pdf_category(subject_name: str, filename: str) -> str:
    """Retrieve the stored classification for a PDF. Defaults to 'academic'."""
    try:
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT category FROM pdf_metadata WHERE subject_name = ? AND filename = ?",
            (subject_name, filename)
        )
        row = cursor.fetchone()
        conn.close()
        return row["category"] if row else "academic"
    except Exception:
        return "academic"


def get_academic_pdfs_for_subject(subject_name: str) -> list:
    """Return list of filenames classified as academic for a given subject."""
    try:
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT filename FROM pdf_metadata WHERE subject_name = ? AND category = 'academic'",
            (subject_name,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [row["filename"] for row in rows]
    except Exception:
        return []
