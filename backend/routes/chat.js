const router = require("express").Router();
const { pool } = require("../db");
const TelegramBot = require("node-telegram-bot-api");
const { v4: uuidv4 } = require("crypto").webcrypto
  ? require("crypto")
  : { v4: () => Math.random().toString(36).slice(2) + Date.now().toString(36) };

// -- Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

// -- Хранилище сессий, где клиент ждёт живого менеджера
const pendingHuman = new Map();

bot.on("message", (msg) => {
  console.log(JSON.stringify(msg, null, 2));
});

// -- Системный промпт для AI
const SYSTEM_PROMPT = `Ты — помощник туристического агентства DianaTour. Отвечай ТОЛЬКО на русском языке. Будь краток — максимум 3 предложения.

Агентство DianaTour:
- Туры: пляжный отдых, горы, культура, приключения, люкс
- Онлайн-бронирование на сайте: выбери тур → дата → кол-во человек
- Контакты: тел. +373 (533) 12-345, email info@dianatour.pmr, офис пн-сб

Ты отвечаешь на общие вопросы: категории туров, как забронировать, контакты, цены в общем.

ВАЖНО: если вопрос про конкретное бронирование, документы, жалобы, скидки, специальные условия — ответь СТРОГО одним словом: TRANSFER`;

// -- Функция вызова Ollama
async function askOllama(messages) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:1b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 150, num_ctx: 1024 },
      }),
    });
    if (!response.ok) throw new Error("Ollama error");
    const data = await response.json();
    return data.message?.content?.trim() || "";
  } catch (err) {
    console.error("Ollama error:", err.message);
    return null;
  }
}

const TRANSFER_KEYWORDS = [
  "бронирован",
  "мой заказ",
  "мой тур",
  "отменить",
  "возврат",
  "паспорт",
  "документ",
  "виза",
  "жалоб",
  "претензи",
  "скидк",
  "акци",
  "промокод",
  "специальн",
  "индивидуальн",
  "не работает",
  "ошибка",
  "проблема",
  "не могу войти",
  "конкретн",
  "мой аккаунт",
  "личн",
];

function shouldTransfer(userMessage, aiReply) {
  const msg = userMessage.toLowerCase();
  const reply = (aiReply || "").toLowerCase().trim();

  // -- AI явно сказал TRANSFER
  if (reply === "transfer" || reply.startsWith("transfer")) return true;

  // -- AI ответил очень коротко и непонятно (значит не знает)
  if (
    reply.length < 15 &&
    !reply.includes("тур") &&
    !reply.includes("агентств")
  )
    return true;

  // -- Ключевые слова в вопросе пользователя
  for (const kw of TRANSFER_KEYWORDS) {
    if (msg.includes(kw)) return true;
  }

  return false;
}

// -- Функция отправки в Telegram
async function notifyTelegram(sessionId, clientName, userMessage) {
  try {
    const text =
      `💬 *Новый вопрос клиента*\n\n` +
      `👤 Клиент: ${clientName}\n` +
      `🆔 Сессия: \`${sessionId}\`\n\n` +
      `❓ *Вопрос:*\n${userMessage}\n\n` +
      `_Ответьте на это сообщение чтобы клиент получил ваш ответ_`;

    const msg = await bot.sendMessage(ADMIN_CHAT_ID, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Ответить", callback_data: `reply_${sessionId}` }],
        ],
      },
    });
    return msg.message_id;
  } catch (err) {
    console.error("Telegram notify error:", err.message);
    return null;
  }
}

// -- Обработка ответов из Telegram
// -- Ответ на сообщение бота
bot.on("message", async (msg) => {
  if (!msg.reply_to_message) return;
  if (String(msg.chat.id) !== String(ADMIN_CHAT_ID)) return;

  // -- Ищем сессию по telegram_message_id
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT session_id FROM chat_messages 
       WHERE telegram_message_id = $1`,
      [msg.reply_to_message.message_id],
    );
    if (!rows.length) return;

    const sessionId = rows[0].session_id;
    const adminReply = msg.text;

    // -- Сохраняем ответ менеджера
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)`,
      [sessionId, "assistant", adminReply],
    );

    // -- Убираем из ожидания
    pendingHuman.delete(sessionId);

    // -- Обновляем last_activity
    await pool.query(
      "UPDATE chat_sessions SET last_activity = NOW() WHERE session_id = $1",
      [sessionId],
    );

    await bot.sendMessage(ADMIN_CHAT_ID, `✅ Ответ отправлен клиенту`);
  } catch (err) {
    console.error("Bot reply error:", err.message);
  }
});

