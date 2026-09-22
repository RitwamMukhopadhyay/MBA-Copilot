import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ExamPlanner() {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);
  const [expandedTerms, setExpandedTerms] = useState({ "Term 1": true }); // Term 1 open by default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [subjectId, setSubjectId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topicsCount, setTopicsCount] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [notes, setNotes] = useState("");

  // AI Study Plan Modal State
  const [studyPlanPlan, setStudyPlanPlan] = useState("");
  const [studyPlanExam, setStudyPlanExam] = useState(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    loadExams();
    loadSubjects();
    loadTerms();
  }, []);

  const loadTerms = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/terms");
      if (res.ok) {
        const data = await res.json();
        setTerms(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTerm = (term) => {
    setExpandedTerms((prev) => ({
      ...prev,
      [term]: !prev[term],
    }));
  };

  const loadExams = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/exams");
      if (res.ok) {
        const data = await res.json();
        setExams(data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load exams.");
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/subjects");
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId || !examDate || !topicsCount || !difficulty) {
      setError("Please fill out all required fields.");
      return;
    }
    setError("");

    const payload = {
      subject_id: parseInt(subjectId),
      exam_date: examDate,
      topics_count: parseInt(topicsCount),
      difficulty,
      notes
    };

    try {
      setLoading(true);
      let res;
      if (editingExamId) {
        res = await fetch(`http://127.0.0.1:8000/exams/${editingExamId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("http://127.0.0.1:8000/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        loadExams();
        window.dispatchEvent(new CustomEvent("mba-event-update"));
        resetForm();
      } else {
        const data = await res.json();
        setError(data.error || "Save failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to save exam.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubjectId("");
    setExamDate("");
    setTopicsCount("");
    setDifficulty("Medium");
    setNotes("");
    setEditingExamId(null);
    setShowForm(false);
  };

  const handleEdit = (exam) => {
    setSubjectId(exam.subject_id.toString());
    setExamDate(exam.exam_date);
    setTopicsCount(exam.topics_count.toString());
    setDifficulty(exam.difficulty);
    setNotes(exam.notes || "");
    setEditingExamId(exam.id);
    setShowForm(true);
  };

  const handleDelete = async (examId) => {
    const confirmDelete = window.confirm("Delete this exam?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/exams/${examId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadExams();
        window.dispatchEvent(new CustomEvent("mba-event-update"));
      }
    } catch (err) {
      console.error(err);
    }
  };
  const handleToggleComplete = async (examId, isCurrentlyCompleted) => {
    const newStatus = isCurrentlyCompleted ? 0 : 1;
    const originalExams = [...exams];

    // Optimistically update exam complete status locally
    setExams((prev) =>
      prev.map((e) => (e.id === examId ? { ...e, is_completed: newStatus } : e))
    );

    // Dispatch event immediately so the Dashboard can update
    window.dispatchEvent(new CustomEvent("mba-event-update"));

    try {
      const res = await fetch(`http://127.0.0.1:8000/exams/${examId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: newStatus })
      });
      if (res.ok) {
        loadExams();
        // Dispatch again to match backend calculations
        window.dispatchEvent(new CustomEvent("mba-event-update"));
      } else {
        throw new Error("Failed to toggle exam status");
      }
    } catch (err) {
      console.error("Failed to toggle exam status, rolling back:", err);
      // Roll back
      setExams(originalExams);
      window.dispatchEvent(new CustomEvent("mba-event-update"));
    }
  };

  const handleGenerateStudyPlan = async (exam) => {
    setStudyPlanExam(exam);
    setStudyPlanPlan("");
    setGeneratingPlan(true);

    try {
      const res = await fetch(`http://127.0.0.1:8000/exams/${exam.id}/study-plan`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setStudyPlanPlan(data.study_plan);
        }
      } else {
        setError("Failed to generate AI study plan.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend for AI study plan.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Helper calculations for Cards
  const totalExams = exams.length;
  const completedExams = exams.filter(e => e.is_completed === 1).length;
  
  // Calculate Urgent Exams (due in <= 3 days, non-completed)
  const calculateDays = (dateStr) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const examD = new Date(dateStr);
    examD.setHours(0,0,0,0);
    const diff = examD - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const urgentExams = exams.filter(e => e.is_completed === 0 && calculateDays(e.exam_date) <= 3).length;

  // Next Exam (closest upcoming, non-completed)
  const upcomingExams = exams
    .filter(e => e.is_completed === 0)
    .sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date));
  const nextExam = upcomingExams.length > 0 ? upcomingExams[0] : null;

  // Format Days Remaining Label
  const getDaysLabel = (dateStr) => {
    const diff = calculateDays(dateStr);
    if (diff === 0) return "Today 🔴";
    if (diff === 1) return "Tomorrow 🟡";
    if (diff > 1) return `In ${diff} Days`;
    return `${Math.abs(diff)} Days Overdue 🛑`;
  };

  const getDifficultyColor = (diff) => {
    if (diff === "Easy") return "#10b981"; // green
    if (diff === "Medium") return "#f59e0b"; // orange
    return "#ef4444"; // red
  };

  // Group exams by dynamic terms
  const groupedExams = {};
  terms.forEach((t) => {
    groupedExams[t.name] = [];
  });

  exams.forEach((exam) => {
    const termVal = exam.term || "Unassigned";
    if (!groupedExams[termVal]) {
      groupedExams[termVal] = [];
    }
    groupedExams[termVal].push(exam);
  });

  const sortedTerms = Object.keys(groupedExams).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0]);
    const numB = parseInt(b.match(/\d+/)?.[0]);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  return (
    <div className="saas-container">
      <div className="saas-wrapper">
        <style>{`
          .exam-card {
            transition: all 0.2s ease;
          }
          .exam-card:hover {
            border-color: rgba(168, 85, 247, 0.35);
            transform: translateY(-2px);
          }
          .plan-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(8px);
          }
          .plan-modal-content {
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
          }
          .markdown-plan h1, .markdown-plan h2, .markdown-plan h3 {
            color: white;
            margin-top: 20px;
            margin-bottom: 10px;
          }
          .markdown-plan p {
            margin-bottom: 12px;
            line-height: 1.5;
          }
          .markdown-plan table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background: var(--bg-primary);
            border-radius: 8px;
            overflow: hidden;
          }
          .markdown-plan th, .markdown-plan td {
            border: 1px solid var(--border-color);
            padding: 10px 12px;
            text-align: left;
          }
          .markdown-plan th {
            background-color: rgba(255,255,255,0.05);
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Header */}
        <div className="saas-header">
          <h1 className="saas-title">📖 Exam Planner</h1>
          <p className="saas-subtitle">
            Schedule exams, track subject preparation level, and generate study guides.
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: "#7f1d1d", border: "1px solid #991b1b", color: "#fee2e2", padding: "12px", borderRadius: "8px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* DASHBOARD CARDS */}
        <div className="saas-stats-grid">
          <div className="saas-stat-card">
            <div className="saas-stat-emoji">📝</div>
            <div className="saas-stat-label">Total Exams</div>
            <div className="saas-stat-value" style={{ color: "#3b82f6" }}>{totalExams}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🚨</div>
            <div className="saas-stat-label">Next Exam</div>
            <div className="saas-stat-value" style={{ 
              fontSize: "16px", 
              color: nextExam ? "#f59e0b" : "var(--text-secondary)", 
              whiteSpace: "nowrap", 
              overflow: "hidden", 
              textOverflow: "ellipsis",
              marginTop: "4px"
            }}>
              {nextExam ? nextExam.subject_name : "None Scheduled"}
            </div>
            {nextExam && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{nextExam.exam_date}</div>}
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">⚠️</div>
            <div className="saas-stat-label">Urgent Exams</div>
            <div className="saas-stat-value" style={{ color: urgentExams > 0 ? "#ef4444" : "#10b981" }}>{urgentExams}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">✅</div>
            <div className="saas-stat-label">Completed</div>
            <div className="saas-stat-value" style={{ color: "#10b981" }}>{completedExams}</div>
          </div>
        </div>

        {/* ACTION HEADER */}
        <div>
          <button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="saas-button saas-button-primary"
          >
            {showForm ? "Close Form" : "+ Add Exam"}
          </button>
        </div>

        {/* FORM WINDOW */}
        {showForm && (
          <form onSubmit={handleSubmit} className="saas-card" style={{ gap: "20px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "4px", color: "white", fontSize: "1.25rem", fontWeight: "700" }}>
              {editingExamId ? "✏️ Edit Scheduled Exam" : "➕ Schedule New Exam"}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Configure parameters, date, difficulty, and preparation syllabus.</p>
            <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.08)", width: "100%" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Section 1: Exam Details */}
              <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.8rem", color: "#a855f7", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                  📘 Exam Details
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label className="saas-label">Subject *</label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="saas-select"
                      style={{ width: "100%" }}
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label className="saas-label">Exam Date *</label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="saas-input"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Preparation Parameters */}
              <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.8rem", color: "#a855f7", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                  ⚙️ Preparation Parameters
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label className="saas-label">Topics Count *</label>
                    <input
                      type="number"
                      placeholder="e.g. 15"
                      value={topicsCount}
                      onChange={(e) => setTopicsCount(e.target.value)}
                      className="saas-input"
                    />
                  </div>

                  {/* Difficulty Segmented Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label className="saas-label">Difficulty *</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {["Easy", "Medium", "Hard"].map((d) => {
                        const isSelected = difficulty === d;
                        let btnStyle = {
                          flex: 1,
                          padding: "10px",
                          fontSize: "0.85rem",
                          fontWeight: "700",
                          borderRadius: "6px",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        };

                        if (isSelected) {
                          if (d === "Easy") {
                            btnStyle = { ...btnStyle, backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#34d399", borderColor: "#10b981" };
                          } else if (d === "Medium") {
                            btnStyle = { ...btnStyle, backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", borderColor: "#f59e0b" };
                          } else {
                            btnStyle = { ...btnStyle, backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171", borderColor: "#ef4444" };
                          }
                        } else {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(255, 255, 255, 0.02)", color: "var(--text-secondary)" };
                        }

                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDifficulty(d)}
                            style={btnStyle}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Notes & Syllabus */}
              <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.8rem", color: "#a855f7", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                  📝 Syllabus & Notes
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <textarea
                    placeholder="List specific chapters, topics, or instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="3"
                    className="saas-input"
                    style={{ resize: "vertical", fontFamily: "inherit", padding: "12px 14px", lineHeight: "1.5" }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                type="submit"
                disabled={loading}
                className="saas-button saas-button-success"
                style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
              >
                {loading ? "Saving..." : "Save Exam"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="saas-button saas-button-secondary"
                style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* EXAMS LIST GROUPED BY TERM */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {exams.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "rgba(30, 41, 59, 0.2)", borderRadius: "10px", border: "1px dashed var(--border-color)" }}>
              No exams scheduled. Click "+ Add Exam" above to add your first exam.
            </div>
          ) : (
            sortedTerms.map((termName) => {
              const termExams = groupedExams[termName];
              const isTermExpanded = !!expandedTerms[termName];

              return (
                <div key={termName} style={{ marginBottom: "10px" }}>
                  {/* Term Accordion Header */}
                  <div 
                    className="saas-accordion-header" 
                    onClick={() => toggleTerm(termName)}
                    style={{
                      color: isTermExpanded ? "#a855f7" : "var(--text-primary)",
                      borderColor: isTermExpanded ? "rgba(168, 85, 247, 0.35)" : "rgba(255, 255, 255, 0.06)",
                      marginBottom: isTermExpanded ? "16px" : "12px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ marginRight: "10px", fontSize: "12px", display: "inline-block", transform: isTermExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                        ▶
                      </span>
                      <span style={{ fontSize: "20px", fontWeight: "700" }}>
                        {termName.startsWith("Term") ? termName : `Term ${termName}`}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: "13px", 
                      fontWeight: "500",
                      color: "var(--text-secondary)"
                    }}>
                      {termExams.length} {termExams.length === 1 ? "Exam" : "Exams"}
                    </span>
                  </div>

                  {/* Collapsible Exams List */}
                  {isTermExpanded && (
                    <div className="saas-accordion-content">
                      {termExams.length === 0 ? (
                        <div style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "var(--text-secondary)",
                          background: "rgba(30, 41, 59, 0.2)",
                          borderRadius: "10px",
                          border: "1px dashed var(--border-color)",
                          fontSize: "14px"
                        }}>
                          No exams scheduled for {termName.startsWith("Term") ? termName : `Term ${termName}`}.
                        </div>
                      ) : (
                        termExams.map((exam) => {
                          const daysDiff = calculateDays(exam.exam_date);
                          const isOverdue = daysDiff < 0 && exam.is_completed === 0;

                          return (
                            <div
                              key={exam.id}
                              className="saas-card exam-card"
                              style={{
                                borderLeft: `5px solid ${exam.is_completed ? "#10b981" : (isOverdue ? "#ef4444" : "#a855f7")}`,
                                opacity: exam.is_completed ? 0.75 : 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                                padding: "20px"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
                                
                                {/* Left Metadata info */}
                                <div style={{ flex: 1, minWidth: "250px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                    <span style={{
                                      fontSize: "1.15rem",
                                      fontWeight: "bold",
                                      textDecoration: exam.is_completed ? "line-through" : "none",
                                      color: exam.is_completed ? "var(--text-secondary)" : "white"
                                    }}>
                                      {exam.subject_name}
                                    </span>
                                    <span style={{
                                      fontSize: "0.75rem",
                                      fontWeight: "bold",
                                      backgroundColor: `${getDifficultyColor(exam.difficulty)}20`,
                                      color: getDifficultyColor(exam.difficulty),
                                      padding: "3px 8px",
                                      borderRadius: "4px",
                                      border: `1px solid ${getDifficultyColor(exam.difficulty)}50`
                                    }}>
                                      {exam.difficulty}
                                    </span>
                                  </div>

                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    <div>
                                      <strong>Date:</strong> {exam.exam_date}
                                    </div>
                                    <div>
                                      <strong>Days Left:</strong> {exam.is_completed ? "Completed ✅" : getDaysLabel(exam.exam_date)}
                                    </div>
                                    <div>
                                      <strong>Topics:</strong> {exam.topics_count} Chapters
                                    </div>
                                  </div>

                                  {exam.notes && (
                                    <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: "6px", fontSize: "0.88rem", color: "var(--text-secondary)", borderLeft: "2px solid var(--border-color)" }}>
                                      {exam.notes}
                                    </div>
                                  )}
                                </div>

                                {/* Actions area */}
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  
                                  {/* Mark Complete Checkbox */}
                                  <button
                                    onClick={() => handleToggleComplete(exam.id, exam.is_completed)}
                                    className={`saas-button ${exam.is_completed ? "saas-button-secondary" : "saas-button-success"}`}
                                    style={{ padding: "8px 12px", fontSize: "0.8rem" }}
                                  >
                                    {exam.is_completed ? "↩ Incomplete" : "✓ Complete"}
                                  </button>

                                  {/* AI Study Plan Button */}
                                  <button
                                    onClick={() => handleGenerateStudyPlan(exam)}
                                    disabled={exam.is_completed === 1}
                                    className="saas-button saas-button-primary"
                                    style={{ 
                                      padding: "8px 12px", 
                                      fontSize: "0.8rem",
                                      opacity: exam.is_completed === 1 ? 0.5 : 1,
                                      cursor: exam.is_completed === 1 ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    🧠 Study Plan
                                  </button>

                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleEdit(exam)}
                                    className="saas-button saas-button-secondary"
                                    style={{ 
                                      padding: "8px 12px", 
                                      fontSize: "0.8rem",
                                      borderColor: "rgba(245, 158, 11, 0.4)",
                                      color: "#fbbf24",
                                      background: "rgba(245, 158, 11, 0.1)"
                                    }}
                                  >
                                    ✎ Edit
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    onClick={() => handleDelete(exam.id)}
                                    className="saas-button saas-button-danger"
                                    style={{ padding: "8px 12px", fontSize: "0.8rem" }}
                                  >
                                    🗑 Delete
                                  </button>
                                </div>

                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* AI STUDY PLAN MODAL */}
      {studyPlanExam && (
        <div className="plan-modal-overlay">
          <div className="saas-card plan-modal-content" style={{ padding: "30px", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
            <h2 style={{ marginTop: 0, borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "10px", color: "#a855f7" }}>
              🧠 AI Study Plan: {studyPlanExam.subject_name}
            </h2>
            
            {generatingPlan ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)" }}>
                <div style={{
                  width: "30px", height: "30px", border: "3px solid rgba(168, 85, 247, 0.1)",
                  borderTopColor: "#a855f7", borderRadius: "50%",
                  animation: "spin 1s linear infinite", margin: "0 auto 15px auto"
                }} />
                <div>Generating optimal MBA study schedule based on days remaining, topics, and difficulty level...</div>
              </div>
            ) : (
              <div className="markdown-plan pdf-markdown-container">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {studyPlanPlan}
                </ReactMarkdown>
              </div>
            )}

            <div style={{ marginTop: "25px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setStudyPlanExam(null)}
                className="saas-button saas-button-secondary"
              >
                Close Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExamPlanner;
