import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useFocusTimer } from "../context/FocusTimerContext";

function Dashboard({ setCurrentPage }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [smartAlerts, setSmartAlerts] = useState({ critical: [], warning: [], healthy: [], insights: [] });
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Dashboard Calendar State
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState([]);

  // AI Academic Advisor State
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResponse, setAdvisorResponse] = useState("");
  const [advisorStage, setAdvisorStage] = useState("");
  const [advisorStages, setAdvisorStages] = useState([]);
  const [activeQuery, setActiveQuery] = useState(null);

  // Backend connectivity error state (Task 3)
  const [backendError, setBackendError] = useState(false);

  // ── Focus Timer — consumed from global context (Task 2) ──────────────────
  // The timer state lives in FocusTimerProvider (mounted at App root) so it
  // continues counting even when the user navigates away from the Dashboard.
  const { timeLeft, isActive, startTimer, pauseTimer, resetTimer } = useFocusTimer();
  // Alias to preserve all existing JSX references without modification.
  const timeRemaining = timeLeft;
  const isRunning = isActive;

  useEffect(() => {
    loadDashboardData(true);

    const handleRefresh = () => {
      loadDashboardData(false);
    };

    window.addEventListener("mba-subject-update", handleRefresh);
    window.addEventListener("mba-attendance-update", handleRefresh);
    window.addEventListener("mba-assignment-update", handleRefresh);
    window.addEventListener("mba-event-update", handleRefresh);
    window.addEventListener("mba-indexing-complete", handleRefresh);

    return () => {
      window.removeEventListener("mba-subject-update", handleRefresh);
      window.removeEventListener("mba-attendance-update", handleRefresh);
      window.removeEventListener("mba-assignment-update", handleRefresh);
      window.removeEventListener("mba-event-update", handleRefresh);
      window.removeEventListener("mba-indexing-complete", handleRefresh);
    };
  }, []);

  const loadDashboardData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      console.log("[Dashboard] Fetching dashboard data endpoints...");
      const [statsRes, eventsRes, subjectsRes, allEventsRes, memoryRes, assignmentsRes, smartAlertsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/dashboard/stats"),
        fetch("http://127.0.0.1:8000/events/upcoming"),
        fetch("http://127.0.0.1:8000/subjects"),
        fetch("http://127.0.0.1:8000/events"),
        fetch("http://127.0.0.1:8000/memory"),
        fetch("http://127.0.0.1:8000/assignments"),
        fetch("http://127.0.0.1:8000/dashboard/smart-alerts"),
      ]);

      console.log("[Dashboard] Response statuses:", {
        stats: statsRes.status,
        upcomingEvents: eventsRes.status,
        subjects: subjectsRes.status,
        allEvents: allEventsRes.status,
        memory: memoryRes.status,
        assignments: assignmentsRes.status,
        smartAlerts: smartAlertsRes.status
      });

      if (!statsRes.ok || !eventsRes.ok || !subjectsRes.ok || !allEventsRes.ok || !memoryRes.ok || !assignmentsRes.ok || !smartAlertsRes.ok) {
        if (!statsRes.ok) console.error("[Dashboard] /dashboard/stats failed:", statsRes.status);
        if (!eventsRes.ok) console.error("[Dashboard] /events/upcoming failed:", eventsRes.status);
        if (!subjectsRes.ok) console.error("[Dashboard] /subjects failed:", subjectsRes.status);
        if (!allEventsRes.ok) console.error("[Dashboard] /events failed:", allEventsRes.status);
        if (!memoryRes.ok) console.error("[Dashboard] /memory failed:", memoryRes.status);
        if (!assignmentsRes.ok) console.error("[Dashboard] /assignments failed:", assignmentsRes.status);
        if (!smartAlertsRes.ok) console.error("[Dashboard] /dashboard/smart-alerts failed:", smartAlertsRes.status);
        throw new Error("Failed to fetch dashboard data");
      }

      const statsData = await statsRes.json();
      const eventsData = await eventsRes.json();
      const subjectsData = await subjectsRes.json();
      const allEventsData = await allEventsRes.json();
      const memoryData = await memoryRes.json();
      const assignmentsData = await assignmentsRes.json();
      const smartAlertsData = await smartAlertsRes.json();

      setStats(statsData);
      setUpcomingEvents(Array.isArray(eventsData) ? eventsData.slice(0, 5) : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      const eventsArray = Array.isArray(allEventsData) ? allEventsData : [];
      setAllEvents(eventsArray);
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      setSmartAlerts(smartAlertsData || { critical: [], warning: [], healthy: [], insights: [] });
      
      let totalMemories = 0;
      if (memoryData && typeof memoryData === 'object') {
        Object.values(memoryData).forEach(category => {
          if (category && typeof category === 'object') {
            totalMemories += Object.keys(category).length;
          }
        });
      }
      setMemoryCount(totalMemories);
      
      setBackendError(false); // Successful load — clear any prior connectivity error.
      console.log("[Dashboard] Data loaded successfully");
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setBackendError(true);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };


  const handleAdvisorQuery = async (query) => {
    if (advisorLoading) return;
    
    setAdvisorLoading(true);
    setAdvisorResponse("");
    setAdvisorStage("thinking");
    setAdvisorStages(["thinking"]);
    setActiveQuery(query);
    
    try {
      console.log(`[Advisor] Querying Agent with: "${query}"`);
      const response = await fetch("http://127.0.0.1:8000/chat/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: query,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let textBuffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          textBuffer += chunk;

          const lines = textBuffer.split("\n");
          textBuffer = lines.pop(); // Keep partial line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.status) {
                  setAdvisorStage(parsed.status);
                  setAdvisorStages((prev) => 
                    prev.includes(parsed.status) ? prev : [...prev, parsed.status]
                  );
                } else if (parsed.response) {
                  setAdvisorResponse(parsed.response);
                  setAdvisorStage("complete");
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (parseErr) {
                console.error("Error parsing stream chunk:", parseErr);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[Advisor] Fetch failed:", err);
      const errorMessage = err.message === "Failed to fetch"
        ? "Cannot connect to the AI service. Please check if the backend is running."
        : err.message;
      setAdvisorResponse(`⚠️ Error: ${errorMessage}`);
      setAdvisorStage("error");
    } finally {
      setAdvisorLoading(false);
    }
  };

  // Get alert color based on status field
  const getAlertColor = (status) => {
    if (status === "Healthy") return { bg: "#10b981", text: "🟢 Healthy" };
    if (status === "Warning") return { bg: "#f59e0b", text: "🟡 Warning" };
    if (status === "Critical") return { bg: "#ef4444", text: "🔴 Critical" };
    return { bg: "#94a3b8", text: "⚪ Unknown" };
  };

  // Get subject name by ID
  const getSubjectName = (subjectId) => {
    if (!subjects || subjects.length === 0) return "Loading...";
    
    // Use loose equality == to handle string vs number IDs
    const subject = subjects.find((s) => s.id == subjectId);
    return subject ? subject.name : "Unknown Subject";
  };

  // Calculate days remaining
  const calculateDaysRemaining = (dateStr) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 0) return `In ${diffDays} Days`;
    return "Overdue";
  };

  const getEventTypeEmoji = (eventType) => {
    const eventTypeEmojis = {
      "Exam": "🔴",
      "Assignment": "🟡",
      "Event": "🔵",
      "Reminder": "🟢",
      "Class": "📚",
      "Presentation": "📊"
    };
    return eventTypeEmojis[eventType] || "📅";
  };

  const getEventTypeDetails = (eventType) => {
    const eventTypes = [
      { value: "Exam", label: "🔴 Exam", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.1)" },
      { value: "Assignment", label: "🟡 Assignment", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.1)" },
      { value: "Event", label: "🔵 Event", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" },
      { value: "Reminder", label: "🟢 Reminder", color: "#10b981", bgColor: "rgba(16, 185, 129, 0.1)" },
    ];
    const type = eventTypes.find((t) => t.value === eventType);
    if (type) return type;
    // Map legacy types to "Event"
    if (eventType === "Class" || eventType === "Presentation") {
      return { value: "Event", label: "🔵 Event", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" };
    }
    return { value: "Event", label: "🔵 Event", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" };
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const setTimerPreset = (minutes) => {
    // Pause any running timer before switching preset.
    pauseTimer();
    resetTimer();
    // We can't set an arbitrary duration through the context without extending
    // the API, so we fall through to context reset (45 min) for now.
    // For 15 and 25 min presets the timer widget would need a separate duration
    // state — kept as a local state below to avoid a breaking context change.
    setLocalPresetSeconds(minutes * 60);
  };

  // Local override for non-default presets (15 m / 25 m).
  // When a preset is active, timeRemaining reads from localPresetSeconds;
  // Start/Pause/Reset use the context API against the context timer.
  const [localPresetSeconds, setLocalPresetSeconds] = useState(null);
  const displaySeconds = localPresetSeconds !== null ? localPresetSeconds : timeRemaining;

  const getCalendarDays = (month, year) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return { days, daysInMonth, startingDayOfWeek };
  };

  const formatDateForComparison = (day, month, year) => {
    const monthStr = String(month + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${monthStr}-${dayStr}`;
  };

  const hasEventsOnDate = (day, month, year) => {
    const dateStr = formatDateForComparison(day, month, year);
    return allEvents.some((event) => event.event_date === dateStr);
  };

  const getEventsForDate = (day, month, year) => {
    const dateStr = formatDateForComparison(day, month, year);
    return allEvents.filter((event) => event.event_date === dateStr);
  };

  const getEventColorsForDate = (day, month, year) => {
    const dateStr = formatDateForComparison(day, month, year);
    return allEvents
      .filter((event) => event.event_date === dateStr)
      .map((event) => getEventTypeDetails(event.event_type).color);
  };

  const isToday = (day, checkMonth, checkYear) => {
    const today = new Date();
    return day === today.getDate() && checkMonth === today.getMonth() && checkYear === today.getFullYear();
  };

  const handlePreviousMonth = () => {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(displayYear - 1); } 
    else { setDisplayMonth(displayMonth - 1); }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(displayYear + 1); } 
    else { setDisplayMonth(displayMonth + 1); }
  };

  const handleToday = () => {
    const today = new Date();
    setDisplayMonth(today.getMonth());
    setDisplayYear(today.getFullYear());
    setSelectedDate(today.getDate());
  };

  const handleDateClick = (day) => {
    if (day) {
      setSelectedDate(day);
      setSelectedDateEvents(getEventsForDate(day, displayMonth, displayYear));
    }
  };

  // Generate Quick Insights
  const generateInsights = () => {
    const insights = [];
    
    // Attendance Insights
    if (alerts.length > 0) {
      const critical = alerts.find(a => a.status === "Critical");
      if (critical) {
        insights.push(`⚠ ${critical.subject} attendance is ${critical.attendance}% and requires attention.`);
      } else {
        const healthy = alerts.find(a => a.status === "Healthy");
        if (healthy) {
          insights.push(`✅ ${healthy.subject} attendance is healthy at ${healthy.attendance}%.`);
        }
      }
    }

    // Events Insights
    if (upcomingEvents.length === 0) {
      insights.push("📅 No upcoming events scheduled.");
    } else {
      insights.push(`📅 You have ${upcomingEvents.length} upcoming events to prepare for.`);
    }

    // Memory Insights
    if (memoryCount > 0) {
      insights.push(`🧠 ${memoryCount} memories stored successfully.`);
    }

    // Subject Insights
    if (subjects.length > 0) {
      insights.push(`📚 Currently tracking ${subjects.length} subjects.`);
    }

    return insights;
  };

  // Get dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    const firstName = "Ritwam"; // Extracted from "Dr. Ritwam Mukhopadhyay"

    if (hour < 12) return { text: `Good Morning, ${firstName}`, emoji: "☀️" };
    if (hour < 18) return { text: `Good Afternoon, ${firstName}`, emoji: "🌤️" };
    return { text: `Good Evening, ${firstName}`, emoji: "🌙" };
  };

  const greeting = getGreeting();

  const todayStr = new Date().toISOString().split("T")[0];
  const overdueAssignments = assignments.filter((a) => a.status !== "Completed" && a.due_date < todayStr).length;
  const activeAssignments = assignments.filter((a) => a.status !== "Completed" && a.due_date >= todayStr).length;
  const completedAssignments = assignments.filter((a) => a.status === "Completed").length;
  if (loading) {
    return (
      <div style={{ padding: "20px", backgroundColor: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)" }}>
        <h1 style={{ textAlign: "center", marginTop: "50px" }}>Welcome to the Dashboard 📊</h1>
        <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ 
      padding: "25px 30px", width: "100%",
      backgroundColor: "var(--bg-primary)", boxSizing: "border-box", minHeight: "100vh",
      color: "var(--text-primary)", fontFamily: "Inter, system-ui, sans-serif"
    }}>
      <style>
        {`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.98); }
          }
          
          /* Advisor Markdown Styles */
          .advisor-markdown h1, .advisor-markdown h2, .advisor-markdown h3, .advisor-markdown h4 {
            color: #ffffff;
            font-weight: 700;
            margin-top: 12px;
            margin-bottom: 6px;
            line-height: 1.3;
          }
          .advisor-markdown p { margin-top: 0; margin-bottom: 8px; line-height: 1.5; }
          .advisor-markdown ul, .advisor-markdown ol { margin-top: 0; margin-bottom: 8px; padding-left: 18px; }
          .advisor-markdown table {
            display: block; width: 100%; overflow-x: auto; border-collapse: separate; border-spacing: 0;
            margin: 10px 0; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;
          }
          .advisor-markdown th, .advisor-markdown td {
            padding: 6px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 0.8rem;
          }
        `}
      </style>

      {/* ── Backend Offline Warning Banner (Task 3) ────────────────────────── */}
      {backendError && (
        <div
          role="alert"
          id="dashboard-backend-offline-banner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "10px",
            padding: "12px 18px",
            marginBottom: "18px",
            color: "#fca5a5",
            fontSize: "0.9rem",
            fontWeight: "600",
          }}
        >
          <span>
            ⚠️ <strong style={{ color: "#f87171" }}>Backend Offline</strong> — Cannot connect to the
            MBA Copilot server. Dashboard data may be stale. Ensure the backend is running and
            click{" "}
            <strong style={{ color: "#f87171" }}>Refresh</strong>.
          </span>
          <button
            onClick={() => { setBackendError(false); loadDashboardData(false); }}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "6px",
              color: "#fca5a5",
              cursor: "pointer",
              padding: "4px 12px",
              fontSize: "0.8rem",
              fontWeight: "700",
              whiteSpace: "nowrap",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.28)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.15)")}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* HEADER ROW - Greeting & Quick Actions */}
      <div className="dashboard-action-buttons" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", flexWrap: "wrap", gap: "15px" }}>
        <div style={{ fontSize: "1.7rem", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {greeting.text} {greeting.emoji}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { label: "🔄 Refresh", onClick: () => loadDashboardData(false) },
            { label: "📚 Subjects", onClick: () => setCurrentPage("Subjects") },
            { label: "📊 Attendance", onClick: () => setCurrentPage("Attendance") },
            { label: "📝 Assignments", onClick: () => setCurrentPage("Assignments") },
            { label: "💬 Chat", onClick: () => setCurrentPage("Chat") }
          ].map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.onClick}
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(51, 65, 85, 0.8)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: "500",
                padding: "6px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(30, 41, 59, 0.8)";
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.6)";
                e.currentTarget.style.color = "#cbd5e1";
                e.currentTarget.style.transform = "translateY(0px)";
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* HERO SECTION - Academic Health Score Card + 6 Statistics Cards */}
      <div className="dashboard-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginBottom: "22px" }}>
        
        {/* Academic Health Score Card */}
        <div 
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(51, 65, 85, 0.6)",
            borderRadius: "12px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            transition: "all 0.3s ease"
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)"}
        >
          {/* Subtle glowing radial background */}
          <div style={{
            position: "absolute",
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: stats?.health_score >= 90 ? "rgba(16, 185, 129, 0.1)" : stats?.health_score >= 80 ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
            filter: "blur(35px)",
            zIndex: 0
          }} />
          
          <div style={{ zIndex: 1 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Academic Health Score
            </div>
            
            {/* Clean numeric badge flanked by status tag */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              margin: "15px 0"
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
                <span style={{ fontSize: "2.8rem", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.03em" }}>
                  {stats?.health_score ?? 100}
                </span>
                <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                  /100
                </span>
              </div>
              
              {/* Soft status tag badge */}
              <div style={{
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.05em",
                textTransform: "uppercase"
              }}>
                {stats?.health_rating ?? "Excellent"}
              </div>
            </div>
          </div>
        </div>
        
        {/* 6 Statistics Cards Grid */}
        <div className="dashboard-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {[
            { label: "Subjects",             value: stats?.subjects ?? 0,              icon: "📚", color: "#3b82f6",  navTarget: "Subjects"      },
            { label: "Avg Attendance",        value: `${stats?.overall_attendance ?? 0}%`, icon: "📊", color: (stats?.overall_attendance ?? 0) >= 80 ? "#22c55e" : (stats?.overall_attendance ?? 0) >= 75 ? "#f59e0b" : "#ef4444", navTarget: "Attendance"    },
            { label: "Pending Assignments",   value: stats?.pending_assignments ?? 0,   icon: "📝", color: (stats?.pending_assignments ?? 0) > 0 ? "#ef4444" : "#22c55e", navTarget: "Assignments"   },
            { label: "Upcoming Exams",        value: stats?.upcoming_exams ?? 0,        icon: "🎯", color: (stats?.upcoming_exams ?? 0) > 0 ? "#ef4444" : "#22c55e",        navTarget: "Exam Planner"  },
            { label: "Indexed PDFs",          value: stats?.pdfs ?? 0,                  icon: "📄", color: "#8b5cf6",  navTarget: null            },
            { label: "Indexed Chunks",        value: stats?.indexed_chunks ?? 0,        icon: "🧩", color: "#ec4899",  navTarget: null            },
          ].map((stat, idx) => (
            <div
              key={idx}
              onClick={() => stat.navTarget && setCurrentPage(stat.navTarget)}
              role={stat.navTarget ? "button" : undefined}
              tabIndex={stat.navTarget ? 0 : undefined}
              onKeyDown={(e) => {
                if (stat.navTarget && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setCurrentPage(stat.navTarget);
                }
              }}
              style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.6) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: "12px",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "all 0.2s",
                backdropFilter: "blur(8px)",
                cursor: stat.navTarget ? "pointer" : "default",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = stat.navTarget
                  ? "rgba(139, 92, 246, 0.45)"
                  : "rgba(139, 92, 246, 0.3)";
                e.currentTarget.style.boxShadow = stat.navTarget
                  ? "0 8px 24px rgba(139, 92, 246, 0.18)"
                  : "0 8px 20px rgba(139, 92, 246, 0.12)";
                if (stat.navTarget) {
                  const chip = e.currentTarget.querySelector(".nav-chip");
                  if (chip) chip.style.opacity = "1";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.07)";
                e.currentTarget.style.boxShadow = "none";
                if (stat.navTarget) {
                  const chip = e.currentTarget.querySelector(".nav-chip");
                  if (chip) chip.style.opacity = "0";
                }
              }}
            >
              <div style={{ fontSize: "1.8rem" }}>{stat.icon}</div>
              <div style={{ textAlign: "left", overflow: "hidden", flex: 1 }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: "800", color: stat.color, marginTop: "2px" }}>
                  {stat.value}
                </div>
              </div>
              {/* Hover navigation chip — only for navigable cards */}
              {stat.navTarget && (
                <div
                  className="nav-chip"
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "10px",
                    backgroundColor: "rgba(139, 92, 246, 0.18)",
                    border: "1px solid rgba(139, 92, 246, 0.35)",
                    borderRadius: "6px",
                    padding: "2px 7px",
                    fontSize: "0.68rem",
                    fontWeight: "700",
                    color: "#c4b5fd",
                    letterSpacing: "0.03em",
                    opacity: "0",
                    transition: "opacity 0.18s",
                    pointerEvents: "none",
                  }}
                >
                  View →
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* TWO COLUMN GRID LAYOUT: Left (70%) & Right (30%) */}
      <div className="dashboard-main-grid" style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: "20px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: Focus Panel, Calendar, Smart Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Focus Panel Widget */}
          <div 
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "12px",
              padding: "20px",
              color: "var(--text-primary)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, fontSize: "11px", fontWeight: "700", letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🎯 Focus Panel</span>
              </h3>
              {stats?.focus_panel?.attendance_risk && (
                <span style={{
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  color: "#fbbf24",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  Attendance Risk: {stats.focus_panel.attendance_risk}
                </span>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div className="dashboard-focus-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(139, 92, 246, 0.15)", borderRadius: "8px", padding: "12px 15px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject Needing Attention</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#ffffff", marginTop: "4px" }}>
                    {stats?.focus_panel?.subject_needing_attention || "None"}
                  </div>
                </div>

                <div style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(96, 165, 250, 0.15)", borderRadius: "8px", padding: "12px 15px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggested Action</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: "600", color: "#60a5fa", marginTop: "4px", lineHeight: "1.4" }}>
                    {stats?.focus_panel?.suggested_action || "None"}
                  </div>
                </div>
              </div>

              <div style={{ 
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)",
                border: "1px solid rgba(139, 92, 246, 0.2)", 
                borderRadius: "8px", 
                padding: "15px",
                lineHeight: "1.5"
              }}>
                <div style={{ fontSize: "0.8rem", color: "#c4b5fd", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🤖</span> AI Recommendation
                </div>
                <div style={{ fontSize: "0.92rem", color: "#e2e8f0" }}>
                  {stats?.focus_panel?.ai_recommendation || "No recommendation available."}
                </div>
              </div>
            </div>
          </div>

          {/* Academic Calendar Widget */}
          <div 
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "12px",
              padding: "20px",
              color: "var(--text-primary)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, fontSize: "11px", fontWeight: "700", letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📅 Academic Calendar</span>
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={handlePreviousMonth} style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>‹</button>
                <button onClick={handleToday} style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>Today</button>
                <button onClick={handleNextMonth} style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>›</button>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: "1.05rem", fontWeight: "bold", marginBottom: "12px" }}>
              {new Date(displayYear, displayMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", paddingBottom: "4px" }}>{day}</div>
              ))}
              {getCalendarDays(displayMonth, displayYear).days.map((day, i) => (
                <div 
                  key={i} 
                  onClick={() => handleDateClick(day)}
                  style={{ 
                    padding: "2.5px 0", cursor: day ? "pointer" : "default", 
                    backgroundColor: day && isToday(day, displayMonth, displayYear) ? "#2563eb" : "transparent",
                    border: day ? "1px solid rgba(255,255,255,0.03)" : "none",
                    borderRadius: "6px",
                    color: day && isToday(day, displayMonth, displayYear) ? "white" : (day ? "white" : "transparent"),
                    position: "relative"
                  }}
                >
                  {day}
                  {day && hasEventsOnDate(day, displayMonth, displayYear) && (
                    <div style={{ position: "absolute", bottom: "3px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "2px" }}>
                      {getEventColorsForDate(day, displayMonth, displayYear).map((color, idx) => (
                        <div key={idx} style={{ width: "3px", height: "3px", borderRadius: "50%", backgroundColor: color }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedDate && (
              <div style={{ marginTop: "15px", padding: "12px", backgroundColor: "var(--bg-primary)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "0.9rem" }}>Events for {selectedDate} {new Date(displayYear, displayMonth).toLocaleString('default', { month: 'long' })}:</div>
                {selectedDateEvents.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedDateEvents.map((event, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", padding: "6px 10px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
                        <span>{getEventTypeEmoji(event.event_type)}</span>
                        <span>{event.title} - {event.event_time || "All Day"}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>No events scheduled.</div>}
              </div>
            )}
          </div>

          {/* Smart Alerts Widget */}
          <div 
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "12px",
              padding: "20px",
              color: "var(--text-primary)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, fontSize: "11px", fontWeight: "700", letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠️ Smart Alerts</span>
              </h3>
              {(smartAlerts.warning?.length > 0 || smartAlerts.healthy?.length > 0) && (
                <button
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    color: "#c4b5fd",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.backgroundColor = "rgba(139, 92, 246, 0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#c4b5fd"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }}
                >
                  {showAllAlerts ? "Show Less" : `Show More (${(smartAlerts.warning?.length || 0) + (smartAlerts.healthy?.length || 0)})`}
                </button>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              
              {/* Critical Alerts (🔴) */}
              {smartAlerts.critical && smartAlerts.critical.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>🔴</span> Critical Alerts ({smartAlerts.critical.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {smartAlerts.critical.map((alert, idx) => (
                      <div key={"crit-" + idx} style={{
                        backgroundColor: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderLeft: "4px solid #ef4444",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        fontSize: "0.88rem",
                        color: "#fca5a5"
                      }}>
                        {alert.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning Alerts (🟡) */}
              {showAllAlerts && smartAlerts.warning && smartAlerts.warning.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>🟡</span> Warning Alerts ({smartAlerts.warning.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {smartAlerts.warning.map((alert, idx) => (
                      <div key={"warn-" + idx} style={{
                        backgroundColor: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        borderLeft: "4px solid #f59e0b",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        fontSize: "0.88rem",
                        color: "#fde047"
                      }}>
                        {alert.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Healthy Alerts (🟢) */}
              {showAllAlerts && smartAlerts.healthy && smartAlerts.healthy.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>🟢</span> Healthy Status ({smartAlerts.healthy.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {smartAlerts.healthy.map((alert, idx) => (
                      <div key={"hlth-" + idx} style={{
                        backgroundColor: "rgba(16, 185, 129, 0.05)",
                        border: "1px solid rgba(16, 185, 129, 0.15)",
                        borderLeft: "4px solid #10b981",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        fontSize: "0.88rem",
                        color: "#a7f3d0"
                      }}>
                        {alert.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty / Placeholder states */}
              {(!smartAlerts.critical?.length && !smartAlerts.warning?.length && !smartAlerts.healthy?.length) && (
                <div style={{ padding: "12px", backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "6px", color: "#10b981", fontSize: "0.9rem" }}>
                  ✅ No active alerts.
                </div>
              )}

              {(!smartAlerts.critical?.length && (smartAlerts.warning?.length > 0 || smartAlerts.healthy?.length > 0) && !showAllAlerts) && (
                <div style={{ padding: "12px", background: "linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(37, 99, 235, 0.06) 100%)", border: "1px solid rgba(139, 92, 246, 0.15)", borderRadius: "6px", color: "#c4b5fd", fontSize: "0.9rem", textAlign: "center" }}>
                  🌿 No critical alerts. Click <strong style={{color: "#a78bfa"}}>Show More</strong> to view warnings and status checks.
                </div>
              )}

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Quick Insights, Advisor, Focus Timer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Quick Insights Widget */}
          <div 
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "12px",
              padding: "20px",
              color: "var(--text-primary)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)"}
          >
            <h3 style={{ margin: "0 0 15px 0", fontSize: "11px", fontWeight: "700", letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>📌 Quick Insights</span>
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(smartAlerts.insights || []).map((insight, idx) => {
                let borderCol = "#3b82f6";
                let bgCol = "rgba(59, 130, 246, 0.05)";
                if (insight.startsWith("⚠️") || insight.startsWith("⚠")) {
                  borderCol = "#f59e0b";
                  bgCol = "rgba(245, 158, 11, 0.05)";
                } else if (insight.startsWith("🟢") || insight.startsWith("✅")) {
                  borderCol = "#10b981";
                  bgCol = "rgba(16, 185, 129, 0.05)";
                }
                
                // Sanitize filename database timestamp prefixes in insights list
                const sanitizedInsight = insight.replace(/\b\d{8}_\d{6}_/g, "");
                
                return (
                  <div key={idx} style={{
                    padding: "12px 14px",
                    backgroundColor: bgCol,
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                    borderLeft: `4px solid ${borderCol}`,
                    color: "var(--text-primary)",
                    lineHeight: "1.4"
                  }}>
                    {sanitizedInsight}
                  </div>
                );
              })}
              {(!smartAlerts.insights || smartAlerts.insights.length === 0) && (
                <div style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.9rem" }}>
                  No active insights available.
                </div>
              )}
            </div>
          </div>

          {/* AI Academic Advisor Widget */}
          <div 
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "12px",
              padding: "20px",
              color: "var(--text-primary)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)"}
          >
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: "700", letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🧠 AI Academic Advisor</span>
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Proactive analysis of your courses, workload, schedule, and study patterns.
              </p>
            </div>

            {/* Buttons Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "8px"
            }}>
              {[
                { label: "What should I study today?", icon: "📚", text: "What should I study today?" },
                { label: "Plan my week", icon: "📅", text: "Plan my week" },
                { label: "What needs attention?", icon: "⚠️", text: "What needs attention?" },
                { label: "Exam Strategy", icon: "🎯", text: "Exam Strategy" },
                { label: "Prioritize my tasks", icon: "📋", text: "Prioritize my tasks" },
                { label: "Academic Health Report", icon: "📈", text: "Academic Health Report" }
              ].map((btn, index) => (
                <button
                  key={index}
                  disabled={advisorLoading}
                  onClick={() => handleAdvisorQuery(btn.text)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    backgroundColor: activeQuery === btn.text ? "rgba(37, 99, 235, 0.15)" : "var(--bg-primary)",
                    border: activeQuery === btn.text ? "1px solid var(--accent)" : "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    color: "var(--text-primary)",
                    fontSize: "0.88rem",
                    fontWeight: "600",
                    cursor: advisorLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    textAlign: "left"
                  }}
                  onMouseEnter={(e) => {
                    if (!advisorLoading && activeQuery !== btn.text) {
                      e.currentTarget.style.borderColor = "var(--accent)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeQuery !== btn.text) {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{btn.icon}</span>
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>

            {/* Response Card Container */}
            {(activeQuery || advisorLoading) && (
              <div style={{
                backgroundColor: "var(--bg-primary)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "8px",
                padding: "15px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                position: "relative"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  paddingBottom: "8px",
                  fontSize: "0.8rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span>Selected:</span>
                    <strong style={{ color: "var(--text-primary)", whiteSpace: "nowrap" }}>{activeQuery}</strong>
                  </div>
                  
                  {/* Status Badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                    {advisorLoading ? (
                      <>
                        <div style={{
                          width: "10px",
                          height: "10px",
                          border: "2px solid rgba(255,255,255,0.1)",
                          borderTop: "2px solid var(--accent)",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite"
                        }} />
                        <span style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.75rem" }}>
                          Thinking...
                        </span>
                      </>
                    ) : (
                      <span style={{ color: advisorStage === "error" ? "#ef4444" : "#10b981", fontWeight: "bold", fontSize: "0.75rem" }}>
                        {advisorStage === "error" ? "❌ Error" : "🟢 Ready"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Response content */}
                <div 
                  className="markdown-container advisor-markdown" 
                  style={{
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                    maxHeight: "350px",
                    overflowY: "auto",
                    paddingRight: "6px",
                    color: "var(--text-primary)"
                  }}
                >
                  {advisorLoading && !advisorResponse ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "5px 0" }}>
                      {advisorStages.map((stage, idx) => {
                        let icon = "🤖";
                        let text = "Analyzing database records...";
                        if (stage === "searching_memory") {
                          icon = "🔍";
                          text = "Checking student memory...";
                        } else if (stage === "searching_web") {
                          icon = "🌐";
                          text = "Searching online resources...";
                        }
                        const isCurrent = advisorStage === stage;
                        return (
                          <div key={stage + "-" + idx} style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: isCurrent ? "#ffffff" : "#64748b",
                            fontWeight: isCurrent ? "600" : "400",
                            fontSize: "0.85rem",
                            animation: isCurrent ? "pulse 1.5s infinite ease-in-out" : "none"
                          }}>
                            <span style={{ fontSize: "1rem" }}>{icon}</span>
                            <span>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {advisorResponse}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Footer controls for response */}
                {!advisorLoading && (
                  <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    paddingTop: "8px"
                  }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(advisorResponse);
                      }}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        color: "var(--text-secondary)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => {
                        setActiveQuery(null);
                        setAdvisorResponse("");
                        setAdvisorStage("");
                        setAdvisorStages([]);
                      }}
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.15)",
                        color: "#fca5a5",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "all 0.2s"
                      }}
                    >
                      🗑️ Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Focus Timer Widget */}
          <div style={{ background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(30, 41, 59, 0.6) 100%)", border: "1px solid rgba(139, 92, 246, 0.2)", boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08)", backdropFilter: "blur(10px)", borderRadius: "12px", padding: "20px", color: "var(--text-primary)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 15px 0", fontSize: "1.2rem" }}>⏱ Focus Timer</h3>
            <div style={{ fontSize: "2.8rem", fontWeight: "bold", color: "#8b5cf6", marginBottom: "15px", fontFamily: "monospace" }}>
              {formatTime(displaySeconds)}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "15px" }}>
              <button
                onClick={() => isRunning ? pauseTimer() : startTimer()}
                style={{ backgroundColor: isRunning ? "#ef4444" : "#2563eb", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                {isRunning ? "Pause" : "Start"}
              </button>
              <button
                onClick={() => { setLocalPresetSeconds(null); resetTimer(); }}
                style={{ backgroundColor: "#475569", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              >
                Reset
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
              {[15, 25, 45].map(min => (
                <button 
                  key={min} 
                  onClick={() => setTimerPreset(min)} 
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "4px", padding: "3px 6px", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;