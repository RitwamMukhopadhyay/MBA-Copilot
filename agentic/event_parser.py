"""
Event Parser - Extract event details from natural language input.

Supports natural language dates (tomorrow, june 10, next monday) and
times (1 pm, noon, 5:30 am) with conversion to standardized formats.
"""

import re
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


# ============================================================================
# NATURAL LANGUAGE DATE PARSING
# ============================================================================

def parse_natural_date(date_str):
    """
    Convert natural language date to YYYY-MM-DD format.
    
    Supports:
    - "today" → today's date
    - "tomorrow" → tomorrow's date
    - "next monday" → next Monday
    - "june 10" → current year, June 10
    - "10 june" → same as above
    - "2026-06-10" → returns as-is (already formatted)
    
    Returns: str in YYYY-MM-DD format or None
    """
    if not date_str:
        return None
    
    date_str = date_str.strip().lower()
    logger.debug(f"[PARSER] Parsing natural date: '{date_str}'")
    
    today = datetime.now()
    
    # Handle today/tomorrow
    if date_str == "today":
        result = today.strftime("%Y-%m-%d")
        logger.debug(f"[PARSER] 'today' → {result}")
        return result
    
    if date_str == "tomorrow":
        result = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        logger.debug(f"[PARSER] 'tomorrow' → {result}")
        return result
    
    # Handle next week
    if date_str == "next week" or date_str == "nextweek":
        result = (today + timedelta(weeks=1)).strftime("%Y-%m-%d")
        logger.debug(f"[PARSER] 'next week' → {result}")
        return result
    
    # Handle specific days: "next monday", "next tuesday", etc.
    days_of_week = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6
    }
    
    for day_name, day_num in days_of_week.items():
        if f"next {day_name}" in date_str or f"next{day_name}" in date_str:
            current_day = today.weekday()
            days_ahead = day_num - current_day
            if days_ahead <= 0:
                days_ahead += 7
            result = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            logger.debug(f"[PARSER] 'next {day_name}' → {result}")
            return result
        
        if day_name in date_str and "next" not in date_str:
            # Just the day name (e.g., "monday") - assume next occurrence
            current_day = today.weekday()
            days_ahead = day_num - current_day
            if days_ahead <= 0:
                days_ahead += 7
            result = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            logger.debug(f"[PARSER] '{day_name}' → {result}")
            return result
    
    # Handle month formats: "june 10", "10 june", "Jun 10", "6/10"
    month_names = {
        "january": 1, "jan": 1,
        "february": 2, "feb": 2,
        "march": 3, "mar": 3,
        "april": 4, "apr": 4,
        "may": 5,
        "june": 6, "jun": 6,
        "july": 7, "jul": 7,
        "august": 8, "aug": 8,
        "september": 9, "sep": 9, "sept": 9,
        "october": 10, "oct": 10,
        "november": 11, "nov": 11,
        "december": 12, "dec": 12
    }
    
    # Pattern: "month day" or "day month" (e.g., "june 10" or "10 june")
    for month_name, month_num in month_names.items():
        # "june 10" format
        match = re.search(rf"{month_name}\s+(\d+)", date_str)
        if match:
            day = int(match.group(1))
            try:
                result = f"{today.year:04d}-{month_num:02d}-{day:02d}"
                logger.debug(f"[PARSER] '{month_name} {day}' → {result}")
                return result
            except ValueError:
                logger.warning(f"[PARSER] Invalid date: {month_name} {day}")
                continue
        
        # "10 june" format
        match = re.search(rf"(\d+)(?:st|nd|rd|th)?\s+{month_name}", date_str)
        if match:
            day = int(match.group(1))
            try:
                result = f"{today.year:04d}-{month_num:02d}-{day:02d}"
                logger.debug(f"[PARSER] '{day} {month_name}' → {result}")
                return result
            except ValueError:
                logger.warning(f"[PARSER] Invalid date: {day} {month_name}")
                continue
    
    # Pattern: "6/10" or "6-10"
    match = re.search(r"(\d{1,2})[/-](\d{1,2})", date_str)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        try:
            result = f"{today.year:04d}-{month:02d}-{day:02d}"
            logger.debug(f"[PARSER] '{month}/{day}' → {result}")
            return result
        except ValueError:
            logger.warning(f"[PARSER] Invalid date: {month}/{day}")
    
    # Already in YYYY-MM-DD format
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if match:
        logger.debug(f"[PARSER] Already formatted: {date_str}")
        return date_str
    
    logger.warning(f"[PARSER] Could not parse date: '{date_str}'")
    return None


# ============================================================================
# NATURAL LANGUAGE TIME PARSING
# ============================================================================

