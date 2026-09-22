import { useEffect, useRef, useState } from "react";

// AIAssistant - Chat interface panel
// State is lifted to App.jsx so conversation persists across pop-out toggles.
// Props: messages, setMessages, inputValue, setInputValue

function AIAssistant({ messages, setMessages, inputValue, setInputValue }) {
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      isBot: false,
      timestamp: new Date(),
    };

    const messageToSend = inputValue;
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    const chatHistory = updatedMessages.map((msg) => ({
      role: msg.isBot ? "assistant" : "user",
      content: msg.text,
    }));

    const tempBotMessageId = Date.now() + 1;

    setMessages((prev) => [
      ...prev,
      { id: tempBotMessageId, text: "Thinking...", isBot: true, timestamp: new Date() },
    ]);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, history: chatHistory }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let textBuffer = "";
      let hasReceivedResponse = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          textBuffer += chunk;
          const lines = textBuffer.split("\n");
          textBuffer = lines.pop();
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.response) {
                  hasReceivedResponse = true;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempBotMessageId ? { ...msg, text: parsed.response } : msg
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

      if (!hasReceivedResponse) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempBotMessageId ? { ...msg, text: "No response received." } : msg
          )
        );
      }
    } catch (error) {
      console.error(error);
      const errorMessage =
        error.message === "Failed to fetch"
          ? "Unable to connect to MBA Copilot backend."
          : `Error: ${error.message}`;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempBotMessageId ? { ...msg, text: errorMessage } : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const QUICK_PROMPTS = [
    { label: "Study today?", text: "What should I study today?" },
    { label: "Plan my week", text: "Plan my week" },
    { label: "Attention?",   text: "What needs attention?" },
    { label: "Exam strategy", text: "Exam Strategy" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Scrollable message history */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 6px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(139,92,246,0.3) transparent",
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              justifyContent: message.isBot ? "flex-start" : "flex-end",
              gap: "8px",
              alignItems: "flex-end",
            }}
          >
            {message.isBot && (
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  flexShrink: 0,
                  marginBottom: "2px",
                  boxShadow: "0 0 8px rgba(139,92,246,0.4)",
                }}
              >
                🤖
              </div>
            )}
            <div
              style={{
                maxWidth: "80%",
                backgroundColor: message.isBot
                  ? "rgba(30, 41, 59, 0.95)"
                  : "rgba(109, 40, 217, 0.85)",
                color: "#f1f5f9",
                padding: "9px 12px",
                borderRadius: message.isBot ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                fontSize: "13px",
                lineHeight: "1.5",
                wordWrap: "break-word",
                overflowWrap: "break-word",
                border: message.isBot ? "1px solid rgba(255,255,255,0.07)" : "none",
                boxShadow: message.isBot ? "none" : "0 2px 12px rgba(109,40,217,0.35)",
              }}
            >
              {message.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", paddingLeft: "34px" }}>
            {[0, 0.2, 0.4].map((delay, i) => (
              <span
                key={i}
                style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  backgroundColor: "#8b5cf6",
                  display: "inline-block",
                  animation: `aiDotBounce 1s infinite ${delay}s`,
                }}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick-prompt chips */}
      <div
        style={{
          padding: "7px 14px",
          display: "flex",
          flexWrap: "wrap",
          gap: "5px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            onClick={() => setInputValue(qp.text)}
            style={{
              backgroundColor: "rgba(139, 92, 246, 0.1)",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              borderRadius: "20px",
              padding: "3px 10px",
              color: "#c4b5fd",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(139, 92, 246, 0.22)";
              e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(139, 92, 246, 0.1)";
              e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.25)";
            }}
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ padding: "10px 14px 14px", display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask MBA Copilot..."
          style={{
            flex: 1,
            padding: "9px 14px",
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
            fontSize: "13px",
            outline: "none",
            fontFamily: "Inter, system-ui, sans-serif",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(139, 92, 246, 0.7)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
          title="Send"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "none",
            background: inputValue.trim() && !isLoading
              ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
              : "rgba(255,255,255,0.06)",
            color: inputValue.trim() && !isLoading ? "#ffffff" : "#64748b",
            cursor: inputValue.trim() && !isLoading ? "pointer" : "not-allowed",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s",
            boxShadow: inputValue.trim() && !isLoading ? "0 2px 10px rgba(139,92,246,0.4)" : "none",
          }}
        >
          &#10148;
        </button>
      </div>

      <style>{`
        @keyframes aiDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default AIAssistant;
