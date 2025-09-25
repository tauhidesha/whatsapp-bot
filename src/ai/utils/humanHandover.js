// File: src/ai/utils/humanHandover.js
// Utilities to handoff conversations to human (BosMat) support.

const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');

const BOSMAT_ADMIN_NUMBER = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER;
const NOTIFY_BOOKING_CREATION = process.env.NOTIFY_BOOKING_CREATION !== 'false';

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return getFirebaseAdmin().firestore();
}

function normalizeWhatsappNumber(number) {
  if (!number) return null;
  const trimmed = number.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('@c.us')) return trimmed;
  if (trimmed.startsWith('+')) {
    return `${trimmed.slice(1)}@c.us`;
  }
  return `${trimmed.replace(/[^0-9]/g, '')}@c.us`;
}

async function sendWhatsappNotification(message) {
  if (!BOSMAT_ADMIN_NUMBER) {
    console.warn('[humanHandover] BOSMAT_ADMIN_NUMBER tidak diset. Notifikasi WA tidak dikirim.');
    return;
  }

  const target = normalizeWhatsappNumber(BOSMAT_ADMIN_NUMBER);
  if (!target) {
    console.warn('[humanHandover] BOSMAT_ADMIN_NUMBER tidak valid. Notifikasi WA tidak dikirim.');
    return;
  }

  const client = global.whatsappClient;
  if (!client || typeof client.sendText !== 'function') {
    console.warn('[humanHandover] whatsappClient belum tersedia. Notifikasi WA tidak dikirim.');
    return;
  }

  try {
    await client.sendText(target, message);
    console.log('[humanHandover] Notifikasi WA terkirim ke admin:', target);
  } catch (error) {
    console.error('[humanHandover] Gagal mengirim notifikasi WA ke admin:', error);
  }
}

async function notifyBosMat(senderNumber, customerQuestion, reason) {
  const db = ensureFirestore();
  const payload = {
    senderNumber,
    customerQuestion,
    reason,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('humanHandovers').add(payload);
  console.log('[humanHandover] Notifikasi handover tersimpan:', payload);

  const messageLines = [
    '🔔 *Human Handover Request*',
    `👤 Pelanggan: ${senderNumber}`,
    `📝 Alasan: ${reason}`,
    '',
    '❓ Pertanyaan:',
    customerQuestion,
  ];

  await sendWhatsappNotification(messageLines.join('\n'));
}

async function notifyNewBooking(bookingData) {
  if (!NOTIFY_BOOKING_CREATION) {
    return;
  }

  const lines = [
    '🆕 *Booking Baru*',
    `👤 Nama: ${bookingData.customerName || '-'}`,
    `📞 No HP: ${bookingData.customerPhone || '-'}`,
    `🏍️ Motor: ${bookingData.vehicleInfo || '-'}`,
    `🕒 Jadwal: ${bookingData.bookingDate || '-'} ${bookingData.bookingTime || '-'}`,
    `🛠️ Layanan: ${Array.isArray(bookingData.services) ? bookingData.services.join(', ') : '-'}`,
  ];
  if (bookingData.notes) {
    lines.push('', `🗒️ Catatan: ${bookingData.notes}`);
  }

  await sendWhatsappNotification(lines.join('\n'));
}

async function setSnoozeMode(senderNumber, durationMinutes = 60) {
  const db = ensureFirestore();
  const expiresAt = admin.firestore.FieldValue.serverTimestamp();

  await db.collection('handoverSnoozes').doc(senderNumber).set({
    senderNumber,
    durationMinutes,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  }, { merge: true });

  console.log('[humanHandover] Snooze mode aktif untuk', senderNumber);
}

module.exports = {
  notifyBosMat,
  notifyNewBooking,
  setSnoozeMode,
  normalizeWhatsappNumber,
};
