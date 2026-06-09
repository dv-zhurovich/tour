import React, { useState, useEffect, useRef } from "react";
import { useClient } from "../context/ClientContext";

export default function ChatWidget() {
  // Состояние чата хранит открытость окна, историю сообщений и id серверной сессии.
  const { client } = useClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [lastPoll, setLastPoll] = useState(null);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Загружаем историю если есть sessionId
  useEffect(() => {
    const saved = localStorage.getItem("chat_session_id");
    if (saved) {
      setSessionId(saved);
      fetch(`/api/chat/history/${saved}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data.map((m) => ({ role: m.role, text: m.content })));
            setLastPoll(new Date().toISOString());
          }
        })
        .catch(() => {});
    } else {
      setMessages([
        {
          role: "assistant",
          text: "👋 Добро пожаловать в DianaTour! Я помогу ответить на ваши вопросы о турах. Чем могу помочь?",
        },
      ]);
    }
  }, []);

  // Поллинг новых сообщений от менеджера
  useEffect(() => {
    if (!sessionId) return;
    pollRef.current = setInterval(async () => {
      try {
        const since = lastPoll || new Date(0).toISOString();
        const res = await fetch(`/api/chat/poll/${sessionId}?since=${since}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setMessages((prev) => [
            ...prev,
            ...data.map((m) => ({
              role: "assistant",
              text: m.content,
              fromManager: true,
            })),
          ]);
          setLastPoll(new Date().toISOString());
        }
      } catch {}
    }, 3000); // каждые 3 секунды

    return () => clearInterval(pollRef.current);
  }, [sessionId, lastPoll]);

  const sendMessage = async () => {
    // Отправляет вопрос на backend: ответ может прийти от AI или живого менеджера.
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });
      const data = await res.json();
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem("chat_session_id", data.session_id);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          fromManager: data.handled_by === "human",
        },
      ]);
      setLastPoll(new Date().toISOString());
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "❌ Ошибка соединения. Попробуйте позже.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Кнопка открытия */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 999,
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "var(--gold)",
          border: "none",
          cursor: "pointer",
          fontSize: "1.5rem",
          boxShadow: "0 4px 20px rgba(201,168,76,0.5)",
          transition: "transform 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="Чат с поддержкой"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Окно чата */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 96,
            right: 28,
            zIndex: 998,
            width: 360,
            height: 500,
            background: "rgba(14,14,18,0.97)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            overflow: "hidden",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Заголовок */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              background: "rgba(201,168,76,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              ◈
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1rem",
                  color: "var(--text)",
                }}
              >
                DianaTour Support
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--gold)" }}>
                ● Онлайн 24/7
              </div>
            </div>
          </div>

          {/* Сообщения */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius:
                      m.role === "user"
                        ? "12px 12px 2px 12px"
                        : "12px 12px 12px 2px",
                    background:
                      m.role === "user"
                        ? "rgba(201,168,76,0.25)"
                        : "rgba(255,255,255,0.06)",
                    border: "1px solid",
                    borderColor:
                      m.role === "user"
                        ? "rgba(201,168,76,0.4)"
                        : "var(--border)",
                    fontSize: "0.88rem",
                    lineHeight: 1.5,
                    color: "var(--text)",
                  }}
                >
                  {m.fromManager && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--gold)",
                        marginBottom: 4,
                      }}
                    >
                      👤 Менеджер
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px 12px 12px 2px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    fontSize: "0.88rem",
                  }}
                >
                  <span style={{ letterSpacing: 2 }}>●●●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Поле ввода */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Напишите вопрос..."
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: "0.88rem",
                outline: "none",
                fontFamily: "var(--font-body)",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 16px",
                background: "var(--gold)",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "1rem",
                color: "var(--dark)",
                opacity: loading || !input.trim() ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
