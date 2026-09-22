from planner import detect_tools
from math_parser import extract_expression
import json 
from tools.time_tool import get_time
from tools.calculator_tool import calculate
from tools.system_tool import get_system_info
from tools.web_search_tool import web_search
from tools.subject_tool import get_subjects
from tools.attendance_insights_tool import (get_attendance_insights)
from tools.event_tool import (
    get_upcoming_events,
    get_event_dict_by_title
)
from conversation_memory import (
    save_message
    )
from tools.event_create_tool import create_event
from tools.event_update_tool import update_event
from tools.event_delete_tool import delete_event

from event_parser import (
    parse_create_event,
    parse_update_event,
    parse_delete_event
)

from tools.attendance_tool import (
    get_attendance
)

from llm import ask_llm

from tools.memory_tool import (
    save_memory,
    get_memory,
    format_memory,
    search_memory,
    clear_memory
)

def format_recommendation_response(text: str) -> str:
    import re
    if "Recommended Focus" not in text:
        return text
        
    labels = ["Subject", "Reason", "Topics Remaining", "Attendance", "Assignment Status"]
    lines = text.split("\n")
    new_lines = []
    
    # Locate where "Recommended Focus" starts
    start_idx = 0
    for idx, line in enumerate(lines):
        if "Recommended Focus" in line:
            start_idx = idx
            break
            
    # Process lines before Recommended Focus normally
    for j in range(start_idx):
        new_lines.append(lines[j])
        
    new_lines.append("Recommended Focus:")
    new_lines.append("")
    
    # We will extract the values for each label using regex search on the whole text
    # to guarantee we find them regardless of the line layout, then build the clean block.
    extracted = {}
    for label in labels:
        # Match label: followed by value on same line or next lines
        pattern = rf"(?:^|\n)(?:\*\*)?{label}(?:\*\*)?:\s*([^\n]+)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            extracted[label] = match.group(1).strip().replace("**", "")
        else:
            # Try to search with newlines
            pattern_nl = rf"(?:^|\n)(?:\*\*)?{label}(?:\*\*)?:\s*\n\s*([^\n]+)"
            match_nl = re.search(pattern_nl, text, re.IGNORECASE)
            if match_nl:
                extracted[label] = match_nl.group(1).strip().replace("**", "")
            else:
                extracted[label] = "N/A"
                
    # Format the clean block
    for label in labels:
        val = extracted[label]
        # Clean up common markdown from LLM
        val = val.lstrip("-*• ").strip()
        new_lines.append(f"{label}:")
        new_lines.append(val)
        new_lines.append("") # Empty line between sections
        
    # Append the rest of the text (after the recommended focus section)
    # Find where the detailed section starts
    detailed_start_idx = len(lines)
    for idx in range(start_idx + 1, len(lines)):
        line = lines[idx]
        if ("Detailed Study" in line or "Recommended Study" in line or "###" in line or "1." in line) and not any(l in line for l in labels):
            detailed_start_idx = idx
            break
            
    if detailed_start_idx < len(lines):
        for j in range(detailed_start_idx, len(lines)):
            new_lines.append(lines[j])
            
    # Remove consecutive empty lines
    final_lines = []
    for line in new_lines:
        if line.strip() == "":
            if not final_lines or final_lines[-1].strip() != "":
                final_lines.append("")
        else:
            final_lines.append(line)
            
    return "\n".join(final_lines).strip()

def log_debug(msg):
    from datetime import datetime
    import os
    print(msg)
    log_file = os.path.join(os.path.dirname(__file__), "..", "ai_center.log")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    full_msg = f"{timestamp} {msg}"
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(full_msg + "\n")
    except Exception as e:
        print(f"[LOGGING ERROR] Failed to write agent log: {e}")

def read_web_search_setting():
    from pathlib import Path
    import sqlite3
    import json
    
    DB_PATH = Path(__file__).resolve().parent.parent / "database" / "mba_copilot_v2.db"
    web_search_enabled = True
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        # Ensure table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
        if cursor.fetchone():
            cursor.execute("SELECT value FROM settings WHERE key='webSearchEnabled'")
            row = cursor.fetchone()
            if row:
                web_search_enabled = bool(json.loads(row[0]))
        conn.close()
    except Exception as e:
        print(f"[SETTINGS] Could not read settings table from database, falling back: {e}")
        # Fallback to settings.json
        try:
            settings_json = Path(__file__).resolve().parent.parent / "backend" / "settings.json"
            if settings_json.exists():
                with open(settings_json, "r", encoding="utf-8") as sf:
                    s = json.load(sf)
                    web_search_enabled = bool(s.get("webSearchEnabled", True))
        except Exception:
            pass
            
    if web_search_enabled:
        log_debug("[SETTINGS] Web Search Enabled")
    else:
        log_debug("[SETTINGS] Web Search Disabled")
        
    return web_search_enabled

