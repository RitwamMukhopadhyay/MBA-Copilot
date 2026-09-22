import sqlite3
from pathlib import Path

KNOWLEDGE_DB_PATH = Path(__file__).resolve().parent.parent.parent / "database" / "knowledge.db"

def get_knowledge_connection():
    """
    Returns a sqlite3 connection to knowledge.db.
    Ensures parent directories exist.
    """
    KNOWLEDGE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(KNOWLEDGE_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
