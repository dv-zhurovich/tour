const { Pool } = require("pg");

// -- Общий пул подключений PostgreSQL, настройки берутся из .env с локальными значениями по умолчанию.
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "tour",
  user: process.env.DB_USER || "tour",
  password: process.env.DB_PASSWORD || "tour",
});

async function initDB() {
  const client = await pool.connect();
  try {
    // -- Создаём основные таблицы приложения, если база запускается впервые.
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS destinations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        short_description VARCHAR(500) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        duration INTEGER NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('beach','mountain','city','cultural','adventure','luxury')),
        image_url TEXT DEFAULT '',
        rating NUMERIC(2,1) DEFAULT 4.5,
        included TEXT[] DEFAULT '{}',
        highlights TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        destination VARCHAR(255),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
        travel_date DATE NOT NULL,
        people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count > 0),
        total_price NUMERIC(12,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','cancelled','completed')),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const bcrypt = require("bcryptjs");
    const { rows } = await client.query("SELECT id FROM admins LIMIT 1");
    if (rows.length === 0) {
      // -- Первый администратор нужен для входа в панель сразу после установки.
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO admins (username, password) VALUES ($1, $2)",
        ["admin", hash],
      );
      console.log("👤 Default admin: admin / admin123");
    }
    const { rows: dRows } = await client.query(
      "SELECT id FROM destinations LIMIT 1",
    );
    // -- Стартовые туры показывают витрину даже до ручного наполнения каталога.
    if (dRows.length === 0) await seedDestinations(client);
  } finally {
    client.release();
  }
}

async function seedDestinations(client) {
  // -- Минимальный набор направлений для первоначального наполнения каталога.
  const samples = [
    [
      "Санторини",
      "Греция",
      "Один из самых романтичных островов Средиземноморья.",
      "Белоснежные дома на краю вулканической кальдеры",
      85000,
      7,
      "beach",
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80",
      4.9,
      "{Перелёт,Отель 4*,Завтраки,Трансфер}",
      "{Закат в Ойе,Вулканические пляжи,Местные вина}",
    ],
    [
      "Бали",
      "Индонезия",
      "Уникальное сочетание древней культуры, джунглей и пляжей.",
      "Остров богов с рисовыми террасами и храмами",
      95000,
      10,
      "cultural",
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",
      4.8,
      "{Перелёт,Вилла с бассейном,Завтраки}",
      "{Храм Танах Лот,Рисовые террасы,Водопады}",
    ],
    [
      "Дубай",
      "ОАЭ",
      "Мегаполис контрастов и безграничная роскошь.",
      "Город будущего в пустыне",
      120000,
      6,
      "luxury",
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
      4.7,
      "{Перелёт,Отель 5*,Завтраки и ужины}",
      "{Бурдж-Халифа,Дубай Молл,Сафари}",
    ],
    [
      "Мальдивы",
      "Мальдивы",
      "Бунгало над водой, дайвинг с мантами, коралловые рифы.",
      "Частный рай: бунгало над водой",
      200000,
      7,
      "beach",
      "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
      5.0,
      "{Перелёт,Резорт 5*,Всё включено}",
      "{Водное бунгало,Снорклинг,Закаты}",
    ],
  ];
  for (const s of samples) {
    await client.query(
      `INSERT INTO destinations (name,country,description,short_description,price,duration,category,image_url,rating,included,highlights)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      s,
    );
  }
  console.log("🌍 Seeded");
}

module.exports = { pool, initDB };
