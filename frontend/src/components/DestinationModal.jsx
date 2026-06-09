import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClient } from "../context/ClientContext";
import ReviewsSection from "./ReviewsSection";
import DestinationMap from './DestinationMap';

export default function DestinationModal({ dest, onClose }) {
  const { client } = useClient();
  const navigate = useNavigate();
  const [showBooking, setShowBooking] = useState(false);
  const [bookForm, setBookForm] = useState({
    travel_date: "",
    people_count: 1,
    comment: "",
  });
  const [bookStatus, setBookStatus] = useState(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [calcData, setCalcData] = useState(null);
  const [useBonus, setUseBonus] = useState(false);
  const [bonusBalance, setBonusBalance] = useState(0);

  useEffect(() => {
    // Пока модальное окно открыто, Escape закрывает его, а фон страницы не прокручивается.
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    // Для авторизованного клиента показываем доступный бонусный баланс.
    if (!client) return;
    fetch("/api/loyalty/bonus/balance", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setBonusBalance(data.balance))
      .catch(() => {});
  }, [client]);

  useEffect(() => {
    // При изменении количества людей или списания бонусов пересчитываем итоговую цену.
    if (showBooking && client) calculatePrice();
  }, [bookForm.people_count, useBonus, showBooking]);

  if (!dest) return null;

  const totalPrice = Number(dest.price) * Number(bookForm.people_count);

  const handleBook = async (e) => {
    // Отправляет бронирование в личный кабинет клиента и показывает результат.
    e.preventDefault();
    setBookLoading(true);
    setBookStatus(null);
    try {
      const res = await fetch("/api/client/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          destination_id: dest.id,
          ...bookForm,
          use_bonus_points: useBonus,
        }),
      });
      const data = await res.json();
      if (res.ok)
        setBookStatus({
          type: "success",
          msg: "Бронирование отправлено! Ожидайте подтверждения.",
        });
      else setBookStatus({ type: "error", msg: data.error });
    } catch {
      setBookStatus({ type: "error", msg: "Ошибка соединения" });
    } finally {
      setBookLoading(false);
    }
  };

  const calculatePrice = async () => {
    // Сервер считает скидки и бонусы, чтобы фронтенд не дублировал правила лояльности.
    if (!bookForm.people_count || !dest.id) return;
    try {
      const res = await fetch("/api/loyalty/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          destination_id: dest.id,
          people_count: bookForm.people_count,
          use_bonus_points: useBonus,
        }),
      });
      if (res.ok) setCalcData(await res.json());
    } catch {}
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box modal-relative">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        {dest.image_url && (
          <img src={dest.image_url} alt={dest.name} className="modal-img" />
        )}
        <div className="modal-body">
          <div className="modal-location">{dest.country}</div>
          <h2 className="modal-title">{dest.name}</h2>
          <p className="modal-desc">{dest.description}</p>
          <div className="modal-meta">
            <div className="meta-item">
              <span>Цена</span>
              <span>{Number(dest.price).toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="meta-item">
              <span>Длительность</span>
              <span>{dest.duration} дн.</span>
            </div>
            <div className="meta-item">
              <span>Рейтинг</span>
              <span>★ {Number(dest.rating).toFixed(1)}</span>
            </div>
          </div>
		  {/* Карта */}
          {dest.latitude && dest.longitude && (
            <div style={{ marginBottom: 20 }}>
              <div className="modal-list-title">Расположение</div>
                <DestinationMap
                  destinations={[dest]}
                  selectedId={dest.id}
                  height={250}
                />
              </div>
          )}
          {dest.highlights?.length > 0 && (
            <>
              <div className="modal-list-title">Основные впечатления</div>
              <div className="modal-tags">
                {dest.highlights.map((h, i) => (
                  <span key={i} className="modal-tag">
                    {h}
                  </span>
                ))}
              </div>
            </>
          )}
          {dest.included?.length > 0 && (
            <>
              <div className="modal-list-title">Включено в тур</div>
              <div className="modal-tags">
                {dest.included.map((inc, i) => (
                  <span key={i} className="modal-tag">
                    ✓ {inc}
                  </span>
                ))}
              </div>
            </>
          )}
          <div
            style={{
              marginTop: 28,
              borderTop: "1px solid var(--border)",
              paddingTop: 24,
            }}
          >
            {!client ? (
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    color: "var(--text-muted)",
                    marginBottom: 16,
                    fontSize: "0.9rem",
                  }}
                >
                  Войдите в аккаунт чтобы забронировать тур
                </p>
                <div
                  style={{ display: "flex", gap: 12, justifyContent: "center" }}
                >
                  <button
                    className="adm-btn-primary"
                    onClick={() => {
                      onClose();
                      navigate("/login");
                    }}
                  >
                    Войти
                  </button>
                  <button
                    className="adm-btn-secondary"
                    onClick={() => {
                      onClose();
                      navigate("/register");
                    }}
                  >
                    Регистрация
                  </button>
                </div>
              </div>
            ) : !showBooking ? (
              <button className="btn-gold" onClick={() => setShowBooking(true)}>
                Забронировать тур
              </button>
            ) : (
              <form onSubmit={handleBook}>
                <div className="modal-list-title" style={{ marginBottom: 16 }}>
                  Оформление бронирования
                </div>
                <div
                  className="booking-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label className="adm-label">Дата поездки</label>
                    <input
                      type="date"
                      className="adm-input"
                      min={new Date().toISOString().split("T")[0]}
                      value={bookForm.travel_date}
                      onChange={(e) => {
                        setBookForm((p) => ({
                          ...p,
                          travel_date: e.target.value,
                        }));
                        calculatePrice();
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label className="adm-label">Количество человек</label>
                    <input
                      type="number"
                      className="adm-input"
                      min={1}
                      max={20}
                      value={bookForm.people_count}
                      onChange={(e) => {
                        setBookForm((p) => ({
                          ...p,
                          people_count: e.target.value,
                        }));
                        calculatePrice();
                      }}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="adm-label">
                    Комментарий (необязательно)
                  </label>
                  <textarea
                    className="adm-textarea"
                    rows={2}
                    value={bookForm.comment}
                    onChange={(e) => {
                      setBookForm((p) => ({ ...p, comment: e.target.value }));
                      calculatePrice();
                    }}
                    placeholder="Особые пожелания..."
                  />
                </div>
                <div
                  style={{
                    marginBottom: 16,
                    padding: "12px 16px",
                    background: "rgba(201,168,76,0.08)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  {calcData ? (
                    <>
                      {calcData.applied_discount > 0 && (
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#6dda90",
                            marginBottom: 6,
                          }}
                        >
                          🏷 Скидка {calcData.applied_discount}% применена
                        </div>
                      )}
                      {calcData.bonus_discount > 0 && (
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#8aabff",
                            marginBottom: 6,
                          }}
                        >
                          ⭐ Бонусами: -
                          {calcData.bonus_discount.toLocaleString("ru-RU")} ₽ (
                          {calcData.bonus_used} баллов)
                        </div>
                      )}
                      <div>
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                          }}
                        >
                          Итого:{" "}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "1.4rem",
                            color: "var(--gold)",
                          }}
                        >
                          {Number(calcData.total_price).toLocaleString(
                            "ru-RU",
                            { maximumFractionDigits: 0 },
                          )}{" "}
                          ₽
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          marginTop: 4,
                        }}
                      >
                        + {calcData.points_earned} бонусных баллов после оплаты
                      </div>
                    </>
                  ) : (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Рассчитывается...
                    </span>
                  )}
                </div>
                {bookStatus && (
                  <div
                    className={`adm-alert ${bookStatus.type === "success" ? "adm-alert-success" : "adm-alert-error"}`}
                    style={{ marginBottom: 12 }}
                  >
                    {bookStatus.msg}
                    {bookStatus.type === "success" && (
                      <>
                        {" "}
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--gold)",
                            cursor: "pointer",
                            marginLeft: 8,
                            textDecoration: "underline",
                          }}
                          onClick={() => {
                            onClose();
                            navigate("/dashboard");
                          }}
                        >
                          Перейти в кабинет →
                        </button>
                      </>
                    )}
                  </div>
                )}
                {bookStatus?.type !== "success" && (
                  <div
                    className="modal-actions"
                    style={{ display: "flex", gap: 12 }}
                  >
                    {bonusBalance >= 100 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          id="useBonus"
                          checked={useBonus}
                          onChange={(e) => setUseBonus(e.target.checked)}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: "var(--gold)",
                            cursor: "pointer",
                          }}
                        />
                        <label
                          htmlFor="useBonus"
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.88rem",
                            cursor: "pointer",
                          }}
                        >
                          Потратить бонусы (у вас {bonusBalance} баллов)
                        </label>
                      </div>
                    )}
                    <button
                      type="submit"
                      className="adm-btn-primary"
                      disabled={bookLoading}
                    >
                      {bookLoading ? "Отправка..." : "Подтвердить бронирование"}
                    </button>
                    <button
                      type="button"
                      className="adm-btn-secondary"
                      onClick={() => setShowBooking(false)}
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
          <ReviewsSection destinationId={dest.id} />
        </div>
      </div>
    </div>
  );
}
