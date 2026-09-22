from pathlib import Path
from fastapi import HTTPException
import os

# Absolute path to uploads root, resolved from this file's location.
# This ensures correct resolution regardless of the working directory
# the backend is started from.
UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"


def create_subject_workspace(
    subject_name
):

    subject_folder = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
    )

    (subject_folder / "Notes").mkdir(
        parents=True,
        exist_ok=True
    )

    (subject_folder / "PDFs").mkdir(
        exist_ok=True
    )

    (subject_folder / "Summaries").mkdir(
        exist_ok=True
    )


def get_subject_stats(
    subject_name
):

    subject_folder = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
    )

    notes_folder = (
        subject_folder / "Notes"
    )

    pdfs_folder = (
        subject_folder / "PDFs"
    )

    summaries_folder = (
        subject_folder / "Summaries"
    )

    notes_count = 0
    pdf_count = 0
    summary_count = 0

    if notes_folder.exists():

        notes_count = len(
            [
                f
                for f in notes_folder.iterdir()
                if f.is_file()
            ]
        )

    if pdfs_folder.exists():

        pdf_count = len(
            [
                f
                for f in pdfs_folder.iterdir()
                if f.is_file()
            ]
        )

    if summaries_folder.exists():

        summary_count = len(
            [
                f
                for f in summaries_folder.iterdir()
                if f.is_file()
            ]
        )

    return {
        "notes": notes_count,
        "pdfs": pdf_count,
        "summaries": summary_count,
    }


def open_subject_folder(
    subject_name
):

    subject_folder = (
        UPLOADS_ROOT
        / subject_name.replace(" ", "_")
    )

    # Ensure the subject folder and its subfolders exist
    subject_folder.mkdir(parents=True, exist_ok=True)
    (subject_folder / "Notes").mkdir(parents=True, exist_ok=True)
    (subject_folder / "PDFs").mkdir(parents=True, exist_ok=True)
    (subject_folder / "Summaries").mkdir(parents=True, exist_ok=True)

    try:
        os.startfile(
            subject_folder.resolve()
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to open folder: {str(e)}"
        )

    return {
        "message": "Folder opened"
    }


def upload_subject_file(
    subject_name: str,
    original_filename: str,
    content: bytes,
):
    """
    Saves an uploaded file to the subject's workspace using a UUID-based
    storage filename to prevent path traversal attacks.

    Args:
        subject_name:      The subject that owns this file.
        original_filename: The raw filename provided by the user (used for DB
                           display only — never used as a disk path).
        content:           The pre-read raw bytes of the uploaded file.

    Returns a dict with:
        - filename:          The UUID-based disk filename (e.g. "<uuid>.pdf").
        - original_filename: The sanitised display name supplied by the user.
        - document_id:       Same as `filename` (UUID string) for clarity.
        - category:          PDF classification result.
    """
    import uuid as _uuid

    subject_folder = UPLOADS_ROOT / subject_name.replace(" ", "_")

    if not subject_folder.exists():
        raise HTTPException(status_code=404, detail="Subject folder not found")

    # Derive extension from the original filename (display use only).
    extension = Path(original_filename).suffix.lower()

    # ── Security: generate a deterministic UUID storage name ──────────────────
    # The user-supplied filename is NEVER used as part of the disk path so path
    # traversal attacks (e.g. "../../evil.pdf") are structurally impossible.
    document_id = str(_uuid.uuid4())
    stored_filename = f"{document_id}{extension if extension in ('.pdf', '.txt', '.md') else ''}"

    if extension == ".pdf":
        destination_folder = subject_folder / "PDFs"
    else:
        destination_folder = subject_folder / "Notes"

    destination_file = destination_folder / stored_filename

    # Write the pre-assembled content buffer to disk.
    with open(destination_file, "wb") as fh:
        fh.write(content)

    # ── Classify the uploaded PDF (academic vs administrative) ─────────────────
    category = "academic"
    if extension == ".pdf":
        try:
            from pdf_classifier import classify_pdf, save_pdf_classification
            category = classify_pdf(subject_name, stored_filename)
            save_pdf_classification(subject_name, stored_filename, category)
            print(f"[CLASSIFIER] {stored_filename} ({original_filename}) → {category}")
        except Exception as clf_err:
            # Classification failure must never break the upload.
            print(f"[CLASSIFIER] Warning: classification failed for {stored_filename}: {clf_err}")

        try:
            from knowledge.document_service import register_document
            # Store with the UUID filename so the DB filepath is valid on disk,
            # but we keep original_filename as the human-readable display name.
            register_document(
                subject_name,
                stored_filename,
                str(destination_file.resolve()),
            )
        except Exception as reg_err:
            print(f"[KNOWLEDGE REGISTRATION] Warning: registration failed for {stored_filename}: {reg_err}")

    return {
        "message": "File uploaded",
        "filename": stored_filename,          # UUID-based disk name
        "original_filename": original_filename,
        "document_id": document_id,
        "category": category,
    }