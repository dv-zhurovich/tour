const router = require("express").Router();
const { pool } = require("../db");

// -- Клиентские и административные операции лояльности используют разные уровни доступа.
const requireClient = (req, res, next) =>
  req.session.clientId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });
const requireAdmin = (req, res, next) =>
  req.session.adminId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });

// -- ИЗБРАННОЕ

// -- Получить избранное клиента
router.get("/favorites", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, f.created_at as favorited_at
       FROM favorites f
       JOIN destinations d ON f.destination_id = d.id
       WHERE f.client_id = $1
       ORDER BY f.created_at DESC`,
      [req.session.clientId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Получить ID избранных (для отображения на карточках)
router.get("/favorites/ids", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT destination_id FROM favorites WHERE client_id = $1",
      [req.session.clientId],
    );
    res.json(rows.map((r) => r.destination_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Добавить в избранное
router.post("/favorites/:id", requireClient, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO favorites (client_id, destination_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.session.clientId, req.params.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Удалить из избранного
router.delete("/favorites/:id", requireClient, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM favorites WHERE client_id = $1 AND destination_id = $2",
      [req.session.clientId, req.params.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- БОНУСЫ

// -- Баланс бонусов клиента
router.get("/bonus/balance", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(
         CASE WHEN type IN ('earn','admin') THEN points
              WHEN type IN ('spend','expire') THEN -points
              ELSE 0 END
       ), 0) as balance
       FROM bonus_transactions WHERE client_id = $1`,
      [req.session.clientId],
    );
    const settings = await pool.query("SELECT * FROM bonus_settings LIMIT 1");
    res.json({
      balance: Number(rows[0].balance),
      settings: settings.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- История бонусов
router.get("/bonus/history", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bt.*, b.id as booking_ref
       FROM bonus_transactions bt
       LEFT JOIN bookings b ON bt.booking_id = b.id
       WHERE bt.client_id = $1
       ORDER BY bt.created_at DESC`,
      [req.session.clientId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- СКИДКИ

// -- Получить персональную скидку клиента
router.get("/discount", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM client_discounts
       WHERE client_id = $1 AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY discount_percent DESC LIMIT 1`,
      [req.session.clientId],
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- РАСЧЁТ ИТОГОВОЙ ЦЕНЫ
// -- Используется при бронировании
router.post("/calculate", requireClient, async (req, res) => {
  try {
    const { destination_id, people_count, use_bonus_points } = req.body;

    // -- Цена направления со скидкой
    const { rows: destRows } = await pool.query(
      "SELECT price, discount_percent, discount_expires_at FROM destinations WHERE id = $1",
      [destination_id],
    );
    if (!destRows.length) return res.status(404).json({ error: "Не найдено" });

    const dest = destRows[0];
    let basePrice = Number(dest.price);

    // -- Скидка на направление
    let destDiscount = 0;
    if (dest.discount_percent > 0) {
      const expired =
        dest.discount_expires_at &&
        new Date(dest.discount_expires_at) < new Date();
      if (!expired) destDiscount = Number(dest.discount_percent);
    }

    // -- Персональная скидка клиента
    const { rows: discRows } = await pool.query(
      `SELECT discount_percent FROM client_discounts
       WHERE client_id = $1 AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY discount_percent DESC LIMIT 1`,
      [req.session.clientId],
    );
    const personalDiscount = discRows.length
      ? Number(discRows[0].discount_percent)
      : 0;

    // -- Берём максимальную скидку
    const appliedDiscount = Math.max(destDiscount, personalDiscount);
    const priceAfterDiscount = basePrice * (1 - appliedDiscount / 100);
    const subtotal = priceAfterDiscount * Number(people_count);

    // -- Бонусные баллы уменьшают итог только в рамках лимитов из настроек программы.
    let bonusDiscount = 0;
    let bonusUsed = 0;
    if (use_bonus_points) {
      const { rows: bonusRows } = await pool.query(
        `SELECT COALESCE(SUM(
           CASE WHEN type IN ('earn','admin') THEN points
                WHEN type IN ('spend','expire') THEN -points
                ELSE 0 END
         ), 0) as balance FROM bonus_transactions WHERE client_id = $1`,
        [req.session.clientId],
      );
      const settings = await pool.query("SELECT * FROM bonus_settings LIMIT 1");
      const balance = Number(bonusRows[0].balance);
      const pointsToRub = Number(settings.rows[0].points_to_rub);
      const minPoints = Number(settings.rows[0].min_spend_points);

      if (balance >= minPoints) {
        // -- Можно потратить не более 20% от суммы бонусами
        const maxBonusDiscount = subtotal * 0.2;
        bonusUsed = Math.min(
          balance,
          Math.floor(maxBonusDiscount / pointsToRub),
        );
        bonusDiscount = bonusUsed * pointsToRub;
      }
    }

    const totalPrice = Math.max(0, subtotal - bonusDiscount);

    // -- Сколько баллов заработает за эту покупку
    const settings = await pool.query("SELECT * FROM bonus_settings LIMIT 1");
    const earnPercent = Number(settings.rows[0].earn_percent);
    const pointsEarned = Math.floor((totalPrice * earnPercent) / 100);

    res.json({
      base_price: basePrice,
      dest_discount: destDiscount,
      personal_discount: personalDiscount,
      applied_discount: appliedDiscount,
      price_after_discount: priceAfterDiscount,
      people_count: Number(people_count),
      subtotal,
      bonus_used: bonusUsed,
      bonus_discount: bonusDiscount,
      total_price: totalPrice,
      points_earned: pointsEarned,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ADMIN: скидки

// -- Добавить персональную скидку клиенту
router.post("/admin/discounts", requireAdmin, async (req, res) => {
  try {
    const { client_id, discount_percent, reason, expires_at } = req.body;
    // -- Деактивируем старые скидки
    await pool.query(
      "UPDATE client_discounts SET is_active = FALSE WHERE client_id = $1",
      [client_id],
    );
    const { rows } = await pool.query(
      `INSERT INTO client_discounts (client_id, discount_percent, reason, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [client_id, discount_percent, reason || null, expires_at || null],
    );
    res.json({ success: true, discount: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Список скидок всех клиентов
router.get("/admin/discounts", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cd.*, c.first_name, c.last_name, c.email
       FROM client_discounts cd
       JOIN clients c ON cd.client_id = c.id
       WHERE cd.is_active = TRUE
       ORDER BY cd.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Начислить бонусы вручную
router.post("/admin/bonus", requireAdmin, async (req, res) => {
  try {
    const { client_id, points, description } = req.body;
    await pool.query(
      `INSERT INTO bonus_transactions (client_id, type, points, description)
       VALUES ($1, 'admin', $2, $3)`,
      [
        client_id,
        Math.abs(points),
        description || "Начисление администратором",
      ],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Обновить настройки бонусной программы
router.put("/admin/bonus/settings", requireAdmin, async (req, res) => {
  try {
    const { earn_percent, min_spend_points, points_to_rub } = req.body;
    await pool.query(
      `UPDATE bonus_settings SET earn_percent=$1, min_spend_points=$2, points_to_rub=$3`,
      [earn_percent, min_spend_points, points_to_rub],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Скидки на направления (обновить)
router.patch(
  "/admin/destinations/:id/discount",
  requireAdmin,
  async (req, res) => {
    try {
      const { discount_percent, expires_at } = req.body;
      await pool.query(
        `UPDATE destinations SET discount_percent=$1, discount_expires_at=$2 WHERE id=$3`,
        [discount_percent || 0, expires_at || null, req.params.id],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
