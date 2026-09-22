import { useEffect, useState } from "react";

function Assignments() {
  // State
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    due_date: "",
    description: "",
    priority: "Medium",
    status: "Pending",
  });

  // Load Initial Data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      
      const [assignRes, subjectsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/assignments"),
        fetch("http://127.0.0.1:8000/subjects")
      ]);

      if (!assignRes.ok || !subjectsRes.ok) {
        throw new Error("Failed to fetch assignment tracker data");
      }

      const assignData = await assignRes.json();
      const subjectsData = await subjectsRes.json();

      setAssignments(Array.isArray(assignData) ? assignData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
    } catch (err) {
      setError("Error loading tracker data. Please refresh.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Form input handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Create or Update Submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Please enter assignment title");
      return;
    }
    if (!formData.due_date) {
      setError("Please enter due date");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        editingAssignmentId
          ? `http://127.0.0.1:8000/assignments/${editingAssignmentId}`
          : "http://127.0.0.1:8000/assignments",
        {
          method: editingAssignmentId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formData.title,
            subject_id: formData.subject_id ? parseInt(formData.subject_id) : null,
            due_date: formData.due_date,
            description: formData.description || "",
            priority: formData.priority,
            status: formData.status,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save assignment");
      }

      // Reset
      setFormData({
        title: "",
        subject_id: "",
        due_date: "",
        description: "",
        priority: "Medium",
        status: "Pending",
      });
      setEditingAssignmentId(null);
      setIsModalOpen(false);

      const msg = editingAssignmentId ? "updated" : "created";
      setSuccessMessage(`✅ Assignment ${msg} successfully!`);
      setTimeout(() => setSuccessMessage(""), 3000);

      await loadData();
      window.dispatchEvent(new CustomEvent("mba-assignment-update"));
    } catch (err) {
      setError("Error saving assignment. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Assignment
  const handleEdit = (assignment) => {
    setEditingAssignmentId(assignment.id);
    setFormData({
      title: assignment.title || "",
      subject_id: String(assignment.subject_id || ""),
      due_date: assignment.due_date || "",
      description: assignment.description || "",
      priority: assignment.priority || "Medium",
      status: assignment.status || "Pending",
    });
    setIsModalOpen(true);
  };

  // Delete Assignment
  const handleDelete = async (assignmentId) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/assignments/${assignmentId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete assignment");
        }

        await loadData();
        window.dispatchEvent(new CustomEvent("mba-assignment-update"));
      } catch (err) {
        setError("Error deleting assignment");
        console.error(err);
      }
    }
  };

  // Mark Complete
  const handleMarkComplete = async (assignmentId) => {
    // Save current state for rollback
    const originalAssignments = [...assignments];

    // Optimistically update assignment status in local state
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status: "Completed" } : a))
    );

    // Dispatch event immediately so the Dashboard can update
    window.dispatchEvent(new CustomEvent("mba-assignment-update"));

    try {
      const response = await fetch(`http://127.0.0.1:8000/assignments/${assignmentId}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to complete assignment");
      }

      await loadData();
      
      // Dispatch again to match backend calculations
      window.dispatchEvent(new CustomEvent("mba-assignment-update"));
    } catch (err) {
      console.error("Failed to complete assignment, rolling back:", err);
      // Roll back
      setAssignments(originalAssignments);
      window.dispatchEvent(new CustomEvent("mba-assignment-update"));
      setError("Error updating assignment status");
    }
  };

  const getSubjectName = (subjectId) => {
    if (!subjectId) return "No Subject";
    const subject = subjects.find((s) => s.id === subjectId);
    return subject ? subject.name : "Unknown Subject";
  };

  // Styling maps based on priority & status
  const getPriorityColor = (priority) => {
    if (priority === "High") return "#ef4444"; // Red
    if (priority === "Medium") return "#f59e0b"; // Yellow
    return "#10b981"; // Green
  };

  const getStatusStyle = (status) => {
    if (status === "Completed") return { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" };
    if (status === "In Progress") return { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" };
    return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" };
  };

  // Statistics calculation
  const todayStr = new Date().toISOString().split("T")[0];
  const overdueCount = assignments.filter((a) => a.status !== "Completed" && a.due_date < todayStr).length;
  const pendingCount = assignments.filter((a) => a.status !== "Completed" && a.due_date >= todayStr).length;
  const completedCount = assignments.filter((a) => a.status === "Completed").length;

  if (loading) {
    return (
      <div className="saas-container">
        <div className="saas-wrapper">
          <div className="saas-header">
            <h1 className="saas-title">📝 Assignment Tracker</h1>
            <p className="saas-subtitle">Loading tracker...</p>
          </div>
        </div>
      </div>
    );
  }

  // Modal styling definitions
  const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  return (
    <div className="saas-container">
      <div className="saas-wrapper">
        {/* Title Header */}
        <div className="saas-header">
          <h1 className="saas-title">📝 Assignment Tracker</h1>
          <p className="saas-subtitle">Manage homework, project deadlines, and academic deliverables.</p>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              onClick={() => {
                setFormData({
                  title: "",
                  subject_id: "",
                  due_date: "",
                  description: "",
                  priority: "Medium",
                  status: "Pending",
                });
                setEditingAssignmentId(null);
                setIsModalOpen(true);
              }}
              className="saas-button saas-button-primary"
            >
              ➕ Add Assignment
            </button>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#86efac", padding: "12px", borderRadius: "8px" }}>
            {successMessage}
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fee2e2", padding: "12px", borderRadius: "8px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="saas-stats-grid">
          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🔴</div>
            <div className="saas-stat-label">Overdue Assignments</div>
            <div className="saas-stat-value" style={{ color: "#ef4444" }}>{overdueCount}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🟡</div>
            <div className="saas-stat-label">Pending / Active</div>
            <div className="saas-stat-value" style={{ color: "#f59e0b" }}>{pendingCount}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🟢</div>
            <div className="saas-stat-label">Completed</div>
            <div className="saas-stat-value" style={{ color: "#10b981" }}>{completedCount}</div>
          </div>
        </div>

        {/* Assignment Grid */}
        {assignments.length === 0 ? (
          <div style={{ padding: "40px", backgroundColor: "rgba(0, 0, 0, 0.15)", borderRadius: "12px", textAlign: "center", color: "var(--text-secondary)", border: "1px dashed rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📝</div>
            <p style={{ margin: 0, fontSize: "1.1rem" }}>No assignments tracked yet. Click "Add Assignment" to start!</p>
          </div>
        ) : (
          <div className="assignments-list-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {assignments.map((assignment) => {
              const pColor = getPriorityColor(assignment.priority);
              const sStyle = getStatusStyle(assignment.status);
              const isOverdue = assignment.status !== "Completed" && assignment.due_date < todayStr;

              return (
                <div
                  key={assignment.id}
                  className="saas-card"
                  style={{
                    borderLeft: `4px solid ${pColor}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "180px",
                    opacity: assignment.status === "Completed" ? 0.75 : 1,
                    padding: "20px 24px"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px", gap: "10px" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)", fontWeight: "bold" }}>{assignment.title}</h3>
                      <span style={{
                        backgroundColor: sStyle.bg,
                        color: sStyle.color,
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        whiteSpace: "nowrap"
                      }}>
                        {assignment.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
                      📚 {getSubjectName(assignment.subject_id)}
                    </div>

                    {assignment.description && (
                      <p style={{ margin: "0 0 16px 0", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                        {assignment.description}
                      </p>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700" }}>DUE DATE</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: "bold", color: isOverdue ? "#ef4444" : "#ffffff" }}>
                        {assignment.due_date} {isOverdue && "⚠️"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {assignment.status !== "Completed" && (
                        <button
                          onClick={() => handleMarkComplete(assignment.id)}
                          className="saas-button saas-button-success"
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.8rem"
                          }}
                        >
                          ✓ Done
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(assignment)}
                        className="saas-button"
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          color: "#fbbf24",
                          border: "1px solid rgba(245, 158, 11, 0.3)"
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(assignment.id)}
                        className="saas-button saas-button-danger"
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.8rem"
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation / Editing Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsModalOpen(false)}>
          <div 
            className="saas-card" 
            style={{ 
              width: "90%", 
              maxWidth: "600px", 
              maxHeight: "85vh", 
              overflowY: "auto", 
              position: "relative",
              padding: "24px 30px",
              boxSizing: "border-box"
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                backgroundColor: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: "1"
              }}
            >
              &times;
            </button>

            {/* Header */}
            <h3 style={{ margin: "0 0 20px 0", fontSize: "1.3rem", color: "var(--text-primary)", fontWeight: "bold" }}>
              {editingAssignmentId ? "✏️ Edit Assignment" : "➕ Add Assignment"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
                {/* Title */}
                <div>
                  <label className="saas-label">Assignment Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g., Operations Management Report"
                    className="saas-input"
                  />
                </div>

                {/* Subject Dropdown */}
                <div>
                  <label className="saas-label">Subject</label>
                  <select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleInputChange}
                    className="saas-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">None</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="saas-label">Due Date *</label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    className="saas-input"
                  />
                </div>

                {/* Priority badges */}
                <div>
                  <label className="saas-label">Priority</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["High", "Medium", "Low"].map((p) => {
                      const isSelected = formData.priority === p;
                      let btnStyle = {
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      };
                      
                      if (isSelected) {
                        if (p === "High") {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171", borderColor: "#ef4444" };
                        } else if (p === "Medium") {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", borderColor: "#f59e0b" };
                        } else {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#34d399", borderColor: "#10b981" };
                        }
                      } else {
                        btnStyle = { ...btnStyle, backgroundColor: "rgba(255, 255, 255, 0.02)", color: "var(--text-secondary)" };
                      }

                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                          style={btnStyle}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status badges */}
                <div>
                  <label className="saas-label">Status</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["Pending", "In Progress", "Completed"].map((s) => {
                      const isSelected = formData.status === s;
                      let btnStyle = {
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      };

                      if (isSelected) {
                        if (s === "Pending") {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(148, 163, 184, 0.2)", color: "#cbd5e1", borderColor: "#94a3b8" };
                        } else if (s === "In Progress") {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", borderColor: "#3b82f6" };
                        } else {
                          btnStyle = { ...btnStyle, backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#34d399", borderColor: "#10b981" };
                        }
                      } else {
                        btnStyle = { ...btnStyle, backgroundColor: "rgba(255, 255, 255, 0.02)", color: "var(--text-secondary)" };
                      }

                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                          style={btnStyle}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="saas-label">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Provide details about the assignment..."
                    rows="3"
                    className="saas-input"
                    style={{ fontFamily: "inherit", resize: "vertical", padding: "12px 14px", lineHeight: "1.5" }}
                  />
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="assignment-form-buttons" style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="saas-button saas-button-success"
                  style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
                >
                  {submitting ? "Saving..." : (editingAssignmentId ? "💾 Save Changes" : "➕ Add Assignment")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="saas-button saas-button-secondary"
                  style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Assignments;
