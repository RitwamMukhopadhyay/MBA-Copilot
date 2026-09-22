"""
Centralized database configuration for the entire MBA Copilot application.
This ensures both backend and agentic tools use the same database file.
"""

import sqlite3
import logging
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Resolve database path using __file__ for absolute, CWD-independent resolution
PROJECT_ROOT = Path(__file__).parent
DB_PATH = PROJECT_ROOT / "database" / "mba_copilot_v2.db"

logger.debug(f"[DB CONFIG] PROJECT_ROOT: {PROJECT_ROOT}")
logger.debug(f"[DB CONFIG] DB_PATH (absolute): {DB_PATH}")
logger.debug(f"[DB CONFIG] DB exists: {DB_PATH.exists()}")


def get_connection():
    """
    Get a database connection using the centralized database path.
    
    Returns:
        sqlite3.Connection: Database connection with row factory set
        
    Raises:
        sqlite3.DatabaseError: If database connection fails
    """
    try:
        logger.debug(f"[DB CONFIG] Connecting to: {DB_PATH}")
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        logger.debug(f"[DB CONFIG] Connection successful")
        return conn
    except sqlite3.DatabaseError as e:
        logger.error(f"[DB CONFIG] Database connection failed: {str(e)}")
        raise


def get_db_path():
    """
    Get the absolute database path.
    
    Returns:
        Path: Absolute path to the database file
    """
    return DB_PATH
