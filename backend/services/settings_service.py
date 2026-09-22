import os
import json
import httpx
import sqlite3
from pathlib import Path

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "../settings.json")

# Centralized database path resolution
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "mba_copilot_v2.db"

DEFAULT_PROVIDERS = {
    "Ollama Local": {
        "api_key": "",
        "base_url": "http://localhost:11434",
        "org_id": "",
        "models": ["gemma3:4b", "qwen3:8b", "llama3.1:8b", "mistral:7b"]
    },
    "OpenAI": {
        "api_key": "",
        "base_url": "https://api.openai.com/v1",
        "org_id": "",
        "models": ["gpt-4o", "gpt-4o-mini", "o1-mini"]
    },
    "Gemini": {
        "api_key": "",
        "base_url": "",
        "org_id": "",
        "models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-2.5-pro"]
    },
    "Claude": {
        "api_key": "",
        "base_url": "https://api.anthropic.com",
        "org_id": "",
        "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-5-haiku-20241022"]
    },
    "OpenRouter": {
        "api_key": "",
        "base_url": "https://openrouter.ai/api/v1",
        "org_id": "",
        "models": ["google/gemini-2.5-pro", "meta-llama/llama-3.1-8b-instruct"]
    },
    "Groq": {
        "api_key": "",
        "base_url": "https://api.groq.com/openai/v1",
        "org_id": "",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
    },
    "Together AI": {
        "api_key": "",
        "base_url": "https://api.together.xyz/v1",
        "org_id": "",
        "models": ["meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"]
    },
    "Ollama Cloud": {
        "api_key": "",
        "base_url": "",
        "org_id": "",
        "models": ["gemma4:31b-cloud", "qwen3:32b-cloud"]
    },
    "Custom OpenAI-Compatible API": {
        "api_key": "",
        "base_url": "",
        "org_id": "",
        "models": []
    }
}

def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:4]}••••{key[-4:]}"

def is_masked(val: str) -> bool:
    return val is not None and ("••••" in val or val == "••••••••")

