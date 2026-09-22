import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [subjectPdfs, setSubjectPdfs] = useState({});
  const [knowledgeDocs, setKnowledgeDocs] = useState({});
  const [generatingSummary, setGeneratingSummary] = useState({});
  const [subjectEvents, setSubjectEvents] = useState({});
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [expandedTerms, setExpandedTerms] = useState({}); // All terms start collapsed
  const [terms, setTerms] = useState([]);
  const [showTermManager, setShowTermManager] = useState(false);
  const [newTermName, setNewTermName] = useState("");
  const [editingTermId, setEditingTermId] = useState(null);
  const [renamedTermValue, setRenamedTermValue] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [courseCode, setCourseCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [credits, setCredits] = useState("");
  const [faculty, setFaculty] = useState("");
  const [term, setTerm] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState(null);

  // State for Notes Generation Action
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState(null);
  const [notesResult, setNotesResult] = useState("");
  const [notesChunks, setNotesChunks] = useState(0);
  const [notesDocs, setNotesDocs] = useState(0);
  const [generatingSubject, setGeneratingSubject] = useState("");
  const [prevHasIndexing, setPrevHasIndexing] = useState(false);

  useEffect(() => {
    if (window.location.search.includes("mockConfirm=true")) {
      window.confirm = () => true;
    }
    loadSubjects();
    loadTerms();
  }, []);

  const loadSubjects = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/subjects");
      const data = await res.json();
      setSubjects(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTerms = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/terms");
      const data = await res.json();
      setTerms(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateTerm = async () => {
    console.log("[TERM] Create clicked");
    const trimmed = newTermName.trim();
    if (!trimmed) {
      alert("Term name cannot be empty");
      return;
    }
    try {
      const res = await fetch("http://127.0.0.1:8000/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setNewTermName("");
        loadTerms();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRenameTerm = async (id) => {
    console.log("[TERM] Rename clicked");
    const trimmed = renamedTermValue.trim();
    if (!trimmed) {
      alert("Term name cannot be empty");
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:8000/terms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setEditingTermId(null);
        setRenamedTermValue("");
        loadTerms();
        loadSubjects();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTerm = async (id, name) => {
    console.log("[TERM] Delete clicked");
    const termSubjects = groupedSubjects[name] || [];
    if (termSubjects.length > 0) {
      alert("This term contains subjects. Move or delete subjects first.");
      return;
    }

    const confirmDelete = window.confirm(`Delete term "${name}"?`);
    if (!confirmDelete) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/terms/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        loadTerms();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadStats = async (subjectName) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/subject-stats/${encodeURIComponent(subjectName)}`
      );
      const data = await res.json();
      setSubjectStats((prev) => ({
        ...prev,
        [subjectName]: data,
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const loadPdfs = async (subjectName) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/subject-pdfs/${encodeURIComponent(subjectName)}`
      );
      const data = await res.json();
      console.log("PDF DATA:", data);
      setSubjectPdfs((prev) => ({
        ...prev,
        [subjectName]: data,
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const loadKnowledgeDocs = async (subjectName) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents`
      );
      const data = await res.json();
      setKnowledgeDocs((prev) => ({
        ...prev,
        [subjectName]: data,
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const loadSubjectEvents = async (subjectId) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/events");
      const allEvents = await res.json();
      const filtered = allEvents.filter((event) => event.subject_id === subjectId);
      setSubjectEvents((prev) => ({
        ...prev,
        [subjectId]: filtered.sort((a, b) => new Date(a.event_date) - new Date(b.event_date)),
      }));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const hasAnyIndexing = Object.values(knowledgeDocs).some((docs) =>
      docs && docs.some((d) => d && d.indexed === 2)
    );
    if (prevHasIndexing && !hasAnyIndexing) {
      console.log("[Subjects] Indexing completed, dispatching event");
      window.dispatchEvent(new CustomEvent("mba-indexing-complete"));
      window.dispatchEvent(new CustomEvent("mba-subject-update"));
    }
    setPrevHasIndexing(hasAnyIndexing);
  }, [knowledgeDocs, prevHasIndexing]);

  useEffect(() => {
    const hasAnyIndexing = Object.values(knowledgeDocs).some((docs) =>
      docs && docs.some((d) => d && d.indexed === 2)
    );

    if (!hasAnyIndexing) return;

    const interval = setInterval(() => {
      if (expandedSubject) {
        const sub = subjects.find((s) => s.id === expandedSubject);
        if (sub) {
          loadKnowledgeDocs(sub.name);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [knowledgeDocs, expandedSubject, subjects]);


  const getEventTypeEmoji = (event_type) => {
    const eventTypeEmojis = {
      "Class": "📚",
      "Assignment": "📝",
      "Presentation": "📊",
      "Exam": "📖",
      "Reminder": "🎯",
    };
    return eventTypeEmojis[event_type] || "📅";
  };

  const getEventTypeColor = (event_type) => {
    const eventTypeColors = {
      "Class": "#3b82f6",
      "Assignment": "#f59e0b",
      "Presentation": "#8b5cf6",
      "Exam": "#ef4444",
      "Reminder": "#10b981",
    };
    return eventTypeColors[event_type] || "#94a3b8";
  };

  const saveSubject = async () => {
    const isEdit = editingSubjectId !== null;
    const url = isEdit 
      ? `http://127.0.0.1:8000/subjects/${editingSubjectId}`
      : "http://127.0.0.1:8000/subjects";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_code: courseCode,
          name: subjectName,
          credits: parseFloat(credits) || 0,
          faculty: faculty,
          term: term,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      loadSubjects();
      window.dispatchEvent(new CustomEvent("mba-subject-update"));
      setCourseCode("");
      setSubjectName("");
      setCredits("");
      setFaculty("");
      setTerm("");
      setEditingSubjectId(null);
      setShowForm(false);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteSubject = async (subjectId) => {
    console.log("[SUBJECT] Delete clicked");
    const confirmDelete = window.confirm(`This will permanently remove:\n- Documents\n- Indexes\n- Embeddings\n- Generated knowledge`);
    if (!confirmDelete) return;

    console.log("[SUBJECT] Delete request sent");
    try {
      const res = await fetch(`http://127.0.0.1:8000/subjects/${subjectId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        console.log("[SUBJECT] Delete successful");
        loadSubjects();
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
        if (expandedSubject === subjectId) {
          setExpandedSubject(null);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openSubjectFolder = async (subjectName) => {
    try {
      await fetch(
        `http://127.0.0.1:8000/open-subject-folder/${encodeURIComponent(subjectName)}`,
        {
          method: "POST",
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  const uploadFile = async (subjectName, file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      await fetch(
        `http://127.0.0.1:8000/upload-file/${encodeURIComponent(subjectName)}`,
        {
          method: "POST",
          body: formData,
        }
      );

      loadStats(subjectName);
      loadPdfs(subjectName);
      loadKnowledgeDocs(subjectName);
      window.dispatchEvent(new CustomEvent("mba-subject-update"));
      alert("File uploaded successfully");
    } catch (error) {
      console.error(error);
      alert("Upload failed");
    }
  };

  const generateSummary = async (subjectName, pdfName) => {
    try {
      setGeneratingSummary((prev) => ({
        ...prev,
        [pdfName]: true,
      }));

      const res = await fetch(
        `http://127.0.0.1:8000/generate-summary/${encodeURIComponent(
          subjectName
        )}/${encodeURIComponent(pdfName)}`,
        {
          method: "POST",
        }
      );

      const data = await res.json();
      loadStats(subjectName);
      alert(data.message);
    } catch (error) {
      console.error(error);
      alert("Summary generation failed");
    } finally {
      setGeneratingSummary((prev) => ({
        ...prev,
        [pdfName]: false,
      }));
    }
  };

  const handleGenerateNotes = async (subName) => {
    setNotesLoading(true);
    setNotesError(null);
    setNotesResult("");
    setNotesChunks(0);
    setNotesDocs(0);
    setGeneratingSubject(subName);

    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subName)}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "notes"
        })
      });
      const data = await response.json();
      if (data.error) {
        setNotesError(data.error);
      } else {
        setNotesResult(data.result);
        setNotesChunks(data.chunks_count || 0);
        setNotesDocs(data.doc_count || 0);
      }
    } catch (err) {
      console.error("Failed to generate notes:", err);
      setNotesError("Failed to connect to the backend server.");
    } finally {
      setNotesLoading(false);
    }
  };

  const handleDownloadPdf = async (subName, markdownContent) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/knowledge/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: subName,
          markdown: markdownContent
        })
      });
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${subName.replace(/\s+/g, "_")}_notes.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to download PDF. Make sure backend is running.");
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
        loadKnowledgeDocs(subjectName);
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
        loadKnowledgeDocs(subjectName);
        loadStats(subjectName);
        loadPdfs(subjectName);
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
        loadKnowledgeDocs(subjectName);
        loadStats(subjectName);
        loadPdfs(subjectName);
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
        loadKnowledgeDocs(subjectName);
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
        loadKnowledgeDocs(subjectName);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to move document.");
    }
  };

  const handleRepairSubject = async (subjectName) => {
    const confirmed = window.confirm(`Run index repair for "${subjectName}"? This will remove orphaned chunks, fix duplicates, and rebuild the FAISS index.`);
    if (!confirmed) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/repair`, {
        method: "POST"
      });
      const data = await response.json();
      if (data.error) {
        alert("Repair failed: " + data.error);
      } else {
        alert(`Repair complete for "${subjectName}". ${data.orphans_removed || 0} orphans removed, ${data.duplicates_removed || 0} duplicates removed.`);
        loadKnowledgeDocs(subjectName);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to repair index.");
    }
  };

  const handleRemoveDocEntry = async (subjectName, filename) => {
    const confirmed = window.confirm(`Remove entry for "${filename}"? The PDF is missing on disk. This will delete its metadata and FAISS index vectors.`);
    if (!confirmed) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/knowledge/subjects/${encodeURIComponent(subjectName)}/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.error) {
        alert("Error removing entry: " + data.error);
      } else {
        alert(`Entry for "${filename}" removed successfully.`);
        loadKnowledgeDocs(subjectName);
        window.dispatchEvent(new CustomEvent("mba-subject-update"));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to remove entry.");
    }
  };


  const toggleTerm = (termName) => {
    setExpandedTerms((prev) => ({
      ...prev,
      [termName]: !prev[termName],
    }));
  };

  const getTermCredits = (termSubjects) => {
    return termSubjects.reduce((total, subject) => {
      const cred = parseFloat(subject.credits);
      return total + (isNaN(cred) ? 0 : cred);
    }, 0);
  };

  // Group subjects by dynamic terms
  const groupedSubjects = {};

  terms.forEach((t) => {
    groupedSubjects[t.name] = [];
  });

  subjects.forEach((subject) => {
    const termVal = subject.term || "Unassigned";
    if (!groupedSubjects[termVal]) {
      groupedSubjects[termVal] = [];
    }
    groupedSubjects[termVal].push(subject);
  });

  const sortedTerms = Object.keys(groupedSubjects).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0]);
    const numB = parseInt(b.match(/\d+/)?.[0]);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  const getSubjectKnowledgeStatus = (subName) => {
    const docs = knowledgeDocs[subName];
    if (!Array.isArray(docs) || docs.length === 0) return "Not Indexed";
    const anyIndexing = docs.some((d) => d?.indexed === 2);
    if (anyIndexing) return "Indexing";
    const allIndexed = docs.every((d) => d?.indexed === 1);
    return allIndexed ? "Indexed" : "Not Indexed";
  };

  const getSubjectTotalChunks = (subName) => {
    const docs = knowledgeDocs[subName];
    if (!Array.isArray(docs)) return 0;
    return docs.reduce((sum, d) => sum + (d?.chunk_count || 0), 0);
  };

  const getSubjectLastIndexed = (subName) => {
    const docs = knowledgeDocs[subName];
    if (!Array.isArray(docs)) return "Never";
    const times = docs
      .map((d) => d?.last_indexed)
      .filter(Boolean)
      .map((t) => new Date(t).getTime());
    if (times.length === 0) return "Never";
    const maxTime = new Date(Math.max(...times));
    return maxTime.toLocaleDateString() + " " + maxTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusStyles = (status) => {
    if (status === "Indexed") {
      return {
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#10b981",
        border: "rgba(16, 185, 129, 0.3)",
        label: "🟢 Indexed"
      };
    } else if (status === "Indexing") {
      return {
        bg: "rgba(245, 158, 11, 0.15)",
        color: "#f59e0b",
        border: "rgba(245, 158, 11, 0.3)",
        label: "🟡 Indexing"
      };
    } else if (status === "Reindex Required") {
      return {
        bg: "rgba(59, 130, 246, 0.15)",
        color: "#60a5fa",
        border: "rgba(59, 130, 246, 0.3)",
        label: "🔁 Reindex Required"
      };
    } else if (status === "Document Missing") {
      return {
        bg: "rgba(239, 68, 68, 0.15)",
        color: "#f87171",
        border: "rgba(239, 68, 68, 0.3)",
        label: "❌ Document Missing"
      };
    } else if (status === "Repair Required") {
      return {
        bg: "rgba(245, 158, 11, 0.15)",
        color: "#fbbf24",
        border: "rgba(245, 158, 11, 0.3)",
        label: "⚠️ Repair Required"
      };
    } else {
      return {
        bg: "rgba(156, 163, 175, 0.15)",
        color: "#9ca3af",
        border: "rgba(156, 163, 175, 0.3)",
        label: "Not Indexed"
      };
    }
  };

  return (
    <div className="saas-container">
      <style>{`
        .scroll-container::-webkit-scrollbar {
          width: 6px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
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
          margin-top: 14px;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .pdf-markdown-container h1:first-child,
        .pdf-markdown-container h2:first-child,
        .pdf-markdown-container h3:first-child,
        .pdf-markdown-container h4:first-child {
          margin-top: 0;
        }
        .pdf-markdown-container h1 {
          font-size: 1.4rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          padding-bottom: 4px;
        }
        .pdf-markdown-container h2 {
          font-size: 1.2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 2px;
        }
        .pdf-markdown-container h3 {
          font-size: 1.05rem;
        }
        
        .pdf-markdown-container p {
          margin-top: 0;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .pdf-markdown-container ul,
        .pdf-markdown-container ol {
          margin-top: 4px;
          margin-bottom: 8px;
          padding-left: 18px;
        }
        .pdf-markdown-container ul {
          list-style-type: disc;
        }
        .pdf-markdown-container ol {
          list-style-type: decimal;
        }
        .pdf-markdown-container li {
          margin-bottom: 3px;
          line-height: 1.5;
        }
      `}</style>

      <div className="saas-wrapper">
        
        {/* Page Title & Subtitle */}
        <div className="saas-header">
          <h1 className="saas-title">📚 Subjects & Terms</h1>
          <p className="saas-subtitle">Manage study terms, enroll in subjects, upload syllabus files, and index resources.</p>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                if (showForm && editingSubjectId !== null) {
                  setEditingSubjectId(null);
                  setCourseCode("");
                  setSubjectName("");
                  setCredits("");
                  setFaculty("");
                  setTerm("");
                } else {
                  setShowForm(!showForm);
                  setEditingSubjectId(null);
                  setCourseCode("");
                  setSubjectName("");
                  setCredits("");
                  setFaculty("");
                  setTerm("");
                }
                setShowTermManager(false);
              }}
              className={`saas-button ${showForm ? "saas-button-secondary" : "saas-button-primary"}`}
            >
              {showForm ? "Close Form" : "➕ Add Subject"}
            </button>
            <button
              onClick={() => {
                setShowTermManager(!showTermManager);
                setShowForm(false);
              }}
              className={`saas-button ${showTermManager ? "saas-button-secondary" : "saas-button-primary"}`}
              style={!showTermManager ? { background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" } : {}}
            >
              {showTermManager ? "Close Term Manager" : "⚙️ Manage Terms"}
            </button>
          </div>
        </div>

        {showTermManager && (
          <div className="saas-card" style={{ gap: "20px" }}>
            {/* Header */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)" }}>⚙️ Manage Terms</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Create, rename, or delete academic terms.</p>
            </div>
            <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.08)", width: "100%" }} />
            
            {/* Term statistics cards */}
            <div className="saas-stats-grid" style={{ gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="saas-stat-card" style={{ padding: "12px 16px", textContentAlign: "left", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>📅</span>
                <div style={{ textAlign: "left" }}>
                  <div className="saas-stat-label" style={{ marginBottom: "2px", fontSize: "0.7rem" }}>Total Terms</div>
                  <div className="saas-stat-value" style={{ fontSize: "1.2rem" }}>{terms.length}</div>
                </div>
              </div>
              <div className="saas-stat-card" style={{ padding: "12px 16px", textContentAlign: "left", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>📚</span>
                <div style={{ textAlign: "left" }}>
                  <div className="saas-stat-label" style={{ marginBottom: "2px", fontSize: "0.7rem" }}>Subjects Enrolled</div>
                  <div className="saas-stat-value" style={{ fontSize: "1.2rem" }}>{subjects.length}</div>
                </div>
              </div>
              <div className="saas-stat-card" style={{ padding: "12px 16px", textContentAlign: "left", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.5rem" }}>⚡</span>
                <div style={{ textAlign: "left" }}>
                  <div className="saas-stat-label" style={{ marginBottom: "2px", fontSize: "0.7rem" }}>Total Credits</div>
                  <div className="saas-stat-value" style={{ fontSize: "1.2rem" }}>
                    {subjects.reduce((sum, s) => sum + (parseFloat(s.credits) || 0), 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Add Term Section */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "16px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              <span className="saas-label" style={{ marginBottom: 0 }}>➕ Add New Term</span>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  placeholder="e.g. Term 7"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  className="saas-input"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleCreateTerm}
                  className="saas-button saas-button-success"
                  style={{ minWidth: "120px" }}
                >
                  Create Term
                </button>
              </div>
            </div>

            {/* Terms Grid */}
            <div className="terms-list-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
              marginTop: "10px"
            }}>
              {terms.map((t) => {
                const termSubjectsList = groupedSubjects[t.name] || [];
                const termSubjectsCount = termSubjectsList.length;
                const termCreditsCount = getTermCredits(termSubjectsList);
                const isEditingThisTerm = editingTermId === t.id;

                return (
                  <div
                    key={t.id}
                    className="saas-card"
                    style={{
                      padding: "20px",
                      backgroundColor: "rgba(30, 41, 59, 0.4)",
                      border: isEditingThisTerm ? "1px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "15px",
                      margin: 0
                    }}
                  >
                    {isEditingThisTerm ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                        <span className="saas-label">Rename Term</span>
                        <input
                          value={renamedTermValue}
                          onChange={(e) => setRenamedTermValue(e.target.value)}
                          className="saas-input"
                          style={{ padding: "8px 12px" }}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => handleRenameTerm(t.id)}
                            className="saas-button saas-button-success"
                            style={{ flex: 1, padding: "8px", fontSize: "0.8rem" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTermId(null)}
                            className="saas-button saas-button-secondary"
                            style={{ flex: 1, padding: "8px", fontSize: "0.8rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <span style={{ fontSize: "1.5rem" }}>📚</span>
                            <span style={{ fontWeight: "700", fontSize: "1.15rem", color: "var(--text-primary)" }}>{t.name}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                            <div>📂 <strong>{termSubjectsCount}</strong> {termSubjectsCount === 1 ? "Subject" : "Subjects"}</div>
                            <div>⚡ <strong>{termCreditsCount}</strong> Credits</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px" }}>
                          <button
                            onClick={() => {
                              setEditingTermId(t.id);
                              setRenamedTermValue(t.name);
                            }}
                            className="saas-button"
                            style={{ flex: 1, padding: "6px 10px", fontSize: "0.78rem", backgroundColor: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.25)", color: "#f59e0b" }}
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => handleDeleteTerm(t.id, t.name)}
                            className="saas-button saas-button-danger"
                            style={{ flex: 1, padding: "6px 10px", fontSize: "0.78rem", backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171" }}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showForm && (
          <div className="saas-card" style={{ gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)" }}>
                {editingSubjectId !== null ? "Edit Subject ✏" : "Add Subject ➕"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Specify course details, credits, faculty, and academic term.</p>
            </div>
            <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.08)", width: "100%" }} />

            <div className="subject-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label className="saas-label">Course Code</label>
                <input
                  placeholder="Course Code (e.g. UHVE101)"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="saas-input"
                />
              </div>
              <div>
                <label className="saas-label">Subject Name</label>
                <input
                  placeholder="Subject Name"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="saas-input"
                />
              </div>
              <div>
                <label className="saas-label">Credits</label>
                <input
                  placeholder="Credits (e.g. 4)"
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  className="saas-input"
                />
              </div>
              <div>
                <label className="saas-label">Faculty Member</label>
                <input
                  placeholder="Faculty Member Name"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className="saas-input"
                />
              </div>
              <div>
                <label className="saas-label">Academic Term</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="saas-select"
                  style={{ width: "100%" }}
                >
                  <option value="">-- Select Term --</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="saas-label">Indexing Status</label>
                <div style={{ padding: "10px 0", display: "flex", alignItems: "center" }}>
                  {(() => {
                    if (editingSubjectId === null) {
                      return <span style={{ backgroundColor: "rgba(148, 163, 184, 0.15)", color: "#94a3b8", border: "1px solid rgba(148, 163, 184, 0.3)", padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700" }}>🆕 New Subject</span>;
                    }
                    const status = getSubjectKnowledgeStatus(subjectName);
                    const styles = getStatusStyles(status);
                    return (
                      <span style={{ backgroundColor: styles.bg, color: styles.color, border: `1px solid ${styles.border}`, padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700" }}>
                        {styles.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="subject-form-buttons" style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                onClick={saveSubject}
                className="saas-button saas-button-success"
                style={{ padding: "12px 24px" }}
              >
                {editingSubjectId !== null ? "💾 Save Changes" : "➕ Save Subject"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingSubjectId(null);
                  setCourseCode("");
                  setSubjectName("");
                  setCredits("");
                  setFaculty("");
                  setTerm("");
                }}
                className="saas-button saas-button-secondary"
                style={{ padding: "12px 24px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {sortedTerms.map((termName) => {
          const termSubjects = groupedSubjects[termName];
          const isTermExpanded = !!expandedTerms[termName];

          return (
            <div key={termName}>
              {/* Term Header Accordion */}
              <div className="saas-accordion-header" onClick={() => toggleTerm(termName)}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "16px", color: "#a855f7" }}>
                    {isTermExpanded ? "▼" : "▶"}
                  </span>
                  <span style={{ fontSize: "19px", fontWeight: "700", color: "var(--text-primary)" }}>
                    {termName.startsWith("Term") ? termName : `Term ${termName}`}
                    <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)", marginLeft: "10px" }}>
                      ({termSubjects.length} {termSubjects.length === 1 ? "Subject" : "Subjects"})
                    </span>
                  </span>
                </div>
                <span style={{ backgroundColor: "rgba(168, 85, 247, 0.12)", padding: "4px 12px", borderRadius: "6px", fontSize: "13px", color: "#a855f7", fontWeight: "700" }}>
                  {getTermCredits(termSubjects)} Credits
                </span>
              </div>

              {/* Collapsible content */}
              {isTermExpanded && (
                <div className="saas-accordion-content">
                  {termSubjects.length === 0 ? (
                    <div style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      background: "rgba(0, 0, 0, 0.15)",
                      borderRadius: "10px",
                      border: "1px dashed rgba(255,255,255,0.08)",
                      fontSize: "14px"
                    }}>
                      No subjects assigned to {termName.startsWith("Term") ? termName : `Term ${termName}`}.
                    </div>
                  ) : (
                    termSubjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="saas-card"
                        style={{ padding: "20px 24px" }}
                      >
                        {/* Subject Header - Clickable with Controls */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingBottom: expandedSubject === subject.id ? "16px" : "0",
                          }}
                        >
                          <div
                            style={{
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "1.15rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flex: 1
                            }}
                            onClick={() => {
                              if (expandedSubject !== subject.id) {
                                loadStats(subject.name);
                                loadPdfs(subject.name);
                                loadSubjectEvents(subject.id);
                                loadKnowledgeDocs(subject.name);
                                setNotesResult("");
                                setNotesError(null);
                                setNotesLoading(false);
                                setGeneratingSubject("");
                              }
                              setExpandedSubject(expandedSubject === subject.id ? null : subject.id);
                            }}
                          >
                            <span style={{ color: "var(--text-secondary)", fontSize: "12px", transition: "transform 0.2s" }}>
                              {expandedSubject === subject.id ? "▼" : "▶"}
                            </span>
                            <span style={{ color: "var(--text-primary)" }}>{subject.name}</span>
                          </div>

                          <div style={{ display: "flex", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingSubjectId(subject.id);
                                setCourseCode(subject.course_code || "");
                                setSubjectName(subject.name || "");
                                setCredits(subject.credits || "");
                                setFaculty(subject.faculty || "");
                                setTerm(subject.term || "");
                                setShowForm(true);
                                setShowTermManager(false);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="saas-button"
                              style={{
                                padding: "5px 12px",
                                backgroundColor: "rgba(245, 158, 11, 0.15)",
                                color: "#fbbf24",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                fontSize: "12px",
                              }}
                            >
                              ✏ Edit
                            </button>
                            <button
                              onClick={() => deleteSubject(subject.id)}
                              className="saas-button"
                              style={{
                                padding: "5px 12px",
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                color: "#f87171",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                fontSize: "12px",
                              }}
                            >
                              🗑 Delete
                            </button>
                          </div>
                        </div>

                        {/* Expanded Content - Two Column Layout */}
                        {expandedSubject === subject.id && (
                          <div style={{ marginTop: "5px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "15px" }}>
                            {/* Subject Info Header */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                gap: "15px",
                                marginBottom: "20px",
                                paddingBottom: "15px",
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              <div>
                                <p style={{ margin: "0 0 5px 0", color: "var(--text-secondary)", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Code</p>
                                <p style={{ margin: "0", fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>{subject.course_code}</p>
                              </div>

                              <div>
                                <p style={{ margin: "0 0 5px 0", color: "var(--text-secondary)", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Credits</p>
                                <p style={{ margin: "0", fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>{subject.credits}</p>
                              </div>

                              <div>
                                <p style={{ margin: "0 0 5px 0", color: "var(--text-secondary)", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Faculty</p>
                                <p style={{ margin: "0", fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>{subject.faculty}</p>
                              </div>

                              <div>
                                <p style={{ margin: "0 0 5px 0", color: "var(--text-secondary)", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Term</p>
                                <p style={{ margin: "0", fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>{subject.term}</p>
                              </div>
                            </div>

                            {/* Two Column Dashboard */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: (subjectEvents[subject.id]?.length > 0) ? "1fr 1fr" : "1fr",
                                gap: "20px",
                              }}
                            >
                              {/* LEFT COLUMN - Notes & PDFs */}
                              <div
                                style={{
                                  backgroundColor: "rgba(0, 0, 0, 0.15)",
                                  padding: "18px",
                                  borderRadius: "10px",
                                  border: "1px solid rgba(255,255,255,0.05)",
                                  color: "var(--text-primary)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "14px"
                                }}
                              >
                                <h3 style={{ marginTop: "0", marginBottom: "0", fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
                                  📚 Notes & PDFs
                                </h3>

                                {/* Stats */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                                  <div style={{ textAlign: "center", padding: "10px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>📁 Notes</div>
                                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#10b981" }}>{subjectStats[subject.name]?.notes ?? 0}</div>
                                  </div>

                                  <div style={{ textAlign: "center", padding: "10px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>📄 PDFs</div>
                                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#3b82f6" }}>{subjectStats[subject.name]?.pdfs ?? 0}</div>
                                  </div>

                                  <div style={{ textAlign: "center", padding: "10px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "700" }}>📝 Summaries</div>
                                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#f59e0b" }}>{subjectStats[subject.name]?.summaries ?? 0}</div>
                                  </div>
                                </div>

                                {/* PDF List */}
                                <div>
                                  <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "700", color: "var(--text-secondary)" }}>AVAILABLE PDFs</p>
                                  {!Array.isArray(subjectPdfs[subject.name]) || subjectPdfs[subject.name].length === 0 ? (
                                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic", padding: "12px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>No PDFs Found</div>
                                  ) : (
                                    <div className="scroll-container" style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", maxHeight: "180px", overflowY: "auto" }}>
                                      {subjectPdfs[subject.name].map((pdf, index) => {
                                        const pdfName = typeof pdf === "string" ? pdf : pdf?.name || "";
                                        const pdfCategory = typeof pdf === "string" ? "academic" : (pdf?.category || "academic");
                                        const isAdmin = pdfCategory === "administrative";
                                        return (
                                          <div
                                            key={index}
                                            style={{
                                              padding: "10px 14px",
                                              borderBottom: index < subjectPdfs[subject.name].length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                                              fontSize: "13px",
                                              display: "flex",
                                              justifyContent: "space-between",
                                              alignItems: "center",
                                              gap: "8px",
                                            }}
                                          >
                                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                              <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdfName}</span>
                                              <span style={{
                                                fontSize: "9px",
                                                fontWeight: "800",
                                                padding: "2px 6px",
                                                borderRadius: "4px",
                                                whiteSpace: "nowrap",
                                                flexShrink: 0,
                                                backgroundColor: isAdmin ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                                color: isAdmin ? "#ef4444" : "#10b981",
                                                border: `1px solid ${isAdmin ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                                              }}>
                                                {isAdmin ? "📋 Admin" : "📚 Academic"}
                                              </span>
                                            </div>
                                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                              <button
                                                title={isAdmin ? "Mark as Academic" : "Mark as Administrative"}
                                                onClick={async () => {
                                                  const newCategory = isAdmin ? "academic" : "administrative";
                                                  try {
                                                    await fetch(`http://127.0.0.1:8000/reclassify-pdf/${encodeURIComponent(subject.name)}/${encodeURIComponent(pdfName)}`, {
                                                      method: "POST",
                                                      headers: { "Content-Type": "application/json" },
                                                      body: JSON.stringify({ category: newCategory }),
                                                    });
                                                    loadPdfs(subject.name);
                                                  } catch (err) {
                                                    console.error("Reclassify failed:", err);
                                                  }
                                                }}
                                                className="saas-button saas-button-secondary"
                                                style={{
                                                  padding: "3px 8px",
                                                  fontSize: "10px",
                                                  height: "22px",
                                                }}
                                              >
                                                {isAdmin ? "→ Academic" : "→ Admin"}
                                              </button>
                                              {!isAdmin && (
                                                <button
                                                  onClick={() => generateSummary(subject.name, pdfName)}
                                                  disabled={generatingSummary[pdfName]}
                                                  className="saas-button saas-button-primary"
                                                  style={{
                                                    padding: "3px 8px",
                                                    fontSize: "10px",
                                                    height: "22px",
                                                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                                    opacity: generatingSummary[pdfName] ? 0.6 : 1,
                                                  }}
                                                >
                                                  {generatingSummary[pdfName] ? "..." : "Summarize"}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                  <button
                                    onClick={() => openSubjectFolder(subject.name)}
                                    className="saas-button saas-button-primary"
                                    style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}
                                  >
                                    📂 Open Notes
                                  </button>

                                  <label className="saas-button saas-button-success" style={{ cursor: "pointer", margin: 0 }}>
                                    <input
                                      type="file"
                                      style={{ display: "none" }}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          uploadFile(subject.name, file);
                                        }
                                      }}
                                    />
                                    <span>⬆️ Upload PDF</span>
                                  </label>
                                </div>

                                <button
                                  onClick={() => handleGenerateNotes(subject.name)}
                                  disabled={getSubjectKnowledgeStatus(subject.name) !== "Indexed" || getSubjectTotalChunks(subject.name) === 0 || notesLoading}
                                  className="saas-button saas-button-primary"
                                  style={{
                                    width: "100%",
                                    cursor: (getSubjectKnowledgeStatus(subject.name) !== "Indexed" || getSubjectTotalChunks(subject.name) === 0) ? "not-allowed" : "pointer",
                                    opacity: (getSubjectKnowledgeStatus(subject.name) !== "Indexed" || getSubjectTotalChunks(subject.name) === 0) ? 0.5 : 1
                                  }}
                                >
                                  {notesLoading && generatingSubject === subject.name ? "⌛ Generating..." : "📝 Generate Study Notes"}
                                </button>

                                {/* Notes Output Container */}
                                {(generatingSubject === subject.name) && (notesLoading || notesError || notesResult) && (
                                  <div style={{
                                    padding: "14px",
                                    backgroundColor: "rgba(0,0,0,0.2)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    borderRadius: "8px",
                                    textAlign: "left"
                                  }}>
                                    {notesLoading && (
                                      <div style={{ padding: "10px 0", textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
                                        <p style={{ margin: "0 0 6px 0", fontWeight: "bold", color: "var(--text-primary)" }}>Generating Notes...</p>
                                        <p style={{ margin: "0 0 6px 0", fontSize: "11px" }}>Retrieved Chunks: {getSubjectTotalChunks(subject.name)}</p>
                                        <p style={{ margin: 0, fontSize: "11px" }}>Documents Used: {subjectStats[subject.name]?.pdfs || 0}</p>
                                        <div style={{ display: "inline-block", marginTop: "12px", width: "22px", height: "22px", border: "3px solid rgba(168, 85, 247, 0.15)", borderTop: "3px solid #a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                                      </div>
                                    )}

                                    {notesError && (
                                      <div style={{ color: "#f87171", fontSize: "13px", fontWeight: "600", padding: "5px 0" }}>
                                        ❌ Error: {notesError}
                                      </div>
                                    )}

                                    {notesResult && (
                                      <div>
                                        {/* Progress / stats status */}
                                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                           <span>Chunks: <strong>{notesChunks}</strong></span>
                                           <span style={{ marginLeft: "15px" }}>Docs: <strong>{notesDocs}</strong></span>
                                        </div>

                                        {/* Copy and Download PDF Buttons */}
                                        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(notesResult);
                                              alert("Notes copied to clipboard!");
                                            }}
                                            className="saas-button saas-button-secondary"
                                            style={{ flex: 1, padding: "6px 10px", fontSize: "12px", height: "28px" }}
                                          >
                                            📋 Copy Notes
                                          </button>
                                          <button
                                            onClick={() => handleDownloadPdf(subject.name, notesResult)}
                                            className="saas-button saas-button-secondary"
                                            style={{ flex: 1, padding: "6px 10px", fontSize: "12px", height: "28px" }}
                                          >
                                            📥 Download PDF
                                          </button>
                                        </div>

                                        {/* Markdown Output */}
                                        <div className="pdf-markdown-container scroll-container" style={{
                                          maxHeight: "250px",
                                          overflowY: "auto",
                                          padding: "12px",
                                          backgroundColor: "rgba(0,0,0,0.35)",
                                          borderRadius: "8px",
                                          border: "1px solid rgba(255, 255, 255, 0.05)",
                                          fontSize: "13px"
                                        }}>
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {notesResult}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Knowledge Hub Status */}
                                <div style={{ 
                                  padding: "14px", 
                                  backgroundColor: "rgba(0,0,0,0.2)", 
                                  borderRadius: "8px", 
                                  border: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                  <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em" }}>🧠 Knowledge Status</span>
                                    {(() => {
                                      const status = getSubjectKnowledgeStatus(subject.name);
                                      const styles = getStatusStyles(status);
                                      return (
                                        <span style={{
                                          fontSize: "10px",
                                          fontWeight: "800",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          backgroundColor: styles.bg,
                                          color: styles.color,
                                          border: `1px solid ${styles.border}`
                                        }}>
                                          {styles.label}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px", fontSize: "12px" }}>
                                    <div>
                                      <span style={{ color: "var(--text-secondary)" }}>Chunks:</span>{" "}
                                      <strong style={{ color: "var(--text-primary)" }}>{getSubjectTotalChunks(subject.name)}</strong>
                                    </div>
                                    <div>
                                      <span style={{ color: "var(--text-secondary)" }}>Indexed:</span>{" "}
                                      <strong style={{ color: "var(--text-primary)", fontSize: "11px" }}>{getSubjectLastIndexed(subject.name)}</strong>
                                    </div>
                                  </div>

                                  {/* Document List */}
                                  <div>
                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>DOCUMENT INDEX FILES:</div>
                                    {!Array.isArray(knowledgeDocs[subject.name]) || knowledgeDocs[subject.name].length === 0 ? (
                                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic", padding: "8px", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "6px" }}>No Documents Found</div>
                                    ) : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }} className="scroll-container">
                                        {knowledgeDocs[subject.name].map((doc, idx) => {
                                          const valStatus = doc.validation_status || (doc.indexed === 1 ? "Indexed" : doc.indexed === 2 ? "Indexing" : "Not Indexed");
                                          const docStyles = getStatusStyles(valStatus);
                                          return (
                                            <div key={idx} style={{ fontSize: "12px", display: "flex", flexDirection: "column", padding: "8px", backgroundColor: "rgba(255,255,255,0.015)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.03)", marginBottom: "2px" }}>
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                                                <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: "600" }} title={doc.filename}>
                                                  📄 {doc.filename}
                                                </span>
                                                <span style={{ 
                                                  fontSize: "10px", 
                                                  fontWeight: "800",
                                                  color: docStyles?.color || "#9ca3af"
                                                }}>
                                                  {docStyles?.label || "Not Indexed"}
                                                </span>
                                              </div>
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "var(--text-secondary)", gap: "6px", flexWrap: "wrap" }}>
                                                <span>Chunks: {doc.chunk_count || 0}</span>
                                                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                  <button
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      handleViewDoc(subject.name, doc.filename);
                                                    }}
                                                    className="saas-button saas-button-secondary"
                                                    style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0 }}
                                                  >
                                                    View
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      handleRenameDoc(subject.name, doc.filename);
                                                    }}
                                                    className="saas-button saas-button-secondary"
                                                    style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0 }}
                                                  >
                                                    Rename
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      handleMoveDoc(subject.name, doc.filename);
                                                    }}
                                                    className="saas-button saas-button-secondary"
                                                    style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0 }}
                                                  >
                                                    Move
                                                  </button>
                                                  {valStatus === "Document Missing" && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        handleRemoveDocEntry(subject.name, doc.filename);
                                                      }}
                                                      className="saas-button saas-button-danger"
                                                      style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0 }}
                                                    >
                                                      Remove Entry
                                                    </button>
                                                  )}
                                                  {valStatus === "Repair Required" && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        handleRepairSubject(subject.name);
                                                      }}
                                                      className="saas-button saas-button-secondary"
                                                      style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0, backgroundColor: "rgba(245,158,11,0.2)", color: "#fbbf24", borderColor: "#fbbf24" }}
                                                    >
                                                      Repair Index
                                                    </button>
                                                  )}
                                                  {valStatus !== "Document Missing" && valStatus !== "Repair Required" && doc.indexed !== 2 && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        handleReindexDoc(subject.name, doc.filename);
                                                      }}
                                                      className="saas-button saas-button-success"
                                                      style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0 }}
                                                    >
                                                      {doc.indexed === 1 ? "Re-index" : "Index"}
                                                    </button>
                                                  )}
                                                  <label
                                                    className="saas-button"
                                                    style={{
                                                      padding: "2px 6px",
                                                      fontSize: "9px",
                                                      height: "18px",
                                                      margin: 0,
                                                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                                                      color: "#fbbf24",
                                                      border: "1px solid rgba(245, 158, 11, 0.3)",
                                                      cursor: "pointer",
                                                      display: "inline-flex",
                                                      alignItems: "center"
                                                    }}
                                                  >
                                                    Replace
                                                    <input
                                                      type="file"
                                                      accept=".pdf"
                                                      style={{ display: "none" }}
                                                      onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                          handleReplaceDoc(subject.name, doc.filename, file);
                                                        }
                                                      }}
                                                    />
                                                  </label>
                                                  <button
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      handleDeleteDoc(subject.name, doc.filename);
                                                    }}
                                                    className="saas-button saas-button-danger"
                                                    style={{ padding: "2px 6px", fontSize: "9px", height: "18px", margin: 0 }}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* RIGHT COLUMN - Calendar Events */}
                              {(subjectEvents[subject.id]?.length > 0) && (
                                <div
                                  style={{
                                    backgroundColor: "rgba(0, 0, 0, 0.15)",
                                    padding: "18px",
                                    borderRadius: "10px",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                    color: "var(--text-primary)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "14px"
                                  }}
                                >
                                  <h3 style={{ marginTop: "0", marginBottom: "0", fontSize: "15px", fontWeight: "700" }}>
                                    📅 Upcoming Events
                                  </h3>

                                  <div className="scroll-container" style={{ display: "grid", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
                                    {(subjectEvents[subject.id] || []).map((event, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          backgroundColor: "rgba(0, 0, 0, 0.2)",
                                          border: `1px solid ${getEventTypeColor(event.event_type)}30`,
                                          borderLeft: `4px solid ${getEventTypeColor(event.event_type)}`,
                                          borderRadius: "8px",
                                          padding: "12px",
                                          fontSize: "13px",
                                        }}
                                      >
                                        <div style={{ fontWeight: "bold", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-primary)" }}>
                                          {getEventTypeEmoji(event.event_type)} {event.title}
                                        </div>
                                        <div style={{ fontSize: "11px", color: getEventTypeColor(event.event_type), fontWeight: "800", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                          {event.event_type}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", gap: "10px" }}>
                                          <span>📅 {event.event_date}</span>
                                          {event.event_time && <span>⏰ {event.event_time}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
  );
}

export default Subjects;
