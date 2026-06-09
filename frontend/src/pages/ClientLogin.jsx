import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useClient } from "../context/ClientContext";

export default function ClientLogin() {
  // Форма входа клиента обновляет глобальный ClientContext после успешной авторизации.
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setClient } = useClient();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    // Сервер проверяет пароль, выставляет сессию и возвращает данные клиента.
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setClient(data.client);
        navigate("/dashboard");
      } else setError(data.error || "Ошибка входа");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link
          to="/"
          className="login-logo"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <img
            src="/logo.png"
            alt="DianaTour"
            style={{ height: "32px", width: "auto" }}
          />
          DianaTour
        </Link>
        <h2 className="login-title">Вход в кабинет</h2>
        <p className="login-sub">Войдите чтобы бронировать туры</p>
        <form onSubmit={handleSubmit}>
          <div className="adm-form-group">
            <label className="adm-label">Email</label>
            <input
              type="email"
              className="adm-input"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
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
        <p
          style={{
            marginTop: 20,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.88rem",
          }}
        >
          Нет аккаунта?{" "}
          <Link to="/register" style={{ color: "var(--gold)" }}>
            Зарегистрироваться
          </Link>
        </p>
        <Link to="/" className="login-back">
          ← На главную
        </Link>
      </div>
    </div>
  );
}