def init_settings_db():
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS settings
            (
                key TEXT PRIMARY KEY,
                value TEXT
            )
            """
        )
        conn.commit()
        
        # Check if settings table is empty
        cursor.execute("SELECT COUNT(*) FROM settings")
        count = cursor.fetchone()[0]
        if count == 0:
            # Seed from settings.json if it exists
            if os.path.exists(SETTINGS_FILE):
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for k, v in data.items():
                    cursor.execute(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                        (k, json.dumps(v))
                    )
                conn.commit()
                print("[SETTINGS] Seeded database settings from settings.json")
        conn.close()
    except Exception as e:
        print(f"[SETTINGS] Database initialization error: {e}")

def load_settings(mask_keys=False):
    init_settings_db()
    defaults = {
        "active_provider": "Groq",
        "active_model": "llama-3.3-70b-versatile",
        "theme": "Dark",
        "fontSize": "Medium",
        "memoryEnabled": True,
        "webSearchEnabled": True,
        "lanEnabled": False,
        "providers": DEFAULT_PROVIDERS,
        "api_keys": {
            "Ollama Cloud": "",
            "Gemini API": "",
            "OpenAI API": "",
            "Claude API": "",
            "OpenRouter": "",
            "Groq API": ""
        }
    }
    res = {}
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        conn.close()
        
        for row in rows:
            res[row[0]] = json.loads(row[1])
    except Exception as e:
        print(f"[SETTINGS] Error loading settings from database: {e}")
        
    # If DB read returned empty or failed, fallback to defaults/settings.json
    if not res:
        res = defaults
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    res.update(data)
            except Exception as e:
                print(f"[SETTINGS] Error loading fallback settings: {e}")
                
    # Ensure all default keys exist
    for key, val in defaults.items():
        if key not in res:
            res[key] = val
            
    # Migrate or set providers
    if "providers" not in res or not isinstance(res["providers"], dict):
        res["providers"] = json.loads(json.dumps(DEFAULT_PROVIDERS))
    else:
        for p, info in DEFAULT_PROVIDERS.items():
            if p not in res["providers"]:
                res["providers"][p] = json.loads(json.dumps(info))
            else:
                for field, fval in info.items():
                    if field not in res["providers"][p]:
                        res["providers"][p][field] = fval
                        
    # Legacy compatibility migration:
    api_keys = res.get("api_keys", {})
    if api_keys:
        mapping = {
            "OpenAI API": "OpenAI",
            "Gemini API": "Gemini",
            "Claude API": "Claude",
            "OpenRouter": "OpenRouter",
            "Ollama Cloud": "Ollama Cloud",
            "Groq API": "Groq"
        }
        for leg_key, new_prov in mapping.items():
            if leg_key in api_keys and api_keys[leg_key]:
                if not res["providers"][new_prov].get("api_key"):
                    res["providers"][new_prov]["api_key"] = api_keys[leg_key]
                    
    # Sync back from providers to api_keys
    for prov, info in res["providers"].items():
        leg_key = prov
        if prov == "OpenAI":
            leg_key = "OpenAI API"
        elif prov == "Gemini":
            leg_key = "Gemini API"
        elif prov == "Claude":
            leg_key = "Claude API"
        elif prov == "Groq":
            leg_key = "Groq API"
        res["api_keys"][leg_key] = info.get("api_key", "")
        
    if mask_keys:
        import copy
        res = copy.deepcopy(res)
        if "api_keys" in res and isinstance(res["api_keys"], dict):
            for k, v in res["api_keys"].items():
                if v:
                    res["api_keys"][k] = mask_key(v)
        if "providers" in res and isinstance(res["providers"], dict):
            for p, info in res["providers"].items():
                if isinstance(info, dict) and "api_key" in info and info["api_key"]:
                    info["api_key"] = mask_key(info["api_key"])
                    
    return res

def save_settings(settings):
    init_settings_db()
    try:
        # Load existing first to merge correctly
        existing = load_settings(mask_keys=False)

        # Merge input settings into existing
        for k, v in settings.items():
            if k == "api_keys" and isinstance(v, dict):
                if "api_keys" not in existing:
                    existing["api_keys"] = {}
                for key_name, key_val in v.items():
                    if is_masked(key_val):
                        existing["api_keys"][key_name] = existing.get("api_keys", {}).get(key_name, "")
                    else:
                        existing["api_keys"][key_name] = key_val
            elif k == "providers" and isinstance(v, dict):
                if "providers" not in existing:
                    existing["providers"] = {}
                for prov_name, prov_info in v.items():
                    if prov_name not in existing["providers"]:
                        existing["providers"][prov_name] = prov_info
                    else:
                        for field, field_val in prov_info.items():
                            if field == "api_key" and is_masked(field_val):
                                continue
                            existing["providers"][prov_name][field] = field_val
            else:
                existing[k] = v

        # If the input contains providers, then providers is the source of truth for keys
        if "providers" in settings:
            if "api_keys" not in existing:
                existing["api_keys"] = {}
            for prov, info in existing["providers"].items():
                leg_key = prov
                if prov == "OpenAI":
                    leg_key = "OpenAI API"
                elif prov == "Gemini":
                    leg_key = "Gemini API"
                elif prov == "Claude":
                    leg_key = "Claude API"
                elif prov == "Groq":
                    leg_key = "Groq API"
                existing["api_keys"][leg_key] = info.get("api_key", "")
        # If the input contains api_keys but NOT providers, then api_keys is the source of truth
        elif "api_keys" in settings:
            if "providers" not in existing:
                existing["providers"] = {}
            mapping = {
                "OpenAI API": "OpenAI",
                "Gemini API": "Gemini",
                "Claude API": "Claude",
                "OpenRouter": "OpenRouter",
                "Ollama Cloud": "Ollama Cloud",
                "Groq API": "Groq"
            }
            for leg_key, prov in mapping.items():
                val = existing["api_keys"].get(leg_key, "")
                if val and prov in existing["providers"]:
                    existing["providers"][prov]["api_key"] = val

        # Save to database settings table
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        for k, v in existing.items():
            cursor.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (k, json.dumps(v))
            )
        conn.commit()
        conn.close()

        # Write to settings.json to keep it in sync for legacy code/embeddings
        try:
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=4)
        except Exception as json_err:
            print(f"[SETTINGS] Warn: Failed to write sync settings.json: {json_err}")

        # Log setting change for webSearchEnabled using log_event helper
        if "webSearchEnabled" in settings:
            enabled = bool(settings["webSearchEnabled"])
            log_event("[SETTINGS] Web Search Enabled" if enabled else "[SETTINGS] Web Search Disabled")

        return {"success": True, "message": "Settings saved successfully"}
    except Exception as e:
        print(f"[SETTINGS] Error saving settings: {e}")
        return {"success": False, "message": str(e)}


def get_current_model_info():
    # Target values
    chat_model = "llama-3.3-70b-versatile"
    embedding_provider = "OpenAI"
    
    # 1. Chat Status (Groq API check based on key configuration status)
    chat_status = "Disconnected"
    try:
        settings = load_settings(mask_keys=False)
        groq_key = settings.get("api_keys", {}).get("Groq API", "") or settings.get("providers", {}).get("Groq", {}).get("api_key", "")
        if groq_key and len(groq_key.strip()) > 0:
            chat_status = "Connected"
    except Exception:
        chat_status = "Disconnected"

    # 2. Embedding Status (OpenAI API key check)
    try:
        from knowledge.embeddings import get_openai_api_key
        openai_key = get_openai_api_key()
    except Exception:
        openai_key = ""
    embedding_status = "Connected" if (openai_key and len(openai_key) > 0) else "Disconnected"

    # 3. Knowledge Hub Status (FAISS index path check)
    try:
        from knowledge.faiss_store import DATABASE_ROOT
        faiss_path_ok = DATABASE_ROOT.exists()
    except Exception:
        faiss_path_ok = False
    knowledge_hub_status = "Ready" if faiss_path_ok else "Error"

    return {
        # New fields for settings page
        "chat_model": chat_model,
        "chat_status": chat_status,
        "embedding_provider": embedding_provider,
        "embedding_status": embedding_status,
        "knowledge_hub_status": knowledge_hub_status,
        # Legacy fields for backward compatibility in Sidebar and PdfChat pages
        "provider": "Ollama Local",
        "model": chat_model,
        "status": chat_status,
        "mode": "Local"
    }



def call_llm_api(messages, provider=None, model=None, api_keys=None):
    import sys
    from pathlib import Path
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
        
    from llm_router import route_llm_request
    return route_llm_request(messages, provider, model, api_keys)

def log_event(prefix: str, suffix: str = ""):
    from datetime import datetime
    log_file = os.path.join(os.path.dirname(__file__), "../ai_center.log")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"{timestamp} {prefix}{' ' + suffix if suffix else ''}"
    print(f"{prefix}{' ' + suffix if suffix else ''}")
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception as e:
        print(f"[LOGGING ERROR] Failed to write log: {e}")
