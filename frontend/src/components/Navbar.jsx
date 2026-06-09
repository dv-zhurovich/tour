import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useClient } from "../context/ClientContext";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { client, logout } = useClient();
  const navigate = useNavigate();

  useEffect(() => {
    // При скролле меняем оформление навбара, чтобы он читался на светлых участках страницы.
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollTo = (id) => {
    // Якорные кнопки ведут к секциям главной и закрывают мобильное меню.
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const goTo = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    // Выход завершает клиентскую сессию и возвращает пользователя на главную.
    await logout();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <nav
      className={`navbar ${scrolled ? "scrolled" : ""} ${menuOpen ? "menu-open" : ""}`}
    >
      <Link
        to="/"
        className="nav-logo"
        style={{ display: "flex", alignItems: "center", gap: "10px" }}
        onClick={() => setMenuOpen(false)}
      >
        <img
          src="/logo.png"
          alt="DianaTour"
          style={{ height: "36px", width: "auto" }}
        />
        DianaTour
      </Link>
      <button
        className="nav-toggle"
        type="button"
        aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className="nav-links">
	    <button
          className="nav-link"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => navigate("/news")}
        >
          Новости
        </button>
		<button
          className="nav-link"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => navigate("/articles")}
        >
          Статьи
        </button>
        <button
          className="nav-link"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => scrollTo("destinations")}
        >
          Направления
        </button>
        <button
          className="nav-link"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => scrollTo("about")}
        >
          О нас
        </button>
        <button
          className="nav-link"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => scrollTo("contact")}
        >
          Контакты
        </button>
		
		<button className="nav-link" style={{background:'none',border:'none',cursor:'pointer'}}
          onClick={() => { navigate('/'); setTimeout(() => document.getElementById('map')?.scrollIntoView({behavior:'smooth'}), 300); }}
		>
          Карта
        </button>
        {client ? (
          <>
            <button
              className="nav-link"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              onClick={() => goTo("/dashboard")}
            >
              👤 {client.first_name}
            </button>
            <button className="nav-btn" onClick={handleLogout}>
              Выйти
            </button>
          </>
        ) : (
          <>
            <button
              className="nav-link"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              onClick={() => goTo("/login")}
            >
              Войти
            </button>
            <button className="nav-btn" onClick={() => goTo("/register")}>
              Регистрация
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
