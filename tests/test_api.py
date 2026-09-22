import httpx
import time
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def test_api_indexing():
    print("Testing via API...")
    
    # 1. Check if backend is reachable
    try:
        with httpx.Client() as client:
            res = client.get(f"{BASE_URL}/")
            print(f"Backend status: {res.status_code}, response: {res.json()}")
    except Exception as e:
        print(f"Backend is not running at {BASE_URL}. Error: {e}")
        return False

    # 2. Get list of subjects
    with httpx.Client() as client:
        res = client.get(f"{BASE_URL}/knowledge/subjects")
        print(f"Subjects: {res.json()}")

    # 3. Choose/Create a subject
    subject_name = "Managerial Economics"
    
    # 4. Upload a test PDF to this subject via the API
    source_pdf = Path(__file__).parent / "workspace" / "Managerial_Economics" / "PDFs" / "Strategic_Management.pdf"
    if not source_pdf.exists():
        print(f"Source PDF not found at {source_pdf}")
        return False
        
    print(f"Uploading file: {source_pdf.name} to subject: {subject_name} via API...")
    
    with open(source_pdf, "rb") as f:
        files = {"file": (source_pdf.name, f, "application/pdf")}
        with httpx.Client() as client:
            res = client.post(f"{BASE_URL}/upload-file/{subject_name}", files=files)
        
    if res.status_code != 200:
        print(f"Upload failed: {res.status_code}, {res.text}")
        return False
        
    upload_res = res.json()
    uploaded_filename = upload_res.get("filename")
    print(f"Uploaded file successfully. Registered filename: {uploaded_filename}")
    
    # 5. Monitor status of the uploaded document via /knowledge/subjects/{subject_name}/documents
    print("Monitoring indexing status...")
    max_retries = 30
    status_history = []
    
    for i in range(max_retries):
        with httpx.Client() as client:
            doc_res = client.get(f"{BASE_URL}/knowledge/subjects/{subject_name}/documents")
        docs = doc_res.json()
        
        # Find our document
        target_doc = next((doc for doc in docs if doc["filename"] == uploaded_filename), None)
        if target_doc:
            indexed_status = target_doc.get("indexed")
            chunk_count = target_doc.get("chunk_count")
            status_history.append((indexed_status, chunk_count))
            print(f"Retry {i+1}/{max_retries}: indexed={indexed_status}, chunk_count={chunk_count}")
            
            # If status transitions to 1 (Indexed), we're done
            if indexed_status == 1:
                print(f"[SUCCESS] Document transitioned to Indexed (1) with {chunk_count} chunks!")
                break
        else:
            print(f"Retry {i+1}/{max_retries}: Document {uploaded_filename} not found in listing yet.")
            
        time.sleep(1)
    else:
        print("[ERROR] Timeout waiting for document to be indexed.")
        return False
        
    print(f"Status transitions witnessed: {status_history}")
    return True

if __name__ == "__main__":
    test_api_indexing()
