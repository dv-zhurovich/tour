const router = require("express").Router();
const { pool } = require("../db");
const { sendNewsEmail } = require("../services/mailer");
const multer = require("multer");
const path = require("path");

// -- Общая настройка загрузки изображений для новостей и статей.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) =>
    cb(null, `content_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only images")),
});

const requireClient = (req, res, next) =>
  req.session.clientId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });
const requireAdmin = (req, res, next) =>
  req.session.adminId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });

// -- Разделяем доступ: клиенты оставляют отзывы, администратор управляет контентом.

// -- НОВОСТИ (публичные)
router.get("/news", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,title,excerpt,image_url,views,published_at
       FROM news WHERE is_published=TRUE ORDER BY published_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/news/:id", async (req, res) => {
  try {
    await pool.query("UPDATE news SET views=views+1 WHERE id=$1", [
      req.params.id,
    ]);
    const { rows } = await pool.query(
      "SELECT * FROM news WHERE id=$1 AND is_published=TRUE",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- СТАТЬИ (публичные)
router.get("/articles", async (req, res) => {
  try {
    const { category } = req.query;
    let query = `SELECT id,title,excerpt,image_url,category,views,published_at
                 FROM articles WHERE is_published=TRUE`;
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND category=$${params.length}`;
    }
    query += " ORDER BY published_at DESC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/articles/:id", async (req, res) => {
  try {
    await pool.query("UPDATE articles SET views=views+1 WHERE id=$1", [
      req.params.id,
    ]);
    const { rows } = await pool.query(
      "SELECT * FROM articles WHERE id=$1 AND is_published=TRUE",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ОТЗЫВЫ (публичные)
router.get("/reviews/:destination_id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.rating, r.text, r.created_at,
              c.first_name, c.last_name
       FROM reviews r JOIN clients c ON r.client_id=c.id
       WHERE r.destination_id=$1 AND r.is_approved=TRUE
       ORDER BY r.created_at DESC`,
      [req.params.destination_id],
    );
    // -- Средний рейтинг
    const avg = rows.length
      ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1)
      : null;
    res.json({ reviews: rows, average: avg, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Добавить отзыв (только авторизованный клиент)
router.post("/reviews", requireClient, async (req, res) => {
  try {
    const { destination_id, rating, text } = req.body;
    // -- Проверяем что клиент бронировал это направление
    const { rows: bookings } = await pool.query(
      `SELECT id FROM bookings WHERE client_id=$1 AND destination_id=$2
       AND status IN ('confirmed','completed') LIMIT 1`,
      [req.session.clientId, destination_id],
    );
    if (!bookings.length)
      return res.status(403).json({
        error: "Отзыв можно оставить только после подтверждённого бронирования",
      });

    const { rows } = await pool.query(
      `INSERT INTO reviews (client_id,destination_id,booking_id,rating,text)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (client_id,destination_id) DO UPDATE SET rating=$4,text=$5,is_approved=FALSE
       RETURNING *`,
      [req.session.clientId, destination_id, bookings[0].id, rating, text],
    );
    res.json({ success: true, review: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ADMIN: новости
router.get("/admin/news", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM news ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/admin/news",
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, content, excerpt, is_published, send_email } = req.body;
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image_url || "";
      const published = is_published === "true";
      const { rows } = await pool.query(
        `INSERT INTO news (title,content,excerpt,image_url,is_published,published_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          title,
          content,
          excerpt || null,
          imageUrl,
          published,
          published ? new Date() : null,
        ],
      );
      // -- Рассылка подписчикам
      if (published && send_email === "true") {
        const { rows: clients } = await pool.query(
          "SELECT * FROM clients WHERE email_news=TRUE AND is_active=TRUE",
        );
        let sent = 0;
        for (const client of clients) {
          try {
            await sendNewsEmail(client, rows[0]);
            sent++;
          } catch {}
        }
        console.log(`📧 Новость разослана ${sent} подписчикам`);
      }
      res.json({ success: true, news: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

router.put(
  "/admin/news/:id",
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, content, excerpt, is_published } = req.body;
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image_url || "";
      const published = is_published === "true";
      const { rows } = await pool.query(
        `UPDATE news SET title=$1,content=$2,excerpt=$3,image_url=$4,is_published=$5,
       published_at=CASE WHEN $5=TRUE AND published_at IS NULL THEN NOW() ELSE published_at END
       WHERE id=$6 RETURNING *`,
        [title, content, excerpt || null, imageUrl, published, req.params.id],
      );
      res.json({ success: true, news: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

router.delete("/admin/news/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM news WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ADMIN: статьи
router.get("/admin/articles", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM articles ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/admin/articles",
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, content, excerpt, category, is_published } = req.body;
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image_url || "";
      const published = is_published === "true";
      const { rows } = await pool.query(
        `INSERT INTO articles (title,content,excerpt,image_url,category,is_published,published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          title,
          content,
          excerpt || null,
          imageUrl,
          category || "general",
          published,
          published ? new Date() : null,
        ],
      );
      res.json({ success: true, article: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

router.put(
  "/admin/articles/:id",
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, content, excerpt, category, is_published } = req.body;
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image_url || "";
      const published = is_published === "true";
      const { rows } = await pool.query(
        `UPDATE articles SET title=$1,content=$2,excerpt=$3,image_url=$4,category=$5,is_published=$6,
       published_at=CASE WHEN $6=TRUE AND published_at IS NULL THEN NOW() ELSE published_at END
       WHERE id=$7 RETURNING *`,
        [
          title,
          content,
          excerpt || null,
          imageUrl,
          category || "general",
          published,
          req.params.id,
        ],
      );
      res.json({ success: true, article: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

router.delete("/admin/articles/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM articles WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- ADMIN: отзывы
router.get("/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, c.first_name, c.last_name, c.email, d.name as dest_name
       FROM reviews r JOIN clients c ON r.client_id=c.id
       JOIN destinations d ON r.destination_id=d.id
       ORDER BY r.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE reviews SET is_approved=TRUE WHERE id=$1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM reviews WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
