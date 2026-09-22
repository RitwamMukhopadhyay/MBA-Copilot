import sys
import importlib.util
from pathlib import Path

ROOT_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)

AGENTIC_DIR = (
    ROOT_DIR
    / "agentic"
)

if str(AGENTIC_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(AGENTIC_DIR)
    )

AGENT_FILE = (
    AGENTIC_DIR
    / "agent.py"
)

spec = importlib.util.spec_from_file_location(
    "agentic_agent",
    AGENT_FILE
)

agentic_agent = importlib.util.module_from_spec(
    spec
)

spec.loader.exec_module(
    agentic_agent
)

run_agent = (
    agentic_agent.run_agent
)


def run_agentic_chat(
    message: str
):

    return run_agent(
        message
    )