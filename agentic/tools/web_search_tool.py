from ddgs import DDGS


def web_search(query, max_results=5):

    print("\n[WEB SEARCH] Starting search...")
    print(f"[WEB SEARCH] Query: {query}")

    try:

        results = []

        with DDGS() as ddgs:

            print("[WEB SEARCH] Connected to DDGS")

            search_results = ddgs.text(
                query,
                max_results=max_results
            )

            print("[WEB SEARCH] Processing results...")

            for result in search_results:

                results.append(
                    {
                        "title": result.get(
                            "title",
                            ""
                        ),
                        "body": result.get(
                            "body",
                            ""
                        ),
                        "href": result.get(
                            "href",
                            ""
                        )
                    }
                )

            print(
                f"[WEB SEARCH] Found {len(results)} results"
            )

        print("[WEB SEARCH] Search complete\n")

        return results

    except Exception as e:

        print(
            f"[WEB SEARCH ERROR] {str(e)}"
        )

        return {
            "error": str(e)
        }