def run_agent(user_input, status_callback=None):

    save_message(
        "user",
        user_input
    )

    # ======================================
    # READ SETTINGS — Web Search Gate
    # ======================================
    web_search_enabled = read_web_search_setting()

    if status_callback:
        status_callback("thinking")

    # First, detect potential tools with web search enabled to see what planner wants
    potential_tools = detect_tools(user_input, web_search_enabled=True)

    if "web_search" in potential_tools:
        if not web_search_enabled:
            log_debug("[PLANNER] Web Search Blocked By Settings")
            response = "Web search is currently disabled in Settings. Enable it to allow me to search the internet for this information."
            save_message("assistant", response)
            return response
        else:
            log_debug("[PLANNER] Web Search Allowed")
            tools_needed = potential_tools
    else:
        # Enforce actual web_search_enabled status for routing general tools
        tools_needed = detect_tools(user_input, web_search_enabled=web_search_enabled)

    print(
        f"\n[AGENT] Tools Selected: {tools_needed}\n"
    )

    # ======================================
    # AGENT RECOMMENDATION BLOCK
    # ======================================
    if "agent_recommend" in tools_needed:
        print("\n=== AGENT RECOMMENDATION BLOCK ===\n")
        try:
            from datetime import datetime
            from agent_context_builder import build_agent_context
            context_data = build_agent_context()
            today_str = datetime.now().date().isoformat()
            
            prompt = f"""
You are a highly intelligent and proactive MBA Study Advisor.
Your role is to analyze the student's academic workload and provide study recommendations.

Today's Date: {today_str}

Aggregated Academic Context:
{context_data}

User Question:
{user_input}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT PRIORITY ORDER FOR RECOMMENDATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. UPCOMING EXAMS — Always the highest priority. Calculate exact days remaining.
2. PENDING ASSIGNMENTS — Due within 7 days, sorted by due date (soonest first).
3. ATTENDANCE RISK — Any subject below 75% attendance.
4. ACADEMIC STUDY MATERIALS — Subjects with uploaded lecture notes or academic PDFs but no recent study activity.
5. ACADEMIC CALENDAR EVENTS — Upcoming academic events (presentations, classes, tutorials).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES — READ CAREFULLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ONLY recommend subjects from the "CURRENT SUBJECTS & ATTENDANCE STATUS" list.
✅ ONLY use "AVAILABLE ACADEMIC STUDY MATERIALS" when recommending PDFs to study.
✅ The "Reason" field must be one of:
   - "Exam in X days"
   - "Assignment due in X days" / "Assignment due tomorrow" / "Assignment overdue"
   - "Attendance below 75% (currently X%)"
   - "Weakest attendance subject (X%)"
   - "No recent study activity"

❌ NEVER recommend hostel notices, fee receipts, admission letters, circulars, or any administrative document.
❌ NEVER use administrative deadlines as a "Reason" for study recommendations.
❌ NEVER mention documents from outside the "AVAILABLE ACADEMIC STUDY MATERIALS" section.
❌ If the context contains NO exams, NO due assignments, and NO attendance risks, do NOT invent urgency.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FALLBACK (when nothing is urgent):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If there are no upcoming exams, no assignments due within 7 days, and no attendance below 75%, FIRST write:
  "Everything is currently on track."
Then recommend the subject with the lowest attendance percentage OR the subject with the least study activity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Start your response with this exact structured block:

Recommended Focus:

Subject:
[Subject name from the registered subjects list]

Reason:
[One of the valid reason formats listed above — e.g., "Exam in 3 days" or "Attendance below 75% (currently 68%)"]

Topics Remaining:
[Number of chapters/topics for upcoming exam, or "N/A" only if there is truly no exam]

Attendance:
[The attendance percentage for the recommended subject, e.g., "82%" — do not write N/A if data exists]

Assignment Status:
[Title of the nearest upcoming assignment for this subject, or "No urgent assignments"]

After the structured block, provide 2-3 concise actionable study suggestions.
Do NOT repeat or expand the structured block in the rest of the response.
"""
            response = ask_llm(prompt)
            response = format_recommendation_response(response)
            save_message("assistant", response)
            return response
        except Exception as e:
            print(f"AGENT RECOMMENDATION ERROR: {e}")
            import traceback
            traceback.print_exc()
            return "I encountered an error gathering recommendations: " + str(e)

    tool_results = {}

    # ======================================
    # CREATE EVENT
    # ======================================

    if "create_event" in tools_needed:

        print("\n=== CREATE EVENT BLOCK ===\n")

        parsed = parse_create_event(
            user_input
        )

        print(parsed)

        result = create_event(
            title=parsed["title"],
            event_type=parsed["event_type"],
            event_date=parsed["event_date"],
            event_time=parsed["event_time"] or "",
            description=parsed["description"]
        )

        return str(result)

    # ======================================
    # UPDATE EVENT
    # ======================================

    if "update_event" in tools_needed:

        print("\n=== UPDATE EVENT BLOCK ===\n")

        parsed = parse_update_event(
            user_input
        )

        print(parsed)

        event = get_event_dict_by_title(
            parsed["title"]
        )

        if not event:

            return "Event not found."

        result = update_event(
            event_id=event["id"],
            title=event["title"],
            event_type=event["event_type"],
            event_date=parsed["event_date"]
            or event["event_date"],
            event_time=parsed["event_time"]
            or event["event_time"],
            description=event["description"]
        )

        return str(result)

    # ======================================
    # DELETE EVENT
    # ======================================

    if "delete_event" in tools_needed:

        print("\n=== DELETE EVENT BLOCK ===\n")

        parsed = parse_delete_event(
            user_input
        )

        print(parsed)

        event = get_event_dict_by_title(
            parsed["title"]
        )

        if not event:

            return "Event not found."

        result = delete_event(
            event["id"]
        )

        return str(result)
    
    # ======================================
    # MEMORY SAVE
    # ======================================

    if "memory_save" in tools_needed:

        extraction_prompt = f"""
    You are a memory extraction system.

    Extract ALL useful memories from the user's message.

    Return ONLY valid JSON.

    Schema:

    [
        {{
            "category": "personal | preferences | academic | goals",
            "key": "short_key",
            "value": "actual_value"
        }}
    ]

    Examples:

    User:
    My name is Ritwam

    Output:
    [
        {{
            "category": "personal",
            "key": "name",
            "value": "Ritwam"
        }}
    ]

    User:
    I like mango and my favorite color is blue

    Output:
    [
        {{
            "category": "preferences",
            "key": "favorite_fruit",
            "value": "mango"
        }},
        {{
            "category": "preferences",
            "key": "favorite_color",
            "value": "blue"
        }}
    ]

    User:
    I completed Pharm D and want to do MBA in Pharmaceutical Management

    Output:
    [
        {{
            "category": "personal",
            "key": "degree",
            "value": "Pharm D"
        }},
        {{
            "category": "goals",
            "key": "post_graduation",
            "value": "MBA in Pharmaceutical Management"
        }}
    ]

    User:
    My name is Ritwam, I like mango and my CAT exam is on 10 June

    Output:
    [
        {{
            "category": "personal",
            "key": "name",
            "value": "Ritwam"
        }},
        {{
            "category": "preferences",
            "key": "favorite_fruit",
            "value": "mango"
        }},
        {{
            "category": "academic",
            "key": "cat_exam_date",
            "value": "10 June"
        }}
    ]

    User Message:

    {user_input}
    """

        response = ask_llm(extraction_prompt)

        print("\n=== MEMORY EXTRACTION ===")
        print(response)
        print("=========================\n")

        try:

            response = (
                response
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )

            data = json.loads(response)

            if isinstance(data, dict):
                data = [data]

            saved_count = 0

            for item in data:

                save_memory(
                    item["category"],
                    item["key"],
                    item["value"]
                )

                saved_count += 1

            return (
                f"I'll remember {saved_count} thing(s)."
            )

        except Exception as e:

            print(
                f"MEMORY SAVE ERROR: {e}"
            )

            return (
                "I couldn't save that memory."
            )

    
    # ======================================
    # MEMORY SEARCH
    # ======================================

    if "memory_search" in tools_needed:

        if status_callback:
            status_callback("searching_memory")

        memory = get_memory()

        prompt = f"""
    You are a memory assistant.

    The following memory belongs to the USER.

    Memory:

    {memory}

    User Question:

    {user_input}

    IMPORTANT RULES:

    - The memory belongs to the user, not you.
    - Answer in SECOND PERSON.
    - Use ONLY the memory provided.
    - If the answer exists in memory, answer naturally.
    - If the answer does not exist, respond EXACTLY with:
    I don't have that information saved.
    - Do not invent facts.
    - Do not roleplay as the user.
    """

        answer = ask_llm(prompt)

        if (
            "i don't have that information saved"
            in answer.lower()
        ):

            log_debug("FALLING BACK TO WEB SEARCH")

            if not web_search_enabled:
                log_debug("[PLANNER] Web Search Blocked By Settings")
                response = "I don't have that information in memory, and **web search is currently disabled** in Settings. Enable Web Search to allow me to look this up online."
                save_message("assistant", response)
                return response

            if status_callback:
                status_callback("searching_web")

            log_debug("[PLANNER] Web Search Allowed")

            search_results = web_search(
                user_input
            )

            if not search_results:

                return (
                    "I couldn't find anything online."
                )

            context = ""

            for item in search_results:

                context += (
                    f"Title: {item['title']}\n"
                    f"Summary: {item['body']}\n"
                    f"URL: {item['href']}\n\n"
                )

            web_prompt = f"""
    Use the search results below to answer the question.

    Search Results:

    {context}

    Question:

    {user_input}

    Answer naturally and concisely.
    """

            response = ask_llm(web_prompt)

            save_message(
                "assistant",
                response
            )

            return response

        save_message(
            "assistant",
            answer
        )

        return answer

    # ======================================
    # MEMORY GET
    # ======================================

    if "memory_get" in tools_needed:

        return format_memory()
    
    # ======================================
    # MEMORY CLEAR
    # ======================================

    if "memory_clear" in tools_needed:

        clear_memory()

        return (
            "All memory has been cleared."
        )
    
    # ======================================
    # KNOWLEDGE SEARCH (RAG)
    # ======================================

    if "knowledge_search" in tools_needed:

        print("\n=== KNOWLEDGE SEARCH (RAG) BLOCK ===\n")
        print("[PLANNER] Document query detected")
        print("[PLANNER] Routing to knowledge_hub")

        if status_callback:
            status_callback("searching_knowledge")

        try:
            import sys
            from pathlib import Path

            # Ensure backend is on sys.path so knowledge modules resolve
            backend_dir = Path(__file__).resolve().parent.parent / "backend"
            if str(backend_dir) not in sys.path:
                sys.path.insert(0, str(backend_dir))

            from knowledge.rag_service import run_rag

            print("[RAG] Retrieval started")
            result = run_rag(user_input)
            answer = result.get("answer", "I could not retrieve an answer from the knowledge base.")

            # Log the RAG pipeline details
            rag_subject = result.get("subject", "None")
            rag_chunks = result.get("chunks", [])
            rag_logs = result.get("logs", [])

            print(f"[RAG] Retrieved {len(rag_chunks)} chunks")
            print(f"[AGENT] RAG subject: {rag_subject}")
            for log_line in rag_logs:
                print(f"[AGENT] {log_line}")

            save_message("assistant", answer)
            return answer

        except Exception as e:
            print(f"[AGENT] Knowledge search error: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to general LLM if RAG fails
            response = ask_llm(user_input)
            save_message("assistant", response)
            return response

    # ======================================
    # TIME TOOL
    # ======================================

    if "time" in tools_needed:

        tool_results["time"] = get_time()

    # ======================================
    # CALCULATOR TOOL
    # ======================================

    if "calculator" in tools_needed:

        expression = extract_expression(
            user_input
        )

        if expression:

            tool_results["calculator"] = calculate(
                expression
            )

    # ======================================
    # SYSTEM TOOL
    # ======================================

    if "system" in tools_needed:

        tool_results["system"] = get_system_info()

    # ======================================
    # WEB SEARCH TOOL
    # ======================================

    if "web_search" in tools_needed:

        if not web_search_enabled:
            log_debug("[PLANNER] Web Search Blocked By Settings")
            response = "Web search is currently **disabled** in Settings. Enable it to allow me to search the internet for this information."
            save_message("assistant", response)
            return response

        log_debug("[PLANNER] Web Search Allowed")
        if status_callback:
            status_callback("searching_web")

        tool_results["web_search"] = web_search(
            user_input
        )

    # ======================================
    # SUBJECT TOOL
    # ======================================

    if "subjects" in tools_needed:

        tool_results["subjects"] = get_subjects()

    # ======================================
    # ATTENDANCE TOOL
    # ======================================

    if "attendance" in tools_needed:

        tool_results["attendance"] = {
        "records":
            get_attendance(),

        "insights":
            get_attendance_insights()
    }
    
    
    # ======================================
    # EVENT TOOL
    # ======================================

    if "events" in tools_needed:

        tool_results["events"] = get_upcoming_events()

    if tool_results:

        context = ""

        for tool_name, result in tool_results.items():

            context += (
                f"{tool_name}:\n"
                f"{result}\n\n"
            )
        prompt = f"""
You are a helpful MBA Copilot assistant.

Tool Results:

{context}

User Question:

{user_input}

Instructions:
- Use the tool results.
- Respond concisely.
- Use markdown headings, lists, and tables to present subjects, attendance, and events clearly.
- Avoid large paragraphs and walls of text.
- Do not mention internal tools.
"""

        response = ask_llm(prompt)

        save_message(
            "assistant",
            response
        )

        return response

    response = ask_llm(user_input)

    save_message(
        "assistant",
        response
    )

    return response
