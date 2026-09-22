import os
import httpx
from pathlib import Path
from services.settings_service import load_settings

def get_openai_api_key() -> str:
    """
    Robust API Key loader supporting:
    1. os.environ["OPENAI_API_KEY"] or os.environ["openai_api_key"]
    2. Normalize key names inside .env files (root and backend)
    3. Fallback to settings.json
    """
    # 1. Environment variables
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("openai_api_key")
    if key:
        return key.strip()

    # 2. Check root workspace .env
    root_env = Path(__file__).resolve().parent.parent.parent / ".env"
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
                        if k_norm == "openaiapikey":
                            return v.strip()
        except Exception as e:
            print(f"[OPENAI] Warning: failed to parse root .env: {e}")

    # 3. Check backend .env
    backend_env = Path(__file__).resolve().parent.parent / ".env"
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
                        if k_norm == "openaiapikey":
                            return v.strip()
        except Exception as e:
            print(f"[OPENAI] Warning: failed to parse backend .env: {e}")

    # 4. Settings.json fallback
    try:
        settings = load_settings()
        key = settings.get("api_keys", {}).get("OpenAI API", "")
        if key:
            return key.strip()
    except Exception:
        pass

    return ""

def get_openai_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Calls OpenAI embeddings API (https://api.openai.com/v1/embeddings)
    using text-embedding-3-small and a robustly loaded API Key.
    """
    if not texts:
        return []

    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError("OpenAI API Key is missing. Please configure it in .env or Settings.")

    print("[OPENAI] API key loaded")

    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "text-embedding-3-small",
        "input": texts
    }

    with httpx.Client() as client:
        res = client.post(url, json=payload, headers=headers, timeout=60.0)
        if res.status_code != 200:
            raise Exception(f"OpenAI Embeddings API returned error ({res.status_code}): {res.text}")
        
        print("[OPENAI] Embedding request successful")
        
        result = res.json()
        sorted_data = sorted(result["data"], key=lambda x: x["index"])
        embeddings = [item["embedding"] for item in sorted_data]
        return embeddings
