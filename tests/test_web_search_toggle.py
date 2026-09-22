import os
import sys
import json
import sqlite3
from pathlib import Path

# Setup paths - insert agentic first to avoid importing backend/agent.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agentic"))
sys.path.insert(1, os.path.join(os.path.dirname(__file__), "backend"))

from services.settings_service import save_settings, load_settings
from agent import run_agent

def run_tests():
    print("==================================================")
    print("RUNNING WEB SEARCH TOGGLE TESTS")
    print("==================================================")
    
    # 1. Test save/load setting to database
    print("\n--- TEST 1: Database Persistence ---")
    
    # Save setting as OFF
    print("Saving webSearchEnabled = False...")
    res = save_settings({"webSearchEnabled": False})
    assert res["success"] is True, f"Failed to save settings: {res}"
    
    # Check settings loaded from service
    settings = load_settings()
    print(f"Loaded settings webSearchEnabled: {settings.get('webSearchEnabled')}")
    assert settings.get("webSearchEnabled") is False, "Settings did not persist False correctly"
    
    # Check directly from SQLite database table
    db_path = Path(__file__).resolve().parent / "database" / "mba_copilot_v2.db"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key='webSearchEnabled'")
    row = cursor.fetchone()
    conn.close()
    
    print(f"SQLite settings table raw value: {row}")
    assert row is not None, "webSearchEnabled key was not found in SQLite settings table"
    assert json.loads(row[0]) is False, "Database value was not False"
    
    # 2. Test Agent Behavior when OFF
    print("\n--- TEST 2: Agent Routing Gating (OFF) ---")
    query = "What is today's stock market news?"
    print(f"Query: '{query}'")
    
    # Capture print output or log file to verify
    response = run_agent(query)
    print(f"Agent Response: {response}")
    assert "disabled in Settings" in response or "web search is currently disabled" in response, \
        f"Agent did not notify that web search is disabled: {response}"
        
    # Check log file for blocked line
    log_file = Path(__file__).resolve().parent / "ai_center.log"
    log_content = ""
    if log_file.exists():
        with open(log_file, "r", encoding="utf-8") as lf:
            log_content = lf.read()
    
    print("Checking debug log for blocked line...")
    assert "[PLANNER] Web Search Blocked By Settings" in log_content, \
        "Expected '[PLANNER] Web Search Blocked By Settings' in log"
    
    # 3. Test save/load setting to database as ON
    print("\n--- TEST 3: Turning Setting ON ---")
    print("Saving webSearchEnabled = True...")
    res = save_settings({"webSearchEnabled": True})
    assert res["success"] is True
    
    settings = load_settings()
    print(f"Loaded settings webSearchEnabled: {settings.get('webSearchEnabled')}")
    assert settings.get("webSearchEnabled") is True, "Settings did not persist True correctly"
    
    # 4. Test Agent Behavior when ON
    print("\n--- TEST 4: Agent Routing Gating (ON) ---")
    print(f"Query: '{query}'")
    
    # Since Ollama might be running, let's run the agent and verify it logs Web Search Allowed
    response = run_agent(query)
    print(f"Agent Response: {response}")
    
    if log_file.exists():
        with open(log_file, "r", encoding="utf-8") as lf:
            log_content = lf.read()
            
    print("Checking debug log for allowed line...")
    assert "[PLANNER] Web Search Allowed" in log_content, \
        "Expected '[PLANNER] Web Search Allowed' in log"
        
    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
