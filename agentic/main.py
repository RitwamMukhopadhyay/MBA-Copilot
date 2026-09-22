from agent import run_agent


def main():

    print("\n=== Agentic AI Playground ===")
    print("Type 'exit' to quit.\n")

    while True:

        user_input = input("You: ")

        if user_input.lower() == "exit":
            break

        try:

            response = run_agent(
                user_input
            )

            print(
                f"\nAgent: {response}\n"
            )

        except Exception as e:

            print(
                f"\nError: {e}\n"
            )


if __name__ == "__main__":

    main()