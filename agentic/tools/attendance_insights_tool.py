from tools.attendance_tool import get_attendance


def get_attendance_insights():

    attendance_data = get_attendance()

    insights = []

    for subject in attendance_data:

        present = subject["present"]

        absent = subject["absent"]

        percentage = subject[
            "attendance_percentage"
        ]

        total = present + absent

        classes_needed = 0

        if percentage < 75:

            while True:

                classes_needed += 1

                new_percentage = (
                    (present + classes_needed)
                    /
                    (total + classes_needed)
                ) * 100

                if new_percentage >= 75:

                    break

        safe_to_miss = 0

        if percentage >= 75:

            while True:

                next_percentage = (
                    present
                    /
                    (
                        total
                        + safe_to_miss
                        + 1
                    )
                ) * 100

                if next_percentage < 75:

                    break

                safe_to_miss += 1

        insights.append(
            {
                "subject":
                    subject["subject"],

                "attendance":
                    percentage,

                "classes_needed":
                    classes_needed,

                "safe_to_miss":
                    safe_to_miss
            }
        )

    return insights