def parse_natural_time(time_str):
    """
    Convert natural language time to HH:MM format.
    
    Supports:
    - "1 pm" → "13:00"
    - "5:30 pm" → "17:30"
    - "1:30pm" → "13:30"
    - "5 am" → "05:00"
    - "noon" → "12:00"
    - "midnight" → "00:00"
    - "13:00" → returns as-is (already formatted)
    
    Returns: str in HH:MM format or None
    """
    if not time_str:
        return None
    
    time_str = time_str.strip().lower()
    logger.debug(f"[PARSER] Parsing natural time: '{time_str}'")
    
    # Handle special cases
    if time_str == "noon" or time_str == "midday":
        logger.debug(f"[PARSER] 'noon' → 12:00")
        return "12:00"
    
    if time_str == "midnight":
        logger.debug(f"[PARSER] 'midnight' → 00:00")
        return "00:00"
    
    # Already in HH:MM format
    match = re.match(r"(\d{1,2}):(\d{2})", time_str)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        # Check for am/pm suffix
        am_pm_match = re.search(r"(am|pm)", time_str)
        if am_pm_match:
            is_pm = am_pm_match.group(1) == "pm"
            if is_pm and hour != 12:
                hour += 12
            elif not is_pm and hour == 12:
                hour = 0
        result = f"{hour:02d}:{minute:02d}"
        logger.debug(f"[PARSER] '{time_str}' → {result}")
        return result
    
    # Pattern: "5 pm", "5pm", "5 am", "5am"
    match = re.match(r"(\d{1,2})\s*(am|pm)", time_str)
    if match:
        hour = int(match.group(1))
        is_pm = match.group(2) == "pm"
        
        if is_pm and hour != 12:
            hour += 12
        elif not is_pm and hour == 12:
            hour = 0
        
        result = f"{hour:02d}:00"
        logger.debug(f"[PARSER] '{match.group(1)} {match.group(2)}' → {result}")
        return result
    
    # Pattern: "5:30 pm", "5:30pm"
    match = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        is_pm = match.group(3) == "pm"
        
        if is_pm and hour != 12:
            hour += 12
        elif not is_pm and hour == 12:
            hour = 0
        
        result = f"{hour:02d}:{minute:02d}"
        logger.debug(f"[PARSER] '{match.group(1)}:{match.group(2)} {match.group(3)}' → {result}")
        return result
    
    logger.warning(f"[PARSER] Could not parse time: '{time_str}'")
    return None


# ============================================================================
# EVENT TYPE DETECTION
# ============================================================================

def detect_event_type(user_input):
    """Detect event type from user input."""
    user_lower = user_input.lower()
    
    if "exam" in user_lower or "test" in user_lower:
        return "Exam"
    elif "quiz" in user_lower:
        return "Quiz"
    elif "assignment" in user_lower or "homework" in user_lower:
        return "Assignment"
    elif "presentation" in user_lower or "ppt" in user_lower:
        return "Presentation"
    elif "class" in user_lower or "lecture" in user_lower:
        return "Class"
    elif "meeting" in user_lower:
        return "Meeting"
    else:
        return "Reminder"


# ============================================================================
# MAIN PARSERS FOR CRUD OPERATIONS
# ============================================================================

