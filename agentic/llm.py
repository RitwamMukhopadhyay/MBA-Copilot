import os
import json
import httpx
import ollama

from conversation_memory import (
    get_history,
    save_message
)

from tools.memory_tool import (
    get_memory
)

print(
    "\n\n*** LLM FILE CALLED ***\n\n"
)

# Professional formatting guidelines for the AI - Using Markdown for Frontend compatibility
SYSTEM_FORMATTING_PROMPT = (
    "You are a professional MBA Copilot. Your goal is to provide structured, "
    "extremely concise, and easy-to-scan responses. You MUST use Markdown for formatting.\n\n"
    "STRICT FORMATTING RULES:\n"
    "1. Use headings (e.g., ###, ####) when appropriate to partition information.\n"
    "2. Use Markdown tables for structured data (like list of subjects and credits, attendance records, stats comparisons).\n"
    "3. Use bullet points for lists of items and details.\n"
    "4. Use numbered steps for instructional processes or sequential directives.\n"
    "5. Keep responses concise and avoid walls of text. NEVER return large paragraphs.\n"
    "6. Bold key metrics or highlights (e.g., **82%**).\n"
    "7. Do not mention internal tools or technical functions.\n\n"
    "STRICT SCHEMATIC EXAMPLES:\n\n"
    "Subjects Example:\n"
    "| Subject | Credits |\n"
    "| ------- | ------- |\n"
    "| UHVE    | 3       |\n"
    "| POM     | 4       |\n\n"
    "Attendance Example:\n"
    "| Subject | Attendance |\n"
    "| ------- | ---------- |\n"
    "| UHVE    | 82%        |\n\n"
    "Insights Example:\n"
    "⚠ Below 75%"
)

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "../backend/settings.json")

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[LLM] Error loading settings: {e}")
    return {
        "active_provider": "Ollama Local",
        "active_model": "qwen3:8b",
        "api_keys": {}
    }

def call_llm_api(messages):
    import sys
    from pathlib import Path
    
    # Safely insert backend dir to sys.path so we can import llm_router
    backend_dir = Path(__file__).resolve().parent.parent / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
        
    from llm_router import route_llm_request
    return route_llm_request(messages)


def ask_llm(prompt):
    history = get_history()
    memory = get_memory()
    memory_text = ""
    if memory:
       for category, items in memory.items():
            for key, value in items.items():
                memory_text += f"- {value}\n"

    messages = []
    messages.append({"role": "system", "content": SYSTEM_FORMATTING_PROMPT})
    if memory_text:
        messages.append({"role": "system", "content": f"User Memory Context:\n{memory_text}"})

    for item in history:
        messages.append({"role": item["role"], "content": item["content"]})

    messages.append({"role": "user", "content": prompt})
    return call_llm_api(messages)

def ask_llm_no_memory(prompt):
    messages = [
        {"role": "system", "content": SYSTEM_FORMATTING_PROMPT},
        {"role": "user", "content": prompt}
    ]
    return call_llm_api(messages)