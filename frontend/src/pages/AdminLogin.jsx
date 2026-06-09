import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function AdminLogin() {
  // Форма входа хранит логин/пароль, состояние загрузки и текст ошибки.
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    // После успешной авторизации сервер выставляет сессию администратора.
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (res.ok) navigate("/admin");
      else {
        const data = await res.json();
        setError(data.error || "Неверный логин или пароль");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div
          className="login-logo"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <img
            src="/logo.png"
            alt="DianaTour"
            style={{ height: "36px", width: "auto" }}
          />
          DianaTour
        </div>

        <h2 className="login-title">Вход в панель управления</h2>
        <p className="login-sub">Только для авторизованных сотрудников</p>
        <form onSubmit={handleSubmit}>
          <div className="adm-form-group">
            <label className="adm-label">Логин</label>
            <input
              type="text"
              className="adm-input"
              value={form.username}
              onChange={(e) =>
                setForm((p) => ({ ...p, username: e.target.value }))
              }
              required
              autoFocus
            />
          </div>
          <div className="adm-form-group" style={{ marginBottom: 24 }}>
            <label className="adm-label">Пароль</label>
            <input
              type="password"
              className="adm-input"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              required
            />
          </div>
          {error && (
            <div
              className="adm-alert adm-alert-error"
              style={{ marginBottom: 16 }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            className="adm-btn-primary"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
        <Link to="/" className="login-back">
          ← На сайт
        </Link>
        <p
          style={{
            marginTop: 20,
            fontSize: "0.78rem",
            color: "var(--text-muted)",
          }}
        >
          По умолчанию:{" "}
          <code style={{ color: "var(--gold)" }}>admin / admin123</code>
        </p>
      </div>
    </div>
  );
}
