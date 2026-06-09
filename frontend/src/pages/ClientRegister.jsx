import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useClient } from "../context/ClientContext";

export default function ClientRegister() {
  // Регистрация создаёт клиента и сразу переводит его в личный кабинет.
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    password2: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setClient } = useClient();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    // Локально проверяем пароль, затем отдаём данные backend-роуту регистрации.
    e.preventDefault();
    if (form.password !== form.password2)
      return setError("Пароли не совпадают");
    if (form.password.length < 6) return setError("Пароль минимум 6 символов");
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setClient(data.client);
        navigate("/dashboard");
      } else setError(data.error || "Ошибка регистрации");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const f = (name) => ({
    // Помощник для однотипного связывания инпутов с полями формы.
    value: form[name],
    onChange: (e) => setForm((p) => ({ ...p, [name]: e.target.value })),
  });

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
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
        <h2 className="login-title">Регистрация</h2>
        <p className="login-sub">Создайте аккаунт для бронирования туров</p>
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div className="adm-form-group">
              <label className="adm-label">Имя</label>
              <input
                type="text"
                className="adm-input"
                {...f("first_name")}
                required
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Фамилия</label>
              <input
                type="text"
                className="adm-input"
                {...f("last_name")}
                required
              />
            </div>
          </div>
          <div className="adm-form-group">
            <label className="adm-label">Email</label>
            <input
              type="email"
              className="adm-input"
              {...f("email")}
              required
            />
          </div>
          <div className="adm-form-group">
            <label className="adm-label">Телефон</label>
            <input type="tel" className="adm-input" {...f("phone")} />
          </div>
          <div className="adm-form-group">
            <label className="adm-label">Пароль</label>
            <input
              type="password"
              className="adm-input"
              {...f("password")}
              required
            />
          </div>
          <div className="adm-form-group" style={{ marginBottom: 24 }}>
            <label className="adm-label">Повторите пароль</label>
            <input
              type="password"
              className="adm-input"
              {...f("password2")}
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
            {loading ? "Регистрация..." : "Создать аккаунт"}
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
          Уже есть аккаунт?{" "}
          <Link to="/login" style={{ color: "var(--gold)" }}>
            Войти
          </Link>
        </p>
        <Link to="/" className="login-back">
          ← На главную
        </Link>
      </div>
    </div>
  );
}