// -- Callback кнопки "Ответить"
bot.on("callback_query", async (query) => {
  if (query.data.startsWith("reply_")) {
    const sessionId = query.data.replace("reply_", "");
    pendingHuman.set(sessionId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `📝 Ответьте *reply* на исходное сообщение с вопросом клиента (сессия \`${sessionId}\`)`,
      { parse_mode: "Markdown" },
    );
  }
});

// -- POST /api/chat/message — отправить сообщение
router.post("/message", async (req, res) => {
  try {
    const { session_id, message } = req.body;
    if (!message?.trim())
      return res.status(400).json({ error: "Пустое сообщение" });

    let sessionId = session_id;
    let clientName = "Гость";

    // -- Получаем или создаём сессию
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const clientId = req.session?.clientId || null;

      if (clientId) {
        const { rows } = await pool.query(
          "SELECT first_name, last_name FROM clients WHERE id = $1",
          [clientId],
        );
        if (rows.length)
          clientName = `${rows[0].first_name} ${rows[0].last_name}`;
      }

      await pool.query(
        `INSERT INTO chat_sessions (session_id, client_id, client_name) VALUES ($1, $2, $3)`,
        [sessionId, clientId, clientName],
      );
    } else {
      const { rows } = await pool.query(
        "SELECT client_name FROM chat_sessions WHERE session_id = $1",
        [sessionId],
      );
      if (rows.length) clientName = rows[0].client_name;
    }

    // -- Сохраняем сообщение пользователя
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)`,
      [sessionId, "user", message.trim()],
    );

    await pool.query(
      "UPDATE chat_sessions SET last_activity = NOW() WHERE session_id = $1",
      [sessionId],
    );

    // -- Если сессия уже передана менеджеру — ждём его ответа
    if (pendingHuman.has(sessionId)) {
      return res.json({
        session_id: sessionId,
        reply: "⏳ Ваш вопрос передан менеджеру. Ожидайте ответа...",
        handled_by: "pending",
      });
    }

    // -- Перед ответом AI поднимаем последние сообщения, чтобы модель видела короткий контекст диалога
    const { rows: history } = await pool.query(
      `SELECT role, content FROM chat_messages 
       WHERE session_id = $1 AND role != 'system'
       ORDER BY created_at DESC LIMIT 6`,
      [sessionId],
    );
    const messages = history.reverse();

    // -- Спрашиваем AI только если он включён в окружении; иначе сразу передаём вопрос менеджеру
    const aiEnabled = process.env.AI_ENABLED === "true";
    const aiReply = aiEnabled ? await askOllama(messages) : null;
    if (!aiReply || shouldTransfer(message.trim(), aiReply)) {
      // -- Передаём менеджеру и сохраняем связку с Telegram-сообщением
      pendingHuman.set(sessionId, true);

      const msgId = await notifyTelegram(sessionId, clientName, message.trim());

      // -- Сохраняем ID telegram-сообщения
      await pool.query(
        `UPDATE chat_messages SET sent_to_telegram = TRUE, telegram_message_id = $1
         WHERE session_id = $2 AND role = 'user' AND sent_to_telegram = FALSE`,
        [msgId, sessionId],
      );

      const transferMsg =
        "🔄 Ваш вопрос передан менеджеру агентства. Ожидайте ответа — обычно это занимает несколько минут.";

      await pool.query(
        `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)`,
        [sessionId, "assistant", transferMsg],
      );

      return res.json({
        session_id: sessionId,
        reply: transferMsg,
        handled_by: "human",
      });
    }

    // -- Сохраняем ответ AI, чтобы история чата была доступна клиенту при следующем открытии
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)`,
      [sessionId, "assistant", aiReply],
    );

    res.json({
      session_id: sessionId,
      reply: aiReply,
      handled_by: "ai",
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -- GET /api/chat/history — история сообщений
router.get("/history/:session_id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT role, content, created_at FROM chat_messages
       WHERE session_id = $1 AND role != 'system'
       ORDER BY created_at ASC`,
      [req.params.session_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- GET /api/chat/poll — опрос новых сообщений от менеджера
router.get("/poll/:session_id", async (req, res) => {
  try {
    const since = req.query.since || new Date(0).toISOString();
    const { rows } = await pool.query(
      `SELECT role, content, created_at FROM chat_messages
       WHERE session_id = $1 AND role = 'assistant' AND created_at > $2
       ORDER BY created_at ASC`,
      [req.params.session_id, since],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- GET /api/chat/admin/sessions — все сессии для админки
router.get("/admin/sessions", async (req, res) => {
  const requireAdmin = (req) => req.session?.adminId;
  if (!requireAdmin(req))
    return res.status(401).json({ error: "Unauthorized" });
  try {
    const { rows } = await pool.query(
      `SELECT s.*, 
        (SELECT content FROM chat_messages WHERE session_id = s.session_id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.session_id) as message_count
       FROM chat_sessions s ORDER BY s.last_activity DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
