import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useClient } from "../context/ClientContext";

// Отображение статусов бронирования в личном кабинете.
const STATUS_LABELS = {
  pending: { label: "Ожидает", cls: "status-pending" },
  confirmed: { label: "Подтверждено", cls: "status-confirmed" },
  cancelled: { label: "Отменено", cls: "status-cancelled" },
  completed: { label: "Завершено", cls: "status-completed" },
};

export default function ClientDashboard() {
  // Личный кабинет объединяет бронирования, избранное, бонусы и профиль клиента.
  const { client, logout, setClient, loading } = useClient();
  const navigate = useNavigate();
  const [view, setView] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
    email_reminders: client.email_reminders ?? true,
    email_news: client.email_news ?? true,
  });
  const [profileStatus, setProfileStatus] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [bonusData, setBonusData] = useState(null);
  const [bonusHistory, setBonusHistory] = useState([]);

  useEffect(() => {
    // Если серверная сессия не найдена, возвращаем пользователя на форму входа.
    if (!loading && !client) navigate("/login");
  }, [client, loading, navigate]);

  useEffect(() => {
    if (client)
      setProfileForm({
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone || "",
        password: "",
      });
  }, [client]);

  const fetchBookings = useCallback(async () => {
    // Получает все бронирования текущего клиента.
    const res = await fetch("/api/client/bookings", { credentials: "include" });
    if (res.ok) setBookings(await res.json());
  }, []);

  const fetchFavorites = useCallback(async () => {
    // Получает направления, добавленные клиентом в избранное.
    try {
      const res = await fetch("/api/loyalty/favorites", {
        credentials: "include",
      });
      if (res.ok) setFavorites(await res.json());
      else setFavorites([]);
    } catch {
      setFavorites([]);
    }
  }, []);

  const fetchBonus = useCallback(async () => {
    // Баланс и история бонусов грузятся параллельно для вкладки лояльности.
    try {
      const [balRes, histRes] = await Promise.all([
        fetch("/api/loyalty/bonus/balance", { credentials: "include" }),
        fetch("/api/loyalty/bonus/history", { credentials: "include" }),
      ]);
      if (balRes.ok) setBonusData(await balRes.json());
      if (histRes.ok) setBonusHistory(await histRes.json());
    } catch {
      setBonusData(null);
      setBonusHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!client) return;
    fetchBookings();
    fetchFavorites();
    fetchBonus();
  }, [client, fetchBookings, fetchFavorites, fetchBonus]);

  const cancelBooking = async (id) => {
    // Отмена доступна только для бронирований, которые backend считает отменяемыми.
    if (!window.confirm("Отменить бронирование?")) return;
    const res = await fetch(`/api/client/bookings/${id}/cancel`, {
      method: "PATCH",
      credentials: "include",
    });
    if (res.ok) fetchBookings();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleProfileSave = async (e) => {
    // Обновляет профиль; пустой пароль не отправляем, чтобы не менять его случайно.
    e.preventDefault();
    setProfileStatus(null);
    try {
      const body = { ...profileForm };
      if (!body.password) delete body.password;
      const res = await fetch("/api/client/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setClient(data.client);
        setProfileStatus({ type: "success", msg: "Профиль обновлён!" });
        setProfileForm((p) => ({ ...p, password: "" }));
      } else setProfileStatus({ type: "error", msg: data.error });
    } catch {
      setProfileStatus({ type: "error", msg: "Ошибка соединения" });
    }
  };

  if (loading || !client)
    return (
      <div className="login-page">
        <div className="spinner" />
      </div>
    );

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div
          className="sidebar-logo"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <img
            src="/logo.png"
            alt="DianaTour"
            style={{ height: "32px", width: "auto" }}
          />
          DianaTour
        </div>
        <nav className="sidebar-nav">
          {[
            { key: "bookings", icon: "🧳", label: "Мои бронирования" },
            { key: "favorites", icon: "♥", label: "Избранное" },
            { key: "bonus", icon: "⭐", label: "Бонусы" },
            { key: "profile", icon: "👤", label: "Профиль" },
          ].map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${view === item.key ? "active" : ""}`}
              onClick={() => setView(item.key)}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div
            style={{
              padding: "0 4px 12px",
              fontSize: "0.82rem",
              color: "var(--text-muted)",
            }}
          >
            👤 {client.first_name} {client.last_name}
          </div>
          <Link to="/" className="sidebar-link" style={{ marginBottom: 8 }}>
            <span>🌐</span> На главную
          </Link>
          <button className="sidebar-link" onClick={handleLogout}>
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {view === "bookings" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Мои бронирования</h1>
              <p className="admin-subtitle">История и статус ваших туров</p>
            </div>
            {bookings.length === 0 ? (
              <div
                className="admin-card"
                style={{ textAlign: "center", padding: 60 }}
              >
                <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                  У вас пока нет бронирований
                </p>
                <Link
                  to="/"
                  className="adm-btn-primary"
                  style={{ display: "inline-block" }}
                >
                  Выбрать тур
                </Link>
              </div>
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="admin-card"
                  style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}
                >
                  <div
                    className="booking-card-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr",
                      minHeight: 100,
                    }}
                  >
                    <img
                      src={
                        b.image_url ||
                        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=300&q=70"
                      }
                      alt={b.destination_name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div style={{ padding: "18px 24px" }}>
                      <div
                        className="booking-card-head"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              letterSpacing: "0.15em",
                              textTransform: "uppercase",
                              color: "var(--text-muted)",
                            }}
                          >
                            {b.country}
                          </div>
                          <h3
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: "1.3rem",
                              fontWeight: 400,
                            }}
                          >
                            {b.destination_name}
                          </h3>
                        </div>
                        <span className={`status-badge status-${b.status}`}>
                          {STATUS_LABELS[b.status]?.label}
                        </span>
                      </div>
                      <div
                        className="booking-card-meta"
                        style={{
                          display: "flex",
                          gap: 24,
                          color: "var(--text-muted)",
                          fontSize: "0.85rem",
                          marginBottom: 12,
                        }}
                      >
                        <span>
                          📅{" "}
                          {new Date(b.travel_date).toLocaleDateString("ru-RU")}
                        </span>
                        <span>👥 {b.people_count} чел.</span>
                        <span>🕐 {b.duration} дн.</span>
                        <span
                          style={{
                            color: "var(--gold)",
                            fontFamily: "var(--font-display)",
                            fontSize: "1rem",
                          }}
                        >
                          {Number(b.total_price).toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                      {b.comment && (
                        <p
                          style={{
                            fontSize: "0.82rem",
                            color: "var(--text-muted)",
                            marginBottom: 10,
                          }}
                        >
                          💬 {b.comment}
                        </p>
                      )}
                      {(b.status === "pending" || b.status === "confirmed") && (
                        <button
                          className="adm-btn-danger"
                          style={{ fontSize: "0.78rem" }}
                          onClick={() => cancelBooking(b.id)}
                        >
                          Отменить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ИЗБРАННОЕ */}
        {view === "favorites" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Избранное</h1>
              <p className="admin-subtitle">Сохранённые направления</p>
            </div>
            {favorites.length === 0 ? (
              <div
                className="admin-card"
                style={{ textAlign: "center", padding: 60 }}
              >
                <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                  Нет избранных направлений
                </p>
                <a
                  href="/"
                  className="adm-btn-primary"
                  style={{ display: "inline-block" }}
                >
                  Выбрать туры
                </a>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                  gap: 16,
                }}
              >
                {favorites.map((d) => (
                  <div
                    key={d.id}
                    className="admin-card"
                    style={{ padding: 0, overflow: "hidden" }}
                  >
                    <img
                      src={d.image_url || "/default.jpg"}
                      alt={d.name}
                      style={{ width: "100%", height: 160, objectFit: "cover" }}
                    />
                    <div style={{ padding: 16 }}>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        {d.country}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1.2rem",
                          marginBottom: 8,
                        }}
                      >
                        {d.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            color: "var(--gold)",
                            fontSize: "1.1rem",
                          }}
                        >
                          {Number(d.price).toLocaleString("ru-RU")} ₽
                        </span>
                        <button
                          className="adm-btn-danger"
                          style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                          onClick={async () => {
                            await fetch(`/api/loyalty/favorites/${d.id}`, {
                              method: "DELETE",
                              credentials: "include",
                            });
                            fetchFavorites();
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* БОНУСЫ */}
        {view === "bonus" && bonusData && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Бонусная программа</h1>
              <p className="admin-subtitle">
                Накапливайте баллы и получайте скидки
              </p>
            </div>
            {/* Баланс */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div className="stat-card">
                <div className="stat-card-label">Баланс баллов</div>
                <div className="stat-card-num" style={{ color: "var(--gold)" }}>
                  {bonusData.balance}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Начисляется</div>
                <div className="stat-card-num">
                  {bonusData.settings?.earn_percent}%
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">1 балл =</div>
                <div className="stat-card-num">
                  {bonusData.settings?.points_to_rub} ₽
                </div>
              </div>
            </div>
            <div className="admin-card">
              <div className="admin-card-title">Как работают бонусы</div>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.7,
                  marginBottom: 12,
                }}
              >
                За каждое бронирование вы получаете{" "}
                <strong style={{ color: "var(--gold)" }}>
                  {bonusData.settings?.earn_percent}% от суммы
                </strong>{" "}
                в виде бонусных баллов. Накопленные баллы можно потратить при
                следующем бронировании — до 20% от стоимости тура. Минимум для
                списания:{" "}
                <strong style={{ color: "var(--gold)" }}>
                  {bonusData.settings?.min_spend_points} баллов
                </strong>
                .
              </p>
            </div>

            {/* История */}
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.2rem",
                  }}
                >
                  История операций
                </span>
              </div>
              {bonusHistory.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: 40,
                  }}
                >
                  Операций пока нет
                </p>
              ) : (
                bonusHistory.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 24px",
                      borderBottom: "1px solid rgba(201,168,76,0.08)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.9rem" }}>{t.description}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {new Date(t.created_at).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.2rem",
                        color:
                          t.type === "earn" || t.type === "admin"
                            ? "#6dda90"
                            : "#e07070",
                      }}
                    >
                      {t.type === "earn" || t.type === "admin" ? "+" : "-"}
                      {t.points} ₽
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
        {/* ПРОФИЛЬ */}
        {view === "profile" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Мой профиль</h1>
              <p className="admin-subtitle">Редактирование личных данных</p>
            </div>
            <div className="admin-card" style={{ maxWidth: 540 }}>
              <form onSubmit={handleProfileSave}>
                <div
                  className="profile-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div className="adm-form-group">
                    <label className="adm-label">Имя</label>
                    <input
                      className="adm-input"
                      value={profileForm.first_name}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          first_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Фамилия</label>
                    <input
                      className="adm-input"
                      value={profileForm.last_name}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          last_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Email</label>
                  <input
                    className="adm-input"
                    value={client.email}
                    disabled
                    style={{ opacity: 0.5 }}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Телефон</label>
                  <input
                    className="adm-input"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
                <div
                  className="adm-form-group full"
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 16,
                    marginTop: 8,
                  }}
                >
                  <div className="adm-label" style={{ marginBottom: 12 }}>
                    Email-уведомления
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={profileForm.email_reminders ?? true}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            email_reminders: e.target.checked,
                          }))
                        }
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--gold)",
                        }}
                      />
                      📅 Напоминания о предстоящих турах (за 14 и 7 дней)
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={profileForm.email_news ?? true}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            email_news: e.target.checked,
                          }))
                        }
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--gold)",
                        }}
                      />
                      📰 Новости и акции агентства
                    </label>
                  </div>
                </div>
                <div className="adm-form-group" style={{ marginBottom: 24 }}>
                  <label className="adm-label">
                    Новый пароль (оставьте пустым чтобы не менять)
                  </label>
                  <input
                    type="password"
                    className="adm-input"
                    value={profileForm.password}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>
                {profileStatus && (
                  <div
                    className={`adm-alert ${profileStatus.type === "success" ? "adm-alert-success" : "adm-alert-error"}`}
                    style={{ marginBottom: 16 }}
                  >
                    {profileStatus.msg}
                  </div>
                )}
                <button type="submit" className="adm-btn-primary">
                  Сохранить изменения
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
