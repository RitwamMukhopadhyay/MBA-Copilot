import re


def extract_expression(
    user_input
):

    matches = re.findall(
        r'[\d\.\s\+\-\*\/\(\)]+',
        user_input
    )

    if matches:

        return max(
            matches,
            key=len
        ).strip()

    return None