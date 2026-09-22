"""
MBA Copilot Agent - Simple tool-based assistant layer.

No LangChain, no CrewAI, no AutoGen. Just pure Python logic.
"""

import json
from database import get_connection
from datetime import datetime

# ============================================================================
# TOOLS - Database Query Functions
# ============================================================================

def get_subjects_tool():
    """Get all subjects from database."""
    try:
        print("[AGENT] Subjects tool called")
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM subjects")
        subjects = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        print(f"[AGENT] Subjects tool returned {len(subjects)} subjects")
        return {
            "success": True,
            "data": subjects,
            "count": len(subjects)
        }
    except Exception as e:
        print(f"[AGENT] Subjects tool error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


def get_attendance_tool():
    """Get attendance statistics for all subjects."""
    try:
        print("[AGENT] Attendance tool called")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get all subjects with their attendance data
        cursor.execute("""
            SELECT 
                s.id,
                s.name,
                s.course_code,
                COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as present,
                COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as absent,
                COUNT(CASE WHEN a.status = 'Cancelled' THEN 1 END) as cancelled,
                ROUND(COUNT(CASE WHEN a.status = 'Present' THEN 1 END) * 100.0 / 
                      NULLIF(COUNT(*), 0), 2) as attendance_percentage
            FROM subjects s
            LEFT JOIN attendance a ON s.id = a.subject_id
            GROUP BY s.id, s.name, s.course_code
        """)
        
        attendance_data = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        print(f"[AGENT] Attendance tool returned {len(attendance_data)} subjects with attendance data")
        return {
            "success": True,
            "data": attendance_data,
            "count": len(attendance_data)
        }
    except Exception as e:
        print(f"[AGENT] Attendance tool error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


def get_events_tool():
    """Get upcoming events (assignments, exams, etc.)."""
    try:
        print("[AGENT] Events tool called")
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                e.id,
                e.title,
                e.event_type,
                e.event_date,
                e.event_time,
                e.description,
                s.name as subject_name
            FROM events e
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE e.is_completed = 0
            ORDER BY e.event_date ASC
            LIMIT 20
        """)
        
        events = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        print(f"[AGENT] Events tool returned {len(events)} upcoming events")
        return {
            "success": True,
            "data": events,
            "count": len(events)
        }
    except Exception as e:
        print(f"[AGENT] Events tool error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


def get_study_logs_tool():
    """Get recent study sessions."""
    try:
        print("[AGENT] Study logs tool called")
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                ss.id,
                ss.date,
                ss.notes,
                s.name as subject_name
            FROM study_sessions ss
            LEFT JOIN subjects s ON ss.subject_id = s.id
            ORDER BY ss.date DESC
            LIMIT 20
        """)
        
        study_logs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        print(f"[AGENT] Study logs tool returned {len(study_logs)} study sessions")
        return {
            "success": True,
            "data": study_logs,
            "count": len(study_logs)
        }
    except Exception as e:
        print(f"[AGENT] Study logs tool error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


# ============================================================================
# ACTION TOOLS - Create, Update, Delete
# ============================================================================

def create_subject_tool(name, course_code="", credits=3, faculty="", term=""):
    """Create a new subject."""
    try:
        print(f"[AGENT] Create Subject: {name}")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Insert new subject
        cursor.execute("""
            INSERT INTO subjects (name, course_code, credits, faculty, term)
            VALUES (?, ?, ?, ?, ?)
        """, (name, course_code or name.upper()[:6], credits, faculty, term))
        
        conn.commit()
        subject_id = cursor.lastrowid
        conn.close()
        
        print(f"[AGENT] Subject created with ID: {subject_id}")
        return {
            "success": True,
            "message": f"✅ Subject created successfully: {name}",
            "subject_id": subject_id,
            "data": {
                "id": subject_id,
                "name": name,
                "course_code": course_code or name.upper()[:6],
                "credits": credits
            }
        }
    except Exception as e:
        print(f"[AGENT] Create subject error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": f"❌ Failed to create subject: {str(e)}"
        }


def create_event_tool(title, description="", event_type="Assignment", date="", time=""):
    """Create a new event/assignment."""
    try:
        print(f"[AGENT] Create Event: {title}")
        
        # Try to extract subject from description or use first subject
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get first subject if not specified
        cursor.execute("SELECT id FROM subjects LIMIT 1")
        result = cursor.fetchone()
        subject_id = result[0] if result else 1
        
        # Insert new event
        cursor.execute("""
            INSERT INTO events (title, description, event_type, event_date, event_time, subject_id, is_completed)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        """, (title, description, event_type, date, time, subject_id))
        
        conn.commit()
        event_id = cursor.lastrowid
        conn.close()
        
        print(f"[AGENT] Event created with ID: {event_id}")
        return {
            "success": True,
            "message": f"✅ Event created successfully:\n{title}\nType: {event_type}\nDate: {date}",
            "event_id": event_id,
            "data": {
                "id": event_id,
                "title": title,
                "event_type": event_type,
                "event_date": date,
                "event_time": time
            }
        }
    except Exception as e:
        print(f"[AGENT] Create event error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": f"❌ Failed to create event: {str(e)}"
        }


def create_study_log_tool(subject_name, hours=1.0, notes=""):
    """Create a new study session log."""
    try:
        print(f"[AGENT] Create Study Log: {subject_name} - {hours} hours")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Find subject by name
        cursor.execute("SELECT id FROM subjects WHERE name LIKE ?", (f"%{subject_name}%",))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {
                "success": False,
                "error": f"Subject '{subject_name}' not found",
                "message": f"❌ Subject '{subject_name}' not found. Please add it first."
            }
        
        subject_id = result[0]
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Insert study session
        cursor.execute("""
            INSERT INTO study_sessions (subject_id, date, notes)
            VALUES (?, ?, ?)
        """, (subject_id, today, f"{hours}h: {notes}"))
        
        conn.commit()
        session_id = cursor.lastrowid
        conn.close()
        
        print(f"[AGENT] Study log created with ID: {session_id}")
        return {
            "success": True,
            "message": f"✅ Study session logged:\n{subject_name}\nHours: {hours}\nNotes: {notes}",
            "session_id": session_id,
            "data": {
                "id": session_id,
                "subject_id": subject_id,
                "hours": hours,
                "notes": notes,
                "date": today
            }
        }
    except Exception as e:
        print(f"[AGENT] Create study log error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": f"❌ Failed to log study session: {str(e)}"
        }


def update_attendance_tool(subject_name, attended_classes, total_classes):
    """Update attendance for a subject."""
    try:
        print(f"[AGENT] Update Attendance: {subject_name} - {attended_classes}/{total_classes}")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Find subject by name
        cursor.execute("SELECT id FROM subjects WHERE name LIKE ?", (f"%{subject_name}%",))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {
                "success": False,
                "error": f"Subject '{subject_name}' not found",
                "message": f"❌ Subject '{subject_name}' not found"
            }
        
        subject_id = result[0]
        
        # Update or create attendance records
        # Clear existing and add fresh records
        cursor.execute("DELETE FROM attendance WHERE subject_id = ?", (subject_id,))
        
        for i in range(total_classes):
            status = "Present" if i < attended_classes else "Absent"
            cursor.execute("""
                INSERT INTO attendance (subject_id, attendance_date, status)
                VALUES (?, ?, ?)
            """, (subject_id, datetime.now().strftime("%Y-%m-%d"), status))
        
        conn.commit()
        conn.close()
        
        percentage = (attended_classes / total_classes * 100) if total_classes > 0 else 0
        print(f"[AGENT] Attendance updated: {percentage:.1f}%")
        
        return {
            "success": True,
            "message": f"✅ Attendance updated for {subject_name}:\n{attended_classes}/{total_classes} classes ({percentage:.1f}%)",
            "data": {
                "subject_id": subject_id,
                "attended": attended_classes,
                "total": total_classes,
                "percentage": percentage
            }
        }
    except Exception as e:
        print(f"[AGENT] Update attendance error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": f"❌ Failed to update attendance: {str(e)}"
        }


def delete_event_tool(event_id):
    """Delete an event."""
    try:
        print(f"[AGENT] Delete Event: {event_id}")
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get event details first
        cursor.execute("SELECT title FROM events WHERE id = ?", (event_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {
                "success": False,
                "error": f"Event with ID {event_id} not found",
                "message": f"❌ Event not found"
            }
        
        event_title = result[0]
        
        # Delete event
        cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
        conn.close()
        
        print(f"[AGENT] Event deleted: {event_title}")
        return {
            "success": True,
            "message": f"✅ Event deleted successfully:\n{event_title}",
            "data": {
                "event_id": event_id,
                "event_title": event_title
            }
        }
    except Exception as e:
        print(f"[AGENT] Delete event error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": f"❌ Failed to delete event: {str(e)}"
        }


# ============================================================================
# PARAMETER EXTRACTION - Extract parameters from user messages
# ============================================================================

def extract_subject_name(message):
    """Extract subject name from create subject request."""
    # Pattern: "add subject <name>" or "create subject <name>"
    import re
    match = re.search(r'(?:add|create)\s+(?:subject|course)?\s+(.+?)(?:\s+on|\s+at|\s+for|\s+with|$)', message, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def extract_event_params(message):
    """Extract event parameters from create event request."""
    import re
    from datetime import datetime, timedelta
    
    # Extract title
    title_match = re.search(r'(?:add|create)\s+(?:exam|assignment|event)\s+(?:called|named)?\s+(.+?)(?:\s+on|\s+at|\s+for|$)', message, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "Untitled Event"
    
    # Extract event type
    event_type = "Assignment"
    if "exam" in message.lower():
        event_type = "Exam"
    elif "quiz" in message.lower():
        event_type = "Quiz"
    elif "presentation" in message.lower():
        event_type = "Presentation"
    
    # Extract date
    date_str = datetime.now().strftime("%Y-%m-%d")  # Default to today
    if "tomorrow" in message.lower():
        date_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        # Try to find date patterns like "June 10" or "6/10"
        date_match = re.search(r'(?:on|due)?\s+(\w+\s+\d+|\d+/\d+)', message, re.IGNORECASE)
        if date_match:
            date_str = date_match.group(1)
    
    # Extract time
    time_str = ""
    time_match = re.search(r'(?:at|by)\s+(\d+(?::\d+)?(?:\s*(?:am|pm))?)', message, re.IGNORECASE)
    if time_match:
        time_str = time_match.group(1).strip()
    
    return {
        "title": title,
        "event_type": event_type,
        "date": date_str,
        "time": time_str,
        "description": ""
    }


def extract_study_log_params(message):
    """Extract study log parameters from log study request."""
    import re
    
    # Extract subject name
    subject_match = re.search(r'(?:log|record|studied)\s+(?:.*?\s+)?(?:for|of|in)\s+(.+?)(?:\s+for|\s+hours|\s+$)', message, re.IGNORECASE)
    if not subject_match:
        subject_match = re.search(r'(?:study|studied)\s+(.+?)(?:\s+for|\s+hours|$)', message, re.IGNORECASE)
    subject = subject_match.group(1).strip() if subject_match else "Study"
    
    # Extract hours
    hours = 1.0
    hours_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)', message, re.IGNORECASE)
    if hours_match:
        hours = float(hours_match.group(1))
    
    # Extract notes
    notes = message
    
    return {
        "subject": subject,
        "hours": hours,
        "notes": notes
    }


def extract_attendance_params(message):
    """Extract attendance update parameters."""
    import re
    
    # Extract subject name
    subject_match = re.search(r'(?:for|in)\s+(.+?)(?:\s+$|\s+to)', message, re.IGNORECASE)
    subject = subject_match.group(1).strip() if subject_match else None
    
    # Try to extract numbers (attended/total)
    numbers = re.findall(r'\d+', message)
    attended = int(numbers[0]) if numbers else 0
    total = int(numbers[1]) if len(numbers) > 1 else attended
    
    return {
        "subject": subject,
        "attended": attended,
        "total": total
    }


def extract_event_id_from_title(event_title):
    """Find event ID by title."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM events WHERE title LIKE ?", (f"%{event_title}%",))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else None


# ============================================================================
# INTENT CLASSIFICATION - Determine which tools to use
# ============================================================================

INTENT_KEYWORDS = {
    # READ intents
    "subjects": [
        "subjects", "courses", "course", "classes", "class",
        "what subjects", "my subjects", "enrolled", "taking",
        "list subjects", "list courses", "am i taking",
        "which subjects", "what classes", "my courses",
        "what am i", "tell me about my"
    ],
    "attendance": [
        "attendance", "absent", "present", "miss", "class presence",
        "attendance record", "attendance percentage", "how many",
        "classes attended", "how much attendance", "attendance rate",
        "am i", "my attendance", "what's my", "how is my",
        "check attendance", "show attendance"
    ],
    "events": [
        "events", "assignment", "exam", "exams", "assignments",
        "presentation", "presentations", "deadline", "deadlines",
        "upcoming", "when is", "what's due", "due date",
        "quiz", "quizzes", "test", "tests", "meeting",
        "do i have", "what assignments", "show me"
    ],
    "study_logs": [
        "study", "studied", "study logs", "study sessions",
        "how long studied", "study history", "learning",
        "revision", "notes", "what studied", "study hours",
        "how many hours", "study time"
    ],
    
    # ACTION intents
    "create_subject": [
        "add subject", "add course", "create subject", "create course",
        "new subject", "new course", "add a subject", "add a course",
        "register course", "enroll in"
    ],
    "create_event": [
        "add exam", "add assignment", "add deadline", "create exam",
        "create assignment", "schedule exam", "schedule assignment",
        "add event", "create event", "add task", "new exam", "new assignment",
        "add a exam", "add a assignment"
    ],
    "create_study_log": [
        "log study", "log hours", "add study", "record study",
        "log studying", "studied for", "log session", "study session",
        "add study session", "log study session"
    ],
    "update_attendance": [
        "update attendance", "set attendance", "mark attendance",
        "change attendance", "modify attendance", "fix attendance"
    ],
    "delete_event": [
        "delete event", "delete assignment", "delete exam", "delete task",
        "remove event", "remove assignment", "remove exam", "cancel event",
        "cancel assignment", "cancel exam", "drop assignment"
    ]
}


def classify_intent(user_message):
    """
    Classify user intent and determine which tools to call.
    
    Returns a dict with:
    - tools: list of tool names to call
    - confidence: 0-1 confidence score
    - reason: why these tools were selected
    - action_type: "read" or "write"
    - params: extracted parameters for write operations
    """
    message_lower = user_message.lower()
    print(f"[AGENT] Classifying intent for: '{user_message}'")
    
    # Track which intents match
    intent_scores = {intent: 0 for intent in INTENT_KEYWORDS.keys()}
    
    for intent, keywords in INTENT_KEYWORDS.items():
        for keyword in keywords:
            if keyword in message_lower:
                intent_scores[intent] += 1
    
    # Get intents with matches
    matched_intents = [intent for intent, score in intent_scores.items() if score > 0]
    max_score = max(intent_scores.values()) if intent_scores.values() else 0
    
    if max_score == 0:
        # No recognized intent - use general chat
        print("[AGENT] No keywords matched - using general chat")
        return {
            "tools": [],
            "confidence": 0.0,
            "reason": "General question - no specific tool needed",
            "action_type": "read"
        }
    
    # Calculate confidence
    confidence = min(max_score / len(matched_intents) if matched_intents else 0, 1.0)
    
    # Determine action type
    action_intents = ["create_subject", "create_event", "create_study_log", "update_attendance", "delete_event"]
    action_type = "write" if any(intent in action_intents for intent in matched_intents) else "read"
    
    # Extract parameters for action intents
    params = {}
    if action_type == "write":
        for intent in matched_intents:
            if intent == "create_subject":
                params["subject_name"] = extract_subject_name(user_message)
            elif intent == "create_event":
                params.update(extract_event_params(user_message))
            elif intent == "create_study_log":
                params.update(extract_study_log_params(user_message))
            elif intent == "update_attendance":
                params.update(extract_attendance_params(user_message))
            elif intent == "delete_event":
                # Try to find event title
                import re
                title_match = re.search(r'(?:delete|remove)\s+(?:event|assignment|exam)?\s+(.+?)(?:\s+$)', user_message, re.IGNORECASE)
                if title_match:
                    params["event_title"] = title_match.group(1).strip()
    
    print(f"[AGENT] Intent detected: {matched_intents} (confidence: {confidence}, action: {action_type})")
    
    return {
        "tools": matched_intents,
        "confidence": confidence,
        "reason": f"Matched keywords for: {', '.join(matched_intents)}",
        "action_type": action_type,
        "params": params
    }


# ============================================================================
# AGENT ROUTER - Execute tools and prepare context
# ============================================================================

def execute_tools(tool_names, action_type="read", params=None):
    """Execute requested tools and return results."""
    if params is None:
        params = {}
    
    tools_read = {
        "subjects": get_subjects_tool,
        "attendance": get_attendance_tool,
        "events": get_events_tool,
        "study_logs": get_study_logs_tool,
    }
    
    tools_write = {
        "create_subject": create_subject_tool,
        "create_event": create_event_tool,
        "create_study_log": create_study_log_tool,
        "update_attendance": update_attendance_tool,
        "delete_event": delete_event_tool,
    }
    
    tools_available = tools_read if action_type == "read" else tools_write
    
    print(f"[AGENT] Executing {len(tool_names)} tool(s): {tool_names}")
    results = {}
    
    for tool_name in tool_names:
        if tool_name in tools_available:
            if action_type == "write":
                # Action tools need parameters
                if tool_name == "create_subject":
                    results[tool_name] = create_subject_tool(
                        params.get("subject_name", "New Subject")
                    )
                elif tool_name == "create_event":
                    results[tool_name] = create_event_tool(
                        params.get("title", "Untitled Event"),
                        params.get("description", ""),
                        params.get("event_type", "Assignment"),
                        params.get("date", ""),
                        params.get("time", "")
                    )
                elif tool_name == "create_study_log":
                    results[tool_name] = create_study_log_tool(
                        params.get("subject", "Study"),
                        params.get("hours", 1.0),
                        params.get("notes", "")
                    )
                elif tool_name == "update_attendance":
                    results[tool_name] = update_attendance_tool(
                        params.get("subject", ""),
                        params.get("attended", 0),
                        params.get("total", 0)
                    )
                elif tool_name == "delete_event":
                    event_title = params.get("event_title", "")
                    event_id = extract_event_id_from_title(event_title)
                    if event_id:
                        results[tool_name] = delete_event_tool(event_id)
                    else:
                        results[tool_name] = {
                            "success": False,
                            "message": f"❌ Event '{event_title}' not found"
                        }
            else:
                # Read tools don't need parameters
                results[tool_name] = tools_available[tool_name]()
    
    print(f"[AGENT] Tool execution complete")
    return results


def format_tool_context(tool_results, action_type="read"):
    """Format tool results into context for AI prompt."""
    if not tool_results:
        return ""
    
    # For action results, return the confirmation message
    if action_type == "write":
        context_parts = []
        for tool_name, result in tool_results.items():
            if "message" in result:
                context_parts.append(result["message"])
        
        if context_parts:
            print(f"[AGENT] Context formatted with action results")
            return "\n\n".join(context_parts)
        return ""
    
    # For read results
    context_parts = ["=== MBA Copilot Database Context ===\n"]
    has_data = False
    
    # Subjects
    if "subjects" in tool_results and tool_results["subjects"]["success"]:
        subjects = tool_results["subjects"]["data"]
        if subjects:
            has_data = True
            context_parts.append("Your Enrolled Subjects:")
            for subj in subjects:
                context_parts.append(
                    f"  • {subj.get('name', 'N/A')} ({subj.get('course_code', 'N/A')}) - {subj.get('credits', 'N/A')} credits"
                )
            context_parts.append("")
    
    # Attendance
    if "attendance" in tool_results and tool_results["attendance"]["success"]:
        attendance = tool_results["attendance"]["data"]
        if attendance:
            has_data = True
            context_parts.append("Your Attendance by Subject:")
            for att in attendance:
                pct = att.get('attendance_percentage', 0) or 0
                context_parts.append(
                    f"  • {att.get('name', 'N/A')}: {pct}% attendance ({att.get('present', 0)} present, {att.get('absent', 0)} absent)"
                )
            context_parts.append("")
    
    # Events
    if "events" in tool_results and tool_results["events"]["success"]:
        events = tool_results["events"]["data"]
        if events:
            has_data = True
            context_parts.append("Your Upcoming Events/Deadlines:")
            for evt in events[:10]:
                event_date = evt.get('event_date', 'N/A')
                event_time = evt.get('event_time', '')
                time_str = f" at {event_time}" if event_time else ""
                context_parts.append(
                    f"  • {evt.get('title', 'N/A')} ({evt.get('event_type', 'N/A')}) - {evt.get('subject_name', 'N/A')} - Due: {event_date}{time_str}"
                )
            context_parts.append("")
    
    # Study Logs
    if "study_logs" in tool_results and tool_results["study_logs"]["success"]:
        logs = tool_results["study_logs"]["data"]
        if logs:
            has_data = True
            context_parts.append("Your Recent Study Sessions:")
            for log in logs[:10]:
                notes = log.get('notes', 'N/A')
                if notes and notes.strip():
                    context_parts.append(
                        f"  • {log.get('date', 'N/A')} - {log.get('subject_name', 'N/A')}: {notes[:80]}"
                    )
            context_parts.append("")
    
    context_parts.append("=== End of Context ===\n")
    
    if has_data:
        print(f"[AGENT] Context formatted with data")
        return "\n".join(context_parts)
    else:
        print("[AGENT] No data found for context")
        return ""


# ============================================================================
# MAIN AGENT FUNCTION
# ============================================================================

def process_with_agent(user_message, ai_response_callback):
    """
    Process user message with agent layer.
    
    Steps:
    1. Classify intent and determine which tools to use
    2. Execute relevant tools
    3. Format tool results into context
    4. For read actions: send enhanced prompt to AI
       For write actions: send confirmation + message to AI for natural response
    5. Return AI response
    
    Args:
        user_message: The user's message
        ai_response_callback: Function to call LLM with (message, context)
        
    Returns:
        {
            "response": "AI response text",
            "used_agent": bool,
            "tools_used": list,
            "has_context": bool,
            "action_type": "read" or "write"
        }
    """
    print(f"\n[AGENT] Processing message: '{user_message}'")
    
    # Step 1: Classify intent
    intent = classify_intent(user_message)
    action_type = intent.get("action_type", "read")
    params = intent.get("params", {})
    
    # No tools needed - use regular chat
    if not intent["tools"]:
        print("[AGENT] No tools matched - sending to Ollama without enhancement")
        response = ai_response_callback(user_message, "")
        return {
            "response": response,
            "used_agent": False,
            "tools_used": [],
            "has_context": False,
            "action_type": "read"
        }
    
    print(f"[AGENT] STEP 2: Executing {len(intent['tools'])} tool(s) (action: {action_type})")
    # Step 2: Execute tools
    tool_results = execute_tools(intent["tools"], action_type, params)
    
    print(f"[AGENT] STEP 3: Formatting context")
    # Step 3: Format context
    context = format_tool_context(tool_results, action_type)
    
    print(f"[AGENT] STEP 4: Sending enhanced prompt to Ollama")
    # Step 4: Send enhanced prompt to AI
    if action_type == "write":
        # For write actions, include the confirmation in the AI response naturally
        enhanced_message = f"{context}\n\nUser said: {user_message}\n\nPlease confirm this action was successful."
    else:
        # For read actions, inject context with question
        enhanced_message = f"{context}\n\nUser Question: {user_message}"
    
    response = ai_response_callback(enhanced_message, context)
    
    print(f"[AGENT] STEP 5: Response received from Ollama")
    return {
        "response": response,
        "used_agent": True,
        "tools_used": intent["tools"],
        "has_context": bool(context),
        "action_type": action_type,
        "intent_confidence": intent["confidence"]
    }
