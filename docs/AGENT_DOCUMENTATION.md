# MBA Copilot Agent - Phase 1 Documentation

## Overview

The Agent layer is a lightweight tool-based assistant that enhances Chat responses with MBA Copilot database context. It automatically detects user intent and injects relevant data into AI prompts.

**Key Features:**
- ✅ No external dependencies (LangChain, CrewAI, AutoGen)
- ✅ Lightweight pure Python implementation
- ✅ 4 database tools for MBA data
- ✅ Simple intent classification
- ✅ Automatic context injection
- ✅ No memory or web search

---

## Architecture

```
User Message
    ↓
Intent Classifier (keyword matching)
    ↓
Route to Tools (if applicable)
    ↓
Execute Tools (query database)
    ↓
Format Context
    ↓
Inject into Prompt
    ↓
Send to qwen3:8b
    ↓
Return Enhanced Response
```

---

## Tools

### 1. `get_subjects_tool()`
Retrieves all enrolled subjects.

**Data returned:**
- Subject ID, name, course code
- Credits, faculty, term

**Triggered by keywords:**
- subjects, courses, classes, what subjects, my subjects, enrolled

**Example:**
```
User: "What subjects am I taking?"
Tool output: Returns all subjects with details
AI response: Discusses your enrolled courses
```

---

### 2. `get_attendance_tool()`
Retrieves attendance statistics for all subjects.

**Data returned:**
- Subject name and code
- Present count, absent count, cancelled count
- Attendance percentage per subject

**Triggered by keywords:**
- attendance, absent, present, miss, class presence
- attendance record, attendance percentage

**Example:**
```
User: "What's my attendance rate?"
Tool output: Returns attendance stats
AI response: Summarizes your attendance by subject
```

---

### 3. `get_events_tool()`
Retrieves upcoming events (assignments, exams, presentations, etc.).

**Data returned:**
- Event title, type, date, time
- Subject name, description
- Limits to 20 most recent active events

**Triggered by keywords:**
- events, assignment, exam, exams, assignments
- presentation, presentations, deadline, deadlines
- upcoming, when is, what's due, due date
- quiz, quizzes, test, tests, meeting

**Example:**
```
User: "When are my next exams?"
Tool output: Returns upcoming exam events
AI response: Lists exams with dates and subjects
```

---

### 4. `get_study_logs_tool()`
Retrieves recent study sessions.

**Data returned:**
- Study date, subject name
- Notes from study sessions
- Limits to 20 most recent sessions

**Triggered by keywords:**
- study, studied, study logs, study sessions
- how long studied, study history, learning
- revision, notes, what studied

**Example:**
```
User: "What have I studied recently?"
Tool output: Returns study session history
AI response: Summarizes your recent study activity
```

---

## Endpoints

### POST /chat
Basic chat without agent/tools.

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

**Response:**
```json
{
  "response": "AI response"
}
```

---

### POST /chat/agent
Enhanced chat with automatic tool routing.

```bash
curl -X POST http://127.0.0.1:8000/chat/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "What subjects am I taking?"}'
```

**Response:**
```json
{
  "response": "You are enrolled in: ...",
  "used_agent": true,
  "tools_used": ["subjects"],
  "has_context": true
}
```

---

## Intent Classification

The agent uses simple keyword matching to classify user intent:

### Example Classification

| User Query | Detected Intent | Tools | Confidence |
|-----------|-----------------|-------|-----------|
| "What subjects am I taking?" | subjects | `["subjects"]` | High |
| "What's my attendance?" | attendance | `["attendance"]` | High |
| "Do I have exams coming up?" | events | `["events"]` | High |
| "Tell me about my attendance and deadlines" | attendance, events | `["attendance", "events"]` | Medium |
| "Hi, how are you?" | (none) | `[]` | None |

---

## Context Formatting

When tools are executed, results are formatted and injected into the prompt:

```
## MBA Copilot Database Context

### Your Subjects:
- Data Science (CS301, 3 credits)
- Machine Learning (CS401, 4 credits)

### Your Attendance:
- Data Science: 85% (17 present, 3 absent)
- Machine Learning: 90% (18 present, 2 absent)

### Upcoming Events:
- ML Assignment (Assignment) in Machine Learning on 2026-06-15
- DS Exam (Exam) in Data Science on 2026-06-20

### Recent Study Sessions:
- 2026-06-01 - Machine Learning: Chapter 5 - Neural Networks...

---

User Question: <original user query>
```

