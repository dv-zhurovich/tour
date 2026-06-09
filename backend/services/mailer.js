const nodemailer = require("nodemailer");

// -- Единый SMTP-транспорт для всех писем агентства
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const FROM = `"DianaTour" <${process.env.GMAIL_USER}>`;
const SITE = process.env.SITE_URL || "http://dianatour.pmr";

// -- Шаблон письма
function template(title, body) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin:0; padding:0; background:#0d0d0d; font-family:'Segoe UI',Arial,sans-serif; color:#f0ece4; }
    .wrap { max-width:600px; margin:0 auto; }
    .header { background:#161616; padding:32px 40px; border-bottom:2px solid #c9a84c; text-align:center; }
    .logo { font-size:28px; color:#c9a84c; font-weight:700; letter-spacing:0.05em; }
    .body { padding:36px 40px; background:#161616; margin-top:2px; }
    .title { font-size:22px; color:#fff; margin-bottom:16px; }
    .text { font-size:15px; line-height:1.7; color:#c8c4bc; margin-bottom:16px; }
    .btn { display:inline-block; padding:14px 32px; background:#c9a84c; color:#0d0d0d;
           text-decoration:none; border-radius:4px; font-weight:600; font-size:15px; margin:16px 0; }
    .highlight { background:#1e1e1e; border-left:3px solid #c9a84c; padding:16px 20px;
                 border-radius:4px; margin:16px 0; }
    .highlight p { margin:6px 0; font-size:14px; color:#c8c4bc; }
    .highlight strong { color:#e8c97a; }
    .footer { padding:24px 40px; text-align:center; font-size:12px; color:#666; background:#111; }
    .footer a { color:#c9a84c; text-decoration:none; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">◈ DianaTour</div>
  </div>
  <div class="body">
    <div class="title">${title}</div>
    ${body}
  </div>
  <div class="footer">
    <p>© 2024 DianaTour — Туристическое агентство</p>
    <p><a href="${SITE}">dianatour.pmr</a> · <a href="mailto:info@dianatour.pmr">info@dianatour.pmr</a></p>
    <p style="margin-top:8px;font-size:11px;color:#444">
      Вы получили это письмо как клиент DianaTour.<br>
      <a href="${SITE}/dashboard">Управление уведомлениями</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

// -- Напоминание о туре
async function sendTourReminder(client, booking, destination, daysLeft) {
  const travelDate = new Date(booking.travel_date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const body = `
    <p class="text">Уважаемый(ая) <strong>${client.first_name} ${client.last_name}</strong>,</p>
    <p class="text">Напоминаем, что до вашего тура осталось <strong style="color:#c9a84c">${daysLeft} ${daysLeft === 14 ? "дней" : "7 дней"}</strong>.</p>
    <div class="highlight">
      <p>🌍 <strong>Направление:</strong> ${destination.name}, ${destination.country}</p>
      <p>📅 <strong>Дата поездки:</strong> ${travelDate}</p>
      <p>👥 <strong>Количество человек:</strong> ${booking.people_count}</p>
      <p>💰 <strong>Сумма:</strong> ${Number(booking.total_price).toLocaleString("ru-RU")} ₽</p>
    </div>
    <p class="text">Желаем вам отличного путешествия! Если у вас есть вопросы, свяжитесь с нами.</p>
    <a href="${SITE}/dashboard" class="btn">Мои бронирования</a>
  `;

  await transporter.sendMail({
    from: FROM,
    to: client.email,
    subject: `⏰ До вашего тура в ${destination.name} осталось ${daysLeft} дней!`,
    html: template(`До тура осталось ${daysLeft} дней`, body),
  });
}

// -- Новость
async function sendNewsEmail(client, newsItem) {
  const body = `
    <p class="text">Уважаемый(ая) <strong>${client.first_name}</strong>,</p>
    <p class="text">У нас есть новость для вас!</p>
    <div class="highlight">
      <p><strong style="font-size:16px">${newsItem.title}</strong></p>
      <p style="margin-top:8px">${newsItem.excerpt || newsItem.content.slice(0, 200) + "..."}</p>
    </div>
    <a href="${SITE}/news/${newsItem.id}" class="btn">Читать полностью</a>
    <p class="text" style="font-size:13px;margin-top:20px">
      Если вы не хотите получать новости, 
      <a href="${SITE}/dashboard" style="color:#c9a84c">отпишитесь в личном кабинете</a>.
    </p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: client.email,
    subject: `📰 DianaTour: ${newsItem.title}`,
    html: template("Новости DianaTour", body),
  });
}

// -- Подтверждение бронирования
async function sendBookingConfirmation(client, booking, destination) {
  const travelDate = new Date(booking.travel_date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const body = `
    <p class="text">Уважаемый(ая) <strong>${client.first_name} ${client.last_name}</strong>,</p>
    <p class="text">Ваше бронирование успешно создано и ожидает подтверждения менеджера.</p>
    <div class="highlight">
      <p>🆔 <strong>Номер брони:</strong> #${booking.id}</p>
      <p>🌍 <strong>Направление:</strong> ${destination.name}, ${destination.country}</p>
      <p>📅 <strong>Дата поездки:</strong> ${travelDate}</p>
      <p>👥 <strong>Количество человек:</strong> ${booking.people_count}</p>
      <p>💰 <strong>Итоговая сумма:</strong> ${Number(booking.total_price).toLocaleString("ru-RU")} ₽</p>
    </div>
    <p class="text">Мы свяжемся с вами в ближайшее время для подтверждения.</p>
    <a href="${SITE}/dashboard" class="btn">Просмотреть бронирование</a>
  `;

  await transporter.sendMail({
    from: FROM,
    to: client.email,
    subject: `✅ Бронирование #${booking.id} создано — ${destination.name}`,
    html: template("Бронирование создано", body),
  });
}

module.exports = { sendTourReminder, sendNewsEmail, sendBookingConfirmation };
