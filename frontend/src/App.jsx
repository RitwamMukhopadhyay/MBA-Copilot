import { useState, useEffect } from "react";
import { FocusTimerProvider } from "./context/FocusTimerContext";

import Sidebar from "./components/Sidebar";
import AIAssistant from "./components/AIAssistant";

import Dashboard from "./pages/Dashboard";
import Subjects from "./pages/Subjects";
import Attendance from "./pages/Attendance";
import Assignments from "./pages/Assignments";
import Calendar from "./pages/Calendar";
import Chat from "./pages/Chat";
import PdfChat from "./pages/PdfChat";
import ExamPlanner from "./pages/ExamPlanner";
import Settings from "./pages/Settings";
import KnowledgeHub from "./pages/KnowledgeHub";

const AI_PANEL_KEY = "mba_ai_panel_open"; // kept for localStorage cleanup on first load

const applyThemeAndFont = (themeName, sizeName) => {
  let activeTheme = themeName;
  if (themeName === "System") {
    activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
  }

  const root = document.documentElement;
  if (activeTheme === "Light") {
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
  } else {
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
  }

  let fontSizePx = "16px";
  if (sizeName === "Small") fontSizePx = "14px";
  if (sizeName === "Large") fontSizePx = "18px";
  root.style.setProperty("--font-size-base", fontSizePx);
};

function App() {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  // ── Floating AI assistant state ──────────────────────────────────────────
  // Messages and input are lifted here so toggling the pop-out closed/open
  // never loses the conversation (state lives above the conditional render).
  const [floatingAiOpen, setFloatingAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      id: 1,
      text: "👋 Hi! I'm your MBA Copilot Assistant. Ask me anything about your courses, study schedule, or assignments!",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [aiInputValue, setAiInputValue] = useState("");

  const toggleFloatingAi = () => setFloatingAiOpen((prev) => !prev);

  // Left sidebar: collapsed by default, persisted
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("mba_sidebar_open");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("mba_settings_theme") || "Dark";
    const savedFontSize = localStorage.getItem("mba_settings_font_size") || "Medium";
    applyThemeAndFont(savedTheme, savedFontSize);

    const handleResize = () => setScreenWidth(window.innerWidth);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const currentTheme = localStorage.getItem("mba_settings_theme") || "Dark";
      if (currentTheme === "System") {
        applyThemeAndFont("System", localStorage.getItem("mba_settings_font_size") || "Medium");
      }
    };

    window.addEventListener("resize", handleResize);
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      window.removeEventListener("resize", handleResize);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);


  return (
    <FocusTimerProvider>
    <div className="saas-app-root" style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>

      {/* Mobile Drawer Overlay Backdrop */}
      {sidebarOpen && screenWidth < 768 && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── LEFT NAV SIDEBAR ── */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* ── MAIN CONTENT ── */}
      <div
        className="saas-main-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          backgroundColor: "var(--bg-primary)",
          minWidth: 0,
          position: "relative",
        }}
      >
        {/* Mobile Header Bar */}
        {screenWidth < 768 && (
          <div className="mobile-header">
            <button 
              className="hamburger-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation drawer"
            >
              ☰
            </button>
            <span className="mobile-header-title">MBA Copilot 🎓 {currentPage ? `| ${currentPage}` : ""}</span>
            <div style={{ width: "24px" }} />
          </div>
        )}

        {currentPage === "Dashboard" && <Dashboard setCurrentPage={setCurrentPage} />}
        {currentPage === "Subjects" && <Subjects />}
        {currentPage === "Attendance" && <Attendance />}
        {currentPage === "Assignments" && <Assignments />}
        {currentPage === "Calendar" && <Calendar />}
        {currentPage === "Chat" && <Chat />}
        {currentPage === "PDF Chat" && <PdfChat />}
        {currentPage === "Knowledge Hub" && <KnowledgeHub />}
        {currentPage === "Exam Planner" && <ExamPlanner />}
        {currentPage === "Settings" && (
          <Settings
            onSettingsChange={(updatedTheme, updatedFontSize) =>
              applyThemeAndFont(updatedTheme, updatedFontSize)
            }
          />
        )}
      </div>

      {/* ── FLOATING AI ASSISTANT ─────────────────────────────────────────── */}

      {/* Backdrop — clicking outside closes the pop-out */}
      {floatingAiOpen && (
        <div
          onClick={() => setFloatingAiOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9997,
            background: "transparent",
          }}
        />
      )}

      {/* Pop-out panel — always mounted so state is preserved; visibility via CSS transform/opacity */}
      <div
        style={{
          position: "fixed",
          bottom: "88px",
          right: "24px",
          width: "380px",
          height: "560px",
          zIndex: 9998,
          background: "rgba(2, 6, 23, 0.95)",
          border: "1px solid rgba(30, 41, 59, 0.9)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(16px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
          transformOrigin: "bottom right",
          transform: floatingAiOpen ? "scale(1) translateY(0)" : "scale(0.85) translateY(40px)",
          opacity: floatingAiOpen ? 1 : 0,
          pointerEvents: floatingAiOpen ? "all" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div
          style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(8px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", boxShadow: "0 0 12px rgba(139,92,246,0.6)",
              }}
            >
              🤖
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#f1f5f9" }}>
                MBA Copilot Assistant
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#4ade80", fontWeight: "600" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block" }} />
                Online
              </div>
            </div>
          </div>
          <button
            onClick={() => setFloatingAiOpen(false)}
            title="Close"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px", color: "#94a3b8", cursor: "pointer",
              width: "28px", height: "28px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            ✕
          </button>
        </div>

        {/* Chat body — receives lifted state so messages survive panel close/open */}
        <AIAssistant
          messages={aiMessages}
          setMessages={setAiMessages}
          inputValue={aiInputValue}
          setInputValue={setAiInputValue}
        />
      </div>

      {/* FAB — Floating Action Button, always visible on every page */}
      <button
        id="ai-assistant-fab"
        onClick={toggleFloatingAi}
        title={floatingAiOpen ? "Close AI Assistant" : "Open AI Assistant"}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "none",
          background: floatingAiOpen
            ? "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)"
            : "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
          boxShadow: floatingAiOpen
            ? "0 0 0 3px rgba(139,92,246,0.5), 0 8px 24px rgba(109,40,217,0.55)"
            : "0 0 0 2px rgba(139,92,246,0.35), 0 8px 24px rgba(109,40,217,0.45)",
          cursor: "pointer",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: floatingAiOpen ? "20px" : "26px",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: floatingAiOpen ? "rotate(45deg) scale(0.92)" : "rotate(0deg) scale(1)",
          color: "#ffffff",
        }}
        onMouseEnter={(e) => {
          if (!floatingAiOpen) {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 0 15px rgba(147,51,234,0.4), 0 12px 32px rgba(109,40,217,0.6)";
          }
        }}
        onMouseLeave={(e) => {
          if (!floatingAiOpen) {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139,92,246,0.35), 0 8px 24px rgba(109,40,217,0.45)";
          }
        }}
      >
        {floatingAiOpen ? "✛" : "🤖"}
      </button>

      <style>{`
        @keyframes fabPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(139,92,246,0.35), 0 8px 24px rgba(109,40,217,0.45); }
          50%       { box-shadow: 0 0 0 5px rgba(139,92,246,0.18), 0 8px 28px rgba(109,40,217,0.55); }
        }
        #ai-assistant-fab:not(:hover) {
          animation: fabPulse 3s ease-in-out infinite;
        }
      `}</style>

    </div>
    </FocusTimerProvider>
  );
}

export default App;
