from fastapi import (
    FastAPI,
    UploadFile,
    File,
    BackgroundTasks,
    Request,
)
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from pydantic import BaseModel
from agentic_bridge import (

    run_agentic_chat,
    run_agent
)
from conversation_memory import clear_history
from tools.memory_tool import (
    get_memory,
    save_memory,
    clear_memory
)

from services.dashboard_service import (
    get_dashboard_stats,
    get_attendance_alerts
)

from database import (
    initialize_database,
)
from knowledge.metadata_service import (
    initialize_knowledge_db,
    get_knowledge_stats,
    get_all_subjects_with_stats,
)
from knowledge.document_service import (
    get_documents_for_subject,
    sync_all_subjects_documents,
    run_startup_recovery,
)

from services.subject_service import (
    add_subject_to_db,
    get_all_subjects,
    delete_subject_from_db,
)

from services.file_service import (
    create_subject_workspace,
    get_subject_stats,
    open_subject_folder,
    upload_subject_file,
)

from services.summary_service import (
    get_subject_pdfs,
    generate_summary,
)

from services.pdf_classifier import (
    classify_pdf,
    save_pdf_classification,
    get_pdf_category,
)

from services.attendance_service import (
    mark_attendance,
    get_attendance_stats,
    get_attendance_history,
    get_attendance_insights,
)

from services.calendar_service import (
    add_event,
    get_events,
    delete_event,
    get_upcoming_events,
    get_completed_events,
    update_event,
)

from services.assignment_service import (
    add_assignment,
    get_assignments,
    update_assignment,
    delete_assignment,
    mark_assignment_complete
)

from services.settings_service import (
    load_settings,
    save_settings,
    get_current_model_info
)

from services.term_service import (
    get_all_terms,
    add_term_to_db,
    rename_term_in_db,
    delete_term_from_db
)

from llm import ask_llm_no_memory

# -----------------------------
# Models
# -----------------------------

class ChatRequest(BaseModel):
    messages: list


class SimpleChatRequest(BaseModel):
    message: str


class Subject(BaseModel):
    course_code: str
    name: str
    credits: float
    faculty: str
    term: str

class CalendarEvent(BaseModel):
    title: str
    subject_id: int | None = None
    event_type: str
    event_date: str
    event_time: str | None = None
    description: str | None = None

class MemoryRequest(BaseModel):
    category: str
    key: str
    value: str

class Assignment(BaseModel):
    title: str
    subject_id: int | None = None
    due_date: str
    description: str | None = None
    priority: str
    status: str

class SettingsPayload(BaseModel):
    active_provider: str
    active_model: str
    theme: str | None = "Dark"
    fontSize: str | None = "Medium"
    memoryEnabled: bool | None = True
    webSearchEnabled: bool | None = True
    lanEnabled: bool | None = False
    api_keys: dict

# -----------------------------
# App
# -----------------------------

LAN_ACCESS_ENABLED = False

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    """
    Clear conversation history on application start and perform startup validation.
    """
    clear_history()
    print("[BACKEND] Conversation history cleared on startup.")

    # Initialize LAN access status from database configuration settings
    global LAN_ACCESS_ENABLED
    try:
        from services.settings_service import load_settings
        settings = load_settings()
        LAN_ACCESS_ENABLED = settings.get("lanEnabled", False)
        print(f"[STARTUP] LAN Access Host Binding Mode: {'ENABLED (All Interfaces)' if LAN_ACCESS_ENABLED else 'DISABLED (Localhost Only)'}")
    except Exception as e:
        print(f"[STARTUP] Error initializing LAN settings state: {e}")

    # Startup validation
    print("\n" + "="*50)
    print("MBA COPILOT STARTUP VALIDATION")
    print("="*50)

    # 1. Verify Groq API is configured
    groq_ok = False
    try:
        from services.settings_service import load_settings
        settings = load_settings(mask_keys=False)
        groq_key = settings.get("api_keys", {}).get("Groq API", "") or settings.get("providers", {}).get("Groq", {}).get("api_key", "")
        if groq_key and len(groq_key.strip()) > 0:
            groq_ok = True
            print(f"[STARTUP] Groq API key status: Configured (starts with '{groq_key[:7]}...')")
        else:
            print("[STARTUP] Groq API key status: Missing Key")
    except Exception as e:
        print(f"[STARTUP] Groq API validation error: {e}")

    # 2. Verify OpenAI API key exists
    try:
        from knowledge.embeddings import get_openai_api_key
        openai_key = get_openai_api_key()
    except Exception:
        openai_key = ""
        
    openai_ok = False
    if openai_key and len(openai_key) > 0:
        openai_ok = True
        print(f"[STARTUP] OpenAI API key: Found (starts with '{openai_key[:7]}...')")
    else:
        print("[STARTUP] OpenAI API key: Missing")

    # 3. Verify FAISS index path exists
    try:
        from knowledge.faiss_store import DATABASE_ROOT
        faiss_path_ok = DATABASE_ROOT.exists()
    except Exception:
        faiss_path_ok = False
        from pathlib import Path
        DATABASE_ROOT = Path(__file__).resolve().parent.parent / "database" # fallback
        
    if faiss_path_ok:
        print(f"[STARTUP] FAISS index root path: Found ({DATABASE_ROOT.resolve()})")
    else:
        print(f"[STARTUP] FAISS index root path: Missing ({DATABASE_ROOT.resolve()})")

    print("-"*50)
    if groq_ok and openai_ok and faiss_path_ok:
        print("[STARTUP] STATUS: READY (All validation checks passed)")
    else:
        print("[STARTUP] STATUS: WARNING (Some validation checks failed)")
    print("="*50 + "\n")

