import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function KnowledgeHub() {
  const [stats, setStats] = useState({
    total_terms: 0,
    total_subjects: 0,
    total_documents: 0,
    indexed_documents: 0,
    total_chunks: 0,
    recently_uploaded: []
  });

  // Collapsible Terms state
  const [expandedTerms, setExpandedTerms] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  // State for Knowledge Hub Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  // State for Index Health Collapsible
  const [expandedHealth, setExpandedHealth] = useState({});
  const [healthData, setHealthData] = useState({});
  const [healthLoading, setHealthLoading] = useState({});
  const [prevHasIndexing, setPrevHasIndexing] = useState(false);

  // State for Hub Search
  const [hubSearchQuery, setHubSearchQuery] = useState("");
  const [hubSearchSubject, setHubSearchSubject] = useState("");
  const [hubSearchResults, setHubSearchResults] = useState(null);
  const [hubSearchLoading, setHubSearchLoading] = useState(false);
  const [hubSearchError, setHubSearchError] = useState(null);
  const [hubSearchLogs, setHubSearchLogs] = useState([]);
  const [hubSearchDocFilter, setHubSearchDocFilter] = useState("");
  const [selectedSearchItem, setSelectedSearchItem] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const highlightText = (text, query) => {
    if (!text) return "";
    if (!query || !query.trim()) return text;

    const words = query
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) return text;

    const escapedWords = words.map((w) => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex = new RegExp(`\\b(${escapedWords.join("|")})\\b`, "gi");

    const parts = text.split(regex);
    return parts.map((part, index) => {
      const isMatch = words.includes(part.toLowerCase());
      return isMatch ? (
        <mark
          key={index}
          style={{
            backgroundColor: "rgba(251, 191, 36, 0.3)",
            color: "#fbbf24",
            borderRadius: "3px",
            padding: "2px 4px",
            margin: "0 1px",
            fontWeight: "600",
            border: "1px solid rgba(251, 191, 36, 0.5)",
          }}
        >
          {part}
        </mark>
      ) : (
        part
      );
    });
  };

  const handleHubSearch = async (searchAll = false) => {
    if (!hubSearchQuery.trim()) {
      setHubSearchError("Please enter a search term.");
      return;
    }
    if (!searchAll && !hubSearchSubject) {
      setHubSearchError("Please select a subject to search.");
      return;
    }

    setHubSearchLoading(true);
    setHubSearchError(null);
    setHubSearchResults(null);
    setHubSearchLogs([]);
    setHubSearchDocFilter("");

    try {
      const response = await fetch("http://127.0.0.1:8000/knowledge/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: hubSearchQuery.trim(),
          subject_name: searchAll ? null : hubSearchSubject,
          search_all: searchAll,
          top_k: 10
        })
      });
      const data = await response.json();
      if (data.error) {
        setHubSearchError(data.error);
      } else {
        setHubSearchResults(data.results || []);
        setHubSearchLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to run hub search:", err);
      setHubSearchError("Failed to connect to the backend server.");
    } finally {
      setHubSearchLoading(false);
    }
  };


  // Initial load
  useEffect(() => {
    fetchData(false);
  }, []);

  // Polling load (silent) when there is active indexing
  useEffect(() => {
    const anyIndexing = subjects.some(s => s.status === "Indexing") || 
                        (stats.recently_uploaded && stats.recently_uploaded.some(d => d.indexed === 2));
    if (prevHasIndexing && !anyIndexing) {
      console.log("[KnowledgeHub] Indexing completed, dispatching event");
      window.dispatchEvent(new CustomEvent("mba-indexing-complete"));
      window.dispatchEvent(new CustomEvent("mba-subject-update"));
    }
    setPrevHasIndexing(anyIndexing);
  }, [subjects, stats, prevHasIndexing]);

  useEffect(() => {
    const anyIndexing = subjects.some(s => s.status === "Indexing") || 
                        (stats.recently_uploaded && stats.recently_uploaded.some(d => d.indexed === 2));
                        
    if (!anyIndexing) return;
    
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [subjects, stats]);


  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      
      const statsRes = await fetch("http://127.0.0.1:8000/knowledge/stats");
      const statsData = await statsRes.json();
      
      const subjectsRes = await fetch("http://127.0.0.1:8000/knowledge/subjects");
      const subjectsData = await subjectsRes.json();

      const termsRes = await fetch("http://127.0.0.1:8000/terms");
      const termsData = await termsRes.json();

      if (statsData.error || subjectsData.error || termsData.error) {
        if (!isSilent) setError(statsData.error || subjectsData.error || termsData.error);
      } else {
        setStats(statsData);
        setSubjects(subjectsData);
        setTerms(termsData);
        if (subjectsData.length > 0) {
          setHubSearchSubject((prev) => prev || subjectsData[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load Knowledge Hub data:", err);
      if (!isSilent) setError("Failed to connect to the backend server.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };



  const handleTriggerAction = async (subjectName, actionType) => {
    setActionLoading(true);
    setActionError(null);
    setActionResult(null);

    // Scroll to action results container
    setTimeout(() => {
      const element = document.getElementById("knowledge-action-results-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);

    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: actionType
        })
      });
      const data = await response.json();
      if (data.error) {
        setActionError(data.error);
      } else {
        setActionResult(data);
      }
    } catch (err) {
      console.error("Failed to run knowledge action:", err);
      setActionError("Failed to connect to the backend server.");
    } finally {
      setActionLoading(false);
      // Scroll to result view again to ensure it's centered
      setTimeout(() => {
        const element = document.getElementById("knowledge-action-results-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  const handleViewDoc = (subjectName, filename) => {
    const url = `http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}/view`;
    window.open(url, "_blank");
  };

  const handleReindexDoc = async (subjectName, filename) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}/reindex`, {
        method: "POST"
      });
      const data = await response.json();
      if (data.error) {
        alert("Error reindexing: " + data.error);
      } else {
        alert("Reindexing started for " + filename);
        fetchData(true);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to backend for reindexing.");
    }
  };

  const handleReplaceDoc = async (subjectName, filename, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}/replace`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data.error) {
        alert("Error replacing document: " + data.error);
      } else {
        alert(`Successfully replaced document. Reindexing started.`);
        fetchData(true);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to replace document.");
    }
  };

  const handleDeleteDoc = async (subjectName, filename) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${filename}"? This will permanently remove the file, metadata, and all its FAISS index vectors.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.error) {
        alert("Error deleting document: " + data.error);
      } else {
        alert("Document deleted successfully.");
        fetchData(true);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete document.");
    }
  };

  const handleRenameDoc = async (subjectName, filename) => {
    const newName = window.prompt("Enter new filename for " + filename + ":", filename);
    if (!newName || newName.trim() === "" || newName.trim() === filename) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_filename: newName.trim() })
      });
      const data = await response.json();
      if (data.error) {
        alert("Error renaming document: " + data.error);
      } else {
        alert("Document renamed successfully.");
        fetchData(true);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to rename document.");
    }
  };

  const handleMoveDoc = async (subjectName, filename) => {
    const targetSubject = window.prompt(
      `Enter target subject name to move "${filename}" to (Available subjects: ${subjects.map(s => s.name).join(", ")}):`
    );
    if (!targetSubject || targetSubject.trim() === "" || targetSubject.trim() === subjectName) return;

    const matched = subjects.find(s => s.name.toLowerCase() === targetSubject.trim().toLowerCase());
    if (!matched) {
      alert(`Target subject "${targetSubject}" does not exist. Please enter a valid subject name.`);
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_subject_name: matched.name })
      });
      const data = await response.json();
      if (data.error) {
        alert("Error moving document: " + data.error);
      } else {
        alert(`Successfully moved document to "${matched.name}".`);
        fetchData(true);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to move document.");
    }
  };

  const toggleHealth = async (subjectName, subjectId) => {
    const isExpanding = !expandedHealth[subjectId];
    setExpandedHealth(prev => ({ ...prev, [subjectId]: isExpanding }));
    
    if (isExpanding && !healthData[subjectName]) {
      setHealthLoading(prev => ({ ...prev, [subjectId]: true }));
      try {
        const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/health`);
        const data = await response.json();
        setHealthData(prev => ({ ...prev, [subjectName]: data }));
      } catch (err) {
        console.error(err);
      } finally {
        setHealthLoading(prev => ({ ...prev, [subjectId]: false }));
      }
    }
  };

  const handleRepairIndex = async (subjectName, subjectId) => {
    const confirmed = window.confirm(`Are you sure you want to run Index Repair for "${subjectName}"? This will deduplicate chunks, remove missing PDF references, and rebuild the FAISS index.`);
    if (!confirmed) return;
    
    setHealthLoading(prev => ({ ...prev, [subjectId]: true }));
    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/repair`, {
        method: "POST"
      });
      const data = await response.json();
      if (data.error) {
        alert("Error repairing index: " + data.error);
      } else {
        alert("Index repair completed successfully: " + data.message);
        // Refresh health data
        const healthRes = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/health`);
        const healthD = await healthRes.json();
        setHealthData(prev => ({ ...prev, [subjectName]: healthD }));
        // Refresh aggregate stats and subjects list
        fetchData(true);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to repair index.");
    } finally {
      setHealthLoading(prev => ({ ...prev, [subjectId]: false }));
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "Unknown Date";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="saas-container">
        <div className="saas-wrapper" style={{ justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
          <div className="saas-card" style={{ textAlign: "center", padding: "40px", maxWidth: "400px" }}>
            <div style={{
              width: "40px", height: "40px", border: "4px solid rgba(168, 85, 247, 0.1)",
              borderTopColor: "#a855f7", borderRadius: "50%",
              animation: "spin 1s linear infinite", margin: "0 auto 20px auto"
            }} />
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Loading Knowledge Hub...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saas-container">
        <div className="saas-wrapper" style={{ justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
          <div className="saas-card" style={{ textAlign: "center", padding: "40px", maxWidth: "400px", borderColor: "rgba(239, 68, 68, 0.3)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ margin: "0 0 10px 0", fontSize: "1.5rem", color: "#ef4444" }}>Error Loading Knowledge Hub</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>{error}</p>
            <button 
              onClick={() => fetchData(false)} 
              className="saas-button saas-button-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const healthPercent = stats.total_documents > 0 
    ? Math.round((stats.indexed_documents / stats.total_documents) * 100) 
    : 100;

  return (
    <div className="saas-container">
      <div className="saas-wrapper">
        <style>{`
          .sub-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
          }
          .subject-hub-card {
            transition: all 0.2s ease;
          }
          .subject-hub-card:hover {
            border-color: rgba(168, 85, 247, 0.35);
            transform: translateY(-2px);
          }
          .badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            display: inline-block;
            width: fit-content;
          }
          .badge-indexed {
            background-color: rgba(16, 185, 129, 0.15);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.3);
          }
          .badge-indexing {
            background-color: rgba(245, 158, 11, 0.15);
            color: #f59e0b;
            border: 1px solid rgba(245, 158, 11, 0.3);
          }
          .badge-not-indexed {
            background-color: rgba(156, 163, 175, 0.15);
            color: #9ca3af;
            border: 1px solid rgba(156, 163, 175, 0.3);
          }
          .badge-missing {
            background-color: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
          }
          .badge-repair {
            background-color: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
          }
          .badge-reindex {
            background-color: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
          }
          .retrieval-logs-box {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 16px;
            font-family: monospace;
            font-size: 13px;
            color: #a7f3d0;
            margin-top: 15px;
            white-space: pre-wrap;
            line-height: 1.5;
          }
          .chunk-result-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13px;
            color: var(--text-secondary);
          }
          .chunk-result-text {
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.02);
            padding: 10px;
            border-radius: 6px;
            border-left: 3px solid #8b5cf6;
          }
          .rag-answer-box {
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .rag-answer-title {
            font-size: 15px;
            font-weight: 700;
            color: #60a5fa;
            margin-top: 0;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .rag-answer-text {
            font-size: 15px;
            line-height: 1.6;
            color: var(--text-primary);
            white-space: pre-wrap;
          }
          .action-btn:hover {
            filter: brightness(1.25);
            transform: translateY(-1px);
          }
          .action-btn:active {
            transform: translateY(0);
          }
          .action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(1);
            transform: none;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* ReactMarkdown formatting */
          .pdf-markdown-container {
            word-break: break-word;
          }
          .pdf-markdown-container h1,
          .pdf-markdown-container h2,
          .pdf-markdown-container h3,
          .pdf-markdown-container h4 {
            color: #ffffff;
            font-weight: 700;
            margin-top: 18px;
            margin-bottom: 10px;
            line-height: 1.4;
          }
          .pdf-markdown-container h1:first-child,
          .pdf-markdown-container h2:first-child,
          .pdf-markdown-container h3:first-child,
          .pdf-markdown-container h4:first-child {
            margin-top: 0;
          }
          .pdf-markdown-container h1 {
            font-size: 1.6rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            padding-bottom: 6px;
          }
          .pdf-markdown-container h2 {
            font-size: 1.35rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 4px;
          }
          .pdf-markdown-container h3 {
            font-size: 1.15rem;
          }
          
          .pdf-markdown-container p {
            margin-top: 0;
            margin-bottom: 10px;
            line-height: 1.5;
          }

          .pdf-markdown-container ul,
          .pdf-markdown-container ol {
            margin-top: 4px;
            margin-bottom: 10px;
            padding-left: 20px;
          }
          .pdf-markdown-container ul {
            list-style-type: disc;
          }
          .pdf-markdown-container ol {
            list-style-type: decimal;
          }
          .pdf-markdown-container li {
            margin-bottom: 4px;
            line-height: 1.5;
          }

          .pdf-markdown-container code {
            font-family: ui-monospace, Consolas, monospace;
            font-size: 0.85em;
            background-color: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 2px 4px;
            border-radius: 4px;
            color: #f472b6;
          }
          .pdf-markdown-container pre {
            background-color: #0b0f19;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            overflow-x: auto;
            margin: 12px 0;
          }
          .pdf-markdown-container pre code {
            background-color: transparent;
            border: none;
            padding: 0;
            color: #cbd5e1;
            font-size: 0.85rem;
          }

          .pdf-markdown-container table {
            display: block;
            width: 100%;
            overflow-x: auto;
            border-collapse: separate;
            border-spacing: 0;
            margin: 14px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background-color: #0f172a;
          }
          .pdf-markdown-container th,
          .pdf-markdown-container td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 0.88rem;
          }
          .pdf-markdown-container th:last-child,
          .pdf-markdown-container td:last-child {
            border-right: none;
          }
          .pdf-markdown-container th {
            background-color: #1e293b;
            color: #ffffff;
            font-weight: 700;
          }
          .pdf-markdown-container tr:last-child td {
            border-bottom: none;
          }
          .pdf-markdown-container tr:nth-child(even) {
            background-color: rgba(255, 255, 255, 0.02);
          }
        `}</style>

        {/* Header */}
        <div className="saas-header">
          <h1 className="saas-title">🧠 Knowledge Hub</h1>
          <p className="saas-subtitle">
            Manage study materials, indexing and AI-powered learning tools.
          </p>
        </div>

        {/* Aggregate Stats Cards */}
        <div className="saas-stats-grid">
          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🗓️</div>
            <div className="saas-stat-label">Total Terms</div>
            <div className="saas-stat-value" style={{ color: "#3b82f6" }}>{stats.total_terms || 0}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">📚</div>
            <div className="saas-stat-label">Total Subjects</div>
            <div className="saas-stat-value" style={{ color: "#ec4899" }}>{stats.total_subjects || 0}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">📄</div>
            <div className="saas-stat-label">Total Documents</div>
            <div className="saas-stat-value" style={{ color: "#10b981" }}>{stats.total_documents || 0}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🟢</div>
            <div className="saas-stat-label">Indexed Documents</div>
            <div className="saas-stat-value" style={{ color: "#10b981" }}>{stats.indexed_documents || 0}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🧬</div>
            <div className="saas-stat-label">Total Chunks</div>
            <div className="saas-stat-value" style={{ color: "#8b5cf6" }}>{stats.total_chunks || 0}</div>
          </div>
        </div>

        {/* Search Knowledge Base Section */}
        <div className="saas-card">
          <h2 style={{ fontSize: "20px", fontWeight: "bold", marginTop: 0, marginBottom: "8px", color: "var(--text-primary)" }}>
            Search Knowledge Base 🔍
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: 0, marginBottom: "16px" }}>
            Query your knowledge base directly to find relevant chunks across indexed PDFs.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "800px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "250px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="saas-label" htmlFor="hub-search-input">
                  Search Query
                </label>
                <input
                  id="hub-search-input"
                  type="text"
                  className="saas-input"
                  placeholder="Search topic, keyword, concept..."
                  value={hubSearchQuery}
                  onChange={(e) => setHubSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleHubSearch(false);
                    }
                  }}
                />
              </div>

              <div style={{ width: "200px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="saas-label" htmlFor="hub-search-subject-select">
                  Subject
                </label>
                <select
                  id="hub-search-subject-select"
                  className="saas-input"
                  value={hubSearchSubject}
                  onChange={(e) => setHubSearchSubject(e.target.value)}
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={() => handleHubSearch(false)}
                className="saas-button saas-button-primary"
                disabled={hubSearchLoading || !hubSearchQuery.trim() || !hubSearchSubject}
              >
                {hubSearchLoading ? "Searching..." : "Search Current Subject"}
              </button>
              <button
                onClick={() => handleHubSearch(true)}
                className="saas-button saas-button-secondary"
                disabled={hubSearchLoading || !hubSearchQuery.trim()}
              >
                {hubSearchLoading ? "Searching..." : "Search All Subjects"}
              </button>
            </div>
          </div>

          {hubSearchError && (
            <div style={{ color: "#ef4444", marginTop: "15px", fontSize: "14px", fontWeight: "500" }}>
              ❌ Error: {hubSearchError}
            </div>
          )}

          {/* Search Results Display */}
          {hubSearchResults && (
            <div style={{ marginTop: "30px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "bold", margin: 0 }}>Search Results</h3>
                
                {/* Optional: Filter by document */}
                {hubSearchResults.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label htmlFor="hub-doc-filter" className="saas-label" style={{ marginBottom: 0 }}>
                      Filter by document:
                    </label>
                    <select
                      id="hub-doc-filter"
                      className="saas-input"
                      value={hubSearchDocFilter}
                      onChange={(e) => setHubSearchDocFilter(e.target.value)}
                      style={{ padding: "6px 12px", fontSize: "13px", width: "auto" }}
                    >
                      <option value="">All Documents</option>
                      {[...new Set(hubSearchResults.map(r => r.filename))].map(fname => (
                        <option key={fname} value={fname}>{fname}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Displaying matching chunks */}
              {(() => {
                const filteredResults = hubSearchDocFilter 
                  ? hubSearchResults.filter(r => r.filename === hubSearchDocFilter)
                  : hubSearchResults;

                if (filteredResults.length === 0) {
                  return <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No matching results found.</p>;
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {filteredResults.map((result, idx) => (
                      <div 
                        className="saas-card" 
                        key={idx}
                        onClick={() => {
                          setSelectedSearchItem(result);
                          setShowSearchModal(true);
                        }}
                        style={{ 
                          cursor: "pointer", 
                          padding: "16px",
                          background: "rgba(15, 23, 42, 0.35)",
                          borderColor: "rgba(255, 255, 255, 0.06)",
                          gap: "8px"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(168, 85, 247, 0.35)";
                          e.currentTarget.style.background = "rgba(15, 23, 42, 0.55)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                          e.currentTarget.style.background = "rgba(15, 23, 42, 0.35)";
                        }}
                      >
                        <div className="chunk-result-header" style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                          <span>
                            Subject: <strong style={{ color: "#a855f7" }}>{result.subject}</strong> | Document: <strong style={{ color: "var(--text-primary)" }}>{result.filename}</strong>
                          </span>
                          <span>
                            Similarity: <strong style={{ color: result.similarity > 0.8 ? "#10b981" : "#f59e0b" }}>{result.similarity}</strong>
                          </span>
                        </div>
                        <div className="chunk-result-text" style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--text-primary)", background: "rgba(255, 255, 255, 0.02)", padding: "12px", borderRadius: "6px", borderLeft: "3px solid #8b5cf6" }}>
                          {highlightText(result.text, hubSearchQuery)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Logs Output */}
              {hubSearchLogs && hubSearchLogs.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>Search Logs:</h4>
                  <div className="retrieval-logs-box">
                    {hubSearchLogs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subject Summary Section */}
        <div className="saas-card">
          <h2 style={{ fontSize: "20px", fontWeight: "bold", marginTop: 0, marginBottom: "20px", color: "var(--text-primary)" }}>
            Subjects Overview
          </h2>
          {terms.length === 0 && subjects.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>No terms or subjects registered yet. Create them in the Subjects tab.</p>
          ) : (() => {
            // Group subjects by Term
            const groupedSubjects = {};
            terms.forEach((t) => {
              groupedSubjects[t.name] = [];
            });

            subjects.forEach((sub) => {
              const termName = sub.term || "No Term";
              if (!groupedSubjects[termName]) {
                groupedSubjects[termName] = [];
              }
              groupedSubjects[termName].push(sub);
            });

            // Sort term names (e.g. Term 1, Term 2, etc.)
            const sortedTermNames = Object.keys(groupedSubjects).sort((a, b) => {
              const numA = parseInt(a.match(/\d+/)?.[0]);
              const numB = parseInt(b.match(/\d+/)?.[0]);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
            });

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {sortedTermNames.map((termName) => {
                  const isExpanded = !!expandedTerms[termName];
                  const termSubjects = groupedSubjects[termName];
                  return (
                    <div key={termName} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "16px" }}>
                      {/* Collapsible Header */}
                      <div
                        onClick={() => setExpandedTerms(prev => ({ ...prev, [termName]: !prev[termName] }))}
                        className="saas-accordion-header"
                        style={{
                          color: isExpanded ? "#a855f7" : "var(--text-primary)",
                          borderColor: isExpanded ? "rgba(168, 85, 247, 0.35)" : "rgba(255, 255, 255, 0.06)",
                          marginBottom: isExpanded ? "16px" : "12px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span style={{ marginRight: "10px", fontSize: "12px", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                            ▶
                          </span>
                          {termName}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" }}>
                          {termSubjects.length} {termSubjects.length === 1 ? "Subject" : "Subjects"}
                        </span>
                      </div>

                      {/* Subject Cards Grid (when expanded) */}
                      {isExpanded && (
                        <div className="saas-accordion-content">
                          <div className="sub-grid" style={{ paddingLeft: "8px", paddingRight: "8px" }}>
                            {termSubjects.length === 0 ? (
                              <div style={{
                                gridColumn: "1 / -1",
                                padding: "20px",
                                textAlign: "center",
                                color: "var(--text-secondary)",
                                background: "rgba(30, 41, 59, 0.2)",
                                borderRadius: "10px",
                                border: "1px dashed rgba(255, 255, 255, 0.1)",
                                fontSize: "14px"
                              }}>
                                No subjects registered in this term.
                              </div>
                            ) : (
                              termSubjects.map((sub) => (
                                <div className="saas-card subject-hub-card" style={{ gap: "12px", padding: "20px" }} key={sub.id}>
                                  <div style={{ fontWeight: "700", fontSize: "16px" }}>{sub.name}</div>
                                  <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                                    Docs: <strong style={{ color: "var(--text-primary)" }}>{sub.document_count}</strong>
                                    {" | "}
                                    Chunks: <strong style={{ color: "var(--text-primary)" }}>{sub.total_chunks}</strong>
                                  </div>
                                  <div>
                                    <span className={`badge ${sub.status === "Indexed" ? "badge-indexed" : sub.status === "Indexing" ? "badge-indexing" : "badge-not-indexed"}`}>
                                      {sub.status === "Indexed" ? "🟢 Indexed" : sub.status === "Indexing" ? "🟡 Indexing" : "Not Indexed"}
                                    </span>
                                  </div>

                                  {/* Index Health Collapsible */}
                                  <div style={{ marginTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "8px" }}>
                                    <div 
                                      onClick={() => toggleHealth(sub.name, sub.id)}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        color: "var(--text-secondary)"
                                      }}
                                    >
                                      <span>Index Health</span>
                                      <span>{expandedHealth[sub.id] ? "▲" : "▼"}</span>
                                    </div>
                                    {expandedHealth[sub.id] && (
                                      <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
                                        {healthLoading[sub.id] ? (
                                          <div>Diagnosing...</div>
                                        ) : (
                                          (() => {
                                            const h = healthData[sub.name];
                                            if (!h) return <div>No diagnostic data.</div>;
                                            
                                            const statusColor = h.status === "Healthy" ? "#10b981" : h.status === "No Index" ? "#9ca3af" : "#ef4444";
                                            return (
                                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                <div>Status: <strong style={{ color: statusColor }}>{h.status}</strong></div>
                                                {h.issues && h.issues.length > 0 ? (
                                                  <div style={{ marginTop: "4px" }}>
                                                    <div style={{ fontWeight: "600", color: "#f87171" }}>Issues:</div>
                                                    <ul style={{ paddingLeft: "15px", margin: "2px 0", color: "#fca5a5" }}>
                                                      {h.issues.map((iss, i) => (
                                                        <li key={i}>{iss}</li>
                                                      ))}
                                                    </ul>
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); handleRepairIndex(sub.name, sub.id); }}
                                                      className="saas-button saas-button-secondary"
                                                      style={{
                                                        marginTop: "6px",
                                                        padding: "4px 8px",
                                                        fontSize: "11px",
                                                        background: "rgba(239, 68, 68, 0.2)",
                                                        color: "#f87171",
                                                        border: "1px solid rgba(239, 68, 68, 0.4)",
                                                        borderRadius: "4px",
                                                        fontWeight: "bold"
                                                      }}
                                                    >
                                                      🔧 Repair Index
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div style={{ color: "#34d399", marginTop: "4px" }}>✓ Index is clean.</div>
                                                )}
                                              </div>
                                            );
                                          })()
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
                                    <button
                                      onClick={() => handleTriggerAction(sub.name, "notes")}
                                      disabled={sub.status !== "Indexed" || sub.total_chunks === 0 || actionLoading}
                                      className="saas-button saas-button-secondary action-btn"
                                      title="Generate Notes"
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        borderRadius: "6px",
                                        borderColor: "rgba(59, 130, 246, 0.3)",
                                        background: "rgba(59, 130, 246, 0.1)",
                                        color: "#60a5fa"
                                      }}
                                    >
                                      📝 Notes
                                    </button>
                                    <button
                                      onClick={() => handleTriggerAction(sub.name, "mcqs")}
                                      disabled={sub.status !== "Indexed" || sub.total_chunks === 0 || actionLoading}
                                      className="saas-button saas-button-secondary action-btn"
                                      title="Generate MCQs"
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        borderRadius: "6px",
                                        borderColor: "rgba(16, 185, 129, 0.3)",
                                        background: "rgba(16, 185, 129, 0.1)",
                                        color: "#34d399"
                                      }}
                                    >
                                      🎯 MCQs
                                    </button>
                                    <button
                                      onClick={() => handleTriggerAction(sub.name, "flashcards")}
                                      disabled={sub.status !== "Indexed" || sub.total_chunks === 0 || actionLoading}
                                      className="saas-button saas-button-secondary action-btn"
                                      title="Generate Flashcards"
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        borderRadius: "6px",
                                        borderColor: "rgba(139, 92, 246, 0.3)",
                                        background: "rgba(139, 92, 246, 0.1)",
                                        color: "#a78bfa"
                                      }}
                                    >
                                      🧠 Flashcards
                                    </button>
                                    <button
                                      onClick={() => handleTriggerAction(sub.name, "viva")}
                                      disabled={sub.status !== "Indexed" || sub.total_chunks === 0 || actionLoading}
                                      className="saas-button saas-button-secondary action-btn"
                                      title="Generate Viva Questions"
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        borderRadius: "6px",
                                        borderColor: "rgba(245, 158, 11, 0.3)",
                                        background: "rgba(245, 158, 11, 0.1)",
                                        color: "#fbbf24"
                                      }}
                                    >
                                      🎤 Viva
                                    </button>
                                    <button
                                      onClick={() => handleTriggerAction(sub.name, "revision")}
                                      disabled={sub.status !== "Indexed" || sub.total_chunks === 0 || actionLoading}
                                      className="saas-button saas-button-secondary action-btn"
                                      title="Generate Revision Sheet"
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        borderRadius: "6px",
                                        borderColor: "rgba(236, 72, 153, 0.3)",
                                        background: "rgba(236, 72, 153, 0.1)",
                                        color: "#f472b6"
                                      }}
                                    >
                                      📚 Revision
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Generated Study Materials / Actions Output Section */}
        {(actionLoading || actionError || actionResult) && (
          <div id="knowledge-action-results-section" className="saas-card" style={{
            marginTop: "30px",
            marginBottom: "30px",
            border: actionError ? "1px solid #ef4444" : "1px solid rgba(168, 85, 247, 0.3)",
            background: actionError ? "rgba(127, 29, 29, 0.1)" : "linear-gradient(135deg, rgba(30, 41, 59, 0.55) 0%, rgba(15, 23, 42, 0.7) 100%)",
            boxShadow: actionError ? "none" : "0 8px 32px 0 rgba(168, 85, 247, 0.15)",
            position: "relative"
          }}>
            {/* Close button */}
            <button 
              onClick={() => {
                setActionResult(null);
                setActionError(null);
                setActionLoading(false);
              }}
              className="saas-button saas-button-secondary"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                padding: 0,
                color: "var(--text-secondary)"
              }}
            >
              ✕
            </button>

            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "bold", 
              marginTop: 0, 
              marginBottom: "16px", 
              color: actionError ? "#ef4444" : "#a855f7",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              {actionLoading ? "⌛ Generating Study Materials..." : actionError ? "❌ Action Failed" : `📚 Generated ${actionResult.action.toUpperCase()} for ${actionResult.subject}`}
            </h2>

            {actionLoading && (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "15px" }}>⌛</div>
                <p>Analyzing subject chunks and generating content...</p>
                <div style={{ display: "inline-block", width: "40px", height: "40px", border: "4px solid rgba(168, 85, 247, 0.1)", borderTop: "4px solid #a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
              </div>
            )}

            {actionError && (
              <div style={{ color: "#ef4444", fontSize: "15px", fontWeight: "500", padding: "10px 0" }}>
                {actionError}
              </div>
            )}

            {actionResult && (
              <div>
                {/* Logs */}
                {actionResult.logs && actionResult.logs.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>Pipeline Logs:</h4>
                    <div className="retrieval-logs-box" style={{ color: "#c084fc", background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(168, 85, 247, 0.2)" }}>
                      {actionResult.logs.map((log, idx) => (
                        <div key={idx}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Utility actions */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(actionResult.result);
                      alert("Markdown copied to clipboard!");
                    }}
                    className="saas-button saas-button-primary"
                  >
                    📋 Copy Markdown
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([actionResult.result], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${actionResult.subject.replace(/\s+/g, "_")}_${actionResult.action}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="saas-button saas-button-secondary"
                  >
                    📥 Download Markdown
                  </button>
                </div>

                {/* Generated Content Rendering */}
                <div className="pdf-markdown-container" style={{
                  background: "rgba(15, 23, 42, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "10px",
                  padding: "24px",
                  maxHeight: "600px",
                  overflowY: "auto"
                }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {actionResult.result}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recently Uploaded Section */}
        <div className="saas-card" style={{ marginBottom: 0 }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", marginTop: 0, marginBottom: "16px", color: "var(--text-primary)" }}>
            Recently Uploaded Documents
          </h2>
          {stats.recently_uploaded.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>No documents uploaded yet. Upload documents on Subject detail cards.</p>
          ) : (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Subject</th>
                    <th>Uploaded At</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recently_uploaded.map((doc, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: "500" }}>{doc.filename.replace(/^\d{8}_\d{6}_/, "")}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{doc.subject_name}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{formatDate(doc.uploaded_at)}</td>
                      <td>
                        {(() => {
                          const valStatus = doc.validation_status || (doc.indexed === 1 ? "Indexed" : doc.indexed === 2 ? "Indexing" : "Not Indexed");
                          const badgeClass = valStatus === "Indexed" ? "badge-indexed" : valStatus === "Indexing" ? "badge-indexing" : valStatus === "Document Missing" ? "badge-missing" : valStatus === "Repair Required" ? "badge-repair" : valStatus === "Reindex Required" ? "badge-reindex" : "badge-not-indexed";
                          const badgeLabel = valStatus === "Indexed" ? "🟢 Indexed" : valStatus === "Indexing" ? "🟡 Indexing" : valStatus === "Document Missing" ? "❌ Missing" : valStatus === "Repair Required" ? "⚠️ Repair" : valStatus === "Reindex Required" ? "🔁 Reindex" : "Not Indexed";
                          return <span className={`badge ${badgeClass}`}>{badgeLabel}</span>;
                        })()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                          <button
                            onClick={() => handleViewDoc(doc.subject_name, doc.filename)}
                            className="saas-button saas-button-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "rgba(59, 130, 246, 0.15)",
                              color: "#60a5fa",
                              borderColor: "rgba(59, 130, 246, 0.3)",
                              fontWeight: "bold"
                            }}
                          >
                            📄 View
                          </button>
                          <button
                            onClick={() => handleRenameDoc(doc.subject_name, doc.filename)}
                            className="saas-button saas-button-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "rgba(167, 139, 250, 0.15)",
                              color: "#c084fc",
                              borderColor: "rgba(167, 139, 250, 0.3)",
                              fontWeight: "bold"
                            }}
                          >
                            ✏️ Rename
                          </button>
                          <button
                            onClick={() => handleMoveDoc(doc.subject_name, doc.filename)}
                            className="saas-button saas-button-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "rgba(236, 72, 153, 0.15)",
                              color: "#f472b6",
                              borderColor: "rgba(236, 72, 153, 0.3)",
                              fontWeight: "bold"
                            }}
                          >
                            📦 Move
                          </button>
                          <button
                            onClick={() => handleReindexDoc(doc.subject_name, doc.filename)}
                            className="saas-button saas-button-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              borderColor: "rgba(16, 185, 129, 0.3)",
                              fontWeight: "bold"
                            }}
                          >
                            🔄 Reindex
                          </button>
                          <label
                            className="saas-button saas-button-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#fbbf24",
                              borderColor: "rgba(245, 158, 11, 0.3)",
                              fontWeight: "bold",
                              margin: 0
                            }}
                          >
                            🔄 Replace
                            <input
                              type="file"
                              accept=".pdf"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleReplaceDoc(doc.subject_name, doc.filename, file);
                                }
                              }}
                            />
                          </label>
                          <button
                            onClick={() => handleDeleteDoc(doc.subject_name, doc.filename)}
                            className="saas-button saas-button-danger"
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              fontWeight: "bold"
                            }}
                          >
                            🗑 Delete
                          </button>
                          {/* Remove Entry for Missing docs (Case 3) */}
                          {(() => {
                            const valStatus = doc.validation_status || (doc.indexed === 1 ? "Indexed" : doc.indexed === 2 ? "Indexing" : "Not Indexed");
                            if (valStatus === "Document Missing") {
                              return (
                                <button
                                  onClick={() => handleDeleteDoc(doc.subject_name, doc.filename)}
                                  className="saas-button saas-button-danger"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    fontWeight: "bold"
                                  }}
                                >
                                  🗑️ Remove Entry
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


      </div>

      {/* Search Result Detail Modal */}
      {showSearchModal && selectedSearchItem && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          backdropFilter: "blur(8px)"
        }}>
          <div className="saas-card" style={{
            width: "90%",
            maxWidth: "700px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            position: "relative",
            maxHeight: "85vh",
            overflowY: "auto"
          }}>
            <button 
              onClick={() => {
                setShowSearchModal(false);
                setSelectedSearchItem(null);
              }}
              className="saas-button saas-button-secondary"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                padding: 0,
                color: "var(--text-secondary)"
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: "20px", fontWeight: "bold", marginTop: 0, marginBottom: "20px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "12px", color: "#a855f7" }}>
              Search Result Details
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--text-secondary)", minWidth: "120px", fontWeight: "600" }}>Source Subject:</span>
                <span style={{ color: "var(--text-primary)" }}>{selectedSearchItem.subject}</span>
              </div>
              <div style={{ display: "flex", gap: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--text-secondary)", minWidth: "120px", fontWeight: "600" }}>Document Name:</span>
                <span style={{ color: "#34d399", fontWeight: "500" }}>{selectedSearchItem.filename}</span>
              </div>
              <div style={{ display: "flex", gap: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--text-secondary)", minWidth: "120px", fontWeight: "600" }}>Similarity Score:</span>
                <span style={{ color: selectedSearchItem.similarity > 0.8 ? "#10b981" : "#f59e0b", fontWeight: "bold" }}>
                  {selectedSearchItem.similarity}
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--text-secondary)", minWidth: "120px", fontWeight: "600" }}>Chunk Number:</span>
                <span style={{ color: "var(--text-primary)" }}>{selectedSearchItem.chunk_number}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Chunk Text:</span>
              <div style={{ 
                fontSize: "14.5px", 
                lineHeight: "1.6", 
                color: "var(--text-primary)", 
                background: "rgba(255, 255, 255, 0.02)", 
                padding: "16px", 
                borderRadius: "8px", 
                borderLeft: "4px solid #a855f7",
                whiteSpace: "pre-wrap",
                maxHeight: "350px",
                overflowY: "auto"
              }}>
                {highlightText(selectedSearchItem.text, hubSearchQuery)}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
              <button 
                onClick={() => {
                  setShowSearchModal(false);
                  setSelectedSearchItem(null);
                }}
                className="saas-button saas-button-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgeHub;
