import { useEffect, useState } from "react";

const ALL_PROVIDERS = [
  "Ollama Local",
  "OpenAI",
  "Gemini",
  "Claude",
  "OpenRouter",
  "Groq",
  "Together AI",
  "Ollama Cloud",
  "Custom OpenAI-Compatible API"
];

function Settings({ onSettingsChange }) {
  console.log("Settings component rendered");

  // localStorage keys for general settings
  const STORAGE_KEYS = {
    WEB_SEARCH: "mba_settings_web_search",
    MEMORY_ENABLED: "mba_settings_memory_enabled",
    THEME: "mba_settings_theme",
    FONT_SIZE: "mba_settings_font_size",
  };

  // State for general settings
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [theme, setTheme] = useState("Dark");
  const [fontSize, setFontSize] = useState("Medium");
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");

  // LAN Access states
  const [lanEnabled, setLanEnabled] = useState(false);
  const [lanChanged, setLanChanged] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Memory Management State
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoryData, setMemoryData] = useState({});
  const [editingItem, setEditingItem] = useState(null); // { category, key, value }
  const [newItem, setNewItem] = useState({ category: "personal", key: "", value: "" });
  const [memorySearchQuery, setMemorySearchQuery] = useState("");
  const [selectedMemoryTab, setSelectedMemoryTab] = useState("all");

  // LAN Access & Connection State
  const [lanInfo, setLanInfo] = useState({
    host_ip: "127.0.0.1",
    client_ip: "127.0.0.1",
    backend_url: "http://127.0.0.1:8000",
    frontend_url: "http://127.0.0.1:5173",
    connection_status: "Connected"
  });

  // AI Configuration Center States (Simplified)
  const [aiStatus, setAiStatus] = useState({
    chat_model: "gemma3:4b",
    chat_status: "Disconnected",
    embedding_provider: "OpenAI",
    embedding_status: "Disconnected",
    knowledge_hub_status: "Error"
  });

  // Legacy apiKeys state for OpenAI API key (for Knowledge Hub section)
  const [apiKeys, setApiKeys] = useState({
    "OpenAI API": "",
    "Gemini API": "",
    "Claude API": "",
    "OpenRouter": "",
    "Groq API": ""
  });
  const [showKeys, setShowKeys] = useState({
    "OpenAI API": false,
    "Groq API": false
  });

  // Developer Tools state
  const [devToolsExpanded, setDevToolsExpanded] = useState(false);
  const [devSubjects, setDevSubjects] = useState([]);
  // Retrieval Tester state
  const [devRetrievalSubject, setDevRetrievalSubject] = useState("");
  const [devRetrievalQuestion, setDevRetrievalQuestion] = useState("");
  const [devRetrievalResults, setDevRetrievalResults] = useState(null);
  const [devRetrievalLoading, setDevRetrievalLoading] = useState(false);
  const [devRetrievalError, setDevRetrievalError] = useState(null);
  // RAG Tester state
  const [devRagQuestion, setDevRagQuestion] = useState("");
  const [devRagResults, setDevRagResults] = useState(null);
  const [devRagLoading, setDevRagLoading] = useState(false);
  const [devRagError, setDevRagError] = useState(null);

  // Load settings on mount
  useEffect(() => {
    loadAllSettings();
  }, []);

  // Load subjects for developer tools when expanded
  useEffect(() => {
    if (devToolsExpanded && devSubjects.length === 0) {
      fetch("http://127.0.0.1:8000/knowledge/subjects")
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            setDevSubjects(data);
            if (data.length > 0) setDevRetrievalSubject(data[0].name);
          }
        })
        .catch(() => {});
    }
  }, [devToolsExpanded]);

  const handleDevTestRetrieval = async (e) => {
    e.preventDefault();
    if (!devRetrievalSubject) { setDevRetrievalError("Please select a subject."); return; }
    if (!devRetrievalQuestion.trim()) { setDevRetrievalError("Please enter a question."); return; }
    setDevRetrievalLoading(true);
    setDevRetrievalError(null);
    setDevRetrievalResults(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/knowledge/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_name: devRetrievalSubject, question: devRetrievalQuestion.trim(), top_k: 5 })
      });
      const data = await res.json();
      if (data.error) setDevRetrievalError(data.error);
      else setDevRetrievalResults(data);
    } catch { setDevRetrievalError("Failed to connect to backend."); }
    finally { setDevRetrievalLoading(false); }
  };

  const handleDevTestRag = async (e) => {
    e.preventDefault();
    if (!devRagQuestion.trim()) { setDevRagError("Please enter a question."); return; }
    setDevRagLoading(true);
    setDevRagError(null);
    setDevRagResults(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/knowledge/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: devRagQuestion.trim() })
      });
      const data = await res.json();
      if (data.error) setDevRagError(data.error);
      else setDevRagResults(data);
    } catch { setDevRagError("Failed to connect to backend."); }
    finally { setDevRagLoading(false); }
  };



  const loadAllSettings = async () => {
    try {
      setError("");
      const res = await fetch("http://127.0.0.1:8000/settings");
      if (res.ok) {
        const data = await res.json();
        setWebSearchEnabled(data.webSearchEnabled ?? false);
        setMemoryEnabled(data.memoryEnabled ?? false);
        setTheme(data.theme || "Dark");
        setFontSize(data.fontSize || "Medium");
        setLanEnabled(data.lanEnabled ?? false);
        
        if (data.api_keys) {
          setApiKeys(prev => ({
            ...prev,
            ...data.api_keys
          }));
        }

        // Notify parent component about theme and font size
        if (onSettingsChange) {
          onSettingsChange(data.theme || "Dark", data.fontSize || "Medium");
        }
      } else {
        throw new Error("Could not load configurations from backend.");
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Unable to connect to backend AI configuration service. Loading local cache.");
      // Fallback to local storage
      const savedWebSearch = localStorage.getItem(STORAGE_KEYS.WEB_SEARCH) === "true";
      const savedMemory = localStorage.getItem(STORAGE_KEYS.MEMORY_ENABLED) === "true";
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "Dark";
      const savedFontSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || "Medium";
      const savedLanEnabled = localStorage.getItem("mba_settings_lan_enabled") === "true";

      setWebSearchEnabled(savedWebSearch);
      setMemoryEnabled(savedMemory);
      setTheme(savedTheme);
      setFontSize(savedFontSize);
      setLanEnabled(savedLanEnabled);
      if (onSettingsChange) {
        onSettingsChange(savedTheme, savedFontSize);
      }
    }

    // Load active status
    fetchActiveStatus();
    // Load LAN access info
    fetchLanInfo();
  };

  const fetchLanInfo = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/settings/lan-info");
      if (res.ok) {
        const data = await res.json();
        setLanInfo(data);
      }
    } catch (err) {
      console.error("Error fetching LAN info:", err);
    }
  };

  const fetchActiveStatus = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/settings/current-model");
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch (err) {
      console.error("Error fetching model status:", err);
    }
  };

  const saveAllSettings = async (updates = {}) => {
    const currentTheme = updates.theme !== undefined ? updates.theme : theme;
    const currentFontSize = updates.fontSize !== undefined ? updates.fontSize : fontSize;
    const memEnabled = updates.memoryEnabled !== undefined ? updates.memoryEnabled : memoryEnabled;
    const searchEnabled = updates.webSearchEnabled !== undefined ? updates.webSearchEnabled : webSearchEnabled;
    const currentLanEnabled = updates.lanEnabled !== undefined ? updates.lanEnabled : lanEnabled;

    try {
      setError("");
      const res = await fetch("http://127.0.0.1:8000/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_provider: "Groq",
          active_model: "llama-3.3-70b-versatile",
          theme: currentTheme,
          fontSize: currentFontSize,
          memoryEnabled: memEnabled,
          webSearchEnabled: searchEnabled,
          lanEnabled: currentLanEnabled,
          api_keys: apiKeys
        })
      });
      if (res.ok) {
        setSaveMessage("✅ Settings saved successfully");
        setTimeout(() => setSaveMessage(""), 3000);

        // Keep local storage in sync
        localStorage.setItem(STORAGE_KEYS.THEME, currentTheme);
        localStorage.setItem(STORAGE_KEYS.FONT_SIZE, currentFontSize);
        localStorage.setItem(STORAGE_KEYS.MEMORY_ENABLED, String(memEnabled));
        localStorage.setItem(STORAGE_KEYS.WEB_SEARCH, String(searchEnabled));
        localStorage.setItem("mba_settings_lan_enabled", String(currentLanEnabled));

        // Notify parent App component
        if (onSettingsChange) {
          onSettingsChange(currentTheme, currentFontSize);
        }

        // Update active status
        fetchActiveStatus();
      } else {
        throw new Error("Failed to save settings to server.");
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to save configuration: ${err.message}`);
    }
  };

  // Legacy handling for OpenAI API key input in the bottom embedding card
  const handleApiKeyChange = (provider, value) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  // Effect to determine if LAN settings have changed compared to active server state
  useEffect(() => {
    if (lanInfo && lanInfo.lan_enabled !== undefined) {
      setLanChanged(lanEnabled !== lanInfo.lan_enabled);
    }
  }, [lanEnabled, lanInfo]);

  const handleLanToggle = () => {
    const newValue = !lanEnabled;
    setLanEnabled(newValue);
    saveAllSettings({ lanEnabled: newValue });
  };

  const triggerRestart = async () => {
    setIsRestartModalOpen(false);
    setRestarting(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/settings/restart", {
        method: "POST"
      });
      if (res.ok) {
        setTimeout(() => {
          pollBackendAndReload();
        }, 1000);
      } else {
        throw new Error("Failed to trigger restart on the server.");
      }
    } catch (err) {
      console.error("Restart error:", err);
      // Fallback reload helper if server goes down immediately
      setTimeout(() => {
        pollBackendAndReload();
      }, 1000);
    }
  };

  const pollBackendAndReload = () => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("http://127.0.0.1:8000/settings/lan-info");
        if (res.ok) {
          clearInterval(interval);
          window.location.reload();
        }
      } catch (e) {
        if (attempts > 15) {
          clearInterval(interval);
          window.location.reload();
        }
      }
    }, 1000);
  };

  const handleSaveApiKeys = () => {
    // Save settings will sync from api_keys back to providers
    saveAllSettings();
  };

  const toggleKeyVisibility = (providerName) => {
    setShowKeys(prev => ({ ...prev, [providerName]: !prev[providerName] }));
  };

  // General toggles
  const handleWebSearchChange = () => {
    const newValue = !webSearchEnabled;
    setWebSearchEnabled(newValue);
    saveAllSettings({ webSearchEnabled: newValue });
  };

  const handleMemoryChange = () => {
    const newValue = !memoryEnabled;
    setMemoryEnabled(newValue);
    saveAllSettings({ memoryEnabled: newValue });
  };

  const handleThemeChange = (themeValue) => {
    setTheme(themeValue);
    saveAllSettings({ theme: themeValue });
  };

  const handleFontSizeChange = (sizeValue) => {
    setFontSize(sizeValue);
    saveAllSettings({ fontSize: sizeValue });
  };

  const handleClearMemory = async () => {
    if (confirm("Are you sure you want to clear all memory? This action cannot be undone.")) {
      try {
        const response = await fetch("http://127.0.0.1:8000/memory/clear", { method: "POST" });
        if (response.ok) {
          alert("Memory cleared successfully");
        } else {
          alert("Failed to clear memory");
        }
      } catch (err) {
        console.error("Error clearing memory:", err);
      }
    }
  };

  const fetchMemory = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/memory");
      const data = await response.json();
      setMemoryData(data);
    } catch (err) {
      console.error("Error fetching memory:", err);
    }
  };

  const openMemoryModal = async () => {
    await fetchMemory();
    setIsMemoryModalOpen(true);
  };

  const handleSaveMemory = async () => {
    const payload = editingItem || newItem;
    try {
      const response = await fetch("http://127.0.0.1:8000/memory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await fetchMemory();
        setIsMemoryModalOpen(false);
        setEditingItem(null);
        setNewItem({ category: "personal", key: "", value: "" });
        setSaveMessage("✅ Memory updated");
        setTimeout(() => setSaveMessage(""), 2000);
      }
    } catch (err) {
      console.error("Error saving memory:", err);
    }
  };

  const handleEditMemory = (category, key, value) => {
    setEditingItem({ category, key, value });
  };

  const handleDeleteMemory = async (category, key) => {
    if (confirm(`Delete memory item "${key}"?`)) {
      try {
        await fetch("http://127.0.0.1:8000/memory/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, key, value: "" }),
        });
        await fetchMemory();
      } catch (err) {
        console.error("Error deleting memory:", err);
      }
    }
  };

  // Styled helper classes
  // Styled helper classes
  const containerStyle = {
    padding: "40px 20px",
    width: "100%",
    backgroundColor: "var(--bg-primary)",
    boxSizing: "border-box",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const wrapperStyle = {
    width: "100%",
    maxWidth: "1200px", // centered max-width
    display: "flex",
    flexDirection: "column",
    gap: "24px", // section spacing
  };

  const titleStyle = {
    fontSize: "2.2rem",
    fontWeight: "800",
    color: "var(--text-primary)",
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  const subtitleStyle = {
    fontSize: "1rem",
    color: "var(--text-secondary)",
    marginBottom: "10px",
  };

  const cardStyle = {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const cardHeaderStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  };

  const cardTitleContainerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "1.35rem",
    fontWeight: "700",
    color: "var(--text-primary)",
  };

  const cardDescStyle = {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
  };

  const cardDividerStyle = {
    height: "1px",
    backgroundColor: "var(--border-color, rgba(255, 255, 255, 0.06))",
    width: "100%",
    margin: "8px 0 16px 0",
  };

  const buttonStyle = {
    padding: "10px 20px",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#9333ea", // purple accent
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#ef4444", // red alert
  };

  const saveMessageStyle = {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid #10b981",
    color: "#a7f3d0",
    padding: "16px",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: "600",
  };

  const errorMessageStyle = {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    padding: "16px",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: "600",
  };

  const statusGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  };

  const statusCardStyle = (connected) => ({
    padding: "20px 24px",
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    border: `1px solid ${connected ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
    borderRadius: "12px",
    boxShadow: connected 
      ? "inset 0 0 12px rgba(16, 185, 129, 0.02)" 
      : "inset 0 0 12px rgba(239, 68, 68, 0.02)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    transition: "all 0.2s ease",
  });

  const segmentedControlStyle = {
    display: "flex",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    borderRadius: "10px",
    padding: "4px",
    width: "fit-content",
  };

  const segmentStyle = (isActive) => ({
    padding: "8px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    color: isActive ? "#ffffff" : "var(--text-secondary)",
    backgroundColor: isActive ? "#9333ea" : "transparent",
    border: "none",
    transition: "all 0.2s ease",
    outline: "none",
  });

  const infoGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  };

  const infoItemCardStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    borderRadius: "12px",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  };

  const infoLabelStyle = {
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const infoValueStyle = {
    fontSize: "1.05rem",
    color: "var(--text-primary)",
    fontWeight: "600",
  };

  const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  };

  const inputStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    color: "var(--text-primary)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  const modalStyle = {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    borderRadius: "16px",
    padding: "24px 32px",
    width: "800px",
    maxWidth: "95vw",
    maxHeight: "85vh",
    overflowY: "auto",
    color: "var(--text-primary)",
    boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.7)",
  };

  const thStyle = {
    textAlign: "left",
    padding: "12px 16px",
    borderBottom: "2px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    color: "var(--text-secondary)",
    fontSize: "0.85rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const tdStyle = {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
    fontSize: "0.9rem",
    color: "var(--text-primary)",
  };

  return (
    <div className="settings-container" style={containerStyle}>
      <div className="settings-wrapper" style={wrapperStyle}>
        
        {/* Page Title & Subtitle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
          <div style={titleStyle}>⚙️ Settings</div>
          <div style={subtitleStyle}>Configure MBA Copilot preferences and AI Configuration Center.</div>
        </div>

        {saveMessage && <div style={saveMessageStyle}>{saveMessage}</div>}
        {error && <div style={errorMessageStyle}>{error}</div>}

        {/* AI STATUS BOARD */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>🤖 AI Status Board</div>
            <div style={cardDescStyle}>Real-time status of local AI engines and cloud knowledge base components.</div>
          </div>
          <div style={cardDividerStyle} />
          
          <div style={statusGridStyle}>
            {/* Local Chat Status Card */}
            <div style={statusCardStyle(aiStatus.chat_status === "Connected")}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Local Chat Model
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: aiStatus.chat_status === "Connected" ? "#10b981" : "#ef4444", display: "inline-block" }} />
                  Ollama ({aiStatus.chat_model || "gemma3:4b"})
                </div>
                <div style={{ fontSize: "0.85rem", color: aiStatus.chat_status === "Connected" ? "#10b981" : "#ef4444", fontWeight: "700", marginTop: "4px", marginLeft: "16px" }}>
                  {aiStatus.chat_status === "Connected" ? "Connected" : "Disconnected"}
                </div>
              </div>
            </div>

            {/* Embeddings Status Card */}
            <div style={statusCardStyle(aiStatus.embedding_status === "Connected")}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Embeddings Provider
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: aiStatus.embedding_status === "Connected" ? "#10b981" : "#ef4444", display: "inline-block" }} />
                  OpenAI (text-embedding-3-small)
                </div>
                <div style={{ fontSize: "0.85rem", color: aiStatus.embedding_status === "Connected" ? "#10b981" : "#ef4444", fontWeight: "700", marginTop: "4px", marginLeft: "16px" }}>
                  {aiStatus.embedding_status === "Connected" ? "Connected" : "Disconnected"}
                </div>
              </div>
            </div>

            {/* Knowledge Hub DB Card */}
            <div style={statusCardStyle(aiStatus.knowledge_hub_status === "Ready")}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Knowledge Hub DB
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: aiStatus.knowledge_hub_status === "Ready" ? "#10b981" : "#ef4444", display: "inline-block" }} />
                  FAISS Store File DB
                </div>
                <div style={{ fontSize: "0.85rem", color: aiStatus.knowledge_hub_status === "Ready" ? "#10b981" : "#ef4444", fontWeight: "700", marginTop: "4px", marginLeft: "16px" }}>
                  {aiStatus.knowledge_hub_status === "Ready" ? "Ready" : "Error"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LAN ACCESS & NETWORK STATUS */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>📶 LAN Access</div>
            <div style={cardDescStyle}>Allow MBA Copilot to be accessed from other devices on the same Wi-Fi network.</div>
          </div>
          <div style={cardDividerStyle} />

          {/* LAN Toggle Switch and Restart Row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            backgroundColor: "rgba(255, 255, 255, 0.015)",
            border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
            borderRadius: "12px",
            gap: "20px",
            marginBottom: "16px"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  backgroundColor: lanEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)",
                  color: lanEnabled ? "#10b981" : "var(--text-secondary)",
                  border: `1px solid ${lanEnabled ? "rgba(16, 185, 129, 0.2)" : "var(--border-color, rgba(255, 255, 255, 0.06))"}`,
                }}>
                  {lanEnabled ? "🟢 LAN Access ON" : "⚪ LAN Access OFF"}
                </span>
              </div>
              <div style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "1.05rem", marginBottom: "4px" }}>
                LAN Access Control
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                {lanEnabled
                  ? "MBA Copilot is discoverable on your Wi-Fi network. Phone / tablet access is enabled."
                  : "MBA Copilot is restricted to localhost. Phone / tablet access is disabled."}
              </div>
            </div>

            {/* Toggle segment and restart button */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
              {/* [ OFF | ON ] Segmented Toggle */}
              <div style={segmentedControlStyle}>
                <button
                  onClick={() => { if (lanEnabled) handleLanToggle(); }}
                  style={{
                    padding: "6px 16px",
                    border: "none",
                    borderRadius: "6px",
                    backgroundColor: !lanEnabled ? "#9333ea" : "transparent",
                    color: !lanEnabled ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  OFF
                </button>
                <button
                  onClick={() => { if (!lanEnabled) handleLanToggle(); }}
                  style={{
                    padding: "6px 16px",
                    border: "none",
                    borderRadius: "6px",
                    backgroundColor: lanEnabled ? "#9333ea" : "transparent",
                    color: lanEnabled ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  ON
                </button>
              </div>

              {/* Restart Button */}
              <button
                onClick={() => setIsRestartModalOpen(true)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: lanChanged 
                    ? "1px solid rgba(245, 158, 11, 0.4)" 
                    : "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                  backgroundColor: lanChanged 
                    ? "rgba(245, 158, 11, 0.15)" 
                    : "rgba(255, 255, 255, 0.02)",
                  color: lanChanged ? "#fbbf24" : "var(--text-secondary)",
                  fontWeight: "700",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: lanChanged ? "0 4px 12px rgba(245, 158, 11, 0.15)" : "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = lanChanged ? "rgba(245, 158, 11, 0.25)" : "rgba(255, 255, 255, 0.08)";
                  if (lanChanged) e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = lanChanged ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.02)";
                  e.currentTarget.style.color = lanChanged ? "#fbbf24" : "var(--text-secondary)";
                }}
              >
                Restart MBA Copilot
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          {lanChanged && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 18px",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "8px",
              marginBottom: "16px",
              color: "#fbbf24",
              fontSize: "0.9rem",
              lineHeight: "1.4"
            }}>
              <span style={{ fontSize: "1.2rem" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong>Network setting changed.</strong> Restart MBA Copilot to apply changes.
              </div>
            </div>
          )}

          {/* Network Status Panel Grid */}
          <div style={statusGridStyle}>
            {/* Host IP Address */}
            <div style={statusCardStyle(true)}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Host IP
                </span>
                <div style={{ fontWeight: "600", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  {lanInfo.host_ip}
                </div>
              </div>
            </div>

            {/* Frontend URL */}
            <div style={statusCardStyle(true)}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Frontend
                </span>
                <div style={{ fontWeight: "600", fontSize: "1.05rem" }}>
                  <a href={lanInfo.frontend_url} target="_blank" rel="noreferrer" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: "600" }}>
                    {lanInfo.frontend_url}
                  </a>
                </div>
              </div>
            </div>

            {/* Backend URL */}
            <div style={statusCardStyle(true)}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Backend
                </span>
                <div style={{ fontWeight: "600", fontSize: "1.05rem" }}>
                  <a href={lanInfo.backend_url} target="_blank" rel="noreferrer" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: "600" }}>
                    {lanInfo.backend_url}
                  </a>
                </div>
              </div>
            </div>

            {/* Connection Status Card */}
            <div style={statusCardStyle(lanInfo.connection_status === "Connected" || lanInfo.connection_status === "Localhost Mode")}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                  Status
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  <span style={{ 
                    width: "8px", 
                    height: "8px", 
                    borderRadius: "50%", 
                    backgroundColor: lanInfo.connection_status === "Connected" ? "#10b981" : "#fbbf24", 
                    display: "inline-block" 
                  }} />
                  {lanInfo.connection_status === "Connected" ? "🟢 Connected" : "🟢 Localhost Mode"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AGENT SETTINGS — WEB SEARCH */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>🌐 Agent Settings</div>
            <div style={cardDescStyle}>Configure settings and capabilities for the AI Agent copilot.</div>
          </div>
          <div style={cardDividerStyle} />

          {/* Web Search Toggle Row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            backgroundColor: "rgba(255, 255, 255, 0.015)",
            border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
            borderRadius: "12px",
            gap: "20px",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  backgroundColor: webSearchEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)",
                  color: webSearchEnabled ? "#10b981" : "var(--text-secondary)",
                  border: `1px solid ${webSearchEnabled ? "rgba(16, 185, 129, 0.2)" : "var(--border-color, rgba(255, 255, 255, 0.06))"}`,
                }}>
                  {webSearchEnabled ? "🟢 Web Search Enabled" : "⚪ Web Search Disabled"}
                </span>
              </div>
              <div style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "1.05rem", marginBottom: "4px" }}>
                Internet Access
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                {webSearchEnabled
                  ? "Chat can search the web using DuckDuckGo when needed (e.g. news, facts, people, companies)."
                  : "Chat is limited to local tools only — Memory, Knowledge Hub (RAG), and your personal data."}
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={handleWebSearchChange}
              title={webSearchEnabled ? "Disable Web Search" : "Enable Web Search"}
              style={{
                position: "relative",
                width: "52px",
                height: "28px",
                borderRadius: "15px",
                border: "none",
                cursor: "pointer",
                backgroundColor: webSearchEnabled ? "#9333ea" : "#374151",
                transition: "background-color 0.2s ease",
                flexShrink: 0,
                padding: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
              }}
            >
              <span style={{
                position: "absolute",
                top: "4px",
                left: webSearchEnabled ? "28px" : "4px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                transition: "left 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
              }} />
            </button>
          </div>
        </div>

        {/* MEMORY SETTINGS */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>🧠 Memory Settings</div>
            <div style={cardDescStyle}>Allow MBA Copilot to store context and preferences from your academic interactions.</div>
          </div>
          <div style={cardDividerStyle} />

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Memory Toggle Switch Row */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              backgroundColor: "rgba(255, 255, 255, 0.015)",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
              borderRadius: "12px",
              gap: "20px",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    backgroundColor: memoryEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)",
                    color: memoryEnabled ? "#10b981" : "var(--text-secondary)",
                    border: `1px solid ${memoryEnabled ? "rgba(16, 185, 129, 0.2)" : "var(--border-color, rgba(255, 255, 255, 0.06))"}`,
                  }}>
                    {memoryEnabled ? "🟢 Memory Enabled" : "⚪ Memory Disabled"}
                  </span>
                </div>
                <div style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "1.05rem", marginBottom: "4px" }}>
                  Memory Persistence
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                  When enabled, the assistant uses personal preferences, background facts, and study strategies to personalize responses.
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleMemoryChange}
                title={memoryEnabled ? "Disable Memory" : "Enable Memory"}
                style={{
                  position: "relative",
                  width: "52px",
                  height: "28px",
                  borderRadius: "15px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: memoryEnabled ? "#9333ea" : "#374151",
                  transition: "background-color 0.2s ease",
                  flexShrink: 0,
                  padding: 0,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                }}
              >
                <span style={{
                  position: "absolute",
                  top: "4px",
                  left: memoryEnabled ? "28px" : "4px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  transition: "left 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
                }} />
              </button>
            </div>

            {/* Memory Actions Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
              <button 
                onClick={openMemoryModal} 
                style={primaryButtonStyle}
              >
                Open Memory Manager
              </button>
              <button 
                onClick={handleClearMemory} 
                style={dangerButtonStyle}
              >
                Clear Memory
              </button>
            </div>
          </div>
        </div>

        {/* APPEARANCE */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>🎨 Appearance</div>
            <div style={cardDescStyle}>Customize the visual look, styling theme, and reading size of the application.</div>
          </div>
          <div style={cardDividerStyle} />

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Theme Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)" }}>Theme</span>
              <div className="settings-segmented-control" style={segmentedControlStyle}>
                {["Dark", "Light", "System"].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleThemeChange(option)}
                    style={segmentStyle(theme === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)" }}>Font Size</span>
              <div className="settings-segmented-control" style={segmentedControlStyle}>
                {["Small", "Medium", "Large"].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleFontSizeChange(option)}
                    style={segmentStyle(fontSize === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KNOWLEDGE HUB SETTINGS */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>🔑 Knowledge Hub Settings</div>
            <div style={cardDescStyle}>Manage credentials and configurations for the Knowledge Hub indexer.</div>
          </div>
          <div style={cardDividerStyle} />

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.95rem" }}>
                  OpenAI API Key
                </label>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  backgroundColor: apiKeys["OpenAI API"] ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: apiKeys["OpenAI API"] ? "#10b981" : "#ef4444",
                  border: `1px solid ${apiKeys["OpenAI API"] ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: apiKeys["OpenAI API"] ? "#10b981" : "#ef4444", display: "inline-block" }} />
                  {apiKeys["OpenAI API"] ? "Connected" : "Disconnected"}
                </span>
              </div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type={showKeys["OpenAI API"] ? "text" : "password"}
                  value={apiKeys["OpenAI API"] || ""}
                  onChange={(e) => handleApiKeyChange("OpenAI API", e.target.value)}
                  onBlur={handleSaveApiKeys}
                  placeholder="Enter OpenAI API Key (sk-...)"
                  style={inputStyle}
                />
                <button
                  onClick={() => toggleKeyVisibility("OpenAI API")}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    transition: "all 0.2s ease",
                  }}
                >
                  {showKeys["OpenAI API"] ? "Hide" : "Show"}
                </button>
                <button
                  onClick={handleSaveApiKeys}
                  style={{
                    backgroundColor: "#9333ea",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  Save
                </button>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                Note: This key is used for document embedding extraction in the Knowledge Hub.
              </span>
            </div>

            {/* Groq API Key Configuration Field */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.95rem" }}>
                  Groq API Key
                </label>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  backgroundColor: apiKeys["Groq API"] ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: apiKeys["Groq API"] ? "#10b981" : "#ef4444",
                  border: `1px solid ${apiKeys["Groq API"] ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: apiKeys["Groq API"] ? "#10b981" : "#ef4444", display: "inline-block" }} />
                  {apiKeys["Groq API"] ? "Connected" : "Disconnected"}
                </span>
              </div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type={showKeys["Groq API"] ? "text" : "password"}
                  value={apiKeys["Groq API"] || ""}
                  onChange={(e) => handleApiKeyChange("Groq API", e.target.value)}
                  onBlur={handleSaveApiKeys}
                  placeholder="Enter Groq API Key (gsk-...)"
                  style={inputStyle}
                />
                <button
                  onClick={() => toggleKeyVisibility("Groq API")}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    transition: "all 0.2s ease",
                  }}
                >
                  {showKeys["Groq API"] ? "Hide" : "Show"}
                </button>
                <button
                  onClick={handleSaveApiKeys}
                  style={{
                    backgroundColor: "#9333ea",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  Save
                </button>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                Note: This key is used for LLM inference (chat and generative recommenders) via the cloud-hosted Groq service.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.95rem" }}>
                Embedding Model
              </label>
              <input
                type="text"
                value="text-embedding-3-small"
                readOnly
                disabled
                style={{
                  ...inputStyle,
                  backgroundColor: "rgba(255,255,255,0.03)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                  cursor: "not-allowed"
                }}
              />
            </div>
          </div>
        </div>

        {/* ABOUT */}
        <div className="settings-card" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleContainerStyle}>ℹ️ About</div>
            <div style={cardDescStyle}>System metadata and underlying model parameters.</div>
          </div>
          <div style={cardDividerStyle} />

          <div style={infoGridStyle}>
            <div style={infoItemCardStyle}>
              <div style={infoLabelStyle}>Application</div>
              <div style={infoValueStyle}>MBA Copilot</div>
            </div>
            <div style={infoItemCardStyle}>
              <div style={infoLabelStyle}>Version</div>
              <div style={infoValueStyle}>1.0</div>
            </div>
            <div style={infoItemCardStyle}>
              <div style={infoLabelStyle}>Current Chat Model</div>
              <div style={infoValueStyle}>{aiStatus.chat_model || "gemma3:4b"}</div>
            </div>
            <div style={infoItemCardStyle}>
              <div style={infoLabelStyle}>Embedding Model</div>
              <div style={infoValueStyle}>text-embedding-3-small</div>
            </div>
            <div style={infoItemCardStyle}>
              <div style={infoLabelStyle}>Database Status</div>
              <div style={infoValueStyle}>
                {aiStatus.knowledge_hub_status === "Ready" ? "Ready / Active" : "Error"}
              </div>
            </div>
          </div>
        </div>

      </div>

        {/* ============================================================ */}
        {/* DEVELOPER TOOLS */}
        {/* ============================================================ */}
        <div style={{ maxWidth: "860px", margin: "0 auto 30px auto", padding: "0 24px" }}>
          {/* Collapsible header */}
          <button
            id="dev-tools-toggle"
            onClick={() => setDevToolsExpanded(prev => !prev)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(168, 85, 247, 0.2)",
              borderRadius: devToolsExpanded ? "12px 12px 0 0" : "12px",
              padding: "16px 20px",
              cursor: "pointer",
              color: "var(--text-primary)",
              transition: "all 0.2s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>🛠️</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#a855f7" }}>Developer Tools</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Advanced diagnostics and debugging tools for Knowledge Hub, Retrieval, and RAG systems
                </div>
              </div>
            </div>
            <span style={{
              fontSize: "18px",
              color: "var(--text-secondary)",
              transform: devToolsExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease"
            }}>▼</span>
          </button>

          {/* Expanded content */}
          {devToolsExpanded && (
            <div style={{
              background: "rgba(10, 15, 30, 0.7)",
              border: "1px solid rgba(168, 85, 247, 0.2)",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
              padding: "24px"
            }}>
              {/* Warning banner */}
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "28px"
              }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                <p style={{ margin: 0, fontSize: "13px", color: "#f59e0b", lineHeight: "1.5" }}>
                  These tools are intended for <strong>diagnostics and advanced troubleshooting</strong>. They query internal systems directly and are not intended for regular use.
                </p>
              </div>

              {/* ── 1. Knowledge Retrieval Tester ── */}
              <div style={{ marginBottom: "36px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  🔍 Knowledge Retrieval Tester
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "0 0 18px 0" }}>
                  Query the subject FAISS indexes directly. Searches indexed PDF chunks without invoking an LLM or generating answers.
                </p>

                <form id="dev-retrieval-form" onSubmit={handleDevTestRetrieval} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "580px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }} htmlFor="dev-retrieval-subject">
                      Subject to Search
                    </label>
                    <select
                      id="dev-retrieval-subject"
                      className="saas-input"
                      value={devRetrievalSubject}
                      onChange={e => setDevRetrievalSubject(e.target.value)}
                    >
                      <option value="">-- Select Subject --</option>
                      {devSubjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }} htmlFor="dev-retrieval-question">
                      Question / Query
                    </label>
                    <input
                      id="dev-retrieval-question"
                      type="text"
                      className="saas-input"
                      placeholder="e.g. What is strategy?"
                      value={devRetrievalQuestion}
                      onChange={e => setDevRetrievalQuestion(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="saas-button saas-button-primary"
                    id="dev-retrieval-submit"
                    disabled={devRetrievalLoading || !devRetrievalSubject || !devRetrievalQuestion.trim()}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {devRetrievalLoading ? "Searching..." : "Search Knowledge Base"}
                  </button>
                </form>

                {devRetrievalError && (
                  <div style={{ color: "#ef4444", marginTop: "12px", fontSize: "13px" }}>❌ {devRetrievalError}</div>
                )}

                {devRetrievalResults && (
                  <div style={{ marginTop: "20px" }}>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                      Subject: <strong style={{ color: "#a855f7" }}>{devRetrievalResults.subject}</strong>
                    </div>
                    {devRetrievalResults.logs && devRetrievalResults.logs.length > 0 && (
                      <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "12px", fontFamily: "monospace", fontSize: "12px", color: "#a7f3d0", marginBottom: "14px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {devRetrievalResults.logs.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    )}
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "10px" }}>Retrieved Chunks:</div>
                    {devRetrievalResults.results && devRetrievalResults.results.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No matching chunks found.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {devRetrievalResults.results && devRetrievalResults.results.map((r, i) => (
                          <div key={i} style={{ background: "rgba(15, 23, 42, 0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                              <span>Document: <strong>{r.filename}</strong></span>
                              <span>Chunk: <strong>{r.chunk_number}</strong> | Similarity: <strong style={{ color: r.similarity > 0.8 ? "#10b981" : "#f59e0b" }}>{r.similarity}</strong></span>
                            </div>
                            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-primary)", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "6px", borderLeft: "3px solid #8b5cf6" }}>
                              {r.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginBottom: "28px" }} />

              {/* ── 2. RAG Grounding Tester ── */}
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  🤖 RAG Grounding Tester
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "0 0 18px 0" }}>
                  Ask questions grounded strictly in uploaded PDF knowledge. General questions will be rejected with an anti-hallucination message.
                </p>

                <form id="dev-rag-form" onSubmit={handleDevTestRag} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "580px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }} htmlFor="dev-rag-question">
                      Question / Query
                    </label>
                    <input
                      id="dev-rag-question"
                      type="text"
                      className="saas-input"
                      placeholder="e.g. What does the uploaded note say about strategy?"
                      value={devRagQuestion}
                      onChange={e => setDevRagQuestion(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="saas-button saas-button-primary"
                    id="dev-rag-submit"
                    disabled={devRagLoading || !devRagQuestion.trim()}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {devRagLoading ? "Asking Knowledge Base..." : "Ask Knowledge Base"}
                  </button>
                </form>

                {devRagError && (
                  <div style={{ color: "#ef4444", marginTop: "12px", fontSize: "13px" }}>❌ {devRagError}</div>
                )}

                {devRagResults && (
                  <div style={{ marginTop: "20px" }}>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                      Detected Subject: <strong style={{ color: "#a855f7" }}>{devRagResults.subject}</strong>
                    </div>
                    <div style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#60a5fa", marginBottom: "8px" }}>🤖 Grounded Answer:</div>
                      <div style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{devRagResults.answer}</div>
                    </div>
                    {devRagResults.logs && devRagResults.logs.length > 0 && (
                      <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "12px", fontFamily: "monospace", fontSize: "12px", color: "#c084fc", marginBottom: "14px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {devRagResults.logs.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    )}
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "10px" }}>Retrieved Context Chunks:</div>
                    {devRagResults.chunks && devRagResults.chunks.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No context chunks used.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {devRagResults.chunks && devRagResults.chunks.map((r, i) => (
                          <div key={i} style={{ background: "rgba(15, 23, 42, 0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                              <span>Document: <strong>{r.filename}</strong></span>
                              <span>Chunk: <strong>{r.chunk_number}</strong> | Similarity: <strong style={{ color: r.similarity > 0.8 ? "#10b981" : "#f59e0b" }}>{r.similarity}</strong></span>
                            </div>
                            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-primary)", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "6px", borderLeft: "3px solid #8b5cf6" }}>
                              {r.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Memory Management Modal */}

      {isMemoryModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>🧠 Memory Manager</div>
              <button 
                onClick={() => setIsMemoryModalOpen(false)} 
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.5rem" }}
              >
                ×
              </button>
            </div>

            {/* Sticky Form Section */}
            <div style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              backgroundColor: "var(--bg-secondary)",
              paddingBottom: "20px",
              marginBottom: "20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              {editingItem ? (
                <div className="saas-card" style={{ padding: "16px 20px", gap: "12px", background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(30, 41, 59, 0.5) 100%)", border: "1px solid rgba(168, 85, 247, 0.25)", margin: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#ffffff", fontWeight: "700" }}>✏️ Edit Memory Item</h4>
                    <button onClick={() => setEditingItem(null)} className="saas-button saas-button-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>Cancel</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr auto", gap: "10px", alignItems: "end" }}>
                    <div>
                      <span className="saas-label">Category</span>
                      <select 
                        value={editingItem.category} 
                        onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                        className="saas-select"
                        style={{ width: "100%", padding: "10px" }}
                      >
                        <option value="personal">Personal</option>
                        <option value="preferences">Preferences</option>
                        <option value="academic">Academic</option>
                        <option value="goals">Goals</option>
                      </select>
                    </div>
                    <div>
                      <span className="saas-label">Key</span>
                      <input 
                        value={editingItem.key} 
                        onChange={(e) => setEditingItem({...editingItem, key: e.target.value})}
                        placeholder="Key (e.g. Name)"
                        className="saas-input"
                        style={{ padding: "10px" }}
                      />
                    </div>
                    <div>
                      <span className="saas-label">Value</span>
                      <input 
                        value={editingItem.value} 
                        onChange={(e) => setEditingItem({...editingItem, value: e.target.value})}
                        placeholder="Value"
                        className="saas-input"
                        style={{ padding: "10px" }}
                      />
                    </div>
                    <button onClick={handleSaveMemory} className="saas-button saas-button-success" style={{ padding: "10px 20px" }}>Save</button>
                  </div>
                </div>
              ) : (
                <div className="saas-card" style={{ padding: "16px 20px", gap: "12px", margin: 0 }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#ffffff", fontWeight: "700" }}>➕ Add New Memory</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr auto", gap: "10px", alignItems: "end" }}>
                    <div>
                      <span className="saas-label">Category</span>
                      <select 
                        value={newItem.category} 
                        onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                        className="saas-select"
                        style={{ width: "100%", padding: "10px" }}
                      >
                        <option value="personal">Personal</option>
                        <option value="preferences">Preferences</option>
                        <option value="academic">Academic</option>
                        <option value="goals">Goals</option>
                      </select>
                    </div>
                    <div>
                      <span className="saas-label">Key</span>
                      <input 
                        value={newItem.key} 
                        onChange={(e) => setNewItem({...newItem, key: e.target.value})}
                        placeholder="Key (e.g. Name)"
                        className="saas-input"
                        style={{ padding: "10px" }}
                      />
                    </div>
                    <div>
                      <span className="saas-label">Value</span>
                      <input 
                        value={newItem.value} 
                        onChange={(e) => setNewItem({...newItem, value: e.target.value})}
                        placeholder="Value"
                        className="saas-input"
                        style={{ padding: "10px" }}
                      />
                    </div>
                    <button onClick={handleSaveMemory} className="saas-button saas-button-primary" style={{ padding: "10px 20px" }}>Add</button>
                  </div>
                </div>
              )}
            </div>

            {/* Search and Category Filter Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <input 
                value={memorySearchQuery}
                onChange={(e) => setMemorySearchQuery(e.target.value)}
                placeholder="🔍 Search memories..."
                className="saas-input"
                style={{ padding: "10px 14px", fontSize: "0.95rem" }}
              />
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                {["all", "personal", "preferences", "academic", "goals"].map((tab) => {
                  const isActive = selectedMemoryTab === tab;
                  const label = tab.charAt(0).toUpperCase() + tab.slice(1);
                  return (
                    <button
                      key={tab}
                      onClick={() => setSelectedMemoryTab(tab)}
                      className="saas-button"
                      style={{
                        padding: "6px 14px",
                        fontSize: "0.85rem",
                        backgroundColor: isActive ? "#a855f7" : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${isActive ? "#a855f7" : "rgba(255, 255, 255, 0.08)"}`,
                        color: "#ffffff"
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Memory Cards Display */}
            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              {(() => {
                // Filter memoryData based on selectedMemoryTab and memorySearchQuery
                const getFilteredMemoryData = () => {
                  const result = {};
                  Object.entries(memoryData).forEach(([category, items]) => {
                    // Category filter
                    if (selectedMemoryTab !== "all" && category.toLowerCase() !== selectedMemoryTab.toLowerCase()) {
                      return;
                    }
                    
                    const filteredItems = {};
                    Object.entries(items).forEach(([key, value]) => {
                      const valStr = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
                      // Search filter
                      const matchesSearch = 
                        key.toLowerCase().includes(memorySearchQuery.toLowerCase()) || 
                        valStr.toLowerCase().includes(memorySearchQuery.toLowerCase());
                      if (matchesSearch) {
                        filteredItems[key] = value;
                      }
                    });
                    
                    if (Object.keys(filteredItems).length > 0) {
                      result[category] = filteredItems;
                    }
                  });
                  return result;
                };

                const filteredData = getFilteredMemoryData();
                const categoryLabels = {
                  personal: "👤 Personal",
                  preferences: "🎯 Preferences",
                  academic: "🎓 Academic",
                  goals: "🏆 Goals"
                };

                if (Object.keys(filteredData).length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)" }}>
                      <div style={{ fontSize: "2rem", marginBottom: "8px" }}>💭</div>
                      No memory items match your filters.
                    </div>
                  );
                }

                return Object.entries(filteredData).map(([category, items]) => (
                  <div key={category}>
                    <h4 style={{
                      color: "#a855f7",
                      textTransform: "uppercase",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}>
                      {categoryLabels[category.toLowerCase()] || `🧠 ${category}`}
                    </h4>
                    
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: "12px"
                    }}>
                      {Object.entries(items).map(([key, value]) => {
                        const displayVal = typeof value === 'object' && value !== null 
                          ? JSON.stringify(value) 
                          : String(value);

                        return (
                          <div 
                            key={`${category}-${key}`}
                            className="saas-card"
                            style={{
                              padding: "16px",
                              backgroundColor: "rgba(30, 41, 59, 0.4)",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "12px",
                              margin: 0
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                                {key}
                              </div>
                              <div style={{ fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: "500", wordBreak: "break-word", lineHeight: "1.4" }}>
                                {displayVal}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "8px", marginTop: "4px" }}>
                              <button 
                                onClick={() => handleEditMemory(category, key, value)}
                                className="saas-button"
                                style={{ padding: "6px 12px", fontSize: "0.75rem", flex: 1, backgroundColor: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#60a5fa" }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteMemory(category, key)}
                                className="saas-button"
                                style={{ padding: "6px 12px", fontSize: "0.75rem", flex: 1, backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171" }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* LAN Access Restart Confirmation Modal */}
      {isRestartModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, width: "450px", textAlign: "center", padding: "30px 24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🔄</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "12px", color: "var(--text-primary)" }}>
              Restart MBA Copilot now?
            </div>
            <div style={{ fontSize: "0.925rem", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "28px" }}>
              Network changes require a restart to take effect.
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setIsRestartModalOpen(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  color: "var(--text-primary)",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={triggerRestart}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#9333ea",
                  color: "#ffffff",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)"
                }}
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restarting Progress Overlay */}
      {restarting && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          backdropFilter: "blur(8px)",
          color: "#ffffff",
          textAlign: "center",
          padding: "24px"
        }}>
          {/* Animated Spinner */}
          <div style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            border: "3px solid rgba(147, 51, 234, 0.1)",
            borderTopColor: "#9333ea",
            animation: "spin 1s linear infinite",
            marginBottom: "20px"
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          
          <div style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "12px" }}>
            Restarting MBA Copilot
          </div>
          <div style={{ fontSize: "0.975rem", color: "#94a3b8", maxWidth: "450px", lineHeight: "1.6", marginBottom: "12px" }}>
            {lanEnabled 
              ? "Rebinding backend to 0.0.0.0 and refreshing frontend dev server. This allows access from other devices on your local network..."
              : "Rebinding backend to localhost and restricting connection to this machine only. Remote devices will lose access..."}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Reconnecting to backend services. Please wait...
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;