---

## Usage Examples

### Example 1: Subject Query
```
User: "List my courses"
→ Agent detects "subjects" intent
→ Executes get_subjects_tool()
→ Formats subject data
→ Injects into prompt
→ AI Response: "You are currently enrolled in..."
```

### Example 2: Multi-Intent Query
```
User: "Tell me about my attendance and upcoming deadlines"
→ Agent detects "attendance" and "events" intents
→ Executes both tools
→ Combines results
→ Injects into prompt
→ AI Response: "Your attendance is... You have the following deadlines..."
```

### Example 3: General Query (No Tools)
```
User: "What's the capital of France?"
→ Agent finds no matching intent
→ Tools NOT executed
→ No context injected
→ Regular chat response
```

---

## Testing

### Run Agent Tests
```bash
python test_agent_endpoint.py
```

This runs 9 test cases covering:
- Subject queries
- Attendance queries
- Event/deadline queries
- Study log queries
- General queries (should NOT use tools)

### Test Individual Query
```bash
curl -X POST http://127.0.0.1:8000/chat/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my attendance rate?"}'
```

---

## Implementation Details

### File: `backend/agent.py`

**Functions:**
1. `get_subjects_tool()` - Query subjects table
2. `get_attendance_tool()` - Query attendance stats
3. `get_events_tool()` - Query active events
4. `get_study_logs_tool()` - Query study sessions
5. `classify_intent()` - Keyword-based intent detection
6. `execute_tools()` - Execute selected tools
7. `format_tool_context()` - Format results for prompt
8. `process_with_agent()` - Main agent orchestration

### No External Dependencies
- Pure Python + SQLite
- Uses existing database schema
- No LangChain, CrewAI, or AutoGen
- Minimal code footprint (~400 lines)

---

## Performance

- **Keyword matching:** O(n) where n = keywords
- **Database queries:** Limited to 20 results per tool
- **Context formatting:** String concatenation only
- **Response time:** ~1-5 seconds (mostly Ollama inference time)

---

## Limitations

1. **Intent Classification:** Keyword-based only (no ML/NLP)
   - Workaround: Use clear, specific keywords

2. **Limited Tool Context:** Max 20 results per tool
   - Workaround: AI summarizes most important items

3. **No Refinement:** Single intent classification
   - User can clarify if needed

4. **No Memory:** Each request is independent
   - Workaround: User can repeat context in message

---

## Future Enhancements

### Phase 2
- [ ] Multi-turn conversations
- [ ] Follow-up questions
- [ ] Context persistence within session

### Phase 3
- [ ] More tools (grades, resources, recommendations)
- [ ] Improved intent classification (patterns/rules)
- [ ] Response ranking/filtering

### Phase 4
- [ ] Memory system (conversation history)
- [ ] Web search integration
- [ ] Autonomous actions (auto-attend, reminders)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Chat Module (Frontend)                  │
│  - User types message in chat interface                     │
│  - Calls /chat/agent endpoint                              │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP POST
                        ↓
┌─────────────────────────────────────────────────────────────┐
│           FastAPI App (app.py)                              │
│  - Receives request with user message                       │
│  - Validates input                                          │
│  - Calls process_with_agent()                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│           Agent Layer (agent.py)                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Classify Intent (keyword matching)                │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │ 2. Execute Tools (if applicable)                      │  │
│  │    - get_subjects_tool()                             │  │
│  │    - get_attendance_tool()                           │  │
│  │    - get_events_tool()                               │  │
│  │    - get_study_logs_tool()                           │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │ 3. Format Context from Tool Results                  │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │ 4. Inject Context into Prompt                        │  │
│  │    enhanced_message = context + user_message         │  │
│  └──────────────────────┬────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                 Ollama LLM (qwen3:8b)                       │
│  - Receives enhanced prompt with context                    │
│  - Generates response                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│            Database (SQLite)                                │
│  - Subjects table                                           │
│  - Attendance table                                         │
│  - Events table                                             │
│  - Study sessions table                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

The Agent is a **lightweight, tool-based assistant** that:

✅ Uses existing MBA Copilot database  
✅ Routes queries to relevant tools  
✅ Injects context into AI prompts  
✅ No external dependencies  
✅ Simple and maintainable  

**Next Steps:**
- Test with `python test_agent_endpoint.py`
- Integrate with frontend Chat component
- Collect user feedback for Phase 2 enhancements
