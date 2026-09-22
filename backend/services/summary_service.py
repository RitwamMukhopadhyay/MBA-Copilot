import fitz
from pathlib import Path
from llm import ask_llm_no_memory

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"



def get_subject_pdfs(subject_name):

    subject_folder = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
    )

    pdf_folder = (
        subject_folder / "PDFs"
    )

    if not pdf_folder.exists():

        return []

    pdfs = [
        f.name
        for f in pdf_folder.iterdir()
        if (
            f.is_file()
            and f.suffix.lower() == ".pdf"
        )
    ]

    pdfs.sort()

    # Enrich with classification data
    try:
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT filename, category FROM pdf_metadata WHERE subject_name = ?",
            (subject_name,)
        )
        categories = {row["filename"]: row["category"] for row in cursor.fetchall()}
        conn.close()
    except Exception:
        categories = {}

    return [
        {
            "name": pdf_name,
            "category": categories.get(pdf_name, "academic")
        }
        for pdf_name in pdfs
    ]


def extract_pdf_text(
    subject_name,
    pdf_name
):

    pdf_path = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
        / "PDFs"
        / pdf_name
    )
    if not pdf_path.exists():
        # Fallback check
        pdf_path_fallback = (
            UPLOADS_ROOT
            / subject_name.replace(" ", "_")
            / pdf_name
        )
        if pdf_path_fallback.exists():
            pdf_path = pdf_path_fallback

    if not pdf_path.exists():

        raise FileNotFoundError(
            f"{pdf_name} not found"
        )

    document = fitz.open(
        pdf_path
    )

    text = ""

    for page in document:

        text += (
            page.get_text()
            + "\n"
        )

    document.close()

    return text


def generate_summary(
    subject_name,
    pdf_name
):

    pdf_text = extract_pdf_text(
        subject_name,
        pdf_name
    )

    pdf_text = pdf_text[:20000]

    prompt = f"""
You are an MBA study assistant.

Create concise MBA revision notes
using this structure.

# Topic Overview

Short overview.

# Key Concepts

Bullet points.

# Managerial Implications

Managerial applications.

# Important Points

Exam focused points.

# Exam Revision Questions

5 likely exam questions.

# 5 Minute Revision

Very short revision section.

PDF CONTENT:

{pdf_text}
"""

    summary_text = ask_llm_no_memory(prompt)

    save_summary(
        subject_name,
        pdf_name,
        summary_text,
    )

    return {
        "message": "Summary generated",
        "summary_file": (
            f"summary_{Path(pdf_name).stem}.md"
        ),
    }


def save_summary(
    subject_name,
    pdf_name,
    summary_text,
):

    summaries_folder = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
        / "Summaries"
    )

    summaries_folder.mkdir(
        parents=True,
        exist_ok=True,
    )

    summary_file = (
        summaries_folder
        / f"summary_{Path(pdf_name).stem}.md"
    )

    with open(
        summary_file,
        "w",
        encoding="utf-8",
    ) as file:

        file.write(
            summary_text
        )