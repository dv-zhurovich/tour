import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";

// Справочники и пустые формы используются повторно во вкладках каталога и бронирований.
const CATEGORIES = [
  "beach",
  "mountain",
  "city",
  "cultural",
  "adventure",
  "luxury",
];
const CAT_LABELS = {
  beach: "Пляж",
  mountain: "Горы",
  city: "Город",
  cultural: "Культура",
  adventure: "Приключения",
  luxury: "Люкс",
};
const EMPTY_FORM = {
  name: "",
  country: "",
  description: "",
  short_description: "",
  price: "",
  duration: "",
  category: "beach",
  image_url: "",
  rating: "4.5",
  included: "",
  highlights: "",
  is_active: true,
  discount_percent: "0",
  discount_expires_at: "",
  latitude: '',
  longitude: '',
};
const STATUS_LABELS = {
  pending: "Ожидает",
  confirmed: "Подтверждено",
  cancelled: "Отменено",
  completed: "Завершено",
};
const STATUS_OPTIONS = ["pending", "confirmed", "cancelled", "completed"];

export default function AdminPanel() {
  const navigate = useNavigate();
  // Состояние админ-панели разделено по вкладкам: каталог, заявки, клиенты, контент и лояльность.
  const [admin, setAdmin] = useState(null);
  const [view, setView] = useState("dashboard");
  const [destinations, setDestinations] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [bonusSettings, setBonusSettings] = useState({
    earn_percent: 5,
    min_spend_points: 100,
    points_to_rub: 1,
  });
  const [discountForm, setDiscountForm] = useState({
    client_id: "",
    discount_percent: "",
    reason: "",
    expires_at: "",
  });
  const [bonusForm, setBonusForm] = useState({
    client_id: "",
    points: "",
    description: "",
  });
  const [bonusSettingsStatus, setBonusSettingsStatus] = useState(null);
  const [bonusAddStatus, setBonusAddStatus] = useState(null);
  const [discountAddStatus, setDiscountAddStatus] = useState(null);
  const [newsList, setNewsList] = useState([]);
  const [articlesList, setArticlesList] = useState([]);
  const [reviewsList, setReviewsList] = useState([]);
  const [contentForm, setContentForm] = useState({
    title: "",
    content: "",
    excerpt: "",
    image_url: "",
    category: "general",
    is_published: false,
    send_email: false,
  });
  const [contentMode, setContentMode] = useState(null); // 'news-add'|'news-edit'|'article-add'|'article-edit'
  const [contentEditId, setContentEditId] = useState(null);

  useEffect(() => {
    // Проверяем административную сессию перед показом панели.
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) navigate("/admin/login");
        else setAdmin(data);
      })
      .catch(() => navigate("/admin/login"));
  }, [navigate]);

  const fetchDestinations = useCallback(async () => {
    // Загружает полный каталог для управления, включая скрытые направления.
    const res = await fetch("/api/destinations/admin/all", {
      credentials: "include",
    });
    if (res.ok) setDestinations(await res.json());
  }, []);
  const fetchInquiries = useCallback(async () => {
    // Заявки с главной страницы нужны для счётчика и списка обращений.
    const res = await fetch("/api/inquiries", { credentials: "include" });
    if (res.ok) setInquiries(await res.json());
  }, []);
  const fetchClients = useCallback(async () => {
    // Клиентская база используется для управления доступом и начислений.
    const res = await fetch("/api/client/admin/clients", {
      credentials: "include",
    });
    if (res.ok) setClients(await res.json());
  }, []);
  const fetchBookings = useCallback(async () => {
    // Бронирования показываются администратору с данными клиента и направления.
    const res = await fetch("/api/client/admin/bookings", {
      credentials: "include",
    });
    if (res.ok) setBookings(await res.json());
  }, []);

  const fetchDiscounts = useCallback(async () => {
    // Персональные скидки загружаются отдельной вкладкой программы лояльности.
    const [dRes, sRes] = await Promise.all([
      fetch("/api/loyalty/admin/discounts", { credentials: "include" }),
      fetch("/api/loyalty/bonus/balance", { credentials: "include" }).catch(
        () => null,
      ),
    ]);
    if (dRes.ok) setDiscounts(await dRes.json());
  }, []);

  const fetchNews = useCallback(async () => {
    // Новости, статьи и отзывы грузятся только для админского управления контентом.
    const res = await fetch("/api/content/admin/news", {
      credentials: "include",
    });
    if (res.ok) setNewsList(await res.json());
  }, []);

  const fetchArticles = useCallback(async () => {
    const res = await fetch("/api/content/admin/articles", {
      credentials: "include",
    });
    if (res.ok) setArticlesList(await res.json());
  }, []);

  const fetchReviews = useCallback(async () => {
    const res = await fetch("/api/content/admin/reviews", {
      credentials: "include",
    });
    if (res.ok) setReviewsList(await res.json());
  }, []);

  useEffect(() => {
    fetchDestinations();
    fetchInquiries();
    fetchClients();
    fetchBookings();
    fetchDiscounts();
  }, [fetchDestinations, fetchInquiries, fetchClients, fetchBookings]);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    navigate("/admin/login");
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const openAdd = () => {
    // Подготавливает форму создания направления.
    setForm(EMPTY_FORM);
    setEditId(null);
    setImageFile(null);
    setStatus(null);
    setView("add");
  };
  const openEdit = (dest) => {
    // Заполняет форму данными направления и переводит массивы в многострочный текст.
    setForm({
      name: dest.name,
      country: dest.country,
      description: dest.description,
      short_description: dest.short_description,
      price: dest.price,
      duration: dest.duration,
      category: dest.category,
      image_url: dest.image_url || "",
      rating: dest.rating,
      included: (dest.included || []).join("\n"),
      highlights: (dest.highlights || []).join("\n"),
      is_active: dest.is_active,
      discount_percent: dest.discount_percent || "0",
      discount_expires_at: dest.discount_expires_at
        ? dest.discount_expires_at.split("T")[0]
        : "",
	  latitude: dest.latitude || '',
      longitude: dest.longitude || '',
    });
    setEditId(dest.id);
    setImageFile(null);
    setStatus(null);
    setView("edit");
  };

  const handleSave = async (e) => {
    // Сохраняет новое или существующее направление через FormData, чтобы передать изображение.
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append("image", imageFile);
      const url = editId
        ? `/api/destinations/admin/${editId}`
        : "/api/destinations/admin";
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          type: "success",
          msg: editId ? "Направление обновлено!" : "Направление добавлено!",
        });
        await fetchDestinations();
        setTimeout(() => setView("destinations"), 1200);
      } else
        setStatus({ type: "error", msg: data.error || "Ошибка сохранения" });
    } catch {
      setStatus({ type: "error", msg: "Ошибка соединения" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    // Удаление направления подтверждается пользователем и затем обновляет список.
    if (!window.confirm("Удалить направление?")) return;
    const res = await fetch(`/api/destinations/admin/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) fetchDestinations();
  };

  const markRead = async (id) => {
    // Помечает заявку прочитанной и обновляет счётчик непрочитанных.
    await fetch(`/api/inquiries/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    fetchInquiries();
  };

  const toggleClient = async (id) => {
    // Быстро блокирует или активирует клиента без удаления его истории.
    await fetch(`/api/client/admin/clients/${id}/toggle`, {
      method: "PATCH",
      credentials: "include",
    });
    fetchClients();
  };

  const updateBookingStatus = async (id, status) => {
    // Меняет статус бронирования после обработки менеджером.
    await fetch(`/api/client/admin/bookings/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    fetchBookings();
  };

  if (!admin)
    return (
      <div className="login-page">
        <div className="spinner" />
      </div>
    );
  const unread = inquiries.filter((i) => !i.is_read).length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

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
            { key: "dashboard", icon: "📊", label: "Панель управления" },
            { key: "destinations", icon: "🌍", label: "Направления" },
            { key: "clients", icon: "👥", label: "Клиенты" },
            {
              key: "bookings",
              icon: "🧳",
              label: `Бронирования${pendingBookings > 0 ? ` (${pendingBookings})` : ""}`,
            },
            {
              key: "inquiries",
              icon: "✉️",
              label: `Заявки${unread > 0 ? ` (${unread})` : ""}`,
            },
            { key: "loyalty", icon: "🎁", label: "Скидки и бонусы" },
            { key: "news", icon: "📰", label: "Новости" },
            { key: "articles", icon: "📖", label: "Статьи" },
            { key: "reviews", icon: "⭐", label: "Отзывы" },
          ].map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${view === item.key || (view === "add" && item.key === "destinations") || (view === "edit" && item.key === "destinations") ? "active" : ""}`}
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
            👤 {admin.username}
          </div>
          <Link to="/" className="sidebar-link" style={{ marginBottom: 8 }}>
            <span>🌐</span> На сайт
          </Link>
          <button className="sidebar-link" onClick={logout}>
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {/* ДАШБОАРД */}
        {view === "dashboard" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">
                Добро пожаловать, {admin.username}
              </h1>
              <p className="admin-subtitle">Обзор функций DianaTour</p>
            </div>
            <div
              className="stats-grid"
              style={{ gridTemplateColumns: "repeat(5,1fr)" }}
            >
              <div className="stat-card">
                <div className="stat-card-label">Направлений:</div>
                <div className="stat-card-num">{destinations.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Клиентов:</div>
                <div className="stat-card-num">{clients.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Бронирований:</div>
                <div className="stat-card-num">{bookings.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Ожидают:</div>
                <div
                  className="stat-card-num"
                  style={{
                    color: pendingBookings > 0 ? "#e8c97a" : "var(--gold)",
                  }}
                >
                  {pendingBookings}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Новых заявок:</div>
                <div
                  className="stat-card-num"
                  style={{ color: unread > 0 ? "#e8c97a" : "var(--gold)" }}
                >
                  {unread}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Отзывов на модерации</div>
                <div className="stat-card-num">
                  {reviewsList.filter((r) => !r.is_approved).length}
                </div>
              </div>
            </div>
            <div className="admin-card">
              <div className="admin-card-title">Быстрые действия</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="adm-btn-primary" onClick={openAdd}>
                  + Добавить направление
                </button>
                <button
                  className="adm-btn-secondary"
                  onClick={() => setView("bookings")}
                >
                  Бронирования
                </button>
                <button
                  className="adm-btn-secondary"
                  onClick={() => setView("clients")}
                >
                  Клиенты
                </button>
                <button
                  className="adm-btn-secondary"
                  onClick={() => setView("inquiries")}
                >
                  Заявки
                </button>
              </div>
            </div>
          </>
        )}

        {/* НАПРАВЛЕНИЯ */}
        {view === "destinations" && (
          <>
            <div
              className="admin-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1 className="admin-title">Направления</h1>
                <p className="admin-subtitle">Управление турами</p>
              </div>
              <button className="adm-btn-primary" onClick={openAdd}>
                + Добавить
              </button>
            </div>
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Фото</th>
                    <th>Название</th>
                    <th>Страна</th>
                    <th>Категория</th>
                    <th>Цена</th>
                    <th>Дней</th>
                    <th>Рейтинг</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {destinations.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.image_url ? (
                          <img src={d.image_url} alt={d.name} />
                        ) : (
                          <div
                            style={{
                              width: 60,
                              height: 42,
                              background: "var(--dark-3)",
                              borderRadius: 2,
                            }}
                          />
                        )}
                      </td>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {d.country}
                      </td>
                      <td>{CAT_LABELS[d.category] || d.category}</td>
                      <td>{Number(d.price).toLocaleString("ru-RU")} ₽</td>
                      <td>{d.duration}</td>
                      <td>★ {Number(d.rating).toFixed(1)}</td>
                      <td>
                        <span
                          className={`status-badge ${d.is_active ? "status-active" : "status-inactive"}`}
                        >
                          {d.is_active ? "Активно" : "Скрыто"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="adm-btn-edit"
                            onClick={() => openEdit(d)}
                          >
                            Изменить
                          </button>
                          <button
                            className="adm-btn-danger"
                            onClick={() => handleDelete(d.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {destinations.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 40,
                        }}
                      >
                        Нет направлений
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ДОБАВИТЬ/РЕДАКТИРОВАТЬ */}
        {(view === "add" || view === "edit") && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">
                {editId ? "Редактировать" : "Новое направление"}
              </h1>
            </div>
            <div className="admin-card">
              <form onSubmit={handleSave}>
                <div className="adm-form-grid">
                  <div className="adm-form-group">
                    <label className="adm-label">Название *</label>
                    <input
                      name="name"
                      className="adm-input"
                      value={form.name}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Страна *</label>
                    <input
                      name="country"
                      className="adm-input"
                      value={form.country}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Краткое описание *</label>
                    <input
                      name="short_description"
                      className="adm-input"
                      value={form.short_description}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Полное описание *</label>
                    <textarea
                      name="description"
                      className="adm-textarea"
                      value={form.description}
                      onChange={handleFormChange}
                      required
                      rows={4}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Цена (₽) *</label>
                    <input
                      name="price"
                      type="number"
                      className="adm-input"
                      value={form.price}
                      onChange={handleFormChange}
                      required
                      min={0}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Длительность (дней) *</label>
                    <input
                      name="duration"
                      type="number"
                      className="adm-input"
                      value={form.duration}
                      onChange={handleFormChange}
                      required
                      min={1}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Категория *</label>
                    <select
                      name="category"
                      className="adm-select"
                      value={form.category}
                      onChange={handleFormChange}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CAT_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Рейтинг</label>
                    <input
                      name="rating"
                      type="number"
                      className="adm-input"
                      value={form.rating}
                      onChange={handleFormChange}
                      min={1}
                      max={5}
                      step={0.1}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Скидка %</label>
                    <input
                      name="discount_percent"
                      type="number"
                      className="adm-input"
                      value={form.discount_percent}
                      onChange={handleFormChange}
                      min={0}
                      max={90}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Скидка действует до</label>
                    <input
                      name="discount_expires_at"
                      type="date"
                      className="adm-input"
                      value={form.discount_expires_at}
                      onChange={handleFormChange}
                    />
                  </div>
				  <div className="adm-form-group">
                    <label className="adm-label">Широта (latitude)</label>
                    <input name="latitude" type="number" className="adm-input"
                      value={form.latitude} onChange={handleFormChange}
                      step="0.0001" placeholder="36.3932" />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Долгота (longitude)</label>
                      <input name="longitude" type="number" className="adm-input"
                        value={form.longitude} onChange={handleFormChange}
                        step="0.0001" placeholder="25.4615" />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">URL фотографии</label>
                    <input
                      name="image_url"
                      className="adm-input"
                      value={form.image_url}
                      onChange={handleFormChange}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Загрузить изображение</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="adm-input"
                      style={{ paddingTop: 8 }}
                      onChange={(e) => setImageFile(e.target.files[0])}
                    />
                    {imageFile && (
                      <small
                        style={{
                          color: "var(--gold)",
                          marginTop: 6,
                          display: "block",
                        }}
                      >
                        📎 {imageFile.name}
                      </small>
                    )}
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">
                      Включено (каждый пункт с новой строки)
                    </label>
                    <textarea
                      name="included"
                      className="adm-textarea"
                      value={form.included}
                      onChange={handleFormChange}
                      rows={4}
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">
                      Впечатления (каждый пункт с новой строки)
                    </label>
                    <textarea
                      name="highlights"
                      className="adm-textarea"
                      value={form.highlights}
                      onChange={handleFormChange}
                      rows={4}
                    />
                  </div>
                  {editId && (
                    <div
                      className="adm-form-group full"
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <input
                        type="checkbox"
                        name="is_active"
                        id="isActive"
                        checked={form.is_active}
                        onChange={handleFormChange}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--gold)",
                        }}
                      />
                      <label
                        htmlFor="isActive"
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                        }}
                      >
                        Показывать на сайте
                      </label>
                    </div>
                  )}
                </div>
                {status && (
                  <div
                    className={`adm-alert ${status.type === "success" ? "adm-alert-success" : "adm-alert-error"}`}
                  >
                    {status.msg}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button
                    type="submit"
                    className="adm-btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Сохранение..."
                      : editId
                        ? "Сохранить"
                        : "Добавить"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn-secondary"
                    onClick={() => setView("destinations")}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* КЛИЕНТЫ */}
        {view === "clients" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Клиенты</h1>
              <p className="admin-subtitle">
                Список зарегистрированных клиентов
              </p>
            </div>
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Email</th>
                    <th>Телефон</th>
                    <th>Бронирований</th>
                    <th>Дата регистрации</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const clientBookings = bookings.filter(
                      (b) => b.client_id === c.id,
                    ).length;
                    return (
                      <tr key={c.id}>
                        <td>
                          <strong>
                            {c.first_name} {c.last_name}
                          </strong>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {c.email}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {c.phone || "—"}
                        </td>
                        <td>{clientBookings}</td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {new Date(c.created_at).toLocaleDateString("ru-RU")}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${c.is_active ? "status-active" : "status-inactive"}`}
                          >
                            {c.is_active ? "Активен" : "Заблокирован"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={
                              c.is_active ? "adm-btn-danger" : "adm-btn-edit"
                            }
                            onClick={() => toggleClient(c.id)}
                          >
                            {c.is_active ? "Заблокировать" : "Разблокировать"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 40,
                        }}
                      >
                        Нет клиентов
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* БРОНИРОВАНИЯ */}
        {view === "bookings" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Бронирования</h1>
              <p className="admin-subtitle">
                {pendingBookings > 0
                  ? `${pendingBookings} ожидают подтверждения`
                  : "Все бронирования обработаны"}
              </p>
            </div>
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Направление</th>
                    <th>Дата поездки</th>
                    <th>Чел.</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Создано</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>
                          {b.first_name} {b.last_name}
                        </strong>
                        <br />
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {b.client_email}
                        </span>
                      </td>
                      <td>
                        <strong>{b.destination_name}</strong>
                        <br />
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {b.country}
                        </span>
                      </td>
                      <td>
                        {new Date(b.travel_date).toLocaleDateString("ru-RU")}
                      </td>
                      <td>{b.people_count}</td>
                      <td
                        style={{
                          color: "var(--gold)",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {Number(b.total_price).toLocaleString("ru-RU")} ₽
                      </td>
                      <td>
                        <span className={`status-badge status-${b.status}`}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {new Date(b.created_at).toLocaleDateString("ru-RU")}
                      </td>
                      <td>
                        <select
                          className="adm-select"
                          style={{ padding: "5px 8px", fontSize: "0.8rem" }}
                          value={b.status}
                          onChange={(e) =>
                            updateBookingStatus(b.id, e.target.value)
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 40,
                        }}
                      >
                        Нет бронирований
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ЗАЯВКИ */}
        {view === "inquiries" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Заявки</h1>
              <p className="admin-subtitle">
                {unread > 0 ? `${unread} непрочитанных` : "Все прочитаны"}
              </p>
            </div>
            {inquiries.length === 0 ? (
              <div
                className="admin-card"
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  padding: 60,
                }}
              >
                Заявок нет
              </div>
            ) : (
              inquiries.map((inq) => (
                <div
                  key={inq.id}
                  className={`inquiry-item ${!inq.is_read ? "unread" : ""}`}
                >
                  <div className="inquiry-meta">
                    <div>
                      <span className="inquiry-name">{inq.name}</span>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.82rem",
                          marginLeft: 12,
                        }}
                      >
                        {inq.email}
                      </span>
                      {inq.phone && (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.82rem",
                            marginLeft: 12,
                          }}
                        >
                          {inq.phone}
                        </span>
                      )}
                      {inq.destination && (
                        <span
                          style={{
                            color: "var(--gold)",
                            fontSize: "0.8rem",
                            marginLeft: 12,
                          }}
                        >
                          → {inq.destination}
                        </span>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <span className="inquiry-date">
                        {new Date(inq.created_at).toLocaleString("ru-RU")}
                      </span>
                      {!inq.is_read && (
                        <button
                          className="adm-btn-edit"
                          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                          onClick={() => markRead(inq.id)}
                        >
                          Прочитано
                        </button>
                      )}
                      {!inq.is_read && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--gold)",
                            display: "block",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <p className="inquiry-message">{inq.message}</p>
                </div>
              ))
            )}
          </>
        )}
        {/* БОНУСЫ */}
        {view === "loyalty" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Скидки и бонусы</h1>
              <p className="admin-subtitle">Управление программой лояльности</p>
            </div>
            {/* Настройки бонусной программы */}
            <div className="admin-card">
              <div className="admin-card-title">
                Настройки бонусной программы
              </div>
              <div className="adm-form-grid">
                <div className="adm-form-group">
                  <label className="adm-label">Начисляется % от суммы</label>
                  <input
                    type="number"
                    className="adm-input"
                    value={bonusSettings.earn_percent}
                    onChange={(e) =>
                      setBonusSettings((p) => ({
                        ...p,
                        earn_percent: e.target.value,
                      }))
                    }
                    min={0}
                    max={100}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">
                    Минимум баллов для списания
                  </label>
                  <input
                    type="number"
                    className="adm-input"
                    value={bonusSettings.min_spend_points}
                    onChange={(e) =>
                      setBonusSettings((p) => ({
                        ...p,
                        min_spend_points: e.target.value,
                      }))
                    }
                    min={0}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">1 балл = ? рублей</label>
                  <input
                    type="number"
                    className="adm-input"
                    value={bonusSettings.points_to_rub}
                    onChange={(e) =>
                      setBonusSettings((p) => ({
                        ...p,
                        points_to_rub: e.target.value,
                      }))
                    }
                    min={0}
                    step={0.1}
                  />
                </div>
              </div>
              <button
                className="adm-btn-primary"
                onClick={async () => {
                  await fetch("/api/loyalty/admin/bonus/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(bonusSettings),
                  });
                  setBonusSettingsStatus({
                    type: "success",
                    msg: "Настройки сохранены",
                  });
                }}
              >
                Сохранить
              </button>
              {bonusSettingsStatus && (
                <div
                  className={`adm-alert ${bonusSettingsStatus.type === "success" ? "adm-alert-success" : "adm-alert-error"}`}
                  style={{ marginTop: 12 }}
                >
                  {bonusSettingsStatus.msg}
                </div>
              )}
            </div>
            {/* Начислить бонусы */}
            <div className="admin-card">
              <div className="admin-card-title">Начислить бонусы клиенту</div>
              <div className="adm-form-grid">
                <div className="adm-form-group">
                  <label className="adm-label">Клиент</label>
                  <select
                    className="adm-select"
                    value={bonusForm.client_id}
                    onChange={(e) =>
                      setBonusForm((p) => ({ ...p, client_id: e.target.value }))
                    }
                  >
                    <option value="">Выберите клиента</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} — {c.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Количество баллов</label>
                  <input
                    type="number"
                    className="adm-input"
                    value={bonusForm.points}
                    onChange={(e) =>
                      setBonusForm((p) => ({ ...p, points: e.target.value }))
                    }
                    min={1}
                  />
                </div>
                <div className="adm-form-group full">
                  <label className="adm-label">Причина</label>
                  <input
                    type="text"
                    className="adm-input"
                    value={bonusForm.description}
                    onChange={(e) =>
                      setBonusForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Например: Подарок ко дню рождения"
                  />
                </div>
              </div>
              <button
                className="adm-btn-primary"
                onClick={async () => {
                  if (!bonusForm.client_id || !bonusForm.points) return;
                  await fetch("/api/loyalty/admin/bonus", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(bonusForm),
                  });
                  setBonusForm({ client_id: "", points: "", description: "" });
                  setBonusAddStatus({
                    type: "success",
                    msg: "Бонусы начислены",
                  });
                }}
              >
                Начислить
              </button>
              {bonusAddStatus && (
                <div
                  className={`adm-alert adm-alert-success`}
                  style={{ marginTop: 12 }}
                >
                  {bonusAddStatus.msg}
                </div>
              )}
            </div>
            {/* Персональные скидки */}
            <div className="admin-card">
              <div className="admin-card-title">Выдать персональную скидку</div>
              <div className="adm-form-grid">
                <div className="adm-form-group">
                  <label className="adm-label">Клиент</label>
                  <select
                    className="adm-select"
                    value={discountForm.client_id}
                    onChange={(e) =>
                      setDiscountForm((p) => ({
                        ...p,
                        client_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Выберите клиента</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} — {c.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Скидка %</label>
                  <input
                    type="number"
                    className="adm-input"
                    value={discountForm.discount_percent}
                    onChange={(e) =>
                      setDiscountForm((p) => ({
                        ...p,
                        discount_percent: e.target.value,
                      }))
                    }
                    min={1}
                    max={90}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Причина</label>
                  <input
                    type="text"
                    className="adm-input"
                    value={discountForm.reason}
                    onChange={(e) =>
                      setDiscountForm((p) => ({ ...p, reason: e.target.value }))
                    }
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">
                    Действует до (необязательно)
                  </label>
                  <input
                    type="date"
                    className="adm-input"
                    value={discountForm.expires_at}
                    onChange={(e) =>
                      setDiscountForm((p) => ({
                        ...p,
                        expires_at: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <button
                className="adm-btn-primary"
                onClick={async () => {
                  if (!discountForm.client_id || !discountForm.discount_percent)
                    return;
                  await fetch("/api/loyalty/admin/discounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(discountForm),
                  });
                  setDiscountForm({
                    client_id: "",
                    discount_percent: "",
                    reason: "",
                    expires_at: "",
                  });
                  fetchDiscounts();
                  setDiscountAddStatus({
                    type: "success",
                    msg: "Скидка выдана",
                  });
                }}
              >
                Выдать скидку
              </button>
              {discountAddStatus && (
                <div
                  className={`adm-alert adm-alert-success`}
                  style={{ marginTop: 12 }}
                >
                  {discountAddStatus.msg}
                </div>
              )}
            </div>
            {/* Список активных скидок */}
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
                  Активные скидки
                </span>
              </div>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Email</th>
                    <th>Скидка</th>
                    <th>Причина</th>
                    <th>Действует до</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>
                          {d.first_name} {d.last_name}
                        </strong>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{d.email}</td>
                      <td>
                        <span className="status-badge status-confirmed">
                          {d.discount_percent}%
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {d.reason || "—"}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {d.expires_at
                          ? new Date(d.expires_at).toLocaleDateString("ru-RU")
                          : "Бессрочно"}
                      </td>
                    </tr>
                  ))}
                  {discounts.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 30,
                        }}
                      >
                        Нет активных скидок
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* НОВОСТИ */}
        {view === "news" && !contentMode && (
          <>
            <div
              className="admin-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1 className="admin-title">Новости</h1>
                <p className="admin-subtitle">Управление новостями агентства</p>
              </div>
              <button
                className="adm-btn-primary"
                onClick={() => {
                  setContentForm({
                    title: "",
                    content: "",
                    excerpt: "",
                    image_url: "",
                    is_published: false,
                    send_email: false,
                  });
                  setContentEditId(null);
                  setContentMode("news-add");
                }}
              >
                + Добавить
              </button>
            </div>
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Заголовок</th>
                    <th>Статус</th>
                    <th>Дата</th>
                    <th>Просмотры</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {newsList.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <strong>{n.title}</strong>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${n.is_published ? "status-active" : "status-inactive"}`}
                        >
                          {n.is_published ? "Опубликовано" : "Черновик"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {n.published_at
                          ? new Date(n.published_at).toLocaleDateString("ru-RU")
                          : "—"}
                      </td>
                      <td>{n.views}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="adm-btn-edit"
                            onClick={() => {
                              setContentForm({
                                title: n.title,
                                content: n.content,
                                excerpt: n.excerpt || "",
                                image_url: n.image_url || "",
                                is_published: n.is_published,
                                send_email: false,
                              });
                              setContentEditId(n.id);
                              setContentMode("news-edit");
                            }}
                          >
                            Изменить
                          </button>
                          <button
                            className="adm-btn-danger"
                            onClick={async () => {
                              await fetch(`/api/content/admin/news/${n.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              fetchNews();
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {newsList.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 40,
                        }}
                      >
                        Новостей нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ФОРМА НОВОСТИ */}
        {(contentMode === "news-add" || contentMode === "news-edit") && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">
                {contentMode === "news-add"
                  ? "Новая новость"
                  : "Редактировать новость"}
              </h1>
            </div>
            <div className="admin-card">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData();
                  Object.entries(contentForm).forEach(([k, v]) =>
                    fd.append(k, v),
                  );
                  const url =
                    contentMode === "news-edit"
                      ? `/api/content/admin/news/${contentEditId}`
                      : "/api/content/admin/news";
                  const method = contentMode === "news-edit" ? "PUT" : "POST";
                  await fetch(url, {
                    method,
                    credentials: "include",
                    body: fd,
                  });
                  fetchNews();
                  setContentMode(null);
                }}
              >
                <div className="adm-form-grid">
                  <div className="adm-form-group full">
                    <label className="adm-label">Заголовок *</label>
                    <input
                      className="adm-input"
                      value={contentForm.title}
                      onChange={(e) =>
                        setContentForm((p) => ({ ...p, title: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Краткое описание</label>
                    <input
                      className="adm-input"
                      value={contentForm.excerpt}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          excerpt: e.target.value,
                        }))
                      }
                      placeholder="Для превью в списке"
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Текст новости *</label>
                    <textarea
                      className="adm-textarea"
                      rows={8}
                      value={contentForm.content}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          content: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">URL изображения</label>
                    <input
                      className="adm-input"
                      value={contentForm.image_url}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          image_url: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                  <div
                    className="adm-form-group"
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <input
                      type="checkbox"
                      id="pub"
                      checked={contentForm.is_published}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          is_published: e.target.checked,
                        }))
                      }
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: "var(--gold)",
                      }}
                    />
                    <label
                      htmlFor="pub"
                      className="adm-label"
                      style={{ margin: 0, cursor: "pointer" }}
                    >
                      Опубликовать
                    </label>
                  </div>
                  <div
                    className="adm-form-group"
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <input
                      type="checkbox"
                      id="sem"
                      checked={contentForm.send_email}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          send_email: e.target.checked,
                        }))
                      }
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: "var(--gold)",
                      }}
                    />
                    <label
                      htmlFor="sem"
                      className="adm-label"
                      style={{ margin: 0, cursor: "pointer" }}
                    >
                      📧 Разослать подписчикам
                    </label>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button type="submit" className="adm-btn-primary">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="adm-btn-secondary"
                    onClick={() => setContentMode(null)}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* СТАТЬИ */}
        {view === "articles" && !contentMode && (
          <>
            <div
              className="admin-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1 className="admin-title">Статьи</h1>
                <p className="admin-subtitle">
                  Полезные материалы для клиентов
                </p>
              </div>
              <button
                className="adm-btn-primary"
                onClick={() => {
                  setContentForm({
                    title: "",
                    content: "",
                    excerpt: "",
                    image_url: "",
                    category: "general",
                    is_published: false,
                  });
                  setContentEditId(null);
                  setContentMode("article-add");
                }}
              >
                + Добавить
              </button>
            </div>
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Заголовок</th>
                    <th>Категория</th>
                    <th>Статус</th>
                    <th>Просмотры</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {articlesList.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.title}</strong>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {a.category}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${a.is_published ? "status-active" : "status-inactive"}`}
                        >
                          {a.is_published ? "Опубликовано" : "Черновик"}
                        </span>
                      </td>
                      <td>{a.views}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="adm-btn-edit"
                            onClick={() => {
                              setContentForm({
                                title: a.title,
                                content: a.content,
                                excerpt: a.excerpt || "",
                                image_url: a.image_url || "",
                                category: a.category,
                                is_published: a.is_published,
                              });
                              setContentEditId(a.id);
                              setContentMode("article-edit");
                            }}
                          >
                            Изменить
                          </button>
                          <button
                            className="adm-btn-danger"
                            onClick={async () => {
                              await fetch(
                                `/api/content/admin/articles/${a.id}`,
                                { method: "DELETE", credentials: "include" },
                              );
                              fetchArticles();
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {articlesList.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 40,
                        }}
                      >
                        Статей нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ФОРМА СТАТЬИ */}
        {(contentMode === "article-add" || contentMode === "article-edit") && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">
                {contentMode === "article-add"
                  ? "Новая статья"
                  : "Редактировать статью"}
              </h1>
            </div>
            <div className="admin-card">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData();
                  Object.entries(contentForm).forEach(([k, v]) =>
                    fd.append(k, v),
                  );
                  const url =
                    contentMode === "article-edit"
                      ? `/api/content/admin/articles/${contentEditId}`
                      : "/api/content/admin/articles";
                  const method =
                    contentMode === "article-edit" ? "PUT" : "POST";
                  await fetch(url, {
                    method,
                    credentials: "include",
                    body: fd,
                  });
                  fetchArticles();
                  setContentMode(null);
                }}
              >
                <div className="adm-form-grid">
                  <div className="adm-form-group full">
                    <label className="adm-label">Заголовок *</label>
                    <input
                      className="adm-input"
                      value={contentForm.title}
                      onChange={(e) =>
                        setContentForm((p) => ({ ...p, title: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-label">Категория</label>
                    <select
                      className="adm-select"
                      value={contentForm.category}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          category: e.target.value,
                        }))
                      }
                    >
                      <option value="general">Общее</option>
                      <option value="tips">Советы</option>
                      <option value="destinations">Направления</option>
                      <option value="visa">Визы</option>
                      <option value="insurance">Страховки</option>
                    </select>
                  </div>
                  <div className="adm-form-group">
                    <label
                      className="adm-label"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 28,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contentForm.is_published}
                        onChange={(e) =>
                          setContentForm((p) => ({
                            ...p,
                            is_published: e.target.checked,
                          }))
                        }
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--gold)",
                        }}
                      />
                      Опубликовать
                    </label>
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Краткое описание</label>
                    <input
                      className="adm-input"
                      value={contentForm.excerpt}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          excerpt: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">Текст статьи *</label>
                    <textarea
                      className="adm-textarea"
                      rows={8}
                      value={contentForm.content}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          content: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="adm-form-group full">
                    <label className="adm-label">URL изображения</label>
                    <input
                      className="adm-input"
                      value={contentForm.image_url}
                      onChange={(e) =>
                        setContentForm((p) => ({
                          ...p,
                          image_url: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button type="submit" className="adm-btn-primary">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="adm-btn-secondary"
                    onClick={() => setContentMode(null)}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* ОТЗЫВЫ */}
        {view === "reviews" && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Отзывы клиентов</h1>
              <p className="admin-subtitle">
                {reviewsList.filter((r) => !r.is_approved).length} ожидают
                модерации
              </p>
            </div>
            <div
              className="admin-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Направление</th>
                    <th>Оценка</th>
                    <th>Отзыв</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewsList.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {r.first_name} {r.last_name}
                        </strong>
                        <br />
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {r.email}
                        </span>
                      </td>
                      <td>{r.dest_name}</td>
                      <td style={{ color: "var(--gold)" }}>
                        {"★".repeat(r.rating)}
                      </td>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.85rem",
                          maxWidth: 200,
                        }}
                      >
                        {r.text.slice(0, 80)}
                        {r.text.length > 80 ? "..." : ""}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${r.is_approved ? "status-active" : "status-pending"}`}
                        >
                          {r.is_approved ? "Одобрен" : "На модерации"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          {!r.is_approved && (
                            <button
                              className="adm-btn-edit"
                              onClick={async () => {
                                await fetch(
                                  `/api/content/admin/reviews/${r.id}/approve`,
                                  { method: "PATCH", credentials: "include" },
                                );
                                fetchReviews();
                              }}
                            >
                              Одобрить
                            </button>
                          )}
                          <button
                            className="adm-btn-danger"
                            onClick={async () => {
                              await fetch(
                                `/api/content/admin/reviews/${r.id}`,
                                { method: "DELETE", credentials: "include" },
                              );
                              fetchReviews();
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reviewsList.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: 40,
                        }}
                      >
                        Отзывов нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
