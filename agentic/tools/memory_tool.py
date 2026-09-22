import json
from pathlib import Path

MEMORY_FILE = (
    Path(__file__)
    .resolve()
    .parent.parent
    / "memory"
    / "memory.json"
)

DEFAULT_MEMORY = {
    "personal": {
        "name": ""
    },

    "preferences": {
        "study_time": ""
    },

    "academic": {
        "cat_exam_date": ""
    },

    "goals": {}
}


def load_memory():

    try:

        if not MEMORY_FILE.exists():

            return DEFAULT_MEMORY.copy()

        with open(
            MEMORY_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except Exception:

        return DEFAULT_MEMORY.copy()


def save_memory(
    category,
    key,
    value
):

    memory = load_memory()

    if category not in memory:

        memory[category] = {}

    memory[category][key] = value

    with open(
        MEMORY_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            memory,
            file,
            indent=4
        )

    return True


def get_memory():

    return load_memory()


def get_memory_value(
    category,
    key
):

    memory = load_memory()

    return (
        memory
        .get(category, {})
        .get(key, "")
    )


def format_memory():

    memory = load_memory()

    output = []

    for category, values in memory.items():

        output.append(
            f"\n[{category.upper()}]"
        )

        for key, value in values.items():

            if value:

                output.append(
                    f"{key}: {value}"
                )

    return "\n".join(output)


def search_memory(query):

    memory = load_memory()

    query = query.lower()

    results = []

    for category, values in memory.items():

        for key, value in values.items():

            text = f"{key} {value}".lower()

            if query in text:

                results.append(
                    {
                        "category": category,
                        "key": key,
                        "value": value
                    }
                )

    return results

def clear_memory():

    with open(
        MEMORY_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            DEFAULT_MEMORY,
            file,
            indent=4
        )

    return True