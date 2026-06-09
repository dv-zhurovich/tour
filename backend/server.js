const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { initDB } = require("./db");
require("./services/scheduler");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

// Базовые middleware: CORS для фронтенда, парсинг JSON/форм и выдача загруженных файлов.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Сессия хранит авторизацию администратора и клиента между запросами.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "horizons_secret_2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, sameSite: "lax" },
  }),
);

// Подключение API-модулей по функциональным зонам приложения.
app.use("/api/destinations", require("./routes/destinations"));
app.use("/api", require("./routes/auth"));
app.use("/api/client", require("./routes/clients"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/loyalty", require("./routes/loyalty"));
app.use("/api/content", require("./routes/content"));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// После инициализации БД запускаем HTTP-сервер.
initDB()
  .then(() =>
    app.listen(PORT, () => console.log(`🚀 Backend: http://localhost:${PORT}`)),
  )
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
