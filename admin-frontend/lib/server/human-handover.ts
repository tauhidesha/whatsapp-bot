/**
 * Human Handover / Snooze Mode
 * Controls AI pause/resume per conversation
 * Ported from src/ai/utils/humanHandover.js
 */

import { getDb, normalizeWhatsappNumber, FieldValue, Timestamp } from './firebase-admin';
import { sendText } from './fonnte-client';

const BOSMAT_ADMIN_NUMBER = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER || '';

// --- Snooze Mode ---

export async function setSnoozeMode(
  senderNumber: string,
  durationMinutes = 60,
  options: { reason?: string; manual?: boolean } = {}
) {
  const { reason = null, manual = false } = options;
  const db = getDb();
  const normalized = normalizeWhatsappNumber(senderNumber) || senderNumber;
  const docRef = db.collection('handoverSnoozes').doc(normalized);

  let effectiveDuration: number | null = null;
  let expiresAtValue: FirebaseFirestore.Timestamp | null = null;

  if (!manual) {
    effectiveDuration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
    const expiresDate = new Date(Date.now() + effectiveDuration * 60 * 1000);
    expiresAtValue = Timestamp.fromDate(expiresDate);
  }

  const payload: Record<string, any> = {
    senderNumber: normalized,
    durationMinutes: effectiveDuration,
    manual,
    reason: reason || null,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };

  payload.expiresAt = manual ? null : expiresAtValue;
  await docRef.set(payload, { merge: true });

  // Sync to directMessages for frontend UI
  try {
    const docId = normalized.replace(/@c\.us$|@lid$/, '');
    await db.collection('directMessages').doc(docId).update({
      aiEnabled: false,
      aiPaused: true,
      aiPausedUntil: expiresAtValue,
      aiPauseReason: reason || (manual ? 'manual-toggle' : 'timed-toggle'),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.warn('[Handover] Failed to sync snooze to directMessages:', err.message);
  }

  console.log(`[Handover] Snooze ON for ${normalized}`, manual ? '(manual)' : `(${effectiveDuration}min)`);
}

export async function clearSnoozeMode(senderNumber: string) {
  const db = getDb();
  const normalized = normalizeWhatsappNumber(senderNumber) || senderNumber;

  try {
    await db.collection('handoverSnoozes').doc(normalized).delete();

    const docId = normalized.replace(/@c\.us$|@lid$/, '');
    await db.collection('directMessages').doc(docId).update({
      aiEnabled: true,
      aiPaused: false,
      aiPausedUntil: null,
      aiPauseReason: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Handover] Snooze OFF for ${normalized}`);
  } catch (err: any) {
    console.warn('[Handover] Failed to clear snooze:', err.message);
  }
}

export interface SnoozeInfo {
  active: boolean;
  manual: boolean;
  durationMinutes: number | null;
  expiresAt: string | null;
  reason: string | null;
}

export async function getSnoozeInfo(
  senderNumber: string,
  options: { cleanExpired?: boolean } = {}
): Promise<SnoozeInfo> {
  const db = getDb();
  const normalized = normalizeWhatsappNumber(senderNumber) || senderNumber;
  const docRef = db.collection('handoverSnoozes').doc(normalized);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return { active: false, manual: false, durationMinutes: null, expiresAt: null, reason: null };
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
      if (options.cleanExpired) {
        try { await docRef.delete(); } catch {}
      }
    }
  }

  return {
    active,
    manual,
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
    reason: data.reason || null,
  };
}

export async function isSnoozeActive(senderNumber: string): Promise<boolean> {
  const info = await getSnoozeInfo(senderNumber, { cleanExpired: true });
  return info.active;
}

// --- Admin Notifications (via Fonnte instead of wppconnect) ---

export async function notifyAdmin(message: string) {
  if (!BOSMAT_ADMIN_NUMBER) {
    console.warn('[Handover] BOSMAT_ADMIN_NUMBER not set');
    return;
  }
  try {
    await sendText(BOSMAT_ADMIN_NUMBER, message);
    console.log('[Handover] Admin notification sent via Fonnte');
  } catch (err: any) {
    console.error('[Handover] Failed to send admin notification:', err.message);
  }
}

export async function notifyNewBooking(bookingData: Record<string, any>) {
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

  await notifyAdmin(lines.join('\n'));
}
