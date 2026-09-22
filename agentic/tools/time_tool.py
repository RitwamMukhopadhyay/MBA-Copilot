# tools/time_tool.py

from datetime import datetime

def get_time():
    return datetime.now().strftime("%H:%M:%S")