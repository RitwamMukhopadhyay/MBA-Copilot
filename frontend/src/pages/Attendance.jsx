import { useEffect, useState } from "react";

function Attendance() {
  const [subjects, setSubjects] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({});
  const [attendanceHistory, setAttendanceHistory] = useState({});
  const [attendanceInsights, setAttendanceInsights] = useState({});
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [expandedTerms, setExpandedTerms] = useState({}); // All terms start collapsed
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const termsRes = await fetch("http://127.0.0.1:8000/terms");
      const termsData = await termsRes.json();
      setTerms(termsData);

      const res = await fetch("http://127.0.0.1:8000/subjects");
      const subjectsData = await res.json();
      setSubjects(subjectsData);

      // Load stats, history, and insights for each subject in parallel
      await Promise.all(
        subjectsData.map(async (subject) => {
          await Promise.all([
            loadAttendanceStats(subject.name),
            loadAttendanceHistory(subject.name),
            loadAttendanceInsights(subject.name),
          ]);
        })
      );
    } catch (error) {
      console.error("Error loading subjects and stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceStats = async (subjectName) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/attendance-stats/${encodeURIComponent(
          subjectName
        )}`
      );
      const data = await res.json();
      setAttendanceStats((prev) => ({
        ...prev,
        [subjectName]: data,
      }));
    } catch (error) {
      console.error(`Error loading stats for ${subjectName}:`, error);
    }
  };

  const loadAttendanceHistory = async (subjectName) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/attendance-history/${encodeURIComponent(
          subjectName
        )}`
      );
      const data = await res.json();
      setAttendanceHistory((prev) => ({
        ...prev,
        [subjectName]: data,
      }));
    } catch (error) {
      console.error(`Error loading history for ${subjectName}:`, error);
    }
  };

  const loadAttendanceInsights = async (subjectName) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/attendance-insights/${encodeURIComponent(
          subjectName
        )}`
      );
      const data = await res.json();
      setAttendanceInsights((prev) => ({
        ...prev,
        [subjectName]: data,
      }));
    } catch (error) {
      console.error(`Error loading insights for ${subjectName}:`, error);
    }
  };

  const markAttendance = async (subjectName, status) => {
    // Save current states for rollback in case of failure
    const originalStats = { ...attendanceStats };
    const originalHistory = { ...attendanceHistory };

    // Optimistically update attendance statistics
    setAttendanceStats((prev) => {
      const current = prev[subjectName] || { present: 0, absent: 0, cancelled: 0 };
      const next = { ...current };
      if (status === "Present") next.present = (next.present || 0) + 1;
      else if (status === "Absent") next.absent = (next.absent || 0) + 1;
      else if (status === "Cancelled") next.cancelled = (next.cancelled || 0) + 1;
      
      const total = (next.present || 0) + (next.absent || 0);
      next.attendance_percentage = total > 0 ? Math.round((next.present / total) * 100) : 100;
      return { ...prev, [subjectName]: next };
    });

    // Optimistically update attendance history log
    setAttendanceHistory((prev) => {
      const current = prev[subjectName] || [];
      const newRecord = {
        attendance_date: new Date().toISOString().split("T")[0],
        status: status
      };
      return { ...prev, [subjectName]: [newRecord, ...current] };
    });

    // Dispatch custom event to notify Dashboard immediately
    window.dispatchEvent(new CustomEvent("mba-attendance-update"));

    try {
      await fetch(
        `http://127.0.0.1:8000/attendance/${encodeURIComponent(
          subjectName
        )}/${status}`,
        {
          method: "POST",
        }
      );
      // Refresh data for the specific subject
      await Promise.all([
        loadAttendanceStats(subjectName),
        loadAttendanceHistory(subjectName),
        loadAttendanceInsights(subjectName),
      ]);
      // Also refresh the general subjects list to ensure any cached data is updated
      const res = await fetch("http://127.0.0.1:8000/subjects");
      const subjectsData = await res.json();
      setSubjects(subjectsData);
      
      // Dispatch custom event again with synced database calculations
      window.dispatchEvent(new CustomEvent("mba-attendance-update"));
    } catch (error) {
      console.error("Attendance marker failed, rolling back:", error);
      // Roll back state on error
      setAttendanceStats(originalStats);
      setAttendanceHistory(originalHistory);
      
      // Dispatch custom event to notify Dashboard of rollback
      window.dispatchEvent(new CustomEvent("mba-attendance-update"));
      alert("Failed to record attendance");
    }
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 80) return "#10b981"; // Healthy Emerald Green
    if (percentage >= 75) return "#f59e0b"; // Warning Amber Yellow
    return "#ef4444"; // Critical Rose Red
  };

  const getAttendanceStatus = (percentage) => {
    if (percentage >= 80) return "✅ Healthy";
    if (percentage >= 75) return "⚠️ At Risk";
    return "🔴 Critical";
  };

  const toggleTerm = (term) => {
    setExpandedTerms((prev) => ({
      ...prev,
      [term]: !prev[term],
    }));
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh", padding: "30px", fontFamily: "Inter, system-ui, sans-serif" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", margin: "0 0 20px 0", color: "var(--text-primary)" }}>Attendance 📊</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-secondary)" }}>
          <div style={{ width: "24px", height: "24px", border: "3px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
          <span>Loading attendance analytics...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Group subjects by dynamic terms
  const groupedSubjects = {};
  terms.forEach((t) => {
    groupedSubjects[t.name] = [];
  });

  subjects.forEach((subject) => {
    const term = subject.term || "Unassigned";
    if (!groupedSubjects[term]) {
      groupedSubjects[term] = [];
    }
    groupedSubjects[term].push(subject);
  });

  // Sort terms numerically or alphabetically
  const sortedTerms = Object.keys(groupedSubjects).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0]);
    const numB = parseInt(b.match(/\d+/)?.[0]);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  return (
    <div className="saas-container">
      <style>{`
        .attendance-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: white;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .attendance-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
        .attendance-btn:active {
          transform: translateY(1px);
        }
        .btn-present {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
        }
        .btn-present:hover {
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
        }
        .btn-absent {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
        }
        .btn-absent:hover {
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.35);
        }
        .btn-cancelled {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
        }
        .btn-cancelled:hover {
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.35);
        }
        .subject-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          cursor: pointer;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.2s ease;
        }
        .subject-row:hover {
          background: rgba(0, 0, 0, 0.25);
          border-color: rgba(255, 255, 255, 0.08);
        }
        .timeline-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .timeline-item:last-child {
          border-bottom: none;
        }
        .status-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }
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
        .scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <div className="saas-wrapper">
        {/* Page Title & Subtitle */}
        <div className="saas-header">
          <h1 className="saas-title">📊 Attendance Tracker</h1>
          <p className="saas-subtitle">Track course attendance, log class presence, and monitor academic health risk metrics.</p>
        </div>

        {subjects.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>No subjects found. Add subjects to track attendance.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {sortedTerms.map((term) => {
              const termSubjects = groupedSubjects[term];
              const isTermExpanded = !!expandedTerms[term];

              return (
                <div key={term} style={{ marginBottom: "10px" }}>
                  {/* Term Accordion Header */}
                  <div className="saas-accordion-header" onClick={() => toggleTerm(term)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "16px", color: "#a855f7" }}>
                        {isTermExpanded ? "▼" : "▶"}
                      </span>
                      <span style={{ fontSize: "19px", fontWeight: "700", color: "var(--text-primary)" }}>
                        {term.startsWith("Term") ? term : `Term ${term}`}
                        <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)", marginLeft: "10px" }}>
                          ({termSubjects.length} {termSubjects.length === 1 ? "Subject" : "Subjects"})
                        </span>
                      </span>
                    </div>
                    {(() => {
                      const pcts = termSubjects.map(s => attendanceStats[s.name]?.attendance_percentage ?? 0);
                      const avg = termSubjects.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
                      const color = avg === null ? "var(--text-secondary)" : avg >= 80 ? "#10b981" : avg >= 75 ? "#f59e0b" : "#ef4444";
                      return avg !== null ? (
                        <span style={{ backgroundColor: `${color}18`, padding: "4px 12px", borderRadius: "6px", fontSize: "13px", color, fontWeight: "700" }}>
                          Avg {avg}%
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Subjects in Term Container */}
                  {isTermExpanded && (
                    <div className="saas-accordion-content">
                      {termSubjects.map((subject) => {
                        const stats = attendanceStats[subject.name] || {};
                        const history = attendanceHistory[subject.name] || [];
                        const insights = attendanceInsights[subject.name] || {};
                        const percentage = stats.attendance_percentage ?? 0;
                        const isExpanded = expandedSubject === subject.id;
                        const statusColor = getAttendanceColor(percentage);

                        return (
                          <div
                            key={subject.id}
                            className="saas-card"
                            style={{
                              padding: "16px 20px",
                              overflow: "hidden"
                            }}
                          >
                            {/* Subject Header Row */}
                            <div
                              className="subject-row attendance-subject-row"
                              onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
                              style={{
                                backgroundColor: "transparent",
                                border: "none",
                                padding: "6px 8px"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ fontSize: "13px", color: "var(--text-secondary)", transition: "transform 0.2s" }}>
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                                <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                                  {subject.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: "800",
                                    color: statusColor,
                                    backgroundColor: `${statusColor}15`,
                                    padding: "3px 10px",
                                    borderRadius: "6px",
                                    marginLeft: "6px"
                                  }}
                                >
                                  {percentage}%
                                </span>
                              </div>

                              {/* Row Action Buttons - Stopped Propagation */}
                              <div 
                                className="subject-action-container"
                                style={{ display: "flex", gap: "8px" }} 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="attendance-btn btn-present"
                                  onClick={() => markAttendance(subject.name, "Present")}
                                >
                                  ✅ Present
                                </button>
                                <button
                                  className="attendance-btn btn-absent"
                                  onClick={() => markAttendance(subject.name, "Absent")}
                                >
                                  ❌ Absent
                                </button>
                                <button
                                  className="attendance-btn btn-cancelled"
                                  onClick={() => markAttendance(subject.name, "Cancelled")}
                                >
                                  ⚠ Cancelled
                                </button>
                              </div>
                            </div>

                            {/* Expanded Content Section */}
                            {isExpanded && (
                              <div style={{ marginTop: "16px", padding: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                                
                                {/* Grid Layout: Stats (Left/Top) & AI Insights (Right/Top) */}
                                <div className="attendance-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                                  
                                  {/* 1. Stats Grid */}
                                  <div>
                                    <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginTop: "0", marginBottom: "12px" }}>
                                      Attendance Counts
                                    </h3>
                                    <div className="attendance-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                                      <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                                        <div style={{ fontSize: "11px", color: "#10b981", fontWeight: "700", textTransform: "uppercase" }}>Present</div>
                                        <div style={{ fontSize: "24px", fontWeight: "800", color: "#10b981", marginTop: "4px" }}>{stats.present ?? 0}</div>
                                      </div>
                                      <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                                        <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: "700", textTransform: "uppercase" }}>Absent</div>
                                        <div style={{ fontSize: "24px", fontWeight: "800", color: "#ef4444", marginTop: "4px" }}>{stats.absent ?? 0}</div>
                                      </div>
                                      <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                                        <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", textTransform: "uppercase" }}>Cancelled</div>
                                        <div style={{ fontSize: "24px", fontWeight: "800", color: "#f59e0b", marginTop: "4px" }}>{stats.cancelled ?? 0}</div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2. AI Insights Box */}
                                  <div
                                    style={{
                                      background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                                      border: "1px solid rgba(168, 85, 247, 0.25)",
                                      padding: "18px",
                                      borderRadius: "12px",
                                      boxShadow: "0 4px 20px rgba(168, 85, 247, 0.05)"
                                    }}
                                  >
                                    <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#c084fc", marginTop: "0", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                                      🤖 AI Insights & Projections
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                                        <span style={{ color: "var(--text-secondary)" }}>Health Status:</span>
                                        <span style={{ fontWeight: "700", color: statusColor }}>{getAttendanceStatus(percentage)}</span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                                        <span style={{ color: "var(--text-secondary)" }}>Safe to Miss:</span>
                                        <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>
                                          {insights.safe_to_miss ?? 0} { (insights.safe_to_miss ?? 0) === 1 ? "class" : "classes" }
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                                        <span style={{ color: "var(--text-secondary)" }}>Classes Needed (for 75%):</span>
                                        <span style={{ fontWeight: "700", color: (insights.classes_needed ?? 0) > 0 ? "#ef4444" : "#10b981" }}>
                                          {insights.classes_needed ?? 0} more
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                </div>

                                {/* 3. Timeline / Attendance History */}
                                <div>
                                  <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginTop: "0", marginBottom: "10px" }}>
                                    📅 Attendance Log
                                  </h3>
                                  {history.length === 0 ? (
                                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", padding: "10px 0" }}>No attendance sessions marked yet.</p>
                                  ) : (
                                    <div
                                      className="scroll-container"
                                      style={{
                                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                                        borderRadius: "10px",
                                        border: "1px solid rgba(255, 255, 255, 0.05)",
                                        maxHeight: "180px",
                                        overflowY: "auto"
                                      }}
                                    >
                                      {history.map((record, index) => {
                                        const isPresent = record.status === "Present";
                                        const isAbsent = record.status === "Absent";
                                        
                                        const timelineBadgeColor = isPresent
                                          ? "#10b981"
                                          : isAbsent
                                            ? "#ef4444"
                                            : "#f59e0b";
                                        const statusEmoji = isPresent
                                          ? "✅"
                                          : isAbsent
                                            ? "❌"
                                            : "⏸️";
                                        
                                        const displayDate = record.attendance_date || record.date || "Unknown Date";

                                        return (
                                          <div
                                            key={index}
                                            className="timeline-item"
                                          >
                                            <span style={{ color: "var(--text-secondary)", fontSize: "13.5px", fontWeight: "500" }}>
                                              📅 {displayDate}
                                            </span>
                                            <span
                                              className="status-badge"
                                              style={{
                                                backgroundColor: `${timelineBadgeColor}20`,
                                                border: `1px solid ${timelineBadgeColor}40`,
                                                color: timelineBadgeColor,
                                                fontSize: "11px",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px"
                                              }}
                                            >
                                              {statusEmoji} {record.status}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Attendance;