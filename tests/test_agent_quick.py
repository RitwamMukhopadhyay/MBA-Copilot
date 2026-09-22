"""
Quick test script to verify the agent is working.
Run this in a terminal to test the agent routing.
"""

import requests
import json
import time
import sys

# Force UTF-8 encoding for stdout/stderr to support emojis on Windows consoles
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
AGENT_ENDPOINT = f"{BASE_URL}/chat/agent"

# Test queries
TEST_QUERIES = [
    "What is my attendance?",
    "What subjects am I taking?",
    "What assignments do I have?",
    "How many hours did I study this week?",
]

def test_agent():
    print("\n" + "="*70)
    print("MBA Copilot Agent - Quick Test")
    print("="*70)
    print(f"\nTesting: {AGENT_ENDPOINT}")
    print("\nNote: Make sure:")
    print("  ✓ Backend running: python backend/app.py")
    print("  ✓ Ollama running")
    print("  ✓ Model 'qwen3:8b' available")
    print("\n" + "="*70)
    
    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"\n[TEST {i}/{len(TEST_QUERIES)}] Query: '{query}'")
        print("-" * 70)
        
        try:
            response = requests.post(
                AGENT_ENDPOINT,
                json={"message": query},
                timeout=120,
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ HTTP Error: {response.status_code}")
                continue
            
            data = {}
            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line.decode('utf-8'))
                    if "status" in chunk:
                        print(f"⏱ Agent status update: {chunk['status']}")
                    if "response" in chunk:
                        data = chunk
                    if "error" in chunk:
                        data = chunk
            
            if "error" in data and data["error"]:
                print(f"❌ Error: {data['error']}")
                continue
            
            used_agent = data.get("used_agent", False)
            tools_used = data.get("tools_used", [])
            has_context = data.get("has_context", False)
            response_text = data.get("response", "")
            
            print(f"✓ Used Agent: {used_agent}")
            print(f"✓ Tools Used: {tools_used}")
            print(f"✓ Has Context: {has_context}")
            print(f"\nResponse Preview:")
            print(response_text[:300] + ("..." if len(response_text) > 300 else ""))
            
            if used_agent:
                print(f"\n✅ SUCCESS: Agent responded successfully")
            else:
                print(f"\n⚠️  General chat response received")
            
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to backend")
            print("   Run: python backend/app.py")
            break
        except requests.exceptions.Timeout:
            print("⚠️  Request timeout (Ollama may be slow)")
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    print("\n" + "="*70)
    print("Test Complete")
    print("="*70)
    print("\nIf you see '[AGENT]' logs in the terminal, the agent is working!")
    print("Check the backend terminal for detailed agent processing logs.")

if __name__ == "__main__":
    test_agent()
