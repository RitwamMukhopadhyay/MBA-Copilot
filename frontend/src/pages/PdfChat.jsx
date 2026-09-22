import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const generateUniqueId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

function PdfChat() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [pdfs, setPdfs] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentAI, setCurrentAI] = useState(null);
  const messagesEndRef = useRef(null);

  // Fetch current AI settings on load
  useEffect(() => {
    const fetchCurrentAI = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/settings/current-model");
        if (res.ok) {
          const data = await res.json();
          setCurrentAI(data);
        }
      } catch (err) {
        console.error("Error fetching current AI:", err);
      }
    };
    fetchCurrentAI();
  }, []);

  // Fetch all subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/subjects");
        if (res.ok) {
          const data = await res.json();
          setSubjects(data);
        }
      } catch (err) {
        console.error("Error fetching subjects:", err);
        setError("Failed to load subjects. Please check if the backend is running.");
      }
    };
    fetchSubjects();
  }, []);

  // Fetch PDFs when subject changes
  useEffect(() => {
    if (!selectedSubject) {
      setPdfs([]);
      setSelectedPdf("");
      setMessages([]);
      return;
    }

    const fetchPdfs = async () => {
      try {
        setError("");
        const res = await fetch(`http://127.0.0.1:8000/subject-pdfs/${encodeURIComponent(selectedSubject)}`);
        if (res.ok) {
          const data = await res.json();
          setPdfs(data);
          setSelectedPdf("");
          setMessages([]);
        }
      } catch (err) {
        console.error("Error fetching PDFs:", err);
        setError("Failed to load PDFs for this subject.");
      }
    };
    fetchPdfs();
  }, [selectedSubject]);

  // Fetch chat history when selected PDF changes
  useEffect(() => {
    if (!selectedSubject || !selectedPdf) {
      setMessages([]);
      return;
    }

    const fetchHistory = async () => {
      try {
        setError("");
        const res = await fetch(
          `http://127.0.0.1:8000/pdf-chat/history?subject_name=${encodeURIComponent(selectedSubject)}&pdf_name=${encodeURIComponent(selectedPdf)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.history) {
            setMessages(data.history.map(m => ({
              id: generateUniqueId(),
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp)
            })));
          }
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
      }
    };
    fetchHistory();
  }, [selectedPdf, selectedSubject]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear chat history
  const handleClearHistory = async () => {
    if (!selectedSubject || !selectedPdf) return;
    const confirmClear = window.confirm(`Clear chat history for "${selectedPdf}"?`);
    if (!confirmClear) return;

    try {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8000/pdf-chat/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_name: selectedSubject,
          pdf_name: selectedPdf
        })
      });
      if (res.ok) {
        setMessages([]);
        setError("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to clear history");
      }
    } catch (err) {
      setError("Network error clearing history.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger preset action or custom query
  const handleAsk = async (questionType, customQuestion = null) => {
    if (!selectedSubject || !selectedPdf) {
      setError("Please select a subject and a PDF first.");
      return;
    }
    setError("");
    setLoading(true);

    let userMsgText = "";
    if (questionType === "summarize") userMsgText = "Summarize PDF";
    else if (questionType === "notes") userMsgText = "Generate Notes";
    else if (questionType === "mcqs") userMsgText = "Generate MCQs";
    else if (questionType === "flashcards") userMsgText = "Generate Flashcards";
    else if (questionType === "viva") userMsgText = "Generate Viva Questions";
    else if (questionType === "custom") {
      userMsgText = customQuestion ? customQuestion.trim() : "";
    }

    if (!userMsgText) {
      setLoading(false);
      return;
    }

    // Optimistically add user message to list
    const userMsgId = generateUniqueId();
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMsgText,
        timestamp: new Date()
      }
    ]);

    if (questionType === "custom") {
      setInputMessage("");
    }

    const assistantMsgId = generateUniqueId();
    // Optimistically add thinking message
    setMessages(prev => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "⌛ Thinking...",
        timestamp: new Date()
      }
    ]);

    try {
      const res = await fetch("http://127.0.0.1:8000/pdf-chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_name: selectedSubject,
          pdf_name: selectedPdf,
          question_type: questionType,
          custom_question: customQuestion
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Update the assistant response
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId) {
          return {
            ...m,
            content: data.response
          };
        }
        return m;
      }));
    } catch (err) {
      console.error("Error asking PDF:", err);
      const errMsg = `Error: ${err.message}`;
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId) {
          return {
            ...m,
            role: "error",
            content: errMsg
          };
        }
        return m;
      }));
    } finally {
      setLoading(false);
    }
  };

  const presetActions = [
    { type: "summarize", label: "📝 Summarize PDF", desc: "Get an executive summary" },
    { type: "notes", label: "📚 Generate Notes", desc: "Structured MBA revision notes" },
    { type: "mcqs", label: "✍️ Generate MCQs", desc: "Generate multiple-choice Qs" },
    { type: "flashcards", label: "🎴 Generate Flashcards", desc: "Generate flashcard prompts" },
    { type: "viva", label: "🗣️ Viva Questions", desc: "Prepare oral exam Q&As" },
  ];

  const filteredMessages = messages.filter(Boolean);

  return (
    <div className="saas-chat-container">
      <div className="saas-chat-wrapper">
        <style>
          {`
            /* Custom style mappings to format outputs from ReactMarkdown */
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

            .pdf-action-card:hover {
              border-color: var(--accent) !important;
              box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15) !important;
              transform: translateY(-2px);
            }

            .pdf-tool-btn:hover {
              background-color: rgba(255, 255, 255, 0.06) !important;
              border-color: rgba(255, 255, 255, 0.15) !important;
            }

            /* Message Bubbles Styling */
            .saas-chat-bubble {
              max-width: 80%;
              padding: 16px 20px !important;
              font-size: 1.05rem !important;
              border-radius: 12px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
            }
            .saas-chat-bubble-user {
              background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%) !important;
              color: #ffffff !important;
              border-bottom-right-radius: 2px !important;
            }
            .saas-chat-bubble-agent {
              background: linear-gradient(135deg, rgba(30, 41, 59, 0.65) 0%, rgba(15, 23, 42, 0.8) 100%) !important;
              border: 1px solid rgba(168, 85, 247, 0.18) !important;
              color: var(--text-primary) !important;
              border-bottom-left-radius: 2px !important;
            }
            .saas-chat-bubble-error {
              background: rgba(239, 68, 68, 0.15) !important;
              border: 1px solid rgba(239, 68, 68, 0.35) !important;
              color: #fca5a5 !important;
              border-bottom-left-radius: 2px !important;
            }
          `}
        </style>

        {/* Page Header */}
        <div className="saas-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
            <div>
              <h1 className="saas-title" style={{ fontSize: "2rem" }}>📄 AI PDF Chat</h1>
              <p className="saas-subtitle">Ask questions, summarize, and generate study resources from your subject PDFs.</p>
            </div>

            {currentAI && (
              <div className="saas-card" style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                fontSize: "0.85rem",
                margin: 0
              }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: currentAI.status === "Connected" ? "#10b981" : "#ef4444",
                  display: "inline-block"
                }} />
                <div>
                  <strong>Active AI:</strong> {currentAI.provider} ({currentAI.model || "None"})
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="saas-chat-bubble-error" style={{ padding: "12px", margin: "10px 0", borderRadius: "8px", width: "100%" }}>⚠️ {error}</div>}

        {/* Selectors row */}
        <div className="pdf-selectors-row" style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" }}>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="saas-select"
            style={{ width: "auto", minWidth: "220px", cursor: "pointer" }}
          >
            <option value="">-- Select Subject --</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.name}>
                {sub.name} ({sub.course_code})
              </option>
            ))}
          </select>

          <select
            value={selectedPdf}
            onChange={(e) => setSelectedPdf(e.target.value)}
            disabled={!selectedSubject}
            className="saas-select"
            style={{
              width: "auto",
              minWidth: "220px",
              opacity: selectedSubject ? 1 : 0.6,
              cursor: selectedSubject ? "pointer" : "not-allowed"
            }}
          >
            <option value="">-- Select PDF --</option>
            {Array.isArray(pdfs) && pdfs.map((pdf, idx) => {
              const name = typeof pdf === "string" ? pdf : pdf?.name || "";
              return (
                <option key={idx} value={name}>
                  {name.replace(/^\d{8}_\d{6}_/, "")}
                </option>
              );
            })}
          </select>

          {selectedPdf && messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={loading}
              className="saas-button saas-button-danger"
            >
              Clear Chat History
            </button>
          )}
        </div>

        {/* Main chat window container */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.25) 0%, rgba(15, 23, 42, 0.4) 100%)",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          position: "relative",
          minHeight: "350px",
        }}>
          {!selectedPdf ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📄</div>
              <h3 style={{ color: "var(--text-primary)", margin: "0 0 10px 0", fontSize: "1.3rem" }}>Start a PDF Chat Session</h3>
              <p style={{ maxWidth: "500px", fontSize: "0.95rem", lineHeight: "1.6" }}>
                Please select a subject and then select a PDF from the dropdown menus above. You'll be able to ask custom queries or auto-generate MBA summaries, notes, flashcards, MCQs, and viva questions.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Actions Toolbar when chat has history */}
              {messages.length > 0 && (
                <div style={{ display: "flex", gap: "10px", padding: "10px 15px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", backgroundColor: "rgba(15, 23, 42, 0.4)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", marginRight: "5px" }}>
                    Quick Actions:
                  </span>
                  {presetActions.map((act) => (
                    <button
                      key={act.type}
                      disabled={loading}
                      onClick={() => handleAsk(act.type)}
                      className="saas-button saas-button-secondary pdf-tool-btn"
                      style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                    >
                      {act.label.split(" ")[0]} {act.label.substring(act.label.indexOf(" ") + 1)}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages body with 80% content centering */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", width: "100%" }}>
                <div className="saas-chat-messages" style={{ width: "100%", maxWidth: "80%", margin: "0 auto", padding: "20px 8px", gap: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
                  {messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🧠</div>
                      <h4 style={{ color: "var(--text-primary)", margin: "0 0 8px 0", fontSize: "1.1rem" }}>PDF Loaded Successfully</h4>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
                        Select an action below or ask a custom question to analyze <strong>{selectedPdf}</strong>
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", width: "100%", maxWidth: "900px", marginTop: "20px" }}>
                        {presetActions.map((act) => (
                          <button
                            key={act.type}
                            disabled={loading}
                            onClick={() => handleAsk(act.type)}
                            className="pdf-action-card saas-card"
                            style={{ padding: "20px", textAlign: "left", cursor: "pointer", transition: "all 0.2s ease", margin: 0 }}
                          >
                            <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--text-primary)", marginBottom: "5px" }}>
                              {act.label}
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                              {act.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => {
                        const isUser = msg.role === "user";
                        const isError = msg.role === "error";

                        return (
                          <div key={msg.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "12px", width: "100%" }}>
                            <div className={`saas-chat-bubble ${isUser ? "saas-chat-bubble-user" : isError ? "saas-chat-bubble-error" : "saas-chat-bubble-agent"}`}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "0.8rem", color: isUser ? "rgba(255,255,255,0.7)" : "var(--text-secondary)" }}>
                                <span>{isUser ? "👤 You" : isError ? "❌ Error" : "🤖 MBA Copilot"}</span>
                                <span>•</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              <div className="pdf-markdown-container">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {loading && !messages.some(m => m.content === "⌛ Thinking...") && (
                        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px", width: "100%" }}>
                          <div className="saas-chat-bubble saas-chat-bubble-agent" style={{ opacity: 0.7 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem" }}>
                              <span>⌛</span>
                              <span>AI is preparing resources...</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </div>

              {/* Input form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk("custom", inputMessage);
                }}
                className="chat-input-form"
                style={{ display: "flex", gap: "12px", padding: "15px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", backgroundColor: "rgba(15, 23, 42, 0.2)" }}
              >
                <input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={loading ? "AI is processing..." : `Ask a question about "${selectedPdf}"...`}
                  disabled={loading || !selectedPdf}
                  className="saas-input"
                  style={{ padding: "14px 18px", fontSize: "1rem" }}
                />
                <button
                  type="submit"
                  disabled={loading || !selectedPdf || !inputMessage.trim()}
                  className="saas-button saas-button-primary"
                  style={{ minWidth: "120px", padding: "14px 20px" }}
                >
                  {loading ? "..." : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PdfChat;
