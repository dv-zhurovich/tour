const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../db");

// -- Проверяет, что текущая сессия принадлежит администратору
const requireAuth = (req, res, next) =>
  req.session.adminId
    ? next()
    : res.status(401).json({ error: "Unauthorized" });

// -- Авторизует администратора и сохраняет его id в серверной сессии
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE username = $1",
      [username],
    );
    if (!rows.length)
      return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    req.session.adminId = rows[0].id;
    res.json({ success: true, username: rows[0].username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Завершает административную сессию
router.post("/logout", (req, res) =>
  req.session.destroy(() => res.json({ success: true })),
);

// -- Возвращает данные текущего администратора для проверки доступа на фронтенде
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username FROM admins WHERE id = $1",
    [req.session.adminId],
  );
  res.json(rows[0] || null);
});

// -- Принимает публичную заявку с главной страницы.
router.post("/inquiry", async (req, res) => {
  try {
    const { name, email, phone, destination, message } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO inquiries (name,email,phone,destination,message) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [name, email, phone || null, destination || null, message],
    );
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Список заявок для панели администратора.
router.get("/inquiries", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM inquiries ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- Отмечает заявку как прочитанную.
router.patch("/inquiries/:id/read", requireAuth, async (req, res) => {
  try {
    await pool.query("UPDATE inquiries SET is_read = TRUE WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
