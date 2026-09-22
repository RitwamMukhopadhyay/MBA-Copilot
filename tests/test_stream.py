import httpx
import json

BASE_URL = "http://127.0.0.1:8000"
AGENT_ENDPOINT = f"{BASE_URL}/chat/agent"

def test_stream():
    print("Sending request to /chat/agent...")
    payload = {"message": "hi"}
    try:
        with httpx.stream("POST", AGENT_ENDPOINT, json=payload, timeout=60.0) as r:
            print(f"Status: {r.status_code}")
            for line in r.iter_lines():
                if line:
                    print(f"Received chunk: {line}")
                    data = json.loads(line)
                    if "response" in data:
                        print(f"Success! Response: {data['response']}")
                    elif "error" in data:
                        print(f"Error: {data['error']}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_stream()
