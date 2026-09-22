"""
Test script for MBA Copilot Agent Action Tools
Tests all CREATE, UPDATE, and DELETE operations
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8000"
AGENT_ENDPOINT = f"{BASE_URL}/chat/agent"

# Test queries for action tools
ACTION_TEST_QUERIES = [
    # Create Subject
    ("Add subject Strategic Management", "create_subject"),
    
    # Create Event
    ("Add exam on June 10 called Midterm Exam", "create_event"),
    ("Add assignment for tomorrow at 2 PM called Project", "create_event"),
    
    # Create Study Log
    ("Log 2 hours of Marketing study", "create_study_log"),
    ("Log 3 study hours for Finance", "create_study_log"),
    
    # Update Attendance
    ("Update attendance for Marketing to 5 out of 8 classes", "update_attendance"),
    
    # Delete Event
    ("Delete the Midterm Exam", "delete_event"),
]

def test_action_tools():
    print("\n" + "="*70)
    print("MBA Copilot Agent - Action Tools Test")
    print("="*70)
    print(f"\nTesting: {AGENT_ENDPOINT}")
    print("\nNote: Make sure:")
    print("  ✓ Backend running: python backend/app.py")
    print("  ✓ Ollama running")
    print("  ✓ Model 'qwen3:8b' available")
    print("\n" + "="*70)
    
    results = []
    
    for i, (query, expected_tool) in enumerate(ACTION_TEST_QUERIES, 1):
        print(f"\n[TEST {i}/{len(ACTION_TEST_QUERIES)}] Action: '{query}'")
        print(f"Expected Tool: {expected_tool}")
        print("-" * 70)
        
        try:
            response = requests.post(
                AGENT_ENDPOINT,
                json={"message": query},
                timeout=120
            )
            
            if response.status_code != 200:
                print(f"❌ HTTP Error: {response.status_code}")
                results.append({
                    "query": query,
                    "status": "FAILED",
                    "reason": f"HTTP {response.status_code}"
                })
                continue
            
            data = response.json()
            
            if "error" in data and data["error"]:
                print(f"❌ Error: {data['error']}")
                results.append({
                    "query": query,
                    "status": "FAILED",
                    "reason": data["error"]
                })
                continue
            
            used_agent = data.get("used_agent", False)
            tools_used = data.get("tools_used", [])
            action_type = data.get("action_type", "read")
            response_text = data.get("response", "")
            
            print(f"✓ Used Agent: {used_agent}")
            print(f"✓ Tools Used: {tools_used}")
            print(f"✓ Action Type: {action_type}")
            print(f"\nAI Response Preview:")
            print(response_text[:400] + ("..." if len(response_text) > 400 else ""))
            
            # Check if expected tool was used
            success = False
            if used_agent and any(expected_tool in tool for tool in tools_used):
                print(f"\n✅ SUCCESS: Expected tool '{expected_tool}' was used")
                success = True
                status = "PASSED"
            elif used_agent and tools_used:
                print(f"\n⚠️  Tool mismatch: Used {tools_used} but expected {expected_tool}")
                status = "PARTIAL"
            else:
                print(f"\n❌ FAILED: No tools were used")
                status = "FAILED"
            
            results.append({
                "query": query,
                "status": status,
                "tools_used": tools_used,
                "action_type": action_type
            })
            
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to backend")
            print("   Run: python backend/app.py")
            results.append({
                "query": query,
                "status": "FAILED",
                "reason": "Connection refused"
            })
            break
        except requests.exceptions.Timeout:
            print("⚠️  Request timeout (Ollama may be slow)")
            results.append({
                "query": query,
                "status": "TIMEOUT",
                "reason": "Request timeout"
            })
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            results.append({
                "query": query,
                "status": "FAILED",
                "reason": str(e)
            })
    
    # Summary
    print("\n" + "="*70)
    print("Test Summary")
    print("="*70)
    
    passed = sum(1 for r in results if r["status"] == "PASSED")
    partial = sum(1 for r in results if r["status"] == "PARTIAL")
    failed = sum(1 for r in results if r["status"] in ["FAILED", "TIMEOUT"])
    
    print(f"\nResults: {passed} passed, {partial} partial, {failed} failed out of {len(results)} tests")
    
    print("\nTest Details:")
    for i, result in enumerate(results, 1):
        status_symbol = "✅" if result["status"] == "PASSED" else "❌" if result["status"] == "FAILED" else "⚠️"
        print(f"{status_symbol} Test {i}: {result['query'][:50]}")
        print(f"   Status: {result['status']}")
        if "tools_used" in result:
            print(f"   Tools: {result['tools_used']}")
        if "reason" in result:
            print(f"   Reason: {result['reason']}")
    
    print("\n" + "="*70)
    print("Action Tools Test Complete")
    print("="*70)
    print("\nIf you see '[AGENT] Create/Update/Delete' logs in the terminal,")
    print("the action tools are working!")
    print("\nCheck the backend terminal for detailed action execution logs.")

if __name__ == "__main__":
    test_action_tools()
