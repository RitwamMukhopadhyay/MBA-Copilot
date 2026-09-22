"""
Test script for the Agent endpoint.

This script demonstrates the agent routing and tool-enhanced chat.
"""

import requests
import json
from datetime import datetime
import sys

# Force UTF-8 encoding for stdout/stderr to support emojis on Windows consoles
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
AGENT_ENDPOINT = f"{BASE_URL}/chat/agent"

# Test queries that should trigger tools
TEST_QUERIES = [
    ("What subjects am I taking?", "subjects"),
    ("What's my attendance rate?", "attendance"),
    ("Do I have any upcoming exams?", "events"),
    ("What have I studied recently?", "study_logs"),
    ("Tell me about my assignments", "events"),
    ("How many classes have I attended?", "attendance"),
    ("List all my courses", "subjects"),
    ("When is my next deadline?", "events"),
    ("What did I study this week?", "study_logs"),
    ("What's the weather today?", "general"),  # Should NOT trigger tools
    ("Hi, how are you?", "general"),  # Should NOT trigger tools
]


def test_agent_query(query, expected_tool):
    """Test a single agent query."""
    print("\n" + "="*70)
    print(f"Query: {query}")
    print(f"Expected Tool(s): {expected_tool}")
    print("="*70)
    
    payload = {"message": query}
    
    try:
        response = requests.post(AGENT_ENDPOINT, json=payload, timeout=60, stream=True)
        print(f"Status: {response.status_code}")
        
        data = {}
        for line in response.iter_lines():
            if line:
                chunk = json.loads(line.decode('utf-8'))
                if "response" in chunk:
                    data = chunk
                if "error" in chunk:
                    data = chunk
        
        print(f"\nUsed Agent: {data.get('used_agent', False)}")
        print(f"Tools Used: {data.get('tools_used', [])}")
        print(f"Has Context: {data.get('has_context', False)}")
        
        if "error" in data and data["error"]:
            print(f"\n❌ Error: {data['error']}")
            return False
        
        response_text = data.get("response", "")
        print(f"\nResponse Preview:")
        print(f"{response_text[:300]}..." if len(response_text) > 300 else response_text)
        
        # Verify tool was used correctly
        tools_used = data.get("tools_used", [])
        if expected_tool == "general":
            if not tools_used:
                print("\n✅ Correctly identified as general query (no tools)")
                return True
            else:
                print("\n⚠️  Should not have used tools for general query")
                return False
        else:
            if expected_tool in tools_used:
                print(f"\n✅ Correctly used {expected_tool} tool")
                return True
            elif tools_used:
                print(f"\n⚠️  Used {tools_used} but expected {expected_tool}")
                return False
            else:
                print(f"\n⚠️  Did not use any tools")
                return False
                
    except requests.exceptions.ConnectionError:
        print("\n❌ Cannot connect to backend")
        print("   Make sure: python backend/app.py is running")
        return False
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return False


def main():
    print("\n" + "="*70)
    print("MBA Copilot Agent Tests")
    print("="*70)
    print(f"\nTesting: {AGENT_ENDPOINT}")
    print("\nNote: Make sure:")
    print("  1. Backend running: python backend/app.py")
    print("  2. Ollama running")
    print("  3. Model 'qwen3:8b' available")
    print(f"\nRunning {len(TEST_QUERIES)} tests...\n")
    
    results = []
    for query, expected_tool in TEST_QUERIES:
        result = test_agent_query(query, expected_tool)
        results.append((query, expected_tool, result))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, _, result in results if result)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} tests passed\n")
    
    for query, expected, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} | {query[:50]}...")
    
    print(f"\n{'🎉 All tests passed!' if passed == total else f'⚠️  {total - passed} test(s) failed'}")


if __name__ == "__main__":
    main()
