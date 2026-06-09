import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import DestinationCard from "../components/DestinationCard";
import DestinationModal from "../components/DestinationModal";
import ChatWidget from "../components/ChatWidget";
import { useClient } from "../context/ClientContext";
import DestinationMap from '../components/DestinationMap';

// Категории главной витрины совпадают с категориями направлений в базе.
const CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "beach", label: "🏖 Пляж" },
  { key: "mountain", label: "⛰ Горы" },
  { key: "city", label: "🏙 Города" },
  { key: "cultural", label: "🏛 Культура" },
  { key: "adventure", label: "🧭 Приключения" },
  { key: "luxury", label: "💎 Люкс" },
];

export default function HomePage() {
  // Главная хранит фильтры каталога, выбранную карточку, контактную форму и избранное.
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    destination: "",
    message: "",
  });
  const [formStatus, setFormStatus] = useState(null);
  const { client } = useClient();
  const [favoriteIds, setFavoriteIds] = useState([]);

  const fetchDestinations = useCallback(async () => {
    // Загружает активные направления с учётом выбранной категории и поисковой строки.
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      const res = await fetch(`/api/destinations?${params}`);
      setDestinations(await res.json());
    } catch {
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  useEffect(() => {
    // Для авторизованного клиента подтягиваем id избранных туров для подсветки карточек.
    if (!client) return;
    fetch("/api/loyalty/favorites/ids", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((ids) => setFavoriteIds(ids))
      .catch(() => {});
  }, [client]);

  const handleFormChange = (e) =>
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleFormSubmit = async (e) => {
    // Контактная форма создаёт заявку для админ-панели.
    e.preventDefault();
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormStatus("success");
        setFormData({
          name: "",
          email: "",
          phone: "",
          destination: "",
          message: "",
        });
      } else setFormStatus("error");
    } catch {
      setFormStatus("error");
    }
  };

  const handleFavoriteToggle = async (destId, isFav) => {
    // Оптимистично обновляем избранное после запроса на добавление или удаление.
    if (!client) return;
    const method = isFav ? "DELETE" : "POST";
    await fetch(`/api/loyalty/favorites/${destId}`, {
      method,
      credentials: "include",
    });
    setFavoriteIds((prev) =>
      isFav ? prev.filter((id) => id !== destId) : [...prev, destId],
    );
  };

  return (
    <>
      <Navbar />
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-tag">Идеальный отпуск ближе, чем кажется...</div>
          <h1 className="hero-title">
            Каждое путешествие —<br />
            <em>история на всю жизнь</em>
          </h1>
          <p className="hero-subtitle">
            Тщательно отобранные маршруты по самым удивительным местам планеты
          </p>
          <div className="hero-search">
            <input
              type="text"
              className="hero-input"
              placeholder="Куда хотите отправиться?"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            />
            <button
              className="hero-search-btn"
              onClick={() => setSearch(searchInput)}
            >
              Найти
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <span className="stat-num">200+</span>
              <span className="stat-label">Направлений</span>
            </div>
            <div className="stat-divider"></div>
            <div>
              <span className="stat-num">15 000+</span>
              <span className="stat-label">Довольных клиентов</span>
            </div>
            <div className="stat-divider"></div>
            <div>
              <span className="stat-num">12 лет</span>
              <span className="stat-label">На рынке</span>
            </div>
          </div>
        </div>
      </section>
      <section className="section" id="destinations">
        <div className="container">
          <div className="section-tag">Наши направления</div>
          <h2 className="section-title">Куда отправиться?</h2>
          <div className="filter-bar">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`filter-btn ${category === c.key ? "active" : ""}`}
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="spinner" />
          ) : destinations.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              Направления не найдены
            </p>
          ) : (
            <div className="cards-grid">
              {destinations.map((d, i) => (
                <div key={d.id} style={{ animationDelay: `${i * 0.07}s` }}>
                  <DestinationCard
                    dest={d}
                    onClick={() => setSelected(d)}
                    isFavorite={favoriteIds.includes(d.id)}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
	  {/* КАРТА НАПРАВЛЕНИЙ */}
      {destinations.filter(d => d.latitude && d.longitude).length > 0 && (
        <section className="section" id="map" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-tag">География туров</div>
              <h2 className="section-title">Карта направлений</h2>
              <DestinationMap
                destinations={destinations}
                selectedId={selected?.id}
                onMarkerClick={(dest) => setSelected(dest)}
                height={500}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 12, textAlign: 'center' }}>
                Нажмите на маркер чтобы узнать подробности о направлении
              </p>
            </div>
        </section>
      )}
      <section className="section" id="about">
        <div className="container">
          <div
            className="about-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "60px",
              alignItems: "center",
            }}
          >
            <div className="about-img-wrap">
              <img src="/about.jpg" alt="О нас" className="about-img" />
              <div className="about-badge">
                <div className="badge-num">12</div>
                <div className="badge-text">лет опыта</div>
              </div>
            </div>
            <div>
              <div className="section-tag">О нас</div>
              <h2 className="section-title">
                Мы создаём
                <br />
                <em>незабываемые моменты</em>
              </h2>
              <p className="about-text">
                DianaTour — команда путешественников, которые лично посетили
                каждое предлагаемое направление. Мы не продаём туры — мы создаём
                впечатления.
              </p>
              <p className="about-text">
                Каждый маршрут разрабатывается с учётом ваших желаний, бюджета и
                интересов.
              </p>
              <div className="about-features">
                {[
                  "Персональный менеджер",
                  "Страховка включена",
                  "Поддержка 24/7",
                  "Гарантия лучшей цены",
                ].map((f) => (
                  <div key={f} className="feature">
                    <span style={{ color: "var(--gold)" }}>✓</span>{" "}
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="section" id="contact">
        <div className="container">
          <div className="section-tag">Контакты</div>
          <h2 className="section-title">
            Начните путешествие
            <br />
            <em>прямо сейчас</em>
          </h2>
          <div
            className="contact-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "40px",
              alignItems: "start",
            }}
          >
            <div className="contact-form-wrap">
              <form onSubmit={handleFormSubmit}>
                {["name", "email", "phone", "destination"].map((field) => (
                  <div key={field} className="form-group">
                    <input
                      type={field === "email" ? "email" : "text"}
                      name={field}
                      className="form-input"
                      placeholder={
                        {
                          name: "Ваше имя",
                          email: "Email",
                          phone: "Телефон",
                          destination: "Интересующее направление",
                        }[field]
                      }
                      value={formData[field]}
                      onChange={handleFormChange}
                      required={field === "name" || field === "email"}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <textarea
                    name="message"
                    className="form-textarea"
                    placeholder="Ваши пожелания..."
                    value={formData.message}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <button type="submit" className="btn-gold">
                  Отправить заявку
                </button>
                {formStatus === "success" && (
                  <div className="form-success">
                    ✓ Заявка отправлена! Свяжемся в течение часа.
                  </div>
                )}
                {formStatus === "error" && (
                  <div
                    className="form-success"
                    style={{
                      color: "#e07070",
                      borderColor: "rgba(220,60,60,0.25)",
                      background: "rgba(220,60,60,0.08)",
                    }}
                  >
                    Ошибка отправки. Попробуйте ещё раз.
                  </div>
                )}
              </form>
            </div>
            <div className="contact-info-wrap">
              {[
                {
                  icon: "📞",
                  title: "+373 (779) 6-45-65",
                  sub: "Пн–Вс с 9:00 до 21:00",
                },
                {
                  icon: "✉️",
                  title: "office@dianatour.pmr",
                  sub: "Ответим в течение часа",
                },
                {
                  icon: "📍",
                  title: "Тирасполь, ул. Покровская, 1",
                  sub: "Офис открыт пн–сб",
                },
              ].map((item) => (
                <div key={item.title} className="contact-item">
                  <div className="contact-icon">{item.icon}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.sub}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <footer className="footer">
        <div className="container footer-inner">
          <div
            className="footer-logo"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <img
              src="/logo.png"
              alt="DianaTour"
              style={{ height: "32px", width: "auto" }}
            />
            DianaTour
          </div>

          <a href="/admin/login" className="footer-admin">
            Панель управления→
          </a>
        </div>
      </footer>
      {selected && (
        <DestinationModal dest={selected} onClose={() => setSelected(null)} />
      )}
      <ChatWidget />
    </>
  );
}
