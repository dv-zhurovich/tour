const router = require("express").Router();
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");

// -- Multer сохраняет изображения направлений в backend/uploads.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) =>
    cb(null, `dest_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only images")),
});

const requireAuth = (req, res, next) =>
  req.session.adminId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });

// -- Публичный список активных направлений с фильтрами категории и поиска.
router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = "SELECT * FROM destinations WHERE is_active = TRUE";
    const params = [];
    if (category && category !== "all") {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR country ILIKE $${params.length})`;
    }
    query += " ORDER BY created_at DESC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Полный список направлений для админ-панели, включая неактивные.
router.get("/admin/all", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM destinations ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Детальная карточка направления по id.
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM destinations WHERE id = $1",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Создаёт направление и переводит многострочные поля формы в массивы PostgreSQL.
router.post("/admin", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      country,
      description,
      short_description,
      price,
      duration,
      category,
      rating,
      included,
      highlights,
      discount_percent,
      discount_expires_at,
	  latitude,
	  longitude
    } = req.body;
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.image_url || "";
    const inc = included
      ? included
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const hl = highlights
      ? highlights
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const { rows } = await pool.query(
      `INSERT INTO destinations (name,country,description,short_description,price,duration,category,image_url,rating,included,highlights,discount_percent,discount_expires_at,latitude,longitude)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        name,
        country,
        description,
        short_description,
        Number(price),
        Number(duration),
        category,
        imageUrl,
        Number(rating) || 4.5,
        inc,
        hl,
        Number(discount_percent) || 0,
        discount_expires_at || null,
		latitude||null,
		longitude||null
      ],
    );
    res.json({ success: true, destination: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Обновляет направление, включая изображение, статус активности и скидку.
router.put(
  "/admin/:id",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        name,
        country,
        description,
        short_description,
        price,
        duration,
        category,
        rating,
        included,
        highlights,
        is_active,
        discount_percent,
        discount_expires_at,
		latitude,
		longitude
      } = req.body;
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image_url || "";
      const inc = included
        ? included
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const hl = highlights
        ? highlights
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const { rows } = await pool.query(
        `UPDATE destinations SET name=$1,country=$2,description=$3,short_description=$4,price=$5,
			duration=$6,category=$7,image_url=$8,rating=$9,included=$10,highlights=$11,is_active=$12,
			discount_percent=$13,discount_expires_at=$14,latitude=$15,longitude=$16
		  WHERE id=$17 RETURNING *`,
        [
          name,
          country,
          description,
          short_description,
          Number(price),
          Number(duration),
          category,
          imageUrl,
          Number(rating) || 4.5,
          inc,
          hl,
          is_active === "true" || is_active === true,
          Number(discount_percent) || 0,
          discount_expires_at || null,
		  latitude||null,
		  longitude||null,
          req.params.id
        ],
      );
      res.json({ success: true, destination: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// -- Удаляет направление из каталога.
router.delete("/admin/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM destinations WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
