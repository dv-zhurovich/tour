const cron = require("node-cron");
const { pool } = require("../db");
const { sendTourReminder } = require("./mailer");

// Запускается каждый день в 09:00 и ищет туры, до которых осталось 14 или 7 дней
cron.schedule("0 9 * * *", async () => {
  console.log("⏰ Проверка напоминаний о турах...");
  try {
    for (const days of [14, 7]) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const dateStr = targetDate.toISOString().split("T")[0];

      const { rows: bookings } = await pool.query(
        `SELECT b.*, c.first_name, c.last_name, c.email, c.email_reminders,
                d.name as dest_name, d.country, d.image_url
         FROM bookings b
         JOIN clients c ON b.client_id = c.id
         JOIN destinations d ON b.destination_id = d.id
         WHERE b.travel_date::date = $1
           AND b.status IN ('confirmed', 'pending')
           AND c.email_reminders = TRUE`,
        [dateStr],
      );

      for (const booking of bookings) {
        // Проверяем журнал, чтобы одно и то же напоминание не ушло повторно
        const { rows: already } = await pool.query(
          `SELECT id FROM notification_log
           WHERE client_id = $1 AND booking_id = $2 AND type = $3`,
          [booking.client_id, booking.id, `reminder_${days}`],
        );
        if (already.length > 0) continue;

        try {
          await sendTourReminder(
            {
              first_name: booking.first_name,
              last_name: booking.last_name,
              email: booking.email,
            },
            booking,
            { name: booking.dest_name, country: booking.country },
            days,
          );

          await pool.query(
            `INSERT INTO notification_log (client_id, booking_id, type) VALUES ($1, $2, $3)`,
            [booking.client_id, booking.id, `reminder_${days}`],
          );

          console.log(`📧 Напоминание за ${days} дней → ${booking.email}`);
        } catch (err) {
          console.error(`Ошибка отправки напоминания: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error("Scheduler error:", err.message);
  }
});

console.log("📅 Планировщик уведомлений запущен");
module.exports = {};
