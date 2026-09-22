# MBA Copilot

An intelligent, AI-powered personal academic assistant for MBA students. **MBA Copilot** unifies course management, smart study tools, document retrieval (RAG), PDF interaction, attendance tracking, and exam planning into a seamless dashboard.

---

## Key Features

- **Course & Subject Management**: Manage subjects, credit values, terms, and course materials.
- **Knowledge Hub & RAG**: Upload course syllabus PDFs and lecture notes; automatically chunk, extract embeddings using OpenAI, and index via FAISS for fast contextual retrieval.
- **Interactive PDF Chat**: Upload PDFs per subject and engage in interactive AI chat with full document context.
- **Tool-Enhanced AI Assistant**: Integrated agentic copilot with custom action tools (attendance insights, event parser, calculator, memory persistence, time tools).
- **Interactive Dashboard**: Real-time stats overview, attendance risk alerts, upcoming assignment reminders, and upcoming exam countdowns.
- **Calendar & Assignment Tracker**: Schedule exams, project deadlines, and classes with full CRUD functionality.
- **Attendance Analytics**: Track class attendance history, target percentages (e.g. 75%+ threshold), and generate automated attendance insights.
- **Provider & Settings Router**: Dynamically configure cloud LLM providers (Groq, OpenAI, Claude, OpenRouter) and customize UI themes (Dark/Light) and font scaling.

---

## Technology Stack

- **Backend**: Python, FastAPI, SQLite3, FAISS Vector Indexing, PyMuPDF (fitz), Uvicorn.
- **AI & RAG Engine**: Groq API (`llama-3.3-70b-versatile`), OpenAI Embeddings (`text-embedding-3-small`), Custom Tool Selector & Agentic Planner.
- **Frontend**: React 19, Vite, CSS, Context API, Lucide Icons, `react-markdown` with `remark-gfm`.

---

## Project Structure

```
MBA-Copilot/
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusion rules
├── package.json              # Root npm workspace delegate
├── package-lock.json
├── requirements.txt          # Python backend dependency manifest
├── README.md                 # Project documentation & setup guide
│
├── backend/
│   ├── app.py                # Main FastAPI application entrypoint & API routes
│   ├── database.py           # SQLite database schema, connections & migrations
│   ├── llm_router.py         # Unified LLM provider routing (Groq / OpenAI)
│   ├── agentic_bridge.py     # Dynamic agentic system connector
│   ├── settings.json         # Default app settings template (sanitized)
│   ├── knowledge/            # RAG engine (FAISS store, chunker, embeddings, retriever)
│   └── services/             # Core domain services (attendance, calendar, pdf, exams)
│
├── agentic/
│   ├── agent.py              # Tool-enhanced agent execution loop
│   ├── planner.py            # Natural language parser & plan generator
│   └── tools/                # 11+ specialized tools (attendance, events, web search, memory)
│
├── frontend/
│   ├── public/               # Favicon & SVG icons
│   ├── src/                  # React App, Pages, Components, Services, & Context
│   │   ├── components/       # Reusable UI elements (Sidebar, AIAssistant)
│   │   ├── pages/            # Page views (Dashboard, Subjects, KnowledgeHub, PdfChat, etc.)
│   │   ├── context/          # State providers (FocusTimerContext)
│   │   └── services/         # API integration services (agentService, config)
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── database/                 # SQLite database & sample RAG vector index
│   └── knowledge/            # Sample FAISS index (Managerial_Economics)
│
├── tests/                    # Integration test suite
│   ├── test_api.py
│   ├── test_agent_actions.py
│   ├── test_rag_chat.py
│   └── test_dashboard_intelligence.py
│
└── docs/                     # System architecture & developer specifications
```

---

## Getting Started

### Prerequisites

- **Python**: 3.10+ installed
- **Node.js**: 18+ and `npm` installed
- **API Keys**: Groq API Key (for LLM chat) and OpenAI API Key (for document embeddings)

---

### 1. Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/MBA-Copilot.git
   cd MBA-Copilot
   ```

2. **Set up a Python Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env` in the root directory and add your API keys:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   ```

5. **Start Backend Server**:
   ```bash
   cd backend
   uvicorn app:app --reload --port 8000
   ```
   The backend API will be available at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).

---

### 2. Frontend Setup

1. Open a new terminal and navigate to the project directory:
   ```bash
   npm run dev
   ```
   *(Or navigate to `frontend` and run `npm run dev` directly)*

2. Access the web application at `http://localhost:5173`.
