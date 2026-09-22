import sys
from pathlib import Path

# Add agentic directory to sys.path
agentic_dir = Path(__file__).resolve().parent.parent / "agentic"
if str(agentic_dir) not in sys.path:
    sys.path.insert(0, str(agentic_dir))

from tools.event_create_tool import create_event

if __name__ == "__main__":
    print(
        create_event(
            title="Test123",
            event_type="Reminder",
            event_date="2026-06-15",
            event_time="18:00",
            description="Agent Test"
        )
    )