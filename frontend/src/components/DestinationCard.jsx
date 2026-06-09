import React from "react";

// Подписи категорий приводят backend-ключи к понятному виду на карточке.
const CATEGORY_LABELS = {
  beach: "🏖 Пляж",
  mountain: "⛰ Горы",
  city: "🏙 Город",
  cultural: "🏛 Культура",
  adventure: "🧭 Приключения",
  luxury: "💎 Люкс",
};

export default function DestinationCard({
  dest,
  onClick,
  isFavorite,
  onFavoriteToggle,
}) {
  const handleFavorite = (e) => {
    e.stopPropagation(); // не открывать модальное окно
    onFavoriteToggle && onFavoriteToggle(dest.id, isFavorite);
  };

  const hasDiscount =
    dest.discount_percent > 0 &&
    (!dest.discount_expires_at ||
      new Date(dest.discount_expires_at) > new Date());
  // Цена на карточке сразу учитывает активную скидку направления.
  const discountedPrice = hasDiscount
    ? Number(dest.price) * (1 - Number(dest.discount_percent) / 100)
    : Number(dest.price);

  return (
    <div className="dest-card" onClick={onClick}>
      <div className="card-img-wrap">
        <img
          src={dest.image_url || "/default.jpg"}
          alt={dest.name}
          className="card-img"
        />
        <span className="card-category">
          {CATEGORY_LABELS[dest.category] || dest.category}
        </span>
        <span className="card-rating">★ {Number(dest.rating).toFixed(1)}</span>
        {/* Бейдж скидки */}
        {hasDiscount && (
          <span
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              background: "#e05555",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 2,
              letterSpacing: "0.05em",
            }}
          >
            -{Number(dest.discount_percent).toFixed(0)}%
          </span>
        )}
        {/* Кнопка избранного */}
        <button
          onClick={handleFavorite}
          style={{
            position: "absolute",
            top: 14,
            right: 52,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            color: isFavorite ? "#e05555" : "#fff",
          }}
          title={isFavorite ? "Убрать из избранного" : "В избранное"}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>
      <div className="card-body">
        <div className="card-location">{dest.country}</div>
        <h3 className="card-name">{dest.name}</h3>
        <p className="card-desc">{dest.short_description}</p>
        <div className="card-footer">
          <div className="card-price">
            {hasDiscount ? (
              <>
                <span
                  style={{
                    textDecoration: "line-through",
                    color: "var(--text-muted)",
                    fontSize: "1rem",
                    marginRight: 6,
                  }}
                >
                  {Number(dest.price).toLocaleString("ru-RU")} ₽
                </span>
                {discountedPrice.toLocaleString("ru-RU", {
                  maximumFractionDigits: 0,
                })}{" "}
                ₽
              </>
            ) : (
              <>{Number(dest.price).toLocaleString("ru-RU")} ₽</>
            )}
            <small>/ чел.</small>
          </div>
          <div className="card-duration">{dest.duration} дн.</div>
        </div>
      </div>
    </div>
  );
}