initialize_database()
initialize_knowledge_db()
try:
    run_startup_recovery()
except Exception as e:
    print(f"[STARTUP] Error performing startup recovery: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def lan_access_middleware(request: Request, call_next):
    global LAN_ACCESS_ENABLED
    import ipaddress
    
    # Always read lanEnabled fresh from DB so the in-memory global can never get
    # stuck at False when the server started before the setting was toggled ON.
    lan_enabled = LAN_ACCESS_ENABLED  # use cached value as default
    try:
        from services.settings_service import load_settings
        settings = load_settings()
        lan_enabled = settings.get("lanEnabled", False)
        # Keep the global in sync so /settings/lan-info reflects reality
        LAN_ACCESS_ENABLED = lan_enabled
    except Exception:
        pass  # fall back to the cached global
    
    client_host = request.client.host if request.client else None
    
    is_allowed = False
    if client_host:
        if client_host in ("127.0.0.1", "localhost", "::1", "testclient"):
            is_allowed = True
        elif lan_enabled:
            try:
                ip = ipaddress.ip_address(client_host)
                if ip.is_private:
                    is_allowed = True
            except ValueError:
                pass

    if client_host and not is_allowed:
        reason = "LAN access is disabled in settings." if not lan_enabled else "Host validation failed"
        print("[LAN BLOCK]")
        print(f"Client IP: {client_host}")
        print(f"Request URL: {request.url}")
        print(f"Reason: {reason}")
        return JSONResponse(
            status_code=403,
            content={"detail": f"Forbidden: {reason}"}
        )
    
    response = await call_next(request)
    return response


# -----------------------------
# Root
# -----------------------------

@app.get("/")
def root():

    return {
        "message": "MBA Copilot Backend Running"
    }


# -----------------------------
# Chat
# -----------------------------

@app.post("/chat/reset")
def reset_chat():
    """
    Clear the temporary conversation history.
    """
    try:
        clear_history()
        return {"message": "Conversation history cleared successfully"}
    except Exception as e:
        return {"error": f"Failed to clear history: {str(e)}"}

@app.post("/chat")
def chat_with_ai(request: SimpleChatRequest):
    """
    Send a message to Ollama and get an AI response.
    """
    print("[CHAT] Message Received")
    try:
        # Validate message is not empty
        if not request.message or not request.message.strip():
            return {
                "error": "Message cannot be empty",
                "response": None
            }
        
        response = ask_llm_no_memory(request.message.strip())
        
        return {
            "response": response
        }
    
    except Exception as e:
        error_message = str(e)
        print(f"[ERROR] Chat endpoint failed: {error_message}")
        return {
            "error": f"Failed to process chat request: {error_message}",
            "response": None
        }


# Chat with Agent - Tool-enhanced responses
# Uses MBA Copilot database context automatically

@app.post("/chat/agent")
def chat_with_agent(
    request: SimpleChatRequest
):
    print("[CHAT] Message Received")
    try:
        if (
            not request.message
            or not request.message.strip()
        ):
            return {
                "error": "Message cannot be empty",
                "response": None,
                "used_agent": False,
                "tools_used": [],
            }

        import queue
        import threading
        import json

        q = queue.Queue()

        def status_callback(status):
            q.put({"status": status})

        def run():
            try:
                response = run_agent(
                    request.message.strip(),
                    status_callback=status_callback
                )
                q.put({
                    "response": response,
                    "used_agent": True,
                    "tools_used": [],
                    "has_context": True
                })
            except Exception as e:
                import traceback
                traceback.print_exc()
                q.put({"error": str(e)})

        thread = threading.Thread(target=run)
        thread.start()

        def generator():
            while True:
                try:
                    item = q.get(timeout=60)
                    yield json.dumps(item) + "\n"
                    if "response" in item or "error" in item:
                        break
                except queue.Empty:
                    yield json.dumps({"error": "Request timeout"}) + "\n"
                    break

        return StreamingResponse(generator(), media_type="application/x-ndjson")

    except Exception as e:
        error_message = str(e)
        print(f"[ERROR] Agent chat endpoint failed: {error_message}")
        return {
            "error": f"Failed to process agent chat request: {error_message}",
            "response": None,
            "used_agent": False,
            "tools_used": [],
        }


# -----------------------------
# Memory
# -----------------------------

@app.get("/memory")
def fetch_memory():
    return get_memory()

@app.post("/memory/save")
def update_memory(request: MemoryRequest):
    result = save_memory(request.category, request.key, request.value)
    return {"success": result, "message": "Memory updated successfully"}

@app.post("/memory/clear")
def reset_memory():
    clear_memory()
    return {"message": "All long-term memory cleared successfully"}

# -----------------------------
# Subjects
# -----------------------------

@app.post("/subjects")
def add_subject(
    subject: Subject
):

    result = add_subject_to_db(
        subject
    )

    if (
        result["message"]
        == "Subject added"
    ):

        create_subject_workspace(
            subject.name
        )

    return result

# Ritwam
@app.get("/subjects")
def get_subjects():

    return get_all_subjects()


@app.delete(
    "/subjects/{subject_id}"
)
def delete_subject(
    subject_id: int
):

    return delete_subject_from_db(
        subject_id
    )

@app.put("/subjects/{subject_id}")
def update_subject(subject_id: int, subject: Subject):
    try:
        from services.subject_service import update_subject_in_db
        res = update_subject_in_db(subject_id, subject)
        if "error" in res:
            return {"error": res["error"]}
        return res
    except Exception as e:
        return {"error": str(e)}


# -----------------------------
# Subject Statistics
# -----------------------------

@app.get(
    "/subject-stats/{subject_name}"
)
def subject_stats(
    subject_name: str
):

    return get_subject_stats(
        subject_name
    )


# -----------------------------
# Open Folder
# -----------------------------

@app.post(
    "/open-subject-folder/{subject_name}"
)
def open_folder(
    subject_name: str
):

    return open_subject_folder(
        subject_name
    )


# -----------------------------
# Upload File
# -----------------------------

@app.post(
    "/upload-file/{subject_name}"
)
async def upload_file(
    subject_name: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Accepts a multipart file upload, streams it in 64 KB chunks, stores it
    under a UUID-based filename (path-traversal safe), and immediately returns
    202 Accepted.  All heavy pipeline work (text extraction, embedding,
    FAISS indexing) is offloaded to a BackgroundTasks worker.
    """
    import uuid as _uuid

    # ── 1. Reject obviously malicious filenames early ────────────────────────
    original_filename = file.filename or "unnamed.pdf"
    # Strip any directory components so traversal attempts are dead on arrival.
    original_filename = Path(original_filename).name

    # ── 2. Chunked stream read (64 KB pages) ─────────────────────────────────
    # This prevents the entire file from being buffered in one allocation,
    # keeping memory footprint flat even during concurrent large uploads.
    chunks: list[bytes] = []
    try:
        while True:
            chunk = await file.read(64 * 1024)  # 64 KB
            if not chunk:
                break
            chunks.append(chunk)
    except Exception as read_err:
        print(f"[UPLOAD] Chunked read failed: {read_err}")
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to read uploaded file: {read_err}"}
        )
    content = b"".join(chunks)

    # ── 3. Persist to disk (UUID filename) and register in knowledge DB ───────
    try:
        res = upload_subject_file(
            subject_name=subject_name,
            original_filename=original_filename,
            content=content,
        )
    except Exception as save_err:
        print(f"[UPLOAD] File save failed: {save_err}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to save file: {save_err}"}
        )

    stored_filename = res.get("filename")
    document_id = res.get("document_id")

    # ── 4. Queue background indexing with defensive error handling ────────────
    if stored_filename and stored_filename.lower().endswith(".pdf"):
        def _safe_index_task(sn: str, fn: str):
            try:
                from knowledge.indexing_service import start_background_indexing
                start_background_indexing(sn, fn)
            except Exception as bg_err:
                # Log but never let a background exception surface to the
                # event loop or crash the running server.
                print(f"[UPLOAD BG INDEXING] Error during background indexing of '{fn}': {bg_err}")

        background_tasks.add_task(_safe_index_task, subject_name, stored_filename)

    # ── 5. Return 202 Accepted immediately ───────────────────────────────────
    return JSONResponse(
        status_code=202,
        content={
            "message": "File accepted — indexing in progress",
            "document_id": document_id,
            "filename": stored_filename,
            "original_filename": original_filename,
            "category": res.get("category", "academic"),
        }
    )


# -----------------------------
# PDF Listing
# -----------------------------

@app.get(
    "/subject-pdfs/{subject_name}"
)
def subject_pdfs(
    subject_name: str
):

    return get_subject_pdfs(
        subject_name
    )


# -----------------------------
# Generate Summary
# -----------------------------

@app.post(
    "/generate-summary/{subject_name}/{pdf_name}"
)
def create_summary(
    subject_name: str,
    pdf_name: str
):

    return generate_summary(
        subject_name,
        pdf_name
    )

# -----------------------------
# PDF Reclassify (manual override)
# -----------------------------

class ReclassifyRequest(BaseModel):
    category: str  # 'academic' or 'administrative'

@app.post(
    "/reclassify-pdf/{subject_name}/{pdf_name}"
)
def reclassify_pdf(
    subject_name: str,
    pdf_name: str,
    body: ReclassifyRequest
):
    """Manually override the classification of a PDF."""
    category = body.category
    if category not in ("academic", "administrative"):
        return {"error": "Invalid category. Use 'academic' or 'administrative'."}
    try:
        save_pdf_classification(subject_name, pdf_name, category)
        return {"message": f"{pdf_name} reclassified as {category}", "category": category}
    except Exception as e:
        return {"error": str(e)}




@app.post(
    "/attendance/{subject_name}/{status}"
)
def record_attendance(
    subject_name: str,
    status: str
):

    return mark_attendance(
        subject_name,
        status
    )


@app.get(
    "/attendance-stats/{subject_name}"
)
def attendance_stats(
    subject_name: str
):

    return get_attendance_stats(
        subject_name
    )


@app.get(
    "/attendance-history/{subject_name}"
)
def attendance_history(
    subject_name: str
):

    return get_attendance_history(
        subject_name
    )


@app.get(
    "/attendance-insights/{subject_name}"
)
def attendance_insights(
    subject_name: str
):

    return get_attendance_insights(
        subject_name
    )


# =========================================================
# DASHBOARD
# =========================================================

@app.get("/dashboard/stats")
def dashboard_stats():
    return get_dashboard_stats()


@app.get("/dashboard/attendance-alerts")
def dashboard_attendance_alerts():
    return get_attendance_alerts()


# =========================================================
# CALENDAR
# =========================================================

@app.post("/events")
def create_event(
    event: CalendarEvent
):

    res = add_event(
        event
    )
    try:
        clear_history()
    except Exception:
        pass
    return res


@app.get("/events")
def fetch_events():

    return get_events()


@app.get("/events/completed")
def fetch_completed_events():

    return get_completed_events()


@app.delete(
    "/events/{event_id}"
)
def remove_event(
    event_id: str
):

    res = delete_event(
        event_id
    )
    try:
        clear_history()
    except Exception:
        pass
    return res


@app.put("/events/{event_id}")
def edit_event(
    event_id: str,
    event: CalendarEvent
):

    res = update_event(
        event_id,
        event
    )
    try:
        clear_history()
    except Exception:
        pass
    return res


@app.get(
    "/events/upcoming"
)
def upcoming_events():

    return get_upcoming_events()


# -----------------------------
# Assignments
# -----------------------------

@app.get("/assignments")
def fetch_assignments():
    return get_assignments()

@app.post("/assignments")
def create_assignment(
    assignment: Assignment
):
    res = add_assignment(assignment)
    try:
        clear_history()
    except Exception:
        pass
    return res

@app.put("/assignments/{assignment_id}")
def edit_assignment(
    assignment_id: int,
    assignment: Assignment
):
    res = update_assignment(assignment_id, assignment)
    try:
        clear_history()
    except Exception:
        pass
    return res

@app.delete("/assignments/{assignment_id}")
def remove_assignment(
    assignment_id: int
):
    res = delete_assignment(assignment_id)
    try:
        clear_history()
    except Exception:
        pass
    return res

@app.post("/assignments/{assignment_id}/complete")
def complete_assignment(
    assignment_id: int
):
    res = mark_assignment_complete(assignment_id)
    try:
        clear_history()
    except Exception:
        pass
    return res


# -----------------------------
# Settings & AI Provider Management
# -----------------------------

@app.get("/settings")
def fetch_settings():
    return load_settings(mask_keys=True)

@app.get("/settings/current-model")
def fetch_current_model():
    print("[POLLING] Status Refreshed")
    return get_current_model_info()

@app.post("/settings")
def update_settings(payload: SettingsPayload):
    global LAN_ACCESS_ENABLED
    if payload.lanEnabled is not None:
        LAN_ACCESS_ENABLED = payload.lanEnabled
    return save_settings(payload.dict())

@app.get("/settings/lan-info")
def get_lan_info(request: Request):
    """
    Auto-detect local host IPv4 address and display connection URLs based on LAN state.
    """
    global LAN_ACCESS_ENABLED
    import socket
    
    # Always read lanEnabled fresh from DB to avoid stale global
    try:
        fresh_settings = load_settings()
        lan_enabled = fresh_settings.get("lanEnabled", False)
        LAN_ACCESS_ENABLED = lan_enabled  # keep global in sync
    except Exception:
        lan_enabled = LAN_ACCESS_ENABLED
    
    # Always detect local network IP just in case
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        detected_ip = s.getsockname()[0]
    except Exception:
        detected_ip = '127.0.0.1'
    finally:
        s.close()
        
    client_ip = request.client.host if request.client else '127.0.0.1'
    
    if lan_enabled:
        host_ip = detected_ip
        backend_url = f"http://{host_ip}:8000"
        frontend_url = f"http://{host_ip}:5173"
        connection_status = "Connected"
    else:
        host_ip = '127.0.0.1'
        backend_url = "http://localhost:8000"
        frontend_url = "http://localhost:5173"
        connection_status = "Localhost Mode"

    return {
        "host_ip": host_ip,
        "client_ip": client_ip,
        "backend_url": backend_url,
        "frontend_url": frontend_url,
        "connection_status": connection_status,
        "lan_enabled": lan_enabled
    }

@app.post("/settings/restart")
def restart_application(background_tasks: BackgroundTasks):
    """
    Restart MBA Copilot to apply network changes.
    """
    import os
    import sys
    import time
    
    # 1. Determine target host binding from DB configuration
    try:
        settings = load_settings()
        lan_enabled = settings.get("lanEnabled", False)
        host_val = "0.0.0.0"
    except Exception as e:
        print(f"[RESTART] Error loading settings for restart: {e}")
        host_val = "0.0.0.0"

    # 2. Touch vite.config.js to force Vite server to restart and bind to new host
    try:
        from pathlib import Path
        vite_config_path = Path(__file__).resolve().parent.parent / "frontend" / "vite.config.js"
        if vite_config_path.exists():
            content = vite_config_path.read_text(encoding="utf-8")
            lines = content.splitlines()
            # Remove any existing touch comments
            cleaned_lines = [l for l in lines if not l.startswith("// touched at ")]
            cleaned_lines.append(f"// touched at {int(time.time())}")
            vite_config_path.write_text("\n".join(cleaned_lines) + "\n", encoding="utf-8")
            print(f"[RESTART] Touched vite.config.js at {vite_config_path}")
    except Exception as e:
        print(f"[RESTART] Error touching vite.config.js: {e}")

    # 3. Schedule background task to perform restart
    def perform_restart():
        time.sleep(1.0)
        import subprocess
        
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        current_pid = os.getpid()
        parent_pid = os.getppid()
        
        # Resolve grandparent process ID
        grandparent_pid = None
        try:
            out = subprocess.check_output(
                f"wmic process where processid={parent_pid} get parentprocessid",
                shell=True,
                text=True
            )
            lines = out.strip().splitlines()
            if len(lines) > 1:
                grandparent_pid = int(lines[1].strip())
        except Exception:
            pass

        # Determine target PIDs to kill
        pids_to_kill = []
        if grandparent_pid:
            try:
                name_out = subprocess.check_output(
                    f"wmic process where processid={grandparent_pid} get name",
                    shell=True,
                    text=True
                )
                g_name = name_out.strip().splitlines()[1].strip().lower()
                # Only kill grandparent if it is python or uvicorn
                if "python" in g_name or "uvicorn" in g_name:
                    pids_to_kill.append(grandparent_pid)
            except Exception:
                pass
                
        pids_to_kill.append(parent_pid)
        pids_to_kill.append(current_pid)

        # De-duplicate PIDs
        seen = set()
        unique_pids = []
        for p in pids_to_kill:
            if p is not None and p not in seen:
                seen.add(p)
                unique_pids.append(p)

        # Build powershell script for detached execution
        pids_list_str = ",".join(map(str, unique_pids))
        ps_script = f"""
Start-Sleep -Seconds 1
foreach ($pid in @({pids_list_str})) {{
    try {{ Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }} catch {{}}
}}
Start-Sleep -Seconds 1
Start-Process -NoNewWindow -FilePath '{sys.executable}' -ArgumentList '-m uvicorn app:app --host {host_val} --port 8000 --reload' -WorkingDirectory '{backend_dir}'
"""
        try:
            # Run PowerShell detached completely
            subprocess.Popen(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                close_fds=True
            )
            print(f"[RESTART] Detached powershell restarter spawned successfully with PIDs: {unique_pids}")
        except Exception as e:
            print(f"[RESTART] Failed to spawn detached restart script: {e}")

    background_tasks.add_task(perform_restart)
    return {"success": True, "message": "Restarting MBA Copilot..."}



# -----------------------------
# Terms Management Endpoints
# -----------------------------

class TermPayload(BaseModel):
    name: str

class RenameTermPayload(BaseModel):
    name: str

@app.get("/terms")
def get_terms():
    return get_all_terms()

@app.post("/terms")
def add_term(payload: TermPayload):
    return add_term_to_db(payload.name)

@app.put("/terms/{term_id}")
def rename_term(term_id: int, payload: RenameTermPayload):
    return rename_term_in_db(term_id, payload.name)

@app.delete("/terms/{term_id}")
def delete_term(term_id: int):
    return delete_term_from_db(term_id)


# -----------------------------
# Knowledge Hub Endpoints
# -----------------------------

@app.get("/knowledge/stats")
def fetch_knowledge_stats():
    try:
        return get_knowledge_stats()
    except Exception as e:
        return {"error": str(e)}

@app.get("/knowledge/subjects")
def fetch_knowledge_subjects():
    try:
        return get_all_subjects_with_stats()
    except Exception as e:
        return {"error": str(e)}

@app.get("/knowledge/subjects/{subject_name}/documents")
def fetch_knowledge_subject_documents(subject_name: str):
    try:
        return get_documents_for_subject(subject_name)
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge/subjects/{subject_name}/documents/{filename}/index")
def manual_index_document(subject_name: str, filename: str, background_tasks: BackgroundTasks):
    try:
        from knowledge.indexing_service import start_background_indexing
        background_tasks.add_task(start_background_indexing, subject_name, filename)
        return {"message": f"Background indexing started for {filename}"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge/subjects/{subject_name}/index-all")
def manual_index_all_subject_documents(subject_name: str, background_tasks: BackgroundTasks):
    try:
        from knowledge.document_service import get_documents_for_subject
        from knowledge.indexing_service import start_background_indexing
        docs = get_documents_for_subject(subject_name)
        count = 0
        for doc in docs:
            if doc.get("indexed") == 0:
                background_tasks.add_task(start_background_indexing, subject_name, doc["filename"])
                count += 1
        return {"message": f"Background indexing started for {count} documents"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/knowledge/subjects/{subject_name}/documents/{filename}/view")
def view_document_endpoint(subject_name: str, filename: str):
    try:
        from knowledge.models import get_knowledge_connection
        from pathlib import Path
        from fastapi.responses import FileResponse
        
        conn = get_knowledge_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.filepath 
            FROM documents d
            JOIN subjects s ON d.subject_id = s.id
            WHERE s.name = ? AND d.filename = ?
        """, (subject_name, filename))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {"error": "Document not found"}
        
        filepath = Path(row["filepath"])
        if not filepath.exists():
            return {"error": "PDF file not found on disk"}
            
        return FileResponse(str(filepath.resolve()), media_type="application/pdf")
    except Exception as e:
        return {"error": str(e)}

class RenameDocumentRequest(BaseModel):
    new_filename: str

class MoveDocumentRequest(BaseModel):
    new_subject_name: str

@app.post("/knowledge/subjects/{subject_name}/documents/{filename}/rename")
def rename_document_endpoint(subject_name: str, filename: str, payload: RenameDocumentRequest):
    try:
        from knowledge.document_service import rename_document
        res = rename_document(subject_name, filename, payload.new_filename)
        return res
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge/subjects/{subject_name}/documents/{filename}/move")
def move_document_endpoint(subject_name: str, filename: str, payload: MoveDocumentRequest):
    try:
        from knowledge.document_service import move_document
        res = move_document(subject_name, payload.new_subject_name, filename)
        return res
    except Exception as e:
        return {"error": str(e)}

@app.get("/knowledge/subjects/{subject_name}/health")
def check_subject_health_endpoint(subject_name: str):
    try:
        from knowledge.health_service import check_subject_health
        res = check_subject_health(subject_name)
        return res
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge/subjects/{subject_name}/repair")
def repair_subject_index_endpoint(subject_name: str):
    try:
        from knowledge.health_service import repair_subject_index
        res = repair_subject_index(subject_name)
        return res
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge/subjects/{subject_name}/documents/{filename}/reindex")
def reindex_document_endpoint(subject_name: str, filename: str, background_tasks: BackgroundTasks):
    try:
        from knowledge.indexing_service import start_background_indexing
        background_tasks.add_task(start_background_indexing, subject_name, filename)
        return {"message": f"Background reindexing started for {filename}"}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/knowledge/subjects/{subject_name}/documents/{filename}")
def delete_document_route_endpoint(subject_name: str, filename: str):
    try:
        from knowledge.document_service import delete_document
        res = delete_document(subject_name, filename)
        return res
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge/subjects/{subject_name}/documents/{filename}/replace")
async def replace_document_endpoint(
    subject_name: str,
    filename: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Deletes the old document, saves the replacement using a new UUID filename,
    and queues background re-indexing.  Returns 202 Accepted immediately.
    """
    import uuid as _uuid
    try:
        from knowledge.document_service import delete_document
        from knowledge.indexing_service import start_background_indexing

        # 1. Delete old document
        delete_document(subject_name, filename)

        # 2. Stream-read the replacement file in 64 KB chunks
        original_filename = Path(file.filename or "replacement.pdf").name
        chunks: list[bytes] = []
        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        content = b"".join(chunks)

        # 3. Save with UUID storage name (path-traversal safe)
        res = upload_subject_file(
            subject_name=subject_name,
            original_filename=original_filename,
            content=content,
        )
        new_stored_filename = res.get("filename")
        new_document_id = res.get("document_id")

        # 4. Queue background re-indexing with defensive wrapper
        if new_stored_filename:
            def _safe_reindex_task(sn: str, fn: str):
                try:
                    start_background_indexing(sn, fn)
                except Exception as bg_err:
                    print(f"[REPLACE BG INDEXING] Error during background indexing of '{fn}': {bg_err}")

            background_tasks.add_task(_safe_reindex_task, subject_name, new_stored_filename)

        print("[DOC] Replaced")
        return JSONResponse(
            status_code=202,
            content={
                "message": f"Replacement accepted — reindexing in progress",
                "old_filename": filename,
                "filename": new_stored_filename,
                "original_filename": original_filename,
                "document_id": new_document_id,
            }
        )
    except Exception as e:
        print(f"[REPLACE] Unhandled error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# -----------------------------
# Knowledge Retrieval Endpoints
# -----------------------------

class RetrievalRequest(BaseModel):
    subject_name: str
    question: str
    top_k: int = 5

@app.post("/knowledge/retrieve")
def retrieve_knowledge(payload: RetrievalRequest):
    try:
        from knowledge.query_service import search_knowledge
        result = search_knowledge(
            subject_name=payload.subject_name,
            question=payload.question,
            top_k=payload.top_k
        )
        return result
    except Exception as e:
        return {"error": str(e)}

class HubSearchRequest(BaseModel):
    query: str
    subject_name: str | None = None
    search_all: bool = False
    top_k: int = 5

@app.post("/knowledge/search")
def search_knowledge_hub_endpoint(payload: HubSearchRequest):
    try:
        from knowledge.query_service import search_knowledge_hub
        result = search_knowledge_hub(
            query=payload.query,
            subject_name=payload.subject_name,
            search_all=payload.search_all,
            top_k=payload.top_k
        )
        return result
    except Exception as e:
        return {"error": str(e)}


class RagRequest(BaseModel):
    question: str

@app.post("/knowledge/rag")
def knowledge_rag(payload: RagRequest):
    try:
        from knowledge.rag_service import run_rag
        result = run_rag(payload.question)
        return result
    except Exception as e:
        return {"error": str(e)}

class ActionRequest(BaseModel):
    action: str

@app.post("/knowledge/subjects/{subject_name}/action")
def run_subject_action(subject_name: str, payload: ActionRequest):
    try:
        from knowledge.actions_service import run_knowledge_action
        result = run_knowledge_action(subject_name, payload.action)
        return result
    except Exception as e:
        return {"error": str(e)}

class GeneratePdfRequest(BaseModel):
    subject: str
    markdown: str

@app.post("/knowledge/generate-pdf")
def download_notes_pdf(payload: GeneratePdfRequest, background_tasks: BackgroundTasks):
    try:
        from knowledge.actions_service import generate_pdf_from_markdown
        import tempfile
        import os
        
        # Create a temp file
        temp_dir = tempfile.gettempdir()
        temp_path = Path(temp_dir) / f"{payload.subject.replace(' ', '_')}_notes.pdf"
        
        generate_pdf_from_markdown(payload.subject, payload.markdown, temp_path)
        
        # Set up a cleanup task to delete the temp file after response is sent
        def cleanup_temp_file(filepath: Path):
            try:
                if filepath.exists():
                    os.remove(str(filepath))
                    print(f"[CLEANUP] Deleted temporary PDF at {filepath}")
            except Exception as e:
                print(f"[CLEANUP] Failed to delete temp PDF: {e}")
                
        background_tasks.add_task(cleanup_temp_file, temp_path)
        
        from fastapi.responses import FileResponse
        return FileResponse(
            path=str(temp_path),
            media_type="application/pdf",
            filename=f"{payload.subject.replace(' ', '_')}_notes.pdf"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}




# -----------------------------
# PDF Chat Endpoints
# -----------------------------

class PdfHistoryRequest(BaseModel):
    subject_name: str
    pdf_name: str

class PdfAskRequest(BaseModel):
    subject_name: str
    pdf_name: str
    question_type: str
    custom_question: str | None = None

@app.get("/pdf-chat/history")
def get_pdf_history(subject_name: str, pdf_name: str):
    """
    Get the chat history for a specific PDF.
    """
    try:
        from services.pdf_chat_service import get_pdf_chat_history
        history = get_pdf_chat_history(subject_name, pdf_name)
        return {"history": history}
    except Exception as e:
        return {"error": str(e)}

@app.post("/pdf-chat/clear")
def clear_pdf_history(payload: PdfHistoryRequest):
    """
    Clear the chat history for a specific PDF.
    """
    try:
        from services.pdf_chat_service import clear_pdf_chat_history
        clear_pdf_chat_history(payload.subject_name, payload.pdf_name)
        return {"message": "Chat history cleared successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/pdf-chat/ask")
def ask_pdf(payload: PdfAskRequest):
    """
    Ask a question or request an action for a specific PDF.
    """
    print("[CHAT] Message Received")
    try:
        from services.pdf_chat_service import ask_pdf_question
        response = ask_pdf_question(
            payload.subject_name,
            payload.pdf_name,
            payload.question_type,
            payload.custom_question
        )
        return {"response": response}
    except FileNotFoundError as e:
        return {"error": str(e)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to process request: {str(e)}"}


# -----------------------------
# Exam Planner & Smart Alerts Endpoints
# -----------------------------

class ExamPayload(BaseModel):
    subject_id: int
    exam_date: str
    topics_count: int
    difficulty: str
    notes: str | None = None

class ExamCompletePayload(BaseModel):
    is_completed: int

@app.get("/exams")
def get_exams():
    """
    Get all exams.
    """
    try:
        from services.exam_service import get_all_exams
        return get_all_exams()
    except Exception as e:
        return {"error": str(e)}

@app.post("/exams")
def create_exam(payload: ExamPayload):
    """
    Create a new exam.
    """
    try:
        from services.exam_service import add_exam_to_db
        res = add_exam_to_db(
            payload.subject_id,
            payload.exam_date,
            payload.topics_count,
            payload.difficulty,
            payload.notes or ""
        )
        try:
            clear_history()
        except Exception:
            pass
        return res
    except Exception as e:
        return {"error": str(e)}

@app.put("/exams/{exam_id}")
def edit_exam(exam_id: int, payload: ExamPayload):
    """
    Edit an existing exam.
    """
    try:
        from services.exam_service import update_exam_in_db
        res = update_exam_in_db(
            exam_id,
            payload.subject_id,
            payload.exam_date,
            payload.topics_count,
            payload.difficulty,
            payload.notes or ""
        )
        try:
            clear_history()
        except Exception:
            pass
        return res
    except Exception as e:
        return {"error": str(e)}

@app.delete("/exams/{exam_id}")
def remove_exam(exam_id: int):
    """
    Delete an exam.
    """
    try:
        from services.exam_service import delete_exam_from_db
        res = delete_exam_from_db(exam_id)
        try:
            clear_history()
        except Exception:
            pass
        return res
    except Exception as e:
        return {"error": str(e)}

@app.post("/exams/{exam_id}/complete")
def complete_exam(exam_id: int, payload: ExamCompletePayload):
    """
    Mark an exam as complete or incomplete.
    """
    try:
        from services.exam_service import mark_exam_completed_in_db
        res = mark_exam_completed_in_db(exam_id, payload.is_completed)
        try:
            clear_history()
        except Exception:
            pass
        return res
    except Exception as e:
        return {"error": str(e)}

@app.post("/exams/{exam_id}/study-plan")
def get_exam_study_plan(exam_id: int):
    """
    Generate study schedule for an exam using AI.
    """
    try:
        from services.exam_service import generate_study_plan
        plan = generate_study_plan(exam_id)
        return {"study_plan": plan}
    except Exception as e:
        return {"error": str(e)}

@app.get("/dashboard/smart-alerts")
def fetch_smart_alerts():
    """
    Fetch all alerts for attendance, assignments, and exams.
    """
    try:
        from services.notification_service import get_smart_alerts
        return get_smart_alerts()
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    import socket

    # Dynamically log the correct local machine IP address for LAN access
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        detected_ip = s.getsockname()[0]
    except Exception:
        detected_ip = '127.0.0.1'
    finally:
        s.close()

    print(f"\n" + "="*60)
    print(f" Starting MBA Copilot Backend Server...")
    print(f" - Local Loopback: http://127.0.0.1:8000")
    print(f" - LAN Access IP:  http://{detected_ip}:8000")
    print(f" - API Docs:       http://{detected_ip}:8000/docs")
    print("="*60 + "\n")

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