def parse_create_event(user_input):
    """
    Parse create event request.
    
    Examples:
    - "Create an exam on June 15 at 2pm"
    - "Add a reminder tomorrow at 5pm"
    - "Schedule Finance Study on 2026-06-10 at 14:00"
    """
    logger.info(f"[PARSER] ========== PARSE CREATE EVENT ==========")
    logger.info(f"[PARSER] Input: '{user_input}'")
    
    result = {
        "title": None,
        "event_type": "Reminder",
        "event_date": None,
        "event_time": None,
        "description": ""
    }
    
    text = user_input.strip()
    
    # Detect event type
    result["event_type"] = detect_event_type(text)
    logger.debug(f"[PARSER] Detected event type: {result['event_type']}")
    
    # Extract title
    title_match = re.search(
        r"(?:create|add|schedule)\s+(?:an?\s+)?(?:event|exam|assignment|reminder|task|meeting|class|presentation)\s+(?:called|named)?\s*['\"]?(.+?)['\"]?(?:\s+on|\s+at|\s+for|$)",
        text,
        re.IGNORECASE
    )
    
    if title_match:
        result["title"] = title_match.group(1).strip()
        logger.debug(f"[PARSER] Extracted title: '{result['title']}'")
    else:
        # Fallback: try to extract anything after create/add/schedule
        fallback_match = re.search(
            r"(?:create|add|schedule)\s+(?:an?\s+)?(.+?)(?:\s+on|\s+at|\s+for|\s+tomorrow|\s+today|$)",
            text,
            re.IGNORECASE
        )
        if fallback_match:
            result["title"] = fallback_match.group(1).strip()
            logger.debug(f"[PARSER] Extracted title (fallback): '{result['title']}'")
    
    # Extract date
    # Look for specific patterns first
    date_patterns = [
        r"on\s+([\w\s\d,/-]+?)(?:\s+at\s+|$)",
        r"(?:due|deadline)?\s+([\w\s\d,/-]+?)(?:\s+at\s+|$)",
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_candidate = match.group(1).strip()
            parsed_date = parse_natural_date(date_candidate)
            if parsed_date:
                result["event_date"] = parsed_date
                logger.debug(f"[PARSER] Extracted date: '{date_candidate}' → {parsed_date}")
                break
    
    if not result["event_date"]:
        # Check for "tomorrow" directly
        if "tomorrow" in text.lower():
            result["event_date"] = parse_natural_date("tomorrow")
            logger.debug(f"[PARSER] Found 'tomorrow' keyword → {result['event_date']}")
    
    # Extract time
    time_patterns = [
        r"at\s+([\d:]+\s*(?:am|pm)|\d+\s*(?:am|pm)|noon|midnight)",
        r"@\s+([\d:]+\s*(?:am|pm)|\d+\s*(?:am|pm))",
    ]
    
    for pattern in time_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            time_candidate = match.group(1).strip()
            parsed_time = parse_natural_time(time_candidate)
            if parsed_time:
                result["event_time"] = parsed_time
                logger.debug(f"[PARSER] Extracted time: '{time_candidate}' → {parsed_time}")
                break
    
    logger.info(f"[PARSER] Result: title='{result['title']}', type='{result['event_type']}', date='{result['event_date']}', time='{result['event_time']}'")
    logger.info(f"[PARSER] ========== END PARSE CREATE EVENT ==========\n")
    
    return result

def parse_update_event(user_input):
    """
    Parse update event request.
    Examples:
    "Change Finance Study to 19:00"
    "Move the exam to June 25"
    "Reschedule presentation to tomorrow at 3pm"
    "Update ritwam for 8 june at 10 pm"
    """

    logger.info(
        f"[PARSER] ========== PARSE UPDATE EVENT =========="
    )

    logger.info(
        f"[PARSER] Input: '{user_input}'"
    )

    result = {
        "title": None,
        "event_type": None,
        "event_date": None,
        "event_time": None,
        "description": None
    }

    text = user_input.strip()

    # ====================================================
    # EXTRACT EVENT TITLE
    # ====================================================

    title_match = re.search(
        r"(?:update|change|move|reschedule|modify)\s+(.*?)(?:\s+for\s+|\s+to\s+|\s+at\s+|$)",
        text,
        re.IGNORECASE
    )

    if title_match:

        result["title"] = (
            title_match.group(1)
            .strip()
        )

        logger.debug(
            f"[PARSER] Extracted title: '{result['title']}'"
        )

    # ====================================================
    # EXTRACT DATE
    # ====================================================

    date_match = re.search(
        r"for\s+(.+?)(?:\s+at\s+|$)",
        text,
        re.IGNORECASE
    )

    if date_match:

        date_candidate = (
            date_match.group(1)
            .strip()
        )

        parsed_date = parse_natural_date(
            date_candidate
        )

        if parsed_date:

            result["event_date"] = parsed_date

            logger.debug(
                f"[PARSER] New date: {parsed_date}"
            )

    # ====================================================
    # EXTRACT TIME
    # ====================================================

    time_match = re.search(
        r"at\s+([\d:]+\s*(?:am|pm)|\d+\s*(?:am|pm)|noon|midnight)",
        text,
        re.IGNORECASE
    )

    if time_match:

        time_candidate = (
            time_match.group(1)
            .strip()
        )

        parsed_time = parse_natural_time(
            time_candidate
        )

        if parsed_time:

            result["event_time"] = parsed_time

            logger.debug(
                f"[PARSER] New time: {parsed_time}"
            )

    logger.info(
        f"[PARSER] Result: {result}"
    )

    logger.info(
        f"[PARSER] ========== END PARSE UPDATE EVENT =========="
    )

    return result

def parse_delete_event(user_input):

    logger.info(
        f"[PARSER] DELETE INPUT: {user_input}"
    )

    result = {
        "title": None
    }

    text = user_input.strip()

    import re

    match = re.search(
        r"(?:delete|remove|cancel|drop)\s+(.+)",
        text,
        re.IGNORECASE
    )

    if match:

        result["title"] = (
            match.group(1)
            .strip()
        )

    logger.info(
        f"[PARSER] DELETE RESULT: {result}"
    )

    return result