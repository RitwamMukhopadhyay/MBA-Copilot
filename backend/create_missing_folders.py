from pathlib import Path
from database import get_connection

conn = get_connection()
cursor = conn.cursor()

cursor.execute("SELECT name FROM subjects")

subjects = cursor.fetchall()

for subject in subjects:

    subject_name = subject["name"]

    UPLOADS_ROOT = Path(__file__).resolve().parent.parent / "uploads"
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

    print(f"Created: {subject_name}")

conn.close()