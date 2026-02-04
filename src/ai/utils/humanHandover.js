// File: src/ai/utils/humanHandover.js
// Utilities to handoff conversations to human (BosMat) support.

const admin = require('firebase-admin');
const { DateTime } = require('luxon');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');

const BOSMAT_ADMIN_NUMBER = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER;
const NOTIFY_BOOKING_CREATION = process.env.NOTIFY_BOOKING_CREATION !== 'true';
const DEFAULT_ADDITIONAL_SERVICE = process.env.BOOKING_DEFAULT_ADDITIONAL_SERVICE || null;

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
  if (trimmed.endsWith('@lid')) return trimmed;
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

async function notifyVisitIntent({ senderNumber, senderName, visitTime, purpose, additionalNotes }) {
  if (!senderNumber) {
    throw new Error('[humanHandover] senderNumber wajib untuk notifikasi kunjungan.');
  }

  const displayName = senderName && senderName.trim() ? senderName.trim() : senderNumber;
  const lines = [
    '👋 *Info Konsultasi di Studio*',
    `👤 Pelanggan: ${displayName}`,
    `📞 Kontak: ${senderNumber}`,
  ];

  if (visitTime && visitTime.trim()) {
    lines.push(`🕒 Rencana Datang: ${visitTime.trim()}`);
  }

  if (purpose && purpose.trim()) {
    lines.push(`🎯 Keperluan: ${purpose.trim()}`);
  }

  if (additionalNotes && additionalNotes.trim()) {
    lines.push('', additionalNotes.trim());
  }

  lines.push('', '⚠️ Pastikan studio siap menyambut.');

  await sendWhatsappNotification(lines.join('\n'));
}

async function notifyNewBooking(bookingData) {
  if (!NOTIFY_BOOKING_CREATION) {
    return;
  }

  const additionalService = bookingData.additionalService
    || bookingData.homeService?.requested && bookingData.homeService?.type
    || DEFAULT_ADDITIONAL_SERVICE;

  const lines = [
    '🆕 *Booking Baru*',
    `👤 Nama: ${bookingData.customerName || '-'}`,
    `📞 No HP: ${bookingData.customerPhone || '-'}`,
    `🏍️ Motor: ${bookingData.vehicleInfo || '-'}`,
    `🕒 Jadwal: ${bookingData.bookingDate || '-'} ${bookingData.bookingTime || '-'}`,
    `🛠️ Layanan: ${Array.isArray(bookingData.services) ? bookingData.services.join(', ') : '-'}`,
  ];

  if (additionalService) {
    lines.push(`➕ Layanan Tambahan: ${additionalService}`);
  }

  if (bookingData.homeService?.requested) {
    const formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    });

    lines.push('', '🚚 Home Service: Ya');
    if (typeof bookingData.homeService.distanceKm === 'number') {
      lines.push(`   • Jarak: ${bookingData.homeService.distanceKm.toFixed(2)} km`);
    }
    if (typeof bookingData.homeService.additionalFee === 'number') {
      lines.push(`   • Biaya tambahan: ${formatter.format(Math.round(bookingData.homeService.additionalFee))}`);
    }
    if (bookingData.homeService.address) {
      lines.push(`   • Alamat: ${bookingData.homeService.address}`);
    } else if (bookingData.homeService.label) {
      lines.push(`   • Lokasi: ${bookingData.homeService.label}`);
    }
    if (bookingData.homeService.shareLocationUrl) {
      lines.push(`   • Share Lokasi: ${bookingData.homeService.shareLocationUrl}`);
    }
  } else if (bookingData.pickupService?.requested) {
    lines.push('', '🚚 Jemput-Antar: Ya');
    if (bookingData.pickupService.address) {
      lines.push(`   • Alamat: ${bookingData.pickupService.address}`);
    }
    if (bookingData.pickupService.shareLocationUrl) {
      lines.push(`   • Share Lokasi: ${bookingData.pickupService.shareLocationUrl}`);
    }
  }

  if (bookingData.notes) {
    lines.push('', `🗒️ Catatan: ${bookingData.notes}`);
  }

  await sendWhatsappNotification(lines.join('\n'));
}

async function setSnoozeMode(senderNumber, durationMinutes = 60, options = {}) {
  const { reason = null, manual = false } = options;
  const db = ensureFirestore();
  const normalizedNumber = normalizeWhatsappNumber(senderNumber) || senderNumber;
  const docRef = db.collection('handoverSnoozes').doc(normalizedNumber);

  let effectiveDuration = null;
  let expiresAtValue = null;

  if (!manual) {
    effectiveDuration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
    const expiresAtDate = DateTime.now().plus({ minutes: effectiveDuration }).toJSDate();
    expiresAtValue = admin.firestore.Timestamp.fromDate(expiresAtDate);
  }

  const payload = {
    senderNumber: normalizedNumber,
    durationMinutes: effectiveDuration,
    manual,
    reason: reason || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (manual) {
    payload.expiresAt = null;
  } else if (expiresAtValue) {
    payload.expiresAt = expiresAtValue;
  }

  await docRef.set(payload, { merge: true });

  console.log('[humanHandover] Snooze mode aktif untuk', normalizedNumber, manual ? '(manual)' : `(durasi ${effectiveDuration} menit)`);
}

async function clearSnoozeMode(senderNumber) {
  const db = ensureFirestore();
  const normalizedNumber = normalizeWhatsappNumber(senderNumber) || senderNumber;
  try {
    await db.collection('handoverSnoozes').doc(normalizedNumber).delete();
    console.log('[humanHandover] Snooze mode dinonaktifkan untuk', normalizedNumber);
  } catch (error) {
    console.warn('[humanHandover] Gagal menonaktifkan snooze:', error);
  }
}

async function getSnoozeInfo(senderNumber, { cleanExpired = false } = {}) {
  const db = ensureFirestore();
  const normalizedNumber = normalizeWhatsappNumber(senderNumber) || senderNumber;
  const docRef = db.collection('handoverSnoozes').doc(normalizedNumber);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return {
      active: false,
      manual: false,
      durationMinutes: null,
      expiresAt: null,
      reason: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  const data = snapshot.data() || {};
  const manual = Boolean(data.manual);
  const expiresAtDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : null;
  const now = new Date();

  let active = manual;

  if (!manual) {
    if (expiresAtDate && expiresAtDate > now) {
      active = true;
    } else {
      active = false;
      if (cleanExpired) {
        try {
          await docRef.delete();
        } catch (error) {
          console.warn('[humanHandover] Gagal menghapus snooze yang kadaluarsa:', error);
        }
      }
    }
  }

  return {
    active,
    manual,
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    reason: data.reason || null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
  };
}

async function isSnoozeActive(senderNumber) {
  const info = await getSnoozeInfo(senderNumber, { cleanExpired: true });
  return info.active;
}

module.exports = {
  notifyBosMat,
  notifyVisitIntent,
  notifyNewBooking,
  setSnoozeMode,
  clearSnoozeMode,
  getSnoozeInfo,
  normalizeWhatsappNumber,
  isSnoozeActive,
};