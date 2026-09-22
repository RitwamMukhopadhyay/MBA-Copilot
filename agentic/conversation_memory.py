import json
from pathlib import Path

MEMORY_FILE = (
    Path(__file__)
    .resolve()
    .parent
    / "conversation_history.json"
)

MAX_MESSAGES = 10


def load_history():

    try:

        if not MEMORY_FILE.exists():

            return []

        with open(
            MEMORY_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except Exception:

        return []


def save_message(
    role,
    content
):

    history = load_history()

    history.append(
        {
            "role": role,
            "content": content
        }
    )

    history = history[-MAX_MESSAGES:]

    with open(
        MEMORY_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            history,
            file,
            indent=4
        )


def get_history():

    return load_history()


def clear_history():

    with open(
        MEMORY_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            [],
            file,
            indent=4
        )