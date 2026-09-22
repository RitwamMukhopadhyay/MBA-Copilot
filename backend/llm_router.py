import os
import json
from pathlib import Path
from openai import OpenAI

# Database settings access
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "database" / "mba_copilot_v2.db"

def get_groq_api_key():
    """
    Load the Groq API key dynamically:
    1. Environment variables GROQ_API_KEY or groq_api_key
    2. Root or backend .env file
    3. Settings database & settings.json fallback
    """
    # 1. Direct environment variable check
    env_key = os.environ.get("GROQ_API_KEY") or os.environ.get("groq_api_key")
    if env_key and len(env_key.strip()) > 0:
        return env_key.strip()

    # 2. Check root workspace .env file
    root_env = PROJECT_ROOT / ".env"
    if root_env.exists():
        try:
            with open(root_env, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k_norm = k.strip().lower().replace("_", "").replace(" ", "")
                        if k_norm == "groqapikey":
                            return v.strip()
        except Exception:
            pass

    # 3. Check backend .env file
    backend_env = PROJECT_ROOT / "backend" / ".env"
    if backend_env.exists():
        try:
            with open(backend_env, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k_norm = k.strip().lower().replace("_", "").replace(" ", "")
                        if k_norm == "groqapikey":
                            return v.strip()
        except Exception:
            pass

    # 4. Settings database fetch
    try:
        from services.settings_service import load_settings
        settings = load_settings(mask_keys=False)
        key = settings.get("api_keys", {}).get("Groq API", "") or settings.get("providers", {}).get("Groq", {}).get("api_key", "")
        if key and len(key.strip()) > 0:
            return key.strip()
    except Exception as e:
        print(f"[ROUTER] Error loading Groq API Key from database: {e}")
        
    # 5. Fallback to local settings.json if database fetch fails
    SETTINGS_FILE = PROJECT_ROOT / "backend" / "settings.json"
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                key = data.get("api_keys", {}).get("Groq API", "") or data.get("providers", {}).get("Groq", {}).get("api_key", "")
                if key:
                    return key.strip()
        except Exception:
            pass
            
    return ""

def route_llm_request(messages, provider=None, model=None, api_keys=None):
    """
    Unified AI router migrating chat/agent calls to cloud-hosted Groq API.
    """
    groq_api_key = get_groq_api_key()
    
    # Standardize on llama-3.3-70b-versatile as the main high-performance chat model
    model_id = model or "llama-3.3-70b-versatile"
    
    print("[CHAT] Request Started")
    print(f"[CHAT] Sending to Groq API ({model_id})")
    
    if not groq_api_key:
        print("[CHAT] Warning: Groq API Key is not configured in settings!")
        raise ValueError("Groq API Key is missing. Please configure it in Settings.")
        
    try:
        # Initialize Groq client using standard OpenAI wrapper pointing to Groq's endpoint
        client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=groq_api_key
        )
        
        response = client.chat.completions.create(
            model=model_id,
            messages=messages
        )
        response_content = response.choices[0].message.content
        
        print("[CHAT] Response Received")
        print("[CHAT] Response Returned")
        return response_content
        
    except Exception as e:
        print(f"[CHAT] Error calling Groq API: {e}")
        raise e
