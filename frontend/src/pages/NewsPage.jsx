import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function NewsPage() {
  // Страница получает опубликованные новости и открывает полную запись в модальном окне.
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Загружаем список один раз при открытии страницы.
    fetch("/api/content/news")
      .then((r) => r.json())
      .then((data) => {
        setNews(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openNews = async (id) => {
    // Детальный запрос также увеличивает счётчик просмотров на сервере.
    const res = await fetch(`/api/content/news/${id}`);
    if (res.ok) setSelected(await res.json());
  };

  return (
    <>
      <Navbar />
      <div style={{ paddingTop: 100, minHeight: "100vh" }}>
        <div className="container">
          <div className="section-tag">Последние события</div>
          <h1 className="section-title">Новости агентства</h1>
          {loading ? (
            <div className="spinner" />
          ) : news.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                textAlign: "center",
                padding: 60,
              }}
            >
              Новостей пока нет
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
                gap: 24,
                marginBottom: 60,
              }}
            >
              {news.map((n) => (
                <div
                  key={n.id}
                  className="dest-card"
                  onClick={() => openNews(n.id)}
                  style={{ cursor: "pointer" }}
                >
                  {n.image_url && (
                    <div className="card-img-wrap">
                      <img
                        src={n.image_url}
                        alt={n.title}
                        className="card-img"
                      />
                    </div>
                  )}
                  <div className="card-body">
                    <div className="card-location">
                      {n.published_at
                        ? new Date(n.published_at).toLocaleDateString("ru-RU")
                        : ""}
                    </div>
                    <h3 className="card-name" style={{ fontSize: "1.2rem" }}>
                      {n.title}
                    </h3>
                    <p className="card-desc">{n.excerpt}</p>
                    <div
                      style={{
                        color: "var(--gold)",
                        fontSize: "0.85rem",
                        marginTop: 8,
                      }}
                    >
                      👁 {n.views} просмотров
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Модальное окно новости */}
      {selected && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="modal-box modal-relative" style={{ maxWidth: 860 }}>
            <button className="modal-close" onClick={() => setSelected(null)}>
              ✕
            </button>
            {selected.image_url && (
              <img
                src={selected.image_url}
                alt={selected.title}
                className="modal-img"
              />
            )}
            <div className="modal-body">
              <div className="modal-location">
                {selected.published_at
                  ? new Date(selected.published_at).toLocaleDateString(
                      "ru-RU",
                      { day: "numeric", month: "long", year: "numeric" },
                    )
                  : ""}
              </div>
              <h2 className="modal-title">{selected.title}</h2>
              <div
                style={{
                  color: "var(--text-muted)",
                  lineHeight: 1.8,
                  fontSize: "0.95rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selected.content}
              </div>
            </div>
          </div>
        </div>
      )}
      <footer className="footer">
        <div className="container footer-inner">
          <div
            className="footer-logo"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <img
              src="/logo.png"
              alt="DianaTour"
              style={{ height: 32, width: "auto" }}
            />
            DianaTour
          </div>
          <span className="footer-copy">© 2024 DianaTour</span>
          <a href="/" className="footer-admin">
            ← На главную
          </a>
        </div>
      </footer>
    </>
  );
}
