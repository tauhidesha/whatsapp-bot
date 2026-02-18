// File: src/ai/utils/bookingReminders.js
// Periodically send WhatsApp reminders for bookings scheduled for today.

const { DateTime } = require('luxon');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const { normalizeWhatsappNumber } = require('./humanHandover.js');

const REMINDER_ENABLED = process.env.BOOKING_REMINDER_ENABLED !== 'false';
const REMINDER_HOUR = parseInt(process.env.BOOKING_REMINDER_HOUR || '8', 10);
const REMINDER_WINDOW_MINUTES = parseInt(process.env.BOOKING_REMINDER_WINDOW || '30', 10);
const REMINDER_INTERVAL_MINUTES = parseInt(process.env.BOOKING_REMINDER_INTERVAL || '15', 10);
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

let reminderIntervalHandle = null;

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return getFirebaseAdmin().firestore();
}

async function sendReminderMessage(booking) {
  const client = global.whatsappClient;
  if (!client || typeof client.sendText !== 'function') {
    console.warn('[bookingReminders] whatsappClient belum tersedia, reminder ditunda');
    return false;
  }

  const target = booking.customerPhoneNormalized || normalizeWhatsappNumber(booking.customerPhone);
  if (!target) {
    console.warn('[bookingReminders] Nomor pelanggan tidak valid, reminder dilewati');
    return false;
  }

  const customerName = booking.customerName || 'BosMat Friend';
  const layanan = Array.isArray(booking.services) && booking.services.length > 0
    ? booking.services.join(', ')
    : booking.serviceName || 'Layanan Bosmat';
  const message = [
    `Halo ${customerName}! 👋`,
    '',
    'Reminder booking kamu hari ini di *Bosmat*:',
    `• Tanggal: ${booking.bookingDate || '-'}`,
    `• Jam: ${booking.bookingTime || '-'}`,
    `• Layanan: ${layanan}`,
    '',
    'Kalau perlu reschedule, kabari Zoya ya mas. Ditunggu kedatangannya! 🙌'
  ].join('\n');

  try {
    await client.sendText(target, message);
    console.log('[bookingReminders] Reminder terkirim ke', target);
    return true;
  } catch (error) {
    console.error('[bookingReminders] Gagal mengirim reminder ke', target, error);
    return false;
  }
}

async function sendBookingReminders(force = false) {
  if (!REMINDER_ENABLED) {
    return;
  }

  const now = DateTime.now().setZone(TIMEZONE);
  // Reaksi normal: hanya jam 8 pagi di menit 0-30
  // Jika force: lompati pengecekan jam (berguna buat startup atau testing)
  if (!force && (now.hour !== REMINDER_HOUR || now.minute >= REMINDER_WINDOW_MINUTES)) {
    return;
  }

  const today = now.toISODate();
  const firestore = ensureFirestore();

  const snapshot = await firestore
    .collection('bookings')
    .where('bookingDate', '==', today)
    .get();

  if (snapshot.empty) {
    return;
  }

  const operations = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data) return;

    if (data.reminderSent) return;

    const status = (data.status || '').toLowerCase();
    if (status === 'cancelled') return;

    operations.push({ id: doc.id, data });
  });

  if (operations.length === 0) {
    return;
  }

  console.log(`[bookingReminders] Menemukan ${operations.length} booking untuk diingatkan`);

  for (const op of operations) {
    const sent = await sendReminderMessage(op.data);
    if (sent) {
      await firestore.collection('bookings').doc(op.id).update({
        reminderSent: true,
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

function startBookingReminderScheduler() {
  if (!REMINDER_ENABLED) {
    console.log('[bookingReminders] Reminder booking dimatikan (BOOKING_REMINDER_ENABLED=false)');
    return;
  }

  if (reminderIntervalHandle) {
    return;
  }

  const intervalMs = REMINDER_INTERVAL_MINUTES * 60 * 1000;
  reminderIntervalHandle = setInterval(() => {
    sendBookingReminders().catch(error => {
      console.error('[bookingReminders] Error saat mengirim reminder:', error);
    });
  }, intervalMs);

  console.log(`[bookingReminders] Scheduler dimulai. Interval ${REMINDER_INTERVAL_MINUTES} menit, pengingat jam ${REMINDER_HOUR}:00 ${TIMEZONE}`);

  sendBookingReminders(true).catch(error => {
    console.error('[bookingReminders] Error saat run awal:', error);
  });
}

module.exports = {
  startBookingReminderScheduler,
  sendBookingReminders,
};
