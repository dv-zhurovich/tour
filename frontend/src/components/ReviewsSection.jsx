import React, { useState, useEffect } from "react";
import { useClient } from "../context/ClientContext";

export default function ReviewsSection({ destinationId }) {
  // Блок отзывов показывает среднюю оценку, список отзывов и форму для клиента.
  const { client } = useClient();
  const [data, setData] = useState({ reviews: [], average: null, count: 0 });
  const [form, setForm] = useState({ rating: 5, text: "" });
  const [status, setStatus] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    // Загружает только одобренные отзывы по выбранному направлению.
    fetch(`/api/content/reviews/${destinationId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [destinationId]);

  const handleSubmit = async (e) => {
    // Новый отзыв отправляется на модерацию и не появляется публично сразу.
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch("/api/content/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ destination_id: destinationId, ...form }),
      });
      const d = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "Отзыв отправлен на модерацию!" });
        setShowForm(false);
        setForm({ rating: 5, text: "" });
        load();
      } else {
        setStatus({ type: "error", msg: d.error });
      }
    } catch {
      setStatus({ type: "error", msg: "Ошибка соединения" });
    }
  };

  return (
    <div
      style={{
        marginTop: 28,
        borderTop: "1px solid var(--border)",
        paddingTop: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <span
            style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
          >
            Отзывы
          </span>
          {data.average && (
            <span
              style={{
                marginLeft: 12,
                color: "var(--gold)",
                fontSize: "0.9rem",
              }}
            >
              ★ {data.average} ({data.count})
            </span>
          )}
        </div>
        {client && !showForm && (
          <button
            className="adm-btn-edit"
            style={{ fontSize: "0.82rem" }}
            onClick={() => setShowForm(true)}
          >
            Написать отзыв
          </button>
        )}
      </div>
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: 20,
            padding: "16px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label className="adm-label">Оценка</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, rating: s }))}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.5rem",
                    color: s <= form.rating ? "#c9a84c" : "#444",
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="adm-label">Ваш отзыв</label>
            <textarea
              className="adm-textarea"
              rows={3}
              value={form.text}
              onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
              placeholder="Поделитесь впечатлениями..."
              required
            />
          </div>
          {status && (
            <div
              className={`adm-alert ${status.type === "success" ? "adm-alert-success" : "adm-alert-error"}`}
              style={{ marginBottom: 10 }}
            >
              {status.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="adm-btn-primary">
              Отправить
            </button>
            <button
              type="button"
              className="adm-btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
      {data.reviews.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Отзывов пока нет.{" "}
          {client ? "Будьте первым!" : "Войдите чтобы оставить отзыв."}
        </p>
      ) : (
        data.reviews.map((r) => (
          <div
            key={r.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid rgba(201,168,76,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <div>
                <span style={{ fontWeight: 500 }}>
                  {r.first_name} {r.last_name}
                </span>
                <span
                  style={{
                    color: "var(--gold)",
                    marginLeft: 10,
                    fontSize: "0.9rem",
                  }}
                >
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {new Date(r.created_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.88rem",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {r.text}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
