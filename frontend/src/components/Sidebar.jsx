import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "mba_sidebar_open";

const menuItems = [
  { label: "Dashboard",     icon: "🏠" },
  { label: "Subjects",      icon: "📚" },
  { label: "Attendance",    icon: "📊" },
  { label: "Assignments",   icon: "📝" },
  { label: "Calendar",      icon: "📅" },
  { label: "Chat",          icon: "💬" },
  { label: "PDF Chat",      icon: "📄" },
  { label: "Knowledge Hub", icon: "🧠" },
  { label: "Exam Planner",  icon: "🎯" },
  { label: "Settings",      icon: "⚙️" },
];

function Sidebar({ currentPage, setCurrentPage, isOpen, setIsOpen }) {
  const [modelInfo, setModelInfo] = useState({
    provider: "Ollama Local",
    model: "gemma3:4b",
    status: "Connected",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchRef = useRef(0);

  const fetchInfo = async (force = false) => {
    const now = Date.now();
    const THIRTY_SECONDS = 30000;
    if (!force && now - lastFetchRef.current < THIRTY_SECONDS) return;
    lastFetchRef.current = now;
    setIsRefreshing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/settings/current-model");
      if (res.ok) {
        const data = await res.json();
        setModelInfo(data);
      }
    } catch (err) {
      console.error("Error fetching current model info:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch once on startup
  useEffect(() => { fetchInfo(true); }, []);

  // Poll only when on Settings or Knowledge Hub
  useEffect(() => {
    const shouldPoll = currentPage === "Settings" || currentPage === "Knowledge Hub";
    if (!shouldPoll) return;
    const interval = setInterval(() => fetchInfo(false), 30000);
    return () => clearInterval(interval);
  }, [currentPage]);

  // Re-fetch immediately when navigating to polled pages
  useEffect(() => {
    if (currentPage === "Settings" || currentPage === "Knowledge Hub") fetchInfo(true);
  }, [currentPage]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const navigate = (label) => {
    setCurrentPage(label);
    // On mobile (<768px) auto-close after navigation
    if (window.innerWidth < 768) {
      setIsOpen(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(false));
    }
  };

  return (
    <div
      className={`saas-sidebar ${isOpen ? "open" : "closed"}`}
      style={{
        width: isOpen ? "240px" : "56px",
        flexShrink: 0,
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        backgroundColor: "var(--bg-secondary)",
        color: "var(--text-primary)",
        height: "100vh",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* ── HEADER: Logo + Toggle ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isOpen ? "space-between" : "center",
          padding: isOpen ? "20px 16px 12px 20px" : "20px 0 12px 0",
          flexShrink: 0,
          minHeight: "60px",
        }}
      >
        {isOpen && (
          <span
            style={{
              fontSize: "1.05rem",
              fontWeight: "800",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              color: "var(--text-primary)",
            }}
          >
            MBA Copilot 🎓
          </span>
        )}

        {/* Toggle button */}
        <button
          onClick={toggle}
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            background: "rgba(139, 92, 246, 0.12)",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            borderRadius: "6px",
            cursor: "pointer",
            color: "#a78bfa",
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            flexShrink: 0,
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)";
            e.currentTarget.style.color = "#c4b5fd";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.12)";
            e.currentTarget.style.color = "#a78bfa";
          }}
        >
          {isOpen ? "‹" : "›"}
        </button>
      </div>

      {isOpen && (
        <hr style={{ borderColor: "var(--border-color)", opacity: 0.2, margin: "0 16px 8px 16px" }} />
      )}

      {/* ── NAV ITEMS ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: isOpen ? "0 12px" : "0 8px",
        }}
      >
        {menuItems.map(({ label, icon }) => {
          const isActive = currentPage === label;
          return (
            <button
              key={label}
              onClick={() => navigate(label)}
              title={!isOpen ? label : undefined}
              style={{
                width: "100%",
                padding: isOpen ? "10px 12px" : "10px 0",
                marginTop: "6px",
                cursor: "pointer",
                border: "none",
                borderRadius: "8px",
                backgroundColor: isActive ? "var(--accent)" : "var(--bg-primary)",
                color: isActive ? "#ffffff" : "var(--text-primary)",
                fontWeight: "500",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                justifyContent: isOpen ? "flex-start" : "center",
                gap: "10px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{icon}</span>
              {isOpen && <span>{label}</span>}
            </button>
          );
        })}
      </div>

      {/* ── LLM STATUS BADGE ── */}
      <div
        style={{
          flexShrink: 0,
          padding: isOpen ? "12px 16px 20px 16px" : "12px 8px 20px 8px",
        }}
      >
        <div
          style={{
            padding: isOpen ? "8px 12px" : "8px 0",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(30, 41, 59, 0.5) 100%)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: isOpen ? "flex-start" : "center",
            gap: "8px",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            overflow: "hidden",
          }}
        >
          {/* Status dot */}
          <span
            title={`Status: ${modelInfo.status}`}
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: modelInfo.status === "Connected" ? "#10b981" : "#ef4444",
              flexShrink: 0,
            }}
          />
          {/* Model name (only when expanded) */}
          {isOpen && (
            <>
              <span
                style={{
                  flexGrow: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontWeight: "500",
                  color: "var(--text-primary)",
                }}
                title={`${modelInfo.provider}: ${modelInfo.model}`}
              >
                {modelInfo.model || "None Selected"}
              </span>
              <button
                onClick={() => fetchInfo(true)}
                title="Refresh LLM status"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                  padding: "2px",
                  borderRadius: "4px",
                  lineHeight: 1,
                  opacity: isRefreshing ? 0.4 : 0.8,
                  transition: "opacity 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {isRefreshing ? "⌛" : "🔄"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;