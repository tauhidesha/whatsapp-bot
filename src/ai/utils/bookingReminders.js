// File: src/ai/utils/bookingReminders.js
const { DateTime } = require('luxon');
const prisma = require('../../lib/prisma.js');
const { normalizeWhatsappNumber } = require('./humanHandover.js');
const studioMetadata = require('../constants/studioMetadata');

const REMINDER_ENABLED = process.env.BOOKING_REMINDER_ENABLED !== 'false';
const REMINDER_HOUR = parseInt(process.env.BOOKING_REMINDER_HOUR || '8', 10);
const REMINDER_WINDOW_MINUTES = parseInt(process.env.BOOKING_REMINDER_WINDOW || '30', 10);
const REMINDER_INTERVAL_MINUTES = parseInt(process.env.BOOKING_REMINDER_INTERVAL || '15', 10);
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

let reminderIntervalHandle = null;

async function sendReminderMessage(booking) {
  const client = global.whatsappClient;
  if (!client || typeof client.sendText !== 'function') {
    console.warn('[bookingReminders] whatsappClient belum tersedia, reminder ditunda');
    return false;
  }

  const target = booking.customerPhone || (booking.customer && booking.customer.phone);
  const normalizedTarget = normalizeWhatsappNumber(target);
  if (!normalizedTarget) {
    console.warn('[bookingReminders] Nomor pelanggan tidak valid, reminder dilewati');
    return false;
  }

  const customerName = booking.customerName || (booking.customer && booking.customer.name) || `Sobat ${studioMetadata.shortName}`;
  const layanan = booking.serviceType || `Layanan ${studioMetadata.shortName}`;
  
  const message = [
    `Halo ${customerName}! 👋`,
    '',
    `Reminder booking kamu hari ini di *${studioMetadata.name}*:`,
    `• Tanggal: ${DateTime.fromJSDate(booking.bookingDate).setZone(TIMEZONE).toFormat('dd MMM yyyy')}`,
    `• Jam: ${DateTime.fromJSDate(booking.bookingDate).setZone(TIMEZONE).toFormat('HH:mm')}`,
    `• Layanan: ${layanan}`,
    '',
    'Kalau perlu reschedule, kabari Zoya ya mas. Ditunggu kedatangannya! 🙌'
  ].join('\n');

  try {
    await client.sendText(normalizedTarget, message);
    console.log('[bookingReminders] Reminder terkirim ke', normalizedTarget);
    return true;
  } catch (error) {
    console.error('[bookingReminders] Gagal mengirim reminder ke', normalizedTarget, error);
    return false;
  }
}

async function sendBookingReminders(force = false) {
  if (!REMINDER_ENABLED) return;

  const now = DateTime.now().setZone(TIMEZONE);
  if (!force && (now.hour !== REMINDER_HOUR || now.minute >= REMINDER_WINDOW_MINUTES)) {
    return;
  }

  // Find bookings for today (local time)
  // Since SQL stores as UTC, we need to find the range.
  const startOfDayLocal = now.startOf('day');
  const endOfDayLocal = now.endOf('day');

  const startOfDayUTC = startOfDayLocal.toJSDate();
  const endOfDayUTC = endOfDayLocal.toJSDate();

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: startOfDayUTC,
          lte: endOfDayUTC
        },
        reminderSent: false,
        status: {
          notIn: ['CANCELLED', 'COMPLETED', 'IN_PROGRESS']
        }
      },
      include: {
        customer: {
          select: { phone: true, name: true }
        }
      }
    });

    if (bookings.length === 0) return;

    console.log(`[bookingReminders] Menemukan ${bookings.length} booking SQL untuk diingatkan`);

    for (const booking of bookings) {
      const sent = await sendReminderMessage(booking);
      if (sent) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            reminderSent: true,
            reminderSentAt: new Date(),
          }
        });
      }
    }
  } catch (err) {
    console.error('[bookingReminders] SQL Error:', err.message);
  }
}

function startBookingReminderScheduler() {
  if (!REMINDER_ENABLED) {
    console.log('[bookingReminders] Reminder booking dimatikan (BOOKING_REMINDER_ENABLED=false)');
    return;
  }

  if (reminderIntervalHandle) return;

  const intervalMs = REMINDER_INTERVAL_MINUTES * 60 * 1000;
  reminderIntervalHandle = setInterval(() => {
    sendBookingReminders().catch(error => {
      console.error('[bookingReminders] Error saat mengirim reminder:', error);
    });
  }, intervalMs);

  console.log(`[bookingReminders] SQL Scheduler dimulai. Interval ${REMINDER_INTERVAL_MINUTES} menit, pengingat jam ${REMINDER_HOUR}:00 ${TIMEZONE}`);
}

module.exports = {
  startBookingReminderScheduler,
  sendBookingReminders,
};
