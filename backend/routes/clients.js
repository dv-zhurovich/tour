const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../db");

// -- Middleware ограничивают личный кабинет клиентом, а служебные списки администратором.
const requireClient = (req, res, next) =>
  req.session.clientId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });
const requireAdmin = (req, res, next) =>
  req.session.adminId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });

// -- Регистрация
router.post("/register", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;
    const exists = await pool.query("SELECT id FROM clients WHERE email = $1", [
      email,
    ]);
    if (exists.rows.length)
      return res.status(400).json({ error: "Email уже зарегистрирован" });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO clients (first_name,last_name,email,phone,password) VALUES ($1,$2,$3,$4,$5) RETURNING id,first_name,last_name,email,phone",
      [first_name, last_name, email, phone || null, hash],
    );
    req.session.clientId = rows[0].id;
    res.json({ success: true, client: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Вход
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      "SELECT * FROM clients WHERE email = $1",
      [email],
    );
    if (!rows.length)
      return res.status(401).json({ error: "Неверный email или пароль" });
    if (!rows[0].is_active)
      return res.status(403).json({ error: "Аккаунт заблокирован" });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok)
      return res.status(401).json({ error: "Неверный email или пароль" });
    req.session.clientId = rows[0].id;
    const { password: _, ...client } = rows[0];
    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Выход
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// -- Текущий клиент
router.get("/me", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id,first_name,last_name,email,phone,created_at FROM clients WHERE id = $1",
      [req.session.clientId],
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Обновить профиль
router.put("/me", requireClient, async (req, res) => {
  try {
    const { first_name, last_name, phone, password } = req.body;
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query =
        "UPDATE clients SET first_name=$1,last_name=$2,phone=$3,password=$4 WHERE id=$5 RETURNING id,first_name,last_name,email,phone";
      params = [
        first_name,
        last_name,
        phone || null,
        hash,
        req.session.clientId,
      ];
    } else {
      query =
        "UPDATE clients SET first_name=$1,last_name=$2,phone=$3 WHERE id=$4 RETURNING id,first_name,last_name,email,phone";
      params = [first_name, last_name, phone || null, req.session.clientId];
    }
    const { rows } = await pool.query(query, params);
    res.json({ success: true, client: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- БРОНИРОВАНИЯ КЛИЕНТА
// -- Создать бронирование
router.post("/bookings", requireClient, async (req, res) => {
  try {
    const {
      destination_id,
      travel_date,
      people_count,
      comment,
      use_bonus_points,
    } = req.body;

    const dest = await pool.query(
      "SELECT price, discount_percent, discount_expires_at, duration FROM destinations WHERE id = $1 AND is_active = TRUE",
      [destination_id],
    );
    if (!dest.rows.length)
      return res.status(404).json({ error: "Направление не найдено" });

    const duration = dest.rows[0].duration;

    // -- Проверка перекрытия дат не даёт клиенту забронировать два тура на один период.
    const { rows: overlapping } = await pool.query(
      `SELECT b.id, d.name as dest_name, b.travel_date, d.duration
       FROM bookings b JOIN destinations d ON b.destination_id = d.id
       WHERE b.client_id = $1
         AND b.status IN ('pending','confirmed')
         AND (
           b.travel_date <= ($2::date + ($3 - 1) * INTERVAL '1 day')
           AND (b.travel_date + (d.duration - 1) * INTERVAL '1 day') >= $2::date
         )`,
      [req.session.clientId, travel_date, duration],
    );

    if (overlapping.length > 0) {
      const conflict = overlapping[0];
      const conflictDate = new Date(conflict.travel_date).toLocaleDateString(
        "ru-RU",
      );
      return res.status(409).json({
        error: `Даты пересекаются с туром «${conflict.dest_name}» (${conflictDate}, ${conflict.duration} дн.). Выберите другую дату.`,
      });
    }

    const basePrice = Number(dest.rows[0].price);
    let destDiscount = 0;
    // -- Выбираем актуальную скидку направления, если срок действия ещё не прошёл.
    if (dest.rows[0].discount_percent > 0) {
      const expired =
        dest.rows[0].discount_expires_at &&
        new Date(dest.rows[0].discount_expires_at) < new Date();
      if (!expired) destDiscount = Number(dest.rows[0].discount_percent);
    }

    const { rows: discRows } = await pool.query(
      `SELECT discount_percent FROM client_discounts
       WHERE client_id=$1 AND is_active=TRUE
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY discount_percent DESC LIMIT 1`,
      [req.session.clientId],
    );
    const personalDiscount = discRows.length
      ? Number(discRows[0].discount_percent)
      : 0;
    // -- Для расчёта применяется самая выгодная скидка: персональная или скидка тура.
    const appliedDiscount = Math.max(destDiscount, personalDiscount);
    const priceAfterDiscount = basePrice * (1 - appliedDiscount / 100);
    let subtotal = priceAfterDiscount * Number(people_count);

    let bonusUsed = 0;
    if (use_bonus_points) {
      // -- Бонусами можно покрыть часть стоимости в пределах правил программы лояльности.
      const { rows: bonusRows } = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN type IN ('earn','admin') THEN points WHEN type IN ('spend','expire') THEN -points ELSE 0 END),0) as balance
         FROM bonus_transactions WHERE client_id=$1`,
        [req.session.clientId],
      );
      const settings = await pool.query("SELECT * FROM bonus_settings LIMIT 1");
      const balance = Number(bonusRows[0].balance);
      const pointsToRub = Number(settings.rows[0].points_to_rub);
      const minPoints = Number(settings.rows[0].min_spend_points);
      if (balance >= minPoints) {
        const maxBonusDiscount = subtotal * 0.2;
        bonusUsed = Math.min(
          balance,
          Math.floor(maxBonusDiscount / pointsToRub),
        );
        subtotal = Math.max(0, subtotal - bonusUsed * pointsToRub);
      }
    }

    const total_price = subtotal;
    const { rows } = await pool.query(
      `INSERT INTO bookings (client_id,destination_id,travel_date,people_count,total_price,comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        req.session.clientId,
        destination_id,
        travel_date,
        people_count,
        total_price,
        comment || null,
      ],
    );
    const bookingId = rows[0].id;

    if (bonusUsed > 0) {
      await pool.query(
        `INSERT INTO bonus_transactions (client_id,booking_id,type,points,description) VALUES ($1,$2,'spend',$3,$4)`,
        [
          req.session.clientId,
          bookingId,
          bonusUsed,
          `Списание за бронирование #${bookingId}`,
        ],
      );
    }

    const settings = await pool.query(
      "SELECT earn_percent FROM bonus_settings LIMIT 1",
    );
    // -- После бронирования клиенту начисляются новые баллы от финальной суммы.
    const earnPercent = Number(settings.rows[0].earn_percent);
    const pointsEarned = Math.floor((total_price * earnPercent) / 100);
    if (pointsEarned > 0) {
      await pool.query(
        `INSERT INTO bonus_transactions (client_id,booking_id,type,points,description) VALUES ($1,$2,'earn',$3,$4)`,
        [
          req.session.clientId,
          bookingId,
          pointsEarned,
          `Начисление за бронирование #${bookingId}`,
        ],
      );
    }

    // -- Email подтверждение
    try {
      const { sendBookingConfirmation } = require("../services/mailer");
      const clientData = await pool.query("SELECT * FROM clients WHERE id=$1", [
        req.session.clientId,
      ]);
      const destData = await pool.query(
        "SELECT * FROM destinations WHERE id=$1",
        [destination_id],
      );
      await sendBookingConfirmation(
        clientData.rows[0],
        rows[0],
        destData.rows[0],
      );
    } catch (emailErr) {
      console.error("Email confirmation error:", emailErr.message);
    }

    res.json({
      success: true,
      booking: rows[0],
      points_earned: pointsEarned,
      bonus_used: bonusUsed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Мои бронирования
router.get("/bookings", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, d.name as destination_name, d.country, d.image_url, d.duration
       FROM bookings b JOIN destinations d ON b.destination_id = d.id
       WHERE b.client_id = $1 ORDER BY b.created_at DESC`,
      [req.session.clientId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Отменить бронирование
router.patch("/bookings/:id/cancel", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE bookings SET status='cancelled' WHERE id=$1 AND client_id=$2
       AND status IN ('pending','confirmed') RETURNING *`,
      [req.params.id, req.session.clientId],
    );
    if (!rows.length)
      return res.status(400).json({ error: "Невозможно отменить" });
    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ADMIN: клиенты
router.get("/admin/clients", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id,first_name,last_name,email,phone,is_active,created_at FROM clients ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/clients/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE clients SET is_active = NOT is_active WHERE id=$1 RETURNING id,is_active",
      [req.params.id],
    );
    res.json({ success: true, client: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ADMIN: бронирования
router.get("/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, 
        c.first_name, c.last_name, c.email as client_email,
        d.name as destination_name, d.country
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       JOIN destinations d ON b.destination_id = d.id
       ORDER BY b.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/bookings/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { rows } = await pool.query(
      "UPDATE bookings SET status=$1 WHERE id=$2 RETURNING *",
      [status, req.params.id],
    );
    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
