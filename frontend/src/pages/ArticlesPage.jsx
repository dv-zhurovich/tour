import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";

// Категории статей соответствуют значениям, которые хранит backend.
const ARTICLE_CATS = [
  { key: "all", label: "Все" },
  { key: "tips", label: "💡 Советы" },
  { key: "destinations", label: "🌍 Направления" },
  { key: "visa", label: "📋 Визы" },
  { key: "insurance", label: "🛡 Страховки" },
  { key: "general", label: "📖 Общее" },
];

export default function ArticlesPage() {
  // Список статей фильтруется по категории и открывается в модальном чтении.
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // Перезагружаем статьи при смене категории фильтра.
    setLoading(true);
    const params = category !== "all" ? `?category=${category}` : "";
    fetch(`/api/content/articles${params}`)
      .then((r) => r.json())
      .then((data) => {
        setArticles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category]);

  const openArticle = async (id) => {
    // Детальная загрузка открывает полный текст и увеличивает просмотры на сервере.
    const res = await fetch(`/api/content/articles/${id}`);
    if (res.ok) setSelected(await res.json());
  };

  return (
    <>
      <Navbar />
      <div style={{ paddingTop: 100, minHeight: "100vh" }}>
        <div className="container">
          <div className="section-tag">Полезная информация</div>
          <h1 className="section-title">Статьи и советы</h1>
          <div className="filter-bar">
            {ARTICLE_CATS.map((c) => (
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
          ) : articles.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                textAlign: "center",
                padding: 60,
              }}
            >
              Статей пока нет
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
              {articles.map((a) => (
                <div
                  key={a.id}
                  className="dest-card"
                  onClick={() => openArticle(a.id)}
                  style={{ cursor: "pointer" }}
                >
                  {a.image_url && (
                    <div className="card-img-wrap">
                      <img
                        src={a.image_url}
                        alt={a.title}
                        className="card-img"
                      />
                      <span className="card-category">
                        {ARTICLE_CATS.find((c) => c.key === a.category)
                          ?.label || a.category}
                      </span>
                    </div>
                  )}
                  <div className="card-body">
                    <div className="card-location">
                      {a.published_at
                        ? new Date(a.published_at).toLocaleDateString("ru-RU")
                        : ""}
                    </div>
                    <h3 className="card-name" style={{ fontSize: "1.2rem" }}>
                      {a.title}
                    </h3>
                    <p className="card-desc">{a.excerpt}</p>
                    <div
                      style={{
                        color: "var(--gold)",
                        fontSize: "0.85rem",
                        marginTop: 8,
                      }}
                    >
                      👁 {a.views} просмотров
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
                {ARTICLE_CATS.find((c) => c.key === selected.category)?.label} ·{" "}
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
          <span className="footer-copy">© 2026 DianaTour</span>
          <a href="/" className="footer-admin">
            ← На главную
          </a>
        </div>
      </footer>
    </>
  );
}
