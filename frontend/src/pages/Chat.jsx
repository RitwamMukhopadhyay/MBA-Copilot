import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Helper to generate guaranteed unique IDs
const generateUniqueId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const [currentAI, setCurrentAI] = useState(null);

  // Fetch current active model info on load
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

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset chat history on page load/refresh
  useEffect(() => {
    const resetChat = async () => {
      try {
        await fetch("http://127.0.0.1:8000/chat/reset", {
          method: "POST",
        });
        console.log("[Chat] Conversation history reset on refresh");
      } catch (err) {
        console.error("[Chat] Failed to reset conversation history:", err);
      }
    };

    resetChat();
  }, []);

  // Send message to backend
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim()) {
      setError("Message cannot be empty");
      setTimeout(() => setError(""), 3000);
      return;
    }
    console.log("[CHAT] Message Sent");

    const userMessage = inputMessage.trim();
    const userMessageId = generateUniqueId();
    setMessages((prev) => [
      ...prev.filter(Boolean),
      {
        id: userMessageId,
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);

    setInputMessage("");
    setError("");
    setLoading(true);

    const tempMessageId = generateUniqueId();

    try {
      console.log("[CHAT] API Request Started");
      const response = await fetch("http://127.0.0.1:8000/chat/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log("[CHAT] Response Received");

      // Add a placeholder message inside messages list with loading stages
      setMessages((prev) => [
        ...prev.filter(Boolean),
        {
          id: tempMessageId,
          role: "assistant",
          content: "",
          status: "thinking",
          stages: ["thinking"],
          timestamp: new Date(),
        },
      ]);
      setLoading(false); // Turn off page loader, stream inline stages instead

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
                  setMessages((prev) =>
                    prev.filter(Boolean).map((msg) => {
                      if (msg && msg.id === tempMessageId) {
                        const currentStages = msg.stages || [];
                        const updatedStages = currentStages.includes(parsed.status)
                          ? currentStages
                          : [...currentStages, parsed.status];
                        return {
                          ...msg,
                          status: parsed.status,
                          stages: updatedStages,
                        };
                      }
                      return msg;
                    })
                  );
                } else if (parsed.response) {
                  setMessages((prev) =>
                    prev.filter(Boolean).map((msg) =>
                      msg && msg.id === tempMessageId
                        ? { ...msg, content: parsed.response || "", status: "complete" }
                        : msg
                    )
                  );
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
      console.log("[CHAT] API Request Complete");
    } catch (err) {
      setLoading(false);
      const errorMessage = err.message === "Failed to fetch"
          ? "Cannot connect to backend. Please make sure the server is running."
          : `Error: ${err.message}`;

      setError(errorMessage);
      
      // Update temp message to display error, or add new if it wasn't rendered yet
      setMessages((prev) => {
        const filteredPrev = prev.filter(Boolean);
        const hasTempMsg = filteredPrev.some((msg) => msg && msg.id === tempMessageId);
        if (hasTempMsg) {
          return filteredPrev.map((msg) =>
            msg && msg.id === tempMessageId
              ? { ...msg, role: "error", content: errorMessage, status: "complete" }
              : msg
          );
        } else {
          return [
            ...filteredPrev,
            {
              id: tempMessageId,
              role: "error",
              content: errorMessage,
              status: "complete",
              timestamp: new Date(),
            },
          ];
        }
      });
    }
  };

  const filteredMessages = messages.filter(Boolean);

  return (
    <div className="saas-chat-container">
      <div className="saas-chat-wrapper">
        <style>
          {`
            @keyframes spin { to { transform: rotate(360deg); } }

            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(0.98); }
            }

            /* Professional Markdown Styles */
            .markdown-container {
              word-break: break-word;
            }
            .markdown-container h1,
            .markdown-container h2,
            .markdown-container h3,
            .markdown-container h4 {
              color: #ffffff;
              font-weight: 700;
              margin-top: 24px;
              margin-bottom: 12px;
              line-height: 1.4;
            }
            .markdown-container h1:first-child,
            .markdown-container h2:first-child,
            .markdown-container h3:first-child,
            .markdown-container h4:first-child {
              margin-top: 0;
            }
            .markdown-container h1 {
              font-size: 1.75rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.15);
              padding-bottom: 8px;
            }
            .markdown-container h2 {
              font-size: 1.45rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
              padding-bottom: 6px;
            }
            .markdown-container h3 {
              font-size: 1.25rem;
            }
            .markdown-container h4 {
              font-size: 1.1rem;
            }
            
            .markdown-container p {
              margin-top: 0;
              margin-bottom: 12px;
              line-height: 1.6;
            }
            .markdown-container p:last-child {
              margin-bottom: 0;
            }

            /* Lists Styling */
            .markdown-container ul,
            .markdown-container ol {
              margin-top: 4px;
              margin-bottom: 12px;
              padding-left: 20px;
            }
            .markdown-container ul {
              list-style-type: disc;
            }
            .markdown-container ol {
              list-style-type: decimal;
            }
            .markdown-container ul ul,
            .markdown-container ul ol,
            .markdown-container ol ul,
            .markdown-container ol ol {
              margin-top: 4px;
              margin-bottom: 0;
            }
            .markdown-container li {
              margin-bottom: 6px;
              line-height: 1.6;
            }
            .markdown-container li p {
              margin-bottom: 0;
              display: inline;
            }

            /* Code & Code Blocks Styling */
            .markdown-container code {
              font-family: 'Fira Code', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
              font-size: 0.9em;
              background-color: rgba(15, 23, 42, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.08);
              padding: 3px 6px;
              border-radius: 4px;
              color: #f472b6;
              word-break: break-word;
            }
            .markdown-container pre {
              background-color: #0b0f19;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              padding: 14px;
              overflow-x: auto;
              margin: 16px 0;
            }
            .markdown-container pre code {
              background-color: transparent;
              border: none;
              padding: 0;
              border-radius: 0;
              color: #cbd5e1;
              font-size: 0.88rem;
              display: block;
              white-space: pre;
              word-break: normal;
            }

            /* Dark Themed Table Styling with Rounded Corners (Responsive) */
            .markdown-container table {
              display: block;
              width: 100%;
              overflow-x: auto;
              border-collapse: separate;
              border-spacing: 0;
              margin: 18px 0;
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 8px;
              background-color: #0f172a;
            }
            .markdown-container th,
            .markdown-container td {
              padding: 10px 14px;
              text-align: left;
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
              border-right: 1px solid rgba(255, 255, 255, 0.08);
              font-size: 0.9rem;
            }
            .markdown-container th:last-child,
            .markdown-container td:last-child {
              border-right: none;
            }
            .markdown-container th {
              background-color: #1e293b;
              color: #ffffff;
              font-weight: 700;
              border-bottom: 1px solid rgba(255, 255, 255, 0.18);
              text-transform: uppercase;
              font-size: 0.78rem;
              letter-spacing: 0.05em;
            }
            .markdown-container tr:last-child td {
              border-bottom: none;
            }
            .markdown-container tr:nth-child(even) {
              background-color: rgba(255, 255, 255, 0.03);
            }
            .markdown-container tr:hover td {
              background-color: rgba(255, 255, 255, 0.05);
            }

            /* Separators, Bold & Italics */
            .markdown-container hr {
              border: 0;
              border-top: 1px solid rgba(255, 255, 255, 0.15);
              margin: 24px 0;
            }
            .markdown-container strong {
              color: #ffffff;
              font-weight: 700;
            }
            .markdown-container em {
              font-style: italic;
              color: #cbd5e1;
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
              <h1 className="saas-title" style={{ fontSize: "2rem" }}>💬 Academic AI Assistant</h1>
              <p className="saas-subtitle">Ask questions, research topics, or write reports with local and web search tools.</p>
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
                  <span style={{ margin: "0 8px", color: "rgba(255, 255, 255, 0.15)" }}>|</span>
                  <strong>Mode:</strong> {currentAI.mode} 
                  <span style={{ margin: "0 8px", color: "rgba(255, 255, 255, 0.15)" }}>|</span>
                  <strong>Status:</strong> <span style={{ color: currentAI.status === "Connected" ? "#10b981" : "#ef4444", fontWeight: "bold" }}>{currentAI.status}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <div className="saas-chat-bubble-error" style={{ padding: "12px", margin: "10px 0", borderRadius: "8px", width: "80%", textAlign: "center" }}>
              ⚠️ {error}
            </div>
          </div>
        )}

        {/* Messages Feed Wrapper */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", width: "100%" }}>
          <div className="saas-chat-messages" style={{ width: "100%", maxWidth: "80%", margin: "0 auto", paddingRight: "8px", gap: "20px" }}>
            {filteredMessages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "40vh", color: "#64748b", textAlign: "center" }}>
                <div style={{ fontSize: "4rem", marginBottom: "16px" }}>💬</div>
                <h3 style={{ color: "var(--text-primary)", margin: "0 0 8px 0" }}>Start a Conversation</h3>
                <p style={{ maxWidth: "450px", fontSize: "0.95rem", lineHeight: "1.5", margin: 0 }}>
                  Ask questions grounded in your knowledge base, trigger web searches, or check local system context.
                </p>
              </div>
            ) : (
              <>
                {filteredMessages.map((msg) => {
                  const role = msg.role || "assistant";
                  const content = msg.content || "";
                  const id = msg.id || generateUniqueId();
                  const isUser = role === "user";
                  const isError = role === "error";

                  return (
                    <div key={id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "12px", width: "100%" }}>
                      <div className={`saas-chat-bubble ${isUser ? "saas-chat-bubble-user" : isError ? "saas-chat-bubble-error" : "saas-chat-bubble-agent"}`}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "0.8rem", color: isUser ? "rgba(255,255,255,0.7)" : "var(--text-secondary)" }}>
                          <span>{isUser ? "👤 You" : isError ? "❌ Error" : "🤖 Assistant"}</span>
                          {msg.timestamp && (
                            <>
                              <span>•</span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </>
                          )}
                        </div>

                        <div className="markdown-container">
                          {role === "assistant" ? (
                            msg.status === "complete" ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {content}
                              </ReactMarkdown>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "6px 0" }}>
                                {["searching_memory", "searching_knowledge", "searching_web", "thinking"].map((stage, idx) => {
                                  const isStarted = (msg.stages || []).includes(stage);
                                  const isCurrent = msg.status === stage;
                                  const isCompleted = isStarted && !isCurrent;

                                  let icon = "🤖";
                                  let text = "Thinking...";
                                  if (stage === "searching_memory") {
                                    icon = "🔍";
                                    text = "Searching memory...";
                                  } else if (stage === "searching_web") {
                                    icon = "🌐";
                                    text = "Searching web...";
                                  } else if (stage === "searching_knowledge") {
                                    icon = "📚";
                                    text = "Searching knowledge base...";
                                  } else if (stage === "thinking") {
                                    icon = "🧠";
                                    text = "Formulating response...";
                                  }

                                  if (!isStarted && stage !== "thinking") return null;

                                  return (
                                    <div
                                      key={`${stage}-${idx}`}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        fontSize: "0.95rem",
                                        color: isCurrent ? "#ffffff" : isCompleted ? "#a855f7" : "#64748b",
                                        fontWeight: isCurrent ? "600" : "400",
                                      }}
                                    >
                                      {isCompleted ? (
                                        <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "1.1rem", display: "inline-block", marginRight: "2px" }}>✓</span>
                                      ) : isCurrent ? (
                                        <div style={{
                                          width: "12px",
                                          height: "12px",
                                          border: "2px solid rgba(168, 85, 247, 0.2)",
                                          borderTopColor: "#a855f7",
                                          borderRadius: "50%",
                                          animation: "spin 0.8s linear infinite",
                                          display: "inline-block",
                                          marginRight: "6px"
                                        }} />
                                      ) : (
                                        <span style={{ color: "#64748b", fontSize: "1.1rem", display: "inline-block", marginRight: "6px" }}>○</span>
                                      )}
                                      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                                      <span>{text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#94a3b8", fontSize: "0.95rem", marginBottom: "12px" }}>
                    <div style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(168, 85, 247, 0.2)",
                      borderTop: "2px solid #a855f7",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}></div>
                    <span>AI is formulating thoughts...</span>
                  </div>
                )}

                {/* Anchor for auto-scrolling */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input area */}
        <form onSubmit={handleSendMessage} className="chat-input-form" style={{ display: "flex", gap: "12px", padding: "10px 0 0 0", width: "100%" }}>
          <input
            className="saas-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            style={{ padding: "14px 18px", fontSize: "1rem" }}
          />
          <button className="saas-button saas-button-primary" type="submit" disabled={loading} style={{ minWidth: "120px", padding: "14px 20px" }}>
            {loading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;