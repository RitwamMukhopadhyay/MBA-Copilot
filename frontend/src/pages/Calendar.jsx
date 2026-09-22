import { useEffect, useState } from "react";

function Calendar({ setCurrentPage }) {
  // State Management
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [editingEventId, setEditingEventId] = useState(null);
  const [openEventGroups, setOpenEventGroups] = useState({
    Exam: true,
    Assignment: false,
    Event: false,
    Reminder: false,
    ExamCompleted: false,
    AssignmentCompleted: false,
    EventCompleted: false,
    ReminderCompleted: false,
  });
  const [openSections, setOpenSections] = useState({
    allEvents: true,
    completedEvents: false,
  });
  const [completedEvents, setCompletedEvents] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    event_type: "Event",
    event_date: "",
    event_time: "",
    description: "",
  });

  // Event Type Configuration with Colors (🔴 Exam, 🟡 Assignment, 🔵 Event, 🟢 Reminder)
  const eventTypes = [
    { value: "Exam", label: "🔴 Exam", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.1)" },
    { value: "Assignment", label: "🟡 Assignment", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.1)" },
    { value: "Event", label: "🔵 Event", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" },
    { value: "Reminder", label: "🟢 Reminder", color: "#10b981", bgColor: "rgba(16, 185, 129, 0.1)" },
  ];

  // Fetch initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("[Calendar] Fetching calendar data endpoints...");
      const [upcomingRes, eventsRes, subjectsRes, completedRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/events/upcoming"),
        fetch("http://127.0.0.1:8000/events"),
        fetch("http://127.0.0.1:8000/subjects"),
        fetch("http://127.0.0.1:8000/events/completed"),
      ]);

      console.log("[Calendar] Response statuses:", {
        upcoming: upcomingRes.status,
        events: eventsRes.status,
        subjects: subjectsRes.status,
        completed: completedRes.status
      });

      if (!upcomingRes.ok || !eventsRes.ok || !subjectsRes.ok || !completedRes.ok) {
        if (!upcomingRes.ok) console.error("[Calendar] /events/upcoming failed:", upcomingRes.status);
        if (!eventsRes.ok) console.error("[Calendar] /events failed:", eventsRes.status);
        if (!subjectsRes.ok) console.error("[Calendar] /subjects failed:", subjectsRes.status);
        if (!completedRes.ok) console.error("[Calendar] /events/completed failed:", completedRes.status);
        throw new Error("Failed to fetch data");
      }

      const upcomingData = await upcomingRes.json();
      const eventsData = await eventsRes.json();
      const subjectsData = await subjectsRes.json();
      const completedData = await completedRes.json();

      setUpcomingEvents(Array.isArray(upcomingData) ? upcomingData.slice(0, 5) : []);
      setAllEvents(Array.isArray(eventsData) ? eventsData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setCompletedEvents(Array.isArray(completedData) ? completedData : []);
    } catch (err) {
      setError("Error loading calendar data. Please try again.");
      console.error("Error loading calendar:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle add/edit event submission
  const handleAddEvent = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      setError("Please enter event title");
      return;
    }
    if (!formData.event_type) {
      setError("Please select event type");
      return;
    }
    if (!formData.event_date) {
      setError("Please select event date");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        editingEventId
          ? `http://127.0.0.1:8000/events/${editingEventId}`
          : "http://127.0.0.1:8000/events",
        {
          method: editingEventId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formData.title,
            subject_id: formData.subject_id ? parseInt(formData.subject_id) : null,
            event_type: formData.event_type,
            event_date: formData.event_date,
            event_time: formData.event_time || null,
            description: formData.description || "",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save event");
      }

      // Reset form and reload data
      setFormData({
        title: "",
        subject_id: "",
        event_type: "Event",
        event_date: "",
        event_time: "",
        description: "",
      });

      setEditingEventId(null);
      setIsModalOpen(false);

      const msgType = editingEventId ? "updated" : "added";
      setSuccessMessage(`✅ Event ${msgType} successfully!`);
      setTimeout(() => setSuccessMessage(""), 3000);

      await loadAllData();
      window.dispatchEvent(new CustomEvent("mba-event-update"));
    } catch (err) {
      setError("Error saving event. Please try again.");
      console.error("Error saving event:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete event
  const handleDeleteEvent = async (eventId) => {
    if (confirm("Are you sure you want to delete this event?")) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/events/${eventId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete event");
        }

        await loadAllData();
        window.dispatchEvent(new CustomEvent("mba-event-update"));
      } catch (err) {

        setError("Error deleting event. Please try again.");
        console.error("Error deleting event:", err);
      }
    }
  };

  // Handle edit event
  const handleEditEvent = (event) => {
    setEditingEventId(event.id);
    setFormData({
      title: event.title || "",
      subject_id: String(event.subject_id || ""),
      event_type: event.event_type || "Event",
      event_date: event.event_date || "",
      event_time: event.event_time || "",
      description: event.description || "",
    });
    // Ensure modal is open to present the editing form
    setIsModalOpen(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingEventId(null);
    setFormData({
      title: "",
      subject_id: "",
      event_type: "Event",
      event_date: selectedDate
        ? formatDateForComparison(selectedDate, displayMonth, displayYear)
        : "",
      event_time: "",
      description: "",
    });
    setError("");
  };

  // Get subject name by ID
  const getSubjectName = (subjectId) => {
    if (!subjectId) return "No Subject";
    const subject = subjects.find((s) => s.id === subjectId);
    return subject ? subject.name : "Unknown Subject";
  };

  // Get event type details with legacy mappings fallback
  const getEventTypeDetails = (eventType) => {
    const type = eventTypes.find((t) => t.value === eventType);
    if (type) return type;
    // Map legacy types to "Event"
    if (eventType === "Class" || eventType === "Presentation") {
      return { value: "Event", label: "🔵 Event", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" };
    }
    return { value: "Event", label: "🔵 Event", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" };
  };

  // Get event type emoji
  const getEventTypeEmoji = (eventType) => {
    const type = getEventTypeDetails(eventType);
    return type.label.split(" ")[0];
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

  // Get events for selected date
  const getEventsForDate = (dateStr) => {
    return allEvents.filter((event) => event.event_date === dateStr);
  };

  // Calculate statistics
  const calculateStats = () => {
    return {
      total: allEvents.length,
      exams: allEvents.filter((e) => e.event_type === "Exam").length,
      assignments: allEvents.filter((e) => e.event_type === "Assignment").length,
      reminders: allEvents.filter((e) => e.event_type === "Reminder").length,
    };
  };

  // Get calendar days based on display month and year
  const getCalendarDays = (displayMonth, displayYear) => {
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return { days, month: displayMonth, year: displayYear };
  };

  // Navigate to previous month
  const handlePreviousMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  // Navigate to next month
  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  // Return to today
  const handleToday = () => {
    const today = new Date();
    setDisplayMonth(today.getMonth());
    setDisplayYear(today.getFullYear());
    setSelectedDate(today.getDate());
  };

  // Handle date cell clicks
  const handleDateClick = (day) => {
    if (day) {
      setSelectedDate(day);
      const clickedDateStr = formatDateForComparison(day, displayMonth, displayYear);
      setFormData({
        title: "",
        subject_id: "",
        event_type: "Event",
        event_date: clickedDateStr,
        event_time: "",
        description: "",
      });
      setEditingEventId(null);
      setIsModalOpen(true);
    }
  };

  // Handle mouse wheel scrolling over calendar header
  const handleCalendarWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleNextMonth();
    } else {
      handlePreviousMonth();
    }
  };

  // Format date to YYYY-MM-DD for comparison
  const formatDateForComparison = (day, month, year) => {
    const monthStr = String(month + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${monthStr}-${dayStr}`;
  };

  // Check if date has events
  const hasEventsOnDate = (day, checkMonth, checkYear) => {
    const dateStr = formatDateForComparison(day, checkMonth, checkYear);
    return allEvents.some((event) => event.event_date === dateStr);
  };

  // Check if date is today
  const isDateToday = (day, checkMonth, checkYear) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      checkMonth === today.getMonth() &&
      checkYear === today.getFullYear()
    );
  };

  // Get event type colors for a date
  const getEventTypesForDate = (day, checkMonth, checkYear) => {
    const dateStr = formatDateForComparison(day, checkMonth, checkYear);
    return allEvents
      .filter((event) => event.event_date === dateStr)
      .map((event) => getEventTypeDetails(event.event_type).color);
  };

  const { days, month, year } = getCalendarDays(displayMonth, displayYear);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const stats = calculateStats();

  const eventTypeLabels = {
    Exam: "Exams",
    Assignment: "Assignments",
    Event: "Events",
    Reminder: "Reminders",
  };

  const groupedEvents = {
    Exam: allEvents.filter(
      (event) => event.event_type === "Exam" && event.is_completed === 0
    ),
    Assignment: allEvents.filter(
      (event) => event.event_type === "Assignment" && event.is_completed === 0
    ),
    Event: allEvents.filter(
      (event) => (event.event_type === "Event" || event.event_type === "Class" || event.event_type === "Presentation") && event.is_completed === 0
    ),
    Reminder: allEvents.filter(
      (event) => event.event_type === "Reminder" && event.is_completed === 0
    ),
  };

  const groupedCompletedEvents = {
    Exam: completedEvents.filter(
      (event) => event.event_type === "Exam"
    ),
    Assignment: completedEvents.filter(
      (event) => event.event_type === "Assignment"
    ),
    Event: completedEvents.filter(
      (event) => event.event_type === "Event" || event.event_type === "Class" || event.event_type === "Presentation"
    ),
    Reminder: completedEvents.filter(
      (event) => event.event_type === "Reminder"
    ),
  };

  // Get selected date events
  const selectedDateStr = selectedDate
    ? formatDateForComparison(selectedDate, month, year)
    : null;
  const selectedDateEvents = selectedDateStr ? getEventsForDate(selectedDateStr) : [];

  if (loading) {
    return (
      <div style={{ padding: "20px" }}>
        <div
          style={{
            fontSize: "2.5rem",
            fontWeight: "bold",
            color: "var(--text-primary)",
            marginBottom: "20px",
          }}
        >
          📅 Academic Calendar
        </div>
        <p style={{ color: "var(--text-secondary)" }}>Loading calendar...</p>
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

  const modalContentStyle = {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    padding: "24px 30px",
    width: "90%",
    maxWidth: "650px",
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    position: "relative",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  };

  return (
    <div className="saas-container">
      <div className="saas-wrapper">
        {/* Page Title & Add Button Row */}
        <div className="saas-header">
          <h1 className="saas-title">📅 Academic Calendar</h1>
          <p className="saas-subtitle">Schedule exams, log milestones, track academic events and reminders.</p>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              onClick={() => {
                const today = new Date();
                setSelectedDate(today.getDate());
                setFormData({
                  title: "",
                  subject_id: "",
                  event_type: "Event",
                  event_date: formatDateForComparison(today.getDate(), today.getMonth(), today.getFullYear()),
                  event_time: "",
                  description: "",
                });
                setEditingEventId(null);
                setIsModalOpen(true);
              }}
              className="saas-button saas-button-primary"
            >
              ➕ Add New Event
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#86efac", padding: "12px", borderRadius: "8px" }}>
            {successMessage}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="saas-stats-grid">
          <div className="saas-stat-card">
            <div className="saas-stat-emoji">📅</div>
            <div className="saas-stat-label">Total Events</div>
            <div className="saas-stat-value" style={{ color: "#3b82f6" }}>{stats.total}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🔴</div>
            <div className="saas-stat-label">Exams</div>
            <div className="saas-stat-value" style={{ color: "#ef4444" }}>{stats.exams}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🟡</div>
            <div className="saas-stat-label">Assignments</div>
            <div className="saas-stat-value" style={{ color: "#f59e0b" }}>{stats.assignments}</div>
          </div>

          <div className="saas-stat-card">
            <div className="saas-stat-emoji">🟢</div>
            <div className="saas-stat-label">Reminders</div>
            <div className="saas-stat-value" style={{ color: "#10b981" }}>{stats.reminders}</div>
          </div>
        </div>

      {/* CSS Styles for Responsive Grid */}
      <style>{`
        .calendar-page-layout {
          display: grid;
          grid-template-columns: 7fr 3fr;
          gap: 20px;
          margin-bottom: 25px;
          align-items: stretch;
        }

        .calendar-left-col {
          grid-column: 1;
        }

        .upcoming-events-sidebar {
          grid-column: 2;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          height: 100%;
        }

        .upcoming-events-scrollable {
          flex: 1;
          overflow-y: auto;
          max-height: 420px;
          padding-right: 5px;
        }

        @media (max-width: 1024px) {
          .calendar-page-layout {
            grid-template-columns: 1fr !important;
          }
          .calendar-left-col {
            grid-column: 1 !important;
          }
          .upcoming-events-sidebar {
            grid-column: 1 !important;
            height: auto !important;
          }
          .upcoming-events-scrollable {
            max-height: none !important;
          }
        }
      `}</style>

      <div className="calendar-page-layout">
        {/* Left Column: Calendar */}
        <div className="calendar-left-col saas-card">
          {/* Calendar Header with Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
            onWheel={handleCalendarWheel}
          >
            <button
              onClick={handlePreviousMonth}
              className="saas-button saas-button-secondary"
              style={{ padding: "8px 16px", fontSize: "1.1rem" }}
            >
              ←
            </button>

            <h2 style={{ color: "var(--text-primary)", fontSize: "1.5rem", margin: 0, textAlign: "center" }}>
              {monthNames[month]} {year}
            </h2>

            <button
              onClick={handleNextMonth}
              className="saas-button saas-button-secondary"
              style={{ padding: "8px 16px", fontSize: "1.1rem" }}
            >
              →
            </button>
          </div>

          {/* Today Button */}
          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <button
              onClick={handleToday}
              className="saas-button saas-button-primary"
              style={{ padding: "8px 16px", fontSize: "0.875rem" }}
            >
              📅 Today
            </button>
          </div>

          {/* Day Headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "5px",
              marginBottom: "8px",
              textAlign: "center"
            }}
          >
            {dayNames.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontWeight: "bold",
                  fontSize: "0.8rem",
                  paddingBottom: "10px",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "5px",
              textAlign: "center"
            }}
          >
            {days.map((day, idx) => (
              <div
                key={idx}
                onClick={() => day && handleDateClick(day)}
                style={{
                  padding: "10px 0",
                  cursor: day ? "pointer" : "default",
                  backgroundColor: day
                    ? isDateToday(day, month, year)
                      ? "#2563eb"
                      : hasEventsOnDate(day, month, year)
                        ? "var(--bg-secondary)"
                        : "transparent"
                    : "transparent",
                  border: day ? "1px solid rgba(255,255,255,0.05)" : "none",
                  borderRadius: "4px",
                  color: day ? "#ffffff" : "transparent",
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  position: "relative",
                  transition: "background-color 0.2s",
                  textAlign: "center"
                }}
                onMouseEnter={(e) =>
                  day && !isDateToday(day, month, year)
                    ? (e.target.style.backgroundColor = "#1e3a5f")
                    : null
                }
                onMouseLeave={(e) =>
                  day && !isDateToday(day, month, year)
                    ? (e.target.style.backgroundColor = day && hasEventsOnDate(day, month, year) ? "var(--bg-secondary)" : "transparent")
                    : null
                }
              >
                {day}
                {day && hasEventsOnDate(day, month, year) && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      gap: "2px",
                    }}
                  >
                    {getEventTypesForDate(day, month, year).slice(0, 3).map((color, i) => (
                      <div
                        key={i}
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          backgroundColor: color,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              backgroundColor: "var(--bg-primary)",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              textAlign: "center",
            }}
          >
            💡 Click a date to add, edit or view events scheduled on that day.
          </div>
        </div>

        {/* Right Column: Upcoming Events */}
        <div className="upcoming-events-sidebar">
          <h2
            style={{
              color: "var(--text-primary)",
              fontSize: "1.5rem",
              margin: "0 0 15px 0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🚀 Upcoming Events (Next 5)</span>
          </h2>

          <div className="upcoming-events-scrollable">
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {upcomingEvents.map((event, idx) => {
                  const eventTypeDetails = getEventTypeDetails(event.event_type);
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        border: `1px solid ${eventTypeDetails.color}30`,
                        borderLeft: `3px solid ${eventTypeDetails.color}`,
                        borderRadius: "6px",
                        padding: "12px",
                        color: "var(--text-primary)",
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: "12px",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: "1.5rem" }}>
                        {getEventTypeEmoji(event.event_type)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {event.title}
                        </div>
                        {event.subject_id ? (
                          <div
                            style={{
                              fontSize: "0.825rem",
                              color: "var(--text-secondary)",
                              marginTop: "4px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            📚 {getSubjectName(event.subject_id)}
                          </div>
                        ) : null}
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                          📅 {event.event_date} {event.event_time ? `at ${event.event_time}` : ""}
                        </div>
                      </div>
                      <div
                        style={{
                          backgroundColor: eventTypeDetails.bgColor,
                          color: eventTypeDetails.color,
                          padding: "6px 10px",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                          fontWeight: "bold",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {calculateDaysRemaining(event.event_date)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.9rem", padding: "10px 0" }}>
                No upcoming events scheduled
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ALL EVENTS SECTION - COLLAPSIBLE */}
      <div
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "25px",
        }}
      >
        <button
          onClick={() =>
            setOpenSections((prev) => ({
              ...prev,
              allEvents: !prev.allEvents,
            }))
          }
          style={{
            width: "100%",
            backgroundColor: "transparent",
            border: "none",
            padding: "0",
            marginBottom: openSections.allEvents ? "20px" : "0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: "1.5rem",
            fontWeight: "bold",
            transition: "all 0.3s",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>
            {openSections.allEvents ? "▼" : "▶"}
          </span>
          <span>📋 All Events</span>
          <span
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "#60a5fa",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.875rem",
              fontWeight: "bold",
              marginLeft: "auto",
            }}
          >
            {Object.values(groupedEvents).reduce((sum, arr) => sum + arr.length, 0)}
          </span>
        </button>

        {openSections.allEvents && (
          <div style={{ display: "grid", gap: "12px" }}>
            {Object.entries(groupedEvents).map(([eventType, events]) => (
              <div key={eventType}>
                <button
                  onClick={() =>
                    setOpenEventGroups((prev) => ({
                      ...prev,
                      [eventType]: !prev[eventType],
                    }))
                  }
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "16px",
                    color: "var(--text-primary)",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    transition: "all 0.3s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "var(--bg-primary)";
                    e.target.style.borderColor = "rgba(255,255,255,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "var(--bg-secondary)";
                    e.target.style.borderColor = "var(--border-color)";
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>
                    {openEventGroups[eventType] ? "▼" : "▶"}
                  </span>
                  <span>{eventTypeLabels[eventType]}</span>
                  <span
                    style={{
                      backgroundColor: "rgba(59, 130, 246, 0.2)",
                      color: "#60a5fa",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      marginLeft: "auto",
                    }}
                  >
                    {events.length}
                  </span>
                </button>

                {openEventGroups[eventType] && events.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      paddingTop: "12px",
                      paddingLeft: "8px",
                    }}
                  >
                    {events.map((event) => {
                      const eventTypeDetails = getEventTypeDetails(event.event_type);
                      return (
                        <div
                          key={event.id}
                          style={{
                            backgroundColor: "var(--bg-primary)",
                            border: `1px solid ${eventTypeDetails.color}30`,
                            borderLeft: `4px solid ${eventTypeDetails.color}`,
                            borderRadius: "8px",
                            padding: "16px",
                            color: "var(--text-primary)",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto 1fr auto",
                              gap: "15px",
                              alignItems: "start",
                              marginBottom: "12px",
                            }}
                          >
                            <div style={{ fontSize: "1.8rem" }}>
                              {getEventTypeEmoji(event.event_type)}
                            </div>
                            <div>
                              <div style={{ fontWeight: "bold", color: "var(--text-primary)", fontSize: "1.1rem", marginBottom: "6px" }}>
                                {event.title}
                              </div>
                              {event.subject_id ? (
                                <div
                                  style={{
                                    fontSize: "0.875rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: "8px",
                                  }}
                                >
                                  📚 {getSubjectName(event.subject_id)}
                                </div>
                              ) : null}
                              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                                <div
                                  style={{
                                    backgroundColor: eventTypeDetails.bgColor,
                                    color: eventTypeDetails.color,
                                    padding: "4px 10px",
                                    borderRadius: "4px",
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {event.event_type}
                                </div>
                                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                  📅 {event.event_date}
                                </div>
                                {event.event_time ? (
                                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    ⏰ {event.event_time}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                              <button
                                onClick={() => handleEditEvent(event)}
                                style={{
                                  backgroundColor: "#8b5cf6",
                                  color: "var(--text-primary)",
                                  padding: "8px 14px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                  fontWeight: "bold",
                                  transition: "background-color 0.3s",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                style={{
                                  backgroundColor: "#ef4444",
                                  color: "var(--text-primary)",
                                  padding: "8px 14px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                  fontWeight: "bold",
                                  transition: "background-color 0.3s",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>

                          {event.description && (
                            <div
                              style={{
                                backgroundColor: "rgba(15, 23, 42, 0.5)",
                                padding: "12px",
                                borderRadius: "6px",
                                borderLeft: `2px solid ${eventTypeDetails.color}`,
                                fontSize: "0.875rem",
                                color: "var(--text-secondary)",
                                lineHeight: "1.5",
                              }}
                            >
                              <strong style={{ color: "var(--text-primary)" }}>Description:</strong>{" "}
                              {event.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {events.length === 0 && (
                  <div
                    style={{
                      color: "#475569",
                      fontSize: "0.875rem",
                      padding: "12px 16px",
                      backgroundColor: "rgba(15, 23, 42, 0.3)",
                      borderRadius: "6px",
                      borderLeft: "3px solid #475569",
                      marginTop: "8px",
                    }}
                  >
                    No {eventTypeLabels[eventType].toLowerCase()} scheduled
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPLETED EVENTS SECTION - COLLAPSIBLE */}
      <div
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <button
          onClick={() =>
            setOpenSections((prev) => ({
              ...prev,
              completedEvents: !prev.completedEvents,
            }))
          }
          style={{
            width: "100%",
            backgroundColor: "transparent",
            border: "none",
            padding: "0",
            marginBottom: openSections.completedEvents ? "20px" : "0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: "1.5rem",
            fontWeight: "bold",
            transition: "all 0.3s",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>
            {openSections.completedEvents ? "▼" : "▶"}
          </span>
          <span>✅ Completed Events</span>
          <span
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              color: "#86efac",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.875rem",
              fontWeight: "bold",
              marginLeft: "auto",
            }}
          >
            {Object.values(groupedCompletedEvents).reduce((sum, arr) => sum + arr.length, 0)}
          </span>
        </button>

        {openSections.completedEvents && (
          <div style={{ display: "grid", gap: "12px" }}>
            {Object.entries(groupedCompletedEvents).map(([eventType, events]) => (
              <div key={eventType}>
                <button
                  onClick={() =>
                    setOpenEventGroups((prev) => ({
                      ...prev,
                      [`${eventType}Completed`]: !prev[`${eventType}Completed`],
                    }))
                  }
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "16px",
                    color: "var(--text-primary)",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    transition: "all 0.3s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "var(--bg-primary)";
                    e.target.style.borderColor = "rgba(255,255,255,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "var(--bg-secondary)";
                    e.target.style.borderColor = "var(--border-color)";
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>
                    {openEventGroups[`${eventType}Completed`] ? "▼" : "▶"}
                  </span>
                  <span>{eventTypeLabels[eventType]}</span>
                  <span
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.2)",
                      color: "#86efac",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      marginLeft: "auto",
                    }}
                  >
                    {events.length}
                  </span>
                </button>

                {openEventGroups[`${eventType}Completed`] && events.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      paddingTop: "12px",
                      paddingLeft: "8px",
                    }}
                  >
                    {events.map((event) => {
                      const eventTypeDetails = getEventTypeDetails(event.event_type);
                      return (
                        <div
                          key={event.id}
                          style={{
                            backgroundColor: "var(--bg-primary)",
                            border: `1px solid ${eventTypeDetails.color}30`,
                            borderLeft: `4px solid ${eventTypeDetails.color}`,
                            borderRadius: "8px",
                            padding: "16px",
                            color: "var(--text-primary)",
                            opacity: "0.7",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto 1fr auto",
                              gap: "15px",
                              alignItems: "start",
                              marginBottom: "12px",
                            }}
                          >
                            <div style={{ fontSize: "1.8rem" }}>
                              {getEventTypeEmoji(event.event_type)}
                            </div>
                            <div>
                              <div style={{ fontWeight: "bold", color: "var(--text-primary)", fontSize: "1.1rem", marginBottom: "6px" }}>
                                {event.title}
                              </div>
                              {event.subject_id ? (
                                <div
                                  style={{
                                    fontSize: "0.875rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: "8px",
                                  }}
                                >
                                  📚 {getSubjectName(event.subject_id)}
                                </div>
                              ) : null}
                              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                                <div
                                  style={{
                                    backgroundColor: eventTypeDetails.bgColor,
                                    color: eventTypeDetails.color,
                                    padding: "4px 10px",
                                    borderRadius: "4px",
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {event.event_type}
                                </div>
                                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                  📅 {event.event_date}
                                </div>
                                {event.event_time ? (
                                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    ⏰ {event.event_time}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                style={{
                                  backgroundColor: "#ef4444",
                                  color: "var(--text-primary)",
                                  padding: "8px 14px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                  fontWeight: "bold",
                                  transition: "background-color 0.3s",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>

                          {event.description && (
                            <div
                              style={{
                                backgroundColor: "rgba(15, 23, 42, 0.5)",
                                padding: "12px",
                                borderRadius: "6px",
                                borderLeft: `2px solid ${eventTypeDetails.color}`,
                                fontSize: "0.875rem",
                                color: "var(--text-secondary)",
                                lineHeight: "1.5",
                              }}
                            >
                              <strong style={{ color: "var(--text-primary)" }}>Description:</strong>{" "}
                              {event.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {events.length === 0 && (
                  <div
                    style={{
                      color: "#475569",
                      fontSize: "0.875rem",
                      padding: "12px 16px",
                      backgroundColor: "rgba(15, 23, 42, 0.3)",
                      borderRadius: "6px",
                      borderLeft: "3px solid #475569",
                      marginTop: "8px",
                    }}
                  >
                    No completed {eventTypeLabels[eventType].toLowerCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {completedEvents.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "30px" }}>
            No completed events yet. Events will appear here after they pass.
          </div>
        )}
      </div>

      {/* Date Click / Event Details & Creation Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsModalOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            {/* Modal Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                backgroundColor: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: "1"
              }}
            >
              &times;
            </button>

            {/* Modal Header */}
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ margin: "0 0 5px 0", fontSize: "1.3rem", color: "var(--text-primary)", fontWeight: "bold" }}>
                Date details
              </h3>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                {selectedDateStr ? `${monthNames[displayMonth]} ${selectedDate}, ${displayYear}` : ""}
              </p>
            </div>

            {/* Existing Events on Selected Day */}
            <div style={{ marginBottom: "25px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "var(--text-primary)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "6px" }}>
                Events scheduled:
              </h4>
              {selectedDateEvents.length > 0 ? (
                <div style={{ display: "grid", gap: "10px", maxHeight: "200px", overflowY: "auto", paddingRight: "5px" }}>
                  {selectedDateEvents.map((event, idx) => {
                    const eventTypeDetails = getEventTypeDetails(event.event_type);
                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          border: `1px solid ${eventTypeDetails.color}30`,
                          borderLeft: `3px solid ${eventTypeDetails.color}`,
                          borderRadius: "6px",
                          padding: "10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div style={{ overflow: "hidden", marginRight: "10px" }}>
                          <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getEventTypeEmoji(event.event_type)} {event.title}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            {event.event_time ? `⏰ ${event.event_time}` : "All Day"} • {getSubjectName(event.subject_id)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button
                            onClick={() => handleEditEvent(event)}
                            style={{
                              backgroundColor: "rgba(139, 92, 246, 0.2)",
                              border: "none",
                              color: "#c084fc",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: "bold"
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            style={{
                              backgroundColor: "rgba(239, 68, 68, 0.2)",
                              border: "none",
                              color: "#f87171",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: "bold"
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.85rem", padding: "10px 0" }}>
                  No events scheduled for this day
                </div>
              )}
            </div>

            {/* Event Form */}
            <div>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "var(--text-primary)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "6px", fontWeight: "700" }}>
                {editingEventId ? "✏️ Edit Event" : "➕ Add Event"}
              </h4>
              {error && (
                <div style={{ backgroundColor: "#7f1d1d", color: "#fee2e2", border: "1px solid #991b1b", padding: "8px 12px", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "12px" }}>
                  ⚠️ {error}
                </div>
              )}
              <form onSubmit={handleAddEvent}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
                  
                  {/* Group 1: Event Details */}
                  <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: "0.8rem", color: "#a855f7", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                      📋 Event Details
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <label className="saas-label">Event Title *</label>
                        <input
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          placeholder="e.g., Midterm Exam"
                          className="saas-input"
                        />
                      </div>
                      
                      {/* Event Type Badges */}
                      <div>
                        <label className="saas-label">Event Type *</label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {eventTypes.map((type) => {
                            const isSelected = formData.event_type === type.value;
                            return (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, event_type: type.value }))}
                                style={{
                                  flex: 1,
                                  minWidth: "100px",
                                  padding: "8px 12px",
                                  fontSize: "0.85rem",
                                  fontWeight: "700",
                                  borderRadius: "6px",
                                  border: `1px solid ${isSelected ? type.color : "rgba(255, 255, 255, 0.08)"}`,
                                  backgroundColor: isSelected ? type.bgColor : "rgba(255, 255, 255, 0.02)",
                                  color: isSelected ? "#ffffff" : "var(--text-secondary)",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease"
                                }}
                              >
                                {type.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Schedule & Association */}
                  <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: "0.8rem", color: "#a855f7", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                      📅 Schedule & Subject Link
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div>
                        <label className="saas-label">Date *</label>
                        <input
                          type="date"
                          name="event_date"
                          value={formData.event_date}
                          onChange={handleInputChange}
                          className="saas-input"
                        />
                      </div>
                      <div>
                        <label className="saas-label">Time</label>
                        <input
                          type="time"
                          name="event_time"
                          value={formData.event_time}
                          onChange={handleInputChange}
                          className="saas-input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="saas-label">Link to Subject</label>
                      <select
                        name="subject_id"
                        value={formData.subject_id}
                        onChange={handleInputChange}
                        className="saas-select"
                        style={{ width: "100%" }}
                      >
                        <option value="">None</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Group 3: Description */}
                  <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: "0.8rem", color: "#a855f7", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                      ✏️ Description
                    </div>
                    <div>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Add details, room numbers, or links..."
                        rows="2"
                        className="saas-input"
                        style={{ fontFamily: "inherit", resize: "vertical" }}
                      />
                    </div>
                  </div>

                </div>

                {/* Form Buttons */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="saas-button saas-button-success"
                    style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
                  >
                    {submitting ? "Saving..." : (editingEventId ? "💾 Save Changes" : "➕ Add Event")}
                  </button>
                  <button
                    type="button"
                    onClick={editingEventId ? handleCancelEdit : () => setIsModalOpen(false)}
                    className="saas-button saas-button-secondary"
                    style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default Calendar;
