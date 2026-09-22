from llm import ask_llm_no_memory
from tools_registry import TOOLS
import json

print("*** PLANNER RELOADED ***")


def detect_tools(user_input, web_search_enabled=True):

    user_lower = user_input.lower().strip()

    # ==================================================
    # AGENT RECOMMENDATION ROUTING
    # ==================================================
    recommendation_keywords = [
        "what should i study today",
        "what should i study",
        "study today",
        "what needs attention",
        "needs attention",
        "prioritize my work",
        "prioritize my tasks",
        "prioritize",
        "what should i focus on",
        "give me study recommendation",
        "prioritize my study",
        "what is urgent",
        "plan my week",
        "exam strategy",
        "academic health report"
    ]
    for kw in recommendation_keywords:
        if kw in user_lower:
            return ["agent_recommend"]

    # ==================================================
    # KNOWLEDGE SEARCH ROUTING (RAG)
    # ==================================================
    knowledge_keywords = [
        "notes say",
        "notes about",
        "according to",
        "uploaded",
        "lecture notes",
        "from my notes",
        "in the document",
        "in the pdf",
        "knowledge base",
        "from my knowledge",
        "generate notes",
        "generate ptm notes",
        "generate pom notes",
        "summarize notes",
        "explain from notes",
        "what is marketing",
        "what is management",
        "what is economics",
        "what is pharmacology",
        "what is epidemiology",
        "what is ethics",
        "define marketing",
        "define management",
        "introduction to marketing",
        "introduction to management",
        "introduction to economics",
        # Subject abbreviation triggers
        "ptm ",
        " ptm",
        "pom ",
        " pom",
        "ipr ",
        " ipr",
        "uhve",
        " pbe",
        "pbe ",
        "pharma business",
        "pharmaco-epidemiology",
        "pharmaco epidemiology",
        "intellectual property",
        "human values",
        "managerial economics",
        # Academic content patterns
        "from the notes",
        "in my notes",
        "my uploaded",
        "study material",
        "course content",
        "lecture content",
        "explain the concept",
        "what does the pdf say",
        "based on my documents",
        # Document / PDF / Knowledge Hub queries
        "offer letter",
        "admission letter",
        "admission situation",
        "admission status",
        "my admission",
        "indexed document",
        "indexed pdf",
        "knowledge hub",
        "uploaded pdf",
        "uploaded document",
        "uploaded file",
        "my pdf",
        "my document",
        "my documents",
        "the pdf",
        "the document",
        "summarize my",
        "summarize the pdf",
        "summarize the document",
        "important points",
        "key points",
        "what does my",
        "what does the letter",
        "from my pdf",
        "from my document",
        "from the pdf",
        "from the document",
        "pdf says",
        "document says",
        "letter says",
        "iihmr",
        "hostel",
        "fee receipt",
        "circular",
    ]
    for kw in knowledge_keywords:
        if kw in user_lower:
            print("[PLANNER] Document query detected")
            print("[PLANNER] Routing to knowledge_hub")
            return ["knowledge_search"]

    # ==================================================
    # EVENT ROUTING
    # ==================================================

    if (
        "create" in user_lower
        or "add" in user_lower
        or "schedule" in user_lower
    ):

        if (
            "reminder" in user_lower
            or "exam" in user_lower
            or "event" in user_lower
            or "assignment" in user_lower
            or "class" in user_lower
        ):

            return ["create_event"]

    if (
        "delete" in user_lower
        or "remove" in user_lower
        or "cancel" in user_lower
    ):

        return ["delete_event"]

    if (
        "update" in user_lower
        or "move" in user_lower
        or "change" in user_lower
        or "reschedule" in user_lower
    ):

        return ["update_event"]

    # ==================================================
    # MEMORY CLEAR
    # ==================================================

    if (
        "clear memory" in user_lower
        or "forget everything" in user_lower
        or "reset memory" in user_lower
        or "delete all memories" in user_lower
    ):

        return ["memory_clear"]

    # ==================================================
    # PRONOUN QUESTIONS -> WEB SEARCH
    # ==================================================

    if web_search_enabled:
        pronoun_starters = [
            "how old is he",
            "how old is she",
            "who is he",
            "who is she",
            "where is he",
            "where is she",
            "when was he",
            "when was she",
            "what is his",
            "what is her",
            "what does he",
            "what does she",
            "tell me more about him",
            "tell me more about her"
        ]

        for phrase in pronoun_starters:

            if phrase in user_lower:

                return ["web_search"]

    # ==================================================
    # TOOL LIST
    # ==================================================

    tools_text = ""

    for tool_name, tool_info in TOOLS.items():
        if tool_name == "web_search" and not web_search_enabled:
            continue

        tools_text += (
            f"{tool_name}: "
            f"{tool_info['description']}\n"
        )


    # ==================================================
    # LLM PLANNER
    # ==================================================

    prompt = f"""
You are an AI tool planner.

Available Tools:

{tools_text}

User Request:
{user_input}

Your job is to determine which tool should be used.

Examples:

User: What should I study today?
Answer:
["agent_recommend"]

User: What needs attention?
Answer:
["agent_recommend"]

User: Prioritize my work
Answer:
["agent_recommend"]

User: What time is it?
Answer:
["time"]

User: What is 25 * 67?
Answer:
["calculator"]

User: What subjects am I taking?
Answer:
["subjects"]

User: What is my attendance?
Answer:
["attendance"]

User: How many classes can I miss?
Answer:
["attendance"]

User: Show my upcoming events
Answer:
["events"]

User: Search latest AI news
Answer:
["web_search"]

User: Who is Elon Musk?
Answer:
["web_search"]

User: How old is Elon Musk?
Answer:
["web_search"]

User: Tell me about Tesla
Answer:
["web_search"]

User: Remember my name is Ritwam
Answer:
["memory_save"]

User: Save that I study best at night
Answer:
["memory_save"]

User: Don't forget my CAT exam is on 10 June
Answer:
["memory_save"]

User: What is my name?
Answer:
["memory_search"]

User: Who am I?
Answer:
["memory_search"]

User: When is my CAT exam?
Answer:
["memory_search"]

User: What do you know about me?
Answer:
["memory_get"]

User: Show memory
Answer:
["memory_get"]

User: I like mango
Answer:
["memory_save"]

User: My favorite color is blue
Answer:
["memory_save"]

User: I prefer studying at night
Answer:
["memory_save"]

User: My birthday is 27 July
Answer:
["memory_save"]

User: I want to do an MBA
Answer:
["memory_save"]

User: I enjoy football
Answer:
["memory_save"]

User: I am a Pharm D student
Answer:
["memory_save"]

User: clear memory
Answer:
["memory_clear"]

User: forget everything
Answer:
["memory_clear"]

User: reset memory
Answer:
["memory_clear"]

User: delete all memories
Answer:
["memory_clear"]

User: What do the notes say about marketing?
Answer:
["knowledge_search"]

User: Generate PTM notes
Answer:
["knowledge_search"]

User: What is Introduction to Marketing according to my notes?
Answer:
["knowledge_search"]

User: Explain pharmacology concepts from my uploaded documents
Answer:
["knowledge_search"]

User: What is my admission situation in IIHMR?
Answer:
["knowledge_search"]

User: What does my offer letter say?
Answer:
["knowledge_search"]

User: Summarize my uploaded PDF
Answer:
["knowledge_search"]

User: What are the important points in my uploaded note?
Answer:
["knowledge_search"]

User: What is my admission status?
Answer:
["knowledge_search"]

IMPORTANT:

- Questions about uploaded documents, PDFs, offer letters, admission letters, indexed documents, knowledge hub content, lecture notes, course content, or study material should ALWAYS use knowledge_search.
- Questions about people, companies, places, products, news, facts, history or general knowledge should use web_search.
- Questions about the user's own saved information should use memory_search.
- Questions asking to save information should use memory_save.
- Questions about enrolled subjects, courses, credits, or faculty should use subjects.
- Return ONLY a valid JSON list.

Examples:

["attendance"]

["memory_search"]

["web_search"]

["knowledge_search"]

[]

Do NOT explain.
Do NOT use markdown.
Do NOT return anything except JSON.
"""

    response = ask_llm_no_memory(prompt)

    print("\n==============================")
    print("TOOL PLANNER")
    print("==============================")
    print("USER:", user_input)
    print("RAW RESPONSE:", response)
    print("==============================\n")

    response = (
        response
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    try:

        tools = json.loads(response)

        if isinstance(tools, list):

            print(
                f"[PLANNER] Selected Tools: {tools}"
            )

            return tools

    except Exception as e:

        print(
            f"[PLANNER ERROR] {e}"
        )

    return []